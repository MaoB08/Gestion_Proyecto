import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'

// ── Reusable Donut Chart (pure SVG) ─────────────────────────────────────────
function DonutChart({ data, colors, size = 180 }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  if (total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: size }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin datos</span>
      </div>
    )
  }

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 16
  const innerRadius = radius * 0.58
  let cumulativeAngle = -90 // Start from top

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 360
    const startAngle = cumulativeAngle
    cumulativeAngle += angle

    const startRad = (Math.PI / 180) * startAngle
    const endRad = (Math.PI / 180) * (startAngle + angle)

    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)

    const ix1 = cx + innerRadius * Math.cos(endRad)
    const iy1 = cy + innerRadius * Math.sin(endRad)
    const ix2 = cx + innerRadius * Math.cos(startRad)
    const iy2 = cy + innerRadius * Math.sin(startRad)

    const largeArc = angle > 180 ? 1 : 0

    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ')

    return (
      <path
        key={i}
        d={path}
        fill={colors[i % colors.length]}
        stroke="white"
        strokeWidth={2}
        style={{ transition: 'opacity 0.2s' }}
        onMouseEnter={(e) => (e.target.style.opacity = '0.8')}
        onMouseLeave={(e) => (e.target.style.opacity = '1')}
      >
        <title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title>
      </path>
    )
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices}
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: 'var(--text-primary)' }}>
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-muted)' }}>
        Estudiantes
      </text>
    </svg>
  )
}

