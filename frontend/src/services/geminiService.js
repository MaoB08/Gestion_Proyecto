// ─────────────────────────────────────────────────────────────────────────────
//  geminiService.js
//  Client-side AI service — queries our secure Backend endpoints
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

/**
 * Identifica temas clave en la transcripción de una clase
 * @param {string} classId - El ID de la clase en el backend
 */
export async function identifyTopics(classId) {
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/ai/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al obtener temas clave');
    return data.topics;
  } catch (err) {
    console.error('Error in identifyTopics:', err);
    throw err;
  }
}

/**
 * Genera un resumen completo en markdown de la clase y lo guarda
 * @param {string} classId - El ID de la clase en el backend
 */
export async function summarizeTranscription(classId) {
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/ai/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al generar resumen');
    return data.summary;
  } catch (err) {
    console.error('Error in summarizeTranscription:', err);
    throw err;
  }
}

/**
 * Obtiene un resumen parcial de lo explicado hasta ahora
 * @param {string} classId - El ID de la clase en el backend
 */
export async function partialSummary(classId) {
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/ai/partial-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al obtener resumen parcial');
    return data.summary;
  } catch (err) {
    console.error('Error in partialSummary:', err);
    throw err;
  }
}

/**
 * Realiza preguntas en tiempo real a la IA basándose en la transcripción
 * @param {string} classId - El ID de la clase en el backend
 * @param {string} userQuestion - La pregunta formulada por el usuario
 */
export async function askAboutTranscription(classId, userQuestion) {
  try {
    const res = await fetch(`${API_BASE}/classes/${classId}/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: userQuestion }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al responder la pregunta');
    return data.answer;
  } catch (err) {
    console.error('Error in askAboutTranscription:', err);
    throw err;
  }
}
