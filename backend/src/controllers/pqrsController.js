const PQRS          = require('../models/PQRS');
const RespuestaPQRS = require('../models/RespuestaPQRS');
const { sendConfirmacionPQRS, sendRespuestaPQRS } = require('../services/emailService');
const { generarPDFRespuesta }                     = require('../services/pdfService');

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/pqrs
//  Crea una nueva PQRS y envía correo de confirmación al usuario.
// ═══════════════════════════════════════════════════════════════════════════════
exports.crearPQRS = async (req, res) => {
  try {
    const { userId, userModel, userName, userEmail, userRole, tipo, asunto, descripcion } = req.body;

    // Validaciones básicas
    if (!userId || !userEmail || !tipo || !asunto || !descripcion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: userId, userEmail, tipo, asunto, descripcion' });
    }
    if (!['student', 'teacher'].includes(userRole)) {
      return res.status(403).json({ message: 'Solo estudiantes y profesores pueden crear PQRS' });
    }

    const pqrs = await PQRS.create({
      userId, userModel, userName, userEmail, userRole, tipo, asunto, descripcion,
      estado: 'pendiente',
    });

    // Enviar correo de confirmación (asíncrono, no bloquea la respuesta)
    sendConfirmacionPQRS(userEmail, pqrs).catch(console.error);

    res.status(201).json(pqrs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/pqrs
//  Admin → todas las PQRS (con filtros opcionales).
//  Student / Teacher → solo sus propias PQRS.
// ═══════════════════════════════════════════════════════════════════════════════
exports.listarPQRS = async (req, res) => {
  try {
    const { role, userId, estado, tipo } = req.query;

    const filter = {};

    // Si no es admin, filtrar por userId
    if (role !== 'admin') {
      if (!userId) return res.status(400).json({ message: 'userId requerido para listar PQRS' });
      filter.userId = userId;
    }

    if (estado) filter.estado = estado;
    if (tipo)   filter.tipo   = tipo;

    const lista = await PQRS.find(filter).sort({ createdAt: -1 }).lean();

    // Adjuntar respuesta a cada PQRS (si existe)
    const ids = lista.map(p => p._id);
    const respuestas = await RespuestaPQRS.find({ pqrsId: { $in: ids } }).lean();
    const respMap = {};
    respuestas.forEach(r => { respMap[String(r.pqrsId)] = r; });

    const resultado = lista.map(p => ({
      ...p,
      respuesta: respMap[String(p._id)] || null,
    }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/pqrs/:id
//  Detalle de una PQRS con su respuesta (si existe).
// ═══════════════════════════════════════════════════════════════════════════════
exports.obtenerPQRS = async (req, res) => {
  try {
    const pqrs = await PQRS.findById(req.params.id).lean();
    if (!pqrs) return res.status(404).json({ message: 'PQRS no encontrada' });

    const respuesta = await RespuestaPQRS.findOne({ pqrsId: pqrs._id }).lean();
    res.json({ ...pqrs, respuesta: respuesta || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATCH /api/pqrs/:id/estado
//  Solo Admin — cambia el estado de una PQRS.
// ═══════════════════════════════════════════════════════════════════════════════
exports.actualizarEstado = async (req, res) => {
  try {
    const { estado } = req.body;
    const validos = ['pendiente', 'en_revision', 'resuelto', 'cerrado'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ message: `Estado inválido. Valores permitidos: ${validos.join(', ')}` });
    }

    const pqrs = await PQRS.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );
    if (!pqrs) return res.status(404).json({ message: 'PQRS no encontrada' });
    res.json(pqrs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  POST /api/pqrs/:id/responder
//  Solo Admin — registra respuesta, genera PDF y envía correo con adjunto.
// ═══════════════════════════════════════════════════════════════════════════════
exports.responderPQRS = async (req, res) => {
  try {
    const { adminId, adminName, respuesta } = req.body;

    if (!adminId || !adminName || !respuesta) {
      return res.status(400).json({ message: 'Faltan campos: adminId, adminName, respuesta' });
    }

    const pqrs = await PQRS.findById(req.params.id);
    if (!pqrs) return res.status(404).json({ message: 'PQRS no encontrada' });

    // Verificar que no haya una respuesta previa
    const existente = await RespuestaPQRS.findOne({ pqrsId: pqrs._id });
    if (existente) {
      return res.status(409).json({ message: 'Esta PQRS ya tiene una respuesta registrada' });
    }

    // Crear respuesta en BD
    const nuevaRespuesta = await RespuestaPQRS.create({
      pqrsId:    pqrs._id,
      adminId,
      adminName,
      respuesta,
    });

    // Respetar el estado exacto que el administrador tenga seleccionado en pantalla
    if (req.body.estado) {
      pqrs.estado = req.body.estado;
      await pqrs.save();
    }

    // Generar PDF de forma asíncrona y luego enviar el correo
    let pdfPath = null;
    try {
      pdfPath = await generarPDFRespuesta(pqrs, nuevaRespuesta, adminName);
      // Guardar path del PDF en la respuesta
      nuevaRespuesta.pdfPath = pdfPath;
      await nuevaRespuesta.save();
    } catch (pdfErr) {
      console.error('❌ Error generando PDF:', pdfErr.message);
    }

    // Enviar correo al usuario (no bloquea la respuesta HTTP)
    sendRespuestaPQRS(pqrs.userEmail, pqrs, nuevaRespuesta, pdfPath).catch(console.error);

    res.status(201).json({
      pqrs:      pqrs.toObject(),
      respuesta: nuevaRespuesta.toObject(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/pqrs/:id
//  Solo Admin — elimina una PQRS y su respuesta asociada.
// ═══════════════════════════════════════════════════════════════════════════════
exports.eliminarPQRS = async (req, res) => {
  try {
    const pqrs = await PQRS.findByIdAndDelete(req.params.id);
    if (!pqrs) return res.status(404).json({ message: 'PQRS no encontrada' });

    // Eliminar respuesta asociada si existe
    await RespuestaPQRS.deleteOne({ pqrsId: req.params.id });

    res.json({ message: 'PQRS eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  GET /api/pqrs/stats
//  Solo Admin — conteos por estado y tipo para el dashboard.
// ═══════════════════════════════════════════════════════════════════════════════
exports.obtenerStats = async (_req, res) => {
  try {
    const [porEstado, porTipo, total] = await Promise.all([
      PQRS.aggregate([{ $group: { _id: '$estado', count: { $sum: 1 } } }]),
      PQRS.aggregate([{ $group: { _id: '$tipo',   count: { $sum: 1 } } }]),
      PQRS.countDocuments(),
    ]);

    const estadoMap = {};
    porEstado.forEach(e => { estadoMap[e._id] = e.count; });
    const tipoMap = {};
    porTipo.forEach(t => { tipoMap[t._id] = t.count; });

    res.json({
      total,
      pendientes:  estadoMap.pendiente   || 0,
      enRevision:  estadoMap.en_revision || 0,
      resueltos:   estadoMap.resuelto    || 0,
      cerrados:    estadoMap.cerrado     || 0,
      porTipo: tipoMap,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
