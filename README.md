# CodeMaster LMS — Full-Stack SQLite Ta'lim Platformasi

**CodeMaster LMS** — zamonaviy, xavfsiz va to‘liq SQLite ma'lumotlar bazasida ishlovchi ta'lim platformasi (Learning Management System). Ushbu loyiha tashqi ma'lumotlar bazalarisiz (PostgreSQL, MySQL, MongoDB yoki Redis talab etilmaydi) faqat bitta ixcham, ishonchli **SQLite** fayli orqali barcha jarayonlarni boshqaradi.

---

## 🚀 Texnologiyalar Staki

### Frontend:
- **HTML5 & CSS3**: Zamonaviy, toza, moslashuvchan (Responsive) interfeys.
- **Vanilla JavaScript**: Tashqi og‘ir kutubxonalarsiz, sof JavaScript bilan yaratilgan SPA (Single Page Application).
- **Fetch API**: RESTful API bilan to‘liq asinxron aloqa va sessiya xavfsizligi.
- **Chart.js**: Boshqaruv paneli (Dashboard) uchun interaktiv grafik va diagrammalar.
- *Barcha frontend kodlari bitta `frontend/index.html` faylida jamlangan.*

### Backend:
- **Node.js & Express.js**: Modulli arxitektura, marshrutlash (routing) va middleware xavfsizlik qatlami.
- **Prisma ORM**: SQLite bilan mukammal integratsiya, avtomatik schema migratsiyasi va tiplash.
- **bcryptjs**: Foydalanuvchi parollarini xavfsiz xesh qilish.
- **Nodemailer**: Gmail SMTP orqali bir martalik 6 xonali OTP kodlar va xabarnomalar yuborish (mavjud bo‘lmaganda avtomatik Dev Simulyator rejimida ishlaydi).
- **Sessiya Autentifikatsiyasi**: `express-session` orqali xavfsiz `httpOnly` cookie sessiyalar.

### Database:
- **ONLY SQLite** (`backend/prisma/dev.db`)
- Barcha jadvallar, munosabatlar va indekslar SQLite ichida saqlanadi.
- PostgreSQL, MySQL, MongoDB, Redis va boshqa tizimlardan umuman foydalanilmaydi.

---

## 🗄️ SQLite Database Modellar (16 ta model)

Prisma schema orqali barcha modellar o‘zaro xorijiy kalitlar (Foreign Keys) va indekslar bilan bog‘langan:

1. **User**: Foydalanuvchilar (`ADMIN`, `INSTRUCTOR`, `STUDENT`).
2. **Course**: Kurslar (nomi, slug, daraja, narx, muallif).
3. **Module**: Kurs modullari (tartib raqami, sarlavha).
4. **Lesson**: Darslar (kontent, video URL, erkin ko‘rish ruxsati).
5. **Enrollment**: Kursga yozilish va umumiy o‘zlashtirish foizi (0-100%).
6. **LessonProgress**: Talabaning har bir dars bo‘yicha o‘zlashtirish holati.
7. **Assignment**: Amaliy uyga vazifalar va maksimal ball.
8. **Submission**: Talabalar topshirgan yechimlar, ball va o‘qituvchi taqrizi.
9. **Quiz**: Modul bo‘yicha imtihon testlari (o‘tish bali va vaqt limiti).
10. **Question**: Test savollari, variantlar (JSON), to‘g‘ri javob va tushuntirish.
11. **QuizAttempt**: Talabaning test urinishlari, to‘plagan bali va natijasi.
12. **Certificate**: Kursni 100% tamomlaganda beriladigan noyob kodli sertifikat.
13. **Notification**: Foydalanuvchilar uchun bildirishnomalar.
14. **EmailVerification**: Vaqtinchalik email OTP kodlari jadvali.
15. **PasswordResetToken**: Parolni tiklash uchun xesh tokenlar.
16. **AuditLog**: SQLite tizim harakatlari jurnali (xavfsizlik va nazorat).

---

## 🔐 Vaqtinchalik Email Tasdiqlash (OTP Talablari)

Email tasdiqlash kodi to‘liq SQLite `EmailVerification` jadvalida boshqariladi:
- **OTP amal qilish muddati**: 5 daqiqa.
- **Qayta yuborish oralig‘i**: 60 soniya (Cooldown taymer).
- **Maksimal urinishlar soni**: 5 ta (xato kiritilganda bloklanadi va yangi kod so‘raladi).
- **Xesh ko‘rinishida saqlash**: OTP oddiy matn holida emas, SHA-256 xeshi ko‘rinishida saqlanadi.
- **Avtomatik tozalash**: Kod tasdiqlangach darhol o‘chiriladi. Shuningdek, fondagi avtomatik xizmat (cleanup scheduler) muddati o‘tgan yozuvlarni tozalab boradi.
- **Bitta faol OTP**: Bir email uchun faqat bitta faol OTP ruxsat etiladi; yangisi yaratilganda eskisi darhol bekor qilinadi.

