// JS color palettes mirrored from the CSS variables so Recharts (which cannot
// read CSS vars directly for fills/gradients) can be driven per theme.

export const CHART_PALETTE = {
  dark: {
    accent: '#4aa8ff',
    accentSoft: '#4aa8ff',
    grid: '#262c37',
    axis: '#8a93a3',
    text: '#e9ecf2',
    tooltipBg: '#1a1e26',
    tooltipBorder: '#262c37',
    success: '#34d399',
    warning: '#fbbf24',
    critical: '#f87171',
    series: ['#4aa8ff', '#8a93a3'],
  },
  light: {
    accent: '#1f6fd6',
    accentSoft: '#1f6fd6',
    grid: '#dde2e9',
    axis: '#5b6472',
    text: '#121620',
    tooltipBg: '#ffffff',
    tooltipBorder: '#dde2e9',
    success: '#0f9d6b',
    warning: '#c47d14',
    critical: '#dc5050',
    series: ['#1f6fd6', '#5b6472'],
  },
}

export function getPalette(theme) {
  return CHART_PALETTE[theme] || CHART_PALETTE.dark
}
