import * as React from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

// A small confirmation modal built on the existing `sheet` primitive (there
// is no separate `dialog` component in this project). It overrides the
// sheet's slide-in-from-the-right layout with a centered card so it reads as
// a confirmation prompt rather than a drawer.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  onConfirm,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="inset-y-auto left-1/2 right-auto top-1/2 h-auto w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border data-[state=open]:animate-fade-in">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div
              className={
                destructive
                  ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-critical/15 text-critical'
                  : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary'
              }
            >
              <TriangleAlert className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={destructive ? 'destructive' : 'default'}
              size="sm"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
