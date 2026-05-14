import { useState } from 'react'
import { useApp } from '../context/AppContext'

const EMPTY = {
  documento: '', nombre: '', apellido: '', anioNacimiento: '',
  telefono: '', correo: '', clave: '', confirmarClave: '', sexo: '', institucion: '',
}

// ── Field must live OUTSIDE RegisterPage so React doesn't remount it on each
// render (defining it inside would create a new component type every keystroke,
// causing the input to lose focus). ──────────────────────────────────────────
function Field({ label, fieldName, type = 'text', placeholder, hint, inputMode, maxLength, form, errors, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label} <span style={{ color: 'var(--danger)' }}>*</span>
      </label>
      <input
        className={`form-input${errors[fieldName] ? ' input-error' : ''}`}
        type={type}
        placeholder={placeholder}
        value={form[fieldName]}
        onChange={onChange(fieldName)}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete="off"
      />
      {errors[fieldName]
        ? <span className="form-error" style={{ fontSize: 12 }}>⚠️ {errors[fieldName]}</span>
        : hint && <span className="form-hint">{hint}</span>
      }
    </div>
  )
}

export default function RegisterPage() {
  const { setActivePage } = useApp()
  const [form, setForm]         = useState(EMPTY)
  const [errors, setErrors]     = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)

  const onChange = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(er => ({ ...er, [field]: '' }))
    setApiError('')
  }

  // ── Client-side validation (RF-01) ────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.documento.trim())
      e.documento = 'Este campo es obligatorio'
    else if (!/^\d{8,11}$/.test(form.documento))
      e.documento = 'Solo números, entre 8 y 11 dígitos'

    if (!form.nombre.trim())
      e.nombre = 'Este campo es obligatorio'
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.nombre) || form.nombre.length > 32)
      e.nombre = 'Solo letras, máximo 32 caracteres'

    if (!form.apellido.trim())
      e.apellido = 'Este campo es obligatorio'
    else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(form.apellido) || form.apellido.length > 32)
      e.apellido = 'Solo letras, máximo 32 caracteres'

    if (!form.anioNacimiento.trim())
      e.anioNacimiento = 'Este campo es obligatorio'
    else if (!/^\d{4}$/.test(form.anioNacimiento))
      e.anioNacimiento = 'Debe tener exactamente 4 dígitos'

    if (!form.telefono.trim())
      e.telefono = 'Este campo es obligatorio'
    else if (!/^\d{10}$/.test(form.telefono))
      e.telefono = 'Solo números, exactamente 10 dígitos'

    if (!form.correo.trim())
      e.correo = 'Este campo es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo))
      e.correo = 'Formato de correo inválido'

    if (!form.clave)
      e.clave = 'Este campo es obligatorio'
    else if (form.clave.length < 8)
      e.clave = 'La clave debe tener al menos 8 caracteres'

    if (!form.confirmarClave)
      e.confirmarClave = 'Este campo es obligatorio'
    else if (form.clave !== form.confirmarClave)
      e.confirmarClave = 'Las claves no coinciden'

    if (!form.institucion.trim())
      e.institucion = 'Este campo es obligatorio'

    if (!form.sexo)
      e.sexo = 'Este campo es obligatorio'

    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const res = await fetch('http://localhost:3001/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento:      form.documento,
          nombre:         form.nombre.trim(),
          apellido:       form.apellido.trim(),
          anioNacimiento: form.anioNacimiento,
          telefono:       form.telefono,
          correo:         form.correo.toLowerCase(),
          clave:          form.clave,
          sexo:           form.sexo,
          institucion:    form.institucion.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.field) setErrors({ [json.field]: json.message })
        else setApiError(json.message || 'Error al registrarse')
      } else {
        setSuccess(true)
      }
    } catch {
      setApiError('No se pudo conectar al servidor. Verifica que el backend esté disponible.')
    }
    setLoading(false)
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 460, textAlign: 'center' }}>
          <div className="auth-icon-wrap" style={{ fontSize: 48 }}>⏳</div>
          <h1 className="auth-title">¡Solicitud enviada!</h1>
          <p className="auth-subtitle" style={{ lineHeight: 1.6 }}>
            Tu solicitud de inscripción ha sido recibida. Un administrador revisará
            tu información y te habilitará el acceso próximamente.
          </p>
          <div style={{
            background: '#FFF7ED', border: '1px solid #FED7AA',
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            fontSize: 13, color: '#92400E', margin: '20px 0',
          }}>
            🔔 <strong>Su solicitud está siendo revisada por un administrador</strong>
          </div>
          <button className="btn btn-primary w-full" onClick={() => setActivePage('dashboard')}>
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  // Shared props passed down to Field
  const fieldProps = { form, errors, onChange }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-icon-wrap">📚</div>
        <h1 className="auth-title">Solicitud de Inscripción</h1>
        <p className="auth-subtitle">Completa el formulario para registrarte como estudiante</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>

          {/* Row: Documento + Teléfono */}
          <div className="form-row">
            <Field {...fieldProps} label="Documento"  fieldName="documento"
              placeholder="Ej: 1023456789" hint="Solo números, 8–11 dígitos"
              inputMode="numeric" maxLength={11} />
            <Field {...fieldProps} label="Teléfono"   fieldName="telefono"
              placeholder="Ej: 3001234567" hint="Solo números, 10 dígitos"
              inputMode="numeric" maxLength={10} />
          </div>

          {/* Row: Nombre + Apellido */}
          <div className="form-row">
            <Field {...fieldProps} label="Nombre"   fieldName="nombre"   placeholder="Ej: Kevin"   maxLength={32} />
            <Field {...fieldProps} label="Apellido" fieldName="apellido" placeholder="Ej: Spinell" maxLength={32} />
          </div>

          {/* Row: Año nacimiento + Sexo */}
          <div className="form-row">
            <Field {...fieldProps} label="Año de nacimiento" fieldName="anioNacimiento"
              placeholder="Ej: 2001" hint="4 dígitos numéricos"
              inputMode="numeric" maxLength={4} />
            <div className="form-group">
              <label className="form-label">
                Sexo <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                className={`form-input${errors.sexo ? ' input-error' : ''}`}
                value={form.sexo}
                onChange={onChange('sexo')}
              >
                <option value="">Seleccionar...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
              {errors.sexo && <span className="form-error" style={{ fontSize: 12 }}>⚠️ {errors.sexo}</span>}
            </div>
          </div>

          {/* Institución */}
          <Field {...fieldProps} label="Institución académica" fieldName="institucion"
            placeholder="Ej: Universidad Nacional" />

          {/* Correo */}
          <Field {...fieldProps} label="Correo electrónico" fieldName="correo"
            type="email" placeholder="Ej: kevin@universidad.edu" />

          {/* Row: Clave + Confirmar */}
          <div className="form-row">
            <Field {...fieldProps} label="Contraseña"         fieldName="clave"
              type="password" placeholder="Mín. 8 caracteres" hint="Se almacenará cifrada" />
            <Field {...fieldProps} label="Confirmar contraseña" fieldName="confirmarClave"
              type="password" placeholder="Repite la contraseña" />
          </div>

          {/* API-level error */}
          {apiError && (
            <div style={{
              background: 'var(--danger-bg)', border: '1px solid #FECACA',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              fontSize: 13, color: 'var(--danger)',
            }}>
              ⚠️ {apiError}
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> Enviando solicitud...</> : 'Enviar Solicitud →'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: 16 }}>
          ¿Ya tienes cuenta?{' '}
          <span className="auth-link" onClick={() => setActivePage('dashboard')}>
            Iniciar sesión
          </span>
        </div>
      </div>
    </div>
  )
}
