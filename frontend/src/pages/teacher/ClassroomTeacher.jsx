import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'
import { summarizeTranscription, identifyTopics, partialSummary } from '../../services/geminiService'

const QUICK_ACTIONS = ['¿Puede parar, profesor?', '¿Puede repetir?', '¿Puede ir más despacio?', 'No escucho']

import { logUserIP } from '../../services/classReportService'

export default function ClassroomTeacher({ classId }) {
  const {
    currentUser, users, courses, classes,
    getClassById, getCourseById,
    appendTranscription, clearTranscription, saveTranscription, setSummary,
    answerQuestion, deactivateClass, setActivePage, setActiveClassId,
    launchAttentionCheck, completeAttentionCheck,
  } = useApp()

  const clsContext = getClassById(classId)
  const [dynamicCls, setDynamicCls] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [isFetching, setIsFetching] = useState(false)
  
  // Log IP on join
  useEffect(() => {
    if (currentUser?.id && classId) {
      logUserIP(classId, currentUser.id)
    }
  }, [classId, currentUser?.id])
  
  useEffect(() => {
    if (!clsContext && classId && !dynamicCls && !fetchError && !isFetching) {
      setIsFetching(true)
      fetch(`http://localhost:3001/api/classes/${classId}`)
        .then(r => r.json())
        .then(data => {
          setIsFetching(false)
          if (data && (data._id || data.id)) {
            setDynamicCls({ ...data, id: data._id || data.id, courseId: data.courseId?._id || data.courseId })
          } else {
            setFetchError('La clase no existe en el servidor.')
          }
        })
        .catch(err => {
          setIsFetching(false)
          setFetchError(err.message)
        })
    }
  }, [classId, clsContext, dynamicCls, fetchError, isFetching])

  const cls = clsContext || dynamicCls
  const course = cls ? getCourseById(cls.courseId) : null

  // Transcription state
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef(null)
  const transcriptBottomRef = useRef(null)
  const chatEndRef = useRef(null)

  // AI state
  const [aiMessages, setAiMessages] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiTopics, setAiTopics] = useState([])
  const [showAI, setShowAI] = useState(false)

  // Timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  // Questions tab
  const [qTab, setQTab] = useState('pending')

  // Attention check
  const [acLoading, setAcLoading] = useState(false)
  const [viewCheckId, setViewCheckId] = useState(null)

  // Participants (used by attention check handler, must be defined before)
  const participants = (cls?.participantIds || []).map(id => users.find(u => u.id === id || u._id === id)).filter(Boolean)

  // Derive active attention check from class data
  const activeCheck = (cls?.attentionChecks || []).find(ac => ac.status === 'active')
  const checkHistory = (cls?.attentionChecks || []).filter(ac => ac.status === 'completed').reverse()
  const displayCheck = viewCheckId
    ? (cls?.attentionChecks || []).find(ac => (ac._id || ac.id) === viewCheckId)
    : activeCheck

  // Auto-complete timer for active check
  useEffect(() => {
    if (!activeCheck) return
    const launched = new Date(activeCheck.launchedAt).getTime()
    const timeout = (activeCheck.timeoutSecs || 30) * 1000
    const remaining = (launched + timeout) - Date.now()
    if (remaining <= 0) {
      if (completeAttentionCheck) {
        completeAttentionCheck(classId, activeCheck._id || activeCheck.id)
      }
      return
    }
    const timer = setTimeout(() => {
      // Force complete when time is up
      if (completeAttentionCheck) {
        completeAttentionCheck(classId, activeCheck._id || activeCheck.id)
      }
    }, remaining + 500)
    return () => clearTimeout(timer)
  }, [activeCheck, classId, completeAttentionCheck])

  const handleLaunchCheck = async () => {
    if (acLoading) return
    if (participants.length === 0) { alert('No hay estudiantes conectados para verificar.'); return }
    setAcLoading(true)
    setViewCheckId(null)
    const res = await launchAttentionCheck(classId)
    setAcLoading(false)
    if (!res.success) alert(res.error)
  }

  // Helper: format response time
  const fmtResponseTime = (check, response) => {
    if (!response.responded || !response.respondedAt) return null
    const launched = new Date(check.launchedAt).getTime()
    const responded = new Date(response.respondedAt).getTime()
    const secs = (responded - launched) / 1000
    return secs.toFixed(1)
  }

  const getTimeClass = (secs) => {
    if (secs <= 5) return 'fast'
    if (secs <= 15) return 'medium'
    return 'slow'
  }

  const getRankClass = (idx) => {
    if (idx === 0) return 'gold'
    if (idx === 1) return 'silver'
    if (idx === 2) return 'bronze'
    return 'normal'
  }

  // Scroll transcription to bottom
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [cls?.transcription?.length, interimText])

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [cls?.transcription?.length, interimText])

  // Auto-expulsion if class is deactivated (e.g. by an admin)
  useEffect(() => {
    if (cls && !cls.isActive) {
      alert('La clase ha sido finalizada. Serás redirigido al panel principal.')
      setActiveClassId(null)
      setActivePage('dashboard')
    }
  }, [cls?.isActive, setActiveClassId, setActivePage])
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Web Speech API setup
  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome.'); return }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'es-ES'
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            const now = new Date()
            appendTranscription(classId, {
              text,
              timestamp: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
              isFinal: true,
            })
          }
        } else { interim += result[0].transcript }
      }
      setInterimText(interim)
    }

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') alert('Permiso de micrófono denegado. Permite el acceso en tu navegador.')
      else if (e.error !== 'aborted') console.error('Speech error:', e.error)
    }

    recognition.onend = () => {
      // Auto-restart if still recording and not paused
      if (recognitionRef.current === recognition && isRecording && !isPaused) {
        try { recognition.start() } catch { }
      }
    }

    recognition.start()
    setIsRecording(true)
    setIsPaused(false)
  }, [classId, appendTranscription, isRecording, isPaused])

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
    setIsPaused(false)
    setInterimText('')
  }

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false)
      startRecognition()
    } else {
      setIsPaused(true)
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      }
      setInterimText('')
    }
  }

  const handleClear = () => {
    if (!window.confirm('¿Limpiar toda la transcripción?')) return
    stopRecognition()
    clearTranscription(classId)
  }

  const handleSave = () => {
    saveTranscription(classId)
    stopRecognition()
    alert('✅ Transcripción guardada correctamente.')
  }

  const handleEndClass = async () => {
    if (!window.confirm('¿Finalizar la clase? Se guardará la transcripción automáticamente.')) return
    saveTranscription(classId)
    stopRecognition()

    // Save class duration
    const h = Math.floor(elapsed / 3600)
    const m = Math.floor((elapsed % 3600) / 60)
    const durationStr = h > 0 ? `${h}h ${m}min` : `${m} minutos`
    try {
      await fetch(`http://localhost:3001/api/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: durationStr }),
      }).catch(() => {})
    } catch {}

    await deactivateClass(classId)

    // Offer report download
    if (window.confirm('✅ Clase finalizada. ¿Deseas descargar el reporte de finalización en PDF?')) {
      try {
        const role = currentUser.role === 'admin' ? 'admin' : 'teacher'
        const res = await fetch(`http://localhost:3001/api/class-reports/${classId}/download?role=${role}&userId=${currentUser.id}`)
        if (res.ok) {
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `Reporte_Clase_${classId}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
        }
      } catch (err) {
        console.error('Error downloading report:', err)
      }
    }

    setActiveClassId(null)
    setActivePage('dashboard')
  }

  // Cleanup on unmount
  useEffect(() => () => { stopRecognition(); clearInterval(timerRef.current) }, [])

  // AI handlers
  const getFullText = () => (cls?.transcription || []).map(s => s.text).join(' ')

  const handleAITopics = async () => {
    const text = getFullText()
    if (!text) { alert('Aún no hay transcripción para analizar.'); return }
    setAiLoading(true)
    const topics = await identifyTopics(text)
    setAiTopics(topics.split('\n').filter(Boolean))
    setAiLoading(false)
  }

  const handlePartialSummary = async () => {
    const text = getFullText()
    if (!text) { alert('Aún no hay transcripción.'); return }
    setShowAI(true)
    setAiLoading(true)
    setAiMessages(prev => [...prev, { role: 'user', text: '📋 Resumen parcial de lo explicado hasta ahora' }])
    const res = await partialSummary(text)
    setAiMessages(prev => [...prev, { role: 'ai', text: res }])
    setAiLoading(false)
  }

  const handleFinalSummary = async () => {
    const text = getFullText()
    if (!text) { alert('Sin transcripción para resumir.'); return }
    setShowAI(true)
    setAiLoading(true)
    setAiMessages(prev => [...prev, { role: 'user', text: '📝 Generar resumen completo de la clase' }])
    const res = await summarizeTranscription(text)
    setAiMessages(prev => [...prev, { role: 'ai', text: res }])
    setSummary(classId, res)
    setAiLoading(false)
  }

  const handleAIAsk = async () => {
    if (!aiInput.trim()) return
    const q = aiInput.trim()
    setAiInput('')
    setShowAI(true)
    setAiMessages(prev => [...prev, { role: 'user', text: q }])
    setAiLoading(true)
    const { askAboutTranscription } = await import('../../services/geminiService')
    const res = await askAboutTranscription(getFullText(), q)
    setAiMessages(prev => [...prev, { role: 'ai', text: res }])
    setAiLoading(false)
  }

  if (!cls) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-main)' }}>
        {isFetching ? (
          <h2>⏳ Cargando información de la clase...</h2>
        ) : (
          <div>
            <h2>❌ Clase no encontrada</h2>
            <p>Error: {fetchError || 'No se encontró la clase localmente.'}</p>
            <p>Class ID buscado: {classId}</p>
            <button className="btn btn-primary mt-4" onClick={() => { setActiveClassId(null); setActivePage('dashboard') }}>Volver al panel</button>
          </div>
        )}
      </div>
    )
  }

  const pendingQ = (cls.questions || []).filter(q => q.status === 'pending')
  const answeredQ = (cls.questions || []).filter(q => q.status === 'answered')
  const displayQ = qTab === 'pending' ? pendingQ : answeredQ

  return (
    <div style={{ height: 'calc(100vh - 20px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top header */}
      <div className="class-topbar">
        <div className="class-topbar-left">
          <div className="logo-mark">🎓</div>
          <div>
            <div className="class-topbar-name">{course?.name || 'Clase'}</div>
            <div className="class-topbar-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="badge badge-live" style={{ fontSize: 9 }}>● EN VIVO</span>
              <span>Sesión activa · {fmt(elapsed)}</span>
            </div>
          </div>
        </div>
        <div className="class-topbar-right">
          <div style={{ display: 'flex', gap: -8 }}>
            {participants.slice(0, 3).map(u => <Avatar key={u.id} user={u} size="sm" style={{ border: '2px solid white', marginLeft: -6 }} />)}
            {participants.length > 3 && <div className="avatar avatar-sm" style={{ background: '#9CA3AF', border: '2px solid white', marginLeft: -6 }}>+{participants.length - 3}</div>}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚙️
          </button>
          <button className={`btn ${activeCheck ? 'btn-danger' : 'btn-primary'} btn-sm attention-launch-btn`} onClick={handleLaunchCheck} disabled={acLoading || !!activeCheck}>
            {acLoading ? '⏳...' : activeCheck ? '🎯 Check activo...' : '🎯 Verificar Atención'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => { setActiveClassId(null); setActivePage('dashboard') }}>↩ Salir</button>
          <button className="btn btn-danger" onClick={handleEndClass}>✕ Finalizar Clase</button>
        </div>
      </div>

      {/* Body */}
      <div className="classroom-layout" style={{ flex: 1 }}>
        {/* Left: Video + Transcription */}
        <div className="classroom-main">
          {/* Video area */}
          <div className="video-area">
            <div className="video-overlay-info">
              <Avatar user={currentUser} size="sm" />
              <div>
                <div className="prof-name">{currentUser.name}</div>
                <div className="prof-sub">Cámara principal · HD</div>
              </div>
            </div>

            <div className="video-placeholder">
              <div className="video-placeholder-icon">🎥</div>
              <div className="video-placeholder-text">
                {isRecording ? (isPaused ? '⏸ Grabación pausada' : '🔴 Transcripción activa') : 'Inicia la transcripción abajo'}
              </div>
            </div>

            <div className="video-controls">
              {currentUser.role !== 'admin' && (
                <>
                  <button
                    className={`video-ctrl-btn ${isRecording && !isPaused ? 'active' : ''}`}
                    title={isRecording ? 'Detener micrófono' : 'Activar micrófono'}
                    onClick={isRecording ? stopRecognition : startRecognition}
                  >
                    🎤
                  </button>
                  <button className="video-ctrl-btn" title="Cámara">📹</button>
                  <button
                    className={`video-ctrl-btn ${isRecording && !isPaused ? 'recording' : ''}`}
                    title={isRecording ? 'Grabando' : 'Iniciar grabación'}
                    onClick={isRecording ? stopRecognition : startRecognition}
                  >
                    {isRecording && !isPaused ? '⏹' : '⏺'}
                  </button>
                </>
              )}
              {currentUser.role === 'admin' && (
                <button className="video-ctrl-btn" disabled style={{ width: 'auto', padding: '0 12px', fontSize: 11 }}>
                  ⚖️ Modo Observador
                </button>
              )}
              <button className="video-ctrl-btn" title="Compartir pantalla">🖥️</button>
            </div>
          </div>

          {/* Transcription panel */}
          <div className="transcription-panel">
            <div className="transcription-header">
              <div className="transcription-title">
                <span style={{ background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>📝</span>
                Transcripción en Tiempo Real
                {isRecording && !isPaused && (
                  <span style={{ animation: 'pulse 1s infinite', color: 'var(--danger)', fontSize: 12 }}>● grabando</span>
                )}
              </div>
              <div className="transcription-controls">
                {!isRecording
                  ? <button className="btn btn-primary btn-sm" onClick={startRecognition}>▶ Iniciar</button>
                  : <>
                    <button className="btn btn-secondary btn-sm" onClick={togglePause}>{isPaused ? '▶ Reanudar' : '⏸ Pausar'}</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleClear}>🗑 Limpiar</button>
                    <button className="btn btn-success btn-sm" onClick={handleSave}>💾 Guardar</button>
                  </>
                }
              </div>
            </div>

            <div className="transcription-body">
              {(cls.transcription || []).length === 0 && !interimText ? (
                <div className="transcript-empty">
                  {isRecording ? '🎤 Escuchando... habla para que aparezca la transcripción' : 'Presiona ▶ Iniciar para comenzar la transcripción de voz en tiempo real'}
                </div>
              ) : (
                <>
                  {(cls.transcription || []).map(seg => (
                    <div className="transcript-segment" key={seg.id}>
                      <span className="transcript-time">{seg.timestamp}</span>
                      <span className="transcript-text">{seg.text}</span>
                    </div>
                  ))}
                  {interimText && (
                    <div className="transcript-segment">
                      <span className="transcript-time" style={{ color: 'var(--text-muted)' }}>…</span>
                      <span className="transcript-text current">{interimText}<span className="cursor-blink" /></span>
                    </div>
                  )}
                </>
              )}
              <div ref={transcriptBottomRef} />
            </div>
          </div>

          {/* AI Panel */}
          {showAI && (
            <div style={{ padding: '0 20px 20px' }}>
              <div className="ai-panel">
                <div className="ai-panel-header">
                  <div className="ai-panel-title">🤖 Asistente IA — Análisis de clase</div>
                  <div className="ai-panel-actions">
                    <button className="btn btn-sm btn-outline" onClick={handleAITopics}>🏷️ Temas</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAI(false)}>✕</button>
                  </div>
                </div>
                <div className="ai-panel-body">
                  {aiMessages.map((m, i) => (
                    <div key={i} className={`ai-message ${m.role}`}>
                      {m.role === 'ai' ? <><strong>🤖 IA:</strong> {m.text}</> : <><strong>👨‍🏫 Tú:</strong> {m.text}</>}
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="ai-message loading">
                      <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Analizando transcripción…</span>
                    </div>
                  )}
                </div>
                {aiTopics.length > 0 && (
                  <div className="ai-topics">
                    <div className="ai-topics-title">Temas identificados</div>
                    {aiTopics.map((t, i) => <span key={i} className="ai-topic-chip">{t.replace('• ', '')}</span>)}
                  </div>
                )}
                <div className="ai-input-row">
                  <input className="form-input" style={{ flex: 1 }} placeholder="Pregunta a la IA sobre la transcripción..." value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAIAsk()} />
                  <button className="chat-send-btn" onClick={handleAIAsk}>➤</button>
                </div>
              </div>
            </div>
          )}

          {/* AI quick buttons */}
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-outline" onClick={() => setShowAI(v => !v)}>🤖 {showAI ? 'Ocultar' : 'Abrir'} IA</button>
            <button className="btn btn-sm btn-outline" onClick={handlePartialSummary}>📋 Resumen parcial</button>
            <button className="btn btn-sm btn-outline" onClick={handleFinalSummary}>📝 Resumen final</button>
            <button className="btn btn-sm btn-outline" onClick={handleAITopics}>🏷️ Identificar temas</button>
          </div>

          {/* Attention Check Results Panel */}
          {displayCheck && (() => {
            const check = displayCheck
            const isActive = check.status === 'active'
            const responses = check.responses || []
            const responded = responses.filter(r => r.responded)
            const notResponded = responses.filter(r => !r.responded)
            const total = responses.length
            const pct = total > 0 ? Math.round((responded.length / total) * 100) : 0

            // Sort responded by response time (fastest first)
            const sortedResponded = [...responded].sort((a, b) => {
              const tA = new Date(a.respondedAt).getTime() - new Date(check.launchedAt).getTime()
              const tB = new Date(b.respondedAt).getTime() - new Date(check.launchedAt).getTime()
              return tA - tB
            })

            // Calc remaining time for active checks
            const elapsed = (Date.now() - new Date(check.launchedAt).getTime()) / 1000
            const remaining = Math.max(0, (check.timeoutSecs || 30) - elapsed)

            return (
              <div style={{ padding: '0 20px 16px' }}>
                <div className="attention-results-panel">
                  <div className="attention-results-header">
                    <div className="attention-results-title">
                      🎯 {isActive ? 'Verificación en Curso' : 'Resultado de Verificación'}
                      {isActive && <span className="badge badge-live" style={{ fontSize: 9 }}>● ACTIVO</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isActive && (
                        <span style={{ fontSize: 14, fontWeight: 800, color: remaining <= 10 ? 'var(--danger)' : 'var(--primary)' }}>
                          ⏱ {Math.ceil(remaining)}s
                        </span>
                      )}
                      {!isActive && viewCheckId && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setViewCheckId(null)}>✕</button>
                      )}
                    </div>
                  </div>

                  <div className="attention-results-body">
                    {/* Progress */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                      <span>Respuestas: {responded.length}/{total}</span>
                      <span style={{ color: pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{pct}%</span>
                    </div>
                    <div className="attention-progress">
                      <div className="attention-progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    {/* Ranked responded students */}
                    {sortedResponded.map((r, idx) => {
                      const user = users.find(u => String(u.id || u._id) === String(r.userId))
                      const secs = fmtResponseTime(check, r)
                      const secsNum = parseFloat(secs)
                      return (
                        <div key={r.userId || idx} className="attention-student-row responded">
                          <div className={`attention-rank ${getRankClass(idx)}`}>
                            {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
                          </div>
                          <div className="attention-student-info">
                            <div className="attention-student-name">{user?.name || 'Estudiante'}</div>
                          </div>
                          <span className={`attention-response-time ${getTimeClass(secsNum)}`}>
                            ⚡ {secs}s
                          </span>
                        </div>
                      )
                    })}

                    {/* Not responded students */}
                    {notResponded.map((r, idx) => {
                      const user = users.find(u => String(u.id || u._id) === String(r.userId))
                      return (
                        <div key={r.userId || idx} className="attention-student-row not-responded">
                          <div className="attention-rank fail">✕</div>
                          <div className="attention-student-info">
                            <div className="attention-student-name">{user?.name || 'Estudiante'}</div>
                          </div>
                          <span className="attention-response-time timeout">
                            {isActive ? '⏳ Esperando...' : '❌ Sin respuesta'}
                          </span>
                        </div>
                      )
                    })}

                    {/* Stats */}
                    {!isActive && (
                      <div className="attention-stats">
                        <div className="attention-stat">
                          <div className="attention-stat-value" style={{ color: 'var(--success)' }}>{responded.length}</div>
                          <div className="attention-stat-label">Atentos</div>
                        </div>
                        <div className="attention-stat">
                          <div className="attention-stat-value" style={{ color: 'var(--danger)' }}>{notResponded.length}</div>
                          <div className="attention-stat-label">Desatentos</div>
                        </div>
                        <div className="attention-stat">
                          <div className="attention-stat-value" style={{ color: 'var(--primary)' }}>{pct}%</div>
                          <div className="attention-stat-label">Atención</div>
                        </div>
                        {responded.length > 0 && (
                          <div className="attention-stat">
                            <div className="attention-stat-value" style={{ color: 'var(--info)' }}>
                              {fmtResponseTime(check, sortedResponded[0])}s
                            </div>
                            <div className="attention-stat-label">Más rápido</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Status bar */}
          <div className="status-bar">
            <div className="status-dot">{isRecording && !isPaused ? 'Conexión estable · transcripción activa' : isPaused ? 'Transcripción pausada' : 'Transcripción inactiva'}</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <span>🎓 Clase: {cls.title}</span>
              <span>⏱️ {fmt(elapsed)}</span>
              {cls.transcription?.length > 0 && <span>📝 {cls.transcription.length} segmentos</span>}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="classroom-sidebar">
          {/* Participants */}
          <div className="participants-panel">
            <div className="participants-header">
              <div className="participants-title">👥 Participantes</div>
              <span className="participants-count">{participants.length}</span>
            </div>
            <div className="participants-list">
              {/* Teacher (self) */}
              <div className="participant-item">
                <Avatar user={currentUser} size="sm" />
                <div className="participant-info">
                  <div className="participant-name">{currentUser.name}</div>
                  <div className="participant-sub">Host · Profesor</div>
                </div>
                <div className="participant-icons">🎤 📹</div>
              </div>
              {/* Students */}
              {participants.map(u => (
                <div className="participant-item" key={u.id}>
                  <Avatar user={u} size="sm" />
                  <div className="participant-info">
                    <div className="participant-name">{u.name}</div>
                    <div className="participant-sub">Estudiante</div>
                  </div>
                  <div className="participant-icons">🎤</div>
                </div>
              ))}
              {participants.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                  Sin estudiantes conectados
                </div>
              )}
            </div>
          </div>

          {/* Attention Check History */}
          {checkHistory.length > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                🎯 Historial de Checks
                <span className="participants-count">{checkHistory.length}</span>
              </div>
              <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {checkHistory.map((ac, idx) => {
                  const responded = (ac.responses || []).filter(r => r.responded).length
                  const total = (ac.responses || []).length
                  const pct = total > 0 ? Math.round((responded / total) * 100) : 0
                  return (
                    <div
                      key={ac._id || idx}
                      className="attention-history-item"
                      onClick={() => setViewCheckId(viewCheckId === (ac._id || ac.id) ? null : (ac._id || ac.id))}
                      style={viewCheckId === (ac._id || ac.id) ? { borderColor: 'var(--primary)', background: 'var(--primary-bg)' } : {}}
                    >
                      <span>#{checkHistory.length - idx} · {new Date(ac.launchedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className={`badge ${pct >= 80 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                        {pct}% ({responded}/{total})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Questions received */}
          <div className="chat-panel">
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexShrink: 0 }}>
              <button className={`tab-btn ${qTab === 'pending' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setQTab('pending')}>
                Pendientes <span className="tab-count">{pendingQ.length}</span>
              </button>
              <button className={`tab-btn ${qTab === 'answered' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setQTab('answered')}>
                Respondidas <span className="tab-count">{answeredQ.length}</span>
              </button>
            </div>

            <div className="chat-messages">
              {/* Real-time speech-to-chat simulation */}
              {(cls.transcription || []).map((seg, idx) => (
                <div key={`trans-${idx}`} style={{ fontSize: 13, marginBottom: 4, color: 'var(--text-main)', paddingLeft: 8, borderLeft: '2px solid var(--primary)' }}>
                  • {seg.text}
                </div>
              ))}
              {interimText && (
                <div className="chat-message" style={{ borderLeft: '3px solid var(--danger)', background: '#fff1f2', marginBottom: 8 }}>
                  <div className="chat-message-header">
                    <span className="chat-message-name" style={{ color: 'var(--danger)', fontSize: 10 }}>🔴 Hablando ahora...</span>
                  </div>
                  <div className="chat-message-bubble" style={{ fontStyle: 'italic', fontSize: 11 }}>
                    {interimText}...
                  </div>
                </div>
              )}
              {displayQ.length === 0 && !interimText && (cls.transcription || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  {qTab === 'pending' ? 'Sin preguntas pendientes' : 'Sin preguntas respondidas'}
                </div>
              ) : displayQ.map(q => (
                <div key={q.id} className={`question-card ${q.status}`}>
                  <div className="question-card-header">
                    <div className="question-card-user">
                      <div className="avatar avatar-sm" style={{ background: '#7C3AED', color: 'white', fontSize: 10, fontWeight: 700, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {q.userAvatar}
                      </div>
                      <div>
                        <div className="question-user-name" style={{ fontSize: 12 }}>{q.userName}</div>
                        <div className="question-user-sub">{new Date(q.sentAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    <span className={`badge ${q.status === 'pending' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: 9 }}>
                      {q.status === 'pending' ? 'PENDIENTE' : '✓ RESPONDIDA'}
                    </span>
                  </div>
                  <div className="question-text">{q.text}</div>
                  {q.status === 'pending' && (
                    <div className="question-actions">
                      <button className="btn btn-sm btn-success" onClick={() => answerQuestion(classId, q.id)}>✓ Marcar respondida</button>
                    </div>
                  )}
                  {q.status === 'answered' && (
                    <div className="question-answered-note">✓ Respondida en clase</div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick reply preview / chat */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              💬 Los estudiantes pueden enviar mensajes rápidos y preguntas desde su pantalla
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
