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
import { ModelsMultiSelect } from '@/components/models-multiselect'
import { createTeam, updateTeam } from '@/lib/api'

const EMPTY = { team_alias: '', models: [], rpm_limit: '', tpm_limit: '' }

// Shared create/edit sheet for teams. Pass `team` to prefill for edit mode.
export function TeamFormSheet({ open, onOpenChange, team, onSuccess, onError }) {
  const editing = Boolean(team)
  const [form, setForm] = React.useState(EMPTY)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm(
        team
          ? {
              team_alias: team.team_alias || '',
              models: team.models || [],
              rpm_limit: team.rpm_limit ?? '',
              tpm_limit: team.tpm_limit ?? '',
            }
          : EMPTY
      )
    }
  }, [open, team])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const body = {
        team_alias: form.team_alias.trim(),
        models: form.models,
        rpm_limit: form.rpm_limit === '' ? undefined : Number(form.rpm_limit),
        tpm_limit: form.tpm_limit === '' ? undefined : Number(form.tpm_limit),
      }
      if (editing) {
        await updateTeam({ team_id: team.team_id, ...body })
        onSuccess?.(`Updated team "${body.team_alias || team.team_id}".`)
      } else {
        await createTeam(body)
        onSuccess?.(`Created team "${body.team_alias}".`)
      }
      onOpenChange(false)
    } catch (err) {
      onError?.(err.message || 'Failed to save team.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="scrollbar-thin overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? 'Edit team' : 'New team'}</SheetTitle>
          <SheetDescription>
            {editing
              ? 'Update the team alias, model access, and rate limits.'
              : 'Provision a new team with scoped model access and rate limits.'}
          </SheetDescription>
        </SheetHeader>

        <form className="flex flex-col gap-4 p-5" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="team-alias">
              Team alias
            </label>
            <Input
              id="team-alias"
              required
              value={form.team_alias}
              onChange={(e) => setForm((f) => ({ ...f, team_alias: e.target.value }))}
              placeholder="e.g. research-team"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="team-models">
              Models
            </label>
            <ModelsMultiSelect
              id="team-models"
              value={form.models}
              onChange={(models) => setForm((f) => ({ ...f, models }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="team-rpm">
                RPM limit
              </label>
              <Input
                id="team-rpm"
                type="number"
                min={0}
                value={form.rpm_limit}
                onChange={(e) => setForm((f) => ({ ...f, rpm_limit: e.target.value }))}
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="team-tpm">
                TPM limit
              </label>
              <Input
                id="team-tpm"
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
            <Button type="submit" disabled={saving || !form.team_alias.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Create team'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
