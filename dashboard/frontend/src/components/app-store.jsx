import * as React from 'react'
import { getHealth, getLogs, getModels, getTeams } from '@/lib/api'

const AppStoreContext = React.createContext(null)

export const RANGE_OPTIONS = [
  { value: '1', label: 'Last 24h' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
]

export const REFRESH_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '10', label: '10s' },
  { value: '30', label: '30s' },
]

export function AppStoreProvider({ children }) {
  const [range, setRange] = React.useState('7')
  const [refresh, setRefresh] = React.useState('0')

  const [logs, setLogs] = React.useState([])
  const [teams, setTeams] = React.useState([])
  const [health, setHealth] = React.useState(null)
  const [models, setModels] = React.useState([])

  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [lastUpdated, setLastUpdated] = React.useState(null)

  // Shared selection so the model detail drawer (Infrastructure) can hand
  // off a model to the Playground page.
  const [selectedModel, setSelectedModel] = React.useState(null)
  const [pendingPage, setPendingPage] = React.useState(null)

  const mounted = React.useRef(true)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const fetchAll = React.useCallback(
    async (opts = {}) => {
      const { silent = false } = opts
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const [logsRes, teamsRes, healthRes, modelsRes] = await Promise.all([
          getLogs(Number(range), 1000),
          getTeams(),
          getHealth(),
          getModels(),
        ])
        if (!mounted.current) return
        setLogs(Array.isArray(logsRes) ? logsRes : [])
        setTeams(Array.isArray(teamsRes) ? teamsRes : [])
        setHealth(healthRes || null)
        setModels(Array.isArray(modelsRes) ? modelsRes : [])
        setError(null)
        setLastUpdated(new Date())
      } catch (err) {
        if (!mounted.current) return
        setError(err.message || 'Failed to load data.')
      } finally {
        if (!mounted.current) return
        setLoading(false)
        setRefreshing(false)
      }
    },
    [range]
  )

  // Refetch health only (used alongside the auto-refresh interval).
  const refreshHealth = React.useCallback(async () => {
    try {
      const h = await getHealth()
      if (mounted.current) setHealth(h || null)
    } catch (e) {
      if (mounted.current) setHealth({ gateway: health?.gateway || '', reachable: false })
    }
  }, [health])

  // Initial + range-change load.
  React.useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Auto-refresh interval.
  React.useEffect(() => {
    const secs = Number(refresh)
    if (!secs) return
    const id = setInterval(() => {
      fetchAll({ silent: true })
    }, secs * 1000)
    return () => clearInterval(id)
  }, [refresh, fetchAll])

  // Lets a page (e.g. the model detail drawer) ask the Shell to switch pages.
  // The Shell consumes `pendingPage` via an effect and clears it afterwards.
  const requestNavigate = React.useCallback((pageId) => {
    setPendingPage(pageId)
  }, [])
  const clearPendingNavigate = React.useCallback(() => {
    setPendingPage(null)
  }, [])

  const value = React.useMemo(
    () => ({
      range,
      setRange,
      refresh,
      setRefresh,
      logs,
      teams,
      health,
      models,
      loading,
      refreshing,
      error,
      lastUpdated,
      refetch: () => fetchAll({ silent: true }),
      refreshHealth,
      selectedModel,
      setSelectedModel,
      pendingPage,
      requestNavigate,
      clearPendingNavigate,
    }),
    [
      range,
      refresh,
      logs,
      teams,
      health,
      models,
      loading,
      refreshing,
      error,
      lastUpdated,
      fetchAll,
      refreshHealth,
      selectedModel,
      pendingPage,
      requestNavigate,
      clearPendingNavigate,
    ]
  )

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  )
}

export function useAppStore() {
  const ctx = React.useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider')
  return ctx
}
