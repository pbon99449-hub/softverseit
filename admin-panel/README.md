# SoftVerse IT - Admin Panel

SoftVerse IT Institute website kar jonno ek purnaanga **Admin Panel** (Node.js + Express + MongoDB).
Mul site er motoi **dark navy (#0f1c3a) + teal (#00b894)** theme, **Hind Siliguri** Bangla font byabohar kora hoyeche.

## Tech Stack
- **Backend:** Node.js + Express.js
- **Database:** SQLite (better-sqlite3) — file-based, no server install needed. Data file: `admin-panel/data/softverse.sqlite`
- **Auth:** JWT + bcryptjs
- **Frontend:** Plain HTML/CSS/JS (mul site er sathe consistency)

## Folder structure
```
admin-panel/
  server.js              Express server (API + static file serve)
  seed.js                First Admin account (npm run seed)
  .env / .env.example    Environment variables
  config/db.js           MongoDB connection
  models/                Admin, Enrollment, Result
  middleware/auth.js     JWT protect
  controllers/           auth, enrollment, result, dashboard
  routes/                Express routes
  public/                Admin UI
    login.html           Login
    index.html           Dashboard
    enrollments.html     Enrollment CRUD
    results.html         Result CRUD
```

## Setup & Run

### 1) MongoDB chalun
Local MongoDB chalun (default port 27017) - https://www.mongodb.com/try/download/community athoba MongoDB Atlas.

### 2) .env
`admin-panel/.env` file-e MONGODB_URI, JWT_SECRET, ADMIN_EMAIL/PASSWORD thik koren.

### 3) Install
```bash
cd admin-panel
npm install
```

### 4) First Admin
```bash
npm run seed
```

### 5) Start
```bash
npm start
```
Browse: http://localhost:5000

## API summary
| Method | Endpoint | Details | Auth |
|--------|----------|---------|------|
| POST | /api/auth/login | login -> JWT | - |
| GET | /api/auth/me | current admin | yes |
| GET | /api/dashboard/stats | dashboard stats | yes |
| GET | /api/enrollments | list (search/status/course/page) | yes |
| POST | /api/enrollments | new enrollment (from main site) | - |
| PATCH | /api/enrollments/:id/status | status update | yes |
| PUT/DELETE | /api/enrollments/:id | update/delete | yes |
| GET | /api/results | list results | yes |
| GET | /api/results/public?roll=&reg= | main site lookup | - |
| POST/PUT/DELETE | /api/results | result CRUD | yes |

## Connecting to main website (optional)
- Enroll form -> POST /api/enrollments (replaces SHEET_URL in main.js)
- Result lookup -> GET /api/results/public?roll=&reg= (replaces API_URL in result.html)

> Note: admin panel result fields are camelCase (name, roll, total, result...).
> Main result.html uses Google Sheet format (Name, Roll, Total...). Map fields when switching.
