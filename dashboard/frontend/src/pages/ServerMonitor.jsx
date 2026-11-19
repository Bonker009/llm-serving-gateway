import * as React from 'react'
import {
  RefreshCw,
  Cpu,
  MemoryStick,
  HardDrive,
  Thermometer,
  Zap,
  Users,
  Clock,
  Gauge,
  Server,
  Network,
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleAlert,
  TriangleAlert,
} from 'lucide-react'
import { getServerStats } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { StatTile } from '@/components/stat-tile'
import { Sparkline } from '@/components/sparkline'
import {
  formatBytes,
  formatMB,
  formatRate,
  formatIops,
  formatDuration,
  formatPercent,
  formatTime,
  formatNumber,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const REFRESH_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '5', label: '5s' },
  { value: '10', label: '10s' },
  { value: '30', label: '30s' },
]

const HISTORY_MAX = 60 // rolling samples kept for sparklines

// Thresholds shared across every utilisation meter: azure until busy, amber when
// hot, red when nearly saturated. Keeps the status palette consistent.
function usageTone(pct) {
  if (pct == null) return 'muted'
  if (pct >= 90) return 'critical'
  if (pct >= 70) return 'warning'
  return 'primary'
}

const TONE_BAR = {
  primary: 'bg-primary',
  warning: 'bg-warning',
  critical: 'bg-critical',
  muted: 'bg-muted-foreground/40',
}

function Meter({ value, tone, className }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  const t = tone || usageTone(value)
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-elevated', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONE_BAR[t])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MeterRow({ label, value, right, tone }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="tabular shrink-0 font-mono text-xs text-foreground">{right}</span>
      </div>
      <Meter value={value} tone={tone} />
    </div>
  )
}

