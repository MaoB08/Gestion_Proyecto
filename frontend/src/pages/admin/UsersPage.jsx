import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { DOMAIN_AREAS } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'

const API = 'http://localhost:3001'

// ── Reusable modal shell ──────────────────────────────────────────────────────
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

// ── RF-02 empty form state ────────────────────────────────────────────────────
const EMPTY_TEACHER_FORM = {
  documento: '', nombre: '', apellido: '',
  telefono: '', correo: '', clave: '',
  areaDominio: '', anioInicio: '',
}

const roleLabel = { admin: 'Admin', teacher: 'Profesor', student: 'Estudiante' }
const roleBadge = { admin: 'badge-danger', teacher: 'badge-primary', student: 'badge-info' }

export default function UsersPage() {
  const { createTeacher, updateUser, deleteUser } = useApp()

  // ── DB users (from API) ────────────────────────────────────────────────────
  const [dbUsers, setDbUsers]     = useState([])
  const [loadingDb, setLoadingDb] = useState(true)
  const [dbError, setDbError]     = useState('')
  const [limit, setLimit]         = useState(10)
  const [page, setPage]           = useState(1)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [serverCounts, setServerCounts] = useState({ all: 0, admin: 0, teacher: 0, student: 0 })

  useEffect(() => {
    setPage(1)
  }, [filter, search, limit])

  const fetchUsers = useCallback(async () => {
    setLoadingDb(true)
    setDbError('')
    try {
      const url = new URL(`${API}/api/users/all`)
      url.searchParams.append('limit', limit)
      url.searchParams.append('page', page)
      if (filter !== 'all') url.searchParams.append('role', filter)
      if (search) url.searchParams.append('search', search)

      const res  = await fetch(url.toString())
      if (!res.ok) throw new Error(`Error ${res.status}`)
      
      setServerCounts({
        all: parseInt(res.headers.get('X-Count-All') || '0'),
        admin: parseInt(res.headers.get('X-Count-Admin') || '0'),
        teacher: parseInt(res.headers.get('X-Count-Teacher') || '0'),
        student: parseInt(res.headers.get('X-Count-Student') || '0'),
      })

      const data = await res.json()
      setDbUsers(data)
    } catch {
      setDbError('No se pudo cargar la lista. Verifica que el backend esté corriendo.')
    } finally {
      setLoadingDb(false)
    }
  }, [limit, filter, search, page])

  useEffect(() => { 
    const timer = setTimeout(() => {
      fetchUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchUsers])

  // ── Filters ────────────────────────────────────────────────────────────────

  const calcCount = (total) => limit !== 'Todos' && limit > 0 ? Math.min(total, limit) : total;

  const counts = {
    all:     calcCount(serverCounts.all),
    admin:   calcCount(serverCounts.admin),
    teacher: calcCount(serverCounts.teacher),
    student: calcCount(serverCounts.student),
  }

  const currentTotal = filter === 'all' ? serverCounts.all : serverCounts[filter]
  const totalPages = (limit > 0 && limit !== 'Todos') ? Math.max(1, Math.ceil(currentTotal / limit)) : 1

  const filtered = dbUsers

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [modal, setModal]       = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState(EMPTY_TEACHER_FORM)
  const [editForm, setEditForm] = useState({
    nombre: '', apellido: '', email: '', password: '', estado: true,
    documento: '', telefono: '', areaDominio: '', anioInicio: '',
    institucion: '', anioNacimiento: ''
  })
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [loading, setLoading]   = useState(false)

  const openCreate = () => { setForm(EMPTY_TEACHER_FORM); setError(''); setSuccess(''); setModal('create') }
  const openEdit   = (u) => {
    setSelected(u)
    setEditForm({
      nombre: u.nombre || '',
      apellido: u.apellido || '',
      email: u.email || '',
      password: '',
      estado: u.estado !== false,
      documento: u.documento || '',
      telefono: u.telefono || '',
      areaDominio: u.areaDominio || '',
      anioInicio: u.anioInicio || '',
      institucion: u.institucion || '',
      anioNacimiento: u.anioNacimiento || ''
    })
    setError(''); setSuccess(''); setModal('edit')
  }
  const openDelete = (u) => { setSelected(u); setModal('delete') }
  const closeModal = () => { setModal(null); setSelected(null); setError(''); setSuccess('') }

  const setF = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const setE = (field) => (e) => setEditForm({ ...editForm, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  // ── RF-02 create teacher ───────────────────────────────────────────────────
  const handleCreate = async () => {
    setError('')
    setLoading(true)
    const result = await createTeacher(form)
    setLoading(false)
    if (!result.success) { setError(result.error); return }
    setForm(EMPTY_TEACHER_FORM)
    setSuccess(`✅ Profesor "${result.user.name}" registrado correctamente.`)
    fetchUsers()
    setTimeout(() => closeModal(), 1800)
  }

  // ── RF-04 Edit ─────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editForm.nombre || !editForm.email) { 
      setError('Nombre y correo son requeridos'); 
      return 
    }
    
    setLoading(true)
    setError('')
    
    // Clean payload based on role to avoid validation errors for unknown fields
    const payload = {
      nombre: editForm.nombre,
      apellido: editForm.apellido,
      correo: editForm.email,
      telefono: editForm.telefono,
      documento: editForm.documento,
      estado: editForm.estado
    }

    if (editForm.password) {
      payload.clave = editForm.password
    }

    if (selected.role === 'teacher') {
      payload.areaDominio = editForm.areaDominio
      payload.anioInicio = editForm.anioInicio
    } else if (selected.role === 'student') {
      payload.institucion = editForm.institucion
      payload.anioNacimiento = editForm.anioNacimiento
    }

    const result = await updateUser(selected.role, selected.id, payload)
    setLoading(false)
    
    if (result.success) {
      setSuccess('✅ Usuario actualizado correctamente')
      fetchUsers()
      setTimeout(() => closeModal(), 1500)
    } else {
      setError(result.error || 'Error al actualizar el usuario')
    }
  }

  // ── RF-04 Delete ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setLoading(true)
    const result = await deleteUser(selected.role, selected.id)
    setLoading(false)
    if (result.success) {
      fetchUsers()
      closeModal()
    } else {
      setError(result.error || 'Error al eliminar el usuario')
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">👥 Gestión de Usuarios</div>
          <div className="topbar-subtitle">
            {loadingDb ? 'Cargando...' : `${counts.all} usuarios en el sistema`}
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers} title="Actualizar lista">🔄 Actualizar</button>
          <button className="btn btn-primary" onClick={openCreate}>＋ Nuevo Profesor</button>
        </div>
      </div>

      <div className="page-content fade-in">
        <div className="card">
          <div className="card-body">
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="search-wrap" style={{ flex: 1, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span className="search-icon">🔍</span>
                  <input
                    className="form-input"
                    placeholder="Buscar usuario..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div style={{ width: 160 }}>
                  <select className="form-select" value={limit} onChange={e => setLimit(e.target.value === 'Todos' ? 'Todos' : Number(e.target.value))}>
                    <option value={10}>10 por página</option>
                    <option value={25}>25 por página</option>
                    <option value={50}>50 por página</option>
                    <option value="Todos">Todos</option>
                  </select>
                </div>
              </div>
              {['all', 'admin', 'teacher', 'student'].map(r => (
                <button
                  key={r}
                  className={`btn btn-sm ${filter === r ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilter(r)}
                >
                  {r === 'all' ? 'Todos' : roleLabel[r]} <span style={{ marginLeft: 6, fontSize: 11 }}>{counts[r]}</span>
                </button>
              ))}
            </div>

            {dbError && <div className="form-error" style={{ marginBottom: 12 }}>⚠️ {dbError}</div>}

            {loadingDb ? (
              <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /> Cargando lista...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Documento</th>
                    <th>Email</th>
                    <th>Área / Institución</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7}><div className="empty-state"><span className="empty-state-icon">👤</span><div className="empty-state-title">No hay usuarios</div></div></td></tr>
                  ) : filtered.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar user={u} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                            {u.telefono && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📞 {u.telefono}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{u.documento || '—'}</td>
                      <td style={{ fontSize: 12 }}>{u.email}</td>
                      <td>
                        {u.areaDominio ? <span className="badge badge-primary">{u.areaDominio}</span> : 
                         u.institucion ? <span style={{ fontSize: 12 }}>🏫 {u.institucion}</span> : '—'}
                      </td>
                      <td><span className={`badge ${roleBadge[u.role]}`}>{roleLabel[u.role]}</span></td>
                      <td>
                        <span className={`badge ${u.estado !== false ? 'badge-success' : 'badge-gray'}`}>
                          {u.aprobado === false ? 'Pendiente' : (u.estado !== false ? 'Activo' : 'Inactivo')}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}>✏️</button>
                          {u.role !== 'admin' && <button className="btn btn-sm btn-danger" onClick={() => openDelete(u)}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!loadingDb && limit !== 'Todos' && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  Página {page} de {totalPages}
                </span>
                <button 
                  className="btn btn-secondary btn-sm" 
                  disabled={page === totalPages} 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal === 'create' && (
        <Modal
          title="➕ Nuevo Profesor" size="modal-lg" onClose={closeModal}
          footer={<><button className="btn btn-secondary" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" onClick={handleCreate} disabled={loading}>{loading ? 'Guardando...' : 'Crear Profesor'}</button></>}
        >
          <div className="form-row">
            <div className="form-group"><label className="form-label">Documento *</label><input className="form-input" value={form.documento} onChange={setF('documento')} maxLength={11} /></div>
            <div className="form-group"><label className="form-label">Teléfono *</label><input className="form-input" value={form.telefono} onChange={setF('telefono')} maxLength={10} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre} onChange={setF('nombre')} /></div>
            <div className="form-group"><label className="form-label">Apellido *</label><input className="form-input" value={form.apellido} onChange={setF('apellido')} /></div>
          </div>
          <div className="form-group"><label className="form-label">Correo *</label><input className="form-input" value={form.correo} onChange={setF('correo')} /></div>
          <div className="form-group"><label className="form-label">Clave *</label><input className="form-input" type="password" value={form.clave} onChange={setF('clave')} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Área *</label><select className="form-select" value={form.areaDominio} onChange={setF('areaDominio')}><option value="">— Seleccionar —</option>{DOMAIN_AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Año Inicio *</label><input className="form-input" value={form.anioInicio} onChange={setF('anioInicio')} maxLength={4} /></div>
          </div>
          {error && <div className="form-error">⚠️ {error}</div>}{success && <div className="form-success">{success}</div>}
        </Modal>
      )}

      {modal === 'edit' && selected && (
        <Modal
          title={`✏️ Editar ${roleLabel[selected.role]}`} size="modal-lg" onClose={closeModal}
          footer={<><button className="btn btn-secondary" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" onClick={handleEdit} disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button></>}
        >
          <div className="form-row">
            <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={editForm.nombre} onChange={setE('nombre')} /></div>
            <div className="form-group"><label className="form-label">Apellido</label><input className="form-input" value={editForm.apellido} onChange={setE('apellido')} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Correo</label><input className="form-input" value={editForm.email} onChange={setE('email')} /></div>
            <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={editForm.telefono} onChange={setE('telefono')} maxLength={10} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Nueva Clave (Opcional)</label>
            <input className="form-input" type="password" value={editForm.password} onChange={setE('password')} placeholder="Dejar vacío para no cambiar" />
          </div>

          {selected.role === 'teacher' && (
            <div className="form-row">
              <div className="form-group"><label className="form-label">Área</label><select className="form-select" value={editForm.areaDominio} onChange={setE('areaDominio')}>{DOMAIN_AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Año Inicio</label><input className="form-input" value={editForm.anioInicio} onChange={setE('anioInicio')} /></div>
            </div>
          )}

          {selected.role === 'student' && (
            <div className="form-row">
              <div className="form-group"><label className="form-label">Institución</label><input className="form-input" value={editForm.institucion} onChange={setE('institucion')} /></div>
              <div className="form-group"><label className="form-label">Año Nacimiento</label><input className="form-input" value={editForm.anioNacimiento} onChange={setE('anioNacimiento')} /></div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={editForm.estado} onChange={setE('estado')} /> Usuario Activo
            </label>
            <span className="form-hint">Si está desactivado, el usuario no podrá iniciar sesión.</span>
          </div>
          {error && <div className="form-error">⚠️ {error}</div>}
          {success && <div className="form-success">{success}</div>}
        </Modal>
      )}

      {modal === 'delete' && selected && (
        <Modal
          title="🗑️ Eliminar Usuario" onClose={closeModal}
          footer={<><button className="btn btn-secondary" onClick={closeModal}>Cancelar</button><button className="btn btn-danger" onClick={handleDelete} disabled={loading}>{loading ? 'Eliminando...' : 'Sí, Eliminar'}</button></>}
        >
          <p>¿Estás seguro de que deseas eliminar permanentemente a <strong>{selected.name}</strong>?</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>⚠️ Esta acción no se puede deshacer.</p>
          {error && <div className="form-error">⚠️ {error}</div>}
        </Modal>
      )}
    </>
  )
}
