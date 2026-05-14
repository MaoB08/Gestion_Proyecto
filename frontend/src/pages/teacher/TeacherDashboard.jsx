import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const THUMB = {
  Informática: '💻',
  Matemáticas: '📐',
  Ciencias: '🔬',
  Historia: '📚',
  Idiomas: '🌍',
  Arte: '🎨',
  Ingeniería: '⚙️',
  General: '📖'
}

function CreateClassModal({ courseId, onClose }) {
  const { createClass, activateClass, setActivePage, setActiveClassId } = useApp()
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    sessionType: 'Live'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!form.title || !form.date || !form.startTime || !form.endTime) {
      setError('Todos los campos marcados con (*) son obligatorios');
      return
    }

    // Time validation (quick FE check)
    const now = new Date()
    const [sy, sm, sd] = form.date.split('-').map(Number)
    const [sh, smin] = form.startTime.split(':').map(Number)
    const startDate = new Date(sy, sm - 1, sd, sh, smin)

    if (startDate.getTime() < now.getTime()) {
      setError('La fecha y hora de inicio no pueden ser anteriores a la actual');
      return;
    }

    const [eh, emin] = form.endTime.split(':').map(Number)
    const t1 = sh * 60 + smin
    const t2 = eh * 60 + emin

    if (t2 <= t1) {
      setError('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }

    if (t2 - t1 > 240) {
      setError('La duración de la clase no puede exceder las 4 horas');
      return;
    }

    setLoading(true)
    setError('')
    const result = await createClass({ ...form, courseId })
    setLoading(false)

    if (result && result.success) {
      // Logic for initiating class: only enter if it's already time
      const currentTime = new Date()
      if (startDate <= currentTime) {
        setActiveClassId(result.class.id)
        setActivePage('classroom')
      } else {
        alert('Clase programada correctamente. Podrás iniciarla desde el panel cuando llegue la hora.')
      }
      onClose()
    } else {
      setError(result.error || 'Error al crear la clase')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header purple">
          <div className="modal-title" style={{ color: 'white' }}>➕ Crear Nueva Clase</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">TÍTULO DE LA CLASE *</label>
            <input className="form-input" placeholder="Ej: Relatividad Especial — Workshop" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus maxLength="100" />
          </div>
          <div className="form-group">
            <label className="form-label">DESCRIPCIÓN (OPCIONAL)</label>
            <textarea className="form-textarea" placeholder="Describe brevemente el tema de la clase..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength="500" rows="2" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">FECHA *</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">HORA INICIO *</label>
              <input className="form-input" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">HORA FIN *</label>
              <input className="form-input" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">TIPO DE SESIÓN</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Live', 'In-Person', 'Workshop'].map(type => (
                <button key={type} type="button"
                  className={`btn ${form.sessionType === type ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setForm({ ...form, sessionType: type })}
                >
                  {type === 'Live' ? '📡 Live' : type === 'In-Person' ? '🏫 Presencial' : '🔧 Workshop'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" defaultChecked id="autoRecord" />
            <label htmlFor="autoRecord" style={{ fontSize: 13, cursor: 'pointer' }}>
              <strong>Auto-guardar transcripción</strong><br />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>La transcripción se guardará automáticamente al finalizar la clase</span>
            </label>
          </div>
          {error && <div className="form-error">⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? 'Creando...' : '🚀 Iniciar Clase'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ManageContentsModal({ courseId, onClose }) {
  const { courses, addCourseContent, deleteCourseContent } = useApp()
  const [form, setForm] = useState({ title: '', type: 'Archivo', description: '' })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const course = (courses || []).find(c => (c.id === courseId || c._id === courseId))
  const contents = (course && course.contents) || []

  const handleAdd = async () => {
    if (!form.title) { setError('El título es requerido'); return }
    if (form.type === 'Archivo' && !file) { setError('Debes seleccionar un archivo'); return }

    setError('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('type', form.type);
    formData.append('description', form.description);
    if (form.type === 'Archivo' && file) {
      formData.append('file', file);
    }

    const res = await addCourseContent(courseId, formData);
    setIsUploading(false);

    if (res && res.success) {
      setForm({ title: '', type: 'Archivo', description: '' });
      setFile(null);
      onClose();
    } else {
      setError((res && res.error) || 'Error al agregar contenido');
    }
  }

  const handleDelete = async (contentId) => {
    if (!window.confirm('¿Seguro que deseas eliminar este material?')) return;
    const res = await deleteCourseContent(courseId, contentId);
    if (res && !res.success) alert(res.error || 'No se pudo eliminar');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <div className="modal-header purple">
          <div className="modal-title" style={{ color: 'white' }}>📂 Materiales: {course?.name}</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxHeight: '70vh', overflowY: 'auto' }}>

          <div>
            <h4 style={{ marginBottom: 12 }}>Contenidos Publicados ({contents.length})</h4>
            {contents.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no hay materiales subidos a este curso.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contents.map(cnt => (
                  <div key={cnt._id} style={{ padding: 12, background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{cnt.title}</div>
                      <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(cnt._id)}>🗑️</button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span className={`badge ${cnt.type === 'Archivo' ? 'badge-primary' : cnt.type === 'Actividad' ? 'badge-success' : 'badge-warning'}`}>
                        {cnt.type}
                      </span>
                      <span style={{ marginLeft: 6 }}>{cnt.createdAt ? new Date(cnt.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                    {cnt.description && <div style={{ fontSize: 12, marginTop: 6 }}>{cnt.description}</div>}
                    {cnt.fileUrl && (
                      <div style={{ marginTop: 10 }}>
                        <a
                          href={`http://localhost:3001${cnt.fileUrl}`}
                          download={cnt.originalName || cnt.title}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-primary"
                          style={{ fontSize: 11, width: '100%', justifyContent: 'center' }}
                        >
                          ⬇️ Descargar: {cnt.originalName || 'Archivo'}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {course?.estado === 'Activo' ? (
            <div style={{ background: 'var(--primary-bg)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)' }}>
              <h4 style={{ marginBottom: 12 }}>Agregar Nuevo Contenido</h4>
              <div className="form-group">
                <label className="form-label">TÍTULO *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Lectura Semana 1" maxLength="100" />
              </div>
              <div className="form-group">
                <label className="form-label">TIPO *</label>
                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="Archivo">Archivo</option>
                  <option value="Actividad">Actividad</option>
                  <option value="Anuncio">Anuncio</option>
                </select>
              </div>
              {form.type === 'Archivo' && (
                <div className="form-group">
                  <label className="form-label">ARCHIVO (PDF, DOCX, PPTX - Máx 50MB) *</label>
                  <input type="file" className="form-input" onChange={e => setFile(e.target.files[0])} accept=".pdf,.docx,.pptx" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">DESCRIPCIÓN</label>
                <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Instrucciones o notas adicionales..." maxLength="500"></textarea>
              </div>
              {error && <div className="form-error" style={{ marginBottom: 10 }}>⚠️ {error}</div>}
              <button className="btn btn-primary w-full" onClick={handleAdd} disabled={isUploading}>
                {isUploading ? 'Subiendo...' : '➕ Publicar Contenido'}
              </button>
            </div>
          ) : (
            <div style={{ background: '#F9FAFB', padding: 20, borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
              <div style={{ fontWeight: 600 }}>Gestión Deshabilitada</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Este curso no está <b>Activo</b>. Solo puedes visualizar o eliminar contenidos existentes.</p>
            </div>
          )}

        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function CourseClassesModal({ courseId, onClose }) {
  const { courses, getClassesForCourse, fetchClassesByCourse } = useApp()
  const course = courses.find(c => (c.id === courseId || c._id === courseId))

  useEffect(() => {
    fetchClassesByCourse(courseId)
  }, [courseId])

  const courseClasses = getClassesForCourse(courseId) || []
  const pastClasses = courseClasses.filter(cl => !cl.isActive).reverse()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <div className="modal-header purple">
          <div className="modal-title" style={{ color: 'white' }}>📋 Clases Anteriores: {course?.name}</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {pastClasses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📋</span>
              <div className="empty-state-title">No hay clases finalizadas</div>
              <div className="empty-state-desc">Las clases aparecerán aquí una vez que hayan finalizado y se guarde su transcripción.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Título</th><th>Fecha</th><th>Asistentes</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {pastClasses.map(cl => (
                  <tr key={cl.id}>
                    <td><div style={{ fontWeight: 600 }}>{cl.title}</div></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cl.date}</td>
                    <td><span className="badge badge-primary">{(cl.attendance || []).length} 👥</span></td>
                    <td>
                      <span className={`badge ${cl.savedTranscription ? 'badge-success' : 'badge-gray'}`}>
                        {cl.savedTranscription ? '✅ Guardada' : 'Finalizada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── Advanced Grades Modal ────────────────────────────────────────────────────
function AdvancedGradesModal({ courseId, onClose }) {
  const [activeTier, setActiveTier] = useState('todas')  // 'todas' | 'inferior' | 'estandar' | 'sobresaliente'
  const [results, setResults]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const TIERS = [
    { key: 'todas',         label: '📚 Todas las notas',        color: '#2563EB', bg: '#EFF6FF', border: '#DBEAFE' },
    { key: 'no-entregados', label: '❌ No entregados',         color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
    { key: 'inferior',      label: '📉 Notas inferiores',      color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    { key: 'estandar',      label: '📊 Notas estándar',         color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    { key: 'sobresaliente', label: '🏆 Notas sobresalientes',   color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  ]

  useEffect(() => {
    fetchTier('todas')
  }, [courseId])

  const fetchTier = async (tier) => {
    setActiveTier(tier)
    setLoading(true)
    setError('')
    setResults([])
    try {
      const res = await fetch(`http://localhost:3001/api/grades/course/${courseId}/tier?tier=${tier}`)
      if (!res.ok) {
        const json = await res.json()
        setError(json.message || 'Error al consultar')
      } else {
        setResults(await res.json())
      }
    } catch {
      setError('No se pudo conectar al servidor')
    } finally {
      setLoading(false)
    }
  }

  const activeMeta = TIERS.find(t => t.key === activeTier)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <div className="modal-header purple">
          <div className="modal-title" style={{ color: 'white' }}>📊 Vista avanzada de notas</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Tier selector buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {TIERS.map(t => (
              <button
                key={t.key}
                onClick={() => fetchTier(t.key)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${activeTier === t.key ? t.color : t.border}`,
                  background: activeTier === t.key ? t.color : t.bg,
                  color: activeTier === t.key ? 'white' : t.color,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {!activeTier && (
            <div className="empty-state">
              <span className="empty-state-icon">📊</span>
              <div className="empty-state-title">Selecciona un rango</div>
              <div className="empty-state-desc">Elige un botón para consultar las notas correspondientes.</div>
            </div>
          )}

          {loading && (
            <div className="empty-state">
              <div className="empty-state-title">Consultando base de datos...</div>
            </div>
          )}

          {error && !loading && (
            <div style={{ background: 'var(--danger-bg)', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--danger)', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && activeTier && (
            results.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">{activeMeta?.key === 'inferior' ? '🎉' : '📭'}</span>
                <div className="empty-state-title">Sin resultados</div>
                <div className="empty-state-desc">No hay calificaciones en este rango para el curso.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {results.length} resultado(s) — ordenados de menor a mayor nota
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Actividad</th>
                        <th>Estudiante</th>
                        <th style={{ textAlign: 'center' }}>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((g, i) => (
                        <tr key={g._id || i}>
                          <td>{g.contentId?.title || '-'}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {g.studentId?.nombre} {g.studentId?.apellido}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.studentId?.documento}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`badge ${
                                g.grade >= 4.0 ? 'badge-success' :
                                g.grade >= 3.0 ? 'badge-warning' :
                                'badge-danger'
                              }`}
                              style={{ fontSize: 13, fontWeight: 700 }}
                            >
                              {g.grade.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function ManageGradesView({ courseId, onBack }) {
  const { courses, users, grades, saveGrade, fetchGradesByCourse } = useApp()
  const [selectedActivityId, setSelectedActivityId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [gradeValue, setGradeValue] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  const [showAdvanced, setShowAdvanced] = useState(false)

  const course = courses.find(c => (c.id === courseId || c._id === courseId))
  const activities = (course?.contents || []).filter(cnt => cnt.type === 'Actividad')
  const enrolledStudents = (course?.studentIds || []).map(sid => users.find(u => String(u.id || u._id) === String(sid))).filter(Boolean)

  useEffect(() => {
    fetchGradesByCourse(courseId)
  }, [courseId])

  const handleSave = async () => {
    if (!selectedActivityId) { setMessage({ text: 'Selecciona una actividad', type: 'error' }); return }
    if (!selectedStudentId) { setMessage({ text: 'Selecciona un estudiante', type: 'error' }); return }
    if (gradeValue === '' || isNaN(gradeValue) || gradeValue < 0 || gradeValue > 5) {
      setMessage({ text: 'Ingresa una nota válida (0-5)', type: 'error' });
      return
    }

    setLoading(true)
    const res = await saveGrade({
      studentId: selectedStudentId,
      courseId,
      contentId: selectedActivityId,
      grade: Number(gradeValue),
      feedback,
      teacherId: course.teacherId
    })
    setLoading(true) // Keep loading true for a moment for UX
    setTimeout(() => setLoading(false), 500)

    if (res.success) {
      setMessage({ text: '✅ Calificación guardada exitosamente', type: 'success' })
      setGradeValue('')
      setFeedback('')
      setTimeout(() => setMessage({ text: '', type: '' }), 3000)
    } else {
      setMessage({ text: `❌ ${res.error}`, type: 'error' })
    }
  }

  const getStudentGrade = (studentId, activityId) => {
    return grades.find(g =>
      String(g.studentId?._id || g.studentId) === String(studentId) &&
      String(g.contentId) === String(activityId)
    )
  }

  if (!course) return (
    <div className="card">
      <div className="card-body">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Volver</button>
        <div style={{ textAlign: 'center', padding: 40 }}>⚠️ Error: Curso no encontrado</div>
      </div>
    </div>
  )

  return (
    <>
      <div className="card fade-in">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 8, padding: 0, color: 'var(--primary)' }}>← Volver a cursos</button>
          <div className="card-title">📝 Gestión de Calificaciones: {course?.name}</div>
          <div className="card-subtitle">Registra y modifica las notas de tus estudiantes</div>
        </div>
      </div>

      <div className="card-body">
        {activities.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🚫</span>
            <div className="empty-state-title">No hay actividades</div>
            <div className="empty-state-desc">Debes crear actividades en la sección de "Gestionar Materiales" antes de calificar.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 30 }}>
            {/* Formulario de Calificación */}
            <div style={{ background: 'var(--bg-page)', padding: 20, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <h4 style={{ marginBottom: 16 }}>Ingresar Calificación</h4>

              <div className="form-group">
                <label className="form-label">ACTIVIDAD *</label>
                <select className="form-select" value={selectedActivityId} onChange={e => setSelectedActivityId(e.target.value)}>
                  <option value="">Seleccione actividad...</option>
                  {activities.map(act => (
                    <option key={act._id} value={act._id}>{act.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ESTUDIANTE *</label>
                <select className="form-select" value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}>
                  <option value="">Seleccione estudiante...</option>
                  {enrolledStudents.map(st => (
                    <option key={st.id || st._id} value={st.id || st._id}>{st.name} ({st.documento})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">NOTA (0.0 - 5.0) *</label>
                <input
                  type="number"
                  className="form-input"
                  step="0.1"
                  min="0"
                  max="5"
                  value={gradeValue}
                  onChange={e => setGradeValue(e.target.value)}
                  placeholder="Ej: 4.5"
                />
              </div>

              <div className="form-group">
                <label className="form-label">RETROALIMENTACIÓN</label>
                <textarea
                  className="form-textarea"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Opcional..."
                  rows="3"
                ></textarea>
              </div>

              {message.text && (
                <div style={{
                  padding: 10,
                  borderRadius: 6,
                  fontSize: 13,
                  marginBottom: 15,
                  background: message.type === 'success' ? '#DEF7EC' : '#FDE8E8',
                  color: message.type === 'success' ? '#03543F' : '#9B1C1C',
                  border: `1px solid ${message.type === 'success' ? '#BCF0DA' : '#F8B4B4'}`
                }}>
                  {message.text}
                </div>
              )}

              <button
                className="btn btn-primary w-full"
                onClick={handleSave}
                disabled={loading}
                style={{ height: 45, fontWeight: 600, color: 'white' }}
              >
                {loading ? 'Guardando...' : '💾 Guardar Calificación'}
              </button>
            </div>

            {/* Tabla de Calificaciones Actuales */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0 }}>Cuadro de Estudiantes ({enrolledStudents.length})</h4>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 13, height: 36 }}
                  onClick={() => setShowAdvanced(true)}
                >
                  📊 Vista avanzada
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      {activities.map(act => (
                        <th key={act._id} title={act.title} style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.title}
                        </th>
                      ))}
                      <th>Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolledStudents.map(st => {
                      let sum = 0;
                      let count = 0;
                      const sId = st.id || st._id;
                      return (
                        <tr key={sId}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{st.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.documento}</div>
                          </td>
                          {activities.map(act => {
                            const g = getStudentGrade(sId, act._id);
                            if (g) {
                              sum += g.grade;
                              count++;
                            }
                            return (
                              <td key={act._id} style={{ textAlign: 'center' }}>
                                <span className={`badge ${g ? (g.grade >= 3 ? 'badge-success' : 'badge-danger') : 'badge-gray'}`} style={{ fontSize: 12 }}>
                                  {g ? g.grade.toFixed(1) : '-'}
                                </span>
                              </td>
                            )
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {count > 0 ? (sum / count).toFixed(1) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {enrolledStudents.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No hay estudiantes inscritos en este curso todavía.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
      {showAdvanced && (
        <AdvancedGradesModal courseId={courseId} onClose={() => setShowAdvanced(false)} />
      )}
    </>
  )
}

// ── GeoMap Modal ────────────────────────────────────────────────────────────
function GeoMapModal({ students, onClose }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  // Only students with valid location
  const geoStudents = students.filter(
    s => s.location?.coordinates?.length === 2
  )

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Fix default marker icon path issue with bundlers
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    const map = L.map(mapRef.current, { zoomControl: true })
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    if (geoStudents.length === 0) {
      map.setView([4.6097, -74.0817], 5) // Colombia center fallback
      return
    }

    const bounds = []
    geoStudents.forEach(st => {
      const [lng, lat] = st.location.coordinates // GeoJSON: [longitude, latitude]
      const name = st.nombre && st.apellido
        ? `${st.nombre} ${st.apellido}`
        : (st.name || 'Estudiante')

      const marker = L.marker([lat, lng]).addTo(map)
      marker.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10] })
      marker.bindPopup(`<b>${name}</b><br/><span style="font-size:12px">Lat: ${lat.toFixed(5)}<br/>Lng: ${lng.toFixed(5)}</span>`)
      bounds.push([lat, lng])
    })

    if (bounds.length === 1) {
      map.setView(bounds[0], 13)
    } else {
      map.fitBounds(bounds, { padding: [40, 40] })
    }

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 900, width: '95vw' }}
      >
        <div className="modal-header" style={{ background: 'linear-gradient(135deg,#0f766e,#0d9488)', color: 'white' }}>
          <div className="modal-title" style={{ color: 'white' }}>🌐 Vista Geoespacial de Estudiantes</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {geoStudents.length === 0 ? (
            <div className="empty-state" style={{ padding: 60 }}>
              <span className="empty-state-icon">📍</span>
              <div className="empty-state-title">Sin ubicaciones registradas</div>
              <div className="empty-state-desc">
                Ningún estudiante de este curso ha iniciado sesión desde un dispositivo con ubicación habilitada.
              </div>
            </div>
          ) : (
            <>
              <div style={{
                padding: '10px 16px',
                background: '#F0FDF4',
                borderBottom: '1px solid #BBF7D0',
                fontSize: 13,
                color: '#166534',
                display: 'flex',
                gap: 6,
                alignItems: 'center'
              }}>
                📍 Mostrando {geoStudents.length} de {students.length} estudiantes con ubicación registrada
              </div>
              <div ref={mapRef} style={{ height: 480, width: '100%' }} />
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function CourseStudentsModal({ courseId, onClose }) {
  const { courses } = useApp()
  const course = courses.find(c => (c.id === courseId || c._id === courseId))
  const [enrolledStudents, setEnrolledStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Esta llamada espera que el backend resuelva la agregación con $project
        const res = await fetch(`http://localhost:3001/api/courses/${courseId}/students`)
        if (res.ok) {
          const data = await res.json()
          setEnrolledStudents(data)
        }
      } catch (err) {
        console.error('Error al obtener estudiantes', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStudents()
  }, [courseId])

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
          <div className="modal-header purple">
            <div className="modal-title" style={{ color: 'white' }}>📄 Estudiantes Inscritos: {course?.name}</div>
            <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? (
              <div className="empty-state">
                <div className="empty-state-title">Cargando estudiantes...</div>
              </div>
            ) : enrolledStudents.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">👥</span>
                <div className="empty-state-title">No hay estudiantes inscritos</div>
                <div className="empty-state-desc">Aún no hay estudiantes en este curso.</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Nombre</th><th>Apellido</th><th>Correo</th></tr>
                </thead>
                <tbody>
                  {enrolledStudents.map(st => {
                    const parts = (st.nombre || st.name || '').split(' ')
                    const nombre = parts[0] || '-'
                    const apellido = st.apellido || parts.slice(1).join(' ') || '-'
                    return (
                      <tr key={st._id || st.id}>
                        <td><div style={{ fontWeight: 600 }}>{nombre}</div></td>
                        <td>{apellido}</td>
                        <td>{st.correo || st.email || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowMap(true)}
              disabled={loading}
            >
              🌐 Vista geoespacial
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
      {showMap && (
        <GeoMapModal students={enrolledStudents} onClose={() => setShowMap(false)} />
      )}
    </>
  )
}

export default function TeacherDashboard() {
  const { currentUser, activePage, classes, courses, users, getCoursesForTeacher, getClassesForCourse, activateClass, updateCourse, setActivePage, setActiveClassId, refreshData, fetchActiveClassesByCourse } = useApp()
  const [showCreateModal, setShowCreateModal] = useState(null)
  const [showContentsModal, setShowContentsModal] = useState(null)
  const [showClassesModal, setShowClassesModal] = useState(null)
  const [showStudentsModal, setShowStudentsModal] = useState(null)
  const [selectedCourseForGrades, setSelectedCourseForGrades] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshData()
    setIsRefreshing(false)
  }

  const myCourses = getCoursesForTeacher(currentUser?.id) || []
  const myClasses = myCourses.flatMap(c => getClassesForCourse(c.id) || [])
  
  const [activeClassesDynamic, setActiveClassesDynamic] = useState([])

  useEffect(() => {
    if (myCourses.length > 0) {
      Promise.all(myCourses.map(c => fetchActiveClassesByCourse(c.id || c._id))).then(results => {
        setActiveClassesDynamic(results.flat())
      })
    }
  }, [courses, classes])

  const activeClasses = activeClassesDynamic
  const pastClasses = myClasses.filter(cl => !cl.isActive && cl.savedTranscription)

  const enterClass = (classId) => {
    const cls = classes.find(cl => String(cl.id || cl._id) === String(classId)) || activeClassesDynamic.find(cl => String(cl.id || cl._id) === String(classId))
    if (cls && cls.startTime) {
      const [h, m] = cls.startTime.split(':')
      const start = new Date(currentTime)
      start.setHours(parseInt(h), parseInt(m), 0, 0)
      if (currentTime < start) {
        alert(`La clase aún no ha comenzado. Por favor, espera hasta las ${cls.startTime} para iniciarla.`)
        return
      }
    }
    setActiveClassId(classId)
    setActivePage('classroom')
  }

  const renderContent = () => {
    if (!activePage || activePage === 'dashboard') {
      return (
        <>
          <div className="stats-grid">
            {[
              { label: 'Mis Cursos', value: myCourses.length, icon: '📚', bg: '#EDE9FE', color: '#7C3AED' },
              { label: 'Clases Dadas', value: myClasses.length, icon: '🎓', bg: '#EFF6FF', color: '#2563EB' },
              { label: 'En Vivo', value: activeClasses.length, icon: '🔴', bg: '#FEF2F2', color: '#DC2626' },
              { label: 'Guardadas', value: pastClasses.length, icon: '💾', bg: '#ECFDF5', color: '#059669' },
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

          {activeClasses.length > 0 && (
            <div className="card" style={{ marginTop: 20, borderColor: 'var(--primary-border)', borderWidth: 2 }}>
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ color: 'var(--primary)' }}>🔴 Clases activas ahora</div>
                  <div className="card-subtitle">Hay {activeClasses.length} clase(s) en vivo</div>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeClasses.map(cl => {
                  const course = myCourses.find(c => c.id === cl.courseId)
                  return (
                    <div key={cl._id || cl.id} className="lobby-card">
                      <div className="lobby-icon" style={{ background: '#FEF2F2' }}>🔴</div>
                      <div className="lobby-info">
                        <div className="lobby-title">{cl.title}</div>
                        <div className="lobby-sub">{course?.name}</div>
                        <div className="lobby-meta">
                          <span>👥 {(cl.participantIds || []).length} conectados</span>
                          <span>❓ {(cl.questions || []).filter(q => q.status === 'pending').length} preguntas pendientes</span>
                        </div>
                      </div>
                      <button className="btn btn-primary" onClick={() => enterClass(cl._id || cl.id)}>→ Entrar</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )
    }

    if (activePage === 'my-courses') {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mis Cursos Asignados</div>
            <div className="card-subtitle">{myCourses.length} cursos</div>
          </div>
          <div className="card-body">
            {myCourses.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📚</span>
                <div className="empty-state-title">Sin cursos asignados</div>
                <div className="empty-state-desc">El administrador aún no te ha asignado ningún curso</div>
              </div>
            ) : (
              <div className="course-grid">
                {myCourses.map(c => {
                  const courseClasses = getClassesForCourse(c.id) || []
                  const hasActive = courseClasses.some(cl => cl.isActive)
                  return (
                    <div key={c.id || c._id} className="course-card slide-up" style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}>
                        <span className={`badge ${c.estado === 'Activo' ? 'badge-success' :
                          c.estado === 'Pausado' ? 'badge-warning' :
                            c.estado === 'Desactivado' ? 'badge-danger' : 'badge-gray'
                          }`} style={{ boxShadow: 'var(--shadow-sm)' }}>
                          {c.estado || 'Activo'}
                        </span>
                      </div>

                      <div className="course-card-thumb" style={{ height: 100, background: 'var(--primary-bg)', fontSize: 40 }}>
                        {c.category === 'Matemáticas' ? '🧮' : c.category === 'Ciencias' ? '🔬' : c.category === 'Programación' ? '💻' : '📚'}
                      </div>

                      <div className="course-card-body" style={{ padding: '16px 20px' }}>
                        <div className="course-card-cat" style={{ fontSize: 10 }}>{c.category}</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 8px' }}>{c.name}</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, height: '2.5rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {c.description}
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, background: '#F8FAFC', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Estudiantes</span>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>👥 {(c.studentIds || []).length}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Materiales</span>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>📂 {c.contents?.length || 0}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ width: '100%', height: 36, fontSize: 13 }}
                            onClick={() => setShowStudentsModal(c.id || c._id)}
                          >
                            📄 Ver estudiantes
                          </button>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary" style={{ flex: 1, height: 40 }} onClick={() => setShowContentsModal(c.id || c._id)}>
                              📑 Gestionar
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1, height: 40 }}
                              onClick={() => {
                                if (hasActive) {
                                  const cl = activeClasses.find(cl => cl.courseId === (c.id || c._id))
                                  enterClass(cl.id)
                                } else {
                                  setShowCreateModal(c.id || c._id)
                                }
                              }}
                              disabled={c.estado !== 'Activo' && !hasActive}
                            >
                              {hasActive ? '🔴 Unirse' : (c.estado === 'Activo' ? '➕ Nueva Sala' : '🚫 Bloqueado')}
                            </button>
                          </div>
                          <button
                            className="btn btn-outline"
                            style={{ width: '100%', height: 40, border: '1px solid var(--primary)', color: 'var(--primary)', marginBottom: 4 }}
                            onClick={() => {
                              setSelectedCourseForGrades(c.id || c._id)
                              setActivePage('grades')
                            }}
                          >
                            📝 Calificaciones
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ width: '100%', height: 36, fontSize: 13, color: 'var(--text-secondary)' }}
                            onClick={() => setShowClassesModal(c.id || c._id)}
                          >
                            📋 Clases anteriores
                          </button>
                          {c.estado === 'Pausado' && (
                            <button
                              className="btn btn-outline"
                              style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
                              onClick={() => {
                                updateCourse(c.id || c._id, { solicitarDespausa: true });
                                alert('✅ Solicitud de despausa enviada al administrador.');
                              }}
                              disabled={c.solicitarDespausa}
                            >
                              {c.solicitarDespausa ? '⏳ Solicitud en trámite' : '▶️ Solicitar Despausa'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (activePage === 'history') {
      return (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Historial de Clases</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Clase</th><th>Curso</th><th>Fecha</th><th>Asistentes</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {(myClasses || []).slice().reverse().map(cl => {
                  const course = myCourses.find(c => c.id === cl.courseId)
                  return (
                    <tr key={cl.id}>
                      <td><div style={{ fontWeight: 600 }}>{cl.title}</div></td>
                      <td style={{ fontSize: 12 }}>{course?.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cl.date} {cl.startTime}</td>
                      <td><span className="badge badge-primary">{(cl.attendance || []).length} 👥</span></td>
                      <td>
                        <span className={`badge ${cl.isActive ? 'badge-live' : cl.savedTranscription ? 'badge-success' : 'badge-gray'}`}>
                          {cl.isActive ? '🔴 En Vivo' : cl.savedTranscription ? '✅ Guardada' : 'Sin transcript'}
                        </span>
                      </td>
                      <td>
                        {cl.isActive
                          ? <button className="btn btn-sm btn-primary" onClick={() => enterClass(cl.id)}>→ Retomar</button>
                          : <button className="btn btn-sm btn-secondary" disabled>Finalizada</button>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (activePage === 'grades' && selectedCourseForGrades) {
      return (
        <ManageGradesView
          courseId={selectedCourseForGrades}
          onBack={() => {
            setActivePage('my-courses')
            setSelectedCourseForGrades(null)
          }}
        />
      )
    }
    return null
  }

  if (!currentUser) return null

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">🏠 Panel del Profesor</div>
          <div className="topbar-subtitle">Hola, {(currentUser?.name || 'Profesor').split(' ')[0]} 👋 — {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className={`btn btn-secondary ${isRefreshing ? 'loading' : ''}`} onClick={handleRefresh} disabled={isRefreshing}>
            🔄 {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
          <span className="badge badge-primary">Profesor</span>
        </div>
      </div>

      <div className="page-content fade-in">
        {renderContent()}
      </div>

      {showCreateModal && (
        <CreateClassModal courseId={showCreateModal} onClose={() => setShowCreateModal(null)} />
      )}

      {showContentsModal && (
        <ManageContentsModal courseId={showContentsModal} onClose={() => setShowContentsModal(null)} />
      )}

      {showClassesModal && (
        <CourseClassesModal courseId={showClassesModal} onClose={() => setShowClassesModal(null)} />
      )}

      {showStudentsModal && (
        <CourseStudentsModal courseId={showStudentsModal} onClose={() => setShowStudentsModal(null)} />
      )}
    </>
  )
}
