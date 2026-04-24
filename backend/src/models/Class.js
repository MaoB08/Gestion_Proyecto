const mongoose = require('mongoose');

// ── SUB-SCHEMAS ───────────────────────────────────────────────────────────────
const TranscriptionSegmentSchema = new mongoose.Schema({
  text:      String,
  timestamp: String,
  isFinal:   Boolean,
});

const QuestionSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:     String,
  userAvatar:   String,
  text:         String,
  isQuickReply: Boolean,
  status:       { type: String, enum: ['pending', 'answered'], default: 'pending' },
  upvotes:      { type: Number, default: 0 },
  sentAt:       { type: Date, default: Date.now },
  answeredAt:   Date,
});

const AttendanceSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  joinedAt: { type: Date, default: Date.now },
});

const AttentionCheckResponseSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  responded:   { type: Boolean, default: false },
  respondedAt: { type: Date, default: null },
});

const AttentionCheckSchema = new mongoose.Schema({
  launchedAt:  { type: Date, default: Date.now },
  timeoutSecs: { type: Number, default: 30 },
  responses:   [AttentionCheckResponseSchema],
  status:      { type: String, enum: ['active', 'completed'], default: 'active' },
});

// ── CLASS ─────────────────────────────────────────────────────────────────────
const ClassSchema = new mongoose.Schema({
  courseId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title:              { type: String, required: true },
  description:        { type: String, maxLength: 500 },
  date:               { type: String, required: true },
  startTime:          { type: String, required: true },
  endTime:            { type: String, required: true },
  sessionType:        { type: String, enum: ['Live', 'In-Person', 'Workshop'], default: 'Live' },
  isActive:           { type: Boolean, default: true },
  transcription:      [TranscriptionSegmentSchema],
  savedTranscription: String,
  summary:            String,
  participantIds:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  questions:          [QuestionSchema],
  attendance:         [AttendanceSchema],
  attentionChecks:    [AttentionCheckSchema],
  createdAt:          { type: Date, default: Date.now },
});

// Explicit index for filtering classes by course (Performance)
ClassSchema.index({ courseId: 1 });

module.exports = mongoose.model('Class', ClassSchema);
