// Client-side analytics computed from the logs array + teams list.
// All functions are pure and defensive against null/missing fields.

function isSuccess(row) {
  return typeof row.status === 'string' && row.status.toLowerCase() === 'success'
}

function dayKey(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // Local-day bucket as YYYY-MM-DD
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null
  if (sortedAsc.length === 1) return sortedAsc[0]
  const rank = (p / 100) * (sortedAsc.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sortedAsc[lo]
  const frac = rank - lo
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac
}

// Build a map team_id -> alias from the teams list.
export function teamAliasMap(teams) {
  const map = new Map()
  for (const t of teams || []) {
    if (t && t.team_id != null) {
      map.set(String(t.team_id), t.team_alias || String(t.team_id))
    }
  }
  return map
}

export function computeStats(logs, teams) {
  const rows = logs || []
  const total = rows.length
  let success = 0
  let tokens = 0
  const models = new Set()
  const latencies = []

  for (const r of rows) {
    if (isSuccess(r)) success++
    if (typeof r.total_tokens === 'number') tokens += r.total_tokens
    if (r.model) models.add(r.model)
    if (typeof r.latency_ms === 'number' && r.latency_ms >= 0) {
      latencies.push(r.latency_ms)
    }
  }

  latencies.sort((a, b) => a - b)
  const p95 = percentile(latencies, 95)

  return {
    teams: (teams || []).length,
    models: models.size,
    requests: total,
    tokens,
    successRate: total ? (success / total) * 100 : null,
    p95Latency: p95,
  }
}

// Returns an ordered list of day buckets spanning [rangeStart, now].
function buildDaySpine(days) {
  const out = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    out.push(dayKey(d.toISOString()))
  }
  return out
}

export function perDaySeries(logs, days) {
  const spine = buildDaySpine(days)
  const reqByDay = new Map(spine.map((k) => [k, 0]))
  const tokByDay = new Map(spine.map((k) => [k, 0]))
  const latByDay = new Map(spine.map((k) => [k, []]))

  for (const r of logs || []) {
    const k = dayKey(r.time)
    if (k == null || !reqByDay.has(k)) continue
    reqByDay.set(k, reqByDay.get(k) + 1)
    if (typeof r.total_tokens === 'number') {
      tokByDay.set(k, tokByDay.get(k) + r.total_tokens)
    }
    if (typeof r.latency_ms === 'number' && r.latency_ms >= 0) {
      latByDay.get(k).push(r.latency_ms)
    }
  }

  return spine.map((k) => {
    const lats = latByDay.get(k).slice().sort((a, b) => a - b)
    return {
      day: k,
      requests: reqByDay.get(k),
      tokens: tokByDay.get(k),
      p50: lats.length ? Math.round(percentile(lats, 50)) : 0,
      p95: lats.length ? Math.round(percentile(lats, 95)) : 0,
    }
  })
}

export function requestsByModel(logs, topN = 8) {
  const counts = new Map()
  for (const r of logs || []) {
    const m = r.model || '—'
    counts.set(m, (counts.get(m) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN)
}

export function requestsByTeam(logs, teams, topN = 8) {
  const aliases = teamAliasMap(teams)
  const counts = new Map()
  for (const r of logs || []) {
    const id = r.team_id != null ? String(r.team_id) : null
    const label = id ? aliases.get(id) || id : '—'
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN)
}

export function successVsError(logs) {
  let success = 0
  let error = 0
  for (const r of logs || []) {
    if (isSuccess(r)) success++
    else error++
  }
  return { success, error, total: success + error }
}

export function usageByModel(logs) {
  const map = new Map()
  let totalReq = 0
  for (const r of logs || []) {
    const m = r.model || '—'
    const entry = map.get(m) || { model: m, requests: 0, tokens: 0 }
    entry.requests += 1
    if (typeof r.total_tokens === 'number') entry.tokens += r.total_tokens
    map.set(m, entry)
    totalReq += 1
  }
  return [...map.values()]
    .map((e) => ({ ...e, share: totalReq ? (e.requests / totalReq) * 100 : 0 }))
    .sort((a, b) => b.requests - a.requests)
}

export { isSuccess }
