import { useState } from 'react'
import type { CIReport } from '@/types/schema'

interface Props {
  report: CIReport | null
  files: Record<string, string> | null
  onClose: () => void
}

export default function CIReportPanel({ report, files, onClose }: Props) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null)

  if (!report) return null

  const fileList = files ? Object.entries(files) : []

  return (
    <div
      style={{
        background: '#181825',
        borderBottom: '1px solid #313244',
        padding: '10px 16px',
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#cdd6f4',
        flexShrink: 0,
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: report.valid ? '#a6e3a1' : '#f38ba8',
          }}
        >
          {report.valid ? '✓ CI PASS' : '✗ CI FAIL'} — {report.project}
        </span>
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid #45475a',
            borderRadius: 4,
            color: '#6c7086',
            cursor: 'pointer',
            padding: '2px 8px',
            fontFamily: 'monospace',
            fontSize: 11,
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Checks */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {report.checks.map((check) => (
          <span
            key={check.name}
            title={check.message}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: check.passed ? '#1e3a2e' : '#3a1e1e',
              border: `1px solid ${check.passed ? '#a6e3a1' : '#f38ba8'}44`,
              color: check.passed ? '#a6e3a1' : '#f38ba8',
              fontSize: 11,
              cursor: 'default',
            }}
          >
            {check.passed ? '✓' : '✗'} {check.name}
          </span>
        ))}
      </div>

      {/* Failed check messages */}
      {report.checks.filter((c) => !c.passed).map((check) => (
        <div
          key={check.name}
          style={{
            padding: '4px 8px',
            marginBottom: 4,
            background: '#2a1e1e',
            border: '1px solid #f38ba844',
            borderRadius: 4,
            color: '#f38ba8',
            fontSize: 11,
          }}
        >
          <strong>{check.name}:</strong> {check.message}
        </div>
      ))}

      {/* Generated files */}
      {fileList.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: '#89dceb', fontWeight: 700, marginBottom: 4 }}>
            Generated files ({fileList.length})
          </div>
          {fileList.map(([filename, content]) => (
            <div key={filename} style={{ marginBottom: 4 }}>
              <button
                onClick={() => setExpandedFile(expandedFile === filename ? null : filename)}
                style={{
                  background: '#1e1e2e',
                  border: '1px solid #313244',
                  borderRadius: 4,
                  color: '#89b4fa',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: 11,
                  padding: '3px 8px',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {expandedFile === filename ? '▾' : '▸'} {filename}
              </button>
              {expandedFile === filename && (
                <pre
                  style={{
                    background: '#11111b',
                    border: '1px solid #313244',
                    borderRadius: 4,
                    color: '#cdd6f4',
                    fontSize: 10,
                    margin: '2px 0 0 0',
                    overflowX: 'auto',
                    padding: '6px 10px',
                    maxHeight: 160,
                    overflowY: 'auto',
                  }}
                >
                  {content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
