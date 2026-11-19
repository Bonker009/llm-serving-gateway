import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  ScrollText,
  OctagonAlert,
} from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { LogDetailSheet } from '@/components/log-detail-sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isSuccess } from '@/lib/analytics'
import {
  formatMs,
  formatNumber,
  formatTime,
  toCSV,
  downloadCSV,
} from '@/lib/format'

const PAGE_SIZES = ['25', '50', '100']

const CSV_COLUMNS = [
  { label: 'request_id', get: (r) => r.request_id },
  { label: 'time', get: (r) => r.time },
  { label: 'end_time', get: (r) => r.end_time },
  { label: 'latency_ms', get: (r) => r.latency_ms },
  { label: 'model', get: (r) => r.model },
  { label: 'call_type', get: (r) => r.call_type },
  { label: 'team_id', get: (r) => r.team_id },
  { label: 'key_alias', get: (r) => r.key_alias },
  { label: 'user', get: (r) => r.user },
  { label: 'end_user', get: (r) => r.end_user },
  { label: 'cache_hit', get: (r) => r.cache_hit },
  { label: 'api_base', get: (r) => r.api_base },
  { label: 'client_ip', get: (r) => r.client_ip },
  { label: 'backend_ip', get: (r) => r.backend_ip },
  { label: 'status', get: (r) => r.status },
  { label: 'prompt_tokens', get: (r) => r.prompt_tokens },
  { label: 'completion_tokens', get: (r) => r.completion_tokens },
  { label: 'total_tokens', get: (r) => r.total_tokens },
  { label: 'metadata', get: (r) => r.metadata },
]

function IpCell({ row }) {
  if (row.client_ip) {
    return <span className="font-mono text-xs text-foreground">{row.client_ip}</span>
  }
  if (row.backend_ip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
            {row.backend_ip}
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              backend
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent>Caller IP unavailable — showing backend IP instead.</TooltipContent>
      </Tooltip>
    )
  }
  return <span className="font-mono text-xs text-muted-foreground">—</span>
}

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v != null && v !== ''))].sort()
}

function SortHeader({ label, field, sort, onSort, className }) {
  const active = sort.field === field
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <span className="h-3 w-3 opacity-0" />
        )}
      </button>
    </TableHead>
  )
}

