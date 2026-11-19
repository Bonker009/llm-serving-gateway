import * as React from 'react'
import {
  RefreshCw,
  Radio,
  OctagonAlert,
  ArrowRightLeft,
  CheckCircle2,
  Timer,
  Coins,
} from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { StatTile } from '@/components/stat-tile'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { LogDetailSheet } from '@/components/log-detail-sheet'
import { isSuccess } from '@/lib/analytics'
import {
  compactNumber,
  formatMs,
  formatNumber,
  formatPercent,
  formatTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'

const INTERVALS = [
  { value: '0', label: 'Paused' },
  { value: '5', label: 'Every 5s' },
  { value: '10', label: 'Every 10s' },
  { value: '30', label: 'Every 30s' },
]

const FEED_LIMIT = 60

// Short relative time ("12s", "4m", "2h", "3d") from an ISO timestamp.
function relativeTime(iso, now) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const secs = Math.max(0, Math.round((now - t) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function Activity() {
  const { logs, loading, error, refetch, refreshing, lastUpdated } = useAppStore()

  const [interval, setIntervalValue] = React.useState('10')
  const [errorsOnly, setErrorsOnly] = React.useState(false)
  const [now, setNow] = React.useState(() => Date.now())

  const [selected, setSelected] = React.useState(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Auto-refresh the logs on the chosen cadence.
  React.useEffect(() => {
    const secs = Number(interval)
    if (!secs) return
    const id = setInterval(() => refetch(), secs * 1000)
    return () => clearInterval(id)
  }, [interval, refetch])

  // Tick a clock so relative timestamps stay fresh between fetches.
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const sorted = React.useMemo(() => {
    const arr = logs.slice().sort((a, b) => {
      const at = new Date(a.time).getTime() || 0
      const bt = new Date(b.time).getTime() || 0
      return bt - at
    })
    return errorsOnly ? arr.filter((r) => !isSuccess(r)) : arr
  }, [logs, errorsOnly])

  const feed = sorted.slice(0, FEED_LIMIT)

  // Live counters across the whole loaded window.
  const counters = React.useMemo(() => {
    let success = 0
    let tokens = 0
    const lats = []
    for (const r of logs) {
      if (isSuccess(r)) success++
      if (typeof r.total_tokens === 'number') tokens += r.total_tokens
      if (typeof r.latency_ms === 'number' && r.latency_ms >= 0) lats.push(r.latency_ms)
    }
    lats.sort((a, b) => a - b)
    const p95 = lats.length ? lats[Math.min(lats.length - 1, Math.floor(lats.length * 0.95))] : null
    return {
      total: logs.length,
      successRate: logs.length ? (success / logs.length) * 100 : null,
      errors: logs.length - success,
      tokens,
      p95,
    }
  }, [logs])

  const openRow = (row) => {
    setSelected(row)
    setSheetOpen(true)
  }

  const live = Number(interval) > 0

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-critical/40">
          <CardContent className="py-4">
            <p className="text-sm text-critical">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Live counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Requests" value={compactNumber(counters.total)} icon={ArrowRightLeft} loading={loading} />
        <StatTile
          label="Success rate"
          value={counters.successRate == null ? '—' : formatPercent(counters.successRate)}
          icon={CheckCircle2}
          tone={counters.successRate != null && counters.successRate < 95 ? 'critical' : 'success'}
          loading={loading}
        />
        <StatTile label="p95 latency" value={formatMs(counters.p95)} icon={Timer} loading={loading} />
        <StatTile label="Tokens" value={compactNumber(counters.tokens)} icon={Coins} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            {live && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            )}
            <span
              className={cn(
                'relative inline-flex h-2.5 w-2.5 rounded-full',
                live ? 'bg-success' : 'bg-muted-foreground'
              )}
            />
          </span>
          <span className="font-medium text-foreground">
            {live ? 'Live' : 'Paused'}
          </span>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              · updated {formatTime(lastUpdated.toISOString())}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            type="button"
            variant={errorsOnly ? 'destructive' : 'outline'}
            size="sm"
            className="h-9"
            onClick={() => setErrorsOnly((v) => !v)}
            aria-pressed={errorsOnly}
          >
            <OctagonAlert className="h-4 w-4" />
            Errors only
            {counters.errors > 0 && (
              <Badge variant={errorsOnly ? 'secondary' : 'critical'} className="ml-1 px-1.5">
                {counters.errors}
              </Badge>
            )}
          </Button>

          <Select value={interval} onValueChange={setIntervalValue}>
            <SelectTrigger className="w-[130px]" aria-label="Refresh interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => refetch()}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Feed */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : feed.length === 0 ? (
            <EmptyState
              icon={Radio}
              title={errorsOnly ? 'No errors in this window' : 'No requests yet'}
              description={
                errorsOnly
                  ? 'Nothing has failed in the selected range.'
                  : 'New requests will stream in here as teams call the gateway.'
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {feed.map((r) => {
                const ok = isSuccess(r)
                return (
                  <li key={r.request_id}>
                    <button
                      type="button"
                      onClick={() => openRow(r)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          ok ? 'bg-success' : 'bg-critical'
                        )}
                        aria-hidden="true"
                      />
                      <Badge variant={ok ? 'success' : 'critical'} className="shrink-0">
                        {ok ? 'success' : 'error'}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                        {r.model || '—'}
                      </span>
                      <span className="hidden max-w-[140px] truncate font-mono text-xs text-muted-foreground sm:inline">
                        {r.team_id || '—'}
                      </span>
                      <span className="hidden w-16 shrink-0 text-right font-mono text-xs tabular sm:inline">
                        {formatMs(r.latency_ms)}
                      </span>
                      <span className="hidden w-16 shrink-0 text-right font-mono text-xs tabular text-muted-foreground md:inline">
                        {r.total_tokens == null ? '—' : formatNumber(r.total_tokens)}
                      </span>
                      <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {relativeTime(r.time, now)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {!loading && sorted.length > feed.length && (
        <p className="text-center text-xs text-muted-foreground">
          Showing the {FEED_LIMIT} most recent of {formatNumber(sorted.length)} requests — open{' '}
          <span className="font-medium text-foreground">Request logs</span> for the full, searchable history.
        </p>
      )}

      <LogDetailSheet row={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
