const prisma = require('../config/db');
const { logAudit } = require('../services/auditService');

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
}

/**
 * List all published courses with category and search filtering
 */
async function listCourses(req, res) {
  try {
    const { category, level, search } = req.query;
    const currentUserId = req.user ? req.user.id : null;

    const where = {
      isPublished: true,
    };

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (level && level !== 'ALL') {
      where.level = level;
    }

    if (search && search.trim() !== '') {
      where.OR = [
        { title: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        instructor: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: {
            modules: true,
            enrollments: true,
          },
        },
        modules: {
          select: {
            id: true,
            _count: {
              select: { lessons: true, quizzes: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check enrollment for current user if logged in
    let userEnrollmentsMap = {};
    if (currentUserId) {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: currentUserId },
        select: { courseId: true, progressPercent: true, isCompleted: true },
      });
      userEnrollmentsMap = enrollments.reduce((acc, curr) => {
        acc[curr.courseId] = curr;
        return acc;
      }, {});
    }

    const formatted = courses.map((course) => {
      const totalLessons = course.modules.reduce((sum, m) => sum + m._count.lessons, 0);
      const totalQuizzes = course.modules.reduce((sum, m) => sum + m._count.quizzes, 0);
      const userEnrollment = userEnrollmentsMap[course.id] || null;

      return {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.category,
        level: course.level,
        price: course.price,
        thumbnail: course.thumbnail,
        createdAt: course.createdAt,
        instructor: course.instructor,
        modulesCount: course._count.modules,
        enrollmentsCount: course._count.enrollments,
        totalLessons,
        totalQuizzes,
        userEnrollment,
      };
    });

    res.json({ success: true, courses: formatted });
  } catch (error) {
    console.error('List courses error:', error);
    res.status(500).json({ success: false, message: 'Kurslarni yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Get single course with full syllabus (modules, lessons, quizzes, user progress)
 */
async function getCourseBySlug(req, res) {
  try {
    const { slug } = req.params;
    const currentUserId = req.user ? req.user.id : null;

    const course = await prisma.course.findUnique({
      where: { slug },
      include: {
        instructor: {
          select: { id: true, name: true, bio: true, avatarUrl: true },
        },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                durationMinutes: true,
                order: true,
                isFreePreview: true,
                videoUrl: true,
                // Don't send heavy content in syllabus list
                assignments: {
                  select: { id: true, title: true, maxScore: true },
                },
              },
            },
            quizzes: {
              select: {
                id: true,
                title: true,
                timeLimitMinutes: true,
                passingScore: true,
                _count: { select: { questions: true } },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Kurs topilmadi.' });
    }

    let enrollment = null;
    let completedLessonIds = [];

    if (currentUserId) {
      enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: currentUserId,
            courseId: course.id,
          },
        },
      });

      if (enrollment) {
        const progresses = await prisma.lessonProgress.findMany({
          where: {
            userId: currentUserId,
            isCompleted: true,
            lesson: { module: { courseId: course.id } },
          },
          select: { lessonId: true },
        });
        completedLessonIds = progresses.map((p) => p.lessonId);
      }
    }

    res.json({
      success: true,
      course,
      enrollment,
      completedLessonIds,
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ success: false, message: 'Kurs ma‘lumotlarini yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Create a new course (Instructor or Admin)
 */
async function createCourse(req, res) {
  try {
    const { title, description, category, level, price, thumbnail } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Kurs nomi va tavsifini kiriting.' });
    }

    const slug = generateSlug(title);

    const course = await prisma.course.create({
      data: {
        title: title.trim(),
        slug,
        description: description.trim(),
        category: category || 'Dasturlash',
        level: level || 'BEGINNER',
        price: parseFloat(price) || 0.0,
        thumbnail: thumbnail || null,
        instructorId: req.user.id,
      },
    });

    await logAudit({
      userId: req.user.id,
      action: 'COURSE_CREATED',
      entity: 'Course',
      entityId: course.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { title: course.title, slug: course.slug },
    });

    res.status(201).json({ success: true, message: 'Kurs muvaffaqiyatli yaratildi!', course });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ success: false, message: 'Kurs yaratishda xatolik yuz berdi.' });
  }
}

/**
 * Update course details
 */
async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    const { title, description, category, level, price, thumbnail, isPublished } = req.body;

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Kurs topilmadi.' });
    }

    if (req.user.role !== 'ADMIN' && course.instructorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ushbu kursni tahrirlash huquqingiz yo‘q.' });
    }

    const updated = await prisma.course.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : course.title,
        description: description !== undefined ? description.trim() : course.description,
        category: category !== undefined ? category : course.category,
        level: level !== undefined ? level : course.level,
        price: price !== undefined ? parseFloat(price) : course.price,
        thumbnail: thumbnail !== undefined ? thumbnail : course.thumbnail,
        isPublished: isPublished !== undefined ? isPublished : course.isPublished,
      },
    });

    res.json({ success: true, message: 'Kurs muvaffaqiyatli yangilandi.', course: updated });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ success: false, message: 'Kursni yangilashda xatolik yuz berdi.' });
  }
}

/**
 * Delete a course
 */
async function deleteCourse(req, res) {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Kurs topilmadi.' });
    }

    if (req.user.role !== 'ADMIN' && course.instructorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Kursni o‘chirish huquqingiz yo‘q.' });
    }

    await prisma.course.delete({ where: { id } });

    await logAudit({
      userId: req.user.id,
      action: 'COURSE_DELETED',
      entity: 'Course',
      entityId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { title: course.title },
    });

    res.json({ success: true, message: 'Kurs muvaffaqiyatli o‘chirildi.' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ success: false, message: 'Kursni o‘chirishda xatolik yuz berdi.' });
  }
}

/**
 * Add a module to a course
 */
async function createModule(req, res) {
  try {
    const { courseId } = req.params;
    const { title, description, order } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Modul nomini kiriting.' });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return res.status(404).json({ success: false, message: 'Kurs topilmadi.' });
    }

    if (req.user.role !== 'ADMIN' && course.instructorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Ruxsat yo‘q.' });
    }

    const lastModule = await prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });

    const newOrder = order !== undefined ? parseInt(order, 10) : (lastModule ? lastModule.order + 1 : 1);

    const moduleRecord = await prisma.module.create({
      data: {
        courseId,
        title: title.trim(),
        description: description ? description.trim() : null,
        order: newOrder,
      },
    });

    res.status(201).json({ success: true, message: 'Modul yaratildi.', module: moduleRecord });
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ success: false, message: 'Modul yaratishda xatolik yuz berdi.' });
  }
}

module.exports = {
  listCourses,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
  createModule,
};
