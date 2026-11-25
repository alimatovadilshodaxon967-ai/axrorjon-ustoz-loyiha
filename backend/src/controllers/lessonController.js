const prisma = require('../config/db');

/**
 * Get lesson content with permissions check (free preview or enrolled)
 */
async function getLessonById(req, res) {
  try {
    const { id } = req.params;
    const currentUserId = req.user ? req.user.id : null;
    const currentUserRole = req.user ? req.user.role : null;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            course: true,
            lessons: {
              orderBy: { order: 'asc' },
              select: { id: true, title: true, order: true },
            },
          },
        },
        assignments: {
          include: {
            submissions: currentUserId
              ? {
                  where: { userId: currentUserId },
                  orderBy: { submittedAt: 'desc' },
                }
              : false,
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Dars topilmadi.' });
    }

    const courseId = lesson.module.courseId;
    let hasAccess = false;

    if (currentUserRole === 'ADMIN' || (req.user && lesson.module.course.instructorId === currentUserId)) {
      hasAccess = true;
    } else if (lesson.isFreePreview) {
      hasAccess = true;
    } else if (currentUserId) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: currentUserId, courseId } },
      });
      if (enrollment) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Ushbu darsni ko‘rish uchun kursga yozilishingiz kerak.',
        requiresEnrollment: true,
        courseSlug: lesson.module.course.slug,
      });
    }

    // Determine prev and next lesson
    const siblingLessons = lesson.module.lessons;
    const currentIndex = siblingLessons.findIndex((l) => l.id === lesson.id);
    const prevLessonId = currentIndex > 0 ? siblingLessons[currentIndex - 1].id : null;
    const nextLessonId = currentIndex < siblingLessons.length - 1 ? siblingLessons[currentIndex + 1].id : null;

    // Check user progress for this lesson
    let isCompleted = false;
    if (currentUserId) {
      const progress = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: currentUserId, lessonId: lesson.id } },
      });
      isCompleted = !!progress?.isCompleted;
    }

    res.json({
      success: true,
      lesson: {
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        durationMinutes: lesson.durationMinutes,
        order: lesson.order,
        isFreePreview: lesson.isFreePreview,
        moduleId: lesson.moduleId,
        moduleTitle: lesson.module.title,
        courseId: lesson.module.courseId,
        courseTitle: lesson.module.course.title,
        courseSlug: lesson.module.course.slug,
        isCompleted,
        prevLessonId,
        nextLessonId,
        assignments: lesson.assignments,
      },
    });
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ success: false, message: 'Darsni yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Create a new lesson (Instructor/Admin)
 */
async function createLesson(req, res) {
  try {
    const { moduleId, title, content, videoUrl, durationMinutes, isFreePreview, order } = req.body;

    if (!moduleId || !title || !content) {
      return res.status(400).json({ success: false, message: 'Modul ID, nom va kontent kiritilishi shart.' });
    }

    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { course: true },
    });

    if (!moduleRecord) {
      return res.status(404).json({ success: false, message: 'Modul topilmadi.' });
    }

    if (req.user.role !== 'ADMIN' && moduleRecord.course.instructorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ruxsat yo‘q.' });
    }

    const lastLesson = await prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
    });

    const newOrder = order !== undefined ? parseInt(order, 10) : (lastLesson ? lastLesson.order + 1 : 1);

    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title: title.trim(),
        content: content.trim(),
        videoUrl: videoUrl ? videoUrl.trim() : null,
        durationMinutes: parseInt(durationMinutes, 10) || 10,
        isFreePreview: Boolean(isFreePreview),
        order: newOrder,
      },
    });

    res.status(201).json({ success: true, message: 'Dars yaratildi.', lesson });
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({ success: false, message: 'Dars yaratishda xatolik yuz berdi.' });
  }
}

/**
 * Update lesson
 */
async function updateLesson(req, res) {
  try {
    const { id } = req.params;
    const { title, content, videoUrl, durationMinutes, isFreePreview, order } = req.body;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { module: { include: { course: true } } },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Dars topilmadi.' });
    }

    if (req.user.role !== 'ADMIN' && lesson.module.course.instructorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ruxsat yo‘q.' });
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : lesson.title,
        content: content !== undefined ? content.trim() : lesson.content,
        videoUrl: videoUrl !== undefined ? videoUrl : lesson.videoUrl,
        durationMinutes: durationMinutes !== undefined ? parseInt(durationMinutes, 10) : lesson.durationMinutes,
        isFreePreview: isFreePreview !== undefined ? Boolean(isFreePreview) : lesson.isFreePreview,
        order: order !== undefined ? parseInt(order, 10) : lesson.order,
      },
    });

    res.json({ success: true, message: 'Dars muvaffaqiyatli yangilandi.', lesson: updated });
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ success: false, message: 'Darsni yangilashda xatolik yuz berdi.' });
  }
}

/**
 * Delete lesson
 */
async function deleteLesson(req, res) {
  try {
    const { id } = req.params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { module: { include: { course: true } } },
    });

    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Dars topilmadi.' });
    }

    if (req.user.role !== 'ADMIN' && lesson.module.course.instructorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ruxsat yo‘q.' });
    }

    await prisma.lesson.delete({ where: { id } });

    res.json({ success: true, message: 'Dars o‘chirildi.' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ success: false, message: 'Darsni o‘chirishda xatolik yuz berdi.' });
  }
}

module.exports = {
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
};
