import * as React from 'react'
import { Check, Copy, TerminalSquare, Pencil, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/components/app-store'
import { buildCurl } from '@/lib/format'

const CONFIG_LOCKED_TITLE = 'Defined in litellm_config.yaml — edit the file instead.'

function Field({ label, children, mono }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={mono ? 'break-all font-mono text-sm text-foreground' : 'text-sm text-foreground'}>
        {children}
      </span>
    </div>
  )
}

function tierVariant(tier) {
  if (tier === 'shared') return 'success'
  if (tier === 'dedicated') return 'default'
  return 'secondary'
}

function CopyCurlButton({ value }) {
  const [copied, setCopied] = React.useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch (e) {
      /* ignore */
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onCopy}
      aria-label="Copy curl command"
      className="h-6 w-6"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}

// `model` carries the shape returned by GET /api/models plus the optional
// `teams` array computed by the caller (list of team aliases with access).
export function ModelDetailSheet({ model, open, onOpenChange, onEdit, onDelete }) {
  const { setSelectedModel, requestNavigate } = useAppStore()

  const kind = model?.mode === 'embedding' ? 'embedding' : 'chat'
  const curl = model ? buildCurl({ model: model.model_name, kind }) : ''
  const locked = model && model.source !== 'db'

  const onTestInPlayground = () => {
    if (!model) return
    setSelectedModel(model.model_name)
    requestNavigate('playground')
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="scrollbar-thin overflow-y-auto">
        {model && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="truncate font-mono">{model.model_name}</span>
                <Badge variant={tierVariant(model.tier)}>{model.tier || 'other'}</Badge>
              </SheetTitle>
              <SheetDescription>{model.provider || 'unknown provider'}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Provider">{model.provider || '—'}</Field>
                <Field label="Mode">{model.mode || '—'}</Field>
                <Field label="Raw model" mono>
                  {model.model || '—'}
                </Field>
                <Field label="Source">{model.source || '—'}</Field>
              </div>

              <Field label="Backend / API base" mono>
                {model.api_base || (model.host ? `${model.host}:${model.port || ''}` : '—')}
              </Field>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Teams with access
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {!model.teams || model.teams.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No teams reference this model</span>
                  ) : (
                    model.teams.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Copy as curl
                  </span>
                  <CopyCurlButton value={curl} />
                </div>
                <pre className="scrollbar-thin mt-1.5 max-h-56 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
                  {curl}
                </pre>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  $LITELLM_KEY refers to a provisioned virtual key — export it in your shell first.
                </p>
              </div>

              <Button onClick={onTestInPlayground} className="w-full">
                <TerminalSquare className="h-4 w-4" />
                Test in playground
              </Button>

              {onEdit && onDelete && (
                <div className="flex items-center gap-2">
                  {locked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button variant="outline" className="w-full" disabled>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{CONFIG_LOCKED_TITLE}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button variant="outline" className="flex-1" onClick={() => onEdit(model)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {locked ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1">
                          <Button variant="outline" className="w-full text-critical" disabled>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{CONFIG_LOCKED_TITLE}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1 text-critical hover:text-critical"
                      onClick={() => onDelete(model)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
