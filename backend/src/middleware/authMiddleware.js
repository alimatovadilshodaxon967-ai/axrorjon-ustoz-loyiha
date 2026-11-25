const prisma = require('../config/db');

/**
 * Authentication middleware verifying active user session
 */
async function requireAuth(req, res, next) {
  try {
    const userId = req.session ? req.session.userId : null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Autentifikatsiyadan o‘tilmagan. Iltimos, tizimga kiring.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isEmailVerified: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: 'Foydalanuvchi topilmadi yoki hisob bloklangan.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Server xatosi.' });
  }
}

/**
 * Optional authentication middleware: attaches user if logged in, but doesn't block
 */
async function optionalAuth(req, res, next) {
  try {
    const userId = req.session ? req.session.userId : null;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          isEmailVerified: true,
          isActive: true,
        },
      });
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore error for optional auth
  }
  next();
}

/**
 * Role-based authorization middleware
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Autentifikatsiya talab qilinadi.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Ruxsat berilmagan. Ushbu amal faqat ${allowedRoles.join(', ')} uchun mo‘ljallangan.`,
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
};
