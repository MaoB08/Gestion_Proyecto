const mongoose = require('mongoose');

// ── PQRS ──────────────────────────────────────────────────────────────────────
// Colección principal que almacena cada solicitud de Petición, Queja,
// Reclamo o Sugerencia enviada por un usuario (student o teacher).
const PQRSSchema = new mongoose.Schema(
  {
    // ── Relación con el usuario que crea la solicitud ─────────────────────────
    // Almacena el _id del documento User (admin model) o el _id del Teacher/Student.
    // Se guarda también el modelo de origen para popular correctamente.
    userId:       { type: mongoose.Schema.Types.ObjectId, required: true },
    userModel:    { type: String, enum: ['User', 'Teacher', 'Student'], required: true },
    userName:     { type: String, required: true },   // desnormalizado para rapidez
    userEmail:    { type: String, required: true },   // desnormalizado para envío de correo
    userRole:     { type: String, enum: ['student', 'teacher'], required: true },

    // ── Tipo de solicitud ──────────────────────────────────────────────────────
    tipo: {
      type: String,
      enum: ['peticion', 'queja', 'reclamo', 'sugerencia'],
      required: true,
    },

    // ── Contenido ─────────────────────────────────────────────────────────────
    asunto:      { type: String, required: true, maxlength: 150 },
    descripcion: { type: String, required: true, maxlength: 2000 },

    // ── Estado del flujo ──────────────────────────────────────────────────────
    estado: {
      type: String,
      enum: ['pendiente', 'en_revision', 'resuelto', 'cerrado'],
      default: 'pendiente',
    },
  },
  { timestamps: true }   // agrega createdAt y updatedAt automáticamente
);

// Índices para optimizar consultas frecuentes
PQRSSchema.index({ userId: 1 });           // listar PQRS de un usuario
PQRSSchema.index({ estado: 1 });           // filtrar por estado (admin)
PQRSSchema.index({ createdAt: -1 });       // orden cronológico inverso

module.exports = mongoose.model('PQRS', PQRSSchema);
