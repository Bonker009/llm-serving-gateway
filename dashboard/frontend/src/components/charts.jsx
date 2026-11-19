import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '@/components/theme-provider'
import { getPalette } from '@/lib/chart-theme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { compactNumber, formatDayLabel, formatNumber, formatPercent } from '@/lib/format'
import { BarChart3 } from 'lucide-react'

function ChartCard({ title, children, loading, isEmpty, emptyLabel = 'No data in this window', height = 240 }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <Skeleton style={{ height }} className="w-full" />
        ) : isEmpty ? (
          <div style={{ height }} className="flex items-center justify-center">
            <EmptyState icon={BarChart3} title={emptyLabel} className="py-6" />
          </div>
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </CardContent>
    </Card>
  )
}

function TooltipBox({ p, rows }) {
  return (
    <div
      className="rounded-md border px-2.5 py-1.5 text-xs shadow-md"
      style={{ background: p.tooltipBg, borderColor: p.tooltipBorder, color: p.text }}
    >
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap">
          {r.color && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: r.color }}
            />
          )}
          <span style={{ color: p.axis }}>{r.label}</span>
          <span className="tabular ml-auto font-mono font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

const axisTick = (p) => ({ fill: p.axis, fontSize: 11 })

export function RequestsPerDayChart({ data, loading }) {
  const { theme } = useTheme()
  const p = getPalette(theme)
  const isEmpty = !data || data.every((d) => d.requests === 0)
  return (
    <ChartCard title="Requests per day" loading={loading} isEmpty={isEmpty}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={p.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={p.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDayLabel}
            tick={axisTick(p)}
            tickLine={false}
            axisLine={{ stroke: p.grid }}
            minTickGap={24}
          />
          <YAxis
            tick={axisTick(p)}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={compactNumber}
          />
          <Tooltip
            cursor={{ stroke: p.grid }}
            content={({ active, payload, label }) =>
              active && payload && payload.length ? (
                <TooltipBox
                  p={p}
                  rows={[
                    { label: formatDayLabel(label), value: '' },
                    { label: 'Requests', value: formatNumber(payload[0].value), color: p.accent },
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="requests"
            stroke={p.accent}
            strokeWidth={2}
            fill="url(#gReq)"
            dot={false}
            activeDot={{ r: 4, fill: p.accent, stroke: p.tooltipBg, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function TokensPerDayChart({ data, loading }) {
  const { theme } = useTheme()
  const p = getPalette(theme)
  const isEmpty = !data || data.every((d) => d.tokens === 0)
  return (
    <ChartCard title="Tokens per day" loading={loading} isEmpty={isEmpty}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gTok" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.accent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={p.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={p.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDayLabel}
            tick={axisTick(p)}
            tickLine={false}
            axisLine={{ stroke: p.grid }}
            minTickGap={24}
          />
          <YAxis
            tick={axisTick(p)}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={compactNumber}
          />
          <Tooltip
            cursor={{ stroke: p.grid }}
            content={({ active, payload, label }) =>
              active && payload && payload.length ? (
                <TooltipBox
                  p={p}
                  rows={[
                    { label: formatDayLabel(label), value: '' },
                    { label: 'Tokens', value: formatNumber(payload[0].value), color: p.accent },
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke={p.accent}
            strokeWidth={2}
            fill="url(#gTok)"
            dot={false}
            activeDot={{ r: 4, fill: p.accent, stroke: p.tooltipBg, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function HorizontalBars({ title, data, loading, labelName }) {
  const { theme } = useTheme()
  const p = getPalette(theme)
  const isEmpty = !data || data.length === 0
  const height = Math.max(200, (data?.length || 0) * 34 + 16)
  return (
    <ChartCard title={title} loading={loading} isEmpty={isEmpty} height={isEmpty ? 240 : height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          barCategoryGap={8}
        >
          <CartesianGrid stroke={p.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={axisTick(p)}
            tickLine={false}
            axisLine={false}
            tickFormatter={compactNumber}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: p.text, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={120}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: p.grid, fillOpacity: 0.25 }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <TooltipBox
                  p={p}
                  rows={[
                    { label: payload[0].payload.name, value: '' },
                    { label: labelName, value: formatNumber(payload[0].value), color: p.accent },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="value" fill={p.accent} radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function RequestsByModelChart({ data, loading }) {
  return (
    <HorizontalBars
      title="Requests by model"
      data={data}
      loading={loading}
      labelName="Requests"
    />
  )
}

export function RequestsByTeamChart({ data, loading }) {
  return (
    <HorizontalBars
      title="Requests by team"
      data={data}
      loading={loading}
      labelName="Requests"
    />
  )
}

export function SuccessDonutChart({ data, loading }) {
  const { theme } = useTheme()
  const p = getPalette(theme)
  const total = (data?.success || 0) + (data?.error || 0)
  const isEmpty = total === 0
  const successRate = total ? (data.success / total) * 100 : 0
  const pieData = [
    { name: 'Success', value: data?.success || 0, color: p.success },
    { name: 'Error', value: data?.error || 0, color: p.critical },
  ]
  return (
    <ChartCard title="Success vs error" loading={loading} isEmpty={isEmpty}>
      <div className="relative flex h-full items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload && payload.length ? (
                  <TooltipBox
                    p={p}
                    rows={[
                      {
                        label: payload[0].name,
                        value: formatNumber(payload[0].value),
                        color: payload[0].payload.color,
                      },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-2xl font-semibold text-foreground">
            {formatPercent(successRate)}
          </span>
          <span className="text-xs text-muted-foreground">success</span>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-5">
        {pieData.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-xs text-muted-foreground">
              {d.name} <span className="tabular font-mono text-foreground">{formatNumber(d.value)}</span>
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

export function LatencyChart({ data, loading }) {
  const { theme } = useTheme()
  const p = getPalette(theme)
  const isEmpty = !data || data.every((d) => d.p50 === 0 && d.p95 === 0)
  return (
    <ChartCard title="Latency over time (p50 / p95)" loading={loading} isEmpty={isEmpty}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={p.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={formatDayLabel}
            tick={axisTick(p)}
            tickLine={false}
            axisLine={{ stroke: p.grid }}
            minTickGap={24}
          />
          <YAxis
            tick={axisTick(p)}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => `${compactNumber(v)}`}
          />
          <Tooltip
            cursor={{ stroke: p.grid }}
            content={({ active, payload, label }) =>
              active && payload && payload.length ? (
                <TooltipBox
                  p={p}
                  rows={[
                    { label: formatDayLabel(label), value: '' },
                    ...payload.map((s) => ({
                      label: s.name,
                      value: `${formatNumber(s.value)}ms`,
                      color: s.color,
                    })),
                  ]}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            name="p50"
            dataKey="p50"
            stroke={p.series[1]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5 }}
          />
          <Line
            type="monotone"
            name="p95"
            dataKey="p95"
            stroke={p.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: p.series[1] }} />
          <span className="text-xs text-muted-foreground">p50</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: p.accent }} />
          <span className="text-xs text-muted-foreground">p95</span>
        </div>
      </div>
    </ChartCard>
  )
}
