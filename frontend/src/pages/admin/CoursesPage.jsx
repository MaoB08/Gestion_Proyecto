import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header purple">
          <div className="modal-title" style={{ color: 'white' }}>➕ {title}</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export default function CoursesPage() {
  const { users, courses, classes, createCourse, updateCourse, deleteCourse, enrollStudent, unenrollStudent, createClass, refreshData, fetchCoursesAdvanced } = useApp()
  const [modal, setModal]     = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch]   = useState('')
  const [form, setForm]       = useState({ name: '', description: '', category: '', teacherId: '', estado: 'Activo', tipoInscripcion: 'Abierto', maxStudents: 20 })
  const [error, setError]     = useState('')
  const [reportModal, setReportModal] = useState(false)
  const [reportData, setReportData] = useState([])
  const [reportLoading, setReportLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [dynamicCourses, setDynamicCourses] = useState(null)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshData()
    setIsRefreshing(false)
  }

  const teachers = users.filter(u => u.role === 'teacher')
  const students = users.filter(u => u.role === 'student')

  const [sortConfig, setSortConfig] = useState({ field: null, order: 'asc' })
  const [sortedCourses, setSortedCourses] = useState(null)

  useEffect(() => {
    const fetchSorted = async () => {
      if (!sortConfig.field) {
        setSortedCourses(null)
        return
      }
      try {
        let url = `http://localhost:3001/api/courses?sortBy=${sortConfig.field}&order=${sortConfig.order}`
        if (filterCategory) url += `&category=${encodeURIComponent(filterCategory)}`
        if (filterEstado) url += `&estado=${encodeURIComponent(filterEstado)}`
        
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setSortedCourses(data)
        }
      } catch (err) {
        console.error('Error fetching sorted courses', err)
      }
    }
    fetchSorted()
  }, [sortConfig, filterCategory, filterEstado])

  useEffect(() => {
    if ((filterCategory || filterEstado) && !sortConfig.field) {
      fetchCoursesAdvanced(filterCategory, filterEstado).then(data => {
        setDynamicCourses(data)
      })
    } else {
      setDynamicCourses(null)
    }
  }, [filterCategory, filterEstado, sortConfig.field])

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }))
  }

  const openReportModal = async () => {
    setReportModal(true)
    setReportLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/courses/reports/categories')
      if (res.ok) {
        const data = await res.json()
        setReportData(data)
      }
    } catch (err) {
      console.error('Error fetching report', err)
    } finally {
      setReportLoading(false)
    }
  }

  const getCourseClasses = (courseId) => classes.filter(cl => cl.courseId === courseId)

  const baseCourses = sortedCourses || dynamicCourses || courses
  const filtered = baseCourses.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setForm({ name: '', description: '', category: '', teacherId: '', estado: 'Activo', tipoInscripcion: 'Abierto', maxStudents: 20 }); setError(''); setModal('create') }
  const openEdit   = (c) => { 
    setSelected(c); 
    const currentTeacherId = c.teacherId?._id || c.teacherId || '';
    setForm({ 
      name: c.name, 
      description: c.description, 
      category: c.category, 
      teacherId: currentTeacherId, 
      estado: c.estado || 'Activo',
      tipoInscripcion: c.tipoInscripcion || 'Abierto',
      maxStudents: c.maxStudents || 20
    }); 
    setError(''); 
    setModal('edit') 
  }
  const openDetail = (c) => { setSelected(c); setModal('detail') }
  const closeModal = () => { setModal(null); setSelected(null); setError('') }

  const handleCreate = async () => {
    if (!form.name) { setError('El nombre del curso es requerido'); return }
    if (form.estado === 'En espera de docente' && form.teacherId) {
      setError('No se puede asignar un profesor si el curso está en espera de docente');
      return;
    }
    const res = await createCourse(form)
    if (res?.success) closeModal()
    else setError(res?.error || 'Error desconocido')
  }

  const handleEdit = async () => {
    if (!form.name) { setError('El nombre del curso es requerido'); return }
    if (form.estado === 'En espera de docente' && form.teacherId) {
      setError('No se puede asignar un profesor si el curso está en espera de docente');
      return;
    }
    const res = await updateCourse(selected.id || selected._id, form)
    if (res?.success) closeModal()
    else setError(res?.error || 'Error desconocido')
  }

  const handleDelete = async (id) => {
    const course = courses.find(c => (c.id || c._id) === id);
    if (course && course.studentIds?.length > 0) {
      if (!window.confirm('⚠️ ADVERTENCIA: Este curso tiene estudiantes inscritos. ¿Estás absolutamente seguro de eliminarlo? Esto afectará a los estudiantes.')) return;
    } else {
      if (!window.confirm('¿Eliminar este curso y todas sus clases?')) return;
    }
    
    const res = await deleteCourse(id)
    if (!res?.success) alert(res?.error || 'No se pudo eliminar el curso')
  }



  const CATEGORIES = ['Informática', 'Matemáticas', 'Ciencias', 'Historia', 'Idiomas', 'Arte', 'Ingeniería', 'General']
  const THUMB_EMOJIS = { Informática: '💻', Matemáticas: '📐', Ciencias: '🔬', Historia: '📚', Idiomas: '🌍', Arte: '🎨', Ingeniería: '⚙️', General: '📖' }

  const DetailModal = () => {
    if (!selected) return null
    const course      = courses.find(c => (c.id || c._id) === selected.id) || selected
    const teacherId   = course.teacherId?._id || course.teacherId
    const teacher     = users.find(u => (u.id || u._id) === teacherId)
    const enrolled    = students.filter(s => course.studentIds.map(String).includes(String(s.id || s._id)))
    const notEnrolled = students.filter(s => !course.studentIds.map(String).includes(String(s.id || s._id)))
    const courseClasses = getCourseClasses(course.id || course._id)

    return (
      <div className="modal-overlay" onClick={closeModal}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">📚 {course.name}</div>
            <button className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left: info */}
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{course.description}</p>
                <div className="report-row"><span className="report-label">Categoría</span><span className="badge badge-primary">{course.category}</span></div>
                <div className="report-row"><span className="report-label">Profesor</span><span>{teacher ? teacher.name : <span className="text-muted">Sin asignar</span>}</span></div>
                <div className="report-row"><span className="report-label">Estudiantes</span><span className="report-value">{enrolled.length} / {course.maxStudents || 20}</span></div>
                <div className="report-row"><span className="report-label">Clases</span><span className="report-value">{courseClasses.length}</span></div>

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Asignar Profesor</label>
                  <select className="form-select" value={ teacherId || '' } onChange={e => updateCourse(course.id || course._id, { teacherId: e.target.value || null })}>
                    <option value="">— Sin asignar —</option>
                    {teachers.map(t => <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Right: students and classes */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Estudiantes inscritos ({enrolled.length})</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', marginBottom: 20 }}>
                  {enrolled.map(s => (
                    <div key={s.id || s._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-page)' }}>
                      <Avatar user={s} size="sm" />
                      <span style={{ fontSize: 12, flex: 1 }}>{s.name}</span>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => unenrollStudent(course.id || course._id, s.id || s._id)}>✕</button>
                    </div>
                  ))}
                  {enrolled.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin estudiantes aún</div>}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Clases del curso ({courseClasses.length})</div>
                    <button className="btn btn-xs btn-primary" onClick={() => setModal('create-class')}>+ Nueva Clase</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {courseClasses.map(cl => (
                      <div key={cl.id || cl._id} style={{ padding: '8px 10px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{cl.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{cl.date} • {cl.startTime} - {cl.endTime || '??:??'}</div>
                      </div>
                    ))}
                    {courseClasses.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No hay clases programadas</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={closeModal}>Cerrar</button></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">📚 Gestión de Cursos</div>
          <div className="topbar-subtitle">{courses.length} cursos en el sistema</div>
        </div>
        <div className="topbar-right">
          <button className={`btn btn-secondary ${isRefreshing ? 'loading' : ''}`} onClick={handleRefresh} disabled={isRefreshing} style={{ marginRight: 8 }}>
            🔄 {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button className="btn btn-primary" onClick={openCreate}>➕ Nuevo Curso</button>
        </div>
      </div>

      <div className="page-content fade-in">
        <div className="card">
          <div className="card-body">
            <div className="search-wrap" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span className="search-icon">🔍</span>
                <input className="form-input" placeholder="Buscar por texto..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 160 }}>
                <option value="">Todas las Categorías</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select className="form-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={{ width: 150 }}>
                <option value="">Cualquier Estado</option>
                <option value="Activo">✅ Activo</option>
                <option value="Desactivado">❌ Desactivado</option>
                <option value="En espera de docente">⏳ En espera</option>
                <option value="Pausado">⏸️ Pausado</option>
              </select>
              <button className="btn btn-secondary" onClick={openReportModal}>📊 Reporte</button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Categoría</th>
                  <th>Profesor</th>
                  <th>
                    Estudiantes 
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSort('students')} style={{ padding: '0 4px', fontSize: 12 }}>
                      {sortConfig.field === 'students' ? (sortConfig.order === 'asc' ? '⬆️' : '⬇️') : '↕️'}
                    </button>
                  </th>
                  <th>
                    Clases 
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSort('classes')} style={{ padding: '0 4px', fontSize: 12 }}>
                      {sortConfig.field === 'classes' ? (sortConfig.order === 'asc' ? '⬆️' : '⬇️') : '↕️'}
                    </button>
                  </th>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><span className="empty-state-icon">📚</span><div className="empty-state-title">Sin cursos</div></div></td></tr>
                ) : filtered.map(c => {
                  const teacherId   = c.teacherId?._id || c.teacherId
                  const teacher     = users.find(u => (u.id || u._id) === teacherId)
                  const courseClasses = getCourseClasses(c.id || c._id)
                  const pendingCount = (c.pendingStudentIds || []).length

                  return (
                    <tr key={c.id || c._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                            {THUMB_EMOJIS[c.category] || '📖'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.description?.slice(0, 50)}...</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{c.category}</span></td>
                      <td>
                        {teacher ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar user={teacher} size="sm" />
                            <span style={{ fontSize: 12 }}>{teacher.name}</span>
                          </div>
                        ) : <span className="badge badge-warning">Sin asignar</span>}
                      </td>
                      <td>
                        <span className="badge badge-info">{c.studentIds.length} / {c.maxStudents || 20} 👥</span>
                        {pendingCount > 0 && (
                          <span className="badge badge-danger" style={{ marginLeft: 4, fontSize: 10 }}>{pendingCount} ⏳</span>
                        )}
                      </td>
                      <td><span className="badge badge-gray">{courseClasses.length} clases</span></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className={`badge ${
                            c.estado === 'Activo' ? 'badge-success' : 
                            c.estado === 'Pausado' ? 'badge-warning' : 
                            c.estado === 'Desactivado' ? 'badge-danger' : 'badge-gray'
                          }`} style={{ fontSize: 10 }}>
                            {c.estado || 'Activo'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${c.tipoInscripcion === 'Cerrado' ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: 10 }}>
                          {c.tipoInscripcion === 'Cerrado' ? '🔒 Cerrado' : '🔓 Abierto'}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => openDetail(c)}>👁️</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c)}>✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id || c._id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal === 'create' && (
        <Modal title="Nuevo Curso" onClose={closeModal}
          footer={<><button className="btn btn-secondary" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" onClick={handleCreate}>Crear Curso</button></>}>
          <div className="form-group"><label className="form-label">Nombre del curso *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Cálculo Diferencial" /></div>
          <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción del curso..." /></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">— Seleccionar —</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Profesor</label>
              <select className="form-select" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">— Sin asignar —</option>
                {teachers.map(t => <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Estado del Curso</label>
            <select className="form-select" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
              <option value="Activo">✅ Activo</option>
              <option value="Desactivado">❌ Desactivado</option>
              <option value="En espera de docente">⏳ En espera de docente</option>
              <option value="Pausado">⏸️ Pausado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de Inscripción</label>
            <select className="form-select" value={form.tipoInscripcion} onChange={e => setForm({ ...form, tipoInscripcion: e.target.value })}>
              <option value="Abierto">🔓 Abierto (Solicitud)</option>
              <option value="Cerrado">🔒 Cerrado (Privado)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Capacidad Máxima (Máximo 20 estudiantes)</label>
            <input type="number" className="form-input" value={form.maxStudents} onChange={e => setForm({ ...form, maxStudents: parseInt(e.target.value) || 0 })} min="1" max="20" />
            <small style={{ color: 'var(--text-muted)' }}>* Límite permitido por el sistema: 20 estudiantes</small>
          </div>
          {error && <div className="form-error">⚠️ {error}</div>}
        </Modal>
      )}

      {modal === 'edit' && selected && (
        <Modal title="Editar Curso" onClose={closeModal}
          footer={<><button className="btn btn-secondary" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" onClick={handleEdit}>Guardar Cambios</button></>}>
          <div className="form-group"><label className="form-label">Nombre del curso *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Descripción</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Profesor</label>
              <select className="form-select" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">— Sin asignar —</option>
                {teachers.map(t => <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-select" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
              <option value="Activo">✅ Activo</option>
              <option value="Desactivado">❌ Desactivado</option>
              <option value="En espera de docente">⏳ En espera de docente</option>
              <option value="Pausado">⏸️ Pausado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo de Inscripción</label>
            <select className="form-select" value={form.tipoInscripcion} onChange={e => setForm({ ...form, tipoInscripcion: e.target.value })}>
              <option value="Abierto">🔓 Abierto (Solicitud)</option>
              <option value="Cerrado">🔒 Cerrado (Privado)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Capacidad Máxima (Máximo 20 estudiantes)</label>
            <input type="number" className="form-input" value={form.maxStudents} onChange={e => setForm({ ...form, maxStudents: parseInt(e.target.value) || 0 })} min="1" max="20" />
            <small style={{ color: 'var(--text-muted)' }}>* Límite permitido por el sistema: 20 estudiantes</small>
          </div>
          {error && <div className="form-error">⚠️ {error}</div>}
        </Modal>
      )}

      {modal === 'detail' && <DetailModal />}

      {modal === 'create-class' && selected && (
        <Modal title={`Nueva Clase - ${selected.name}`} onClose={() => setModal('detail')}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal('detail')}>Volver</button>
              <button className="btn btn-primary" onClick={async () => {
                const classData = {
                  courseId: selected.id || selected._id,
                  title: document.getElementById('cl-title').value,
                  description: document.getElementById('cl-desc').value,
                  date: document.getElementById('cl-date').value,
                  startTime: document.getElementById('cl-start').value,
                  endTime: document.getElementById('cl-end').value,
                  sessionType: document.getElementById('cl-type').value
                };
                if (!classData.title || !classData.date || !classData.startTime || !classData.endTime) {
                  alert('Todos los campos marcados con (*) son obligatorios');
                  return;
                }
                const res = await createClass(classData);
                if (res.success) {
                  setModal('detail');
                } else {
                  alert(res.error);
                }
              }}>Crear Clase</button>
            </>
          }>
          <div className="form-group">
            <label className="form-label">TÍTULO DE LA CLASE *</label>
            <input id="cl-title" className="form-input" placeholder="Ej: Introducción a SQL" maxLength="100" />
          </div>
          <div className="form-group">
            <label className="form-label">DESCRIPCIÓN</label>
            <textarea id="cl-desc" className="form-textarea" placeholder="Descripción opcional..." maxLength="500" rows="2" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">FECHA *</label>
              <input id="cl-date" className="form-input" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-group">
              <label className="form-label">INICIO *</label>
              <input id="cl-start" className="form-input" type="time" />
            </div>
            <div className="form-group">
              <label className="form-label">FIN *</label>
              <input id="cl-end" className="form-input" type="time" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">TIPO DE SESIÓN</label>
            <select id="cl-type" className="form-select">
              <option value="Live">📡 Live</option>
              <option value="In-Person">🏫 Presencial</option>
              <option value="Workshop">🔧 Workshop</option>
            </select>
          </div>
        </Modal>
      )}

      {reportModal && (
        <Modal title="📊 Reporte de Categorías" onClose={() => setReportModal(false)}>
          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /> Cargando reporte...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th style={{ textAlign: 'center' }}>Cursos Asociados</th>
                  <th style={{ textAlign: 'center' }}>Clases en Total</th>
                </tr>
              </thead>
              <tbody>
                {reportData.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center' }}>No hay datos disponibles.</td></tr>
                ) : (
                  reportData.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.category}</td>
                      <td style={{ textAlign: 'center' }}>{item.totalCourses}</td>
                      <td style={{ textAlign: 'center' }}>{item.totalClasses}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="btn btn-secondary" onClick={() => setReportModal(false)}>Cerrar</button>
          </div>
        </Modal>
      )}
    </>
  )
}
