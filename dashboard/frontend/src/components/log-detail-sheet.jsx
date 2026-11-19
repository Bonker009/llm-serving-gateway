import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatMs, formatNumber } from '@/lib/format'

function StatusBadge({ status }) {
  const ok = typeof status === 'string' && status.toLowerCase() === 'success'
  return (
    <Badge variant={ok ? 'success' : 'critical'}>{status || 'unknown'}</Badge>
  )
}

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

function CopyButton({ value }) {
  const [copied, setCopied] = React.useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      /* ignore */
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onCopy}
      aria-label="Copy request ID"
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

function boolText(v) {
  if (v === true) return 'true'
  if (v === false) return 'false'
  return '—'
}

// Best-effort extraction of a human-readable error message from whatever
// shape the backend attached to `metadata` for a failed request.
function extractErrorMessage(row) {
  if (!row || typeof row.status !== 'string' || row.status.toLowerCase() === 'success') {
    return null
  }
  const meta = row.metadata
  if (!meta || typeof meta !== 'object') return row.status
  return (
    meta.error_message ||
    meta.error ||
    meta.error_information?.error_message ||
    meta.error_information?.error_class ||
    row.status
  )
}

export function LogDetailSheet({ row, open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="scrollbar-thin overflow-y-auto">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Request detail
                <StatusBadge status={row.status} />
              </SheetTitle>
              <SheetDescription className="flex items-center gap-1">
                <span className="truncate font-mono text-xs">{row.request_id}</span>
                <CopyButton value={row.request_id || ''} />
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Time">{formatDateTime(row.time)}</Field>
                <Field label="End time">{formatDateTime(row.end_time)}</Field>
                <Field label="Latency">{formatMs(row.latency_ms)}</Field>
                <Field label="Call type">{row.call_type || '—'}</Field>
                <Field label="Model" mono>
                  {row.model || '—'}
                </Field>
                <Field label="Cache hit">{boolText(row.cache_hit)}</Field>
                <Field label="Team ID" mono>
                  {row.team_id || '—'}
                </Field>
                <Field label="Key alias" mono>
                  {row.key_alias || '—'}
                </Field>
                <Field label="User" mono>
                  {row.user || '—'}
                </Field>
                <Field label="End user" mono>
                  {row.end_user || '—'}
                </Field>
              </div>

              <Field label="API base" mono>
                {row.api_base || '—'}
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Caller IP" mono>
                  {row.client_ip || '—'}
                </Field>
                <Field label="Backend IP" mono>
                  {row.backend_ip || '—'}
                </Field>
              </div>

              {extractErrorMessage(row) && (
                <div className="rounded-md border border-critical/40 bg-critical/10 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-critical">
                    Error
                  </p>
                  <p className="mt-1 break-words text-sm text-critical/90">
                    {extractErrorMessage(row)}
                  </p>
                </div>
              )}

              {/* Token breakdown */}
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Tokens
                </span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {[
                    ['Prompt', row.prompt_tokens],
                    ['Completion', row.completion_tokens],
                    ['Total', row.total_tokens],
                  ].map(([label, val]) => (
                    <div
                      key={label}
                      className="rounded-md border border-border bg-elevated/50 px-3 py-2"
                    >
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className="tabular font-mono text-sm font-medium text-foreground">
                        {val == null ? '—' : formatNumber(val)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Metadata
                </span>
                <pre className="scrollbar-thin mt-1.5 max-h-72 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
                  {row.metadata
                    ? JSON.stringify(row.metadata, null, 2)
                    : 'null'}
                </pre>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
