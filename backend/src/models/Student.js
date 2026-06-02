const mongoose = require('mongoose');

// ── Student Schema (RF-01) ─────────────────────────────────────────────────────
const StudentSchema = new mongoose.Schema({

  // 8–11 numeric digits, unique
  documento: {
    type: String,
    required: [true, 'El documento es obligatorio'],
    unique: true,
    match: [/^\d{8,11}$/, 'El documento debe tener entre 8 y 11 dígitos numéricos'],
  },

  // Max 32 chars, letters only
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    maxlength: [32, 'El nombre no puede superar 32 caracteres'],
    match: [/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, 'El nombre solo puede contener letras y espacios'],
    trim: true,
  },

  apellido: {
    type: String,
    required: [true, 'El apellido es obligatorio'],
    maxlength: [32, 'El apellido no puede superar 32 caracteres'],
    match: [/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/, 'El apellido solo puede contener letras y espacios'],
    trim: true,
  },

  // 4-digit year string e.g. "2001"
  anioNacimiento: {
    type: String,
    required: [true, 'El año de nacimiento es obligatorio'],
    match: [/^\d{4}$/, 'El año de nacimiento debe tener exactamente 4 dígitos'],
  },

  // Exactly 10 numeric digits, unique
  telefono: {
    type: String,
    required: [true, 'El teléfono es obligatorio'],
    unique: true,
    match: [/^\d{10}$/, 'El teléfono debe tener exactamente 10 dígitos numéricos'],
  },

  // Valid email format, unique
  correo: {
    type: String,
    required: [true, 'El correo es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Formato de correo inválido'],
  },

  // Stored as bcrypt hash by the route
  clave: {
    type: String,
    required: [true, 'La clave es obligatoria'],
    minlength: [8, 'La clave debe tener al menos 8 caracteres'],
  },

  // Gender
  sexo: {
    type: String,
    enum: {
      values: ['Masculino', 'Femenino', 'Otro', 'M', 'F'],
      message: 'El sexo debe ser Masculino, Femenino u Otro',
    },
  },

  // Academic institution name
  institucion: {
    type: String,
    required: [true, 'La institución académica es obligatoria'],
    trim: true,
  },

  // Active for classes (true by default)
  estado: {
    type: Boolean,
    default: true,
  },

  // [RF-01] Admin approval flag — starts as false until admin approves
  aprobado: {
    type: Boolean,
    default: false,
  },

  // GeoJSON location point for tracking student location at login
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
    }
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Optionally we can add a 2dsphere index if needed for querying by location
StudentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Student', StudentSchema);
