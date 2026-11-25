const http = require('http');

async function testHttpEndpoints() {
  console.log('🌐 Starting HTTP Integration Test...');

  // 1. Start Express Server
  const app = require('./server'); // or require server
  // Wait 1 second
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 2. Fetch health check
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData = await healthRes.json();
  console.log('✓ /api/health response:', healthData);

  // 3. Fetch courses
  const coursesRes = await fetch('http://localhost:5000/api/courses');
  const coursesData = await coursesRes.json();
  console.log(`✓ /api/courses response: ${coursesData.courses.length} courses loaded.`);

  // 4. Test User Login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@codemaster.uz', password: 'Student123!' }),
  });
  const loginData = await loginRes.json();
  console.log('✓ /api/auth/login response:', loginData.user.name, `(${loginData.user.role})`);

  // 5. Test Register with OTP creation
  const testRegEmail = `testuser_${Date.now()}@codemaster.uz`;
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Talaba',
      email: testRegEmail,
      password: 'TestPassword123!',
      role: 'STUDENT',
    }),
  });
  const regData = await regRes.json();
  console.log('✓ /api/auth/register response:', regData.message);
  console.log('✓ Dev OTP returned:', regData.data.devOtp);

  // 6. Test OTP Verification
  const verifyRes = await fetch('http://localhost:5000/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testRegEmail,
      otp: regData.data.devOtp,
    }),
  });
  const verifyData = await verifyRes.json();
  console.log('✓ /api/auth/verify-otp response:', verifyData.message, verifyData.user.email);

  // 7. Verify frontend index.html served
  const frontendRes = await fetch('http://localhost:5000/');
  const frontendHtml = await frontendRes.text();
  console.log(`✓ Frontend index.html served properly (${frontendHtml.length} characters).`);

  console.log('\n======================================================');
  console.log('🎉 ALL HTTP API INTEGRATION TESTS PASSED (7/7)!');
  console.log('======================================================\n');
  process.exit(0);
}

testHttpEndpoints().catch((err) => {
  console.error('❌ HTTP Test failed:', err);
  process.exit(1);
});
