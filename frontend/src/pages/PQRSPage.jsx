import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { crearPQRS, listarPQRS, descargarPDF } from '../services/pqrsService'

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

export default function PQRSPage() {
  const { currentUser } = useApp()

  const [lista,      setLista]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [feedback,   setFeedback]   = useState('')
  const [modal,      setModal]      = useState(null) // 'nueva' | 'detalle'
  const [selected,   setSelected]   = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Formulario nueva PQRS
  const [form, setForm] = useState({ tipo: 'peticion', asunto: '', descripcion: '' })
  const [formError, setFormError] = useState('')

  // ── Detectar modelo del usuario ────────────────────────────────────────────
  const userModel = currentUser?.role === 'teacher' ? 'Teacher' : 'Student'

  // ── Cargar mis PQRS ────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    setError('')
    try {
      const data = await listarPQRS({
        role:   currentUser.role,
        userId: currentUser.id || currentUser._id,
      })
      setLista(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => { cargar() }, [cargar])

  const notify = (msg) => { setFeedback(msg); setTimeout(() => setFeedback(''), 5000) }

  // ── Enviar nueva PQRS ─────────────────────────────────────────────────────
  const handleEnviar = async () => {
    setFormError('')
    if (!form.asunto.trim())      { setFormError('El asunto es obligatorio.'); return }
    if (!form.descripcion.trim()) { setFormError('La descripción es obligatoria.'); return }
    if (form.asunto.length > 150) { setFormError('El asunto no puede superar 150 caracteres.'); return }

    setSubmitting(true)
    try {
      await crearPQRS({
        userId:      currentUser.id || currentUser._id,
        userModel,
        userName:    currentUser.name,
        userEmail:   currentUser.email || currentUser.correo,
        userRole:    currentUser.role,
        tipo:        form.tipo,
        asunto:      form.asunto.trim(),
        descripcion: form.descripcion.trim(),
      })
      notify('✅ Tu solicitud fue enviada. Recibirás un correo de confirmación en tu bandeja de entrada.')
      setModal(null)
      setForm({ tipo: 'peticion', asunto: '', descripcion: '' })
      cargar()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDescargarPDF = async (pqrsId) => {
    try {
      const blob = await descargarPDF(pqrsId, { role: currentUser.role, userId: currentUser.id || currentUser._id })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PQRS_Respuesta_${pqrsId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    }
  }

  const pendientes = lista.filter(p => p.estado === 'pendiente').length
  const resueltos  = lista.filter(p => p.estado === 'resuelto').length

  return (
    <>
      {/* ── Topbar ── */}
      <div className="topbar">
        <div>
          <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Mis PQRS
          </div>
          <div className="topbar-subtitle">Peticiones, Quejas, Reclamos y Sugerencias</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={() => { setForm({ tipo: 'peticion', asunto: '', descripcion: '' }); setFormError(''); setModal('nueva') }}>
            + Nueva PQRS
          </button>
        </div>
      </div>

      <div className="page-content fade-in">

        {/* ── Mini stats ── */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          {[
            { label: 'Total enviadas', value: lista.length,  bg: '#EDE9FE', color: '#7C3AED', icon: '📬' },
            { label: 'Pendientes',     value: pendientes,    bg: '#FFFBEB', color: '#D97706', icon: '⏳' },
            { label: 'Resueltas',      value: resueltos,     bg: '#ECFDF5', color: '#059669', icon: '✅' },
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

        {/* Feedback / Error */}
        {feedback && (
          <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #A7F3D0', lineHeight: 1.5 }}>
            {feedback}
          </div>
        )}
        {error && (
          <div style={{ background: '#FEF2F2', color: 'var(--danger)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, border: '1px solid #FECACA' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Historial */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Historial de mis solicitudes</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="empty-state" style={{ padding: '50px 0' }}>
                <div className="empty-state-title">Cargando solicitudes...</div>
              </div>
            ) : lista.length === 0 ? (
              <div className="empty-state" style={{ padding: '70px 0' }}>
                <span className="empty-state-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <div className="empty-state-title">Aún no has enviado ninguna solicitud</div>
                <div className="empty-state-desc">Usa el botón <strong>"+ Nueva PQRS"</strong> para enviar tu primera petición, queja, reclamo o sugerencia.</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Asunto</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Respuesta</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map(pqrs => (
                    <tr key={pqrs._id} style={{ cursor: 'pointer' }} onClick={() => { setSelected(pqrs); setModal('detalle') }}>
                      <td><span className={`badge ${TIPO_BADGE[pqrs.tipo]}`}>{TIPO_LABEL[pqrs.tipo]}</span></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pqrs.asunto}
                        </div>
                      </td>
                      <td><span className={`badge ${ESTADO_BADGE[pqrs.estado]}`}>{ESTADO_LABEL[pqrs.estado]}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(pqrs.createdAt)}</td>
                      <td>
                        {pqrs.respuesta
                          ? <span className="badge badge-success" style={{ fontSize: 11 }}>✅ Respondida</span>
                          : <span className="badge badge-gray"    style={{ fontSize: 11 }}>Pendiente</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal nueva PQRS ── */}
      {modal === 'nueva' && (
        <Modal
          title="Nueva PQRS"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className={`btn btn-primary ${submitting ? 'loading' : ''}`}
                onClick={handleEnviar}
                disabled={submitting}
              >
                {submitting ? 'Enviando...' : '📤 Enviar solicitud'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Tipo */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                Tipo de solicitud *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {Object.entries(TIPO_LABEL).map(([v, l]) => (
                  <button
                    key={v}
                    className={`btn btn-sm ${form.tipo === v ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ justifyContent: 'center', fontSize: 12 }}
                    onClick={() => setForm(f => ({ ...f, tipo: v }))}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Asunto */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                Asunto *
              </label>
              <input
                className="form-input"
                type="text"
                maxLength={150}
                placeholder="Resumen breve de tu solicitud (máx. 150 caracteres)"
                value={form.asunto}
                onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))}
                style={{ width: '100%', fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.asunto.length}/150</div>
            </div>

            {/* Descripción */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                Descripción *
              </label>
              <textarea
                className="form-textarea"
                rows={5}
                maxLength={2000}
                placeholder="Describe detalladamente tu solicitud. Cuanta más información brindes, más rápido podremos atenderte..."
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{form.descripcion.length}/2000</div>
            </div>

            {formError && (
              <div style={{ background: '#FEF2F2', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13, border: '1px solid #FECACA' }}>
                ⚠️ {formError}
              </div>
            )}

            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#0369A1' }}>
              ℹ️ Al enviar, recibirás automáticamente un correo de confirmación. El administrador te notificará por correo cuando tu solicitud sea respondida.
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal detalle ── */}
      {modal === 'detalle' && selected && (
        <Modal title="Detalle de PQRS" onClose={() => { setModal(null); setSelected(null) }}
          footer={<button className="btn btn-secondary" onClick={() => { setModal(null); setSelected(null) }}>Cerrar</button>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <span className={`badge ${TIPO_BADGE[selected.tipo]}`}>{TIPO_LABEL[selected.tipo]}</span>
            <span className={`badge ${ESTADO_BADGE[selected.estado]}`}>{ESTADO_LABEL[selected.estado]}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              ['ID de radicado', selected._id],
              ['Asunto',         selected.asunto],
              ['Fecha de envío', fmtDate(selected.createdAt)],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid #F3F4F6', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 140 }}>{l}</span>
                <span style={{ fontWeight: 500, flex: 1 }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Tu descripción</div>
            <div style={{ background: '#F9FAFB', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {selected.descripcion}
            </div>
          </div>

          {selected.respuesta ? (
            <div style={{ marginTop: 20, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 10 }}>
                ✅ Respuesta del Administrador
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', marginBottom: 10 }}>
                {selected.respuesta.respuesta}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Respondido por <strong>{selected.respuesta.adminName}</strong> · {fmtDate(selected.respuesta.createdAt)}
              </div>
              {selected.respuesta.pdfPath && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 12 }}>
                  <svg width="13" height="13" viewBox="0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  La respuesta oficial también fue enviada a tu correo en formato PDF.
                  <button 
                    onClick={() => handleDescargarPDF(selected._id)}
                    className="btn-ghost"
                    style={{ marginLeft: 'auto', color: '#059669', fontWeight: 700, textDecoration: 'underline', padding: 0, border: 'none', background: 'none' }}
                  >
                    Ver PDF
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 20, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#92400E' }}>
              ⏳ Tu solicitud está siendo revisada. Recibirás una notificación por correo cuando el administrador la responda.
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
