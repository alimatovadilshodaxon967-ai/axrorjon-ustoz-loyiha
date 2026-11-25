const crypto = require('crypto');

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit numeric OTP code
 */
function generateOtpCode() {
  // Generates 100000 to 999999
  const randomNum = crypto.randomInt(100000, 1000000);
  return String(randomNum);
}

/**
 * Calculate expiration timestamp (5 minutes from now)
 */
function getOtpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * Calculate resend cooldown timestamp (60 seconds from now)
 */
function getResendAvailableDate() {
  return new Date(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
}

module.exports = {
  OTP_EXPIRY_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  MAX_ATTEMPTS,
  generateOtpCode,
  getOtpExpiryDate,
  getResendAvailableDate,
};
