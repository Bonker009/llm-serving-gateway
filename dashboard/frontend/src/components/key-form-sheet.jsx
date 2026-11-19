import * as React from 'react'
import { Loader2 } from 'lucide-react'
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

  React.useEffect(() => {
    if (open) {
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

  const onSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const body = {
        key_alias: form.key_alias.trim(),
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
              Key alias
            </label>
            <Input
              id="key-alias"
              required
              value={form.key_alias}
              onChange={(e) => setForm((f) => ({ ...f, key_alias: e.target.value }))}
              placeholder="e.g. research-key"
            />
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="key-models">
              Models
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
                placeholder="Unlimited"
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
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.key_alias.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create key'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
