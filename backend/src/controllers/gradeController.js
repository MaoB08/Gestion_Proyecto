const Grade = require('../models/Grade');

// @desc  Create or update a grade
// @route POST /api/grades
exports.upsertGrade = async (req, res) => {
  try {
    const { studentId, courseId, contentId, grade, teacherId, feedback } = req.body;

    if (grade < 0 || grade > 5) {
      return res.status(400).json({ message: 'La calificación debe estar entre 0 y 5' });
    }

    // Upsert logic: find if exists, otherwise create
    const filter = { studentId, courseId, contentId };
    const update = { grade, teacherId, feedback, updatedAt: Date.now() };
    
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    
    const result = await Grade.findOneAndUpdate(filter, update, options);
    
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Get grades for a specific course
// @route GET /api/grades/course/:courseId
exports.getGradesByCourse = async (req, res) => {
  try {
    const grades = await Grade.find({ courseId: req.params.courseId })
      .populate('studentId', 'nombre apellido documento correo')
      .populate('teacherId', 'nombre apellido');
    res.json(grades);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get grades for a specific student
// @route GET /api/grades/student/:studentId
exports.getGradesByStudent = async (req, res) => {
  try {
    const grades = await Grade.find({ studentId: req.params.studentId })
      .populate('courseId', 'name')
      .populate('teacherId', 'nombre apellido');
    res.set('X-DB-Optimization', 'index_grade_studentId');
    res.json(grades);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
