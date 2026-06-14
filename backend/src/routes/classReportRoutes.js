const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/classReportController');

// Download PDF report for a finished class (role-based content)
// GET /api/class-reports/:classId/download?role=teacher|student|admin&userId=xxx
router.get('/:classId/download', ctrl.downloadReport);

// Get report generation history for a class
// GET /api/class-reports/:classId
router.get('/:classId', ctrl.getReportsByClass);

// Log user IP when joining a class (called from frontend on join)
// POST /api/class-reports/:classId/log-ip
router.post('/:classId/log-ip', ctrl.logUserIP);

module.exports = router;
