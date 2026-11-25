const prisma = require('../config/db');
const { hashPassword, comparePassword, hashOtp, compareOtp } = require('../utils/hash');
const {
  generateOtpCode,
  getOtpExpiryDate,
  getResendAvailableDate,
  MAX_ATTEMPTS,
} = require('../utils/otp');
const { sendVerificationOtpEmail, sendPasswordResetOtpEmail } = require('../services/emailService');
const { logAudit } = require('../services/auditService');

/**
 * Register a new user and dispatch email verification OTP
 */
async function register(req, res) {
  try {
    const { name, email, password, role = 'STUDENT' } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: 'Ushbu email bilan foydalanuvchi allaqachon mavjud.',
      });
    }

    const passwordHash = await hashPassword(password);
    const otpCode = generateOtpCode();
    const hashedOtp = hashOtp(otpCode);
    const expiresAt = getOtpExpiryDate();
    const resendAvailableAt = getResendAvailableDate();

    let user;

    // Execute via SQLite Transaction
    await prisma.$transaction(async (tx) => {
      if (existingUser) {
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            passwordHash,
            role: ['ADMIN', 'INSTRUCTOR', 'STUDENT'].includes(role) ? role : 'STUDENT',
          },
        });
      } else {
        user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: ['ADMIN', 'INSTRUCTOR', 'STUDENT'].includes(role) ? role : 'STUDENT',
            isEmailVerified: false,
          },
        });
      }

      // Enforce: only 1 active OTP per email - remove old records
      await tx.emailVerification.deleteMany({
        where: { email },
      });

      // Save hashed OTP in SQLite
      await tx.emailVerification.create({
        data: {
          userId: user.id,
          email,
          otpHash: hashedOtp,
          expiresAt,
          attempts: 0,
          resendAvailableAt,
        },
      });
    });

    // Send OTP via Nodemailer
    await sendVerificationOtpEmail(email, otpCode, name);

    await logAudit({
      userId: user.id,
      action: 'USER_REGISTER_INITIATED',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { email, role },
    });

    res.status(201).json({
      success: true,
      message: 'Ro‘yxatdan o‘tish boshlandi. Tasdiqlash kodi emailingizga yuborildi (5 daqiqa amal qiladi).',
      data: {
        email,
        expiresInSeconds: 300,
        resendCooldownSeconds: 60,
        // Only show devOtp if SMTP is not configured
        devOtp: (!process.env.SMTP_USER || process.env.SMTP_USER.trim() === '') ? otpCode : undefined,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Ro‘yxatdan o‘tishda xatolik yuz berdi.' });
  }
}

/**
 * Verify OTP code and activate user account
 */
async function verifyEmailOtp(req, res) {
  try {
    const { email, otp } = req.body;
    const now = new Date();

    // Find the single active OTP record for this email
    const verification = await prisma.emailVerification.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: 'Tasdiqlash kodi topilmadi yoki allaqachon ishlatilgan. Qayta kod so‘rang.',
      });
    }

    // Check expiration
    if (verification.expiresAt < now) {
      await prisma.emailVerification.delete({ where: { id: verification.id } });
      return res.status(400).json({
        success: false,
        message: 'OTP kodi muddati (5 daqiqa) tugagan. Iltimos, yangi kod so‘rang.',
        expired: true,
      });
    }

    // Check max attempts
    if (verification.attempts >= MAX_ATTEMPTS) {
      await prisma.emailVerification.delete({ where: { id: verification.id } });
      return res.status(429).json({
        success: false,
        message: `Maksimal noto‘g‘ri urinishlar soni (${MAX_ATTEMPTS} ta) oshib ketdi. Yangi kod so‘rang.`,
        locked: true,
      });
    }

    // Verify OTP using secure hash comparison
    const isOtpValid = compareOtp(otp, verification.otpHash);

    if (!isOtpValid) {
      const updatedAttempts = verification.attempts + 1;
      const remaining = MAX_ATTEMPTS - updatedAttempts;

      if (updatedAttempts >= MAX_ATTEMPTS) {
        await prisma.emailVerification.delete({ where: { id: verification.id } });
        return res.status(400).json({
          success: false,
          message: `Kod noto‘g‘ri kiritildi. Maksimal limitga yetildi. Yangi kod so‘rang.`,
          remainingAttempts: 0,
        });
      } else {
        await prisma.emailVerification.update({
          where: { id: verification.id },
          data: { attempts: updatedAttempts },
        });

        return res.status(400).json({
          success: false,
          message: `Tasdiqlash kodi noto‘g‘ri. Qolgan urinishlar: ${remaining} ta.`,
          remainingAttempts: remaining,
        });
      }
    }

    // OTP is valid! Execute SQLite transaction to activate user and remove OTP
    let user;
    await prisma.$transaction(async (tx) => {
      user = await tx.user.update({
        where: { email },
        data: { isEmailVerified: true },
      });

      // Requirement: Kod tasdiqlangandan keyin o‘chirilsin
      await tx.emailVerification.delete({
        where: { id: verification.id },
      });

      // Create welcome notification
      await tx.notification.create({
        data: {
          userId: user.id,
          title: 'CodeMaster LMS-ga xush kelibsiz!',
          message: 'Emailingiz muvaffaqiyatli tasdiqlandi. Endi kurslarni o‘rganishni boshlashingiz mumkin!',
          type: 'SUCCESS',
        },
      });
    });

    // Establish session
    req.session.userId = user.id;

    await logAudit({
      userId: user.id,
      action: 'EMAIL_OTP_VERIFIED',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { email },
    });

    res.json({
      success: true,
      message: 'Email muvaffaqiyatli tasdiqlandi!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Kodni tasdiqlashda xatolik yuz berdi.' });
  }
}

