import { Menu, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useAppStore,
  RANGE_OPTIONS,
  REFRESH_OPTIONS,
} from '@/components/app-store'

export function Topbar({ title, subtitle, onOpenMobile }) {
  const { range, setRange, refresh, setRefresh, refetch, refreshing, loading } =
    useAppStore()

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onOpenMobile}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Time range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={refresh} onValueChange={setRefresh}>
            <SelectTrigger className="h-9 w-[110px]" aria-label="Auto refresh">
              <SelectValue>
                <span className="text-muted-foreground">Auto:</span>{' '}
                {REFRESH_OPTIONS.find((o) => o.value === refresh)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REFRESH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={refetch}
            disabled={refreshing || loading}
            aria-label="Refresh data"
          >
            <RefreshCw
              className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  )
}
