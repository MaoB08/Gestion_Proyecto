import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { downloadClassReport, getReportHistory } from '../services/classReportService'

// ── Icons ───────────────────────────────────────────────────────────────────
const PdfIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────
export default function ClassReportPage() {
  const { currentUser, classes, courses, users, getCoursesForTeacher, getCoursesForStudent, getCourseById } = useApp()
  const [selectedClass, setSelectedClass] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [reportHistory, setReportHistory] = useState([])
  const [filter, setFilter] = useState('all') // 'all' | 'finished'
  const [searchTerm, setSearchTerm] = useState('')
  const [notification, setNotification] = useState(null)

  const role = currentUser?.role

  // Get classes relevant to this user
  const relevantCourses = role === 'admin'
    ? courses
    : role === 'teacher'
      ? getCoursesForTeacher(currentUser.id)
      : getCoursesForStudent(currentUser.id)

  const courseIds = new Set(relevantCourses.map(c => String(c.id || c._id)))

  const relevantClasses = classes.filter(cl => {
    const courseId = String(cl.courseId)
    if (!courseIds.has(courseId)) return false
    if (filter === 'finished' && cl.isActive) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const course = getCourseById(courseId)
      return (
        cl.title?.toLowerCase().includes(term) ||
        course?.name?.toLowerCase().includes(term)
      )
    }
    return true
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

  // Load report history when a class is selected
  useEffect(() => {
    if (selectedClass) {
      getReportHistory(selectedClass.id || selectedClass._id).then(setReportHistory)
    }
  }, [selectedClass])

  const handleDownload = async (cls) => {
    setDownloading(true)
    setNotification(null)
    const classId = cls.id || cls._id
    const result = await downloadClassReport(classId, role, currentUser.id)
    setDownloading(false)

    if (result.success) {
      setNotification({ type: 'success', text: '✅ Reporte descargado exitosamente.' })
      // Refresh history
      getReportHistory(classId).then(setReportHistory)
    } else {
      setNotification({ type: 'error', text: `❌ ${result.error}` })
    }

    setTimeout(() => setNotification(null), 5000)
  }

  const getClassStats = (cls) => {
    const attendance = cls.attendance?.length || 0
    const questions = cls.questions?.length || 0
    const participants = cls.participantIds?.length || 0
    const hasTranscription = !!(cls.savedTranscription || cls.transcription?.length)
    return { attendance, questions, participants, hasTranscription }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('es-CO', { dateStyle: 'medium' })
    } catch { return dateStr }
  }

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: 'var(--text-main)',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: 'var(--primary-bg)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>📄</span>
          Reportes de Finalización de Clase
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6, marginLeft: 56 }}>
          Descarga reportes consolidados en PDF al concluir las sesiones de clase.
          {role !== 'admin' && ' La información de seguridad no está disponible en tu reporte.'}
          {role === 'admin' && ' Como administrador, tus reportes incluyen datos de geolocalización.'}
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          padding: '12px 20px', borderRadius: 'var(--radius-md)', marginBottom: 20,
          background: notification.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          color: notification.type === 'success' ? '#059669' : '#DC2626',
          border: `1px solid ${notification.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
          fontWeight: 600, fontSize: 14, animation: 'fadeIn 0.3s ease',
        }}>
          {notification.text}
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <input
          className="form-input"
          placeholder="🔍 Buscar clase o curso..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: 320, flex: 1 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('all')}
          >Todas</button>
          <button
            className={`btn btn-sm ${filter === 'finished' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('finished')}
          >Finalizadas</button>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedClass ? '1fr 380px' : '1fr',
        gap: 24,
        transition: 'all 0.3s ease',
      }}>
        {/* Class List */}
        <div>
          {relevantClasses.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 60, color: 'var(--text-muted)',
              background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>No hay clases disponibles</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {filter === 'finished' ? 'No hay clases finalizadas aún.' : 'No se encontraron clases.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {relevantClasses.map(cls => {
                const classId = cls.id || cls._id
                const course = getCourseById(cls.courseId)
                const stats = getClassStats(cls)
                const isSelected = (selectedClass?.id || selectedClass?._id) === classId
                const isFinished = !cls.isActive

                return (
                  <div
                    key={classId}
                    onClick={() => setSelectedClass(isSelected ? null : cls)}
                    style={{
                      background: isSelected ? 'var(--primary-bg)' : 'var(--surface)',
                      border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px 20px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {cls.title}
                          <span className={`badge ${isFinished ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 9 }}>
                            {isFinished ? '✓ FINALIZADA' : '● EN CURSO'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {course?.name || 'Curso'} · {formatDate(cls.date)} · {cls.startTime} — {cls.endTime}
                        </div>
                      </div>

                      {isFinished && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                          onClick={(e) => { e.stopPropagation(); handleDownload(cls); }}
                          disabled={downloading}
                        >
                          <DownloadIcon />
                          {downloading ? 'Generando...' : 'Descargar PDF'}
                        </button>
                      )}
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <UsersIcon /> {stats.participants} participantes
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                        <ClockIcon /> {stats.attendance} asistencias
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: stats.hasTranscription ? 'var(--success)' : 'var(--text-muted)' }}>
                        <PdfIcon /> {stats.hasTranscription ? 'Transcripción ✓' : 'Sin transcripción'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ❓ {stats.questions} preguntas
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedClass && (() => {
          const cls = selectedClass
          const classId = cls.id || cls._id
          const course = getCourseById(cls.courseId)
          const stats = getClassStats(cls)
          const isFinished = !cls.isActive
          const attendanceUsers = (cls.attendance || []).map(a => {
            const user = users.find(u => String(u.id || u._id) === String(a.userId))
            return user?.name || 'Desconocido'
          })

          return (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', overflow: 'hidden',
              animation: 'fadeIn 0.3s ease', position: 'sticky', top: 20,
            }}>
              {/* Panel header */}
              <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #5B21B6 100%)',
                padding: '20px 20px 16px', color: 'white',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{cls.title}</div>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'white', opacity: 0.7 }}
                    onClick={() => setSelectedClass(null)}>✕</button>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  {course?.name} · {cls.sessionType}
                </div>
              </div>

              <div style={{ padding: 20 }}>
                {/* Info rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {[
                    ['📅 Fecha', formatDate(cls.date)],
                    ['⏰ Horario', `${cls.startTime} — ${cls.endTime}`],
                    ['⏱️ Duración', cls.duration || `${cls.startTime} a ${cls.endTime}`],
                    ['👥 Participantes', stats.participants],
                    ['✅ Asistencia', stats.attendance],
                    ['❓ Preguntas', stats.questions],
                    ['📝 Transcripción', stats.hasTranscription ? 'Disponible' : 'No disponible'],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Attendance list preview */}
                {attendanceUsers.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Estudiantes presentes
                    </div>
                    <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {attendanceUsers.map((name, idx) => (
                        <div key={idx} style={{
                          fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                          background: idx % 2 === 0 ? '#F9FAFB' : 'transparent',
                        }}>
                          {idx + 1}. {name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Download button */}
                {isFinished ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    onClick={() => handleDownload(cls)}
                    disabled={downloading}
                  >
                    <DownloadIcon />
                    {downloading ? '⏳ Generando reporte...' : '📄 Descargar Reporte PDF'}
                  </button>
                ) : (
                  <div style={{
                    textAlign: 'center', padding: 16, fontSize: 13,
                    color: 'var(--warning)', background: '#FFFBEB',
                    borderRadius: 'var(--radius-md)', border: '1px solid #FDE68A',
                  }}>
                    ⚠️ La clase aún está en curso. El reporte estará disponible al finalizarla.
                  </div>
                )}

                {/* Contenido del reporte */}
                <div style={{ marginTop: 16, padding: '12px 14px', background: '#F9FAFB', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Contenido del reporte
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-main)' }}>
                    <div>✅ Duración total de la clase</div>
                    <div>✅ Transcripción completa</div>
                    <div>✅ Listado de asistencia</div>
                    <div>✅ Listado de ausentismo</div>
                    <div>✅ Métricas de participación</div>
                    <div>✅ Preguntas realizadas</div>
                    <div>✅ Verificaciones de atención</div>
                    {role === 'admin' && (
                      <div style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        🔒 Geolocalización / IP de usuarios
                      </div>
                    )}
                    {role !== 'admin' && (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 11 }}>
                        🔒 La geolocalización solo está disponible para administradores.
                      </div>
                    )}
                  </div>
                </div>

                {/* Report history */}
                {reportHistory.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Historial de descargas
                    </div>
                    <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {reportHistory.slice(0, 5).map((r, idx) => (
                        <div key={idx} style={{
                          fontSize: 11, color: 'var(--text-muted)', display: 'flex',
                          justifyContent: 'space-between', padding: '3px 0',
                        }}>
                          <span>{r.reportType === 'admin' ? '🔒 Admin' : r.reportType === 'teacher' ? '👨‍🏫 Docente' : '🎓 Estudiante'}</span>
                          <span>{new Date(r.generatedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
