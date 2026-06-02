import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../../components/Sidebar'
import { listarPQRS, responderPQRS, eliminarPQRS, actualizarEstado, obtenerStats } from '../../services/pqrsService'

const TIPO_LABEL   = { peticion: 'Petición', queja: 'Queja', reclamo: 'Reclamo', sugerencia: 'Sugerencia' }
const ESTADO_LABEL = { pendiente: 'Pendiente', en_revision: 'En Revisión', resuelto: 'Resuelto', cerrado: 'Cerrado' }
const TIPO_BADGE   = { peticion: 'badge-primary', queja: 'badge-warning', reclamo: 'badge-danger', sugerencia: 'badge-success' }
const ESTADO_BADGE = { pendiente: 'badge-warning', en_revision: 'badge-info', resuelto: 'badge-success', cerrado: 'badge-gray' }

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header purple">
          <div className="modal-title" style={{ color: 'white' }}>{title}</div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'white' }} onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border-light,#F3F4F6)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 150 }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word', flex: 1 }}>{value || '—'}</span>
    </div>
  )
}

export default function AdminPQRSPage() {
  const { currentUser } = useApp()
  const [lista,        setLista]        = useState([])
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [feedback,     setFeedback]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo,   setFiltroTipo]   = useState('')
  const [modal,        setModal]        = useState(null)
  const [selected,     setSelected]     = useState(null)
  const [respTexto,    setRespTexto]    = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [respError,    setRespError]    = useState('')

  const cargar = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = { role: 'admin' }
      if (filtroEstado) params.estado = filtroEstado
      if (filtroTipo)   params.tipo   = filtroTipo
      const [data, statsData] = await Promise.all([listarPQRS(params), obtenerStats()])
      setLista(data); setStats(statsData)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [filtroEstado, filtroTipo])

  useEffect(() => { cargar() }, [cargar])

  const notify = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 4000) }
  const closeModal = () => { setModal(null); setSelected(null); setRespTexto(''); setRespError('') }

  const abrirDetalle = (pqrs) => { setSelected(pqrs); setRespTexto(''); setRespError(''); setModal('detail') }

  const handleCambiarEstado = async (id, estado) => {
    try { await actualizarEstado(id, estado); notify(`✅ Estado actualizado a "${ESTADO_LABEL[estado]}"`); cargar() }
    catch (err) { setError(err.message) }
  }

  const handleResponder = async () => {
    if (!respTexto.trim()) { setRespError('La respuesta no puede estar vacía.'); return }
    setSubmitting(true); setRespError('')
    try {
      await responderPQRS(selected._id, {
        adminId:   currentUser.id || currentUser._id,
        adminName: currentUser.name,
        respuesta: respTexto.trim(),
        estado:    selected.estado,
      })
      notify('✅ Respuesta enviada. PDF generado y correo enviado al usuario.')
      closeModal(); cargar()
    } catch (err) { setRespError(err.message) }
    finally { setSubmitting(false) }
  }

  const handleEliminar = async () => {
    if (!selected) return
    try { await eliminarPQRS(selected._id); notify('🗑️ PQRS eliminada.'); closeModal(); cargar() }
    catch (err) { setError(err.message) }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Gestión de PQRS
          </div>
          <div className="topbar-subtitle">Peticiones, Quejas, Reclamos y Sugerencias</div>
        </div>
        <div className="topbar-right">
          <button className={`btn btn-secondary btn-sm ${loading ? 'loading' : ''}`} onClick={cargar} disabled={loading}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div className="page-content fade-in">

        {stats && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
            {[
              { label: 'Total PQRS',  value: stats.total,      bg: '#EDE9FE', color: '#7C3AED', icon: '📬' },
              { label: 'Pendientes',  value: stats.pendientes,  bg: '#FFFBEB', color: '#D97706', icon: '⏳' },
              { label: 'En Revisión', value: stats.enRevision,  bg: '#EFF6FF', color: '#2563EB', icon: '🔍' },
              { label: 'Resueltas',   value: stats.resueltos,   bg: '#ECFDF5', color: '#059669', icon: '✅' },
            ].map(s => (
              <div className="stat-card" key={s.label}>
                <div className="stat-card-top">
                  <div className="stat-card-label">{s.label}</div>
                  <div className="stat-card-icon" style={{ background: s.bg }}>{s.icon}</div>
                </div>
                <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {feedback && (
          <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #A7F3D0' }}>
            {feedback}
          </div>
        )}
        {error && (
          <div style={{ background: '#FEF2F2', color: 'var(--danger)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Filtros */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '14px 20px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar:</span>
            <select className="form-select" style={{ width: 170, padding: '6px 10px', fontSize: 13 }}
              value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="form-select" style={{ width: 170, padding: '6px 10px', fontSize: 13 }}
              value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {(filtroEstado || filtroTipo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroEstado(''); setFiltroTipo('') }}>
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Solicitante</th>
                  <th>Tipo</th>
                  <th>Asunto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state" style={{ padding: '50px 0' }}>
                      <div className="empty-state-title">Cargando...</div>
                    </div>
                  </td></tr>
                ) : lista.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state" style={{ padding: '60px 0' }}>
                      <span className="empty-state-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                      </span>
                      <div className="empty-state-title">Sin PQRS registradas</div>
                      <div className="empty-state-desc">Cuando los usuarios envíen solicitudes, aparecerán aquí.</div>
                    </div>
                  </td></tr>
                ) : lista.map(pqrs => (
                  <tr key={pqrs._id} style={{ cursor: 'pointer' }} onClick={() => abrirDetalle(pqrs)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar user={{ name: pqrs.userName }} size="sm" />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{pqrs.userName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pqrs.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${TIPO_BADGE[pqrs.tipo]}`}>{TIPO_LABEL[pqrs.tipo]}</span></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pqrs.asunto}
                      </div>
                    </td>
                    <td><span className={`badge ${ESTADO_BADGE[pqrs.estado]}`}>{ESTADO_LABEL[pqrs.estado]}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(pqrs.createdAt)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => abrirDetalle(pqrs)}>Ver</button>
                        <button className="btn btn-sm"
                          style={{ background: '#FEF2F2', color: 'var(--danger)', border: '1px solid #FECACA' }}
                          onClick={() => { setSelected(pqrs); setModal('confirm-delete') }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal detalle */}
      {modal === 'detail' && selected && (
        <Modal
          title="Detalle de PQRS"
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeModal}>Cerrar</button>
              {!selected.respuesta && (
                <button
                  className={`btn btn-primary ${submitting ? 'loading' : ''}`}
                  onClick={handleResponder}
                  disabled={submitting || !respTexto.trim()}
                >
                  {submitting ? 'Enviando...' : '📤 Enviar Respuesta'}
                </button>
              )}
            </>
          }
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <span className={`badge ${TIPO_BADGE[selected.tipo]}`}>{TIPO_LABEL[selected.tipo]}</span>
            <span className={`badge ${ESTADO_BADGE[selected.estado]}`}>{ESTADO_LABEL[selected.estado]}</span>
          </div>
          <DetailRow label="ID de radicado" value={selected._id} />
          <DetailRow label="Solicitante"    value={selected.userName} />
          <DetailRow label="Correo"         value={selected.userEmail} />
          <DetailRow label="Rol"            value={selected.userRole === 'student' ? 'Estudiante' : 'Profesor'} />
          <DetailRow label="Fecha de envío" value={fmtDate(selected.createdAt)} />
          <DetailRow label="Asunto"         value={selected.asunto} />

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Descripción</div>
            <div style={{ background: '#F9FAFB', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {selected.descripcion}
            </div>
          </div>

          {!selected.respuesta && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cambiar estado:</span>
              {Object.entries(ESTADO_LABEL).map(([v, l]) => (
                <button key={v} className={`btn btn-sm ${selected.estado === v ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11 }}
                  onClick={async () => { await handleCambiarEstado(selected._id, v); setSelected(s => ({ ...s, estado: v })) }}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {selected.respuesta ? (
            <div style={{ marginTop: 20, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 10 }}>✅ Respuesta del Administrador</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{selected.respuesta.respuesta}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Por <strong>{selected.respuesta.adminName}</strong> · {fmtDate(selected.respuesta.createdAt)}
              </div>
              {selected.respuesta.pdfPath && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 12 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  PDF generado y enviado al usuario por correo.
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Escribir Respuesta</div>
              <textarea className="form-textarea" rows={5}
                placeholder="Escribe aquí la respuesta oficial. Se generará un PDF y se enviará al usuario por correo automáticamente..."
                value={respTexto}
                onChange={e => setRespTexto(e.target.value)}
                style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
              />
              {respError && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>⚠️ {respError}</div>}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Al enviar: se generará un PDF y se notificará al usuario por correo automáticamente.
              </div>
            </div>
          )}
        </Modal>
      )}

      {modal === 'confirm-delete' && selected && (
        <Modal title="🗑️ Eliminar PQRS" onClose={closeModal}
          footer={<><button className="btn btn-secondary" onClick={closeModal}>Cancelar</button><button className="btn btn-danger" onClick={handleEliminar}>Eliminar</button></>}>
          <p style={{ fontSize: 14 }}>
            ¿Eliminar la PQRS <strong>"{selected.asunto}"</strong>? También se eliminará la respuesta asociada. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </>
  )
}
