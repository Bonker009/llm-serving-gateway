import * as React from 'react'
import {
  Users,
  Boxes,
  ArrowRightLeft,
  Coins,
  CheckCircle2,
  Timer,
  Download,
} from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { StatTile } from '@/components/stat-tile'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  RequestsPerDayChart,
  TokensPerDayChart,
  RequestsByModelChart,
  RequestsByTeamChart,
  SuccessDonutChart,
  LatencyChart,
} from '@/components/charts'
import {
  computeStats,
  perDaySeries,
  requestsByModel,
  requestsByTeam,
  successVsError,
  usageByModel,
} from '@/lib/analytics'
import {
  compactNumber,
  formatMs,
  formatNumber,
  formatPercent,
  toCSV,
  downloadCSV,
  downloadJSON,
} from '@/lib/format'

const USAGE_CSV_COLUMNS = [
  { label: 'model', get: (u) => u.model },
  { label: 'requests', get: (u) => u.requests },
  { label: 'tokens', get: (u) => u.tokens },
  { label: 'share', get: (u) => u.share },
]

function InlineError({ message }) {
  return (
    <Card className="border-critical/40">
      <CardContent className="py-4">
        <p className="text-sm text-critical">{message}</p>
      </CardContent>
    </Card>
  )
}

export function Overview() {
  const { logs, teams, loading, error, range } = useAppStore()
  const days = Number(range)

  const stats = React.useMemo(() => computeStats(logs, teams), [logs, teams])
  const daySeries = React.useMemo(() => perDaySeries(logs, days), [logs, days])
  const byModel = React.useMemo(() => requestsByModel(logs, 8), [logs])
  const byTeam = React.useMemo(() => requestsByTeam(logs, teams, 8), [logs, teams])
  const sve = React.useMemo(() => successVsError(logs), [logs])
  const usage = React.useMemo(() => usageByModel(logs), [logs])

  const tiles = [
    { label: 'Teams', value: formatNumber(stats.teams), icon: Users },
    { label: 'Models', value: formatNumber(stats.models), icon: Boxes, hint: 'with traffic' },
    { label: 'Requests', value: compactNumber(stats.requests), icon: ArrowRightLeft },
    { label: 'Tokens', value: compactNumber(stats.tokens), icon: Coins },
    {
      label: 'Success rate',
      value: stats.successRate == null ? '—' : formatPercent(stats.successRate),
      icon: CheckCircle2,
      tone: stats.successRate != null && stats.successRate < 95 ? 'critical' : 'success',
    },
    { label: 'p95 latency', value: formatMs(stats.p95Latency), icon: Timer },
  ]

  const noData = !loading && logs.length === 0

  const onExportCSV = () => {
    downloadCSV('gateway-usage-by-model.csv', toCSV(usage, USAGE_CSV_COLUMNS))
  }
  const onExportJSON = () => {
    downloadJSON('gateway-analytics.json', {
      stats,
      perDay: daySeries,
      byModel: usage,
      byTeam,
    })
  }

  return (
    <div className="space-y-5">
      {error && <InlineError message={error} />}

      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9" disabled={noData}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportCSV}>Export CSV (usage by model)</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJSON}>Export JSON (full analytics)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <StatTile
            key={t.label}
            label={t.label}
            value={t.value}
            hint={t.hint}
            icon={t.icon}
            tone={t.tone}
            loading={loading}
          />
        ))}
      </div>

      {noData ? (
        <Card>
          <EmptyState
            title="No traffic in this window"
            description="Once requests flow through the gateway, analytics will appear here. Try a wider time range."
          />
        </Card>
      ) : (
        <>
          {/* Charts grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RequestsPerDayChart data={daySeries} loading={loading} />
            <TokensPerDayChart data={daySeries} loading={loading} />
            <RequestsByModelChart data={byModel} loading={loading} />
            <RequestsByTeamChart data={byTeam} loading={loading} />
            <SuccessDonutChart data={sve} loading={loading} />
            <LatencyChart data={daySeries} loading={loading} />
          </div>

          {/* Usage by model table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Usage by model</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : usage.length === 0 ? (
                <EmptyState title="No model usage yet" className="py-8" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map((u) => (
                      <TableRow key={u.model}>
                        <TableCell className="font-mono text-xs text-foreground">
                          {u.model}
                        </TableCell>
                        <TableCell className="tabular text-right font-mono">
                          {formatNumber(u.requests)}
                        </TableCell>
                        <TableCell className="tabular text-right font-mono">
                          {formatNumber(u.tokens)}
                        </TableCell>
                        <TableCell className="tabular text-right font-mono text-muted-foreground">
                          {formatPercent(u.share)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