// ── Reusable Bar Chart (pure CSS) ────────────────────────────────────────────
function BarChart({ data, colors }) {
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160, padding: '0 8px' }}>
      {data.map((d, i) => {
        const height = (d.value / max) * 130
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* Value label */}
            <span style={{ fontSize: 14, fontWeight: 700, color: colors[i % colors.length] }}>{d.value}</span>
            {/* Bar */}
            <div
              style={{
                width: '100%',
                maxWidth: 56,
                height: Math.max(height, 4),
                borderRadius: '8px 8px 4px 4px',
                background: `linear-gradient(180deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}cc)`,
                transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 2px 8px ${colors[i % colors.length]}40`,
                position: 'relative',
              }}
              title={`${d.label}: ${d.value} estudiantes`}
            >
              {/* Shine effect */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                borderRadius: '8px 8px 0 0',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)',
              }} />
            </div>
            {/* Label */}
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Chart Legend ──────────────────────────────────────────────────────────────
function ChartLegend({ data, colors }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 3,
            background: colors[i % colors.length], flexShrink: 0,
          }} />
          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.label}</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { users, courses, classes, getActiveClasses, setActivePage, setActiveClassId, deactivateClass } = useApp()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [studentStats, setStudentStats] = useState({ sexo: [], jornada: [] })

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])

  // Fetch student stats from the API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/students/stats')
        if (res.ok) {
          const data = await res.json()
          setStudentStats(data)
        }
      } catch (err) {
        console.error('Error fetching student stats:', err)
      }
    }
    fetchStats()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const teachers  = users.filter(u => u.role === 'teacher')
  const students  = users.filter(u => u.role === 'student')
  const active    = getActiveClasses()

  const stats = [
    { label: 'Total Usuarios',    value: users.length,     icon: '👥', color: '#7C3AED', bg: '#EDE9FE', change: `${students.length} estudiantes`, dir: 'up' },
    { label: 'Profesores',        value: teachers.length,  icon: '👨‍🏫', color: '#2563EB', bg: '#EFF6FF', change: 'registrados', dir: 'up' },
    { label: 'Cursos Activos',    value: courses.filter(c => c.status === 'active').length, icon: '📚', color: '#059669', bg: '#ECFDF5', change: `${courses.length} en total`, dir: 'up' },
    { label: 'Clases en Vivo',    value: active.length,    icon: '🔴', color: '#DC2626', bg: '#FEF2F2', change: 'ahora mismo', dir: active.length > 0 ? 'up' : 'neutral' },
  ]

  // Prepare chart data from API response
  // Handle both legacy ('M','F') and new ('Masculino','Femenino','Otro') values
  const sexoColors  = ['#6366F1', '#EC4899', '#8B5CF6']
  const sexoMap = [
    { label: 'Masculino', keys: ['Masculino', 'M'] },
    { label: 'Femenino',  keys: ['Femenino', 'F'] },
    { label: 'Otro',      keys: ['Otro', 'O'] },
  ]
  const sexoData = sexoMap.map(({ label, keys }) => {
    const total = studentStats.sexo
      .filter(s => keys.includes(s._id))
      .reduce((sum, s) => sum + s.count, 0)
    return { label, value: total }
  }).filter(d => d.value > 0)

  // If no data at all, show all categories with 0
  const sexoDisplay = sexoData.length > 0 ? sexoData : [
    { label: 'Masculino', value: 0 },
    { label: 'Femenino', value: 0 },
    { label: 'Otro', value: 0 },
  ]

  const jornadaColors = ['#F59E0B', '#F97316', '#3B82F6', '#1E293B']
  const jornadaLabels = ['Mañana', 'Medio Día', 'Tarde', 'Noche']
  const jornadaData = jornadaLabels.map(label => {
    const found = studentStats.jornada.find(j => j._id === label)
    return { label, value: found ? found.count : 0 }
  })

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">🏠 Panel Administrador</div>
          <div className="topbar-subtitle">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <div className="topbar-right">
          <span className="badge badge-primary">Admin</span>
        </div>
      </div>

      <div className="page-content fade-in">
        {/* Stats */}
        <div className="stats-grid">
          {stats.map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-top">
                <div className="stat-card-label">{s.label}</div>
                <div className="stat-card-icon" style={{ background: s.bg, color: s.color, fontSize: 20 }}>{s.icon}</div>
              </div>
              <div className="stat-card-value">{s.value}</div>
              <div className={`stat-card-change ${s.dir}`}>↑ {s.change}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Donut: Students by Gender */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 8, background: '#EDE9FE', fontSize: 14,
                  }}>👤</span>
                  Estudiantes por Sexo
                </div>
                <div className="card-subtitle">Distribución demográfica de estudiantes registrados</div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center' }}>
                <DonutChart data={sexoDisplay} colors={sexoColors} size={170} />
                <ChartLegend data={sexoDisplay} colors={sexoColors} />
              </div>
            </div>
          </div>

          {/* Bar: Students by Shift */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 8, background: '#FEF3C7', fontSize: 14,
                  }}>🕐</span>
                  Estudiantes por Jornada
                </div>
                <div className="card-subtitle">Conexiones del día de hoy — se reinicia a medianoche</div>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <BarChart data={jornadaData} colors={jornadaColors} />
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16,
                paddingTop: 12, borderTop: '1px solid var(--border)',
              }}>
                {jornadaData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: jornadaColors[i] }} />
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Recent Classes */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Clases Recientes</div>
                <div className="card-subtitle">Últimas clases en el sistema</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Clase</th>
                    <th>Curso</th>
                    <th>Profesor</th>
                    <th>Estado</th>
                    <th>Asistentes</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr><td colSpan={6}><div className="empty-state"><span className="empty-state-icon">📭</span><div className="empty-state-title">Sin clases aún</div></div></td></tr>
                  ) : classes.slice().reverse().map(cl => {
                    const clCourseId = String(cl.courseId?._id || cl.courseId)
                    const course = courses.find(c => String(c.id || c._id) === clCourseId)
                    const teacher = users.find(u => String(u.id || u._id) === String(course?.teacherId?._id || course?.teacherId))
                    const classId = cl.id || cl._id
                    return (
                      <tr key={classId}>
                        <td><div style={{ fontWeight: 600 }}>{cl.title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cl.date}</div></td>
                        <td style={{ fontSize: 12 }}>{course?.name || '—'}</td>
                        <td>
                          {teacher ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar user={teacher} size="sm" />
                              <span style={{ fontSize: 12 }}>{teacher.name}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`badge ${cl.isActive ? 'badge-live' : 'badge-gray'}`}>
                            {cl.isActive ? '🔴 En Vivo' : 'Finalizada'}
                          </span>
                        </td>
                        <td><span className="badge badge-primary">{(cl.participantIds || []).length} / {(cl.attendance || []).length}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {cl.isActive && (
                              <>
                                <button className="btn btn-xs btn-outline" onClick={() => {
                                  const [h, m] = (cl.startTime || '00:00').split(':')
                                  const start = new Date(currentTime)
                                  start.setHours(parseInt(h), parseInt(m), 0, 0)
                                  if (currentTime < start) {
                                    alert(`La clase inicia a las ${cl.startTime}. No puedes entrar todavía.`)
                                    return
                                  }
                                  setActiveClassId(classId); 
                                  setActivePage('classroom') 
                                }}>Entrar</button>
                                <button className="btn btn-xs btn-danger" onClick={async () => {
                                  if (confirm('¿Finalizar esta clase forzosamente?')) await deactivateClass(classId)
                                }}>Finalizar</button>
                              </>
                            )}
                            {!cl.isActive && cl.savedTranscription && (
                              <button className="btn btn-xs btn-ghost" onClick={() => { setActiveClassId(classId); setActivePage('history') }}>Ver</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Team quick view */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Profesores</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {teachers.length === 0 ? (
                  <div className="empty-state"><span className="empty-state-icon">👤</span><div className="empty-state-title">Sin profesores</div></div>
                ) : teachers.map(t => {
                  const tId = t.id || t._id;
                  const myCourses = courses.filter(c => c.teacherId === tId)
                  return (
                    <div key={tId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar user={t} size="md" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{myCourses.length} curso{myCourses.length !== 1 ? 's' : ''} asignado{myCourses.length !== 1 ? 's' : ''}</div>
                      </div>
                      <span className="badge badge-primary">{myCourses.length}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
