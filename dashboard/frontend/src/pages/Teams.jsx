import * as React from 'react'
import { Download, Users } from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { TeamDetailSheet } from '@/components/team-detail-sheet'
import { formatNumber, toCSV, downloadCSV } from '@/lib/format'

const CSV_COLUMNS = [
  { label: 'alias', get: (t) => t.team_alias },
  { label: 'team_id', get: (t) => t.team_id },
  { label: 'models', get: (t) => (t.models || []).join('|') },
  { label: 'rpm_limit', get: (t) => t.rpm_limit },
  { label: 'tpm_limit', get: (t) => t.tpm_limit },
]

export function Teams() {
  const { teams, logs, loading, error } = useAppStore()

  const [selected, setSelected] = React.useState(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const openTeam = (t) => {
    setSelected(t)
    setSheetOpen(true)
  }

  const onExport = () => {
    downloadCSV('gateway-teams.csv', toCSV(teams, CSV_COLUMNS))
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-critical/40">
          <CardContent className="py-4">
            <p className="text-sm text-critical">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onExport}
          disabled={teams.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No teams yet — run the provisioning script."
              description="Teams and their scoped keys are created via scripts/provision_keys."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias</TableHead>
                  <TableHead>Team ID</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead className="text-right">RPM</TableHead>
                  <TableHead className="text-right">TPM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow
                    key={t.team_id}
                    onClick={() => openTeam(t)}
                    className="cursor-pointer"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openTeam(t)
                      }
                    }}
                  >
                    <TableCell className="font-medium text-foreground">
                      {t.team_alias || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.team_id}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {!t.models || t.models.length === 0 ? (
                          <Badge variant="secondary">all</Badge>
                        ) : (
                          t.models.map((m) => (
                            <Badge key={m} variant="outline" className="font-mono text-[11px]">
                              {m}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right font-mono">
                      {t.rpm_limit == null ? '—' : formatNumber(t.rpm_limit)}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono">
                      {t.tpm_limit == null ? '—' : formatNumber(t.tpm_limit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TeamDetailSheet
        team={selected}
        logs={logs}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
