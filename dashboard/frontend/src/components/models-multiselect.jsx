import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppStore } from '@/components/app-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Multi-select of model names, populated from the store's `models` list.
// `value` is a string[] of model_name; empty array means "all models" to
// the backend's existing convention — callers decide how to label that.
export function ModelsMultiSelect({ value, onChange, id, disabled }) {
  const { models } = useAppStore()
  const selected = value || []

  const toggle = (name, checked) => {
    if (checked) onChange([...selected, name])
    else onChange(selected.filter((m) => m !== name))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="h-auto min-h-9 w-full justify-between py-1.5 font-normal"
          disabled={disabled}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1 text-left">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">All models</span>
            ) : (
              selected.map((m) => (
                <Badge key={m} variant="outline" className="font-mono text-[11px]">
                  {m}
                </Badge>
              ))
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 w-[--radix-dropdown-menu-trigger-width] overflow-y-auto scrollbar-thin" align="start">
        <DropdownMenuLabel>Models (none selected = all)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {models.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No models available.</p>
        ) : (
          models.map((m) => (
            <DropdownMenuCheckboxItem
              key={m.model_name}
              checked={selected.includes(m.model_name)}
              onCheckedChange={(checked) => toggle(m.model_name, checked)}
              onSelect={(e) => e.preventDefault()}
              className="font-mono text-xs"
            >
              {m.model_name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
