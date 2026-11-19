import * as React from 'react'
import { Loader2, Play, TerminalSquare, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { runTest } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { formatMs, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const DEFAULT_PROMPT = 'Hello, who are you?'

export function Playground() {
  const { models, selectedModel } = useAppStore()

  const [model, setModel] = React.useState('')
  const [kind, setKind] = React.useState('chat')
  const [prompt, setPrompt] = React.useState(DEFAULT_PROMPT)
  const [maxTokens, setMaxTokens] = React.useState(256)

  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState(null)
  const [showRaw, setShowRaw] = React.useState(false)

  // Preselect the model handed off from the Infrastructure page, once.
  React.useEffect(() => {
    if (selectedModel) {
      setModel(selectedModel)
    }
  }, [selectedModel])

  React.useEffect(() => {
    if (!model && models.length > 0) {
      setModel(models[0].model_name)
    }
  }, [models, model])

  const onRun = async () => {
    if (!model || running) return
    setRunning(true)
    setResult(null)
    try {
      const res = await runTest({
        model,
        kind,
        prompt,
        max_tokens: kind === 'chat' ? Number(maxTokens) || 256 : undefined,
      })
      setResult(res)
    } catch (err) {
      setResult({ ok: false, error: err.message || 'Request failed.' })
    } finally {
      setRunning(false)
    }
  }

  const usage = result?.usage || {}

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pg-model">
                Model
              </label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="pg-model" aria-label="Model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.model_name} value={m.model_name}>
                      {m.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Kind</span>
              <Tabs value={kind} onValueChange={setKind}>
                <TabsList>
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="embedding">Embedding</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="pg-prompt">
              Prompt
            </label>
            <Textarea
              id="pg-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type a prompt to send through the gateway…"
              rows={5}
            />
          </div>

          {kind === 'chat' && (
            <div className="max-w-[180px] space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pg-max-tokens">
                Max tokens
              </label>
              <Input
                id="pg-max-tokens"
                type="number"
                min={1}
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
              />
            </div>
          )}

          <Button onClick={onRun} disabled={!model || running}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? 'Running…' : 'Run'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {!result ? (
            <EmptyState
              icon={TerminalSquare}
              title="No test run yet"
              description="Pick a model and hit Run to send a live request through the gateway."
              className="py-10"
            />
          ) : result.ok ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">ok</Badge>
                <Badge variant="outline">latency {formatMs(result.latency_ms)}</Badge>
                {usage.prompt_tokens != null && (
                  <Badge variant="outline">prompt {formatNumber(usage.prompt_tokens)}</Badge>
                )}
                {usage.completion_tokens != null && (
                  <Badge variant="outline">
                    completion {formatNumber(usage.completion_tokens)}
                  </Badge>
                )}
                {usage.total_tokens != null && (
                  <Badge variant="outline">total {formatNumber(usage.total_tokens)}</Badge>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Response
                </p>
                <div className="whitespace-pre-wrap rounded-md border border-border bg-elevated/50 p-3 text-sm text-foreground">
                  {result.text || '—'}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  aria-expanded={showRaw}
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showRaw && 'rotate-180')} />
                  Raw response
                </button>
                {showRaw && (
                  <pre className="scrollbar-thin mt-1.5 max-h-80 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
                    {JSON.stringify(result.raw ?? result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-critical/40 bg-critical/10 p-3">
              <p className="text-sm font-medium text-critical">Request failed</p>
              <p className="mt-1 text-sm text-critical/90">{result.error || 'Unknown error.'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
