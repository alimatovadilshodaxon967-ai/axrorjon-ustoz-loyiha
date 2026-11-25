const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password with bcrypt
 */
async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare plain text password against bcrypt hash
 */
async function comparePassword(plainPassword, passwordHash) {
  return await bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Hash an OTP code or token using SHA-256 for secure SQLite storage
 */
function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

/**
 * Compare OTP code against SHA-256 hash
 */
function compareOtp(plainOtp, hashedOtp) {
  const hash = hashOtp(plainOtp);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedOtp));
}

/**
 * Generate a random alphanumeric token
 */
function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  hashOtp,
  compareOtp,
  generateRandomToken,
};
