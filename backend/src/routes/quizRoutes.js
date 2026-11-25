const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');

router.get('/:id', optionalAuth, quizController.getQuizById);
router.post('/:id/submit', requireAuth, quizController.submitQuiz);

module.exports = router;
