const prisma = require('../config/db');

/**
 * Automatically clean up expired OTP verification entries and password reset tokens
 */
async function cleanExpiredTokens() {
  try {
    const now = new Date();

    const [deletedOtps, deletedResetTokens] = await prisma.$transaction([
      prisma.emailVerification.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { used: true },
          ],
        },
      }),
    ]);

    if (deletedOtps.count > 0 || deletedResetTokens.count > 0) {
      console.log(`🧹 Auto-cleanup: Removed ${deletedOtps.count} expired OTPs and ${deletedResetTokens.count} expired reset tokens.`);
    }
  } catch (error) {
    console.error('Error during token cleanup:', error.message);
  }
}

/**
 * Start periodic background cleanup job
 */
function startCleanupScheduler(intervalMinutes = 10) {
  // Run once immediately at startup
  cleanExpiredTokens();

  // Run on interval
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(cleanExpiredTokens, intervalMs);
}

module.exports = {
  cleanExpiredTokens,
  startCleanupScheduler,
};
