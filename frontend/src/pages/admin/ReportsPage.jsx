import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'

export default function ReportsPage() {
  const { users, courses, classes, refreshData } = useApp()
  const [tab, setTab] = useState('students')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [teacherHistory, setTeacherHistory] = useState({ recientes: [], antiguos: [] })

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/teachers/history')
      if (res.ok) {
        const data = await res.json()
        setTeacherHistory(data)
      }
    } catch (err) {
      console.error('Error fetching teacher history:', err)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshData()
    if (tab === 'teacherHistory') await fetchHistory()
    setIsRefreshing(false)
  }

  const teachers = users.filter(u => u.role === 'teacher')
  const students = users.filter(u => u.role === 'student')

  // Report: students per course
  const studentsPerCourse = courses.map(c => ({
    course: c,
    teacher: users.find(u => u.id === c.teacherId),
    students: students.filter(s => c.studentIds.includes(s.id)),
    classes: classes.filter(cl => cl.courseId === c.id),
  }))

  // Report: classes per teacher
  const classesPerTeacher = teachers.map(t => {
    const myCourses = courses.filter(c => c.teacherId === t.id)
    const myClasses = classes.filter(cl => myCourses.some(c => c.id === cl.courseId))
    const totalAttend = myClasses.reduce((acc, cl) => acc + cl.attendance.length, 0)
    return { teacher: t, courses: myCourses, classes: myClasses, totalAttend }
  })

  // Report: attendance per class
  const attendance = classes.map(cl => ({
    class: cl,
    course: courses.find(c => c.id === cl.courseId),
    attendees: cl.attendance.map(a => users.find(u => u.id === a.userId)).filter(Boolean),
    questions: cl.questions.length,
  }))

  const downloadCSV = () => {
    let csv = ''
    if (tab === 'students') {
      csv = 'Curso,Estudiantes Inscritos,Profesor\n'
      studentsPerCourse.forEach(r => {
        csv += `"${r.course.name}",${r.students.length},"${r.teacher?.name || 'Sin asignar'}"\n`
      })
    } else if (tab === 'classes') {
      csv = 'Profesor,Cursos Asignados,Clases Dictadas,Total Asistentes\n'
      classesPerTeacher.forEach(r => {
        csv += `"${r.teacher.name}",${r.courses.length},${r.classes.length},${r.totalAttend}\n`
      })
    } else {
      csv = 'Clase,Curso,Fecha,Asistentes,Preguntas\n'
      attendance.forEach(r => {
        csv += `"${r.class.title}","${r.course?.name || ''}","${r.class.date}",${r.attendees.length},${r.questions}\n`
      })
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${tab}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">📊 Reportes y Estadísticas</div>
          <div className="topbar-subtitle">Análisis general del sistema</div>
        </div>
        <div className="topbar-right">
          <button className={`btn btn-secondary ${isRefreshing ? 'loading' : ''}`} onClick={handleRefresh} disabled={isRefreshing} style={{ marginRight: 8 }}>
            🔄 {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn btn-success" onClick={downloadCSV}>⬇️ Exportar CSV</button>
        </div>
      </div>

      <div className="page-content fade-in">
        {/* Summary cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'Estudiantes', value: students.length, icon: '👨‍🎓', bg: '#EDE9FE', color: '#7C3AED' },
            { label: 'Profesores', value: teachers.length, icon: '👨‍🏫', bg: '#EFF6FF', color: '#2563EB' },
            { label: 'Cursos', value: courses.length, icon: '📚', bg: '#ECFDF5', color: '#059669' },
            { label: 'Clases', value: classes.length, icon: '🎓', bg: '#FFFBEB', color: '#D97706' },
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

        <div className="card">
          <div className="card-header">
            <div className="card-title">Reportes Detallados</div>
          </div>
          <div className="card-body">
            <div className="tabs">
              {[
                { id: 'students', label: `Estudiantes por Curso (${studentsPerCourse.length})` },
                { id: 'classes', label: `Clases por Profesor (${classesPerTeacher.length})` },
                { id: 'attendance', label: `Asistencia por Clase (${attendance.length})` },
                { id: 'optimization', label: 'Optimización de BD (Índices)' },
                { id: 'teacherHistory', label: 'Histórico de profesores' },
              ].map(t => (
                <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => {
                  setTab(t.id)
                  if (t.id === 'teacherHistory') fetchHistory()
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Students per Course */}
            {tab === 'students' && (
              <table className="data-table">
                <thead>
                  <tr><th>Curso</th><th>Categoría</th><th>Profesor</th><th>Estudiantes</th><th>Clases</th></tr>
                </thead>
                <tbody>
                  {studentsPerCourse.map(r => (
                    <tr key={r.course.id}>
                      <td><div style={{ fontWeight: 600 }}>{r.course.name}</div></td>
                      <td><span className="badge badge-primary">{r.course.category}</span></td>
                      <td>
                        {r.teacher ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar user={r.teacher} size="sm" />
                            <span style={{ fontSize: 12 }}>{r.teacher.name}</span>
                          </div>
                        ) : <span className="badge badge-warning">Sin asignar</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.students.length}</span>
                          <div className="progress-bar" style={{ flex: 1, maxWidth: 80 }}>
                            <div className="progress-fill" style={{ width: `${Math.min(r.students.length * 20, 100)}%` }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          {r.students.map(s => s.name).join(', ') || 'Sin estudiantes'}
                        </div>
                      </td>
                      <td><span className="badge badge-gray">{r.classes.length}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Classes per Teacher */}
            {tab === 'classes' && (
              <table className="data-table">
                <thead>
                  <tr><th>Profesor</th><th>Cursos Asignados</th><th>Clases Dictadas</th><th>Total Asistentes</th></tr>
                </thead>
                <tbody>
                  {classesPerTeacher.length === 0 ? (
                    <tr><td colSpan={4}><div className="empty-state"><span>👨‍🏫</span> Sin profesores</div></td></tr>
                  ) : classesPerTeacher.map(r => (
                    <tr key={r.teacher.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar user={r.teacher} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.teacher.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.teacher.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-info">{r.courses.length} cursos</span></td>
                      <td><span className="badge badge-primary">{r.classes.length} clases</span></td>
                      <td><span className="badge badge-success">{r.totalAttend} 👥</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Attendance */}
            {tab === 'attendance' && (
              <table className="data-table">
                <thead>
                  <tr><th>Clase</th><th>Curso</th><th>Fecha</th><th>Estado</th><th>Asistentes</th><th>Preguntas</th></tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><span className="empty-state-icon">📋</span><div className="empty-state-title">Sin clases registradas</div></div></td></tr>
                  ) : attendance.map(r => (
                    <tr key={r.class.id}>
                      <td><div style={{ fontWeight: 600 }}>{r.class.title}</div></td>
                      <td style={{ fontSize: 12 }}>{r.course?.name || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.class.date}</td>
                      <td>
                        <span className={`badge ${r.class.isActive ? 'badge-live' : r.class.savedTranscription ? 'badge-success' : 'badge-gray'}`}>
                          {r.class.isActive ? '🔴 En Vivo' : r.class.savedTranscription ? '✅ Guardada' : 'Sin iniciar'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {r.attendees.slice(0, 4).map(u => <Avatar key={u.id} user={u} size="sm" />)}
                          {r.attendees.length > 4 && <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>+{r.attendees.length - 4}</span>}
                          {r.attendees.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin asistentes</span>}
                        </div>
                      </td>
                      <td><span className="badge badge-warning">{r.questions} ❓</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Optimization Tab */}
            {tab === 'optimization' && (
              <div className="optimization-view">
                <div style={{ marginBottom: 24, padding: 16, background: 'var(--primary-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="index-insight-icon" style={{ width: 32, height: 32 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>Optimizaciones Activas</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>El sistema utiliza índices estratégicos para garantizar una respuesta inmediata en operaciones críticas.</div>
                    </div>
                  </div>
                </div>

                <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {/* Index List */}
                  <div className="card" style={{ border: 'none', boxShadow: 'none' }}>
                    <div className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                      Índices en Producción
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { col: 'users', field: 'email', reason: 'Agiliza la autenticación (Login)', icon: 'auth' },
                        { col: 'students', field: 'correo', reason: 'Login de estudiantes y duplicados', icon: 'auth' },
                        { col: 'courses', field: 'teacherId', reason: 'Filtrado de cursos por docente', icon: 'filter' },
                        { col: 'classes', field: 'courseId', reason: 'Recuperación de sesiones de clase', icon: 'filter' },
                        { col: 'grades', field: 'studentId', reason: 'Carga de historial de notas', icon: 'filter' },
                      ].map((idx, i) => (
                        <div key={i} style={{ padding: 12, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                              {idx.col}.<span style={{ color: 'var(--primary)' }}>{idx.field}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{idx.reason}</div>
                          </div>
                          <span className="index-tag">ASC (1)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Simulator */}
                  <div className="card" style={{ padding: 20, background: '#111827', color: 'white', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BBF7D0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      Simulador de Latencia
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div className="sim-item" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="sim-item-title" style={{ color: '#BBF7D0', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                          Con Índice (B-Tree Search)
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>~2ms</div>
                        <div className="sim-perf-bar" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="sim-perf-fill perf-fast" style={{ width: '2%', background: 'var(--success)', height: '100%' }} />
                        </div>
                      </div>

                      <div className="sim-item" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="sim-item-title" style={{ color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                          Sin Índice (Full Collection Scan)
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>~450ms</div>
                        <div className="sim-perf-bar" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          <div className="sim-perf-fill perf-slow" style={{ width: '85%', background: 'var(--danger)', height: '100%' }} />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                      * Valores proyectados basados en una colección de 50,000 registros.
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Teacher History Tab */}
            {tab === 'teacherHistory' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginTop: 10 }}>
                {/* Recientes */}
                <div>
                  <h4 style={{ marginBottom: 16, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🆕</span> Profesores recientes (2025-2026)
                  </h4>
                  <div className="card" style={{ padding: 0, border: '1px solid var(--border)', boxShadow: 'none' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Nombre</th><th style={{ textAlign: 'center' }}>Año Inicio</th></tr>
                      </thead>
                      <tbody>
                        {teacherHistory.recientes.length === 0 ? (
                          <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Sin registros</td></tr>
                        ) : (
                          teacherHistory.recientes.map((t, i) => (
                            <tr key={i}>
                              <td><div style={{ fontWeight: 600 }}>{t.nombre} {t.apellido}</div></td>
                              <td style={{ textAlign: 'center' }}><span className="badge badge-success">{t.anioInicio}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Antiguos */}
                <div>
                  <h4 style={{ marginBottom: 16, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>⏳</span> Profesores antiguos (Pre-2025)
                  </h4>
                  <div className="card" style={{ padding: 0, border: '1px solid var(--border)', boxShadow: 'none' }}>
                    <table className="data-table">
                      <thead>
                        <tr><th>Nombre</th><th style={{ textAlign: 'center' }}>Año Inicio</th></tr>
                      </thead>
                      <tbody>
                        {teacherHistory.antiguos.length === 0 ? (
                          <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Sin registros</td></tr>
                        ) : (
                          teacherHistory.antiguos.map((t, i) => (
                            <tr key={i}>
                              <td><div style={{ fontWeight: 600 }}>{t.nombre} {t.apellido}</div></td>
                              <td style={{ textAlign: 'center' }}><span className="badge badge-gray">{t.anioInicio}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
