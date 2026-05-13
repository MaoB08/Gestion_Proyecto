const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');

// All endpoints under /api/grades
router.post('/',                              gradeController.upsertGrade);
router.get('/course/:courseId/tier',          gradeController.getGradesByTier);
router.get('/course/:courseId',               gradeController.getGradesByCourse);
router.get('/student/:studentId',             gradeController.getGradesByStudent);

module.exports = router;
