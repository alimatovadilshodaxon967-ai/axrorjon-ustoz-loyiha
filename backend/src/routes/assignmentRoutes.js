const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.post('/submit', requireAuth, assignmentController.submitAssignment);
router.get('/submissions', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), assignmentController.listSubmissions);
router.put('/submissions/:id/grade', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), assignmentController.gradeSubmission);

module.exports = router;
