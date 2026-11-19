import * as React from 'react'
import {
  Server,
  RefreshCw,
  Download,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  CircleCheck,
  CircleX,
  CircleDashed,
} from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { getModelHealth, deleteModel } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import { ModelDetailSheet } from '@/components/model-detail-sheet'
import { ModelFormSheet } from '@/components/model-form-sheet'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Banner } from '@/components/banner'
import { teamAliasMap } from '@/lib/analytics'
import { formatMs, toCSV, downloadCSV, downloadJSON } from '@/lib/format'
import { cn } from '@/lib/utils'

const CONFIG_LOCKED_TITLE = 'Defined in litellm_config.yaml — edit the file instead.'

const CSV_COLUMNS = [
  { label: 'model_name', get: (m) => m.model_name },
  { label: 'provider', get: (m) => m.provider },
  { label: 'model', get: (m) => m.model },
  { label: 'api_base', get: (m) => m.api_base },
  { label: 'host', get: (m) => m.host },
  { label: 'host_ip', get: (m) => m.host_ip },
  { label: 'port', get: (m) => m.port },
  { label: 'tier', get: (m) => m.tier },
  { label: 'mode', get: (m) => m.mode },
  { label: 'source', get: (m) => m.source },
]

function tierVariant(tier) {
  if (tier === 'shared') return 'success'
  if (tier === 'dedicated') return 'default'
  return 'secondary'
}

// Teams that can call a given model: explicit membership, or a team with no
// `models` restriction (meaning "all models").
function teamsForModel(modelName, teams, aliases) {
  const out = []
  for (const t of teams || []) {
    const hasRestriction = Array.isArray(t.models) && t.models.length > 0
    if (!hasRestriction || t.models.includes(modelName)) {
      out.push(aliases.get(String(t.team_id)) || String(t.team_id))
    }
  }
  return out
}

function serverKey(m) {
  if (m.host) return `${m.host}:${m.port || '—'}`
  if (m.api_base) return m.api_base
  return 'unknown'
}

function StatusDot({ state }) {
  if (state === 'healthy') {
    return <CircleCheck className="h-3.5 w-3.5 text-success" aria-label="Healthy" />
  }
  if (state === 'unhealthy') {
    return <CircleX className="h-3.5 w-3.5 text-critical" aria-label="Unhealthy" />
  }
  return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" aria-label="Unknown" />
}

