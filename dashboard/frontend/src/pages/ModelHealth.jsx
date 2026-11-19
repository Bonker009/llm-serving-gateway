import * as React from 'react'
import {
  RefreshCw,
  HeartPulse,
  CircleCheck,
  CircleX,
  CircleDashed,
  Download,
} from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { getModelHealth } from '@/lib/api'
import { StatTile } from '@/components/stat-tile'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/empty-state'
import { formatMs, formatNumber, formatTime, toCSV, downloadCSV } from '@/lib/format'
import { cn } from '@/lib/utils'

const INTERVALS = [
  { value: '0', label: 'Off' },
  { value: '30', label: 'Every 30s' },
  { value: '60', label: 'Every 60s' },
]

const CSV_COLUMNS = [
  { label: 'model', get: (r) => r.model },
  { label: 'api_base', get: (r) => r.api_base },
  { label: 'state', get: (r) => r.state },
  { label: 'latency_ms', get: (r) => r.latency_ms },
  { label: 'error', get: (r) => r.error },
]

function StateIcon({ state }) {
  if (state === 'healthy') return <CircleCheck className="h-4 w-4 text-success" />
  if (state === 'unhealthy') return <CircleX className="h-4 w-4 text-critical" />
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />
}

export function ModelHealth() {
  const { models } = useAppStore()

  const [health, setHealth] = React.useState(null)
  const [checking, setChecking] = React.useState(false)
  const [healthError, setHealthError] = React.useState(null)
  const [checkedAt, setCheckedAt] = React.useState(null)
  const [interval, setIntervalValue] = React.useState('0')

  const mounted = React.useRef(true)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const runCheck = React.useCallback(async () => {
    setChecking(true)
    setHealthError(null)
    try {
      const res = await getModelHealth()
      if (!mounted.current) return
      setHealth(res || null)
      setCheckedAt(new Date())
    } catch (err) {
      if (!mounted.current) return
      setHealthError(err.message || 'Failed to run the health check.')
    } finally {
      if (mounted.current) setChecking(false)
    }
  }, [])

  // Run once on mount so the page is useful immediately.
  React.useEffect(() => {
    runCheck()
  }, [runCheck])

  // Optional auto-poll.
  React.useEffect(() => {
    const secs = Number(interval)
    if (!secs) return
    const id = setInterval(runCheck, secs * 1000)
    return () => clearInterval(id)
  }, [interval, runCheck])

  // Flatten healthy + unhealthy into one rows list.
  const rows = React.useMemo(() => {
    if (!health) return []
    const out = []
    for (const e of health.healthy || []) out.push({ ...e, state: 'healthy' })
    for (const e of health.unhealthy || []) out.push({ ...e, state: 'unhealthy' })
    return out.sort((a, b) => {
      // Unhealthy first, then by model name.
      if (a.state !== b.state) return a.state === 'unhealthy' ? -1 : 1
      return String(a.model || '').localeCompare(String(b.model || ''))
    })
  }, [health])

  const summary = React.useMemo(() => {
    const healthy = health?.healthy?.length || 0
    const unhealthy = health?.unhealthy?.length || 0
    const lats = (health?.healthy || [])
      .map((e) => e.latency_ms)
      .filter((v) => typeof v === 'number' && v >= 0)
    const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : null
    return { healthy, unhealthy, total: healthy + unhealthy, avg }
  }, [health])

  const onExport = () => {
    downloadCSV('gateway-model-health.csv', toCSV(rows, CSV_COLUMNS))
  }

  const hasChecked = health != null
  const configuredCount = (models || []).length

  return (
    <div className="space-y-4">
      {healthError && (
        <Card className="border-critical/40">
          <CardContent className="py-4">
            <p className="text-sm text-critical">{healthError}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Healthy"
          value={formatNumber(summary.healthy)}
          icon={CircleCheck}
          tone="success"
          loading={checking && !hasChecked}
        />
        <StatTile
          label="Unhealthy"
          value={formatNumber(summary.unhealthy)}
          icon={CircleX}
          tone={summary.unhealthy > 0 ? 'critical' : undefined}
          loading={checking && !hasChecked}
        />
        <StatTile
          label="Backends checked"
          value={formatNumber(summary.total)}
          icon={HeartPulse}
          hint={configuredCount ? `${configuredCount} configured` : undefined}
          loading={checking && !hasChecked}
        />
        <StatTile
          label="Avg latency"
          value={formatMs(summary.avg)}
          icon={RefreshCw}
          hint="healthy endpoints"
          loading={checking && !hasChecked}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground">
          {checkedAt ? (
            <>Last checked {formatTime(checkedAt.toISOString())}. </>
          ) : (
            <>Actively pings every backend via the gateway — this can take a few seconds. </>
          )}
          Health is a live probe, not from request logs.
        </p>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Select value={interval} onValueChange={setIntervalValue}>
            <SelectTrigger className="w-[130px]" aria-label="Auto-poll interval">
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
            onClick={onExport}
            disabled={rows.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" className="h-9" onClick={runCheck} disabled={checking}>
            <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} />
            {checking ? 'Checking…' : 'Run health check'}
          </Button>
        </div>
      </div>

      {/* Endpoint table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Backend endpoints</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-2">
          {!hasChecked && checking ? (
            <EmptyState icon={HeartPulse} title="Pinging backends…" description="Running the first health probe." />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={HeartPulse}
              title={health?.reachable === false ? 'Gateway unreachable' : 'No endpoints reported'}
              description={
                health?.reachable === false
                  ? 'The gateway did not respond to the health probe. Check that it is running.'
                  : 'The gateway returned no endpoints to probe.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Model</TableHead>
                  <TableHead>Backend</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.model || 'model'}-${r.api_base || i}`}>
                    <TableCell>
                      <StateIcon state={r.state} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      {r.model || '—'}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate font-mono text-xs text-muted-foreground">
                      {r.api_base || '—'}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono text-xs">
                      {r.state === 'healthy' ? formatMs(r.latency_ms) : '—'}
                    </TableCell>
                    <TableCell>
                      {r.state === 'unhealthy' ? (
                        r.error ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block max-w-[320px] truncate align-bottom text-xs text-critical">
                                {r.error}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm break-words">{r.error}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="critical">unreachable</Badge>
                        )
                      ) : (
                        <Badge variant="success">ok</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
