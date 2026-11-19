import * as React from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { AppStoreProvider, useAppStore } from '@/components/app-store'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { Overview } from '@/pages/Overview'
import { Logs } from '@/pages/Logs'
import { Teams } from '@/pages/Teams'
import { Infrastructure } from '@/pages/Infrastructure'
import { Playground } from '@/pages/Playground'

const PAGES = {
  overview: {
    title: 'Overview',
    subtitle: 'Gateway traffic and health at a glance',
    Component: Overview,
  },
  logs: {
    title: 'Request logs',
    subtitle: 'Inspect individual gateway requests',
    Component: Logs,
  },
  teams: {
    title: 'Teams',
    subtitle: 'Provisioned teams and their limits',
    Component: Teams,
  },
  infrastructure: {
    title: 'Infrastructure',
    subtitle: 'Model backends, tiers, and team access',
    Component: Infrastructure,
  },
  playground: {
    title: 'Playground',
    subtitle: 'Send a live test request through the gateway',
    Component: Playground,
  },
}

function Shell() {
  const [page, setPage] = React.useState('overview')
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { pendingPage, clearPendingNavigate } = useAppStore()

  const current = PAGES[page] || PAGES.overview
  const Page = current.Component

  const navigate = (id) => {
    setPage(id)
    setMobileOpen(false)
  }

  // Lets any page ask the Shell to switch pages (e.g. "Test in playground").
  React.useEffect(() => {
    if (pendingPage && PAGES[pendingPage]) {
      setPage(pendingPage)
      setMobileOpen(false)
      clearPendingNavigate()
    }
  }, [pendingPage, clearPendingNavigate])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        page={page}
        onNavigate={navigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="lg:pl-60">
        <Topbar
          title={current.title}
          subtitle={current.subtitle}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <Page />
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppStoreProvider>
        <TooltipProvider delayDuration={200}>
          <Shell />
        </TooltipProvider>
      </AppStoreProvider>
    </ThemeProvider>
  )
}
