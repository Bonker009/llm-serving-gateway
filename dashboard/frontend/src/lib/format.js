// Formatting helpers. All numeric output is designed to pair with
// `font-variant-numeric: tabular-nums` in the UI.

export function compactNumber(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs < 1000) return String(n)
  const units = [
    { v: 1e9, s: 'B' },
    { v: 1e6, s: 'M' },
    { v: 1e3, s: 'k' },
  ]
  for (const u of units) {
    if (abs >= u.v) {
      const val = n / u.v
      const str = val >= 100 ? val.toFixed(0) : val.toFixed(1)
      return str.replace(/\.0$/, '') + u.s
    }
  }
  return String(n)
}

export function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US')
}

export function formatPercent(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${n.toFixed(digits)}%`
}

export function formatMs(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`
  return `${Math.round(n)}ms`
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatDayLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// Build a CSV string from an array of objects given an ordered column spec.
export function toCSV(rows, columns) {
  const escape = (val) => {
    if (val == null) return ''
    let s = typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (/[",\n\r]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const header = columns.map((c) => escape(c.label)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escape(c.get(row))).join(','))
    .join('\n')
  return header + '\n' + body
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Builds a ready-to-paste curl snippet that hits the gateway's OpenAI-style
// endpoint for a given model. `$LITELLM_KEY` refers to a provisioned virtual
// key the caller is expected to export in their shell — we never print a
// real key here.
export function buildCurl({ model, kind }) {
  const path = kind === 'embedding' ? '/v1/embeddings' : '/v1/chat/completions'
  const body =
    kind === 'embedding'
      ? { model, input: 'Hello world' }
      : {
          model,
          messages: [{ role: 'user', content: 'Hello, who are you?' }],
          max_tokens: 256,
        }
  return [
    `curl http://localhost:4000${path} \\`,
    `  -H "Authorization: Bearer $LITELLM_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join('\n')
}
