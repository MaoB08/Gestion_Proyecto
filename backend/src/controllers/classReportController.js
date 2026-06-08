const Class       = require('../models/Class');
const Course      = require('../models/Course');
const ClassReport = require('../models/ClassReport');
const Student     = require('../models/Student');
const User        = require('../models/User');
const { Teacher } = require('../models/Teacher');
const { generateClassReportPDF } = require('../services/classReportPdfService');
const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a userId → { name, email } map from all user collections.
 */
async function buildUserMap(userIds) {
  const map = {};
  const ids = [...new Set(userIds.map(String))];

  // Fetch from all three collections in parallel
  const [students, teachers, admins] = await Promise.all([
    Student.find({ _id: { $in: ids } }).lean().catch(() => []),
    Teacher.find({ _id: { $in: ids } }).lean().catch(() => []),
    User.find({ _id: { $in: ids } }).lean().catch(() => []),
  ]);

  students.forEach(s => {
    map[String(s._id)] = { name: `${s.nombre} ${s.apellido}`, email: s.correo };
  });
  teachers.forEach(t => {
    map[String(t._id)] = { name: `${t.nombre} ${t.apellido}`, email: t.correo };
  });
  admins.forEach(a => {
    map[String(a._id)] = { name: a.name, email: a.email };
  });

  return map;
}

// ── Controller: Generate & Download Report ────────────────────────────────────

/**
 * @desc  Generate (or re-use) a class completion report PDF and stream it back.
 * @route GET /api/class-reports/:classId/download?role=teacher|student|admin
 */
exports.downloadReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const reportType = req.query.role || 'student';

    if (!['teacher', 'student', 'admin'].includes(reportType)) {
      return res.status(400).json({ message: 'El parámetro "role" debe ser teacher, student o admin.' });
    }

    // 1. Fetch class with full population
    const cls = await Class.findById(classId).lean();
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada.' });

    // 2. Fetch course
    const course = await Course.findById(cls.courseId).lean();
    if (!course) return res.status(404).json({ message: 'Curso no encontrado.' });

    // 3. Gather all user IDs involved
    const allIds = [
      ...(cls.participantIds || []),
      ...(cls.attendance || []).map(a => a.userId),
      ...(cls.questions || []).map(q => q.userId),
      ...(course.studentIds || []),
      ...(cls.ipLogs || []).map(log => log.userId), // Add ipLogs users
    ].filter(Boolean);

    const userMap = await buildUserMap(allIds);

    // 4. Get enrolled students for absence calculation
    const enrolledStudents = await Student.find({ _id: { $in: course.studentIds || [] } }).lean();

    // 5. IP logs (only for admin)
    const ipLogs = reportType === 'admin' ? (cls.ipLogs || []) : [];

    // 6. Generate PDF
    const filePath = await generateClassReportPDF({
      cls,
      course,
      reportType,
      enrolledStudents,
      userMap,
      ipLogs,
    });

    // 7. Save report record
    await ClassReport.create({
      classId: cls._id,
      courseId: course._id,
      reportType,
      requestedBy: req.query.userId || null,
      filePath,
    });

    // 8. Stream PDF to client
    const fileName = path.basename(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    readStream.on('error', (err) => {
      console.error('Error streaming PDF:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error al enviar el PDF.' });
      }
    });

  } catch (err) {
    console.error('Error generating class report:', err);
    res.status(500).json({ message: err.message || 'Error interno al generar el reporte.' });
  }
};

/**
 * @desc  Get report metadata (history) for a specific class.
 * @route GET /api/class-reports/:classId
 */
exports.getReportsByClass = async (req, res) => {
  try {
    const reports = await ClassReport.find({ classId: req.params.classId })
      .sort({ generatedAt: -1 })
      .lean();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc  Log IP / location when a user joins a class (for admin security report).
 * @route POST /api/class-reports/:classId/log-ip
 */
exports.logUserIP = async (req, res) => {
  try {
    const { classId } = req.params;
    const { userId, ip, location } = req.body;

    if (!userId) return res.status(400).json({ message: 'userId es requerido.' });

    let finalIp = ip || req.ip || req.connection?.remoteAddress || '0.0.0.0';
    let finalLocation = location || 'No disponible';

    // Format local IP for development/testing
    if (finalIp === '::1' || finalIp === '127.0.0.1') {
      finalIp = '127.0.0.1 (Localhost)';
      if (finalLocation === 'No disponible') {
        finalLocation = 'Desarrollo Local / Pruebas';
      }
    }

    await Class.findByIdAndUpdate(classId, {
      $push: {
        ipLogs: {
          userId,
          ip: finalIp,
          location: finalLocation,
          timestamp: new Date(),
        },
      },
    });

    res.json({ message: 'IP registrada correctamente.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