function Unavailable({ message, tone = 'muted' }) {
  const Icon = tone === 'warning' ? TriangleAlert : CircleAlert
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
        tone === 'warning'
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-border bg-elevated/40 text-muted-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function KV({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular shrink-0 font-mono text-xs text-foreground">{value}</span>
    </div>
  )
}

// ---- CPU time breakdown (user/system/iowait/steal/idle) --------------------
const CPU_SEG = [
  { key: 'user', label: 'User', cls: 'bg-primary' },
  { key: 'system', label: 'System', cls: 'bg-warning' },
  { key: 'iowait', label: 'IO wait', cls: 'bg-critical' },
  { key: 'steal', label: 'Steal', cls: 'bg-critical/60' },
  { key: 'irq', label: 'IRQ', cls: 'bg-muted-foreground/60' },
  { key: 'softirq', label: 'Soft IRQ', cls: 'bg-muted-foreground/40' },
  { key: 'nice', label: 'Nice', cls: 'bg-primary/50' },
]

function CpuBreakdown({ times }) {
  const segs = CPU_SEG.filter((s) => (times?.[s.key] || 0) > 0.05)
  if (segs.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-elevated">
        {segs.map((s) => (
          <div key={s.key} className={s.cls} style={{ width: `${times[s.key]}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', s.cls)} />
            {s.label}
            <span className="tabular font-mono text-foreground">{formatPercent(times[s.key], 0)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ---- GPU card --------------------------------------------------------------
function clocks(cur, max) {
  if (cur == null) return '—'
  return max ? `${Math.round(cur)} / ${Math.round(max)} MHz` : `${Math.round(cur)} MHz`
}

function GpuCard({ gpu, utilHistory, memHistory }) {
  const pcie =
    gpu.pcie_gen != null
      ? `Gen${Math.round(gpu.pcie_gen)}${gpu.pcie_gen_max ? `/${Math.round(gpu.pcie_gen_max)}` : ''} ×${
          gpu.pcie_width != null ? Math.round(gpu.pcie_width) : '?'
        }`
      : '—'
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate font-mono text-sm">
              GPU {gpu.index} · {gpu.name}
            </CardTitle>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{gpu.uuid}</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {gpu.throttled && (
              <Badge variant="critical" title={(gpu.throttle_reasons || []).join(', ')}>
                <TriangleAlert className="mr-1 h-3 w-3" />
                Throttled
              </Badge>
            )}
            {gpu.temp_c != null && (
              <Badge variant={gpu.temp_c >= 85 ? 'critical' : gpu.temp_c >= 75 ? 'warning' : 'secondary'}>
                <Thermometer className="mr-1 h-3 w-3" />
                {Math.round(gpu.temp_c)}°C
              </Badge>
            )}
            {gpu.power_w != null && (
              <Badge variant="secondary">
                <Zap className="mr-1 h-3 w-3" />
                {Math.round(gpu.power_w)}
                {gpu.power_limit_w != null ? `/${Math.round(gpu.power_limit_w)}` : ''}W
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <MeterRow
              label="Compute"
              value={gpu.util_percent}
              tone={usageTone(gpu.util_percent)}
              right={gpu.util_percent != null ? formatPercent(gpu.util_percent, 0) : '—'}
            />
            <Sparkline data={utilHistory} tone={usageTone(gpu.util_percent)} domain={[0, 100]} height={28} />
          </div>
          <div>
            <MeterRow
              label="Memory"
              value={gpu.mem_percent}
              tone={usageTone(gpu.mem_percent)}
              right={`${formatMB(gpu.mem_used_mb)} / ${formatMB(gpu.mem_total_mb)}`}
            />
            <Sparkline data={memHistory} tone={usageTone(gpu.mem_percent)} domain={[0, 100]} height={28} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2">
          <KV label="SM clock" value={clocks(gpu.sm_clock_mhz, gpu.sm_clock_max_mhz)} />
          <KV label="Mem clock" value={clocks(gpu.mem_clock_mhz, gpu.mem_clock_max_mhz)} />
          <KV label="PCIe" value={pcie} />
          <KV label="Mem I/O" value={gpu.mem_io_percent != null ? formatPercent(gpu.mem_io_percent, 0) : '—'} />
          {(gpu.encoder_percent != null || gpu.decoder_percent != null) && (
            <KV
              label="Enc / Dec"
              value={`${formatPercent(gpu.encoder_percent, 0)} / ${formatPercent(gpu.decoder_percent, 0)}`}
            />
          )}
          {gpu.ecc_errors != null && (
            <KV label="ECC errors" value={formatNumber(gpu.ecc_errors)} />
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Processes
          </p>
          {(gpu.processes || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No compute processes</p>
          ) : (
            <div className="space-y-1">
              {(gpu.processes || []).map((p) => (
                <div
                  key={`${p.pid}-${p.name}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-elevated/40 px-2 py-1"
                >
                  <span className="min-w-0 truncate font-mono text-xs text-foreground" title={p.name}>
                    {p.name}
                    {p.user ? <span className="text-muted-foreground"> · {p.user}</span> : null}
                  </span>
                  <span className="tabular shrink-0 font-mono text-xs text-muted-foreground">
                    pid {p.pid} · {formatMB(p.used_mb)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ProcessTable({ title, rows, metric }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pt-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">PID</TableHead>
              <TableHead className="text-right">CPU</TableHead>
              <TableHead className="text-right">Memory</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.pid}>
                <TableCell className="max-w-[200px] truncate font-mono text-xs text-foreground" title={p.name}>
                  {p.name}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.user || '—'}</TableCell>
                <TableCell className="tabular text-right font-mono text-xs text-muted-foreground">
                  {p.pid}
                </TableCell>
                <TableCell
                  className={cn(
                    'tabular text-right font-mono text-xs',
                    metric === 'cpu' ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {formatPercent(p.cpu_percent, 0)}
                </TableCell>
                <TableCell
                  className={cn(
                    'tabular text-right font-mono text-xs',
                    metric === 'mem' ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {formatBytes(p.mem_rss)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ---- Network + Disk I/O throughput ----------------------------------------
function IoStat({ icon: Icon, label, value, data, tone = 'primary' }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="tabular ml-auto font-mono text-sm font-medium text-foreground">{value}</span>
      </div>
      <Sparkline data={data} tone={tone} height={32} />
    </div>
  )
}

export function ServerMonitor() {
  const [data, setData] = React.useState(null)
  const [history, setHistory] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [refresh, setRefresh] = React.useState('0')
  const [lastUpdated, setLastUpdated] = React.useState(null)

  const mounted = React.useRef(true)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = React.useCallback(async (opts = {}) => {
    const { silent = false } = opts
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await getServerStats()
      if (!mounted.current) return
      setData(res || null)
      setError(null)
      setLastUpdated(new Date())
      if (res) {
        const sample = {
          cpu: res.cpu?.percent ?? null,
          mem: res.memory?.percent ?? null,
          net_rx: res.network?.total?.rx_bytes_sec ?? null,
          net_tx: res.network?.total?.tx_bytes_sec ?? null,
          dio_r: res.disk_io?.read_bytes_sec ?? null,
          dio_w: res.disk_io?.write_bytes_sec ?? null,
          gpu: Object.fromEntries(
            (res.gpus?.items || []).map((g) => [g.index, { util: g.util_percent, mem: g.mem_percent }])
          ),
        }
        setHistory((h) => [...h, sample].slice(-HISTORY_MAX))
      }
    } catch (err) {
      if (!mounted.current) return
      setError(err.message || 'Failed to load server metrics.')
    } finally {
      if (!mounted.current) return
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    const secs = Number(refresh)
    if (!secs) return
    const id = setInterval(() => load({ silent: true }), secs * 1000)
    return () => clearInterval(id)
  }, [refresh, load])

  const host = data?.host || {}
  const cpu = data?.cpu || {}
  const mem = data?.memory || {}
  const swap = data?.swap || {}
  const net = data?.network || {}
  const diskIo = data?.disk_io || {}
  const temps = data?.temps || []
  const gpus = data?.gpus || { available: false, items: [] }
  const gpuItems = gpus.items || []
  const disks = data?.disks || []
  const procs = data?.processes || { top_cpu: [], top_mem: [] }
  const topCpu = procs.top_cpu || []
  const topMem = procs.top_mem || []
  const users = data?.users || []
  const sources = data?.sources || {}

  // Derived sparkline series from the rolling history.
  const series = React.useMemo(
    () => ({
      cpu: history.map((s) => s.cpu),
      mem: history.map((s) => s.mem),
      net_rx: history.map((s) => s.net_rx),
      net_tx: history.map((s) => s.net_tx),
      dio_r: history.map((s) => s.dio_r),
      dio_w: history.map((s) => s.dio_w),
    }),
    [history]
  )
  const gpuSeries = React.useCallback(
    (index, key) => history.map((s) => s.gpu?.[index]?.[key] ?? null),
    [history]
  )

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-critical/40">
          <CardContent className="py-4">
            <p className="text-sm text-critical">{error}</p>
          </CardContent>
        </Card>
      )}

      {!error && data?.error && <Unavailable message={data.error} tone="warning" />}

      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Live host metrics read from the machine running the gateway
          {host.hostname ? (
            <>
              {' '}·{' '}
              <code className="font-mono">{host.hostname}</code>
            </>
          ) : null}
          {lastUpdated ? <> · updated {formatTime(lastUpdated.toISOString())}</> : null}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={refresh} onValueChange={setRefresh}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Auto-refresh" />
            </SelectTrigger>
            <SelectContent>
              {REFRESH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.value === '0' ? 'Auto-refresh off' : `Every ${o.label}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => load({ silent: true })}
            disabled={loading || refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        </div>
      ) : !data ? (
        <Card>
          <EmptyState
            icon={Server}
            title="No metrics available"
            description="The dashboard could not read host metrics. Check the Server Monitor mounts in docker-compose."
          />
        </Card>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Uptime"
              value={formatDuration(host.uptime_seconds)}
              hint={host.os || undefined}
              icon={Clock}
            />
            <StatTile
              label="Load average"
              value={host.load_avg ? host.load_avg.map((x) => x.toFixed(2)).join('  ') : '—'}
              hint={host.cpu_count_logical ? `${host.cpu_count_logical} logical cores` : undefined}
              icon={Gauge}
            />
            <StatTile
              label="CPU"
              value={cpu.percent != null ? formatPercent(cpu.percent, 0) : '—'}
              hint={cpu.freq_mhz ? `${(cpu.freq_mhz / 1000).toFixed(2)} GHz` : undefined}
              icon={Cpu}
              tone={cpu.percent >= 90 ? 'critical' : cpu.percent >= 70 ? 'warning' : undefined}
              chart={<Sparkline data={series.cpu} tone={usageTone(cpu.percent)} domain={[0, 100]} />}
            />
            <StatTile
              label="Memory"
              value={mem.percent != null ? formatPercent(mem.percent, 0) : '—'}
              hint={mem.total ? `${formatBytes(mem.used)} / ${formatBytes(mem.total)}` : undefined}
              icon={MemoryStick}
              tone={mem.percent >= 90 ? 'critical' : mem.percent >= 70 ? 'warning' : undefined}
              chart={<Sparkline data={series.mem} tone={usageTone(mem.percent)} domain={[0, 100]} />}
            />
          </div>

          {/* GPUs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">GPUs</h2>
              {gpus.available && <Badge variant="secondary">{gpuItems.length}</Badge>}
            </div>
            {!gpus.available ? (
              <Unavailable
                message={`GPU metrics unavailable${gpus.error ? ` — ${gpus.error}` : ''}. The host needs an NVIDIA GPU and the container needs GPU access.`}
              />
            ) : gpuItems.length === 0 ? (
              <Unavailable message="nvidia-smi reported no GPUs." />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {gpuItems.map((g) => (
                  <GpuCard
                    key={g.uuid || g.index}
                    gpu={g}
                    utilHistory={gpuSeries(g.index, 'util')}
                    memHistory={gpuSeries(g.index, 'mem')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* CPU cores + memory/swap */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  CPU
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {Object.keys(cpu.times || {}).length > 0 && <CpuBreakdown times={cpu.times} />}
                {(cpu.per_core || []).length === 0 ? (
                  <Unavailable message="Per-core CPU data unavailable." />
                ) : (
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {cpu.per_core.map((c, i) => (
                      <MeterRow key={i} label={`core ${i}`} value={c} right={formatPercent(c, 0)} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  Memory &amp; swap
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <MeterRow
                  label="RAM"
                  value={mem.percent}
                  right={`${formatBytes(mem.used)} / ${formatBytes(mem.total)}`}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {mem.available != null && <span>{formatBytes(mem.available)} available</span>}
                  {mem.cached != null && <span>· {formatBytes(mem.cached)} cached</span>}
                  {mem.buffers != null && <span>· {formatBytes(mem.buffers)} buffers</span>}
                </div>
                <MeterRow
                  label="Swap"
                  value={swap.total ? swap.percent : 0}
                  right={swap.total ? `${formatBytes(swap.used)} / ${formatBytes(swap.total)}` : 'none'}
                />
              </CardContent>
            </Card>
          </div>

          {/* Network + Disk I/O + Temperatures */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  Network I/O
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {!net?.total ? (
                  <Unavailable message="Network counters unavailable." />
                ) : (
                  <>
                    <IoStat
                      icon={ArrowDownToLine}
                      label="Download"
                      value={formatRate(net.total.rx_bytes_sec)}
                      data={series.net_rx}
                    />
                    <IoStat
                      icon={ArrowUpFromLine}
                      label="Upload"
                      value={formatRate(net.total.tx_bytes_sec)}
                      data={series.net_tx}
                    />
                    {(net.interfaces || []).length > 0 && (
                      <div className="space-y-1 border-t border-border pt-2">
                        {net.interfaces.slice(0, 4).map((i) => (
                          <div key={i.name} className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{i.name}</span>
                            <span className="tabular shrink-0 font-mono text-[11px] text-muted-foreground">
                              ↓ {formatRate(i.rx_bytes_sec)} · ↑ {formatRate(i.tx_bytes_sec)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  Disk I/O
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {Object.keys(diskIo || {}).length === 0 ? (
                  <Unavailable message="Disk I/O counters unavailable." />
                ) : (
                  <>
                    <IoStat
                      icon={ArrowDownToLine}
                      label="Read"
                      value={formatRate(diskIo.read_bytes_sec)}
                      data={series.dio_r}
                    />
                    <IoStat
                      icon={ArrowUpFromLine}
                      label="Write"
                      value={formatRate(diskIo.write_bytes_sec)}
                      data={series.dio_w}
                      tone="warning"
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                      <span className="text-xs text-muted-foreground">IOPS</span>
                      <span className="tabular shrink-0 font-mono text-[11px] text-muted-foreground">
                        R {formatIops(diskIo.read_iops)} · W {formatIops(diskIo.write_iops)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                  Temperatures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                {temps.length === 0 ? (
                  <Unavailable message="No temperature sensors (Linux lm-sensors only)." />
                ) : (
                  temps.slice(0, 8).map((t, i) => {
                    const crit = t.critical || 100
                    const pct = t.current != null ? Math.min(100, (t.current / crit) * 100) : null
                    const tone =
                      t.current != null && t.critical && t.current >= t.critical * 0.9
                        ? 'critical'
                        : t.current != null && t.current >= crit * 0.75
                          ? 'warning'
                          : 'primary'
                    return (
                      <MeterRow
                        key={`${t.chip}-${t.label}-${i}`}
                        label={t.label}
                        value={pct}
                        tone={tone}
                        right={t.current != null ? `${Math.round(t.current)}°C` : '—'}
                      />
                    )
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Disks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                Disks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              {disks.length === 0 ? (
                <div className="px-4 pb-4">
                  <Unavailable message="No filesystems reported." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mount</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Free</TableHead>
                      <TableHead className="w-[180px]">Usage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disks.map((d) => (
                      <TableRow key={d.mountpoint}>
                        <TableCell className="font-mono text-xs text-foreground">{d.mountpoint}</TableCell>
                        <TableCell className="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
                          {d.device}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.fstype}</TableCell>
                        <TableCell className="tabular text-right font-mono text-xs text-muted-foreground">
                          {formatBytes(d.total)}
                        </TableCell>
                        <TableCell className="tabular text-right font-mono text-xs text-foreground">
                          {formatBytes(d.used)}
                        </TableCell>
                        <TableCell className="tabular text-right font-mono text-xs text-muted-foreground">
                          {formatBytes(d.free)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Meter value={d.percent} className="flex-1" />
                            <span className="tabular w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
                              {formatPercent(d.percent, 0)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Top processes */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProcessTable title="Top processes by CPU" rows={topCpu} metric="cpu" />
            <ProcessTable title="Top processes by memory" rows={topMem} metric="mem" />
          </div>

          {/* Logged-in users */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Logged-in users
                <Badge variant="secondary">{formatNumber(users.length)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              {users.length === 0 ? (
                <div className="px-4 pb-4">
                  <Unavailable message="No interactive user sessions." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Terminal</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u, i) => (
                      <TableRow key={`${u.name}-${u.terminal}-${i}`}>
                        <TableCell className="font-mono text-xs text-foreground">{u.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{u.terminal}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {u.host || 'local'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.started || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {!sources.host_mounted && (
            <Unavailable
              message="Reading container metrics — the host /proc is not mounted, so CPU/memory/processes reflect the container, not the host. Rebuild with the Server Monitor mounts to see the host."
              tone="warning"
            />
          )}
        </>
      )}
    </div>
  )
}
