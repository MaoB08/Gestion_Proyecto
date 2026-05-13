const Course = require('../models/Course');

// @desc Get report of courses by category
// @route GET /api/courses/reports/categories
exports.getCategoryReport = async (req, res) => {
  try {
    const report = await Course.aggregate([
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: 'courseId',
          as: 'courseClasses'
        }
      },
      {
        $group: {
          _id: { $cond: { if: { $eq: ["$category", ""] }, then: "Sin Categoría", else: { $ifNull: ["$category", "Sin Categoría"] } } },
          totalCourses: { $sum: 1 },
          totalClasses: { $sum: { $size: { $ifNull: ["$courseClasses", []] } } }
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          totalCourses: 1,
          totalClasses: 1
        }
      },
      {
        $sort: { category: 1 }
      }
    ]);
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get all courses (with teacher populated)
// @route GET /api/courses
exports.getAll = async (req, res) => {
  try {
    const { sortBy, order, category, estado } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (estado) filter.estado = estado;

    if (sortBy === 'students' || sortBy === 'classes') {
      const sortOrder = order === 'desc' ? -1 : 1;
      
      const pipeline = [
        {
          $lookup: {
            from: 'teachers',
            localField: 'teacherId',
            foreignField: '_id',
            as: 'teacher'
          }
        },
        { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            teacherId: '$teacher',
            studentsCount: { $size: { $ifNull: ['$studentIds', []] } }
          }
        }
      ];

      if (sortBy === 'classes') {
        pipeline.push({
          $lookup: {
            from: 'classes',
            localField: '_id',
            foreignField: 'courseId',
            as: 'courseClasses'
          }
        });
        pipeline.push({
          $addFields: {
            classesCount: { $size: { $ifNull: ['$courseClasses', []] } }
          }
        });
      }

      pipeline.push({
        $sort: {
          [sortBy === 'students' ? 'studentsCount' : 'classesCount']: sortOrder
        }
      });

      const aggregatedCourses = await Course.aggregate(pipeline);
      return res.json(aggregatedCourses);
    }

    const courses = await Course.find(filter).populate('teacherId', 'nombre apellido correo');
    // Indicamos en headers que esta ruta puede aprovechar el índice compuesto si se pasan category y estado
    res.set('X-DB-Optimization', 'index_course_category_estado');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get single course
// @route GET /api/courses/:id
exports.getById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('teacherId', 'nombre apellido correo');
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get courses by teacher
// @route GET /api/courses/teacher/:teacherId
exports.getByTeacher = async (req, res) => {
  try {
    const courses = await Course.find({ teacherId: req.params.teacherId });
    res.set('X-DB-Optimization', 'index_course_teacherId');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get enrolled students for a course
// @route GET /api/courses/:id/students
exports.getCourseStudents = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const courseId = new mongoose.Types.ObjectId(req.params.id);

    const result = await Course.aggregate([
      { $match: { _id: courseId } },
      { 
        $lookup: {
          from: 'students', 
          localField: 'studentIds', 
          foreignField: '_id', 
          as: 'enrolledStudents'
        } 
      },
      { $unwind: { path: '$enrolledStudents', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: '$enrolledStudents._id',
          nombre: '$enrolledStudents.nombre',
          apellido: '$enrolledStudents.apellido',
          correo: '$enrolledStudents.correo',
          location: '$enrolledStudents.location'
        }
      }
    ]);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get courses by student
// @route GET /api/courses/student/:studentId
exports.getByStudent = async (req, res) => {
  try {
    const courses = await Course.find({ studentIds: req.params.studentId });
    res.set('X-DB-Optimization', 'index_course_studentIds');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Create course
// @route POST /api/courses
exports.create = async (req, res) => {
  try {
    const { estado, teacherId } = req.body;
    
    // Validar: si está en espera de docente, no puede tener profesor
    if (estado === 'En espera de docente' && teacherId) {
      return res.status(400).json({ message: 'No se puede asignar un profesor si el curso está en espera de docente' });
    }

    const course = await Course.create(req.body);
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Update course
// @route PUT /api/courses/:id
exports.update = async (req, res) => {
  try {
    const { estado, teacherId } = req.body;
    
    // Si viene el estado, validar concordancia con profesor
    if (estado === 'En espera de docente' && teacherId) {
      return res.status(400).json({ message: 'No se puede asignar un profesor si el curso está en espera de docente' });
    }

    // Si viene profesor y no estado, pero el curso actual está en espera de docente?
    // Buscamos el curso primero para validaciones complejas si es necesario
    const existing = await Course.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Course not found' });

    // Si el usuario cambia el profesor pero no el estado, y estaba en espera de docente
    if (teacherId && !estado && existing.estado === 'En espera de docente') {
       return res.status(400).json({ message: 'Debe cambiar el estado del curso para poder asignar un profesor' });
    }

    // Si el usuario cambia el estado a espera de docente pero mantiene el profesor anterior
    if (estado === 'En espera de docente' && !teacherId && existing.teacherId) {
       return res.status(400).json({ message: 'Debe desasignar al profesor antes de poner el curso en espera de docente' });
    }

    // Resetear solicitud de despausa si el estado está presente (cambio manual por admin)
    if (estado) {
      req.body.solicitarDespausa = false;
    }

    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Delete course
// @route DELETE /api/courses/:id
exports.remove = async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Enroll student
// @route POST /api/courses/:id/enroll
exports.enrollStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ message: 'studentId es requerido' });

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Curso no encontrado' });

    // RF-08 Alt. flow 5.2: course not active
    if (course.estado !== 'Activo') {
      return res.status(400).json({ message: 'Este curso no está disponible para inscripción' });
    }

    // RF-08: Cerrado check
    if (course.tipoInscripcion === 'Cerrado') {
      return res.status(403).json({ message: 'Este curso es privado y no admite autoinscripción' });
    }

    // RF-08 Alt. flow 5.1: already enrolled
    const alreadyIn = course.studentIds.map(String).includes(String(studentId));
    if (alreadyIn) {
      return res.status(409).json({ message: 'Ya estás inscrito en este curso', alreadyEnrolled: true });
    }

    // Check capacity
    if (course.studentIds.length >= (course.maxStudents || 20)) {
      return res.status(400).json({ message: 'Este curso ya ha alcanzado su capacidad máxima de estudiantes.' });
    }

    course.studentIds.push(studentId);
    await course.save();
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Unenroll student
// @route POST /api/courses/:id/unenroll
exports.unenrollStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $pull: { studentIds: studentId } },
      { new: true }
    );
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Request enrollment
// @route POST /api/courses/:id/request-enroll
exports.requestEnrollment = async (req, res) => {
  try {
    const { studentId } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Curso no encontrado' });

    if (course.estado !== 'Activo') return res.status(400).json({ message: 'Curso no activo' });
    if (course.tipoInscripcion === 'Cerrado') return res.status(403).json({ message: 'Este curso es privado' });

    const alreadyIn = course.studentIds.map(String).includes(String(studentId));
    if (alreadyIn) return res.status(400).json({ message: 'Ya estás inscrito' });

    const alreadyPending = (course.pendingStudentIds || []).map(String).includes(String(studentId));
    if (alreadyPending) return res.status(400).json({ message: 'Solicitud ya enviada y pendiente' });

    const totalPotential = (course.studentIds.length + (course.pendingStudentIds || []).length);
    if (totalPotential >= (course.maxStudents || 20)) {
      return res.status(400).json({ message: 'No se pueden enviar más solicitudes. El curso está lleno o tiene demasiadas solicitudes pendientes.' });
    }

    course.pendingStudentIds.push(studentId);
    await course.save();
    res.json({ message: 'Solicitud enviada correctamente', course });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Approve enrollment
// @route POST /api/courses/:id/approve-enroll
exports.approveEnrollment = async (req, res) => {
  try {
    const { studentId } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Curso no encontrado' });

    // Move from pending to enrolled
    course.pendingStudentIds = (course.pendingStudentIds || []).filter(id => String(id) !== String(studentId));
    
    const alreadyIn = course.studentIds.map(String).includes(String(studentId));
    if (!alreadyIn) {
      // Final check on capacity before approving
      if (course.studentIds.length >= (course.maxStudents || 20)) {
        return res.status(400).json({ message: 'No se puede aprobar la solicitud. El curso ya ha alcanzado su capacidad máxima.' });
      }
      course.studentIds.push(studentId);
    }
    
    await course.save();
    res.json({ message: 'Solicitud aprobada', course });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Reject enrollment
// @route POST /api/courses/:id/reject-enroll
exports.rejectEnrollment = async (req, res) => {
  try {
    const { studentId } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $pull: { pendingStudentIds: studentId } },
      { new: true }
    );
    res.json({ message: 'Solicitud rechazada', course });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
