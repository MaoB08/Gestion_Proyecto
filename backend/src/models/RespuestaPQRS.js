const mongoose = require('mongoose');

// ── RESPUESTA_PQRS ────────────────────────────────────────────────────────────
// Colección que almacena las respuestas del administrador a cada PQRS.
// Relación: una PQRS puede tener como máximo una respuesta oficial.
const RespuestaPQRSSchema = new mongoose.Schema(
  {
    // ── Referencia a la PQRS respondida ───────────────────────────────────────
    pqrsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PQRS',
      required: true,
      unique: true,    // solo una respuesta por PQRS
    },

    // ── Administrador que responde ────────────────────────────────────────────
    adminId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminName: { type: String, required: true },   // desnormalizado

    // ── Contenido de la respuesta ─────────────────────────────────────────────
    respuesta: { type: String, required: true, maxlength: 3000 },

    // ── Ruta del PDF generado automáticamente ─────────────────────────────────
    pdfPath: { type: String, default: null },
  },
  { timestamps: true }
);

// Índice para buscar la respuesta de una PQRS rápidamente
RespuestaPQRSSchema.index({ pqrsId: 1 });

module.exports = mongoose.model('RespuestaPQRS', RespuestaPQRSSchema);
