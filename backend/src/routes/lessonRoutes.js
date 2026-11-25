const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/:id', optionalAuth, lessonController.getLessonById);
router.post('/', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), lessonController.createLesson);
router.put('/:id', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), lessonController.updateLesson);
router.delete('/:id', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), lessonController.deleteLesson);

module.exports = router;