export function Infrastructure() {
  const { models, teams, loading, error, refetch } = useAppStore()

  const [health, setHealth] = React.useState(null)
  const [healthLoading, setHealthLoading] = React.useState(false)
  const [healthError, setHealthError] = React.useState(null)

  const [selected, setSelected] = React.useState(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingModel, setEditingModel] = React.useState(null)

  const [deleteTarget, setDeleteTarget] = React.useState(null)
  const [deleting, setDeleting] = React.useState(false)

  const [banner, setBanner] = React.useState(null)

  const aliases = React.useMemo(() => teamAliasMap(teams), [teams])

  // Build a status lookup: match health entries by api_base, else by raw model.
  const healthByKey = React.useMemo(() => {
    const map = new Map()
    if (!health) return map
    const add = (entry, state) => {
      if (entry.api_base) map.set(`base:${entry.api_base}`, { state, ...entry })
      if (entry.model) map.set(`model:${entry.model}`, { state, ...entry })
    }
    for (const e of health.healthy || []) add(e, 'healthy')
    for (const e of health.unhealthy || []) add(e, 'unhealthy')
    return map
  }, [health])

  const statusFor = React.useCallback(
    (m) => {
      if (!health) return { state: 'unknown' }
      return (
        (m.api_base && healthByKey.get(`base:${m.api_base}`)) ||
        (m.model && healthByKey.get(`model:${m.model}`)) || { state: 'unknown' }
      )
    },
    [health, healthByKey]
  )

  const servers = React.useMemo(() => {
    const map = new Map()
    for (const m of models || []) {
      const key = serverKey(m)
      const entry =
        map.get(key) ||
        {
          key,
          host: m.host || null,
          hostIp: m.host_ip || null,
          port: m.port || null,
          apiBase: m.api_base || null,
          providers: new Set(),
          tiers: new Set(),
          models: [],
        }
      entry.providers.add(m.provider || 'unknown')
      entry.tiers.add(m.tier || 'other')
      entry.models.push(m)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [models])

  const runHealthCheck = async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const res = await getModelHealth()
      setHealth(res || null)
    } catch (err) {
      setHealthError(err.message || 'Failed to run health check.')
    } finally {
      setHealthLoading(false)
    }
  }

  const openModel = (m) => {
    setSelected({ ...m, teams: teamsForModel(m.model_name, teams, aliases) })
    setSheetOpen(true)
  }

  const onExportCSV = () => {
    downloadCSV('gateway-models.csv', toCSV(models, CSV_COLUMNS))
  }
  const onExportJSON = () => {
    downloadJSON('gateway-models.json', models)
  }

  const openCreateModel = () => {
    setEditingModel(null)
    setFormOpen(true)
  }
  const openEditModel = (m) => {
    if (m.source !== 'db') return
    setEditingModel(m)
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
      await deleteModel({ id: deleteTarget.id })
      setBanner({ type: 'success', message: `Deleted model "${deleteTarget.model_name}".` })
      setDeleteTarget(null)
      setSheetOpen(false)
      refetch()
    } catch (err) {
      setBanner({ type: 'error', message: err.message || 'Failed to delete model.' })
    } finally {
      setDeleting(false)
    }
  }

  const hasModels = (models || []).length > 0

  return (
    <div className="space-y-4">
      {(error || healthError) && (
        <Card className="border-critical/40">
          <CardContent className="py-4">
            <p className="text-sm text-critical">{error || healthError}</p>
          </CardContent>
        </Card>
      )}

      <Banner type={banner?.type} message={banner?.message} onDismiss={() => setBanner(null)} />

      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <code className="font-mono">host.docker.internal</code> is Docker's alias for the
          machine hosting the gateway; the IP in parentheses is where it actually routes.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={runHealthCheck}
          disabled={healthLoading}
        >
          <RefreshCw className={cn('h-4 w-4', healthLoading && 'animate-spin')} />
          {healthLoading ? 'Checking…' : 'Run health check'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9" disabled={!hasModels}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportCSV}>Export CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJSON}>Export JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" className="h-9" onClick={openCreateModel}>
          <Plus className="h-4 w-4" />
          Add model
        </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !hasModels ? (
        <Card>
          <EmptyState
            icon={Server}
            title="No models configured — check the gateway is running."
            description="Model backends are discovered from the gateway config."
          />
        </Card>
      ) : (
        <>
          {/* Server cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {servers.map((s) => {
              const serverTeams = new Set()
              for (const m of s.models) {
                for (const t of teamsForModel(m.model_name, teams, aliases)) {
                  serverTeams.add(t)
                }
              }
              return (
                <Card key={s.key}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="font-mono text-sm">{s.key}</CardTitle>
                        {s.hostIp && (
                          <p className="font-mono text-xs text-muted-foreground">
                            ({s.hostIp})
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[...s.providers].join(', ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {[...s.tiers].map((t) => (
                          <Badge key={t} variant={tierVariant(t)}>
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Models
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.models.map((m) => {
                          const st = statusFor(m)
                          return (
                            <button
                              key={m.model_name}
                              type="button"
                              onClick={() => openModel(m)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated/50 px-2 py-1 text-xs font-mono text-foreground transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title={st.state === 'unknown' ? 'unknown' : `${st.state} · ${formatMs(st.latency_ms)}`}
                            >
                              <StatusDot state={st.state} />
                              {m.model_name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Teams with access
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {serverTeams.size === 0 ? (
                          <span className="text-xs text-muted-foreground">No teams reference these models</span>
                        ) : (
                          [...serverTeams].map((t) => (
                            <Badge key={t} variant="outline">
                              {t}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Full models table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>All models</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Backend</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Teams</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((m) => {
                    const st = statusFor(m)
                    const teamCount = teamsForModel(m.model_name, teams, aliases).length
                    const locked = m.source !== 'db'
                    return (
                      <TableRow
                        key={m.model_name}
                        onClick={() => openModel(m)}
                        className="cursor-pointer"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openModel(m)
                          }
                        }}
                      >
                        <TableCell className="font-mono text-xs text-foreground">
                          {m.model_name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.provider || '—'}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          <div className="truncate">{serverKey(m)}</div>
                          {m.host_ip && (
                            <div className="truncate text-[11px] text-muted-foreground/70">
                              ({m.host_ip})
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tierVariant(m.tier)}>{m.tier || 'other'}</Badge>
                        </TableCell>
                        <TableCell className="tabular text-right font-mono text-xs text-muted-foreground">
                          {teamCount}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <StatusDot state={st.state} />
                            {st.state === 'unknown' ? 'unknown' : `${st.state} · ${formatMs(st.latency_ms)}`}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {locked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled
                                    aria-label={`Actions for ${m.model_name} (locked)`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{CONFIG_LOCKED_TITLE}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${m.model_name}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditModel(m)}>
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-critical focus:text-critical"
                                  onClick={() => setDeleteTarget(m)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <ModelDetailSheet
        model={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEdit={(m) => {
          setSheetOpen(false)
          openEditModel(m)
        }}
        onDelete={(m) => setDeleteTarget(m)}
      />

      <ModelFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        model={editingModel}
        onSuccess={onFormSuccess}
        onError={onFormError}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete this model?"
        description={
          deleteTarget
            ? `This permanently removes "${deleteTarget.model_name}" from the gateway. Teams/keys that reference it will fail until updated.`
            : ''
        }
        confirmLabel="Delete model"
        busy={deleting}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}
