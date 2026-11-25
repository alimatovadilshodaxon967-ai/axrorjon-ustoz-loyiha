const prisma = require('../config/db');
const { logAudit } = require('../services/auditService');

/**
 * Get quiz details and questions for taking the test
 */
async function getQuizById(req, res) {
  try {
    const { id } = req.params;
    const isStaff = req.user && ['ADMIN', 'INSTRUCTOR'].includes(req.user.role);

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        module: {
          include: { course: true },
        },
        questions: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Test topilmadi.' });
    }

    // Prepare questions (hide correct answers for students)
    const sanitizedQuestions = quiz.questions.map((q) => {
      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(q.optionsJson);
      } catch (e) {
        parsedOptions = [];
      }

      const qObj = {
        id: q.id,
        text: q.text,
        options: parsedOptions,
        points: q.points,
        order: q.order,
      };

      if (isStaff) {
        qObj.correctAnswer = q.correctAnswer;
        qObj.explanation = q.explanation;
      }

      return qObj;
    });

    // Check recent attempts for this user
    let userAttempts = [];
    if (req.user) {
      userAttempts = await prisma.quizAttempt.findMany({
        where: { quizId: id, userId: req.user.id },
        orderBy: { completedAt: 'desc' },
        take: 5,
      });
    }

    res.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passingScore: quiz.passingScore,
        timeLimitMinutes: quiz.timeLimitMinutes,
        courseId: quiz.module.courseId,
        courseTitle: quiz.module.course.title,
        courseSlug: quiz.module.course.slug,
        moduleId: quiz.moduleId,
        moduleTitle: quiz.module.title,
        questions: sanitizedQuestions,
        userAttempts,
      },
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ success: false, message: 'Testni yuklashda xatolik yuz berdi.' });
  }
}

/**
 * Submit quiz answers and auto-grade
 */
async function submitQuiz(req, res) {
  try {
    const { id } = req.params;
    const { answers } = req.body; // array of { questionId, selectedIndex }
    const userId = req.user.id;

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: true,
        module: { include: { course: true } },
      },
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Test topilmadi.' });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Javoblar to‘g‘ri formatda yuborilmadi.' });
    }

    const answersMap = {};
    answers.forEach((ans) => {
      answersMap[ans.questionId] = ans.selectedIndex;
    });

    let totalPoints = 0;
    let earnedPoints = 0;
    const reviewDetails = [];

    quiz.questions.forEach((q) => {
      totalPoints += q.points;
      const selectedIndex = answersMap[q.id];
      const isCorrect = selectedIndex !== undefined && selectedIndex === q.correctAnswer;

      if (isCorrect) {
        earnedPoints += q.points;
      }

      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(q.optionsJson);
      } catch (e) {
        parsedOptions = [];
      }

      reviewDetails.push({
        questionId: q.id,
        questionText: q.text,
        options: parsedOptions,
        selectedIndex: selectedIndex !== undefined ? selectedIndex : null,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation,
        pointsAwarded: isCorrect ? q.points : 0,
        maxPoints: q.points,
      });
    });

    const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const passed = scorePercent >= quiz.passingScore;

    let attempt;
    await prisma.$transaction(async (tx) => {
      attempt = await tx.quizAttempt.create({
        data: {
          quizId: id,
          userId,
          score: scorePercent,
          passed,
          userAnswersJson: JSON.stringify(answers),
        },
      });

      await tx.notification.create({
        data: {
          userId,
          title: passed ? 'Tabriklaymiz! Testdan o‘tdingiz! 🎉' : 'Test natijasi 📋',
          message: `"${quiz.title}" testidan natijangiz: ${scorePercent}% (${passed ? 'Muvaffaqiyatli' : 'O‘ta olmadingiz'}). O‘tish bali: ${quiz.passingScore}%.`,
          type: passed ? 'SUCCESS' : 'WARNING',
        },
      });
    });

    await logAudit({
      userId,
      action: 'QUIZ_SUBMITTED',
      entity: 'QuizAttempt',
      entityId: attempt.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: { quizId: id, scorePercent, passed },
    });

    res.json({
      success: true,
      result: {
        attemptId: attempt.id,
        score: scorePercent,
        earnedPoints,
        totalPoints,
        passed,
        passingScore: quiz.passingScore,
        reviewDetails,
      },
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, message: 'Testni tekshirishda xatolik yuz berdi.' });
  }
}

module.exports = {
  getQuizById,
  submitQuiz,
};
