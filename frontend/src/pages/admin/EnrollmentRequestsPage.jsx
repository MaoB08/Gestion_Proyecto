import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'

// ── Modal shell ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, footer, size = '' }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header purple">
          <div className="modal-title" style={{ color: 'white' }}>{title}</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── Detail field helper ───────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-light, #F3F4F6)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 160 }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )
}

export default function EnrollmentRequestsPage() {
  const { users, courses, approveEnrollment, rejectEnrollment, refreshData } = useApp()
  const [tab, setTab] = useState('courses') // 'courses' or 'registration'
  const [loading, setLoading]   = useState(false)
  const [regStudents, setRegStudents] = useState([]) // For account registrations
  const [error, setError]       = useState('')
  const [feedback, setFeedback] = useState('')

  const [modal, setModal]       = useState(null)   // 'reg-detail' | 'confirm-reject-reg'
  const [selectedReg, setSelectedReg] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // ── Fetch registration requests ──────────────────────────────────────────
  const fetchRegPending = useCallback(async () => {
    try {
      const res = await fetch(((import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')) + '/api/students/pending')
      if (res.ok) {
        const data = await res.json()
        setRegStudents(data)
      }
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    fetchRegPending()
  }, [fetchRegPending])

  // ── Combined Refresh ──────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setLoading(true)
    await Promise.all([refreshData(), fetchRegPending()])
    setLoading(false)
    setFeedback('🔄 Datos actualizados')
    setTimeout(() => setFeedback(''), 3000)
  }

  // ── Course Enrollment Handlers ────────────────────────────────────────────
  const courseRequests = courses.flatMap(c => (c.pendingStudentIds || []).map(sid => {
    const student = users.find(u => (u.id || u._id) === sid)
    return student ? { ...student, courseId: c.id || c._id, courseName: c.name, courseCategory: c.category } : null
  })).filter(Boolean)

  const onApproveEnroll = async (courseId, studentId, studentName) => {
    setActionLoading(true)
    const res = await approveEnrollment(courseId, studentId)
    if (res?.success) {
      setFeedback(`✅ Inscripción de ${studentName} aprobada`)
      setTimeout(() => setFeedback(''), 3500)
    }
    setActionLoading(false)
  }

  const onRejectEnroll = async (courseId, studentId, studentName) => {
    if (!window.confirm(`¿Rechazar la solicitud de ${studentName}?`)) return
    setActionLoading(true)
    const res = await rejectEnrollment(courseId, studentId)
    if (res?.success) {
      setFeedback(`🗑️ Solicitud de ${studentName} rechazada`)
      setTimeout(() => setFeedback(''), 3500)
    }
    setActionLoading(false)
  }

  // ── Account Registration Handlers ─────────────────────────────────────────
  const onApproveReg = async (student) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/+$/, "")}/api/students/${student._id}/approve`, { method: 'PUT' })
      if (!res.ok) throw new Error()
      setRegStudents(prev => prev.filter(s => s._id !== student._id))
      setModal(null)
      setFeedback(`✅ Cuenta de ${student.nombre} ${student.apellido} aprobada.`)
      setTimeout(() => setFeedback(''), 3500)
      refreshData()
    } catch {
      setError('Error al aprobar cuenta.')
    }
    setActionLoading(false)
  }

  const onRejectReg = async () => {
    if (!selectedReg) return
    setActionLoading(true)
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/+$/, "")}/api/students/${selectedReg._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setRegStudents(prev => prev.filter(s => s._id !== selectedReg._id))
      setModal(null)
      setFeedback(`🗑️ Registro de ${selectedReg.nombre} ${selectedReg.apellido} eliminado.`)
      setTimeout(() => setFeedback(''), 3500)
    } catch {
      setError('Error al eliminar registro.')
    }
    setActionLoading(false)
  }

  const openRegDetail = (s) => { setSelectedReg(s); setModal('reg-detail') }
  const closeModal = () => { setModal(null); setSelectedReg(null); setError('') }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">📋 Solicitudes de Inscripción</div>
          <div className="topbar-subtitle">Gestión de autorizaciones y registros</div>
        </div>
        <div className="topbar-right">
          <button className={`btn btn-secondary btn-sm ${loading ? 'loading' : ''}`} onClick={handleRefresh} disabled={loading}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className="page-content fade-in">
        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>
            📚 Inscripción a Cursos <span className="tab-count">{courseRequests.length}</span>
          </button>
          <button className={`tab-btn ${tab === 'registration' ? 'active' : ''}`} onClick={() => setTab('registration')}>
            👤 Registro de Usuarios <span className="tab-count">{regStudents.length}</span>
          </button>
        </div>

        {feedback && (
          <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #A7F3D0' }}>
            {feedback}
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {tab === 'courses' ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Curso Solicitado</th>
                    <th>Categoría</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {courseRequests.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state" style={{ padding: '60px 0' }}>
                          <span className="empty-state-icon">🏜️</span>
                          <div className="empty-state-title">Sin solicitudes de inscripción</div>
                          <div className="empty-state-desc">Los estudiantes que soliciten entrar a cursos abiertos aparecerán aquí.</div>
                        </div>
                      </td>
                    </tr>
                  ) : courseRequests.map((req, idx) => (
                    <tr key={`${req.courseId}-${req.id || req._id}-${idx}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar user={req} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{req.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{req.email || req.correo}</div>
                          </div>
                        </div>
                      </td>
                      <td><div style={{ fontWeight: 600, fontSize: 13 }}>{req.courseName}</div></td>
                      <td><span className="badge badge-gray">{req.courseCategory}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            className="btn btn-sm btn-success" 
                            style={{ background: 'var(--success)', color: 'white', border: 'none' }}
                            onClick={() => onApproveEnroll(req.courseId, req.id || req._id, req.name)}
                            disabled={actionLoading}
                          >
                            ✅ Aprobar
                          </button>
                          <button 
                            className="btn btn-sm btn-outline" 
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => onRejectEnroll(req.courseId, req.id || req._id, req.name)}
                            disabled={actionLoading}
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Documento</th>
                    <th>Correo</th>
                    <th>Institución</th>
                    <th>Fecha solicitud</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {regStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state" style={{ padding: '60px 0' }}>
                          <span className="empty-state-icon">👤</span>
                          <div className="empty-state-title">Sin solicitudes de registro</div>
                          <div className="empty-state-desc">No hay cuentas nuevas pendientes de aprobación.</div>
                        </div>
                      </td>
                    </tr>
                  ) : regStudents.map(s => {
                    const fullName = `${s.nombre} ${s.apellido}`
                    return (
                      <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => openRegDetail(s)}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar user={{ name: fullName }} size="sm" />
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{fullName}</div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{s.documento}</td>
                        <td style={{ fontSize: 12 }}>{s.correo}</td>
                        <td style={{ fontSize: 12 }}>{s.institucion}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(s.createdAt)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-sm btn-success" style={{ background: 'var(--success)', color: 'white', border: 'none' }} onClick={() => onApproveReg(s)} disabled={actionLoading}>✅</button>
                            <button className="btn btn-sm btn-danger" onClick={() => { setSelectedReg(s); setModal('confirm-reject-reg') }} disabled={actionLoading}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modal === 'reg-detail' && selectedReg && (
        <Modal title="👤 Detalle de Registro" onClose={closeModal} footer={<><button className="btn btn-secondary" onClick={closeModal}>Cerrar</button><button className="btn btn-primary" style={{ background: 'var(--success)', color: 'white', border: 'none' }} onClick={() => onApproveReg(selectedReg)} disabled={actionLoading}>Aprobar Cuenta</button></>}>
          <DetailRow label="Nombre completo" value={`${selectedReg.nombre} ${selectedReg.apellido}`} />
          <DetailRow label="Documento" value={selectedReg.documento} />
          <DetailRow label="Correo" value={selectedReg.correo} />
          <DetailRow label="Institución" value={selectedReg.institucion} />
          <DetailRow label="Fecha" value={fmtDate(selectedReg.createdAt)} />
        </Modal>
      )}

      {modal === 'confirm-reject-reg' && selectedReg && (
        <Modal title="🗑️ Rechazar Registro" onClose={closeModal} footer={<><button className="btn btn-secondary" onClick={closeModal}>Cancelar</button><button className="btn btn-danger" onClick={onRejectReg} disabled={actionLoading}>Rechazar</button></>}>
          ¿Estás seguro de rechazar y eliminar permanentemente el registro de <strong>{selectedReg.nombre} {selectedReg.apellido}</strong>?
        </Modal>
      )}
    </>
  )
}
