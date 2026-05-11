const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const courseContentController = require('../controllers/courseContentController');
const upload = require('../config/multer');

// Filters (must be before /:id to avoid conflicts)
router.get('/teacher/:teacherId', courseController.getByTeacher);
router.get('/student/:studentId', courseController.getByStudent);

// Enroll / Unenroll / Request
router.post('/:id/enroll',          courseController.enrollStudent);
router.post('/:id/unenroll',        courseController.unenrollStudent);
router.post('/:id/request-enroll',  courseController.requestEnrollment);
router.post('/:id/approve-enroll',  courseController.approveEnrollment);
router.post('/:id/reject-enroll',   courseController.rejectEnrollment);

// Course Contents
router.post('/:id/contents', upload.single('file'), courseContentController.addContent);
router.delete('/:id/contents/:contentId', courseContentController.deleteContent);

// Reports
router.get('/reports/categories', courseController.getCategoryReport);

// CRUD
router.get('/',     courseController.getAll);
router.get('/:id',  courseController.getById);
router.get('/:id/students', courseController.getCourseStudents);
router.post('/',    courseController.create);
router.put('/:id',  courseController.update);
router.delete('/:id', courseController.remove);

module.exports = router;
