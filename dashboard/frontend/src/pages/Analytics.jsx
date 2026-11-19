import * as React from 'react'
import {
  ArrowRightLeft,
  Coins,
  MessageSquare,
  Sparkles,
  Timer,
  Gauge,
  Download,
  BarChart3,
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
import { Badge } from '@/components/ui/badge'
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
  usageByTeam,
  tokenSplit,
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

const MODEL_CSV_COLUMNS = [
  { label: 'model', get: (u) => u.model },
  { label: 'requests', get: (u) => u.requests },
  { label: 'tokens', get: (u) => u.tokens },
  { label: 'share', get: (u) => u.share },
]

const TEAM_CSV_COLUMNS = [
  { label: 'team', get: (u) => u.team },
  { label: 'requests', get: (u) => u.requests },
  { label: 'tokens', get: (u) => u.tokens },
  { label: 'errors', get: (u) => u.errors },
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

export function Analytics() {
  const { logs, teams, loading, error, range } = useAppStore()
  const days = Number(range)

  const stats = React.useMemo(() => computeStats(logs, teams), [logs, teams])
  const daySeries = React.useMemo(() => perDaySeries(logs, days), [logs, days])
  const byModel = React.useMemo(() => requestsByModel(logs, 10), [logs])
  const byTeam = React.useMemo(() => requestsByTeam(logs, teams, 10), [logs, teams])
  const sve = React.useMemo(() => successVsError(logs), [logs])
  const modelUsage = React.useMemo(() => usageByModel(logs), [logs])
  const teamUsage = React.useMemo(() => usageByTeam(logs, teams), [logs, teams])
  const split = React.useMemo(() => tokenSplit(logs), [logs])

  const avgTokens = stats.requests ? Math.round(stats.tokens / stats.requests) : null

  const tiles = [
    { label: 'Requests', value: compactNumber(stats.requests), icon: ArrowRightLeft },
    { label: 'Total tokens', value: compactNumber(stats.tokens), icon: Coins },
    {
      label: 'Prompt tokens',
      value: compactNumber(split.prompt),
      icon: MessageSquare,
      hint: split.total ? formatPercent((split.prompt / split.total) * 100) + ' of total' : undefined,
    },
    {
      label: 'Completion tokens',
      value: compactNumber(split.completion),
      icon: Sparkles,
      hint: split.total
        ? formatPercent((split.completion / split.total) * 100) + ' of total'
        : undefined,
    },
    {
      label: 'Avg tokens / req',
      value: avgTokens == null ? '—' : formatNumber(avgTokens),
      icon: Gauge,
    },
    { label: 'p95 latency', value: formatMs(stats.p95Latency), icon: Timer },
  ]

  const noData = !loading && logs.length === 0

  const onExportModelCSV = () => {
    downloadCSV('gateway-usage-by-model.csv', toCSV(modelUsage, MODEL_CSV_COLUMNS))
  }
  const onExportTeamCSV = () => {
    downloadCSV('gateway-usage-by-team.csv', toCSV(teamUsage, TEAM_CSV_COLUMNS))
  }
  const onExportJSON = () => {
    downloadJSON('gateway-analytics.json', {
      range: `${days}d`,
      stats,
      tokenSplit: split,
      perDay: daySeries,
      byModel: modelUsage,
      byTeam: teamUsage,
    })
  }

  return (
    <div className="space-y-5">
      {error && <InlineError message={error} />}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Traffic, tokens, and latency for the selected window — computed from request logs. No cost or spend is tracked.
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9" disabled={noData}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportModelCSV}>CSV — usage by model</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportTeamCSV}>CSV — usage by team</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJSON}>JSON — full analytics</DropdownMenuItem>
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
            loading={loading}
          />
        ))}
      </div>

      {noData ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="No traffic in this window"
            description="Once requests flow through the gateway, analytics will appear here. Try a wider time range."
          />
        </Card>
      ) : (
        <>
          {/* Charts grid — full width allows three across on large screens */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <RequestsPerDayChart data={daySeries} loading={loading} />
            <TokensPerDayChart data={daySeries} loading={loading} />
            <LatencyChart data={daySeries} loading={loading} />
            <RequestsByModelChart data={byModel} loading={loading} />
            <RequestsByTeamChart data={byTeam} loading={loading} />
            <SuccessDonutChart data={sve} loading={loading} />
          </div>

          {/* Breakdown tables side by side */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Usage by model</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-2">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : modelUsage.length === 0 ? (
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
                      {modelUsage.map((u) => (
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Usage by team</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-2">
                {loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : teamUsage.length === 0 ? (
                  <EmptyState title="No team usage yet" className="py-8" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Errors</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamUsage.map((u) => (
                        <TableRow key={u.team}>
                          <TableCell className="max-w-[160px] truncate font-mono text-xs text-foreground">
                            {u.team}
                          </TableCell>
                          <TableCell className="tabular text-right font-mono">
                            {formatNumber(u.requests)}
                          </TableCell>
                          <TableCell className="tabular text-right font-mono">
                            {formatNumber(u.tokens)}
                          </TableCell>
                          <TableCell className="tabular text-right font-mono">
                            {u.errors > 0 ? (
                              <Badge variant="critical">{formatNumber(u.errors)}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
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
          </div>
        </>
      )}
    </div>
  )
}
