import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function StatTile({ label, value, hint, icon: Icon, loading, tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              'h-4 w-4',
              tone === 'success'
                ? 'text-success'
                : tone === 'critical'
                  ? 'text-critical'
                  : 'text-muted-foreground'
            )}
          />
        )}
      </div>
      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <span className="tabular text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
        )}
      </div>
      {hint && !loading && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </Card>
  )
}
