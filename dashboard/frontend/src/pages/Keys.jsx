import * as React from 'react'
import {
  Download,
  KeyRound,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Check,
} from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { getKeys, deleteKey } from '@/lib/api'
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
import { KeyFormSheet } from '@/components/key-form-sheet'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Banner } from '@/components/banner'
import { teamAliasMap } from '@/lib/analytics'
import { formatDateTime, formatNumber, toCSV, downloadCSV } from '@/lib/format'

function maskToken(token) {
  if (!token) return '—'
  return token.length > 12 ? `${token.slice(0, 12)}…` : token
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = React.useState(false)
  const onCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch (err) {
      /* ignore */
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onCopy}
      aria-label={label || 'Copy to clipboard'}
      className="h-6 w-6"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

export function Keys() {
  const { teams } = useAppStore()
  const aliases = React.useMemo(() => teamAliasMap(teams), [teams])

  const [keys, setKeys] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingKey, setEditingKey] = React.useState(null)

  const [deleteTarget, setDeleteTarget] = React.useState(null)
  const [deleting, setDeleting] = React.useState(false)

  const [banner, setBanner] = React.useState(null)
  const [revealKey, setRevealKey] = React.useState(null) // { key, key_alias }

  const loadKeys = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await getKeys()
      setKeys(Array.isArray(res) ? res : [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load keys.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const openCreate = () => {
    setEditingKey(null)
    setFormOpen(true)
  }
  const openEdit = (k) => {
    setEditingKey(k)
    setFormOpen(true)
  }

  const onCreated = (res) => {
    setRevealKey(res)
    setBanner(null)
    loadKeys()
  }
  const onUpdated = (message) => {
    setBanner({ type: 'success', message })
    loadKeys()
  }
  const onFormError = (message) => {
    setBanner({ type: 'error', message })
  }

  const onConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteKey({ keys: [deleteTarget.token] })
      setBanner({
        type: 'success',
        message: `Revoked key "${deleteTarget.key_alias || maskToken(deleteTarget.token)}".`,
      })
      setDeleteTarget(null)
      loadKeys()
    } catch (err) {
      setBanner({ type: 'error', message: err.message || 'Failed to revoke key.' })
    } finally {
      setDeleting(false)
    }
  }

  const CSV_COLUMNS = React.useMemo(
    () => [
      { label: 'alias', get: (k) => k.key_alias },
      { label: 'team', get: (k) => (k.team_id ? aliases.get(String(k.team_id)) || k.team_id : '') },
      { label: 'models', get: (k) => (k.models || []).join('|') },
      { label: 'rpm_limit', get: (k) => k.rpm_limit },
      { label: 'tpm_limit', get: (k) => k.tpm_limit },
      { label: 'created_at', get: (k) => k.created_at },
      { label: 'expires', get: (k) => k.expires },
    ],
    [aliases]
  )

  const onExport = () => {
    downloadCSV('gateway-keys.csv', toCSV(keys, CSV_COLUMNS))
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

      {revealKey && (
        <Card className="border-success/40 bg-success/10">
          <CardContent className="space-y-2 py-4">
            <p className="text-sm font-medium text-success">
              Key "{revealKey.key_alias}" created — copy it now, it won't be shown again.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">
                {revealKey.key}
              </code>
              <CopyButton value={revealKey.key} label="Copy key" />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setRevealKey(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Banner type={banner?.type} message={banner?.message} onDismiss={() => setBanner(null)} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={onExport}
          disabled={keys.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button size="sm" className="h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create key
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
          ) : keys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No keys yet — create one to get started."
              description="Virtual keys scope access to specific teams, models, and rate limits."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead className="text-right">RPM</TableHead>
                  <TableHead className="text-right">TPM</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.token}>
                    <TableCell className="font-medium text-foreground">
                      {k.key_alias || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground">
                          {maskToken(k.token)}
                        </span>
                        <CopyButton value={k.token} label="Copy token" />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.team_id ? aliases.get(String(k.team_id)) || k.team_id : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {!k.models || k.models.length === 0 ? (
                          <Badge variant="secondary">all</Badge>
                        ) : (
                          k.models.map((m) => (
                            <Badge key={m} variant="outline" className="font-mono text-[11px]">
                              {m}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right font-mono text-xs">
                      {k.rpm_limit == null ? '—' : formatNumber(k.rpm_limit)}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono text-xs">
                      {k.tpm_limit == null ? '—' : formatNumber(k.tpm_limit)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(k.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${k.key_alias || maskToken(k.token)}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(k)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-critical focus:text-critical"
                            onClick={() => setDeleteTarget(k)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Revoke
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

      <KeyFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        keyRow={editingKey}
        onCreated={onCreated}
        onUpdated={onUpdated}
        onError={onFormError}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Revoke this key?"
        description={
          deleteTarget
            ? `This immediately revokes "${deleteTarget.key_alias || maskToken(deleteTarget.token)}". Any client using it will start failing.`
            : ''
        }
        confirmLabel="Revoke key"
        busy={deleting}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}
