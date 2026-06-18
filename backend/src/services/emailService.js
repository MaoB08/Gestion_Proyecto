const nodemailer = require('nodemailer');

// ── Transporter ───────────────────────────────────────────────────────────────
// Si hay credenciales SMTP en el .env se usan; de lo contrario se crea
// automáticamente una cuenta de prueba con Ethereal (sin configuración extra).
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Proveedor SMTP real (Gmail, Brevo, Outlook, etc.)
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('📧 Email: usando SMTP configurado en .env');
  } else {
    // Cuenta Ethereal automática (solo para pruebas — los correos se ven en
    // la URL que se imprime en consola, sin necesidad de credenciales reales).
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('📧 Email: usando cuenta Ethereal de prueba →', testAccount.user);
  }

  return transporter;
}

// ── Helper: from field ─────────────────────────────────────────────────────────
const FROM = process.env.SMTP_FROM || '"ClassAI PQRS" <noreply@classai.edu>';

// ── 1. Correo de confirmación al crear una PQRS ────────────────────────────────
async function sendConfirmacionPQRS(email, pqrs) {
  try {
    const transport = await getTransporter();

    const tipoLabel = {
      peticion:   'Petición',
      queja:      'Queja',
      reclamo:    'Reclamo',
      sugerencia: 'Sugerencia',
    }[pqrs.tipo] || pqrs.tipo;

    const info = await transport.sendMail({
      from:    FROM,
      to:      email,
      subject: `✅ PQRS Recibida — ${tipoLabel}: ${pqrs.asunto}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:0;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#7C3AED,#4F46E5);padding:32px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🎓</div>
            <div style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ClassAI</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">Sistema de PQRS</div>
          </div>

          <!-- Body -->
          <div style="background:white;padding:36px 40px;">
            <h2 style="color:#1F2937;font-size:20px;margin:0 0 8px;">¡Tu solicitud fue recibida!</h2>
            <p style="color:#6B7280;font-size:14px;margin:0 0 28px;line-height:1.6;">
              Hemos registrado tu ${tipoLabel.toLowerCase()} exitosamente. Nuestro equipo la revisará 
              y te notificará por este medio cuando sea respondida.
            </p>

            <!-- Detail card -->
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <span style="font-size:13px;font-weight:600;color:#374151;">Detalles de la solicitud</span>
                <span style="background:#EDE9FE;color:#7C3AED;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${tipoLabel.toUpperCase()}</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:8px 0;color:#6B7280;width:120px;">ID de radicado</td>
                  <td style="padding:8px 0;color:#111827;font-weight:600;font-family:monospace;">${pqrs._id}</td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:8px 0;color:#6B7280;">Asunto</td>
                  <td style="padding:8px 0;color:#111827;font-weight:600;">${pqrs.asunto}</td>
                </tr>
                <tr style="border-bottom:1px solid #E5E7EB;">
                  <td style="padding:8px 0;color:#6B7280;">Estado</td>
                  <td style="padding:8px 0;"><span style="background:#ECFDF5;color:#059669;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">PENDIENTE</span></td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6B7280;">Fecha</td>
                  <td style="padding:8px 0;color:#111827;">${new Date(pqrs.createdAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</td>
                </tr>
              </table>
            </div>

            <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:0;">
              Puedes consultar el estado de tu PQRS en cualquier momento desde la plataforma ClassAI 
              en la sección <strong>PQRS</strong>.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#F3F4F6;padding:20px 40px;text-align:center;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">
              Este es un correo automático. Por favor no respondas a este mensaje.<br/>
              ClassAI — Aulas en tiempo real
            </p>
          </div>
        </div>
      `,
    });

    console.log(`📧 Confirmación PQRS enviada a ${email}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('\n========================================================================');
      console.log('🔗 LINK DE PRUEBAS DEL EMAIL (Ethereal):');
      console.log(`👉 ${previewUrl} 👈`);
      console.log('========================================================================\n');
    }
    return true;
  } catch (err) {
    console.error('❌ Error enviando confirmación PQRS:', err.message);
    return false;
  }
}

// ── 2. Correo de respuesta con PDF adjunto ────────────────────────────────────
async function sendRespuestaPQRS(email, pqrs, respuesta, pdfPath) {
  try {
    const transport = await getTransporter();

    const tipoLabel = {
      peticion:   'Petición',
      queja:      'Queja',
      reclamo:    'Reclamo',
      sugerencia: 'Sugerencia',
    }[pqrs.tipo] || pqrs.tipo;

    const attachments = [];
    if (pdfPath) {
      const fs = require('fs');
      if (fs.existsSync(pdfPath)) {
        attachments.push({
          filename: `Respuesta_PQRS_${pqrs._id}.pdf`,
          path:     pdfPath,
          contentType: 'application/pdf',
        });
      }
    }

    const info = await transport.sendMail({
      from:    FROM,
      to:      email,
      subject: `📄 Respuesta a tu PQRS — ${tipoLabel}: ${pqrs.asunto}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:0;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <div style="background:linear-gradient(135deg,#059669,#047857);padding:32px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">✅</div>
            <div style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ClassAI</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">Tu PQRS ha sido respondida</div>
          </div>

          <!-- Body -->
          <div style="background:white;padding:36px 40px;">
            <h2 style="color:#1F2937;font-size:20px;margin:0 0 8px;">Tu solicitud fue respondida</h2>
            <p style="color:#6B7280;font-size:14px;margin:0 0 24px;line-height:1.6;">
              El administrador ha respondido tu ${tipoLabel.toLowerCase()}. 
              Puedes ver los detalles a continuación y en el PDF adjunto.
            </p>

            <!-- Solicitud -->
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <div style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Tu solicitud</div>
              <div style="font-size:14px;font-weight:600;color:#111827;">${pqrs.asunto}</div>
              <div style="font-size:12px;color:#6B7280;margin-top:4px;">${tipoLabel} · ${new Date(pqrs.createdAt).toLocaleDateString('es-CO')}</div>
            </div>

            <!-- Respuesta -->
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
              <div style="font-size:12px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Respuesta del Administrador</div>
              <div style="font-size:14px;color:#1F2937;line-height:1.7;white-space:pre-wrap;">${respuesta.respuesta}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:12px;">
                Respondido por <strong>${respuesta.adminName}</strong> el ${new Date(respuesta.createdAt).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
              </div>
            </div>

            ${attachments.length > 0 ? `
            <div style="display:flex;align-items:center;gap:12px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 18px;">
              <span style="font-size:24px;">📄</span>
              <div>
                <div style="font-size:13px;font-weight:600;color:#059669;">Respuesta oficial en PDF adjunta</div>
                <div style="font-size:12px;color:#6B7280;">El documento oficial está adjunto a este correo.</div>
              </div>
            </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="background:#F3F4F6;padding:20px 40px;text-align:center;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">
              Este es un correo automático. Por favor no respondas a este mensaje.<br/>
              ClassAI — Aulas en tiempo real
            </p>
          </div>
        </div>
      `,
      attachments,
    });

    console.log(`📧 Respuesta PQRS enviada a ${email}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('\n========================================================================');
      console.log('🔗 LINK DE PRUEBAS DEL EMAIL (Ethereal):');
      console.log(`👉 ${previewUrl} 👈`);
      console.log('========================================================================\n');
    }
    return true;
  } catch (err) {
    console.error('❌ Error enviando respuesta PQRS:', err.message);
    return false;
  }
}

module.exports = { sendConfirmacionPQRS, sendRespuestaPQRS };
