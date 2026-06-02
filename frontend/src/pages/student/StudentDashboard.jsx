import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'

const THUMB = {
  Informática: '💻', Matemáticas: '📐', Ciencias: '🔬', Historia: '📚',
  Idiomas: '🌍', Arte: '🎨', Ingeniería: '⚙️', General: '📖',
}

// ── Toast helper ─────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [toast, onClose])

  if (!toast) return null
  const colors = {
    success: { bg: '#ECFDF5', border: '#059669', color: '#065F46', icon: '✅' },
    error:   { bg: '#FEF2F2', border: '#DC2626', color: '#991B1B', icon: '❌' },
    info:    { bg: '#EFF6FF', border: '#2563EB', color: '#1E3A8A', icon: 'ℹ️' },
  }
  const s = colors[toast.type] || colors.info
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      padding: '14px 20px', borderRadius: 12, border: `1.5px solid ${s.border}`,
      background: s.bg, color: s.color, fontWeight: 600, fontSize: 14,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      animation: 'fadeIn .25s ease',
      maxWidth: 340,
    }}>
      <span style={{ fontSize: 18 }}>{s.icon}</span>
      {toast.message}
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: s.color, opacity: 0.6 }}>✕</button>
    </div>
  )
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({ course, onConfirm, onCancel, loading }) {
  if (!course) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--card-bg, #fff)', borderRadius: 16, padding: '32px 28px',
        width: 380, maxWidth: '90vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ fontSize: 36, textAlign: 'center' }}>{THUMB[course.category] || '📖'}</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Confirmar inscripción</div>
          <div style={{ color: 'var(--text-muted, #666)', fontSize: 14 }}>
            ¿Deseas inscribirte en <strong>{course.name}</strong>?
          </div>
          {course.category && (
            <div style={{ marginTop: 8 }}>
              <span className="badge badge-gray">{course.category}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary" style={{ flex: 1, color: 'white' }} onClick={onConfirm} disabled={loading}>
            {loading ? 'Inscribiendo...' : '✓ Inscribirme'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const {
    currentUser, users, courses, classes, activePage,
    enrollStudent, unenrollStudent, requestEnrollment,
    getCoursesForTeacher, getClassesForCourse,
    getCoursesForStudent, getActiveClasses, joinClass,
    setActivePage, setActiveClassId, fetchGradesByStudent, grades,
    fetchCoursesAdvanced, fetchCoursesByStudent, fetchActiveClassesByCourse, fetchParticipantHistory,
  } = useApp()

  const [tab, setTab]               = useState('my')
  const [search, setSearch]         = useState('')
  const [toast, setToast]           = useState(null)
  const [confirmCourse, setConfirmCourse] = useState(null)  // course object pending confirm
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [unenrollLoading, setUnenrollLoading] = useState(null) // courseId being unenrolled
  const [currentTime, setCurrentTime]         = useState(new Date())

  // Dynamic state for index-optimized routes
  const [myDynamicCourses, setMyDynamicCourses] = useState([])
  const [exploredDynamic, setExploredDynamic] = useState([])
  const [historyDynamic, setHistoryDynamic] = useState([])
  const [activeClassesDynamic, setActiveClassesDynamic] = useState([])
  const [exploreCategory, setExploreCategory] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Sync internal tab with global activePage
  useEffect(() => {
    if (activePage === 'dashboard' || activePage === 'my-courses') setTab('my')
    else if (activePage === 'explore') setTab('explore')
    else if (activePage === 'history') setTab('history')
    else if (activePage === 'grades') setTab('grades')
  }, [activePage])

  const studentId = currentUser?.id || currentUser?._id

  useEffect(() => {
    if (tab === 'grades' && studentId) {
      fetchGradesByStudent(studentId)
    }
  }, [tab, studentId])

  // 1. Fetch My Courses (Multikey Course index) & Active Classes for them (Compound Class index)
  useEffect(() => {
    if (tab === 'my' && studentId) {
      fetchCoursesByStudent(studentId).then(data => {
        setMyDynamicCourses(data)
        // For each course, fetch active classes to utilize compound class index
        data.forEach(c => {
          fetchActiveClassesByCourse(c.id || c._id).then(activeCls => {
            if (activeCls.length > 0) {
              setActiveClassesDynamic(prev => {
                const others = prev.filter(p => String(p.courseId?._id || p.courseId) !== String(c.id || c._id))
                return [...others, ...activeCls]
              })
            }
          })
        })
      })
    }
  }, [tab, studentId])

  // 2. Fetch Explored Courses (Compound Course index)
  useEffect(() => {
    if (tab === 'explore' && studentId) {
      fetchCoursesAdvanced(exploreCategory, 'Activo').then(data => setExploredDynamic(data))
    }
  }, [tab, studentId, exploreCategory])

  // 3. Fetch History (Multikey Class index)
  useEffect(() => {
    if (tab === 'history' && studentId) {
      fetchParticipantHistory(studentId).then(data => setHistoryDynamic(data))
    }
  }, [tab, studentId])

  if (!currentUser) return null

  const showToast = (message, type = 'success') => setToast({ message, type })

  const myCourses  = getCoursesForStudent(studentId) || []
  const activeClasses = getActiveClasses() || []

  // Active classes I'm enrolled in
  const myActiveClasses = activeClasses.filter(cl => {
    const clCourseId = String(cl.courseId?._id || cl.courseId)
    const course = courses.find(c => String(c.id || c._id) === clCourseId)
    return course && (course.studentIds || []).map(String).includes(String(studentId))
  }) || []

  const enterClass = (classId) => {
    const cls = classes.find(cl => String(cl.id || cl._id) === String(classId)) || activeClassesDynamic.find(cl => String(cl.id || cl._id) === String(classId))
    if (cls && cls.startTime) {
      const [h, m] = cls.startTime.split(':')
      const start = new Date(currentTime)
      start.setHours(parseInt(h), parseInt(m), 0, 0)
      if (currentTime < start) {
        alert(`La clase aún no ha comenzado. Por favor, espera hasta las ${cls.startTime}.`)
        return
      }
    }
    joinClass(classId, studentId)
    setActiveClassId(classId)
    setActivePage('classroom')
  }

  // Courses not yet enrolled — active AND open only, filtered by search
  const exploredFiltered = exploredDynamic.filter(c =>
    !(c.studentIds || []).map(String).includes(String(studentId)) &&
    (c.tipoInscripcion === 'Abierto' || !c.tipoInscripcion) &&
    (
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.category || '').toLowerCase().includes(search.toLowerCase())
    )
  )

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEnrollClick = (course) => {
    if (!course) return
    // Check if course is active
    if (course.estado !== 'Activo') {
      showToast('Este curso no está disponible para inscripción', 'info')
      return
    }
    // RF-08: Check if course is closed
    if (course.tipoInscripcion === 'Cerrado') {
      showToast('Este curso es privado y no permite autoinscripción', 'error')
      return
    }
    // RF-08: Check if already pending
    if ((course.pendingStudentIds || []).map(String).includes(String(studentId))) {
      showToast('Ya tienes una solicitud pendiente para este curso', 'info')
      return
    }
    // Flujo alternativo 5.1: ya inscrito
    if ((course.studentIds || []).map(String).includes(String(studentId))) {
      showToast('Ya estás inscrito en este curso', 'info')
      return
    }
    // Flujo normal: pedir confirmación
    setConfirmCourse(course)
  }

  const handleConfirmEnroll = async () => {
    if (!confirmCourse) return
    setEnrollLoading(true)
    const courseId = confirmCourse.id || confirmCourse._id
    const result = await requestEnrollment(courseId, studentId)
    setEnrollLoading(false)
    setConfirmCourse(null)

    if (result?.alreadyEnrolled) {
      showToast('Ya estás inscrito en este curso', 'info')
    } else if (result?.success) {
      showToast('¡Solicitud enviada! Espera a que el administrador la apruebe ⏳', 'success')
    } else {
      showToast(result?.error || 'Error al inscribirse', 'error')
    }
  }

  const handleUnenroll = async (courseId) => {
    setUnenrollLoading(courseId)
    const result = await unenrollStudent(courseId, studentId)
    setUnenrollLoading(null)
    if (result?.success) {
      showToast('Saliste del curso correctamente', 'info')
    } else {
      showToast(result?.error || 'Error al salir del curso', 'error')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmModal
        course={confirmCourse}
        onConfirm={handleConfirmEnroll}
        onCancel={() => setConfirmCourse(null)}
        loading={enrollLoading}
      />

      <div className="topbar">
        <div>
          <div className="topbar-title">🏠 Portal del Estudiante</div>
          <div className="topbar-subtitle">Hola, {currentUser.name?.split(' ')[0]} 👋</div>
        </div>
        <div className="topbar-right">
          <span className="badge badge-info">Estudiante</span>
        </div>
      </div>

      <div className="page-content fade-in">
        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: 'Mis Cursos',        value: myDynamicCourses.length,      icon: '📚', bg: '#EDE9FE', color: '#7C3AED' },
            { label: 'Clases Activas',    value: activeClassesDynamic.length, icon: '🔴', bg: '#FEF2F2', color: '#DC2626' },
            { label: 'Clases Guardadas',  value: classes.filter(cl => (cl.attendance || []).some(a => String(a.userId) === String(studentId)) && cl.savedTranscription).length, icon: '💾', bg: '#ECFDF5', color: '#059669' },
            { label: 'Cursos Disponibles',value: exploredFiltered.length,        icon: '🔍', bg: '#EFF6FF', color: '#2563EB' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-top">
                <div className="stat-card-label">{s.label}</div>
                <div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div>
              </div>
              <div className="stat-card-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Live classes */}
        {activeClassesDynamic.length > 0 && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'var(--danger)', borderWidth: 2 }}>
            <div className="card-header">
              <div>
                <div className="card-title" style={{ color: 'var(--danger)' }}>🔴 Clases en vivo ahora</div>
                <div className="card-subtitle">Puedes unirte a cualquiera de estas sesiones activas</div>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeClassesDynamic.map(cl => {
                const clCourseId = String(cl.courseId?._id || cl.courseId)
                const course  = myDynamicCourses.find(c => String(c.id || c._id) === clCourseId) || courses.find(c => String(c.id || c._id) === clCourseId)
                const teacher = users.find(u => String(u.id || u._id) === String(course?.teacherId?._id || course?.teacherId))
                return (
                  <div key={cl.id || cl._id} className="lobby-card">
                    <div className="lobby-icon" style={{ background: '#FEF2F2' }}>🔴</div>
                    <div className="lobby-info">
                      <div className="lobby-title">{cl.title}</div>
                      <div className="lobby-sub">{course?.name}</div>
                      <div className="lobby-meta">
                        <span>👨‍🏫 {teacher?.name || 'Profesor'}</span>
                        <span>👥 {(cl.participantIds || []).length} conectados</span>
                        <span>🕐 {cl.startTime || 'En curso'}</span>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => enterClass(cl.id || cl._id)}>→ Unirme</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${tab === 'my' ? 'active' : ''}`} onClick={() => setActivePage('my-courses')}>
            Mis Cursos <span className="tab-count">{myDynamicCourses.length}</span>
          </button>
          <button className={`tab-btn ${tab === 'explore' ? 'active' : ''}`} onClick={() => setActivePage('explore')}>
            Explorar Cursos <span className="tab-count">{exploredFiltered.length}</span>
          </button>
          <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setActivePage('history')}>
            Mi Historial
          </button>
          <button className={`tab-btn ${tab === 'grades' ? 'active' : ''}`} onClick={() => setActivePage('grades')}>
            Mis Calificaciones
          </button>
        </div>

        {/* MY COURSES */}
        {tab === 'my' && (
          myDynamicCourses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📚</span>
              <div className="empty-state-title">Aún no estás inscrito en ningún curso</div>
              <div className="empty-state-desc">Explora los cursos disponibles y únete</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setActivePage('explore')}>Explorar Cursos →</button>
            </div>
          ) : (
            <div className="course-grid">
              {myDynamicCourses.map(c => {
                const cId          = c.id || c._id
                const teacher      = users.find(u => String(u.id || u._id) === String(c.teacherId?._id || c.teacherId))
                const courseClasses = classes.filter(cl => String(cl.courseId?._id || cl.courseId) === String(cId))
                const hasActive    = courseClasses.some(cl => cl.isActive)
                const myAttended   = courseClasses.filter(cl => (cl.attendance || []).some(a => String(a.userId) === String(studentId)))
                const isLeaving    = unenrollLoading === cId
                return (
                  <div key={cId} className="course-card">
                    <div className="course-card-thumb" style={{ background: hasActive ? '#FEF2F2' : 'var(--primary-bg)' }}>
                      {THUMB[c.category] || '📖'}
                    </div>
                    <div className="course-card-body">
                      <div className="course-card-cat">{c.category}</div>
                      <div className="course-card-name">{c.name}</div>
                      <div className="course-card-desc">{c.description}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        {hasActive && <span className="badge badge-live">🔴 En Vivo</span>}
                        <span className="badge badge-gray">🎓 {myAttended.length} clases asistidas</span>
                      </div>
                      <div className="course-card-footer">
                        <div className="course-card-teacher">
                          {teacher && <Avatar user={teacher} size="sm" />}
                          <span>{teacher?.name || 'Sin profesor'}</span>
                        </div>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={isLeaving}
                          onClick={() => handleUnenroll(cId)}
                        >
                          {isLeaving ? 'Saliendo...' : 'Salir'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* EXPLORE */}
        {tab === 'explore' && (
          <>
            <div className="search-wrap" style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span className="search-icon">🔍</span>
                <input
                  className="form-input"
                  placeholder="Buscar cursos disponibles..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select 
                className="form-select" 
                style={{ width: 220 }}
                value={exploreCategory}
                onChange={e => setExploreCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {Object.keys(THUMB).map(cat => (
                  <option key={cat} value={cat}>{THUMB[cat]} {cat}</option>
                ))}
              </select>
            </div>

            {exploredFiltered.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🔍</span>
                <div className="empty-state-title">No hay cursos disponibles en este momento</div>
                <div className="empty-state-desc">Pronto habrá nuevos cursos publicados por los profesores.</div>
              </div>
            ) : (
              <div className="course-grid">
                {exploredFiltered.map(c => {
                  const cId    = c.id || c._id
                  const teacher = users.find(u => String(u.id || u._id) === String(c.teacherId?._id || c.teacherId))
                  const isPending = (c.pendingStudentIds || []).map(String).includes(String(studentId))
                  return (
                    <div key={cId} className="course-card">
                      <div className="course-card-thumb" style={{ background: 'var(--primary-bg)' }}>
                        {THUMB[c.category] || '📖'}
                      </div>
                      <div className="course-card-body">
                        <div className="course-card-cat">{c.category}</div>
                        <div className="course-card-name">{c.name}</div>
                        <div className="course-card-desc">{c.description}</div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                          <span className="badge badge-success">✅ Disponible</span>
                          <span className="badge badge-gray">👥 {(c.studentIds || []).length} inscritos</span>
                          {isPending && <span className="badge badge-info">⏳ Pendiente</span>}
                        </div>
                        <div className="course-card-footer">
                          <div className="course-card-teacher">
                            {teacher && <Avatar user={teacher} size="sm" />}
                            <span>{teacher?.name || 'Sin profesor'}</span>
                          </div>
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ color: 'white' }}
                            onClick={() => handleEnrollClick(c)}
                            disabled={isPending}
                          >
                            {isPending ? 'Solicitado' : '+ Inscribirme'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Clase</th><th>Curso</th><th>Fecha</th><th>Transcripción</th><th>Resumen IA</th></tr>
                </thead>
                <tbody>
                  {historyDynamic.length === 0 ? (
                    <tr><td colSpan={5}><div className="empty-state"><span className="empty-state-icon">📋</span><div className="empty-state-title">Aún no has asistido a ninguna clase</div></div></td></tr>
                  ) : historyDynamic.map(cl => {
                    const clCourseId = String(cl.courseId?._id || cl.courseId)
                    const course = courses.find(c => String(c.id || c._id) === clCourseId) || cl.courseId
                    return (
                      <tr key={cl.id || cl._id}>
                        <td><div style={{ fontWeight: 600 }}>{cl.title}</div></td>
                        <td style={{ fontSize: 12 }}>{course?.name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cl.date}</td>
                        <td>
                          {cl.savedTranscription
                            ? <span className="badge badge-success">✅ Disponible</span>
                            : <span className="badge badge-gray">Sin guardar</span>}
                        </td>
                        <td>
                          {cl.summary
                            ? <span className="badge badge-primary">🤖 Generado</span>
                            : <span className="badge badge-gray">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GRADES */}
        {tab === 'grades' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {myCourses.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📝</span>
                <div className="empty-state-title">Aún no tienes calificaciones</div>
                <div className="empty-state-desc">Inscríbete en cursos para empezar tu proceso académico</div>
              </div>
            ) : (
              myCourses.map(c => {
                const cId = c.id || c._id
                const courseGrades = (grades || []).filter(g => {
                   const gCourseId = g.courseId?._id || g.courseId;
                   return String(gCourseId) === String(cId);
                })
                const activities  = (c.contents || []).filter(cnt => cnt.type === 'Actividad')
                
                const avg = courseGrades.length > 0 
                  ? (courseGrades.reduce((sum, g) => sum + (g.grade || 0), 0) / courseGrades.length).toFixed(1)
                  : '-'

                return (
                  <div key={cId} className="card slide-up">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="card-title">{c.name}</div>
                        <div className="card-subtitle">{activities.length} actividades registradas</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Promedio Actual</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: avg !== '-' ? (Number(avg) >= 3 ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)' }}>
                          {avg}
                        </div>
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Actividad</th>
                            <th>Nota</th>
                            <th>Retroalimentación</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activities.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No hay actividades creadas para este curso.</td></tr>
                          ) : activities.map(act => {
                            const g = courseGrades.find(grade => String(grade.contentId?._id || grade.contentId) === String(act._id))
                            return (
                              <tr key={act._id}>
                                <td><strong>{act.title}</strong></td>
                                <td>
                                  {g ? (
                                    <span className={`badge ${g.grade >= 3 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 13, padding: '4px 10px' }}>
                                      {g.grade.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pendiente</span>
                                  )}
                                </td>
                                <td style={{ fontSize: 12, maxWidth: 300 }}>
                                  {g?.feedback || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                </td>
                                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {g ? new Date(g.updatedAt || g.createdAt).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </>
  )
}
