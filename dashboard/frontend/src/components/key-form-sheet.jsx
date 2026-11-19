import * as React from 'react'
import { Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModelsMultiSelect } from '@/components/models-multiselect'
import { useAppStore } from '@/components/app-store'
import { createKey, updateKey } from '@/lib/api'

const NO_TEAM = '__none__'
const EMPTY = { key_alias: '', team_id: NO_TEAM, models: [], rpm_limit: '', tpm_limit: '' }

// Shared create/edit sheet for keys. Pass `keyRow` (the row shape returned
// by GET /api/keys) to prefill for edit mode.
export function KeyFormSheet({ open, onOpenChange, keyRow, onCreated, onUpdated, onError }) {
  const { teams } = useAppStore()
  const editing = Boolean(keyRow)
  const [form, setForm] = React.useState(EMPTY)
  const [saving, setSaving] = React.useState(false)
  const [showAdvanced, setShowAdvanced] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      const hasOverride = Boolean(
        keyRow &&
          ((keyRow.models && keyRow.models.length) ||
            keyRow.rpm_limit != null ||
            keyRow.tpm_limit != null)
      )
      setShowAdvanced(hasOverride)
      setForm(
        keyRow
          ? {
              key_alias: keyRow.key_alias || '',
              team_id: keyRow.team_id ? String(keyRow.team_id) : NO_TEAM,
              models: keyRow.models || [],
              rpm_limit: keyRow.rpm_limit ?? '',
              tpm_limit: keyRow.tpm_limit ?? '',
            }
          : EMPTY
      )
    }
  }, [open, keyRow])

  // The team supplies the default model access + rate limits a key inherits.
  const team = teams.find((t) => String(t.team_id) === form.team_id)
  const inheritHint = () => {
    if (form.team_id === NO_TEAM) return 'No team — the key has no inherited access.'
    if (!team) return null
    const models = team.models && team.models.length ? `${team.models.length} model(s)` : 'all models'
    const rpm = team.rpm_limit != null ? `${team.rpm_limit} rpm` : null
    const tpm = team.tpm_limit != null ? `${team.tpm_limit} tpm` : null
    const limits = [rpm, tpm].filter(Boolean).join(' · ')
    return `Inherits ${models}${limits ? ` and ${limits}` : ' and the team’s limits'}.`
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const body = {
        key_alias: form.key_alias.trim() || undefined,
        team_id: form.team_id === NO_TEAM ? undefined : form.team_id,
        models: form.models,
        rpm_limit: form.rpm_limit === '' ? undefined : Number(form.rpm_limit),
        tpm_limit: form.tpm_limit === '' ? undefined : Number(form.tpm_limit),
      }
      if (editing) {
        await updateKey({ key: keyRow.token, ...body })
        onUpdated?.(`Updated key "${body.key_alias || keyRow.token}".`)
      } else {
        const res = await createKey(body)
        onCreated?.(res)
      }
      onOpenChange(false)
    } catch (err) {
      onError?.(err.message || 'Failed to save key.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="scrollbar-thin overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? 'Edit key' : 'Create key'}</SheetTitle>
          <SheetDescription>
            {editing
              ? 'Update the key alias, team, model access, and rate limits.'
              : 'Provision a new virtual key. The secret is shown once after creation.'}
          </SheetDescription>
        </SheetHeader>

        <form className="flex flex-col gap-4 p-5" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="key-alias">
              Key alias (optional)
            </label>
            <Input
              id="key-alias"
              value={form.key_alias}
              onChange={(e) => setForm((f) => ({ ...f, key_alias: e.target.value }))}
              placeholder="e.g. research-key — leave blank for an unnamed key"
            />
            <p className="text-xs text-muted-foreground">
              Naming helps you find the key later, but it isn’t required — the gateway still
              generates the token.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="key-team">
              Team
            </label>
            <Select
              value={form.team_id}
              onValueChange={(v) => setForm((f) => ({ ...f, team_id: v }))}
            >
              <SelectTrigger id="key-team">
                <SelectValue placeholder="No team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEAM}>No team</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.team_id} value={String(t.team_id)}>
                    {t.team_alias || t.team_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {inheritHint() && (
              <p className="text-xs text-muted-foreground">{inheritHint()}</p>
            )}
          </div>

          {/* A key normally just inherits its team's models + limits. These are
              optional per-key overrides, kept out of the way by default. */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced((s) => !s)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Advanced override (optional)
            </button>
            {showAdvanced && (
              <div className="space-y-4 border-t border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Leave blank to inherit from the team. Set these only to restrict this
                  key below the team’s access.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="key-models">
                    Models override
                  </label>
                  <ModelsMultiSelect
                    id="key-models"
                    value={form.models}
                    onChange={(models) => setForm((f) => ({ ...f, models }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="key-rpm">
                      RPM limit
                    </label>
                    <Input
                      id="key-rpm"
                      type="number"
                      min={0}
                      value={form.rpm_limit}
                      onChange={(e) => setForm((f) => ({ ...f, rpm_limit: e.target.value }))}
                      placeholder="Inherit"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="key-tpm">
                      TPM limit
                    </label>
                    <Input
                      id="key-tpm"
                      type="number"
                      min={0}
                      value={form.tpm_limit}
                      onChange={(e) => setForm((f) => ({ ...f, tpm_limit: e.target.value }))}
                      placeholder="Inherit"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create key'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
