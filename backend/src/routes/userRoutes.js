const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const { Teacher } = require('../models/Teacher');
const Student  = require('../models/Student');

const getAllUsers = async (req, res) => {
  try {
    const { limit: limitParam, role, search, page: pageParam } = req.query;
    const limit = (limitParam && limitParam !== 'Todos') ? parseInt(limitParam) : 0;
    const page = parseInt(pageParam) || 1;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const counts = { admin: 0, teacher: 0, student: 0 };
    const searchRegex = search ? new RegExp(search, 'i') : null;

    let adminQ = User.find().select('-password');
    if (searchRegex) adminQ = adminQ.or([{ name: searchRegex }, { email: searchRegex }, { username: searchRegex }]);
    counts.admin = await User.countDocuments(adminQ.getFilter());

    let teacherQ = Teacher.find().select('-clave');
    if (searchRegex) teacherQ = teacherQ.or([{ nombre: searchRegex }, { apellido: searchRegex }, { correo: searchRegex }, { documento: searchRegex }, { areaDominio: searchRegex }]);
    counts.teacher = await Teacher.countDocuments(teacherQ.getFilter());

    let studentQ = Student.find().select('-clave');
    if (searchRegex) studentQ = studentQ.or([{ nombre: searchRegex }, { apellido: searchRegex }, { correo: searchRegex }, { documento: searchRegex }, { institucion: searchRegex }]);
    counts.student = await Student.countDocuments(studentQ.getFilter());

    const searchRegexStr = search ? search : null;

    const adminPipeline = [];
    if (!role || role === 'all' || role === 'admin') {
      if (searchRegexStr) {
        adminPipeline.push({ $match: { $or: [{ name: { $regex: searchRegexStr, $options: 'i' } }, { email: { $regex: searchRegexStr, $options: 'i' } }, { username: { $regex: searchRegexStr, $options: 'i' } }] } });
      }
      adminPipeline.push({
        $project: {
          _id: 0, id: { $toString: "$_id" }, name: "$name", nombre: null, apellido: null,
          email: "$email", username: "$username", role: "$role",
          estado: { $literal: true }, aprobado: { $literal: true }, createdAt: "$createdAt",
          documento: null, telefono: null, areaDominio: null, anioInicio: null,
          institucion: null, anioNacimiento: null
        }
      });
    }

    const teacherPipeline = [];
    if (!role || role === 'all' || role === 'teacher') {
      if (searchRegexStr) {
        teacherPipeline.push({ $match: { $or: [{ nombre: { $regex: searchRegexStr, $options: 'i' } }, { apellido: { $regex: searchRegexStr, $options: 'i' } }, { correo: { $regex: searchRegexStr, $options: 'i' } }, { documento: { $regex: searchRegexStr, $options: 'i' } }, { areaDominio: { $regex: searchRegexStr, $options: 'i' } }] } });
      }
      teacherPipeline.push({
        $project: {
          _id: 0, id: { $toString: "$_id" }, name: { $concat: ["$nombre", " ", "$apellido"] },
          nombre: "$nombre", apellido: "$apellido", email: "$correo", username: "$documento",
          role: { $literal: "teacher" }, estado: "$estado", aprobado: { $literal: true },
          createdAt: "$createdAt", documento: "$documento", telefono: "$telefono",
          areaDominio: "$areaDominio", anioInicio: "$anioInicio", institucion: null, anioNacimiento: null
        }
      });
    }

    const studentPipeline = [];
    if (!role || role === 'all' || role === 'student') {
      if (searchRegexStr) {
        studentPipeline.push({ $match: { $or: [{ nombre: { $regex: searchRegexStr, $options: 'i' } }, { apellido: { $regex: searchRegexStr, $options: 'i' } }, { correo: { $regex: searchRegexStr, $options: 'i' } }, { documento: { $regex: searchRegexStr, $options: 'i' } }, { institucion: { $regex: searchRegexStr, $options: 'i' } }] } });
      }
      studentPipeline.push({
        $project: {
          _id: 0, id: { $toString: "$_id" }, name: { $concat: ["$nombre", " ", "$apellido"] },
          nombre: "$nombre", apellido: "$apellido", email: "$correo", username: "$documento",
          role: { $literal: "student" }, estado: "$estado", aprobado: "$aprobado",
          createdAt: "$createdAt", documento: "$documento", telefono: "$telefono",
          areaDominio: null, anioInicio: null, institucion: "$institucion", anioNacimiento: "$anioNacimiento"
        }
      });
    }

    const mainPipeline = [];
    let baseCollection = User;

    if (!role || role === 'all') {
      mainPipeline.push(...adminPipeline);
      mainPipeline.push({ $unionWith: { coll: "teachers", pipeline: teacherPipeline } });
      mainPipeline.push({ $unionWith: { coll: "students", pipeline: studentPipeline } });
    } else if (role === 'admin') {
      mainPipeline.push(...adminPipeline);
    } else if (role === 'teacher') {
      baseCollection = Teacher;
      mainPipeline.push(...teacherPipeline);
    } else if (role === 'student') {
      baseCollection = Student;
      mainPipeline.push(...studentPipeline);
    }

    mainPipeline.push({ $sort: { createdAt: -1 } });
    if (skip > 0) mainPipeline.push({ $skip: skip });
    if (limit > 0) mainPipeline.push({ $limit: limit });

    const rawResults = await baseCollection.aggregate(mainPipeline);

    const normalized = rawResults.map(u => ({
      ...u,
      avatar: (u.name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    }));

    res.set('X-Count-Admin', counts.admin);
    res.set('X-Count-Teacher', counts.teacher);
    res.set('X-Count-Student', counts.student);
    res.set('X-Count-All', counts.admin + counts.teacher + counts.student);
    res.set('Access-Control-Expose-Headers', 'X-Count-Admin, X-Count-Teacher, X-Count-Student, X-Count-All');

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/users — Solo administradores ──────────────
const getAdmins = async (_req, res) => {
  try {
    const admins = await User.find().select('-password').lean();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.get('/',    getAdmins);
router.get('/all', getAllUsers);

module.exports = router;
