const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

router.post('/create', requireAuth, requireRole('ADMIN'), backupController.createDatabaseBackup);
router.get('/list', requireAuth, requireRole('ADMIN'), backupController.listBackups);

module.exports = router;
