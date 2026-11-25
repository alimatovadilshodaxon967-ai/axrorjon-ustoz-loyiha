const prisma = require('../config/db');
const { logAudit } = require('../services/auditService');

function generateCertificateCode() {
  const year = new Date().getFullYear();
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  const num = Math.floor(1000 + Math.random() * 9000);
  return `CM-${year}-${randomStr}${num}`;
}

/**
 * Enroll student into a course
 */
async function enrollInCourse(req, res) {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Kurs ID ko‘rsatilmadi.' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: { select: { id: true } },
          },
        },
      },
    });

    if (!course || !course.isPublished) {
      return res.status(404).json({ success: false, message: 'Kurs topilmadi yoki hali chop etilmagan.' });
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Siz bu kursga allaqachon yozilgansiz.' });
    }

    let enrollment;
    await prisma.$transaction(async (tx) => {
      enrollment = await tx.enrollment.create({
        data: {
          userId,
          courseId,
          progressPercent: 0,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          title: `"${course.title}" kursiga muvaffaqiyatli yozildingiz!`,
          message: 'Darslarni boshlash uchun kurs sahifasiga o‘ting. Omad tilaymiz!',
          type: 'COURSE',
        },
      });
    });

    await logAudit({
      userId,
      action: 'COURSE_ENROLLED',
      entity: 'Enrollment',
      entityId: enrollment.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { courseId, courseTitle: course.title },
    });

    res.status(201).json({
      success: true,
      message: 'Kursga muvaffaqiyatli yozildingiz!',
      enrollment,
    });
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({ success: false, message: 'Kursga yozilishda xatolik yuz berdi.' });
  }
}

/**
 * Get all courses the current user is enrolled in
 */
async function getMyEnrollments(req, res) {
  try {
    const userId = req.user.id;

    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: { select: { id: true, name: true, avatarUrl: true } },
            modules: {
              select: {
                _count: { select: { lessons: true } },
              },
            },
            certificates: {
              where: { userId },
              select: { id: true, certificateCode: true, issuedAt: true },
            },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const formatted = enrollments.map((enr) => {
      const totalLessons = enr.course.modules.reduce((sum, m) => sum + m._count.lessons, 0);
      const certificate = enr.course.certificates.length > 0 ? enr.course.certificates[0] : null;

      return {
        id: enr.id,
        courseId: enr.courseId,
        enrolledAt: enr.enrolledAt,
        progressPercent: enr.progressPercent,
        isCompleted: enr.isCompleted,
        completedAt: enr.completedAt,
        certificate,
        course: {
          id: enr.course.id,
          title: enr.course.title,
          slug: enr.course.slug,
          category: enr.course.category,
          level: enr.course.level,
          thumbnail: enr.course.thumbnail,
          instructor: enr.course.instructor,
          totalLessons,
        },
      };
    });

    res.json({ success: true, enrollments: formatted });
  } catch (error) {
    console.error('Get my enrollments error:', error);
    res.status(500).json({ success: false, message: 'Yozilgan kurslarni yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Mark a lesson as completed and auto-recalculate course progress
 */
async function updateLessonProgress(req, res) {
  try {
    const { lessonId } = req.body;
    const userId = req.user.id;

    if (!lessonId) {
      return res.status(400).json({ success: false, message: 'Dars ID ko‘rsatilmadi.' });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Dars topilmadi.' });
    }

    const courseId = lesson.module.courseId;

    // Check enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });

    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'Siz bu kursga yozilmagansiz.' });
    }

    let progressRecord;
    let newlyCompleted = false;
    let newProgressPercent = enrollment.progressPercent;
    let issuedCertificate = null;

    // SQLite Transaction for atomic progress and certification
    await prisma.$transaction(async (tx) => {
      // Upsert lesson progress
      progressRecord = await tx.lessonProgress.upsert({
        where: {
          userId_lessonId: { userId, lessonId },
        },
        update: {
          isCompleted: true,
          completedAt: new Date(),
          lastViewedAt: new Date(),
        },
        create: {
          userId,
          lessonId,
          isCompleted: true,
          completedAt: new Date(),
          lastViewedAt: new Date(),
        },
      });

      // Count total lessons in this course
      const totalLessonsCount = await tx.lesson.count({
        where: {
          module: { courseId },
        },
      });

      // Count completed lessons by this user in this course
      const completedLessonsCount = await tx.lessonProgress.count({
        where: {
          userId,
          isCompleted: true,
          lesson: { module: { courseId } },
        },
      });

      newProgressPercent = totalLessonsCount > 0
        ? Math.min(100, Math.round((completedLessonsCount / totalLessonsCount) * 100))
        : 100;

      const isFinished = newProgressPercent >= 100;

      // Update enrollment
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          progressPercent: newProgressPercent,
          isCompleted: isFinished,
          completedAt: isFinished && !enrollment.isCompleted ? new Date() : enrollment.completedAt,
        },
      });

      // If just completed 100%, generate certificate!
      if (isFinished && !enrollment.isCompleted) {
        newlyCompleted = true;

        // Check if certificate already exists
        const existingCert = await tx.certificate.findFirst({
          where: { userId, courseId },
        });

        if (!existingCert) {
          const certCode = generateCertificateCode();
          issuedCertificate = await tx.certificate.create({
            data: {
              certificateCode: certCode,
              userId,
              courseId,
              grade: 'A\'lo (100%)',
            },
          });

          await tx.notification.create({
            data: {
              userId,
              title: 'Tabriklaymiz! Sertifikat berildi! 🎓',
              message: `Siz "${lesson.module.course.title}" kursini 100% muvaffaqiyatli tamomladingiz. Sertifikat kodingiz: ${certCode}`,
              type: 'SUCCESS',
            },
          });
        }
      }
    });

    res.json({
      success: true,
      message: newlyCompleted
        ? 'Tabriklaymiz! Kursni to‘liq tamomladingiz va sertifikat qo‘lga kiritdingiz!'
        : 'Dars muvaffaqiyatli yakunlandi!',
      progressPercent: newProgressPercent,
      isCompleted: newProgressPercent >= 100,
      certificate: issuedCertificate,
    });
  } catch (error) {
    console.error('Update lesson progress error:', error);
    res.status(500).json({ success: false, message: 'Dars holatini yangilashda xatolik yuz berdi.' });
  }
}

module.exports = {
  enrollInCourse,
  getMyEnrollments,
  updateLessonProgress,
};
