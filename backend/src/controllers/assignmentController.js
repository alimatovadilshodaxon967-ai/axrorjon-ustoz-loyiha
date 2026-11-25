const prisma = require('../config/db');
const { logAudit } = require('../services/auditService');

/**
 * Submit work for an assignment
 */
async function submitAssignment(req, res) {
  try {
    const { assignmentId, submissionText, submissionUrl } = req.body;
    const userId = req.user.id;

    if (!assignmentId || !submissionText) {
      return res.status(400).json({ success: false, message: 'Topshiriq ID va matnini kiriting.' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { lesson: { include: { module: { include: { course: true } } } } },
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: assignment.lesson.module.courseId,
        },
      },
    });

    if (!enrollment && req.user.role === 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Topshiriq yuborish uchun kursga yozilishingiz kerak.' });
    }

    // Create or update submission
    const submission = await prisma.submission.create({
      data: {
        assignmentId,
        userId,
        submissionText: submissionText.trim(),
        submissionUrl: submissionUrl ? submissionUrl.trim() : null,
        status: 'PENDING',
      },
    });

    await logAudit({
      userId,
      action: 'ASSIGNMENT_SUBMITTED',
      entity: 'Submission',
      entityId: submission.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Topshiriq muvaffaqiyatli topshirildi va tekshirishga yuborildi!',
      submission,
    });
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({ success: false, message: 'Topshiriqni topshirishda xatolik yuz berdi.' });
  }
}

/**
 * List submissions (Instructor / Admin)
 */
async function listSubmissions(req, res) {
  try {
    const { status, assignmentId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (assignmentId) where.assignmentId = assignmentId;

    const submissions = await prisma.submission.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            lesson: {
              select: {
                title: true,
                module: { select: { title: true, course: { select: { title: true } } } },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({ success: true, submissions });
  } catch (error) {
    console.error('List submissions error:', error);
    res.status(500).json({ success: false, message: 'Topshiriqlarni yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Grade a student submission (Instructor / Admin)
 */
async function gradeSubmission(req, res) {
  try {
    const { id } = req.params;
    const { score, feedback, status = 'GRADED' } = req.body;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        assignment: true,
        user: true,
      },
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Topshiriq topilmadi.' });
    }

    const numericScore = parseFloat(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > submission.assignment.maxScore) {
      return res.status(400).json({
        success: false,
        message: `Ball 0 dan ${submission.assignment.maxScore} gacha bo‘lishi kerak.`,
      });
    }

    let updated;
    await prisma.$transaction(async (tx) => {
      updated = await tx.submission.update({
        where: { id },
        data: {
          score: numericScore,
          feedback: feedback ? feedback.trim() : null,
          status,
          gradedAt: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          userId: submission.userId,
          title: `"${submission.assignment.title}" topshirig‘i baholandi! ✍️`,
          message: `Sizning topshirig‘ingiz tekshirildi. Ball: ${numericScore} / ${submission.assignment.maxScore}.${feedback ? ` Izoh: ${feedback}` : ''}`,
          type: 'GRADE',
        },
      });
    });

    res.json({ success: true, message: 'Topshiriq baholandi.', submission: updated });
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ success: false, message: 'Baholashda xatolik yuz berdi.' });
  }
}

module.exports = {
  submitAssignment,
  listSubmissions,
  gradeSubmission,
};
