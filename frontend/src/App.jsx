import { useState, useEffect, useRef } from 'react'
import {
  Brain, Upload, Search, Zap, Network, Globe, MapPin,
  Layers, Shuffle, FileText, CheckCircle, AlertCircle,
  ChevronRight, Clock, BarChart3, X, Plus
} from 'lucide-react'
import './App.css'

const API = import.meta.env.VITE_API_URL || ''

const MODE_CONFIG = {
  naive:  { icon: Search,   color: '#ff6b6b', label: 'Naive',  desc: 'Pure vector search' },
  local:  { icon: MapPin,   color: '#ffa94d', label: 'Local',  desc: 'Entity + neighbors' },
  global: { icon: Globe,    color: '#74c0fc', label: 'Global', desc: 'Community summaries' },
  hybrid: { icon: Layers,   color: '#b197fc', label: 'Hybrid', desc: 'Detail + big-picture' },
  mix:    { icon: Shuffle,  color: '#69db7c', label: 'Mix',    desc: 'All strategies merged' },
}

export default function App() {
  const [tab, setTab] = useState('query')
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState('mix')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [ingestedFiles, setIngestedFiles] = useState([])
  const [uploadStatus, setUploadStatus] = useState(null)
  const [rawText, setRawText] = useState('')
  const [rawLabel, setRawLabel] = useState('my_document.txt')
  const [history, setHistory] = useState([])
  const fileRef = useRef()

  useEffect(() => {
    fetchStats()
    fetchFiles()
  }, [])

  async function fetchStats() {
    try {
      const r = await fetch(`${API}/api/graph-stats`)
      if (r.ok) setStats(await r.json())
    } catch {}
  }

  async function fetchFiles() {
    try {
      const r = await fetch(`${API}/api/ingested-files`)
      if (r.ok) {
        const d = await r.json()
        setIngestedFiles(d.files)
      }
    } catch {}
  }

  async function handleQuery(e) {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const r = await fetch(`${API}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, mode }),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.detail || 'Query failed')
      }
      const data = await r.json()
      setAnswer(data)
      setHistory(h => [{ ...data, ts: Date.now() }, ...h.slice(0, 9)])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      fetchStats()
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadStatus({ loading: true, message: `Ingesting ${file.name}…` })
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await fetch(`${API}/api/ingest`, { method: 'POST', body: form })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.detail || 'Upload failed')
      }
      const data = await r.json()
      setUploadStatus({ success: true, message: `✓ Ingested ${data.file} (${data.words.toLocaleString()} words)` })
      fetchStats()
      fetchFiles()
    } catch (err) {
      setUploadStatus({ error: true, message: err.message })
    }
  }

  async function handleRawIngest() {
    if (rawText.trim().split(' ').length < 10) {
      setUploadStatus({ error: true, message: 'Text too short — needs at least 10 words.' })
      return
    }
    setUploadStatus({ loading: true, message: 'Ingesting text…' })
    try {
      const r = await fetch(`${API}/api/ingest-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, label: rawLabel }),
      })
      if (!r.ok) {
        const err = await r.json()
        throw new Error(err.detail || 'Ingestion failed')
      }
      const data = await r.json()
      setUploadStatus({ success: true, message: `✓ Ingested "${data.label}" (${data.words.toLocaleString()} words)` })
      setRawText('')
      fetchStats()
      fetchFiles()
    } catch (err) {
      setUploadStatus({ error: true, message: err.message })
    }
  }

  return (
    <div className="app">
      {/* Ambient glow */}
      <div className="ambient" />

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <Brain size={22} />
            <span>LightRAG</span>
            <span className="badge">GraphRAG</span>
          </div>
          <nav className="nav">
            {['query', 'ingest', 'stats'].map(t => (
              <button key={t} className={`nav-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
          <div className="header-stats">
            {stats && (
              <>
                <Stat label="nodes" value={stats.nodes} />
                <Stat label="edges" value={stats.edges} />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        {tab === 'query' && (
          <QueryTab
            question={question} setQuestion={setQuestion}
            mode={mode} setMode={setMode}
            loading={loading} error={error} answer={answer}
            onSubmit={handleQuery} history={history}
            onHistoryClick={(q) => { setQuestion(q.question); setMode(q.mode); setAnswer(q) }}
          />
        )}
        {tab === 'ingest' && (
          <IngestTab
            fileRef={fileRef}
            onFile={handleFileUpload}
            rawText={rawText} setRawText={setRawText}
            rawLabel={rawLabel} setRawLabel={setRawLabel}
            onRawIngest={handleRawIngest}
            uploadStatus={uploadStatus}
            files={ingestedFiles}
          />
        )}
        {tab === 'stats' && <StatsTab stats={stats} onRefresh={() => { fetchStats(); fetchFiles() }} />}
      </main>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="hstat">
      <span className="hstat-val">{value}</span>
      <span className="hstat-label">{label}</span>
    </div>
  )
}

/* ── Query Tab ─────────────────────────────────────────────── */
function QueryTab({ question, setQuestion, mode, setMode, loading, error, answer, onSubmit, history, onHistoryClick }) {
  return (
    <div className="query-layout">
      <div className="query-main">
        <div className="page-title">
          <h1>Knowledge Graph Query</h1>
          <p>Ask questions that span your entire document corpus</p>
        </div>

        <form onSubmit={onSubmit} className="query-form">
          <div className="input-wrap">
            <textarea
              className="q-input"
              placeholder="What relationships exist between the entities in your documents? How do X and Y connect?…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit(e) }}
            />
            <div className="input-hint">⌘ + Enter to submit</div>
          </div>

          <div className="mode-grid">
            {Object.entries(MODE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button
                  key={key}
                  type="button"
                  className={`mode-card ${mode === key ? 'selected' : ''}`}
                  style={{ '--mc': cfg.color }}
                  onClick={() => setMode(key)}
                >
                  <Icon size={16} />
                  <span className="mode-name">{cfg.label}</span>
                  <span className="mode-desc">{cfg.desc}</span>
                </button>
              )
            })}
          </div>

          <button type="submit" className="submit-btn" disabled={loading || !question.trim()}>
            {loading ? (
              <><span className="spinner" /> Traversing graph…</>
            ) : (
              <><Zap size={16} /> Query Knowledge Graph</>
            )}
          </button>
        </form>

        {error && (
          <div className="msg error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {answer && (
          <div className="answer-card">
            <div className="answer-header">
              <div className="answer-mode" style={{ '--mc': MODE_CONFIG[answer.mode]?.color || '#6c63ff' }}>
                <span>Mode: {answer.mode}</span>
              </div>
              <div className="answer-meta">
                <Clock size={12} /> {answer.elapsed_ms}ms
              </div>
            </div>
            <div className="answer-q">Q: {answer.question}</div>
            <div className="answer-body">{answer.answer}</div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <aside className="history-panel">
          <div className="panel-title">Recent Queries</div>
          {history.map((h, i) => (
            <button key={i} className="history-item" onClick={() => onHistoryClick(h)}>
              <div className="hi-q">{h.question.slice(0, 60)}{h.question.length > 60 ? '…' : ''}</div>
              <div className="hi-meta">
                <span className="hi-mode" style={{ color: MODE_CONFIG[h.mode]?.color }}>{h.mode}</span>
                <span>{h.elapsed_ms}ms</span>
              </div>
            </button>
          ))}
        </aside>
      )}
    </div>
  )
}

/* ── Ingest Tab ────────────────────────────────────────────── */
function IngestTab({ fileRef, onFile, rawText, setRawText, rawLabel, setRawLabel, onRawIngest, uploadStatus, files }) {
  return (
    <div className="ingest-layout">
      <div className="page-title">
        <h1>Ingest Documents</h1>
        <p>Add text to your knowledge graph — entities and relationships are extracted automatically</p>
      </div>

      <div className="ingest-grid">
        {/* File Upload */}
        <div className="ingest-card">
          <div className="card-title"><Upload size={16} /> Upload .txt File</div>
          <div
            className="drop-zone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { fileRef.current.files = e.dataTransfer.files; onFile({ target: { files: [f] } }) } }}
          >
            <FileText size={32} className="dz-icon" />
            <p>Drop a .txt file here<br /><span>or click to browse</span></p>
          </div>
          <input ref={fileRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={onFile} />
        </div>

        {/* Raw Text */}
        <div className="ingest-card">
          <div className="card-title"><Plus size={16} /> Paste Raw Text</div>
          <input
            className="label-input"
            placeholder="Document label (e.g. my_doc.txt)"
            value={rawLabel}
            onChange={e => setRawLabel(e.target.value)}
          />
          <textarea
            className="raw-input"
            placeholder="Paste your document text here…"
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={8}
          />
          <button className="submit-btn sm" onClick={onRawIngest} disabled={!rawText.trim()}>
            <Zap size={14} /> Ingest Text
          </button>
        </div>
      </div>

      {uploadStatus && (
        <div className={`msg ${uploadStatus.error ? 'error' : uploadStatus.success ? 'success' : 'info'}`}>
          {uploadStatus.success ? <CheckCircle size={16} /> : uploadStatus.error ? <AlertCircle size={16} /> : <span className="spinner" />}
          <span>{uploadStatus.message}</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="file-list">
          <div className="panel-title">Ingested Files</div>
          <div className="file-grid">
            {files.map(f => (
              <div key={f} className="file-item">
                <FileText size={14} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Stats Tab ─────────────────────────────────────────────── */
function StatsTab({ stats, onRefresh }) {
  return (
    <div className="stats-layout">
      <div className="page-title">
        <h1>Graph Statistics</h1>
        <p>Live view of your knowledge graph</p>
        <button className="refresh-btn" onClick={onRefresh}><Zap size={14} /> Refresh</button>
      </div>

      {stats ? (
        <div className="stats-grid">
          <StatCard label="Graph Nodes" value={stats.nodes} icon={Network} color="#6c63ff" desc="Named entities extracted" />
          <StatCard label="Graph Edges" value={stats.edges} icon={ChevronRight} color="#00d4aa" desc="Relationships discovered" />
          <StatCard label="Text Chunks" value={stats.chunks} icon={FileText} color="#ffa94d" desc="Vectorized passages" />
          <StatCard label="Graph Size" value={`${stats.graph_file_size_kb} KB`} icon={BarChart3} color="#ff6b6b" desc="GraphML file on disk" />
        </div>
      ) : (
        <div className="msg info"><span className="spinner" /> Loading stats…</div>
      )}

      <div className="arch-card">
        <div className="card-title"><Network size={16} /> Architecture</div>
        <div className="arch-flow">
          {['Your .txt Files', 'Gemini 2.5 Flash (extraction)', 'Knowledge Graph (GraphML)', 'NanoVectorDB (embeddings)', 'LightRAG Engine', 'Final Answer'].map((step, i, arr) => (
            <div key={i} className="arch-step-wrap">
              <div className="arch-step">{step}</div>
              {i < arr.length - 1 && <div className="arch-arrow">↓</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="mode-table">
        <div className="card-title"><Zap size={16} /> Query Modes</div>
        <table>
          <thead><tr><th>Mode</th><th>Strategy</th><th>Best For</th></tr></thead>
          <tbody>
            <tr><td><span style={{color:'#ff6b6b'}}>naive</span></td><td>Vector search only</td><td>Simple factual lookups, baseline comparison</td></tr>
            <tr><td><span style={{color:'#ffa94d'}}>local</span></td><td>Entity + graph neighbors</td><td>Questions about specific people, places, concepts</td></tr>
            <tr><td><span style={{color:'#74c0fc'}}>global</span></td><td>Community summaries</td><td>Broad themes, document overview</td></tr>
            <tr><td><span style={{color:'#b197fc'}}>hybrid</span></td><td>Local + global combined</td><td>Needs detail AND context</td></tr>
            <tr><td><span style={{color:'#69db7c'}}>mix</span></td><td>Everything merged</td><td>Unknown query type (recommended default)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, desc }) {
  return (
    <div className="stat-card" style={{ '--sc': color }}>
      <div className="sc-icon"><Icon size={20} /></div>
      <div className="sc-val">{value}</div>
      <div className="sc-label">{label}</div>
      <div className="sc-desc">{desc}</div>
    </div>
  )
}
