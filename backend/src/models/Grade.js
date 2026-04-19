const mongoose = require('mongoose');

const GradeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  grade: {
    type: Number,
    required: [true, 'La calificación es obligatoria'],
    min: [0, 'La calificación mínima es 0'],
    max: [5, 'La calificación máxima es 5'],
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
  },
  feedback: {
    type: String,
    maxlength: [500, 'La retroalimentación no puede superar los 500 caracteres'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Explicit index for filtering grades by student (Performance)
GradeSchema.index({ studentId: 1 });

// Ensure a student only has one grade per activity in a course
GradeSchema.index({ studentId: 1, courseId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model('Grade', GradeSchema);
