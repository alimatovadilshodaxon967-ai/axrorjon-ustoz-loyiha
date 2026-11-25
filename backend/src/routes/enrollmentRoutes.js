const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/enroll', requireAuth, enrollmentController.enrollInCourse);
router.get('/my', requireAuth, enrollmentController.getMyEnrollments);
router.post('/progress', requireAuth, enrollmentController.updateLessonProgress);

module.exports = router;
