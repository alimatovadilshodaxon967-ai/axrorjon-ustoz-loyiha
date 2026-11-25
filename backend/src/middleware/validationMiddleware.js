/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim().toLowerCase());
}

/**
 * Middleware to validate registration payload
 */
function validateRegister(req, res, next) {
  const { name, email, password, role } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Ism kamida 2 ta belgidan iborat bo‘lishi kerak.' });
  }

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, message: 'Yaroqli email manzilini kiriting.' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.' });
  }

  if (role && !['STUDENT', 'INSTRUCTOR'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Noto‘g‘ri rol tanlandi.' });
  }

  req.body.email = email.trim().toLowerCase();
  req.body.name = name.trim();
  next();
}

/**
 * Middleware to validate login payload
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, message: 'Yaroqli email manzilini kiriting.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, message: 'Parolni kiriting.' });
  }

  req.body.email = email.trim().toLowerCase();
  next();
}

/**
 * Middleware to validate OTP verification payload
 */
function validateOtpVerify(req, res, next) {
  const { email, otp } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, message: 'Yaroqli email manzilini kiriting.' });
  }

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return res.status(400).json({ success: false, message: 'OTP kod 6 xonali raqam bo‘lishi kerak.' });
  }

  req.body.email = email.trim().toLowerCase();
  req.body.otp = otp.trim();
  next();
}

module.exports = {
  validateEmail,
  validateRegister,
  validateLogin,
  validateOtpVerify,
};
