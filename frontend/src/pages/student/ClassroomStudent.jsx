import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'
import { askAboutTranscription, partialSummary } from '../../services/geminiService'

const QUICK_BUTTONS = [
  { id: 'stop',   label: '✋ ¿Puede parar, profesor?' },
  { id: 'repeat', label: '🔄 ¿Puede repetir?' },
  { id: 'slower', label: '🐢 ¿Puede ir más despacio?' },
  { id: 'ok',     label: '✅ Entendido' },
]

export default function ClassroomStudent({ classId }) {
  const {
    currentUser, users, courses,
    getClassById, getCourseById,
    sendQuestion, leaveClass, setActivePage, setActiveClassId,
    respondAttentionCheck,
  } = useApp()

  // Poll for live updates every 2s
  const { classes } = useApp()
  const cls    = getClassById(classId)
  const course = cls ? getCourseById(cls.courseId) : null

  const [chatInput, setChatInput]   = useState('')
  const [showAI, setShowAI]         = useState(false)
  const [aiMessages, setAiMessages] = useState([])
  const [aiInput, setAiInput]       = useState('')
  const [isAIActive, setIsAIActive] = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const chatEndRef = useRef(null)

  // Attention check state
  const [acRespondedIds, setAcRespondedIds] = useState(new Set())
  const [acToast, setAcToast]               = useState(null)
  const [acCountdown, setAcCountdown]       = useState(0)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [cls?.transcription?.length, setActivePage]) // Assuming activePage is a dependency for chat auto-scroll, though it's not directly used in the scroll logic. If it's meant to trigger scroll on page change, it's fine.
  const [elapsed, setElapsed]       = useState(0)

  const transcriptBottomRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [cls?.transcription?.length])

  // EF-10 Adjustment: Auto-expel if teacher ends class
  useEffect(() => {
    if (cls && !cls.isActive) {
      alert('La clase ha sido finalizada por el profesor.')
      setActiveClassId(null)
      setActivePage('dashboard')
    }
  }, [cls?.isActive, setActiveClassId, setActivePage])

  // RF-11: Detect active attention check
  const activeCheck = (cls?.attentionChecks || []).find(ac => ac.status === 'active')
  const myCheckId = activeCheck ? (activeCheck._id || activeCheck.id) : null
  const myResponse = activeCheck?.responses?.find(r => String(r.userId) === String(currentUser?.id))
  const showCheckOverlay = activeCheck && myResponse && !myResponse.responded && !acRespondedIds.has(myCheckId)

  // Countdown timer for attention check
  useEffect(() => {
    if (!showCheckOverlay || !activeCheck) return
    const launched = new Date(activeCheck.launchedAt).getTime()
    const timeout = (activeCheck.timeoutSecs || 30) * 1000

    const tick = () => {
      const remaining = Math.max(0, (launched + timeout - Date.now()) / 1000)
      setAcCountdown(remaining)
      if (remaining <= 0) {
        setAcRespondedIds(prev => new Set(prev).add(myCheckId))
        setAcToast({ type: 'fail', text: '❌ No respondiste a tiempo' })
        setTimeout(() => setAcToast(null), 3000)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [showCheckOverlay, activeCheck, myCheckId])

  const handleRespondCheck = async () => {
    if (!activeCheck || !myCheckId) return
    setAcRespondedIds(prev => new Set(prev).add(myCheckId))
    const res = await respondAttentionCheck(classId, myCheckId, currentUser.id)
    if (res.success) {
      setAcToast({ type: 'success', text: '✅ ¡Atención confirmada!' })
    } else {
      setAcToast({ type: 'fail', text: res.error || '❌ Error al responder' })
    }
    setTimeout(() => setAcToast(null), 3000)
  }

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleSendMessage = (text) => {
    if (!text.trim()) return
    sendQuestion(classId, currentUser.id, text.trim(), false)
    setChatInput('')
  }

  const handleQuickReply = (label) => {
    sendQuestion(classId, currentUser.id, label, true)
  }

  const handleLeave = () => {
    leaveClass(classId, currentUser.id)
    setActiveClassId(null)
    setActivePage('dashboard')
  }

  const getFullText = () => (cls?.transcription || []).map(s => s.text).join(' ')

  const handleAISummary = async () => {
    const text = getFullText()
    if (!text) { alert('Aún no hay transcripción disponible.'); return }
    setShowAI(true)
    setAiLoading(true)
    setAiMessages(prev => [...prev, { role: 'user', text: '📋 ¿Puedes hacer un resumen de lo explicado?' }])
    const res = await partialSummary(text)
    setAiMessages(prev => [...prev, { role: 'ai', text: res }])
    setAiLoading(false)
  }

  const handleAIAsk = async () => {
    if (!aiInput.trim()) return
    const q = aiInput.trim()
    setAiInput('')
    setShowAI(true)
    setAiMessages(prev => [...prev, { role: 'user', text: q }])
    setAiLoading(true)
    const res = await askAboutTranscription(getFullText(), q)
    setAiMessages(prev => [...prev, { role: 'ai', text: res }])
    setAiLoading(false)
  }

  if (!cls) return <div style={{ padding: 40 }}>Clase no encontrada o ya finalizada.</div>

  const teacher      = users.find(u => u.id === course?.teacherId)
  const participants = (cls.participantIds || []).map(id => users.find(u => u.id === id)).filter(Boolean)
  const myMessages   = (cls.questions || []).filter(q => q.userId === currentUser.id)

  return (
    <div style={{ height: 'calc(100vh - 20px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div className="class-topbar">
        <div className="class-topbar-left">
          <div className="logo-mark">🎓</div>
          <div>
            <div className="class-topbar-name">{course?.name || 'Clase'}</div>
            <div className="class-topbar-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="badge badge-live" style={{ fontSize: 9 }}>● EN VIVO</span>
              <span>{cls.title} · {fmt(elapsed)}</span>
            </div>
          </div>
        </div>
        <div className="class-topbar-right">
          <button className="btn btn-sm btn-outline" onClick={() => setShowAI(v => !v)}>🤖 IA</button>
          <button className="btn btn-danger" onClick={handleLeave}>↩ Salir</button>
        </div>
      </div>

      <div className="classroom-layout" style={{ flex: 1 }}>
        {/* Main area */}
        <div className="classroom-main">
          {/* Video/presenter area */}
          <div className="video-area" style={{ minHeight: 220 }}>
            {teacher && (
              <div className="video-overlay-info">
                <Avatar user={teacher} size="sm" />
                <div>
                  <div className="prof-name">{teacher.name}</div>
                  <div className="prof-sub">Profesor · En Vivo</div>
                </div>
              </div>
            )}
            <div className="video-placeholder">
              <div className="video-placeholder-icon">🎓</div>
              <div className="video-placeholder-text">Sesión en progreso</div>
            </div>
          </div>

          {/* Real-time transcription — READ ONLY */}
          <div className="transcription-panel">
            <div className="transcription-header">
              <div className="transcription-title">
                <span style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>📝</span>
                Transcripción en Tiempo Real
                {cls.isActive && <span style={{ animation: 'pulse 1s infinite', color: 'var(--success)', fontSize: 12 }}>● en vivo</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {(cls.transcription || []).length} segmentos
              </div>
            </div>

            <div className="transcription-body">
              {(cls.transcription || []).length === 0 ? (
                <div className="transcript-empty">
                  El profesor aún no ha iniciado la transcripción. Aparecerá aquí en tiempo real.
                </div>
              ) : (
                (cls.transcription || []).map(seg => (
                  <div className="transcript-segment" key={seg.id}>
                    <span className="transcript-time">{seg.timestamp}</span>
                    <span className="transcript-text">{seg.text}</span>
                  </div>
                ))
              )}
              <div ref={transcriptBottomRef} />
            </div>
          </div>

          {/* AI Panel */}
          {showAI && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="ai-panel">
                <div className="ai-panel-header">
                  <div className="ai-panel-title">🤖 Asistente IA — Ayuda con la clase</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAI(false)}>✕</button>
                </div>
                <div className="ai-panel-body">
                  {aiMessages.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                      Puedo ayudarte a entender la transcripción. ¡Pregúntame algo!
                    </div>
                  )}
                  {aiMessages.map((m, i) => (
                    <div key={i} className={`ai-message ${m.role}`}>
                      {m.role === 'ai' ? <><strong>🤖 IA:</strong> {m.text}</> : <><strong>👤 Tú:</strong> {m.text}</>}
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="ai-message loading">
                      <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Procesando…</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: '8px 18px', display: 'flex', gap: 6, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                  <button className="btn btn-sm btn-outline" onClick={handleAISummary}>📋 Resumen</button>
                </div>
                <div className="ai-input-row">
                  <input className="form-input" style={{ flex: 1 }} placeholder="¿Qué significa...? ¿Puedes explicar...?" value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAIAsk()} />
                  <button className="chat-send-btn" onClick={handleAIAsk}>➤</button>
                </div>
              </div>
            </div>
          )}

          {/* Status bar */}
          <div className="status-bar">
            <div className="status-dot">Conectado · sincronización automática activa</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span>⏱️ {fmt(elapsed)}</span>
              <span>👥 {participants.length} conectados</span>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="classroom-sidebar">
          {/* Participants */}
          <div className="participants-panel">
            <div className="participants-header">
              <div className="participants-title">👥 Participantes</div>
              <span className="participants-count">{participants.length}</span>
            </div>
            <div className="participants-list">
              {teacher && (
                <div className="participant-item">
                  <Avatar user={teacher} size="sm" />
                  <div className="participant-info">
                    <div className="participant-name">{teacher.name}</div>
                    <div className="participant-sub">Host · Profesor</div>
                  </div>
                  <div className="participant-icons">🎤 📹</div>
                </div>
              )}
              {participants.map(u => (
                <div key={u.id} className="participant-item">
                  <Avatar user={u} size="sm" />
                  <div className="participant-info">
                    <div className="participant-name">{u.name}</div>
                    <div className="participant-sub" style={{ color: u.id === currentUser.id ? 'var(--primary)' : undefined }}>
                      {u.id === currentUser.id ? '(Tú)' : 'Estudiante'}
                    </div>
                  </div>
                  <div className="participant-icons">🎤</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat / Quick Replies */}
          <div className="chat-panel">
            <div className="chat-title">💬 Chat Rápido</div>

            {/* Quick reply buttons */}
            <div className="quick-replies">
              {QUICK_BUTTONS.map(btn => (
                <button key={btn.id} className="quick-reply-btn" onClick={() => handleQuickReply(btn.label)}>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Message history */}
            <div className="chat-messages">
              {/* Professor Transcription History Simulation */}
              {(cls.transcription || []).map((seg, idx) => (
                <div key={`trans-${idx}`} style={{ fontSize: 13, marginBottom: 4, color: 'var(--text-main)', paddingLeft: 8, borderLeft: '2px solid var(--primary)' }}>
                  • {seg.text}
                </div>
              ))}
              {(cls.questions || []).length === 0 && (cls.transcription || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                  Usa los botones rápidos o escribe un mensaje
                </div>
              ) : (cls.questions || []).slice().reverse().map(q => (
                <div key={q.id} className="chat-message">
                  <div className="chat-message-header">
                    <span className="chat-message-name">{q.userName}</span>
                    <span className="chat-message-time">{new Date(q.sentAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    {q.status === 'answered' && <span className="badge badge-success" style={{ fontSize: 9 }}>✓</span>}
                  </div>
                  <div className={`chat-message-bubble ${q.isQuickReply ? 'quick-reply' : ''}`}>
                    {q.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Custom message */}
            <div className="chat-input-row">
              <input
                className="chat-input"
                placeholder="Escribe una pregunta..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage(chatInput)}
              />
              <button className="chat-send-btn" onClick={() => handleSendMessage(chatInput)}>➤</button>
            </div>
          </div>
        </div>
      </div>

      {/* RF-11: Attention Check Overlay */}
      {showCheckOverlay && (() => {
        const timeout = activeCheck.timeoutSecs || 30
        const circumference = 2 * Math.PI * 45
        const offset = circumference * (1 - acCountdown / timeout)
        const colorClass = acCountdown <= 5 ? 'danger' : acCountdown <= 10 ? 'warning' : ''
        return (
          <div className="attention-overlay">
            <div className="attention-modal">
              <div className="attention-icon">🎯</div>
              <div className="attention-title">¡Verificación de Atención!</div>
              <div className="attention-subtitle">
                Tu profesor quiere saber si estás atento. ¡Responde rápido!
              </div>

              <div className="attention-countdown-wrap">
                <svg className="attention-countdown-svg" viewBox="0 0 100 100">
                  <circle className="attention-countdown-bg" cx="50" cy="50" r="45" />
                  <circle
                    className={`attention-countdown-progress ${colorClass}`}
                    cx="50" cy="50" r="45"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                  />
                </svg>
                <div className={`attention-countdown-text ${colorClass}`}>
                  {Math.ceil(acCountdown)}
                </div>
              </div>

              <button className="attention-respond-btn" onClick={handleRespondCheck}>
                ✋ ¡Estoy Aquí!
              </button>
            </div>
          </div>
        )
      })()}

      {/* Attention Toast */}
      {acToast && (
        <div className={`attention-toast ${acToast.type}`}>
          {acToast.text}
        </div>
      )}
    </div>
  )
}
