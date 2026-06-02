const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// ── PDF Service ───────────────────────────────────────────────────────────────
// Genera el documento PDF oficial de respuesta a una PQRS y lo guarda en
// uploads/pqrs/. Retorna el path absoluto del archivo generado.

async function generarPDFRespuesta(pqrs, respuesta, adminName) {
  // Asegurar que el directorio de destino exista
  const uploadDir = path.join(__dirname, '../../uploads/pqrs');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `PQRS_Respuesta_${pqrs._id}_${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, fileName);

  const tipoLabel = {
    peticion:   'Petición',
    queja:      'Queja',
    reclamo:    'Reclamo',
    sugerencia: 'Sugerencia',
  }[pqrs.tipo] || pqrs.tipo;

  const estadoLabel = {
    pendiente:   'Pendiente',
    en_revision: 'En Revisión',
    resuelto:    'Resuelto',
    cerrado:     'Cerrado',
  }[pqrs.estado] || pqrs.estado;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // ── Paleta de colores ──────────────────────────────────────────────────────
    const PRIMARY   = '#7C3AED';
    const SUCCESS   = '#059669';
    const GRAY_DARK = '#1F2937';
    const GRAY_MID  = '#6B7280';
    const GRAY_LIGHT= '#F9FAFB';
    const BORDER    = '#E5E7EB';

    const PAGE_W = doc.page.width;
    const PAGE_H = doc.page.height;
    const MARGIN = 50;
    const INNER_W = PAGE_W - MARGIN * 2;

    let y = 130;

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
    };

    // ── Encabezado ─────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 110).fill(PRIMARY);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
       .text('ClassAI', MARGIN, 28);
    doc.fillColor('rgba(255,255,255,0.75)').fontSize(10).font('Helvetica')
       .text('Sistema de Gestión de PQRS', MARGIN, 54);

    // Sello de tipo en header
    doc.roundedRect(PAGE_W - 160, 24, 110, 28, 14)
       .fillAndStroke('rgba(255,255,255,0.15)', 'rgba(255,255,255,0.3)');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
       .text(tipoLabel.toUpperCase(), PAGE_W - 155, 33);

    doc.fillColor(GRAY_DARK);

    // ── Título ─────────────────────────────────────────────────────────────────
    doc.fontSize(16).font('Helvetica-Bold')
       .fillColor(GRAY_DARK)
       .text('RESPUESTA OFICIAL A PQRS', MARGIN, y, { align: 'center', width: INNER_W });
    y += 30;

    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
       .strokeColor(BORDER).lineWidth(1).stroke();
    y += 18;

    // ── Datos de la solicitud ──────────────────────────────────────────────────
    const drawSection = (title, color = PRIMARY) => {
      checkPageBreak(30);
      doc.rect(MARGIN, y, INNER_W, 22).fillColor(color).fill();
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
         .text(title, MARGIN + 10, y + 6);
      y += 30;
      doc.fillColor(GRAY_DARK);
    };

    const drawRow = (label, value) => {
      checkPageBreak(22);
      doc.rect(MARGIN, y, INNER_W, 22).fillColor(GRAY_LIGHT).fill();
      doc.rect(MARGIN, y, INNER_W, 22).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fillColor(GRAY_MID).fontSize(9).font('Helvetica')
         .text(label, MARGIN + 10, y + 6, { width: 130 });
      doc.fillColor(GRAY_DARK).fontSize(9).font('Helvetica-Bold')
         .text(String(value || '—'), MARGIN + 145, y + 6, { width: INNER_W - 155 });
      y += 22;
    };

    drawSection('INFORMACIÓN DE LA SOLICITUD');
    drawRow('ID de Radicado',  String(pqrs._id));
    drawRow('Tipo',            tipoLabel);
    drawRow('Asunto',          pqrs.asunto);
    drawRow('Solicitante',     pqrs.userName);
    drawRow('Correo',          pqrs.userEmail);
    drawRow('Fecha de Envío',  new Date(pqrs.createdAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }));
    drawRow('Estado Actual',   estadoLabel);
    y += 16;

    // ── Descripción de la solicitud ────────────────────────────────────────────
    doc.fontSize(10).font('Helvetica');
    const descHeight = doc.heightOfString(pqrs.descripcion, { width: INNER_W - 20, lineGap: 3 }) + 20;
    checkPageBreak(30 + descHeight);
    
    drawSection('DESCRIPCIÓN DE LA SOLICITUD');
    doc.rect(MARGIN, y, INNER_W, descHeight).fillColor(GRAY_LIGHT).fill();
    doc.rect(MARGIN, y, INNER_W, descHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.fillColor(GRAY_DARK).fontSize(10).font('Helvetica')
       .text(pqrs.descripcion, MARGIN + 10, y + 10, { width: INNER_W - 20, lineGap: 3 });
    y += descHeight + 16;

    // ── Respuesta del administrador ────────────────────────────────────────────
    const respTexto = respuesta.respuesta;
    doc.fontSize(10).font('Helvetica');
    const respHeight = doc.heightOfString(respTexto, { width: INNER_W - 20, lineGap: 3 }) + 24;
    checkPageBreak(30 + respHeight);

    drawSection('RESPUESTA DEL ADMINISTRADOR', SUCCESS);
    doc.rect(MARGIN, y, INNER_W, respHeight).fillColor('#F0FDF4').fill();
    doc.rect(MARGIN, y, INNER_W, respHeight).strokeColor('#A7F3D0').lineWidth(1).stroke();
    doc.fillColor('#1F2937').fontSize(10).font('Helvetica')
       .text(respTexto, MARGIN + 12, y + 12, { width: INNER_W - 24, lineGap: 3 });
    y += respHeight + 16;

    // ── Datos del administrador ────────────────────────────────────────────────
    drawRow('Respondido por',     adminName);
    drawRow('Fecha de Respuesta', new Date(respuesta.createdAt || new Date()).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }));
    y += 24;

    // ── Pie de página ──────────────────────────────────────────────────────────
    checkPageBreak(40);
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
       .strokeColor(BORDER).lineWidth(1).stroke();
    y += 12;
    doc.fillColor(GRAY_MID).fontSize(8).font('Helvetica')
       .text(
         'Este documento es una respuesta oficial emitida por ClassAI. ' +
         'Generado automáticamente el ' +
         new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) + '.',
         MARGIN, y, { width: INNER_W, align: 'center' }
       );

    doc.end();

    stream.on('finish', () => {
      console.log(`📄 PDF generado: ${filePath}`);
      resolve(filePath);
    });
    stream.on('error', reject);
  });
}

module.exports = { generarPDFRespuesta };
