const API_BASE = 'http://localhost:3001/api/class-reports';

/**
 * Download class completion report as PDF.
 * Triggers a browser download.
 * @param {string} classId  — MongoDB _id of the class
 * @param {string} role     — 'teacher' | 'student' | 'admin'
 * @param {string} userId   — ID of the requesting user (optional, for tracking)
 */
export async function downloadClassReport(classId, role = 'student', userId = '') {
  try {
    const url = `${API_BASE}/${classId}/download?role=${role}&userId=${userId}`;
    const res = await fetch(url);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || 'Error al descargar el reporte.');
    }

    // Create blob and trigger download
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `Reporte_Clase_${classId}_${role}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get report generation history for a class.
 * @param {string} classId
 * @returns {Promise<Array>}
 */
export async function getReportHistory(classId) {
  try {
    const res = await fetch(`${API_BASE}/${classId}`);
    if (res.ok) return await res.json();
    return [];
  } catch {
    return [];
  }
}

/**
 * Log user IP when joining a class (called from frontend on class join).
 * Attempts to fetch real IP and approximate location via a free IP geolocation API.
 * @param {string} classId
 * @param {string} userId
 */
export async function logUserIP(classId, userId) {
  try {
    let locationStr = 'No disponible';

    // Get exact HTML5 Geolocation, matching the project's method
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
          });
        });
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        locationStr = `Lat: ${lat}, Lng: ${lng}`;
      } catch (err) {
        console.warn('No se pudo obtener la geolocalización exacta:', err);
      }
    }

    await fetch(`${API_BASE}/${classId}/log-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, location: locationStr }),
    });
  } catch {
    // Non-critical — silently fail
  }
}
