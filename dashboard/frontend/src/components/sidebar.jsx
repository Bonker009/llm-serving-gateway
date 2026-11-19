import * as React from 'react'
import {
  LayoutDashboard,
  ScrollText,
  Users,
  KeyRound,
  Activity,
  Server,
  TerminalSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/components/app-store'
import { ThemeToggle } from '@/components/theme-toggle'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'logs', label: 'Request logs', icon: ScrollText },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'infrastructure', label: 'Infrastructure', icon: Server },
  { id: 'playground', label: 'Playground', icon: TerminalSquare },
]

function HealthIndicator() {
  const { health } = useAppStore()
  const reachable = health?.reachable
  const gateway = health?.gateway || 'unknown'
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-elevated/50 px-3 py-2.5">
      <span className="relative mt-1 flex h-2 w-2 shrink-0">
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

export function Sidebar({ page, onNavigate, mobileOpen, onCloseMobile }) {
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
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-card transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Activity className="h-4.5 w-4.5" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Gateway</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              litellm local
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Primary">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Footer: health + theme */}
        <div className="space-y-3 border-t border-border p-3">
          <HealthIndicator />
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  )
}