---

## 🛡️ SQLite Xavfsizlik Qoidalari

- `PRAGMA foreign_keys = ON;` va `PRAGMA journal_mode = WAL;` ulanishda yoqilgan.
- Kritik operatsiyalar (ro‘yxatdan o‘tish + OTP, kursni tamomlash + sertifikat yaratish) SQLite tranzaksiyalar (`prisma.$transaction`) orqali bajariladi.
- `backend/prisma/dev.db` fayli server middleware orqali frontendga mutlaqo yopiq qilingan.
- **Zaxira nusxalash (Backup)**: Admin paneldagi tugma yoki `/api/backup/create` orqali SQLite atomik zaxira nusxasi (`backend/backups/dev_backup_<sana>.db`) yaratiladi.

---

## 📂 Loyiha Tuzilishi

```text
codemaster-lms/
  frontend/
    index.html               # Yagona to'liq HTML5 + CSS3 + Vanilla JS + Chart.js fayli
  backend/
    backups/                 # SQLite avtomatik zaxira nusxalari (.db)
    prisma/
      schema.prisma          # 16 ta modeldan iborat SQLite Prisma sxemasi
      dev.db                 # Asosiy SQLite ma'lumotlar bazasi fayli
      seed.js                # Boshlang'ich test ma'lumotlari (Admin, kurslar, darslar)
    src/
      config/
        db.js                # Prisma Client & SQLite PRAGMAs
        session.js           # Xavfsiz HTTP sessiya sozlamalari
      controllers/
        analyticsController.js
        assignmentController.js
        authController.js
        backupController.js
        certificateController.js
        courseController.js
        enrollmentController.js
        lessonController.js
        notificationController.js
        quizController.js
      middleware/
        authMiddleware.js    # Sessiya & rol ruxsatlari (ADMIN, INSTRUCTOR, STUDENT)
        validationMiddleware.js # Server tomondagi validatsiya
      routes/
        analyticsRoutes.js
        assignmentRoutes.js
        authRoutes.js
        backupRoutes.js
        certificateRoutes.js
        courseRoutes.js
        enrollmentRoutes.js
        lessonRoutes.js
        notificationRoutes.js
        quizRoutes.js
      services/
        auditService.js      # AuditLog yozish xizmati
        emailService.js      # Nodemailer Gmail SMTP & Dev Logger
        otpCleanupService.js # Muddati tugagan OTP larni tozalash
      utils/
        hash.js              # bcrypt & SHA-256 xesh utilitlari
        otp.js               # 6 xonali OTP generatori va vaqt hisobi
    server.js                # Express asosiy server fayli
    package.json             # Bog'liqliklar
    .env                     # Muhit o'zgaruvchilari
    .env.example             # Namunaviy konfiguratsiya
  README.md
```

---

## ⚡ O‘rnatish va Ishga Tushirish

### 1. Bog‘liqliklarni o‘rnatish:
```bash
cd backend
npm install
```

### 2. SQLite ma'lumotlar bazasini yaratish va migratsiya:
```bash
npx prisma db push
```

### 3. Boshlang‘ich ma'lumotlarni kiritish (Seed):
```bash
node prisma/seed.js
```

### 4. Serverni ishga tushirish:
```bash
npm start
```
Server `http://localhost:5000` manzilida ishga tushadi va frontend interfeysini avtomatik taqdim etadi.

---

## 🔑 Demo Akkauntlar (Kirish ma'lumotlari)

Tizimda sinovdan o‘tkazish uchun yuqori panelda **1-Click Test Kirish** tugmalari mavjud yoki qo‘lda kiriting:

| Rol | Email | Parol |
| :--- | :--- | :--- |
| **Admin** | `admin@codemaster.uz` | `Admin123!` |
| **Instructor** | `instructor@codemaster.uz` | `Instructor123!` |
| **Student** | `student@codemaster.uz` | `Student123!` |

---

## 📧 Gmail SMTP Sozlash (Ixtiyoriy)

Agar haqiqiy Gmail orqali emailingizga xatlar borishini xohlasangiz:
1. Google hisobingizda 2 bosqichli tasdiqlashni yoqing.
2. [Google App Passwords](https://myaccount.google.com/apppasswords) bo‘limiga o‘tib, yangi 16 xonali ilova parolini oling.
3. `backend/.env` faylini oching va quyidagilarni kiriting:
```env
SMTP_USER="sizning-emailingiz@gmail.com"
SMTP_PASS="xxxx xxxx xxxx xxxx"
```
*Agar SMTP ko‘rsatilmasa, tizim avtomatik ravishda Dev rejimida ishlaydi: OTP kod terminalda va ekranda chiqariladi.*
