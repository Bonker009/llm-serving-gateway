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
import { createModel, updateModel } from '@/lib/api'

const PREFIXES = ['ollama_chat', 'ollama', 'openai', 'hosted_vllm']

const EMPTY = { model_name: '', prefix: PREFIXES[0], model_id: '', api_base: '', api_key: '' }

function splitModel(model) {
  if (!model) return { prefix: PREFIXES[0], model_id: '' }
  const idx = model.indexOf('/')
  if (idx === -1) return { prefix: PREFIXES[0], model_id: model }
  const prefix = model.slice(0, idx)
  return {
    prefix: PREFIXES.includes(prefix) ? prefix : PREFIXES[0],
    model_id: model.slice(idx + 1),
  }
}

// Shared create/edit sheet for models. Pass `model` (an item from GET
// /api/models, which now includes `id`) to prefill for edit mode. Only
// `source === 'db'` models are editable — the caller is responsible for not
// opening this in edit mode for config-defined models.
export function ModelFormSheet({ open, onOpenChange, model, onSuccess, onError }) {
  const editing = Boolean(model)
  const [form, setForm] = React.useState(EMPTY)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      if (model) {
        const { prefix, model_id } = splitModel(model.model)
        setForm({
          model_name: model.model_name || '',
          prefix,
          model_id,
          api_base: model.api_base || '',
          api_key: '',
        })
      } else {
        setForm(EMPTY)
      }
    }
  }, [open, model])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const body = {
        model_name: form.model_name.trim(),
        model: `${form.prefix}/${form.model_id.trim()}`,
        api_base: form.api_base.trim() || undefined,
        api_key: form.api_key.trim() || undefined,
      }
      if (editing) {
        await updateModel({ id: model.id, ...body })
        onSuccess?.(`Updated model "${body.model_name}".`)
      } else {
        await createModel(body)
        onSuccess?.(`Added model "${body.model_name}".`)
      }
      onOpenChange(false)
    } catch (err) {
      onError?.(err.message || 'Failed to save model.')
    } finally {
      setSaving(false)
    }
  }

  const valid = form.model_name.trim() && form.model_id.trim()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="scrollbar-thin overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? 'Edit model' : 'Add model'}</SheetTitle>
          <SheetDescription>
            {editing
              ? 'Update the backend this model routes to.'
              : 'Register a new model backend with the gateway.'}
          </SheetDescription>
        </SheetHeader>

        <form className="flex flex-col gap-4 p-5" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="model-name">
              Model name
            </label>
            <Input
              id="model-name"
              required
              value={form.model_name}
              onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
              placeholder="e.g. qwen3-8b"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Provider model</span>
            <div className="flex gap-2">
              <Select
                value={form.prefix}
                onValueChange={(v) => setForm((f) => ({ ...f, prefix: v }))}
              >
                <SelectTrigger className="w-[150px]" aria-label="Provider prefix">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREFIXES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                required
                value={form.model_id}
                onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
                placeholder="e.g. Qwen3-8B"
                aria-label="Model id"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Combined as <span className="font-mono">{form.prefix}/{form.model_id || '…'}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="model-api-base">
              API base
            </label>
            <Input
              id="model-api-base"
              value={form.api_base}
              onChange={(e) => setForm((f) => ({ ...f, api_base: e.target.value }))}
              placeholder="e.g. http://localhost:11434"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="model-api-key">
              API key (optional)
            </label>
            <Input
              id="model-api-key"
              type="password"
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              placeholder={editing ? 'Leave blank to keep existing' : 'Only if the backend requires one'}
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !valid}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add model'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
