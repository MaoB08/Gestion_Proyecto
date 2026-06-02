const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const User    = require('../models/User');
const { Teacher } = require('../models/Teacher');
const Student = require('../models/Student');

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Acepta { email, password }
// Busca por email/correo en: User (admin) → Teacher → Student
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'El correo y la contraseña son requeridos' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── 1. Buscar en modelo User (administradores) ────────────────────────────
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: 'Credenciales incorrectas' });

      res.set('X-DB-Optimization', 'index_user_email');
      return res.json({
        id:       user._id,
        name:     user.name,
        email:    user.email,
        username: user.username,
        role:     user.role,
        avatar:   user.avatar || user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      });
    }

    // ── 2. Buscar en modelo Teacher (profesores) ──────────────────────────────
    const teacher = await Teacher.findOne({ correo: normalizedEmail });

    if (teacher) {
      const match = await bcrypt.compare(password, teacher.clave);
      if (!match) return res.status(401).json({ message: 'Credenciales incorrectas' });

      if (!teacher.estado) {
        return res.status(403).json({ message: 'Su cuenta está inactiva. Contacte al administrador.' });
      }

      const fullName = `${teacher.nombre} ${teacher.apellido}`;
      res.set('X-DB-Optimization', 'index_teacher_correo');
      return res.json({
        id:          teacher._id,
        name:        fullName,
        email:       teacher.correo,
        username:    teacher.documento,
        role:        'teacher',
        avatar:      fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        documento:   teacher.documento,
        telefono:    teacher.telefono,
        areaDominio: teacher.areaDominio,
        anioInicio:  teacher.anioInicio,
        estado:      teacher.estado,
      });
    }

    // ── 3. Buscar en modelo Student (estudiantes) ─────────────────────────────
    const student = await Student.findOne({ correo: normalizedEmail });

    if (student) {
      const match = await bcrypt.compare(password, student.clave);
      if (!match) return res.status(401).json({ message: 'Credenciales incorrectas' });

      // [RF-01] Guardia de aprobación
      if (!student.aprobado) {
        return res.status(403).json({
          message: 'Su solicitud está siendo revisada por un administrador',
          code:    'PENDING_APPROVAL',
        });
      }

      if (!student.estado) {
        return res.status(403).json({ message: 'Su cuenta está inactiva. Contacte al administrador.' });
      }

      const { latitude, longitude } = req.body;
      if (latitude !== undefined && longitude !== undefined) {
        student.location = {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };
        await student.save();
      }

      const fullName = `${student.nombre} ${student.apellido}`;
      res.set('X-DB-Optimization', 'index_student_correo');
      return res.json({
        id:             student._id,
        name:           fullName,
        email:          student.correo,
        username:       student.documento,
        role:           'student',
        avatar:         fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        documento:      student.documento,
        telefono:       student.telefono,
        institucion:    student.institucion,
        anioNacimiento: student.anioNacimiento,
        estado:         student.estado,
        aprobado:       student.aprobado,
      });
    }

    // ── 4. Sin coincidencia ───────────────────────────────────────────────────
    return res.status(401).json({ message: 'Credenciales incorrectas' });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
