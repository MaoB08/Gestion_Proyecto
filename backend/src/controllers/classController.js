const Class = require('../models/Class');
const geminiService = require('../services/geminiService');

// @desc  Get all classes
// @route GET /api/classes
exports.getAll = async (req, res) => {
  try {
    const classes = await Class.find().populate('courseId', 'name');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get single class
// @route GET /api/classes/:id
exports.getById = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id).populate('courseId');
    if (!cls) return res.status(404).json({ message: 'Class not found' });
    res.json(cls);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get classes by course
// @route GET /api/classes/course/:courseId
exports.getByCourse = async (req, res) => {
  try {
    const filter = { courseId: req.params.courseId };
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    const classes = await Class.find(filter);
    res.set('X-DB-Optimization', 'index_class_courseId_isActive');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get classes by participant
// @route GET /api/classes/participant/:userId
exports.getByParticipant = async (req, res) => {
  try {
    const classes = await Class.find({
      $or: [
        { participantIds: req.params.userId },
        { 'attendance.userId': req.params.userId }
      ]
    }).populate('courseId', 'name');
    res.set('X-DB-Optimization', 'index_class_participantIds');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get active classes
// @route GET /api/classes/active
exports.getActive = async (req, res) => {
  try {
    const classes = await Class.find({ isActive: true }).populate('courseId', 'name');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Create class
// @route POST /api/classes
exports.create = async (req, res) => {
  try {
    const { courseId, title, date, startTime, endTime, description } = req.body;

    // 1. Check if course exists and is active
    const Course = require('../models/Course');
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'El curso no existe.' });
    if (course.estado !== 'Activo') {
      return res.status(400).json({ message: 'No se pueden crear clases en un curso que no esté activo.' });
    }

    // 2. Validate mandatory fields (though model handles it, we provide better messages)
    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Todos los campos marcados con (*) son obligatorios.' });
    }

    // 3. Unique name within course
    const existing = await Class.findOne({ courseId, title: { $regex: new RegExp(`^${title}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe una clase con este nombre en el curso.' });
    }

    // 4. Time validation (no past starts)
    // Usamos el separador 'T' para que Date() lo interprete como hora local consistentemente.
    const startDateTime = new Date(`${date}T${startTime}:00`);

    if (startDateTime < new Date()) {
      return res.status(400).json({ message: 'La hora de inicio no puede ser anterior a la actual.' });
    }

    // 5. Time validation (endTime > startTime)
    if (endTime <= startTime) {
      return res.status(400).json({ message: 'La hora de fin debe ser posterior a la hora de inicio.' });
    }

    // 6. Create
    const cls = await Class.create({
      courseId,
      title,
      description,
      date,
      startTime,
      endTime,
      isActive: req.body.isActive ?? true
    });

    res.status(201).json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Activate class
// @route PUT /api/classes/:id/activate
exports.activate = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Deactivate class
// @route PUT /api/classes/:id/deactivate
exports.deactivate = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { isActive: false, participantIds: [] },
      { new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Add transcription segment
// @route POST /api/classes/:id/transcription
exports.addTranscription = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { $push: { transcription: req.body } },
      { new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Save full transcription
// @route PUT /api/classes/:id/transcription/save
exports.saveTranscription = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { savedTranscription: req.body.text },
      { new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Set summary
// @route PUT /api/classes/:id/summary
exports.setSummary = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { summary: req.body.summary },
      { new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Add question
// @route POST /api/classes/:id/questions
exports.addQuestion = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { $push: { questions: req.body } },
      { new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Mark question as answered
// @route PUT /api/classes/:classId/questions/:questionId/answer
exports.answerQuestion = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(
      req.params.classId,
      {
        $set: {
          'questions.$[q].status': 'answered',
          'questions.$[q].answeredAt': new Date(),
        },
      },
      { arrayFilters: [{ 'q._id': req.params.questionId }], new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Join class
// @route POST /api/classes/:id/join
exports.joinClass = async (req, res) => {
  try {
    const { userId } = req.body;
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { participantIds: userId, attendance: { userId, joinedAt: new Date() } } },
      { new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Leave class
// @route POST /api/classes/:id/leave
exports.leaveClass = async (req, res) => {
  try {
    const { userId } = req.body;
    const cls = await Class.findByIdAndUpdate(
      req.params.id,
      { $pull: { participantIds: userId } },
      { new: true }
    );
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Launch attention check
// @route POST /api/classes/:id/attention-check
exports.launchAttentionCheck = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada' });
    if (!cls.isActive) return res.status(400).json({ message: 'La clase no está activa' });

    // Check if there's already an active attention check
    const hasActive = (cls.attentionChecks || []).some(ac => ac.status === 'active');
    if (hasActive) return res.status(400).json({ message: 'Ya hay una verificación de atención activa' });

    const timeoutSecs = req.body.timeoutSecs || 30;
    const responses = (cls.participantIds || []).map(uid => ({
      userId: uid,
      responded: false,
      respondedAt: null,
    }));

    cls.attentionChecks.push({
      launchedAt: new Date(),
      timeoutSecs,
      responses,
      status: 'active',
    });

    await cls.save();
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Respond to attention check
// @route POST /api/classes/:id/attention-check/:checkId/respond
exports.respondAttentionCheck = async (req, res) => {
  try {
    const { userId } = req.body;
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada' });

    const check = cls.attentionChecks.id(req.params.checkId);
    if (!check) return res.status(404).json({ message: 'Verificación no encontrada' });

    // Auto-complete if timed out
    const elapsed = (Date.now() - new Date(check.launchedAt).getTime()) / 1000;
    if (elapsed > check.timeoutSecs) {
      check.status = 'completed';
      await cls.save();
      return res.status(400).json({ message: 'El tiempo de verificación ha expirado' });
    }

    if (check.status !== 'active') {
      return res.status(400).json({ message: 'La verificación ya no está activa' });
    }

    // Find and update the response for this user
    const response = check.responses.find(r => String(r.userId) === String(userId));
    if (!response) return res.status(404).json({ message: 'No estás registrado en esta verificación' });
    if (response.responded) return res.status(400).json({ message: 'Ya respondiste a esta verificación' });

    response.responded = true;
    response.respondedAt = new Date();

    // Check if all have responded → auto-complete
    const allResponded = check.responses.every(r => r.responded);
    if (allResponded) check.status = 'completed';

    await cls.save();
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Complete attention check
// @route PUT /api/classes/:id/attention-check/:checkId/complete
exports.completeAttentionCheck = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada' });

    const check = cls.attentionChecks.id(req.params.checkId);
    if (!check) return res.status(404).json({ message: 'Verificación no encontrada' });

    if (check.status === 'active') {
      check.status = 'completed';
      await cls.save();
    }
    
    res.json(cls);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc  Get AI Topics from class transcription
// @route POST /api/classes/:id/ai/topics
exports.getAITopics = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada' });

    const text = (cls.transcription || []).map(s => s.text).join(' ');
    if (!text.trim()) {
      return res.status(400).json({ message: 'Aún no hay transcripción para analizar.' });
    }

    const topics = await geminiService.identifyTopics(text);
    res.json({ topics });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get AI Summary from class transcription (and save it in database)
// @route POST /api/classes/:id/ai/summary
exports.getAISummary = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada' });

    const text = (cls.transcription || []).map(s => s.text).join(' ');
    if (!text.trim()) {
      return res.status(400).json({ message: 'Sin transcripción para resumir.' });
    }

    const summary = await geminiService.summarizeTranscription(text);
    
    // Save to database
    cls.summary = summary;
    await cls.save();

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Get AI Partial Summary from class transcription
// @route POST /api/classes/:id/ai/partial-summary
exports.getAIPartialSummary = async (req, res) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada' });

    const text = (cls.transcription || []).map(s => s.text).join(' ');
    if (!text.trim()) {
      return res.status(400).json({ message: 'Aún no hay transcripción.' });
    }

    const summary = await geminiService.partialSummary(text);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc  Ask AI about class transcription
// @route POST /api/classes/:id/ai/ask
exports.askAI = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'La pregunta es obligatoria.' });
    }

    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Clase no encontrada' });

    const text = (cls.transcription || []).map(s => s.text).join(' ');

    const answer = await geminiService.askAboutTranscription(text, question);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