export function Logs() {
  const { logs, loading, error } = useAppStore()

  const [query, setQuery] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [model, setModel] = React.useState('all')
  const [team, setTeam] = React.useState('all')
  const [errorsOnly, setErrorsOnly] = React.useState(false)
  const [pageSize, setPageSize] = React.useState('25')
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState({ field: 'time', dir: 'desc' })

  const [selected, setSelected] = React.useState(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const models = React.useMemo(
    () => uniqueSorted(logs.map((r) => r.model)),
    [logs]
  )
  const teamsList = React.useMemo(
    () => uniqueSorted(logs.map((r) => r.team_id)),
    [logs]
  )

  // Filter
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter((r) => {
      if (errorsOnly && isSuccess(r)) return false
      if (status === 'success' && !isSuccess(r)) return false
      if (status === 'error' && isSuccess(r)) return false
      if (model !== 'all' && r.model !== model) return false
      if (team !== 'all' && String(r.team_id) !== team) return false
      if (q) {
        const hay = [
          r.model,
          r.team_id,
          r.key_alias,
          r.user,
          r.request_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [logs, query, status, model, team, errorsOnly])

  // Sort
  const sorted = React.useMemo(() => {
    const arr = filtered.slice()
    const { field, dir } = sort
    const mul = dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      let av
      let bv
      if (field === 'time') {
        av = new Date(a.time).getTime() || 0
        bv = new Date(b.time).getTime() || 0
      } else {
        av = a[field] == null ? -Infinity : a[field]
        bv = b[field] == null ? -Infinity : b[field]
      }
      if (av < bv) return -1 * mul
      if (av > bv) return 1 * mul
      return 0
    })
    return arr
  }, [filtered, sort])

  // Pagination
  const size = Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(sorted.length / size))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * size
  const pageRows = sorted.slice(start, start + size)

  // Reset to page 1 when filters/sort/size change.
  React.useEffect(() => {
    setPage(1)
  }, [query, status, model, team, errorsOnly, pageSize, sort])

  const failedCount = React.useMemo(
    () => logs.reduce((n, r) => n + (isSuccess(r) ? 0 : 1), 0),
    [logs]
  )

  const onSort = (field) => {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' }
    )
  }

  const openRow = (row) => {
    setSelected(row)
    setSheetOpen(true)
  }

  const onExport = () => {
    const csv = toCSV(sorted, CSV_COLUMNS)
    downloadCSV('gateway-logs.csv', csv)
  }

  const hasLogs = logs.length > 0
  const rangeStart = sorted.length === 0 ? 0 : start + 1
  const rangeEnd = Math.min(start + size, sorted.length)

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-critical/40">
          <CardContent className="py-4">
            <p className="text-sm text-critical">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative flex-1 lg:min-w-[220px] lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search model, team, key, user, request id…"
            className="pl-9"
            aria-label="Search requests"
          />
        </div>

        <Button
          type="button"
          variant={errorsOnly ? 'destructive' : 'outline'}
          size="sm"
          className="h-9"
          onClick={() => setErrorsOnly((v) => !v)}
          aria-pressed={errorsOnly}
        >
          <OctagonAlert className="h-4 w-4" />
          Errors only
          {failedCount > 0 && (
            <Badge
              variant={errorsOnly ? 'secondary' : 'critical'}
              className="ml-1 px-1.5"
            >
              {failedCount}
            </Badge>
          )}
        </Button>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[130px]" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-full sm:w-[170px]" aria-label="Model filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Team filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teamsList.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 lg:ml-auto">
          <Select value={pageSize} onValueChange={setPageSize}>
            <SelectTrigger className="w-[92px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={onExport}
            disabled={sorted.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Time" field="time" sort={sort} onSort={onSort} />
                <TableHead>Status</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>IP</TableHead>
                <SortHeader
                  label="Latency"
                  field="latency_ms"
                  sort={sort}
                  onSort={onSort}
                  className="text-right"
                />
                <TableHead className="text-right">Prompt</TableHead>
                <TableHead className="text-right">Compl.</TableHead>
                <SortHeader
                  label="Total"
                  field="total_tokens"
                  sort={sort}
                  onSort={onSort}
                  className="text-right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={11}>
                    <EmptyState
                      icon={ScrollText}
                      title={
                        hasLogs
                          ? 'No rows match your filters'
                          : 'No requests in this window'
                      }
                      description={
                        hasLogs
                          ? 'Try clearing the search or widening the filters.'
                          : 'Pick a wider time range from the top bar.'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => {
                  const ok = isSuccess(r)
                  return (
                    <TableRow
                      key={r.request_id}
                      onClick={() => openRow(r)}
                      className="cursor-pointer"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openRow(r)
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatTime(r.time)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ok ? 'success' : 'critical'}>
                          {ok ? 'success' : 'error'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate font-mono text-xs text-foreground">
                        {r.model || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.call_type || '—'}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate font-mono text-xs text-muted-foreground">
                        {r.team_id || '—'}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                        {r.key_alias || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <IpCell row={r} />
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right font-mono text-xs">
                        {formatMs(r.latency_ms)}
                      </TableCell>
                      <TableCell className="tabular text-right font-mono text-xs text-muted-foreground">
                        {r.prompt_tokens == null ? '—' : formatNumber(r.prompt_tokens)}
                      </TableCell>
                      <TableCell className="tabular text-right font-mono text-xs text-muted-foreground">
                        {r.completion_tokens == null
                          ? '—'
                          : formatNumber(r.completion_tokens)}
                      </TableCell>
                      <TableCell className="tabular text-right font-mono text-xs text-foreground">
                        {r.total_tokens == null ? '—' : formatNumber(r.total_tokens)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && sorted.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="tabular text-xs text-muted-foreground">
            {formatNumber(rangeStart)}–{formatNumber(rangeEnd)} of{' '}
            {formatNumber(sorted.length)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular text-xs text-muted-foreground">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <LogDetailSheet row={selected} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
