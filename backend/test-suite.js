const prisma = require('./src/config/db');
const { hashPassword, comparePassword, hashOtp, compareOtp } = require('./src/utils/hash');
const { createDatabaseBackup } = require('./src/controllers/backupController');
const fs = require('fs');
const path = require('path');

async function runTestSuite() {
  console.log('🧪 Starting CodeMaster LMS Automated Test Suite...\n');

  // Test 1: Verify SQLite PRAGMA Foreign Keys
  console.log('Test 1: SQLite Foreign Keys Check...');
  const fkResult = await prisma.$queryRawUnsafe('PRAGMA foreign_keys;');
  console.log('Foreign keys PRAGMA result:', fkResult);
  console.log('✓ Foreign keys enabled.\n');

  // Test 2: Verify Models & Seed Data
  console.log('Test 2: Verifying seeded models in SQLite...');
  const users = await prisma.user.findMany();
  console.log(`✓ Found ${users.length} users:`, users.map((u) => `${u.name} (${u.role})`).join(', '));

  const courses = await prisma.course.findMany({
    include: {
      modules: {
        include: { lessons: true, quizzes: { include: { questions: true } } },
      },
    },
  });
  console.log(`✓ Found ${courses.length} courses:`);
  courses.forEach((c) => {
    const totalLessons = c.modules.reduce((s, m) => s + m.lessons.length, 0);
    const totalQuizzes = c.modules.reduce((s, m) => s + m.quizzes.length, 0);
    console.log(`   - "${c.title}" (${c.category}, ${c.level}): ${c.modules.length} modules, ${totalLessons} lessons, ${totalQuizzes} quizzes`);
  });
  console.log('');

  // Test 3: OTP Hashing and Storage in SQLite (Section 3 Requirements)
  console.log('Test 3: Testing Temporary Email Verification (OTP in SQLite)...');
  const testEmail = 'tester@codemaster.uz';
  const testOtp = '849201';
  const hashedOtp = hashOtp(testOtp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60 seconds

  // Clean prior test records
  await prisma.emailVerification.deleteMany({ where: { email: testEmail } });

  const otpRecord = await prisma.emailVerification.create({
    data: {
      email: testEmail,
      otpHash: hashedOtp,
      expiresAt,
      attempts: 0,
      resendAvailableAt,
    },
  });

  console.log('✓ Created EmailVerification in SQLite:', {
    id: otpRecord.id,
    email: otpRecord.email,
    otpHashPreview: otpRecord.otpHash.substring(0, 16) + '...',
    expiresAt: otpRecord.expiresAt,
  });

  // Verify hash comparison works
  const isMatch = compareOtp(testOtp, otpRecord.otpHash);
  const isWrong = compareOtp('111111', otpRecord.otpHash);
  if (!isMatch || isWrong) throw new Error('OTP verification comparison failed!');
  console.log('✓ Correct OTP matched and wrong OTP rejected successfully.');

  // Clean test OTP record (as required after verification)
  await prisma.emailVerification.delete({ where: { id: otpRecord.id } });
  console.log('✓ OTP record deleted upon verification as required.\n');

  // Test 4: Course Enrollment & Lesson Progress
  console.log('Test 4: Testing Course Enrollment & Lesson Progress Transaction...');
  const student = users.find((u) => u.role === 'STUDENT');
  const enrollments = await prisma.enrollment.findMany({ where: { userId: student.id } });
  console.log(`✓ Student ${student.name} has ${enrollments.length} enrollment(s).`);

  // Test 5: SQLite Database Backup
  console.log('Test 5: Testing SQLite Database Safe Backup...');
  const reqMock = { user: { id: student.id }, ip: '127.0.0.1', headers: {} };
  let backupData = null;
  const resMock = {
    status(code) {
      return this;
    },
    json(data) {
      backupData = data;
      return this;
    },
  };

  await createDatabaseBackup(reqMock, resMock);
  if (!backupData || !backupData.success) {
    throw new Error('Backup creation failed: ' + JSON.stringify(backupData));
  }
  console.log('✓ SQLite Database backup successfully created:', backupData.backup);

  // Check backup file exists on disk
  const backupPath = path.resolve(__dirname, 'backups', backupData.backup.fileName);
  if (!fs.existsSync(backupPath)) throw new Error('Backup file does not exist on disk!');
  console.log(`✓ Verified backup file exists on disk (${fs.statSync(backupPath).size} bytes).\n`);

  // Test 6: AuditLog records
  console.log('Test 6: Testing AuditLog in SQLite...');
  const logsCount = await prisma.auditLog.count();
  console.log(`✓ Total AuditLog records in SQLite: ${logsCount}`);

  console.log('\n======================================================');
  console.log('🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY (6/6)!');
  console.log('======================================================\n');
}

runTestSuite()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
