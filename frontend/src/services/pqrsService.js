const API = 'http://localhost:3001/api/pqrs';

// ── Crear una nueva PQRS ──────────────────────────────────────────────────────
export async function crearPQRS(data) {
  const res = await fetch(API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al crear PQRS');
  return json;
}

// ── Listar PQRS ───────────────────────────────────────────────────────────────
// Admin: GET /api/pqrs?role=admin
// User:  GET /api/pqrs?role=student&userId=xxx
export async function listarPQRS(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al listar PQRS');
  return json;
}

// ── Obtener detalle de una PQRS ───────────────────────────────────────────────
export async function obtenerPQRS(id) {
  const res = await fetch(`${API}/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al obtener PQRS');
  return json;
}

// ── Actualizar estado (Admin) ─────────────────────────────────────────────────
export async function actualizarEstado(id, estado) {
  const res = await fetch(`${API}/${id}/estado`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ estado }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al actualizar estado');
  return json;
}
// ── Descargar PDF de respuesta ────────────────────────────────────────────────
export async function descargarPDF(id, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/${id}/pdf?${qs}`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || 'Error al descargar PDF');
  }
  return await res.blob();
}
// ── Responder una PQRS (Admin) ────────────────────────────────────────────────
export async function responderPQRS(id, payload) {
  const res = await fetch(`${API}/${id}/responder`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al responder PQRS');
  return json;
}

// ── Eliminar una PQRS (Admin) ─────────────────────────────────────────────────
export async function eliminarPQRS(id) {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al eliminar PQRS');
  return json;
}

// ── Estadísticas (Admin) ──────────────────────────────────────────────────────
export async function obtenerStats() {
  const res = await fetch(`${API}/stats`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Error al obtener estadísticas');
  return json;
}
