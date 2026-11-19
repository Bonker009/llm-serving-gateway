"""
Host server monitor — collects live machine metrics for the dashboard's
Server Monitor page.

The dashboard runs inside a container, so to see the *host* (where the GPUs and
the Ollama/vLLM backends actually run) the container is given the NVIDIA runtime
and read-only bind mounts of the host's ``/proc``, ``/sys`` and root filesystem.
This module reads those:

- **GPU** via the ``nvidia-smi`` binary injected by the NVIDIA container runtime —
  utilisation, memory, temp, power, clocks, PCIe link, throttle reasons, ECC,
  encoder/decoder, and per-process memory.
- **CPU / memory / swap / processes / network I/O / disk I/O / uptime** via ``psutil``
  pointed at the host ``/proc`` (``HOST_PROC``). CPU utilisation, the user/system/
  iowait/steal breakdown, network and disk throughput are rate-based and share one
  short sampling window.
- **Disk capacity** via ``psutil.disk_usage`` on each host mountpoint (under ``HOST_ROOT``).
- **Temperatures** via lm-sensors (``psutil.sensors_temperatures``; Linux only).
- **Logged-in users** via ``who`` against the host utmp.

Every section is defensive: if a tool or mount is missing (e.g. no GPU, or running
on a dev box without the host mounts) that section degrades to an ``available: false``
/ empty result instead of failing the whole endpoint.
"""
from __future__ import annotations

import asyncio
import os
import platform
import shutil
import socket
import subprocess
import time
from datetime import datetime, timezone
from typing import Any

try:
    import psutil
except ImportError:  # pragma: no cover - psutil is a hard dependency in the image
    psutil = None  # type: ignore

# ---------------------------------------------------------------------------
# Host-access configuration (set in docker-compose when the host is mounted)
# ---------------------------------------------------------------------------
HOST_PROC = os.environ.get("HOST_PROC")  # e.g. /host/proc
HOST_ROOT = os.environ.get("HOST_ROOT")  # e.g. /host (host / mounted read-only)

# Point psutil at the host /proc if it was mounted in. This redirects CPU, memory,
# swap, boot-time and process reads to the host instead of the container.
if psutil is not None and HOST_PROC and os.path.isdir(HOST_PROC):
    psutil.PROCFS_PATH = HOST_PROC
    _HOST_MOUNTED = True
else:
    _HOST_MOUNTED = bool(HOST_PROC)

