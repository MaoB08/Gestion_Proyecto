const mongoose = require('mongoose');

// ── COURSE CONTENT SUB-SCHEMA ────────────────────────────────────────────────
const CourseContentSchema = new mongoose.Schema({
  title:        { type: String, required: true, maxlength: 100 },
  originalName: { type: String },
  type:         { type: String, enum: ['Archivo', 'Actividad', 'Anuncio'], required: true },
  description:  { type: String, maxlength: 500 },
  fileUrl:      { type: String }, // Use only for 'Archivo'
  createdAt:    { type: Date, default: Date.now },
});

// ── COURSE ────────────────────────────────────────────────────────────────────
const CourseSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String },
  category:    { type: String },
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  studentIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  pendingStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  contents:    [CourseContentSchema],
  estado:      { type: String, enum: ['Activo', 'Desactivado', 'En espera de docente', 'Pausado'], default: 'Activo' },
  tipoInscripcion: { type: String, enum: ['Abierto', 'Cerrado'], default: 'Abierto' },
  maxStudents: { type: Number, default: 20 },
  createdAt:   { type: Date, default: Date.now },
});

// Explicit index for filtering courses by teacher (Performance) - Single Index
CourseSchema.index({ teacherId: 1 });

// b. Índice compuesto (Compound Index): Para búsquedas frecuentes combinando categoría y estado
CourseSchema.index({ category: 1, estado: 1 });

// c. Índice multikey: Para buscar rápidamente todos los cursos en los que un estudiante está inscrito (studentIds es un array)
CourseSchema.index({ studentIds: 1 });

module.exports = mongoose.model('Course', CourseSchema);
