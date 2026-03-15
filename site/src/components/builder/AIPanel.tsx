import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Sparkles, Upload, ChevronUp, ChevronDown, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { analyzerApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'
import type { ProjectState, AnalyzerLanguage } from '@/lib/types'

const LANGUAGES: AnalyzerLanguage[] = ['typescript', 'javascript', 'python', 'dart', 'swift', 'kotlin']

interface AIPanelProps {
  projectState?: ProjectState
  onApply?: (state: ProjectState) => void
}

export function AIPanel({ onApply }: AIPanelProps) {
  const { t } = useTranslation()
  const { currentProject } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState<AnalyzerLanguage>('typescript')
  const [useAI, setUseAI] = useState(true)
  const [copied, setCopied] = useState(false)

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const res = await analyzerApi.analyze({
        code,
        language,
        project_name: currentProject ?? 'unnamed',
        use_ai: useAI,
      })
      return res.data
    },
  })

  const handleCopy = () => {
    if (analysisMutation.data) {
      navigator.clipboard.writeText(JSON.stringify(analysisMutation.data.result, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const handleApply = () => {
    if (analysisMutation.data?.project_state_json && onApply) {
      onApply(analysisMutation.data.project_state_json)
    }
  }

  const result = analysisMutation.data

  return (
    <div className={cn('border-t border-edge bg-bg-surface/80 backdrop-blur-xl transition-all duration-300', expanded ? 'h-80' : 'h-10')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-10 w-full items-center justify-between px-4 text-sm hover:bg-bg-raised/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-ember" />
          <span className="font-medium text-text-secondary">AI {t('builder.ai')}</span>
          <Badge variant="ember">Beta</Badge>
          {result && (
            <Badge variant="success" className="text-[10px]">
              {result.result.confidence * 100 | 0}% confidence
            </Badge>
          )}
        </div>
        {expanded ? <ChevronDown className="size-4 text-text-muted" /> : <ChevronUp className="size-4 text-text-muted" />}
      </button>

      {expanded && (
        <div className="flex h-[calc(100%-40px)] gap-3 p-3 animate-fade-in">
          {/* Input */}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as AnalyzerLanguage)}
                className="rounded border border-edge bg-bg-raised px-2 py-1 text-xs text-text-primary"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="accent-accent"
                />
                AI (Ollama)
              </label>
            </div>
            <Textarea
              placeholder={t('builder.analyzePrompt')}
              className="flex-1 text-xs font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={5}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => analysisMutation.mutate()}
                disabled={analysisMutation.isPending || !code.trim()}
              >
                {analysisMutation.isPending
                  ? <><Loader2 className="size-3 animate-spin" />{t('builder.analyzing')}</>
                  : <><Sparkles className="size-3" />{t('builder.analyzeCode')}</>}
              </Button>
              <Button variant="secondary" size="sm" disabled>
                <Upload className="size-3" />
                Upload
              </Button>
            </div>
          </div>

          {/* Result */}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Result</span>
              {result && (
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                  {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                  {copied ? t('common.success') : t('common.copy')}
                </button>
              )}
            </div>
            <pre className="flex-1 overflow-auto rounded-lg border border-edge bg-bg-root p-3 text-[11px] font-mono text-text-secondary">
              {analysisMutation.isPending
                ? <span className="text-ember animate-pulse">Analyzing frontend code...</span>
                : analysisMutation.isError
                  ? <span className="text-red-400">{(analysisMutation.error as Error).message}</span>
                  : result
                    ? JSON.stringify(result.result, null, 2)
                    : <span className="text-text-muted">{t('builder.analyzePrompt')}</span>}
            </pre>
            {result?.project_state_json && onApply && (
              <Button size="sm" variant="outline" className="self-start" onClick={handleApply}>
                {t('builder.applyToCanvas')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
