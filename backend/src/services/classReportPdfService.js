const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// ── Class Report PDF Service ──────────────────────────────────────────────────
// Generates a professional PDF report when a class session concludes.
// Content adapts based on the role of the requester:
//   - teacher / student: General + Participation info
//   - admin:             General + Participation + Security (IP / geolocation)

/**
 * @param {Object} opts
 * @param {Object} opts.cls           — Populated Class document
 * @param {Object} opts.course        — Course document
 * @param {string} opts.reportType    — 'teacher' | 'student' | 'admin'
 * @param {Array}  opts.enrolledStudents — Full list of enrolled students (for absence calc)
 * @param {Array}  opts.userMap       — Map userId → { name, email, ... }
 * @param {Array}  opts.ipLogs        — [{ userId, ip, location }] (admin only)
 * @returns {Promise<string>} — Absolute path to the generated PDF
 */
async function generateClassReportPDF({
  cls,
  course,
  reportType,
  enrolledStudents = [],
  userMap = {},
  ipLogs = [],
}) {
  // Ensure upload directory exists
  const uploadDir = path.join(__dirname, '../../uploads/class-reports');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `Reporte_Clase_${cls._id}_${reportType}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ── Color palette ─────────────────────────────────────────────────────────
    const PRIMARY    = '#7C3AED';
    const PRIMARY_BG = '#EDE9FE';
    const SUCCESS    = '#059669';
    const SUCCESS_BG = '#ECFDF5';
    const WARNING    = '#D97706';
    const WARNING_BG = '#FFFBEB';
    const DANGER     = '#DC2626';
    const DANGER_BG  = '#FEF2F2';
    const INFO       = '#0891B2';
    const GRAY_DARK  = '#1F2937';
    const GRAY_MID   = '#6B7280';
    const GRAY_LIGHT = '#F9FAFB';
    const BORDER     = '#E5E7EB';

    const PAGE_W  = doc.page.width;
    const PAGE_H  = doc.page.height;
    const MARGIN  = 50;
    const INNER_W = PAGE_W - MARGIN * 2;

    let y = 130;

    // ── Helpers ────────────────────────────────────────────────────────────────
    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > PAGE_H - MARGIN - 30) {
        doc.addPage();
        y = MARGIN;
      }
    };

    const drawSection = (title, color = PRIMARY) => {
      checkPageBreak(36);
      doc.rect(MARGIN, y, INNER_W, 24).fillColor(color).fill();
      doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
         .text(title, MARGIN + 12, y + 7, { width: INNER_W - 24 });
      y += 32;
      doc.fillColor(GRAY_DARK);
    };

    const drawRow = (label, value) => {
      checkPageBreak(24);
      doc.rect(MARGIN, y, INNER_W, 22).fillColor(GRAY_LIGHT).fill();
      doc.rect(MARGIN, y, INNER_W, 22).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fillColor(GRAY_MID).fontSize(9).font('Helvetica')
         .text(label, MARGIN + 10, y + 6, { width: 150 });
      doc.fillColor(GRAY_DARK).fontSize(9).font('Helvetica-Bold')
         .text(String(value || '—'), MARGIN + 165, y + 6, { width: INNER_W - 175 });
      y += 22;
    };

    const drawUserList = (title, users, emptyMsg, badgeColor = PRIMARY_BG, textColor = PRIMARY) => {
      checkPageBreak(40);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(GRAY_DARK)
         .text(title, MARGIN, y);
      y += 16;

      if (!users || users.length === 0) {
        checkPageBreak(20);
        doc.fontSize(9).font('Helvetica').fillColor(GRAY_MID)
           .text(emptyMsg || 'Ninguno', MARGIN + 10, y);
        y += 16;
        return;
      }

      users.forEach((u, idx) => {
        checkPageBreak(22);
        const bg = idx % 2 === 0 ? GRAY_LIGHT : '#FFFFFF';
        doc.rect(MARGIN, y, INNER_W, 20).fillColor(bg).fill();
        doc.rect(MARGIN, y, INNER_W, 20).strokeColor(BORDER).lineWidth(0.3).stroke();

        // Number badge
        doc.roundedRect(MARGIN + 6, y + 3, 16, 14, 3).fillColor(badgeColor).fill();
        doc.fillColor(textColor).fontSize(8).font('Helvetica-Bold')
           .text(String(idx + 1), MARGIN + 6, y + 5, { width: 16, align: 'center' });

        doc.fillColor(GRAY_DARK).fontSize(9).font('Helvetica')
           .text(u.name || u.nombre || 'Desconocido', MARGIN + 30, y + 5, { width: INNER_W - 40 });
        y += 20;
      });
      y += 8;
    };

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 115).fill(PRIMARY);
    doc.fillColor('white').fontSize(24).font('Helvetica-Bold')
       .text('ClassAI', MARGIN, 26);
    doc.fillColor('rgba(255,255,255,0.75)').fontSize(10).font('Helvetica')
       .text('Reporte de Finalización de Clase', MARGIN, 54);

    // Role badge in header
    const roleLabels = { teacher: 'DOCENTE', student: 'ESTUDIANTE', admin: 'ADMINISTRADOR' };
    const badgeW = 120;
    doc.roundedRect(PAGE_W - MARGIN - badgeW, 26, badgeW, 28, 14)
       .fillAndStroke('rgba(255,255,255,0.15)', 'rgba(255,255,255,0.3)');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text(roleLabels[reportType] || 'REPORTE', PAGE_W - MARGIN - badgeW + 10, 35, { width: badgeW - 20, align: 'center' });

    // Timestamp
    doc.fillColor('rgba(255,255,255,0.6)').fontSize(8).font('Helvetica')
       .text(`Generado: ${new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}`, MARGIN, 80);

    doc.fillColor(GRAY_DARK);

    // ── Title ─────────────────────────────────────────────────────────────────
    doc.fontSize(16).font('Helvetica-Bold').fillColor(GRAY_DARK)
       .text('REPORTE DE FINALIZACIÓN DE CLASE', MARGIN, y, { align: 'center', width: INNER_W });
    y += 28;
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 18;

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 1: INFORMACIÓN GENERAL
    // ══════════════════════════════════════════════════════════════════════════
    drawSection('INFORMACIÓN GENERAL');
    drawRow('Clase', cls.title || '—');
    drawRow('Curso', course?.name || '—');
    drawRow('Categoría', course?.category || '—');
    drawRow('Fecha', cls.date || '—');
    drawRow('Hora de Inicio', cls.startTime || '—');
    drawRow('Hora de Fin', cls.endTime || '—');
    drawRow('Tipo de Sesión', cls.sessionType || 'Live');

    // Duration
    const duration = cls.duration || calculateDuration(cls);
    drawRow('Duración Total', duration);
    y += 12;

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 2: TRANSCRIPCIÓN
    // ══════════════════════════════════════════════════════════════════════════
    drawSection('TRANSCRIPCIÓN DE LA CLASE');

    const transcriptionText = cls.savedTranscription
      || (cls.transcription || []).map(s => s.text).join(' ')
      || 'No se registró transcripción para esta sesión.';

    doc.fontSize(9).font('Helvetica');
    const tHeight = doc.heightOfString(transcriptionText, { width: INNER_W - 20, lineGap: 3 }) + 20;

    // Multi-page handling for long transcriptions
    const maxBlockHeight = PAGE_H - MARGIN * 2 - 40;
    if (tHeight > maxBlockHeight) {
      // Split into pages
      const words = transcriptionText.split(' ');
      let chunk = '';
      for (const word of words) {
        const test = chunk ? `${chunk} ${word}` : word;
        const testH = doc.heightOfString(test, { width: INNER_W - 20, lineGap: 3 }) + 20;
        if (testH > maxBlockHeight - y + MARGIN) {
          // Draw current chunk
          checkPageBreak(20);
          const h = doc.heightOfString(chunk, { width: INNER_W - 20, lineGap: 3 }) + 20;
          doc.rect(MARGIN, y, INNER_W, h).fillColor(GRAY_LIGHT).fill();
          doc.rect(MARGIN, y, INNER_W, h).strokeColor(BORDER).lineWidth(0.5).stroke();
          doc.fillColor(GRAY_DARK).fontSize(9).font('Helvetica')
             .text(chunk, MARGIN + 10, y + 10, { width: INNER_W - 20, lineGap: 3 });
          y += h;
          chunk = word;
          doc.addPage();
          y = MARGIN;
        } else {
          chunk = test;
        }
      }
      // Draw remaining
      if (chunk) {
        checkPageBreak(20);
        const h = doc.heightOfString(chunk, { width: INNER_W - 20, lineGap: 3 }) + 20;
        doc.rect(MARGIN, y, INNER_W, h).fillColor(GRAY_LIGHT).fill();
        doc.rect(MARGIN, y, INNER_W, h).strokeColor(BORDER).lineWidth(0.5).stroke();
        doc.fillColor(GRAY_DARK).fontSize(9).font('Helvetica')
           .text(chunk, MARGIN + 10, y + 10, { width: INNER_W - 20, lineGap: 3 });
        y += h;
      }
    } else {
      checkPageBreak(tHeight);
      doc.rect(MARGIN, y, INNER_W, tHeight).fillColor(GRAY_LIGHT).fill();
      doc.rect(MARGIN, y, INNER_W, tHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fillColor(GRAY_DARK).fontSize(9).font('Helvetica')
         .text(transcriptionText, MARGIN + 10, y + 10, { width: INNER_W - 20, lineGap: 3 });
      y += tHeight;
    }
    y += 12;

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 3: ASISTENCIA
    // ══════════════════════════════════════════════════════════════════════════
    drawSection('ASISTENCIA', SUCCESS);

    const attendanceIds = (cls.attendance || []).map(a => String(a.userId));
    const presentStudents = attendanceIds.map(id => userMap[id]).filter(Boolean);

    drawUserList(
      `✅ Estudiantes Presentes (${presentStudents.length})`,
      presentStudents,
      'Ningún estudiante registró asistencia.',
      SUCCESS_BG,
      SUCCESS,
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 4: AUSENTISMO
    // ══════════════════════════════════════════════════════════════════════════
    drawSection('AUSENTISMO', WARNING);

    const absentStudents = enrolledStudents.filter(s => {
      const sid = String(s._id || s.id);
      return !attendanceIds.includes(sid);
    }).map(s => ({
      name: s.nombre ? `${s.nombre} ${s.apellido}` : s.name,
    }));

    drawUserList(
      `❌ Estudiantes Ausentes (${absentStudents.length})`,
      absentStudents,
      'Todos los estudiantes registraron asistencia.',
      DANGER_BG,
      DANGER,
    );

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 5: MÉTRICAS DE PARTICIPACIÓN
    // ══════════════════════════════════════════════════════════════════════════
    drawSection('MÉTRICAS DE PARTICIPACIÓN', INFO);

    const questions = cls.questions || [];
    const participantIds = cls.participantIds || [];

    // Stat row
    checkPageBreak(30);
    doc.rect(MARGIN, y, INNER_W, 26).fillColor('#F0F9FF').fill();
    doc.rect(MARGIN, y, INNER_W, 26).strokeColor('#BAE6FD').lineWidth(0.5).stroke();
    doc.fillColor(INFO).fontSize(9).font('Helvetica-Bold')
       .text(`Total Participantes: ${participantIds.length}   |   Preguntas: ${questions.length}   |   Respondidas: ${questions.filter(q => q.status === 'answered').length}   |   Pendientes: ${questions.filter(q => q.status === 'pending').length}`,
             MARGIN + 10, y + 8, { width: INNER_W - 20 });
    y += 34;

    // Students who asked questions
    const questioners = {};
    questions.forEach(q => {
      const uid = String(q.userId);
      if (!questioners[uid]) {
        questioners[uid] = { name: q.userName || (userMap[uid]?.name) || 'Desconocido', count: 0, questions: [] };
      }
      questioners[uid].count++;
      questioners[uid].questions.push(q.text);
    });

    const activeStudents = Object.values(questioners).sort((a, b) => b.count - a.count);

    if (activeStudents.length > 0) {
      checkPageBreak(20);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(GRAY_DARK)
         .text('🙋 Estudiantes que Realizaron Preguntas:', MARGIN, y);
      y += 16;

      activeStudents.forEach((s, idx) => {
        checkPageBreak(36);
        const bg = idx % 2 === 0 ? '#F0F9FF' : '#FFFFFF';
        doc.rect(MARGIN, y, INNER_W, 32).fillColor(bg).fill();
        doc.rect(MARGIN, y, INNER_W, 32).strokeColor(BORDER).lineWidth(0.3).stroke();

        doc.fillColor(GRAY_DARK).fontSize(9).font('Helvetica-Bold')
           .text(`${s.name}`, MARGIN + 10, y + 4);
        doc.fillColor(GRAY_MID).fontSize(8).font('Helvetica')
           .text(`${s.count} pregunta${s.count > 1 ? 's' : ''}: ${s.questions.slice(0, 2).join('; ')}${s.questions.length > 2 ? '...' : ''}`,
                 MARGIN + 10, y + 18, { width: INNER_W - 20 });
        y += 32;
      });
    } else {
      checkPageBreak(20);
      doc.fontSize(9).font('Helvetica').fillColor(GRAY_MID)
         .text('No se registraron preguntas durante la sesión.', MARGIN + 10, y);
      y += 16;
    }
    y += 12;

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 6: VERIFICACIONES DE ATENCIÓN
    // ══════════════════════════════════════════════════════════════════════════
    const attentionChecks = cls.attentionChecks || [];
    if (attentionChecks.length > 0) {
      drawSection('VERIFICACIONES DE ATENCIÓN', '#7C3AED');

      attentionChecks.forEach((ac, acIdx) => {
        const responses = ac.responses || [];
        const responded = responses.filter(r => r.responded).length;
        const total = responses.length;
        const pct = total > 0 ? Math.round((responded / total) * 100) : 0;

        checkPageBreak(28);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY_DARK)
           .text(`Check #${acIdx + 1} — ${new Date(ac.launchedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · ${responded}/${total} respondieron (${pct}%)`,
                 MARGIN + 10, y);
        y += 20;
      });
      y += 8;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // SECTION 7 (ADMIN ONLY): GEOLOCALIZACIÓN / IP
    // ══════════════════════════════════════════════════════════════════════════
    if (reportType === 'admin' && ipLogs.length > 0) {
      drawSection('INFORMACIÓN DE SEGURIDAD — GEOLOCALIZACIÓN', DANGER);

      checkPageBreak(20);
      doc.fontSize(8).font('Helvetica').fillColor(GRAY_MID)
         .text('⚠️ Información confidencial — Solo visible para el Administrador.', MARGIN + 10, y);
      y += 16;

      // Table header
      checkPageBreak(22);
      doc.rect(MARGIN, y, INNER_W, 20).fillColor(DANGER_BG).fill();
      doc.rect(MARGIN, y, INNER_W, 20).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fillColor(DANGER).fontSize(8).font('Helvetica-Bold')
         .text('USUARIO', MARGIN + 10, y + 6, { width: 180 })
         .text('DIRECCIÓN IP', MARGIN + 195, y + 6, { width: 120 })
         .text('UBICACIÓN', MARGIN + 320, y + 6, { width: INNER_W - 330 });
      y += 20;

      ipLogs.forEach((log, idx) => {
        checkPageBreak(20);
        const bg = idx % 2 === 0 ? GRAY_LIGHT : '#FFFFFF';
        doc.rect(MARGIN, y, INNER_W, 20).fillColor(bg).fill();
        doc.rect(MARGIN, y, INNER_W, 20).strokeColor(BORDER).lineWidth(0.3).stroke();

        const userName = userMap[String(log.userId)]?.name || 'Desconocido';
        doc.fillColor(GRAY_DARK).fontSize(8).font('Helvetica')
           .text(userName, MARGIN + 10, y + 6, { width: 180 })
           .text(log.ip || '—', MARGIN + 195, y + 6, { width: 120 })
           .text(log.location || '—', MARGIN + 320, y + 6, { width: INNER_W - 330 });
        y += 20;
      });
      y += 12;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    checkPageBreak(50);
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(BORDER).lineWidth(1).stroke();
    y += 14;
    doc.fillColor(GRAY_MID).fontSize(8).font('Helvetica')
       .text(
         'Este documento fue generado automáticamente por ClassAI. ' +
         'Generado el ' + new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) + '. ' +
         (reportType !== 'admin' ? 'La información de geolocalización no se incluye en este tipo de reporte.' : ''),
         MARGIN, y, { width: INNER_W, align: 'center' }
       );

    doc.end();

    stream.on('finish', () => {
      console.log(`📄 Reporte de clase generado: ${filePath}`);
      resolve(filePath);
    });
    stream.on('error', reject);
  });
}

/**
 * Calculate class duration from startTime / endTime or attendance records.
 */
function calculateDuration(cls) {
  if (cls.startTime && cls.endTime) {
    const [sh, sm] = cls.startTime.split(':').map(Number);
    const [eh, em] = cls.endTime.split(':').map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin > 0) {
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      return h > 0 ? `${h}h ${m}min` : `${m} minutos`;
    }
  }

  // Fallback: derive from attendance timestamps
  const times = (cls.attendance || []).map(a => new Date(a.joinedAt).getTime()).filter(Boolean);
  if (times.length >= 2) {
    const min = Math.min(...times);
    const max = Math.max(...times);
    const diffMin = Math.round((max - min) / 60000);
    return `~${diffMin} minutos (estimado)`;
  }

  return 'No disponible';
}

module.exports = { generateClassReportPDF };
