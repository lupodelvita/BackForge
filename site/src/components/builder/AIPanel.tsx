import { useState } from 'react'
import { Sparkles, Upload, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const sampleResult = `{
  "tables": [
    {
      "name": "users",
      "fields": [
        { "name": "id", "type": "uuid", "primary_key": true },
        { "name": "email", "type": "text", "unique": true },
        { "name": "name", "type": "text" }
      ]
    },
    {
      "name": "posts",
      "fields": [
        { "name": "id", "type": "uuid", "primary_key": true },
        { "name": "title", "type": "text" },
        { "name": "user_id", "type": "uuid", "foreign_key": "users.id" }
      ]
    }
  ],
  "endpoints": [
    "GET /api/users",
    "POST /api/users",
    "GET /api/posts?user_id="
  ]
}`

export function AIPanel() {
  const [expanded, setExpanded] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleAnalyze = () => {
    setAnalyzing(true)
    setTimeout(() => {
      setAnalyzing(false)
      setResult(sampleResult)
    }, 2000)
  }

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div
      className={cn(
        'border-t border-edge bg-bg-surface/80 backdrop-blur-xl transition-all duration-300',
        expanded ? 'h-80' : 'h-10'
      )}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-10 w-full items-center justify-between px-4 text-sm hover:bg-bg-raised/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-ember" />
          <span className="font-medium text-text-secondary">AI Ассистент</span>
          <Badge variant="ember">Beta</Badge>
        </div>
        {expanded ? (
          <ChevronDown className="size-4 text-text-muted" />
        ) : (
          <ChevronUp className="size-4 text-text-muted" />
        )}
      </button>

      {/* Panel content */}
      {expanded && (
        <div className="flex h-[calc(100%-40px)] gap-3 p-3 animate-fade-in">
          {/* Input */}
          <div className="flex flex-1 flex-col gap-2">
            <Textarea
              placeholder="Вставьте frontend код (React, Vue, Flutter, Swift...) или опишите API, который вам нужен..."
              className="flex-1 text-xs font-mono"
              rows={6}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-bg-root border-t-transparent" />
                    Анализ...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3" />
                    Анализировать
                  </>
                )}
              </Button>
              <Button variant="secondary" size="sm">
                <Upload className="size-3" />
                Загрузить файл
              </Button>
            </div>
          </div>

          {/* Result */}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Результат
              </span>
              {result && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="size-3 text-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? 'Скопировано' : 'Копировать'}
                </button>
              )}
            </div>
            <pre className="flex-1 overflow-auto rounded-lg border border-edge bg-bg-root p-3 text-[11px] font-mono text-text-secondary">
              {analyzing ? (
                <span className="text-ember animate-pulse-glow">
                  Анализируем frontend код...{'\n'}
                  Определяем компоненты и data flow...{'\n'}
                  Генерируем backend схему...
                </span>
              ) : result ? (
                result
              ) : (
                <span className="text-text-muted">
                  Вставьте код или описание для анализа AI
                </span>
              )}
            </pre>
            {result && (
              <Button size="sm" variant="outline" className="self-start">
                Применить к Canvas
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
