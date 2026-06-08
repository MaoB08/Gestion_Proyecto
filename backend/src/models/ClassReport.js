const mongoose = require('mongoose');

// ── CLASS REPORT ──────────────────────────────────────────────────────────────
// Stores metadata about generated class-completion reports.
// The actual PDF is stored on disk; this document tracks who requested it
// and which class it belongs to.

const ClassReportSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  // 'teacher' | 'student' | 'admin'
  reportType: {
    type: String,
    enum: ['teacher', 'student', 'admin'],
    required: true,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Path to the generated PDF on disk
  filePath: {
    type: String,
    required: true,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for fast look-up by class + report type
ClassReportSchema.index({ classId: 1, reportType: 1 });

module.exports = mongoose.model('ClassReport', ClassReportSchema);
