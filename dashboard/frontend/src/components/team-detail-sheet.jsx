import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'
import { computeStats, usageByModel, successVsError, isSuccess } from '@/lib/analytics'
import { formatMs, formatNumber, formatPercent, formatTime } from '@/lib/format'

function Stat({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-elevated/50 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="tabular font-mono text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function TeamDetailSheet({ team, logs, open, onOpenChange }) {
  const teamLogs = React.useMemo(() => {
    if (!team) return []
    return (logs || []).filter((r) => String(r.team_id) === String(team.team_id))
  }, [logs, team])

  const stats = React.useMemo(() => computeStats(teamLogs, []), [teamLogs])
  const usage = React.useMemo(() => usageByModel(teamLogs), [teamLogs])
  const sve = React.useMemo(() => successVsError(teamLogs), [teamLogs])

  const recent = React.useMemo(
    () =>
      teamLogs
        .slice()
        .sort((a, b) => (new Date(b.time).getTime() || 0) - (new Date(a.time).getTime() || 0))
        .slice(0, 10),
    [teamLogs]
  )

  const successRate = sve.total ? (sve.success / sve.total) * 100 : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="scrollbar-thin overflow-y-auto">
        {team && (
          <>
            <SheetHeader>
              <SheetTitle>{team.team_alias || team.team_id}</SheetTitle>
              <SheetDescription className="font-mono text-xs">{team.team_id}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Model access
                </p>
                <div className="flex flex-wrap gap-1">
                  {!team.models || team.models.length === 0 ? (
                    <Badge variant="secondary">all</Badge>
                  ) : (
                    team.models.map((m) => (
                      <Badge key={m} variant="outline" className="font-mono text-[11px]">
                        {m}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="Requests" value={formatNumber(stats.requests)} />
                <Stat label="Tokens" value={formatNumber(stats.tokens)} />
                <Stat
                  label="Success rate"
                  value={successRate == null ? '—' : formatPercent(successRate)}
                />
                <Stat label="p95 latency" value={formatMs(stats.p95Latency)} />
                <Stat label="RPM limit" value={team.rpm_limit == null ? '—' : formatNumber(team.rpm_limit)} />
                <Stat label="TPM limit" value={team.tpm_limit == null ? '—' : formatNumber(team.tpm_limit)} />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Usage by model
                </p>
                {usage.length === 0 ? (
                  <EmptyState title="No usage in this window" className="py-6" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.map((u) => (
                        <TableRow key={u.model}>
                          <TableCell className="font-mono text-xs text-foreground">
                            {u.model}
                          </TableCell>
                          <TableCell className="tabular text-right font-mono text-xs">
                            {formatNumber(u.requests)}
                          </TableCell>
                          <TableCell className="tabular text-right font-mono text-xs">
                            {formatNumber(u.tokens)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Recent requests
                </p>
                {recent.length === 0 ? (
                  <EmptyState title="No recent requests" className="py-6" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Latency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.map((r) => (
                        <TableRow key={r.request_id}>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {formatTime(r.time)}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate font-mono text-xs text-foreground">
                            {r.model || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isSuccess(r) ? 'success' : 'critical'}>
                              {isSuccess(r) ? 'success' : 'error'}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular text-right font-mono text-xs">
                            {formatMs(r.latency_ms)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
