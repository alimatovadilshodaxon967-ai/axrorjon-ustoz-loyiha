const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_IF_EMPTY === 'true') {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      console.log('✓ Database already seeded, skipping.');
      return;
    }
  }

  console.log('🌱 Starting CodeMaster LMS PostgreSQL database seeding...');

  // Clean existing data in reverse order of dependencies
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.certificate.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.quizAttempt.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.lessonProgress.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.module.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.emailVerification.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✓ Cleared previous database records.');

  // Password hashes
  const adminPassHash = await bcrypt.hash('Admin123!', 10);
  const instructorPassHash = await bcrypt.hash('Instructor123!', 10);
  const studentPassHash = await bcrypt.hash('Student123!', 10);

  // 1. Create Users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@codemaster.uz',
      passwordHash: adminPassHash,
      name: 'Sherzodbek Rahmonov (Admin)',
      role: 'ADMIN',
      isEmailVerified: true,
      bio: 'CodeMaster LMS bosh ma‘muri va bosh me‘mori.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  });

  const instructorUser = await prisma.user.create({
    data: {
      email: 'instructor@codemaster.uz',
      passwordHash: instructorPassHash,
      name: 'Anvar Narzullayev (Instructor)',
      role: 'INSTRUCTOR',
      isEmailVerified: true,
      bio: 'Senior Full-Stack dasturchi va 8 yillik tajribaga ega ustoz.',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: 'student@codemaster.uz',
      passwordHash: studentPassHash,
      name: 'Jasurbek Oripov (Student)',
      role: 'STUDENT',
      isEmailVerified: true,
      bio: 'Junior dasturchi, yangi texnologiyalarni o‘rganuvchi talaba.',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    },
  });

  console.log('✓ Created 3 Users (Admin, Instructor, Student).');

  // 2. Create Course 1: Full-Stack JavaScript
  const course1 = await prisma.course.create({
    data: {
      title: 'Full-Stack JavaScript & Node.js Masterclass',
      slug: 'javascript-fullstack-masterclass',
      description: 'HTML5, CSS3, Vanilla JS, Node.js, Express.js va SQLite yordamida noldan professional darajagacha to‘liq dasturlash kursi.',
      category: 'Dasturlash',
      level: 'INTERMEDIATE',
      price: 0.0,
      isPublished: true,
      thumbnail: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=600',
      instructorId: instructorUser.id,
    },
  });

  // Module 1
  const module1 = await prisma.module.create({
    data: {
      courseId: course1.id,
      title: '1-Modul: Zamonaviy JavaScript va ES6+ Asoslari',
      order: 1,
      description: 'O‘zgaruvchilar, funksiyalar, Promises, Async/Await va xotira boshqaruvi.',
    },
  });

  const lesson1 = await prisma.lesson.create({
    data: {
      moduleId: module1.id,
      title: 'JavaScript Kirish va Zamonaviy Sintaksis (ES6+)',
      order: 1,
      durationMinutes: 15,
      isFreePreview: true,
      videoUrl: 'https://www.youtube.com/embed/W6NZfCO5SIk',
      content: `
# JavaScript Kirish va Zamonaviy Sintaksis (ES6+)

JavaScript — zamonaviy veb-ishlanmalarning ajralmas qismidir. Ushbu darsda biz quyidagilarni o'rganamiz:

### 1. Let va Const
Eski \`var\` o'zgaruvchisidan voz kechib, \`let\` va \`const\` kalit so'zlaridan foydalanish afzalliklari:
- Blok doirasi (Block Scope)
- Temporal Dead Zone xavfsizligi
- O'zgarmas ma'lumotlar bilan ishlash

\`\`\`javascript
const platformName = "CodeMaster LMS";
let activeStudents = 1250;

if (true) {
  let insideBlock = "Faqat blok ichida ko'rinadi";
}
\`\`\`

### 2. Arrow Functions (Strelkali Funksiyalar)
\`\`\`javascript
const calculateProgress = (completed, total) => Math.round((completed / total) * 100);
console.log(calculateProgress(5, 10)); // 50%
\`\`\`
      `,
    },
  });

  const lesson2 = await prisma.lesson.create({
    data: {
      moduleId: module1.id,
      title: 'Asinxron Dasturlash: Promise va Async/Await',
      order: 2,
      durationMinutes: 20,
      isFreePreview: false,
      videoUrl: 'https://www.youtube.com/embed/PoRJizFvM7s',
      content: `
# Asinxron Dasturlash: Promise va Async/Await

JavaScript bitta oqimli (single-threaded) til bo'lib, uning asinxron imkoniyatlari Event Loop orqali boshqariladi.

### Fetch API misoli:
\`\`\`javascript
async function loadUserData(userId) {
  try {
    const response = await fetch(\`/api/auth/me\`);
    if (!response.ok) throw new Error("Tarmoq xatosi");
    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error("Xatolik:", error.message);
  }
}
\`\`\`
      `,
    },
  });

  // Assignment for Lesson 2
  await prisma.assignment.create({
    data: {
      lessonId: lesson2.id,
      title: 'Asinxron Ma‘lumot Yuklovchi Funksiya Yozish',
      instructions: 'Fetch API yoki Promise yordamida API dan ma‘lumot olib keluvchi, xatoliklarni try/catch orqali ushlab qoluvchi toza funksiya kodini yozing va topshiring.',
      maxScore: 100,
    },
  });

  // Quiz for Module 1
  const quiz1 = await prisma.quiz.create({
    data: {
      moduleId: module1.id,
      title: 'JavaScript va ES6+ Asoslari Bo‘yicha Test',
      description: 'O‘zlashtirgan bilimlaringizni 5 ta savol orqali tekshiring. O‘tish bali: 70%.',
      passingScore: 70,
      timeLimitMinutes: 10,
    },
  });

  await prisma.question.createMany({
    data: [
      {
        quizId: quiz1.id,
        text: 'Qaysi kalit so‘zi qayta o‘zgartirib bo‘lmaydigan (constant) o‘zgaruvchi e‘lon qiladi?',
        optionsJson: JSON.stringify(['var', 'let', 'const', 'static']),
        correctAnswer: 2,
        explanation: 'const kalit so‘zi orqali yaratilgan o‘zgaruvchiga qayta qiymat berib bo‘lmaydi.',
        points: 20,
        order: 1,
      },
      {
        quizId: quiz1.id,
        text: 'JavaScriptda qaysi mexanizm asinxron chaqiruvlarni boshqaradi?',
        optionsJson: JSON.stringify(['Event Loop', 'Multi-threading Engine', 'Garbage Collector', 'DOM Parser']),
        correctAnswer: 0,
        explanation: 'Event Loop bitta oqimli JS muhitida asinxron amallarni Call Stack va Callback Queue orqali muvofiqlashtiradi.',
        points: 20,
        order: 2,
      },
      {
        quizId: quiz1.id,
        text: 'Async funksiyalar doimo qanday qiymat qaytaradi?',
        optionsJson: JSON.stringify(['String', 'Promise', 'Boolean', 'Object']),
        correctAnswer: 1,
        explanation: 'Har qanday async kalit so‘zi bilan belgilangan funksiya avtomatik ravishda Promise qaytaradi.',
        points: 20,
        order: 3,
      },
      {
        quizId: quiz1.id,
        text: 'Quyidagilardan qaysi biri to‘g‘ri shablon satri (Template Literal) sintaksisi?',
        optionsJson: JSON.stringify(['"Salom " + name', "'Salom ${name}'", '`Salom ${name}`', '{{Salom name}}']),
        correctAnswer: 2,
        explanation: 'Backtick (`) va ${variable} sintaksisi ES6 Template Literals hisoblanadi.',
        points: 20,
        order: 4,
      },
      {
        quizId: quiz1.id,
        text: 'Array ichidagi barcha elementlarni yangi massivga o‘zgartirish uchun qaysi metod ishlatiladi?',
        optionsJson: JSON.stringify(['forEach', 'filter', 'map', 'reduce']),
        correctAnswer: 2,
        explanation: 'Array.prototype.map() har bir element ustida amal bajarib yangi massiv qaytaradi.',
        points: 20,
        order: 5,
      },
    ],
  });

  // Module 2
  const module2 = await prisma.module.create({
    data: {
      courseId: course1.id,
      title: '2-Modul: Node.js, Express.js va SQLite Bazasi',
      order: 2,
      description: 'RESTful API yaratish, Prisma ORM, SQLite tranzaksiyalari va sessiya xavfsizligi.',
    },
  });

  const lesson3 = await prisma.lesson.create({
    data: {
      moduleId: module2.id,
      title: 'Express.js Router va Middleware Tizimi',
      order: 1,
      durationMinutes: 25,
      isFreePreview: false,
      videoUrl: 'https://www.youtube.com/embed/L72fhGm1tfE',
      content: `
# Express.js Router va Middleware Tizimi

Express.js — eng mashhur va tezkor Node.js veb freymvorki.

### Middleware zanjiri:
\`\`\`javascript
const express = require('express');
const app = express();

app.use(express.json());

// Maxsus autentifikatsiya middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Kirish talab qilinadi" });
  }
  next();
}
\`\`\`
      `,
    },
  });

  const lesson4 = await prisma.lesson.create({
    data: {
      moduleId: module2.id,
      title: 'SQLite Bazasi va Prisma ORM Bog‘lanishi',
      order: 2,
      durationMinutes: 30,
      isFreePreview: false,
      videoUrl: 'https://www.youtube.com/embed/rLpDbdfgL_8',
      content: `
# SQLite va Prisma ORM Bog‘lanishi

SQLite — o'z-o'zini ta'minlovchi (serverless), nol-konfiguratsiyali relatsion ma'lumotlar bazasi.

### Prisma Schema bilan SQLite:
\`\`\`prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
\`\`\`

### Xavfsizlik:
1. Foreign key constraints yoqilishi shart: \`PRAGMA foreign_keys = ON;\`
2. SQLite tranzaksiyalar: \`prisma.$transaction\`
3. Parollarni bcrypt bilan hash qilish.
      `,
    },
  });

  // Assignment 2
  await prisma.assignment.create({
    data: {
      lessonId: lesson4.id,
      title: 'SQLite va Prisma yordamida CRUD endpoint yozish',
      instructions: 'Prisma yordamida yangi model yaratib, unga GET, POST, PUT, DELETE so‘rovlarini qayta ishlovchi to‘liq controller kodini taqdim eting.',
      maxScore: 100,
    },
  });

  // Course 2: Python Data Science
  const course2 = await prisma.course.create({
    data: {
      title: 'Python for Data Science & AI',
      slug: 'python-data-science-ai',
      description: 'NumPy, Pandas, Matplotlib va Machine Learning algoritmlari orqali ma‘lumotlar tahlili va sun‘iy intellekt modellarini o‘rganing.',
      category: 'Sun\'iy intellekt',
      level: 'BEGINNER',
      price: 0.0,
      isPublished: true,
      thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600',
      instructorId: instructorUser.id,
    },
  });

  const pyModule1 = await prisma.module.create({
    data: {
      courseId: course2.id,
      title: 'Python Dasturlash Asoslari',
      order: 1,
    },
  });

  await prisma.lesson.create({
    data: {
      moduleId: pyModule1.id,
      title: 'Python Sintaksisi, Ro‘yxatlar va Lug‘atlar',
      order: 1,
      durationMinutes: 20,
      isFreePreview: true,
      videoUrl: 'https://www.youtube.com/embed/rfscVS0vtbw',
      content: `
# Python Sintaksisi va Ma'lumot Tuzilmalari

Python — toza va tushunarli sintaksisga ega kuchli dasturlash tili.

\`\`\`python
students = ["Ali", "Vali", "Olim"]
scores = {"Ali": 95, "Vali": 88, "Olim": 92}

for student, score in scores.items():
    print(f"{student}: {score} ball")
\`\`\`
      `,
    },
  });

  // Course 3: Modern Frontend
  const course3 = await prisma.course.create({
    data: {
      title: 'Zamonaviy Frontend: HTML5, CSS3 va Vanilla JavaScript',
      slug: 'modern-frontend-mastery',
      description: 'Hech qanday og‘ir freymvorklarsiz toza HTML5, CSS Grid/Flexbox va Vanilla JavaScript yordamida yuqori tezlikdagi web-ilovalar yaratish.',
      category: 'Frontend',
      level: 'BEGINNER',
      price: 0.0,
      isPublished: true,
      thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600',
      instructorId: instructorUser.id,
    },
  });

  const feModule1 = await prisma.module.create({
    data: {
      courseId: course3.id,
      title: 'Flexbox, Grid va Moslashuvchan Dizayn',
      order: 1,
    },
  });

  await prisma.lesson.create({
    data: {
      moduleId: feModule1.id,
      title: 'CSS Grid va Flexbox yordamida Dashboard yaratish',
      order: 1,
      durationMinutes: 18,
      isFreePreview: true,
      videoUrl: 'https://www.youtube.com/embed/jV8B24rSN5o',
      content: `
# CSS Grid va Flexbox Asoslari

CSS Grid 2 o'lchamli (qator va ustunlar), Flexbox esa 1 o'lchamli joylashuvlar uchun eng mukammal vositadir.

\`\`\`css
.dashboard-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
}
\`\`\`
      `,
    },
  });

  console.log('✓ Created 3 Complete Courses with Modules, Lessons, Assignments and Quizzes.');

  // 3. Create Sample Enrollment for Student
  const enrollment = await prisma.enrollment.create({
    data: {
      userId: studentUser.id,
      courseId: course1.id,
      progressPercent: 50,
      isCompleted: false,
    },
  });

  // Mark lesson 1 and 2 as completed
  await prisma.lessonProgress.create({
    data: {
      userId: studentUser.id,
      lessonId: lesson1.id,
      isCompleted: true,
      completedAt: new Date(),
    },
  });

  await prisma.lessonProgress.create({
    data: {
      userId: studentUser.id,
      lessonId: lesson2.id,
      isCompleted: true,
      completedAt: new Date(),
    },
  });

  // Sample quiz attempt
  await prisma.quizAttempt.create({
    data: {
      quizId: quiz1.id,
      userId: studentUser.id,
      score: 100,
      passed: true,
      userAnswersJson: JSON.stringify([
        { questionId: '1', selectedIndex: 2 },
        { questionId: '2', selectedIndex: 0 },
        { questionId: '3', selectedIndex: 1 },
        { questionId: '4', selectedIndex: 2 },
        { questionId: '5', selectedIndex: 2 },
      ]),
    },
  });

  // 4. Sample Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: studentUser.id,
        title: 'Platformaga xush kelibsiz!',
        message: 'CodeMaster LMS-da muvaffaqiyatli ro‘yxatdan o‘tdingiz. Birinchi kursingizni boshlang!',
        type: 'SUCCESS',
      },
      {
        userId: studentUser.id,
        title: 'Test natijasi: 100%!',
        message: '"JavaScript va ES6+ Asoslari Bo‘yicha Test" testidan a‘lo natija bilan o‘tdingiz!',
        type: 'GRADE',
      },
      {
        userId: adminUser.id,
        title: 'Tizim ishga tushirildi',
        message: 'CodeMaster LMS SQLite ma‘lumotlar bazasi va barcha xizmatlar tayyor holatda ishlamoqda.',
        type: 'INFO',
      },
    ],
  });

  // 5. Sample Audit Log
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'SYSTEM_INITIALIZATION',
        entity: 'System',
        ipAddress: '127.0.0.1',
        details: JSON.stringify({ message: 'Database initialized and seeded successfully.' }),
      },
      {
        userId: instructorUser.id,
        action: 'COURSE_PUBLISHED',
        entity: 'Course',
        entityId: course1.id,
        ipAddress: '127.0.0.1',
        details: JSON.stringify({ title: course1.title }),
      },
      {
        userId: studentUser.id,
        action: 'COURSE_ENROLLED',
        entity: 'Enrollment',
        entityId: enrollment.id,
        ipAddress: '127.0.0.1',
        details: JSON.stringify({ courseId: course1.id }),
      },
    ],
  });

  console.log('✓ Created Sample Enrollment, Progress, Notifications and Audit Logs.');
  console.log('\n======================================================');
  console.log('🎉 SEEDING COMPLETED SUCCESSFULLY!');
  console.log('Admin Account:      admin@codemaster.uz / Admin123!');
  console.log('Instructor Account: instructor@codemaster.uz / Instructor123!');
  console.log('Student Account:    student@codemaster.uz / Student123!');
  console.log('Database Path:      backend/prisma/dev.db (SQLite)');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
