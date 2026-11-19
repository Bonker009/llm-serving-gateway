import * as React from 'react'
import { Download, Users, Plus, MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { TeamDetailSheet } from '@/components/team-detail-sheet'
import { TeamFormSheet } from '@/components/team-form-sheet'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Banner } from '@/components/banner'
import { deleteTeam } from '@/lib/api'
import { formatNumber, toCSV, downloadCSV } from '@/lib/format'

const CSV_COLUMNS = [
  { label: 'alias', get: (t) => t.team_alias },
  { label: 'team_id', get: (t) => t.team_id },
  { label: 'models', get: (t) => (t.models || []).join('|') },
  { label: 'rpm_limit', get: (t) => t.rpm_limit },
  { label: 'tpm_limit', get: (t) => t.tpm_limit },
]

export function Teams() {
  const { teams, logs, loading, error, refetch } = useAppStore()

  const [selected, setSelected] = React.useState(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingTeam, setEditingTeam] = React.useState(null)

  const [deleteTarget, setDeleteTarget] = React.useState(null)
  const [deleting, setDeleting] = React.useState(false)

  const [banner, setBanner] = React.useState(null)

  const openTeam = (t) => {
    setSelected(t)
    setSheetOpen(true)
  }

  const onExport = () => {
    downloadCSV('gateway-teams.csv', toCSV(teams, CSV_COLUMNS))
  }

  const openCreate = () => {
    setEditingTeam(null)
    setFormOpen(true)
  }
  const openEdit = (t) => {
    setEditingTeam(t)
    setFormOpen(true)
  }

  const onFormSuccess = (message) => {
    setBanner({ type: 'success', message })
    refetch()
  }
  const onFormError = (message) => {
    setBanner({ type: 'error', message })
  }

  const onConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTeam({ team_ids: [deleteTarget.team_id] })
      setBanner({
        type: 'success',
        message: `Deleted team "${deleteTarget.team_alias || deleteTarget.team_id}".`,
      })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setBanner({ type: 'error', message: err.message || 'Failed to delete team.' })
    } finally {
      setDeleting(false)
    }
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

      <Banner
        type={banner?.type}
        message={banner?.message}
        onDismiss={() => setBanner(null)}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
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
        <Button size="sm" className="h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New team
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
              title="No teams yet — create one to get started."
              description="Teams scope which models and rate limits a group of keys can use."
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
                  <TableHead className="w-10" />
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${t.team_alias || t.team_id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openTeam(t)}>
                            <Eye className="h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-critical focus:text-critical"
                            onClick={() => setDeleteTarget(t)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <TeamFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        team={editingTeam}
        onSuccess={onFormSuccess}
        onError={onFormError}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete this team?"
        description={
          deleteTarget
            ? `This permanently deletes "${deleteTarget.team_alias || deleteTarget.team_id}". Keys scoped to this team may stop working.`
            : ''
        }
        confirmLabel="Delete team"
        busy={deleting}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}