/**
 * Resend OTP code adhering to 60-second cooldown
 */
async function resendOtp(req, res) {
  try {
    const { email } = req.body;
    const now = new Date();

    const existingVerification = await prisma.emailVerification.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (existingVerification && existingVerification.resendAvailableAt > now) {
      const waitSeconds = Math.ceil((existingVerification.resendAvailableAt.getTime() - now.getTime()) / 1000);
      return res.status(429).json({
        success: false,
        message: `Iltimos, qayta yuborish uchun yana ${waitSeconds} soniya kuting.`,
        waitSeconds,
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Ushbu email ro‘yxatdan o‘tmagan.' });
    }

    const otpCode = generateOtpCode();
    const hashedOtp = hashOtp(otpCode);
    const expiresAt = getOtpExpiryDate();
    const resendAvailableAt = getResendAvailableDate();

    await prisma.$transaction(async (tx) => {
      // Invalidate old active OTP
      await tx.emailVerification.deleteMany({ where: { email } });

      // Create new OTP record
      await tx.emailVerification.create({
        data: {
          userId: user.id,
          email,
          otpHash: hashedOtp,
          expiresAt,
          attempts: 0,
          resendAvailableAt,
        },
      });
    });

    await sendVerificationOtpEmail(email, otpCode, user.name);

    await logAudit({
      userId: user.id,
      action: 'OTP_RESENT',
      entity: 'EmailVerification',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { email },
    });

    res.json({
      success: true,
      message: 'Yangi tasdiqlash kodi emailingizga yuborildi.',
      expiresInSeconds: 300,
      resendCooldownSeconds: 60,
      devOtp: (!process.env.SMTP_USER || process.env.SMTP_USER.trim() === '') ? otpCode : undefined,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, message: 'Kodni qayta yuborishda xatolik yuz berdi.' });
  }
}

/**
 * Login user and start session
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email yoki parol noto‘g‘ri.',
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email yoki parol noto‘g‘ri.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Hisobingiz ma‘muriyat tomonidan bloklangan.',
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        message: 'Email tasdiqlanmagan. Iltimos, emailingizga yuborilgan OTP kodni kiriting.',
      });
    }

    // Set secure session
    req.session.userId = user.id;

    await logAudit({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { email: user.email, role: user.role },
    });

    res.json({
      success: true,
      message: 'Muvaffaqiyatli tizimga kirdingiz!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Tizimga kirishda xatolik yuz berdi.' });
  }
}

/**
 * Logout current user and destroy session
 */
async function logout(req, res) {
  try {
    const userId = req.session ? req.session.userId : null;

    if (userId) {
      await logAudit({
        userId,
        action: 'USER_LOGOUT',
        entity: 'User',
        entityId: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Chiqishda xatolik yuz berdi.' });
      }
      res.clearCookie('codemaster_sid');
      res.json({ success: true, message: 'Tizimdan muvaffaqiyatli chiqildi.' });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server xatosi.' });
  }
}

/**
 * Get currently authenticated user details
 */
async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        bio: true,
        isEmailVerified: true,
        createdAt: true,
        _count: {
          select: {
            enrollments: true,
            certificates: true,
            notifications: { where: { isRead: false } },
            coursesTaught: true,
          },
        },
      },
    });

    res.json({
      success: true,
      user: {
        ...user,
        stats: {
          enrolledCount: user._count.enrollments,
          certificatesCount: user._count.certificates,
          unreadNotificationsCount: user._count.notifications,
          coursesTaughtCount: user._count.coursesTaught,
        },
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, message: 'Server xatosi.' });
  }
}

/**
 * Request Password Reset OTP
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email manzilini kiriting.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      // Security practice: don't reveal if email exists, return generic message
      return res.json({
        success: true,
        message: 'Agar ushbu email ro‘yxatdan o‘tgan bo‘lsa, parolni tiklash kodi yuborildi.',
      });
    }

    const otpCode = generateOtpCode();
    const tokenHash = hashOtp(otpCode);
    const expiresAt = getOtpExpiryDate(); // 5 minutes

    await prisma.$transaction(async (tx) => {
      // Invalidate existing reset tokens
      await tx.passwordResetToken.deleteMany({
        where: { email: user.email },
      });

      // Save new reset token hash
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          email: user.email,
          tokenHash,
          expiresAt,
          used: false,
        },
      });
    });

    await sendPasswordResetOtpEmail(user.email, otpCode, user.name);

    await logAudit({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'PasswordResetToken',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { email: user.email },
    });

    res.json({
      success: true,
      message: 'Parolni tiklash kodi emailingizga yuborildi.',
      devOtp: (!process.env.SMTP_USER || process.env.SMTP_USER.trim() === '') ? otpCode : undefined,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Xatolik yuz berdi.' });
  }
}

/**
 * Reset password using OTP code
 */
async function resetPasswordWithOtp(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Barcha maydonlarni to‘ldiring (yangi parol kamida 6 ta belgi).',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        email: normalizedEmail,
        used: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetToken || resetToken.expiresAt < now) {
      return res.status(400).json({
        success: false,
        message: 'Parolni tiklash kodi eskirgan yoki topilmadi. Qaytadan so‘rov yuboring.',
      });
    }

    const isValid = compareOtp(otp, resetToken.tokenHash);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Tasdiqlash kodi noto‘g‘ri.',
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      // Mark token as used or delete it
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      });
    });

    await logAudit({
      userId: resetToken.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entity: 'User',
      entityId: resetToken.userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Parolingiz muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Parolni yangilashda xatolik yuz berdi.' });
  }
}

module.exports = {
  register,
  verifyEmailOtp,
  resendOtp,
  login,
  logout,
  me,
  forgotPassword,
  resetPasswordWithOtp,
};
