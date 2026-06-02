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

// @desc  Get grades for a course filtered by tier (inferior/estandar/sobresaliente)
// @route GET /api/grades/course/:courseId/tier?tier=inferior|estandar|sobresaliente
exports.getGradesByTier = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { tier } = req.query;
    const mongoose = require('mongoose');

    let gradeFilter;
    if (tier === 'todas') {
      gradeFilter = { $ne: -50 };
    } else if (tier === 'no-entregados') {
      gradeFilter = { $in: [0] };
    } else if (tier === 'inferior') {
      gradeFilter = { $lte: 2.9 };
    } else if (tier === 'estandar') {
      gradeFilter = { $gte: 3.0, $lt: 4 };
    } else if (tier === 'sobresaliente') {
      gradeFilter = { $gte: 4.0 };
    } else {
      return res.status(400).json({ message: 'Parámetro tier inválido. Use: todas, no-entregados, inferior, estandar o sobresaliente' });
    }

    // contentId no tiene ref en el schema, es subdocumento embebido en Course.contents
    // Usamos aggregate + $lookup para obtener el título de la actividad
    const results = await Grade.aggregate([
      {
        $match: {
          courseId: new mongoose.Types.ObjectId(courseId),
          grade: gradeFilter,
        },
      },
      // Join con Student para nombre/apellido
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      // Join con Course para buscar el contenido dentro del array contents
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course',
        },
      },
      { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
      // Extraer el contenido cuyo _id coincida con contentId
      {
        $addFields: {
          activity: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$course.contents', []] },
                  as: 'cnt',
                  cond: { $eq: ['$$cnt._id', '$contentId'] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          grade: 1,
          'studentId.nombre': '$student.nombre',
          'studentId.apellido': '$student.apellido',
          'studentId.documento': '$student.documento',
          'contentId.title': '$activity.title',
        },
      },
      { $sort: { grade: 1 } },
    ]);

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
