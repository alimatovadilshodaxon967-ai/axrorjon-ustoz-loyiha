const prisma = require('../config/db');

/**
 * Public certificate verification by unique code
 */
async function verifyCertificate(req, res) {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Sertifikat kodi kiritilmadi.' });
    }

    const certificate = await prisma.certificate.findUnique({
      where: { certificateCode: code.trim().toUpperCase() },
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: {
          select: {
            id: true,
            title: true,
            category: true,
            level: true,
            instructor: { select: { name: true } },
          },
        },
      },
    });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Bunday kodli sertifikat topilmadi yoki u haqiqiy emas.',
        isValid: false,
      });
    }

    res.json({
      success: true,
      isValid: true,
      certificate: {
        code: certificate.certificateCode,
        studentName: certificate.user.name,
        courseTitle: certificate.course.title,
        instructorName: certificate.course.instructor.name,
        category: certificate.course.category,
        grade: certificate.grade || 'A\'lo',
        issuedAt: certificate.issuedAt,
      },
    });
  } catch (error) {
    console.error('Verify certificate error:', error);
    res.status(500).json({ success: false, message: 'Sertifikatni tekshirishda xatolik yuz berdi.' });
  }
}

/**
 * Get certificates for current logged-in user
 */
async function getMyCertificates(req, res) {
  try {
    const userId = req.user.id;

    const certificates = await prisma.certificate.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            instructor: { select: { name: true } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });

    res.json({ success: true, certificates });
  } catch (error) {
    console.error('Get my certificates error:', error);
    res.status(500).json({ success: false, message: 'Sertifikatlarni yuklashda xatolik yuz berdi.' });
  }
}

module.exports = {
  verifyCertificate,
  getMyCertificates,
};
