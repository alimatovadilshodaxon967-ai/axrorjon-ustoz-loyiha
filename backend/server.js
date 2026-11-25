require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const prisma = require('./src/config/db');
const sessionMiddleware = require('./src/config/session');
const { startCleanupScheduler } = require('./src/services/otpCleanupService');

// Route handlers
const authRoutes = require('./src/routes/authRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const enrollmentRoutes = require('./src/routes/enrollmentRoutes');
const lessonRoutes = require('./src/routes/lessonRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
const assignmentRoutes = require('./src/routes/assignmentRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const backupRoutes = require('./src/routes/backupRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// Normalize Netlify Function path prefix if invoked via /.netlify/functions/api
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api') || '/api';
  }
  next();
});

// Security & Parsing Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow local development origins or no origin (same-origin / curl / mobile)
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(sessionMiddleware);

// Request logger for API calls
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Protect database files from ever being served statically
app.use((req, res, next) => {
  const lowercasePath = req.path.toLowerCase();
  if (lowercasePath.includes('.db') || lowercasePath.includes('prisma') || lowercasePath.includes('.env')) {
    return res.status(403).json({ success: false, message: 'Ruxsat berilmagan fayl.' });
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/backup', backupRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'PostgreSQL (Netlify Database)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve frontend static files when running standalone
if (!process.env.NETLIFY && require.main === module) {
  const frontendDir = path.resolve(__dirname, '../frontend');
  app.use(express.static(frontendDir));

  // Fallback to frontend index.html for SPA client routing
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, message: 'API endpoint topilmadi.' });
    }
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Ichki server xatoligi yuz berdi.',
  });
});

// Start Server only when run directly (not when imported by Netlify Functions)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n====================================================`);
    console.log(`🚀 CODEMASTER LMS Server ishga tushdi!`);
    console.log(`📡 URL:       http://localhost:${PORT}`);
    console.log(`💾 Database:  PostgreSQL`);
    console.log(`📧 Mailer:    ${process.env.SMTP_USER ? 'Gmail SMTP' : 'Dev Simulation Mode'}`);
    console.log(`====================================================\n`);

    // Start background periodic cleanup of expired OTPs and tokens
    startCleanupScheduler(10);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nServer to‘xtatilmoqda...');
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nServer to‘xtatilmoqda...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

module.exports = app;
