import { useApp } from '../context/AppContext'
import { useState, useEffect } from 'react'

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706', '#0891B2', '#7C3AED']
const colorForId = (id) => AVATAR_COLORS[id?.charCodeAt(1) % AVATAR_COLORS.length] || '#7C3AED'

export function Avatar({ user, size = 'md', style = {} }) {
  const bg = colorForId(user?.id || user?.name)
  const cls = `avatar avatar-${size}`
  return (
    <div className={cls} style={{ background: bg, ...style }}>
      {user?.avatar || (user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??')}
    </div>
  )
}

export default function Sidebar() {
  const { currentUser, logout, activePage, setActivePage, activeClassId, setActiveClassId, getActiveClasses, courses } = useApp()
  const [regPendingCount, setRegPendingCount] = useState(0)
  const [pqrsPendingCount, setPqrsPendingCount] = useState(0)

  // Fetch pending account registration count for the admin badge
  useEffect(() => {
    if (currentUser?.role !== 'admin') return
    fetch('http://localhost:3001/api/students/pending')
      .then(r => r.ok ? r.json() : [])
      .then(data => setRegPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {})

    fetch('http://localhost:3001/api/pqrs/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPqrsPendingCount(data.pendientes || 0) })
      .catch(() => {})
  }, [currentUser?.role, activePage])

  const activeClasses = getActiveClasses().filter(cl => {
    if (currentUser?.role === 'admin') return true
    const clCourseId = String(cl.courseId?._id || cl.courseId)
    const course = courses.find(c => String(c.id || c._id) === clCourseId)
    if (!course) return false
    if (currentUser?.role === 'teacher') return String(course.teacherId?._id || course.teacherId) === String(currentUser.id)
    if (currentUser?.role === 'student') return (course.studentIds || []).map(String).includes(String(currentUser.id))
    return false
  })

  // Calculate total pending: Registration requests + Course enrollment requests
  const courseRequestsCount = courses.reduce((acc, c) => acc + (c.pendingStudentIds?.length || 0), 0)
  const totalPending = regPendingCount + courseRequestsCount

  const PqrsIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );

  const navMap = {
    admin: [
      { id: 'dashboard',  icon: '🏠', label: 'Inicio' },
      { id: 'users',      icon: '👥', label: 'Usuarios' },
      { id: 'courses',    icon: '📚', label: 'Cursos' },
      { id: 'enrollment', icon: '📋', label: 'Solicitudes de Inscripción', badge: totalPending },
      { id: 'reports',    icon: '📊', label: 'Reportes' },
      { id: 'class-reports', icon: '📄', label: 'Reportes de Clase' },
      { id: 'pqrs',       icon: PqrsIcon, label: 'PQRS', badge: pqrsPendingCount },
    ],
    teacher: [
      { id: 'dashboard', icon: '🏠', label: 'Inicio' },
      { id: 'my-courses',icon: '📚', label: 'Mis Cursos' },
      { id: 'history',   icon: '📋', label: 'Historial de clases' },
      { id: 'class-reports', icon: '📄', label: 'Reportes de Clase' },
      { id: 'pqrs',      icon: PqrsIcon, label: 'PQRS' },
    ],
    student: [
      { id: 'dashboard', icon: '🏠', label: 'Inicio' },
      { id: 'my-courses',icon: '📚', label: 'Mis Cursos' },
      { id: 'explore',   icon: '🔍', label: 'Explorar Cursos' },
      { id: 'history',   icon: '📋', label: 'Historial' },
      { id: 'class-reports', icon: '📄', label: 'Reportes de Clase' },
      { id: 'pqrs',      icon: PqrsIcon, label: 'PQRS' },
    ],
  }

  const roleLabel = { admin: 'Administrador', teacher: 'Profesor', student: 'Estudiante' }
  const navItems = navMap[currentUser?.role] || []

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">🎓</div>
        <div>
          <div className="logo-name">ClassAI</div>
          <div className="logo-tagline">Aulas en tiempo real</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Menú principal</div>
        {navItems.map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="item-icon">{item.icon}</span>
            {item.label}
            {item.badge > 0 && <span className="item-badge">{item.badge}</span>}
            {item.id === 'reports' && !item.badge && <span className="item-badge">!</span>}
          </div>
        ))}

        {activeClassId && activeClasses.some(cl => String(cl.id || cl._id) === String(activeClassId)) && (
          <>
            <div className="sidebar-section-label">Sesión Actual</div>
            <div
              className={`sidebar-item ${activePage === 'classroom' ? 'active' : ''}`}
              onClick={() => setActivePage('classroom')}
              style={{ color: 'var(--danger)', fontWeight: 600 }}
            >
              <span className="item-icon">🔴</span>
              En clase ahora
              <span className="badge badge-live" style={{ fontSize: 9, marginLeft: 'auto' }}>VOLVER</span>
            </div>
          </>
        )}

        {activeClasses.length > 0 && (
          <>
            <div className="sidebar-section-label">Clases activas en el sistema</div>
            {activeClasses.map(cl => {
              const classId = cl.id || cl._id
              const isMine = String(classId) === String(activeClassId)
              if (isMine && activePage === 'classroom') return null
              return (
                <div key={classId} className="sidebar-item" style={{ fontSize: 11 }} onClick={() => { 
                  if (cl.startTime) {
                    const [h, m] = cl.startTime.split(':')
                    const start = new Date(currentTime)
                    start.setHours(parseInt(h), parseInt(m), 0, 0)
                    if (currentTime < start) {
                      alert(`La clase "${cl.title}" aún no ha comenzado. Programada para las ${cl.startTime}`)
                      return
                    }
                  }
                  setActiveClassId(classId)
                  setActivePage('classroom') 
                }}>
                  <span className="item-icon">●</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cl.title}
                  </span>
                  {isMine && <span className="badge badge-primary" style={{ fontSize: 8 }}>TÚ</span>}
                </div>
              )
            })}
          </>
        )}
      </nav>

      {/* User */}
      <div className="sidebar-footer">
        <div className="user-pill">
          <Avatar user={currentUser} size="sm" />
          <div className="user-info">
            <div className="user-name">{currentUser?.name}</div>
            <div className="user-role">{roleLabel[currentUser?.role]}</div>
          </div>
          <button className="logout-btn" title="Cerrar sesión" onClick={logout}>↩</button>
        </div>
      </div>
    </aside>
  )
}
