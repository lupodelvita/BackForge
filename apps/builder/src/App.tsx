import { useState } from 'react'
import { useBuilderStore, useProjectApi } from '@/store'
import { nanoid } from '@/store/utils'
import BuilderCanvas from '@/components/canvas/BuilderCanvas'
import TablePanel from '@/components/panels/TablePanel'
import CIReportPanel from '@/components/panels/CIReportPanel'

const appStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: '#11111b',
  color: '#cdd6f4',
  fontFamily: 'monospace',
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 16px',
  background: '#1e1e2e',
  borderBottom: '1px solid #313244',
  flexShrink: 0,
}

const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
}

export default function App() {
  const { project, isDirty, addTable, markSaved } = useBuilderStore()
  const {
    loading, generateLoading, migrateLoading, error,
    ciReport, generateFiles,
    analyzeCode, saveProject, generateAll, validateCI, runMigrations, clearCIReport,
  } = useProjectApi()

  const [showAnalyzer, setShowAnalyzer] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [filenameInput, setFilenameInput] = useState('App.tsx')
  const [newTableName, setNewTableName] = useState('')

  const handleAnalyze = async () => {
    const result = await analyzeCode(codeInput, filenameInput)
    if (result) {
      useBuilderStore.getState().setProject(result)
      setShowAnalyzer(false)
    }
  }

  const handleSave = async () => {
    if (!project) return
    const ok = await saveProject(project)
    if (ok) markSaved()
  }

  const handleGenerateAll = async () => {
    if (!project) return
    await generateAll(project)
  }

  const handleValidateCI = async () => {
    if (!project) return
    await validateCI(project)
  }

  const handleMigrate = async () => {
    if (!project) return
    await runMigrations(project.meta.name)
  }

  const handleAddTable = () => {
    const name = newTableName.trim()
    if (!name) return
    // Init empty project if needed
    if (!project) {
      useBuilderStore.getState().setProject({
        meta: { id: nanoid(), name: 'untitled', description: null, version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        schema: { tables: [] },
      })
    }
    addTable(name)
    setNewTableName('')
  }

  return (
    <div style={appStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <span style={{ fontWeight: 700, color: '#89dceb', fontSize: 14 }}>BackForge Builder</span>
        <span style={{ color: '#45475a' }}>|</span>

        {project && (
          <span style={{ color: '#6c7086', fontSize: 11 }}>
            {project.meta.name}
            {isDirty && <span style={{ color: '#f9e2af', marginLeft: 4 }}>●</span>}
          </span>
        )}

        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          {/* New table */}
          <input
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTable()}
            placeholder="table_name"
            style={{
              background: '#313244', border: '1px solid #45475a', borderRadius: 4,
              color: '#cdd6f4', padding: '4px 8px', fontFamily: 'monospace', fontSize: 12, width: 120,
            }}
          />
          <ToolbarBtn onClick={handleAddTable} color="#a6e3a1">+ Table</ToolbarBtn>

          <ToolbarBtn onClick={() => setShowAnalyzer(!showAnalyzer)} color="#cba6f7">
            ⚡ Analyze
          </ToolbarBtn>

          {project && (
            <ToolbarBtn onClick={handleSave} color="#89b4fa" disabled={loading || !isDirty}>
              {loading ? '…' : '💾 Save'}
            </ToolbarBtn>
          )}

          {project && (
            <ToolbarBtn onClick={handleGenerateAll} color="#a6e3a1" disabled={generateLoading}>
              {generateLoading ? '…' : '⚙ Generate'}
            </ToolbarBtn>
          )}

          {project && (
            <ToolbarBtn onClick={handleValidateCI} color="#f9e2af" disabled={loading}>
              {loading ? '…' : '✓ CI Check'}
            </ToolbarBtn>
          )}

          {project && (
            <ToolbarBtn onClick={handleMigrate} color="#cba6f7" disabled={migrateLoading}>
              {migrateLoading ? '…' : '🗄 Migrate'}
            </ToolbarBtn>
          )}
        </div>
      </div>

      {/* CI Report panel */}
      {ciReport && (
        <CIReportPanel report={ciReport} files={generateFiles} onClose={clearCIReport} />
      )}

      {/* Analyzer drawer */}
      {showAnalyzer && (
        <div
          style={{
            background: '#181825', borderBottom: '1px solid #313244',
            padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start', flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <input
              value={filenameInput}
              onChange={(e) => setFilenameInput(e.target.value)}
              placeholder="filename.tsx"
              style={{
                background: '#313244', border: '1px solid #45475a', borderRadius: 4,
                color: '#cdd6f4', padding: '4px 8px', fontFamily: 'monospace', fontSize: 12,
                width: 200, marginBottom: 8, display: 'block',
              }}
            />
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Paste your frontend code here..."
              rows={6}
              style={{
                width: '100%', background: '#313244', border: '1px solid #45475a', borderRadius: 4,
                color: '#cdd6f4', padding: '6px 8px', fontFamily: 'monospace', fontSize: 11,
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ToolbarBtn onClick={handleAnalyze} color="#cba6f7" disabled={loading || !codeInput.trim()}>
              {loading ? 'Analyzing…' : 'Run'}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => setShowAnalyzer(false)} color="#6c7086">
              Cancel
            </ToolbarBtn>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{ background: '#45475a', color: '#f38ba8', padding: '6px 16px', fontSize: 12, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Main workspace */}
      <div style={mainStyle}>
        <BuilderCanvas />
        <TablePanel />
      </div>
    </div>
  )
}

function ToolbarBtn({
  children, onClick, color, disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  color: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: '#313244', border: `1px solid ${color}44`, borderRadius: 4, color,
        padding: '4px 10px', fontFamily: 'monospace', fontSize: 12,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  )
}
