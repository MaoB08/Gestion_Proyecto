const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');

// Special queries (before /:id)
router.get('/active',             classController.getActive);
router.get('/course/:courseId',   classController.getByCourse);

// Lifecycle
router.put('/:id/activate',   classController.activate);
router.put('/:id/deactivate', classController.deactivate);

// Participants
router.post('/:id/join',  classController.joinClass);
router.post('/:id/leave', classController.leaveClass);

// Transcription
router.post('/:id/transcription',      classController.addTranscription);
router.put('/:id/transcription/save',  classController.saveTranscription);

// Summary
router.put('/:id/summary', classController.setSummary);

// Questions
router.post('/:id/questions',                         classController.addQuestion);
router.put('/:classId/questions/:questionId/answer',  classController.answerQuestion);

// Attention Checks
router.post('/:id/attention-check',                       classController.launchAttentionCheck);
router.post('/:id/attention-check/:checkId/respond',      classController.respondAttentionCheck);

// CRUD
router.get('/',     classController.getAll);
router.get('/:id',  classController.getById);
router.post('/',    classController.create);

module.exports = router;
