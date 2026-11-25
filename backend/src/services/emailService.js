const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass && user.trim() !== '' && pass.trim() !== '') {
    const cleanPass = pass.replace(/\s+/g, '');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user.trim(),
        pass: cleanPass,
      },
    });
    console.log(`✓ Nodemailer configured with Gmail SMTP for: ${user.trim()}`);
  } else {
    // Development fallback transporter
    transporter = {
      isDevFallback: true,
      async sendMail(mailOptions) {
        console.log('\n================== [EMAIL DEV SIMULATOR] ==================');
        console.log(`To:      ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`From:    ${mailOptions.from || process.env.SMTP_FROM}`);
        if (mailOptions.text) console.log(`Text:\n${mailOptions.text}`);
        console.log('===========================================================\n');
        return { messageId: `dev-simulated-${Date.now()}` };
      },
    };
    console.log('ℹ Nodemailer: No Gmail SMTP credentials provided. Running in secure dev logger mode.');
  }

  return transporter;
}

/**
 * Send 6-digit OTP for Email Verification
 */
async function sendVerificationOtpEmail(toEmail, otpCode, userName = 'Foydalanuvchi') {
  const mailer = getTransporter();
  const from = process.env.SMTP_FROM || 'CodeMaster LMS <noreply@codemaster.uz>';

  const subject = `[CodeMaster LMS] Tasdiqlash kodingiz: ${otpCode}`;
  const text = `Salom ${userName}!\n\nSizning CodeMaster LMS akkauntingizni tasdiqlash kodingiz: ${otpCode}\n\nBu kod 5 daqiqa davomida amal qiladi. Kodni hech kimga bermang!`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">CodeMaster LMS</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Zamonaviy Ta'lim Platformasi</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Salom, ${userName}!</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">CodeMaster LMS platformasida ro'yxatdan o'tganingiz uchun tashakkur. Akkauntingizni tasdiqlash uchun quyidagi 6 xonali bir martalik koddan (OTP) foydalaning:</p>
        
        <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">${otpCode}</span>
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
          <p style="margin: 0; color: #92400e; font-size: 13px;">
            <strong>Eslatma:</strong> Ushbu kod <strong>5 daqiqa</strong> davomida amal qiladi. Maksimal 5 ta urinish ruxsat etiladi. Kodni hech kimga bermang!
          </p>
        </div>

        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 0;">Agar siz ushbu so'rovni yubormagan bo'lsangiz, xatni e'tiborsiz qoldiring.</p>
      </div>
      <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
        © 2026 CodeMaster LMS. Barcha huquqlar himoyalangan.
      </div>
    </div>
  `;

  return await mailer.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html,
  });
}

/**
 * Send Password Reset OTP
 */
async function sendPasswordResetOtpEmail(toEmail, otpCode, userName = 'Foydalanuvchi') {
  const mailer = getTransporter();
  const from = process.env.SMTP_FROM || 'CodeMaster LMS <noreply@codemaster.uz>';

  const subject = `[CodeMaster LMS] Parolni tiklash kodi: ${otpCode}`;
  const text = `Salom ${userName}!\n\nParolingizni tiklash uchun kodingiz: ${otpCode}\n\nBu kod 5 daqiqa davomida amal qiladi.`;
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 26px; font-weight: 700;">CodeMaster LMS</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Parolni Tiklash So'rovi</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Salom, ${userName}!</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">Hisobingiz parolini tiklash so'raldi. Parolni yangilash uchun tasdiqlash kodi:</p>
        
        <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace;">${otpCode}</span>
        </div>

        <p style="color: #92400e; font-size: 13px;">Ushbu kod 5 daqiqa davomida amal qiladi.</p>
      </div>
      <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
        © 2026 CodeMaster LMS
      </div>
    </div>
  `;

  return await mailer.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendVerificationOtpEmail,
  sendPasswordResetOtpEmail,
};
