import * as React from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { useTheme } from '@/components/theme-provider'
import { getPalette } from '@/lib/chart-theme'

// Minimal, axis-less trend line for a rolling metric history. Pass an array of
// numbers (oldest → newest). `tone` picks a status color; otherwise the azure
// accent. `domain` fixes the Y range (e.g. [0, 100] for percentages) so the line
// reflects absolute level, not just relative shape.
const TONE_KEY = {
  primary: 'accent',
  success: 'success',
  warning: 'warning',
  critical: 'critical',
}

export function Sparkline({ data, tone = 'primary', domain = ['auto', 'auto'], height = 36 }) {
  const { theme } = useTheme()
  const p = getPalette(theme)
  const color = p[TONE_KEY[tone] || 'accent'] || p.accent
  const id = React.useId().replace(/:/g, '')

  const series = React.useMemo(
    () => (data || []).map((v, i) => ({ i, v: v == null ? 0 : v })),
    [data]
  )

  if (series.length < 2) {
    return <div style={{ height }} className="w-full" aria-hidden="true" />
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={domain} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#spark-${id})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
