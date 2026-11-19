import * as React from 'react'
import {
  LayoutDashboard,
  BarChart3,
  Radio,
  ScrollText,
  HeartPulse,
  Users,
  KeyRound,
  Activity,
  Server,
  Gauge,
  TerminalSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/components/app-store'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'activity', label: 'Live activity', icon: Radio },
  { id: 'logs', label: 'Request logs', icon: ScrollText },
  { id: 'model-health', label: 'Model health', icon: HeartPulse },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'infrastructure', label: 'Infrastructure', icon: Server },
  { id: 'server', label: 'Server monitor', icon: Gauge },
  { id: 'playground', label: 'Playground', icon: TerminalSquare },
]

function HealthIndicator({ collapsed }) {
  const { health } = useAppStore()
  const reachable = health?.reachable
  const gateway = health?.gateway || 'unknown'

  const dot = (
    <span className="relative flex h-2 w-2 shrink-0">
      {reachable && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
      )}
      <span
        className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          reachable ? 'bg-success' : 'bg-critical'
        )}
      />
    </span>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex justify-center rounded-lg border border-border bg-elevated/50 py-2.5">
            {dot}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {reachable ? 'Gateway online' : 'Unreachable'} · {gateway}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-elevated/50 px-3 py-2.5">
      <span className="mt-1">{dot}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">
          {reachable ? 'Gateway online' : 'Unreachable'}
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground" title={gateway}>
          {gateway}
        </p>
      </div>
    </div>
  )
}

export function Sidebar({
  page,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapse,
}) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-card transition-[transform,width] duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Collapsed width applies on desktop only; the mobile drawer stays full width.
          collapsed && 'lg:w-16'
        )}
      >
        {/* Brand + collapse toggle */}
        <div
          className={cn(
            'flex items-center gap-2.5 px-5 py-5',
            collapsed && 'lg:flex-col lg:gap-3 lg:px-0'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Activity className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <div className={cn('leading-tight', collapsed && 'lg:hidden')}>
            <p className="text-sm font-semibold text-foreground">Gateway</p>
            <p className="font-mono text-[11px] text-muted-foreground">litellm local</p>
          </div>
          {/* Desktop collapse toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={cn(
                  'ml-auto hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex',
                  collapsed && 'lg:ml-0'
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Primary">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            const btn = (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  collapsed ? 'lg:justify-center lg:px-0 px-3' : 'px-3',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
              </button>
            )
            return collapsed ? (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              btn
            )
          })}
        </nav>

        {/* Footer: health + theme */}
        <div className="space-y-3 border-t border-border p-3">
          <HealthIndicator collapsed={collapsed} />
          <div
            className={cn(
              'flex items-center px-1',
              collapsed ? 'lg:justify-center' : 'justify-between'
            )}
          >
            <span className={cn('text-xs text-muted-foreground', collapsed && 'lg:hidden')}>
              Appearance
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  )
}
