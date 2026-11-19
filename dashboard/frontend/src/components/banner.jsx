import * as React from 'react'
import { CircleCheck, OctagonAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Lightweight inline success/error banner — no toast library. Pages own a
// single `{ type: 'success' | 'error', message }` piece of state and render
// this at the top, mirroring the existing error `Card` pattern.
export function Banner({ type = 'error', message, onDismiss, className }) {
  if (!message) return null
  const success = type === 'success'
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3',
        success ? 'border-success/40 bg-success/10' : 'border-critical/40 bg-critical/10',
        className
      )}
    >
      {success ? (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
      )}
      <p className={cn('flex-1 text-sm', success ? 'text-success' : 'text-critical')}>
        {message}
      </p>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-1 -mt-1 h-6 w-6"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
