const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { Teacher, DOMAIN_AREAS } = require('../models/Teacher');

// ── GET /api/teachers — list all teachers ─────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const teachers = await Teacher.find().select('-clave');
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/teachers/areas — return available domain areas ───────────────────
router.get('/areas', (_req, res) => {
  res.json(DOMAIN_AREAS);
});

// ── POST /api/teachers — create a teacher ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { documento, nombre, apellido, telefono, correo, clave, areaDominio, anioInicio } = req.body;

    // ── [4.1] Required fields ──────────────────────────────────────────────────
    if (!documento || !nombre || !apellido || !telefono || !correo || !clave || !areaDominio || !anioInicio) {
      return res.status(400).json({ code: 'EMPTY_FIELDS', message: 'Todos los campos son obligatorios' });
    }

    // ── [4.2] Uniqueness checks ────────────────────────────────────────────────
    const docExists = await Teacher.findOne({ documento });
    if (docExists) {
      return res.status(409).json({ code: 'DUP_DOCUMENTO', message: 'El documento ya está registrado' });
    }

    const telExists = await Teacher.findOne({ telefono });
    if (telExists) {
      return res.status(409).json({ code: 'DUP_TELEFONO', message: 'El teléfono ya está registrado' });
    }

    const emailExists = await Teacher.findOne({ correo: correo.toLowerCase() });
    if (emailExists) {
      return res.status(409).json({ code: 'DUP_CORREO', message: 'El correo ya está registrado' });
    }

    // ── Security: hash the password ───────────────────────────────────────────
    const hashedClave = await bcrypt.hash(clave, 10);

    // ── Persist ───────────────────────────────────────────────────────────────
    const teacher = await Teacher.create({
      documento,
      nombre,
      apellido,
      telefono,
      correo: correo.toLowerCase(),
      clave: hashedClave,
      areaDominio,
      anioInicio,
      estado: true,
    });

    // Return without exposing the hashed password
    const { clave: _omit, ...safe } = teacher.toObject();
    res.status(201).json(safe);

  } catch (err) {
    // Mongoose validation or duplicate index errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: messages.join('. ') });
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const labels = { documento: 'El documento', telefono: 'El teléfono', correo: 'El correo' };
      return res.status(409).json({ code: 'DUP_KEY', message: `${labels[field] || 'El campo'} ya está registrado` });
    }
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/teachers/:id — update teacher ────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.clave && updates.clave.trim() !== '') {
      updates.clave = await bcrypt.hash(updates.clave, 10);
    } else {
      delete updates.clave;
    }
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-clave');
    if (!teacher) return res.status(404).json({ message: 'Profesor no encontrado' });
    res.json(teacher);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /api/teachers/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.json({ message: 'Profesor eliminado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
