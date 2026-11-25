const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/', optionalAuth, courseController.listCourses);
router.get('/:slug', optionalAuth, courseController.getCourseBySlug);
router.post('/', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), courseController.createCourse);
router.put('/:id', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), courseController.updateCourse);
router.delete('/:id', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), courseController.deleteCourse);
router.post('/:courseId/modules', requireAuth, requireRole('ADMIN', 'INSTRUCTOR'), courseController.createModule);

module.exports = router;