# Pseudo filesystems we never want to show as "disks" (df would list some of
# these, but they are noise for a capacity view).
_SKIP_FSTYPES = {
    "proc", "sysfs", "cgroup", "cgroup2", "devpts", "mqueue", "debugfs", "tracefs",
    "securityfs", "pstore", "bpf", "autofs", "hugetlbfs", "nsfs", "binfmt_misc",
    "configfs", "fusectl", "devtmpfs", "ramfs", "rpc_pipefs", "selinuxfs",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run(cmd: list[str], timeout: float = 5.0) -> str | None:
    """Run a command, returning stdout (or None on any failure)."""
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


# ---------------------------------------------------------------------------
# GPU (nvidia-smi)
# ---------------------------------------------------------------------------
def _f(v: str) -> float | None:
    v = (v or "").strip()
    if not v or v in ("[N/A]", "N/A", "[Not Supported]", "Not Supported"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


# nvidia throttle/clock-event bitmask (clocks_throttle_reasons.active). We split
# "concerning" slowdowns (shown as a red badge) from benign states like idle.
_THROTTLE_BITS = [
    (0x0000000000000001, "Idle", False),
    (0x0000000000000002, "App clocks setting", False),
    (0x0000000000000004, "SW power cap", True),
    (0x0000000000000008, "HW slowdown", True),
    (0x0000000000000010, "Sync boost", False),
    (0x0000000000000020, "SW thermal slowdown", True),
    (0x0000000000000040, "HW thermal slowdown", True),
    (0x0000000000000080, "HW power brake", True),
    (0x0000000000000100, "Display clocks setting", False),
]


def _throttle_reasons(hex_val: str | None) -> tuple[list[str], bool]:
    """Decode the throttle bitmask → (reason labels, any concerning slowdown)."""
    if not hex_val:
        return [], False
    try:
        mask = int(str(hex_val).strip(), 16)
    except (ValueError, TypeError):
        return [], False
    reasons, concerning = [], False
    for bit, label, is_bad in _THROTTLE_BITS:
        if mask & bit:
            reasons.append(label)
            concerning = concerning or is_bad
    return reasons, concerning


def _query_gpu(fields: list[str]) -> list[list[str]] | None:
    """Run an nvidia-smi --query-gpu and return parsed rows (or None on failure).

    Kept separate so an *extended* query using a newer/unsupported field can fail
    on its own without taking down the core GPU card.
    """
    out = _run([
        "nvidia-smi",
        f"--query-gpu={','.join(fields)}",
        "--format=csv,noheader,nounits",
    ])
    if out is None:
        return None
    rows = []
    for line in out.strip().splitlines():
        if line.strip():
            rows.append([c.strip() for c in line.split(",")])
    return rows


def _collect_gpus() -> dict[str, Any]:
    try:
        return _collect_gpus_inner()
    except Exception as exc:  # never let GPU parsing break the endpoint
        return {"available": False, "error": f"gpu probe failed: {exc}", "items": []}


def _collect_gpus_inner() -> dict[str, Any]:
    if not shutil.which("nvidia-smi"):
        return {"available": False, "error": "nvidia-smi not found", "items": []}

    # --- Core query: long-stable fields, required. If this fails, GPUs are "down". ---
    core = [
        "index", "uuid", "name", "utilization.gpu", "utilization.memory",
        "memory.used", "memory.total", "temperature.gpu", "power.draw",
        "power.limit", "fan.speed",
    ]
    rows = _query_gpu(core)
    if rows is None:
        return {"available": False, "error": "nvidia-smi query failed", "items": []}

    gpus: list[dict[str, Any]] = []
    by_uuid: dict[str, dict[str, Any]] = {}
    by_index: dict[int, dict[str, Any]] = {}
    for cells in rows:
        if len(cells) < len(core):
            continue
        used, total = _f(cells[5]), _f(cells[6])
        mem_pct = round(used / total * 100, 1) if used is not None and total else None
        idx = int(_f(cells[0]) or 0)
        item = {
            "index": idx,
            "uuid": cells[1],
            "name": cells[2],
            "util_percent": _f(cells[3]),
            "mem_io_percent": _f(cells[4]),       # memory-controller bandwidth util
            "mem_used_mb": used,
            "mem_total_mb": total,
            "mem_percent": mem_pct,
            "temp_c": _f(cells[7]),
            "power_w": _f(cells[8]),
            "power_limit_w": _f(cells[9]),
            "fan_percent": _f(cells[10]),
            # Extended (filled below when supported):
            "sm_clock_mhz": None, "sm_clock_max_mhz": None,
            "mem_clock_mhz": None, "mem_clock_max_mhz": None,
            "pcie_gen": None, "pcie_gen_max": None,
            "pcie_width": None, "pcie_width_max": None,
            "ecc_errors": None,
            "throttle_reasons": [], "throttled": False,
            "encoder_percent": None, "decoder_percent": None,
            "processes": [],
        }
        gpus.append(item)
        by_uuid[cells[1]] = item
        by_index[idx] = item

    # --- Extended query: clocks / PCIe / throttle / ECC. Best-effort. ---
    ext = [
        "index", "clocks.current.sm", "clocks.max.sm", "clocks.current.memory",
        "clocks.max.memory", "pcie.link.gen.current", "pcie.link.gen.max",
        "pcie.link.width.current", "pcie.link.width.max",
        "clocks_throttle_reasons.active", "ecc.errors.uncorrected.aggregate.total",
    ]
    erows = _query_gpu(ext)
    for cells in erows or []:
        if len(cells) < len(ext):
            continue
        gpu = by_index.get(int(_f(cells[0]) or 0))
        if gpu is None:
            continue
        reasons, concerning = _throttle_reasons(cells[9])
        gpu.update({
            "sm_clock_mhz": _f(cells[1]), "sm_clock_max_mhz": _f(cells[2]),
            "mem_clock_mhz": _f(cells[3]), "mem_clock_max_mhz": _f(cells[4]),
            "pcie_gen": _f(cells[5]), "pcie_gen_max": _f(cells[6]),
            "pcie_width": _f(cells[7]), "pcie_width_max": _f(cells[8]),
            "throttle_reasons": reasons, "throttled": concerning,
            "ecc_errors": _f(cells[10]),
        })

    # --- Encoder/decoder utilisation: its own best-effort query (field names vary). ---
    encrows = _query_gpu(["index", "utilization.encoder", "utilization.decoder"])
    for cells in encrows or []:
        if len(cells) < 3:
            continue
        gpu = by_index.get(int(_f(cells[0]) or 0))
        if gpu is not None:
            gpu["encoder_percent"] = _f(cells[1])
            gpu["decoder_percent"] = _f(cells[2])

    # Per-process GPU memory usage, mapped back to each GPU by uuid.
    apps = _run([
        "nvidia-smi",
        "--query-compute-apps=gpu_uuid,pid,process_name,used_memory",
        "--format=csv,noheader,nounits",
    ])
    if apps:
        for line in apps.strip().splitlines():
            cells = [c.strip() for c in line.split(",")]
            if len(cells) < 4:
                continue
            gpu = by_uuid.get(cells[0])
            if gpu is None:
                continue
            pid = int(_f(cells[1]) or 0)
            gpu["processes"].append({
                "pid": pid,
                "name": cells[2],
                "used_mb": _f(cells[3]),
                "user": _proc_user(pid),
            })

    gpus.sort(key=lambda g: g["index"])
    return {"available": True, "error": None, "items": gpus}


def _proc_user(pid: int) -> str | None:
    """Best-effort owner of a pid (via host /proc), for GPU process rows."""
    if psutil is None or not pid:
        return None
    try:
        return psutil.Process(pid).username()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Memory / swap / host info (static — no sampling window needed)
# ---------------------------------------------------------------------------
def _collect_mem_host() -> dict[str, Any]:
    result: dict[str, Any] = {"memory": {}, "swap": {}, "host": {}}
    if psutil is None:
        return result

    try:
        vm = psutil.virtual_memory()
        result["memory"] = {
            "total": vm.total,
            "used": vm.used,
            "available": vm.available,
            "percent": vm.percent,
            "cached": getattr(vm, "cached", None),
            "buffers": getattr(vm, "buffers", None),
        }
    except Exception:
        result["memory"] = {}

    try:
        sm = psutil.swap_memory()
        result["swap"] = {
            "total": sm.total,
            "used": sm.used,
            "free": sm.free,
            "percent": sm.percent,
        }
    except Exception:
        result["swap"] = {}

    # Host summary.
    host: dict[str, Any] = {
        "hostname": socket.gethostname(),
        "os": None,
        "kernel": None,
        "cpu_count": None,
        "cpu_count_logical": None,
        "load_avg": None,
        "boot_time": None,
        "uptime_seconds": None,
    }
    try:
        host["os"] = f"{platform.system()} {platform.release()}".strip()
        host["kernel"] = platform.version()
    except Exception:
        pass
    try:
        host["cpu_count"] = psutil.cpu_count(logical=False)
        host["cpu_count_logical"] = psutil.cpu_count(logical=True)
    except Exception:
        pass
    try:
        # Load average is a kernel-global figure — a container shares the host's.
        la = os.getloadavg()
        host["load_avg"] = [round(x, 2) for x in la]
    except (OSError, AttributeError):
        host["load_avg"] = None
    try:
        boot = psutil.boot_time()
        host["boot_time"] = datetime.fromtimestamp(boot, timezone.utc).isoformat()
        host["uptime_seconds"] = int(time.time() - boot)
    except Exception:
        pass
    result["host"] = host
    return result


# ---------------------------------------------------------------------------
# Disk (df)
# ---------------------------------------------------------------------------
def _host_path(mountpoint: str) -> str:
    """Translate a host mountpoint into the path visible inside the container."""
    if not HOST_ROOT:
        return mountpoint
    if mountpoint == "/":
        return HOST_ROOT
    return os.path.join(HOST_ROOT, mountpoint.lstrip("/"))


def _collect_disks() -> list[dict[str, Any]]:
    if psutil is None:
        return []
    disks: list[dict[str, Any]] = []
    seen: set[str] = set()
    try:
        partitions = psutil.disk_partitions(all=False)
    except Exception:
        partitions = []
    for p in partitions:
        if p.fstype in _SKIP_FSTYPES or not p.fstype:
            continue
        if p.mountpoint in seen:
            continue
        seen.add(p.mountpoint)
        path = _host_path(p.mountpoint)
        try:
            # psutil.disk_usage is cross-platform (statvfs on POSIX, Win32 API on
            # Windows) and takes any path — so it works on the host-mounted path too.
            usage = psutil.disk_usage(path)
        except (OSError, FileNotFoundError):
            continue
        if usage.total <= 0:
            continue
        disks.append({
            "device": p.device,
            "mountpoint": p.mountpoint,
            "fstype": p.fstype,
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent": round(usage.percent, 1),
        })
    disks.sort(key=lambda d: d["total"], reverse=True)
    return disks


# ---------------------------------------------------------------------------
# Dynamic sampling: CPU utilisation, network I/O, disk I/O and top processes
# are all rate-based, so they share ONE short sampling window (prime → sleep →
# read) instead of each paying its own sleep.
# ---------------------------------------------------------------------------
def _net_counters() -> dict[str, Any]:
    try:
        return psutil.net_io_counters(pernic=True) or {}
    except Exception:
        return {}


def _diskio_counters() -> Any:
    try:
        return psutil.disk_io_counters(perdisk=False)
    except Exception:
        return None


def _rate(a: Any, b: Any, dt: float) -> float | None:
    if a is None or b is None or dt <= 0:
        return None
    return max(0.0, (b - a) / dt)


def _net_rates(n0: dict, n1: dict, dt: float) -> dict[str, Any]:
    ifaces = []
    tot_rx = tot_tx = 0.0
    for name, c1 in (n1 or {}).items():
        c0 = (n0 or {}).get(name)
        if c0 is None:
            continue
        rx = _rate(c0.bytes_recv, c1.bytes_recv, dt) or 0.0
        tx = _rate(c0.bytes_sent, c1.bytes_sent, dt) or 0.0
        # Skip loopback and idle interfaces to keep the view meaningful.
        if name == "lo" or (rx == 0.0 and tx == 0.0):
            continue
        ifaces.append({"name": name, "rx_bytes_sec": rx, "tx_bytes_sec": tx})
        tot_rx += rx
        tot_tx += tx
    ifaces.sort(key=lambda i: i["rx_bytes_sec"] + i["tx_bytes_sec"], reverse=True)
    return {
        "total": {"rx_bytes_sec": tot_rx, "tx_bytes_sec": tot_tx},
        "interfaces": ifaces,
    }


def _diskio_rates(d0: Any, d1: Any, dt: float) -> dict[str, Any]:
    if d0 is None or d1 is None:
        return {}
    return {
        "read_bytes_sec": _rate(d0.read_bytes, d1.read_bytes, dt),
        "write_bytes_sec": _rate(d0.write_bytes, d1.write_bytes, dt),
        "read_iops": _rate(d0.read_count, d1.read_count, dt),
        "write_iops": _rate(d0.write_count, d1.write_count, dt),
    }


_CPU_TIME_FIELDS = (
    "user", "system", "iowait", "steal", "idle", "nice", "irq", "softirq", "guest",
)


def _sample_dynamic(limit: int = 8, interval: float = 0.5) -> dict[str, Any]:
    out: dict[str, Any] = {
        "cpu": {}, "network": {}, "disk_io": {},
        "processes": {"top_cpu": [], "top_mem": []},
    }
    if psutil is None:
        return out

    ncpu = psutil.cpu_count(logical=True) or 1

    # --- Prime every rate-based reading, then sleep once. ---
    try:
        psutil.cpu_percent(percpu=True)       # prime per-core
    except Exception:
        pass
    try:
        psutil.cpu_times_percent()            # prime breakdown
    except Exception:
        pass
    try:
        procs = list(psutil.process_iter(["pid", "name", "username"]))
    except Exception:
        procs = []
    for p in procs:
        try:
            p.cpu_percent(None)
        except Exception:
            pass
    net0 = _net_counters()
    dio0 = _diskio_counters()
    t0 = time.monotonic()

    time.sleep(interval)
    dt = time.monotonic() - t0 or interval

    # --- CPU utilisation + time breakdown + frequency. ---
    try:
        per_core = psutil.cpu_percent(percpu=True)
        overall = round(sum(per_core) / len(per_core), 1) if per_core else None
    except Exception:
        per_core, overall = [], None
    times: dict[str, float] = {}
    try:
        tp = psutil.cpu_times_percent()
        for k in _CPU_TIME_FIELDS:
            v = getattr(tp, k, None)
            if v is not None:
                times[k] = round(v, 1)
    except Exception:
        times = {}
    freq = None
    try:
        f = psutil.cpu_freq()
        freq = round(f.current) if f else None
    except Exception:
        freq = None
    out["cpu"] = {
        "percent": overall,
        "per_core": [round(c, 1) for c in per_core],
        "freq_mhz": freq,
        "times": times,
    }

    # --- Network + disk I/O rates over the same window. ---
    out["network"] = _net_rates(net0, _net_counters(), dt)
    out["disk_io"] = _diskio_rates(dio0, _diskio_counters(), dt)

    # --- Top processes (cpu_percent now has a real delta). ---
    rows: list[dict[str, Any]] = []
    for p in procs:
        try:
            info = p.info
            cpu = p.cpu_percent(None)
            mem_pct = p.memory_percent()
            rss = p.memory_info().rss
        except Exception:
            continue
        rows.append({
            "pid": info.get("pid"),
            "name": info.get("name") or "?",
            "user": info.get("username"),
            # Normalise so 100% == all cores fully busy (like `top` with Irix off).
            "cpu_percent": round(cpu / ncpu, 1),
            "mem_percent": round(mem_pct, 1),
            "mem_rss": rss,
        })
    out["processes"] = {
        "top_cpu": sorted(rows, key=lambda r: r["cpu_percent"], reverse=True)[:limit],
        "top_mem": sorted(rows, key=lambda r: r["mem_rss"], reverse=True)[:limit],
    }
    return out


# ---------------------------------------------------------------------------
# Temperatures (lm-sensors via psutil; Linux-only, empty elsewhere)
# ---------------------------------------------------------------------------
def _collect_temps() -> list[dict[str, Any]]:
    if psutil is None or not hasattr(psutil, "sensors_temperatures"):
        return []
    try:
        raw = psutil.sensors_temperatures()
    except Exception:
        return []
    temps: list[dict[str, Any]] = []
    for chip, entries in (raw or {}).items():
        for e in entries:
            temps.append({
                "chip": chip,
                "label": e.label or chip,
                "current": round(e.current, 1) if e.current is not None else None,
                "high": round(e.high, 1) if e.high else None,
                "critical": round(e.critical, 1) if e.critical else None,
            })
    return temps


# ---------------------------------------------------------------------------
# Logged-in users (who)
# ---------------------------------------------------------------------------
def _collect_users() -> list[dict[str, Any]]:
    # Prefer the host utmp if the host root was mounted; else the local one.
    candidates = []
    if HOST_ROOT:
        candidates.append(os.path.join(HOST_ROOT, "var/run/utmp"))
        candidates.append(os.path.join(HOST_ROOT, "run/utmp"))
    out = None
    if shutil.which("who"):
        for utmp in candidates:
            if os.path.exists(utmp):
                out = _run(["who", utmp])
                if out is not None:
                    break
        if out is None:
            out = _run(["who"])

    users: list[dict[str, Any]] = []
    if out:
        for line in out.strip().splitlines():
            parts = line.split()
            if len(parts) < 2:
                continue
            host = None
            if parts and parts[-1].startswith("(") and parts[-1].endswith(")"):
                host = parts[-1].strip("()")
            users.append({
                "name": parts[0],
                "terminal": parts[1],
                "started": " ".join(parts[2:5]) if len(parts) >= 5 else None,
                "host": host,
            })
        return users

    # Fallback: psutil.users() (reads the container utmp — usually empty, but try).
    if psutil is not None:
        try:
            for u in psutil.users():
                users.append({
                    "name": u.name,
                    "terminal": u.terminal,
                    "started": datetime.fromtimestamp(
                        u.started, timezone.utc
                    ).isoformat(),
                    "host": u.host or None,
                })
        except Exception:
            pass
    return users


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------
def _safe(fn, default):
    """Call a collector, swallowing any failure so one bad section can't take
    down the whole endpoint. Returns `default` on error."""
    try:
        return fn()
    except Exception:
        return default


def _collect_sync() -> dict[str, Any]:
    gpus = _safe(_collect_gpus, {"available": False, "error": "unavailable", "items": []})
    base = _safe(_collect_mem_host, {"memory": {}, "swap": {}, "host": {}})
    dyn = _safe(
        _sample_dynamic,
        {"cpu": {}, "network": {}, "disk_io": {}, "processes": {"top_cpu": [], "top_mem": []}},
    )
    return {
        "collected_at": _now_iso(),
        "host": base.get("host", {}),
        "cpu": dyn.get("cpu", {}),
        "memory": base.get("memory", {}),
        "swap": base.get("swap", {}),
        "network": dyn.get("network", {}),
        "disk_io": dyn.get("disk_io", {}),
        "temps": _safe(_collect_temps, []),
        "gpus": gpus,
        "disks": _safe(_collect_disks, []),
        "processes": dyn.get("processes", {"top_cpu": [], "top_mem": []}),
        "users": _safe(_collect_users, []),
        "sources": {
            "psutil": psutil is not None,
            "nvidia_smi": gpus.get("available", False),
            "host_mounted": _HOST_MOUNTED,
        },
    }


def _empty_stats(error: str | None = None) -> dict[str, Any]:
    return {
        "collected_at": _now_iso(),
        "host": {},
        "cpu": {},
        "memory": {},
        "swap": {},
        "network": {},
        "disk_io": {},
        "temps": [],
        "gpus": {"available": False, "error": error or "unavailable", "items": []},
        "disks": [],
        "processes": {"top_cpu": [], "top_mem": []},
        "users": [],
        "sources": {
            "psutil": psutil is not None,
            "nvidia_smi": False,
            "host_mounted": _HOST_MOUNTED,
        },
        "error": error,
    }


async def collect_server_stats() -> dict[str, Any]:
    """Collect host metrics off the event loop (psutil + subprocess block).

    Always resolves to a well-formed payload: if collection fails outright the
    caller still gets the expected shape with an ``error`` field set, so the UI
    degrades gracefully instead of seeing a 500.
    """
    try:
        return await asyncio.to_thread(_collect_sync)
    except Exception as exc:
        return _empty_stats(f"metric collection failed: {exc}")
