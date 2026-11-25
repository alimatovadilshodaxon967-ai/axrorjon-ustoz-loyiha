const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/verify/:code', certificateController.verifyCertificate);
router.get('/my', requireAuth, certificateController.getMyCertificates);

module.exports = router;
