const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.get('/dashboard', requireAuth, analyticsController.getDashboardStats);
router.get('/audit-logs', requireAuth, requireRole('ADMIN'), analyticsController.getAuditLogs);

module.exports = router;
