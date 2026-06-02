const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/pqrsController');

// ── PQRS Routes ───────────────────────────────────────────────────────────────
// Base: /api/pqrs

// GET  /api/pqrs/stats  — debe ir ANTES de /:id para no ser capturado
router.get('/stats',         ctrl.obtenerStats);

// POST /api/pqrs         — Crea una nueva PQRS (student | teacher)
router.post('/',             ctrl.crearPQRS);

// GET  /api/pqrs         — Lista PQRS (admin: todas; user: las propias vía ?userId=)
router.get('/',              ctrl.listarPQRS);

// GET  /api/pqrs/:id     — Detalle de una PQRS con su respuesta
router.get('/:id',           ctrl.obtenerPQRS);

// PATCH /api/pqrs/:id/estado  — Admin: cambia el estado
router.patch('/:id/estado',  ctrl.actualizarEstado);

// POST /api/pqrs/:id/responder — Admin: registra respuesta, genera PDF y notifica
router.post('/:id/responder', ctrl.responderPQRS);

// DELETE /api/pqrs/:id   — Admin: elimina PQRS y su respuesta
router.delete('/:id',        ctrl.eliminarPQRS);

module.exports = router;
