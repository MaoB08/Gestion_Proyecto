const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const { Teacher } = require('../models/Teacher');
const Student  = require('../models/Student');

// ── GET /api/users/all — lista unificada desde las 3 colecciones ──────────────
const getAllUsers = async (_req, res) => {
  try {
    const [admins, teachers, students] = await Promise.all([
      User.find().select('-password').lean(),
      Teacher.find().select('-clave').lean(),
      Student.find().select('-clave').lean(),
    ]);

    const normalized = [
      ...admins.map(u => ({
        id:        u._id.toString(),
        name:      u.name,
        email:     u.email,
        username:  u.username,
        role:      u.role,
        avatar:    u.avatar || u.name.slice(0, 2).toUpperCase(),
        estado:    true,
        aprobado:  true,
        createdAt: u.createdAt,
      })),

      ...teachers.map(t => {
        const fullName = `${t.nombre} ${t.apellido}`;
        return {
          id:          t._id.toString(),
          name:        fullName,
          nombre:      t.nombre,
          apellido:    t.apellido,
          email:       t.correo,
          username:    t.documento,
          role:        'teacher',
          avatar:      fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          documento:   t.documento,
          telefono:    t.telefono,
          areaDominio: t.areaDominio,
          anioInicio:  t.anioInicio,
          estado:      t.estado,
          aprobado:    true,
          createdAt:   t.createdAt,
        };
      }),

      ...students.map(s => {
        const fullName = `${s.nombre} ${s.apellido}`;
        return {
          id:             s._id.toString(),
          name:           fullName,
          nombre:         s.nombre,
          apellido:       s.apellido,
          email:          s.correo,
          username:       s.documento,
          role:           'student',
          avatar:         fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          documento:      s.documento,
          telefono:       s.telefono,
          institucion:    s.institucion,
          anioNacimiento: s.anioNacimiento,
          estado:         s.estado,
          aprobado:       s.aprobado,
          createdAt:      s.createdAt,
        };
      }),
    ];

    // Sort by creation date descending
    normalized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
