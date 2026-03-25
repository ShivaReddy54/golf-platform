# ⛳ GolfGives — Golf Charity Subscription Platform

A full-stack web app for golf score tracking, monthly prize draws, and charity contributions.
Built for the Digital Heroes Full-Stack Trainee Selection Process.

---

## 🚀 Quick Start

### 1. Start the backend
```bash
node server.js
```
Server runs on: **https://golf-platform-b8mz.onrender.com**

### 2. Open the frontend
Open `index.html` in your browser (or serve with any static server):
```bash
# Option A: just open the file
open index.html

# Option B: use npx serve
npx serve .
```

---

## 📁 Project Structure

```
golf-platform/
├── server.js      ← Node.js backend (in-memory DB, REST API)
├── index.html     ← Single-page frontend
├── style.css      ← All styles
├── app.js         ← All frontend JavaScript
├── package.json
└── README.md
```

---

## 🔐 Default Credentials

| Role  | Email            | Password   |
|-------|------------------|------------|
| Admin | admin@golf.com   | admin123   |

---

## ✅ Features Implemented

- **Subscription System** — Monthly (£10) / Yearly (£100) plans
- **Score Management** — Enter Stableford scores (1–45), rolling 5-score history
- **Draw Engine** — Random or algorithmic monthly draws, 5/4/3-match prize tiers
- **Prize Pools** — 40% jackpot (rollover), 35% 4-match, 25% 3-match
- **Charity System** — 4 charities, selectable at signup, min 10% contribution
- **User Dashboard** — Scores, draws history, charity settings, account settings
- **Admin Panel** — User management, draw control, winner verification, stats
- **Auth** — Token-based login/signup, protected routes

---

## 🛠 Tech Stack

- **Backend:** Node.js (zero dependencies, pure `http` module)
- **Database:** In-memory (JavaScript objects — resets on restart)
- **Frontend:** HTML + CSS + Vanilla JS (single file each)
- **Fonts:** Google Fonts (Syne + DM Sans)

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/signup | Register user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/me | Get current user |
| POST | /api/scores | Add score |
| DELETE | /api/scores/:idx | Remove score |
| PUT | /api/me | Update profile/charity |
| GET | /api/charities | List charities |
| GET | /api/draws | List draws |
| GET | /api/pool | Current prize pool |
| GET | /api/admin/users | All users (admin) |
| GET | /api/admin/stats | Platform stats (admin) |
| POST | /api/admin/draw | Run a draw (admin) |
| PUT | /api/admin/users/:id | Toggle user status (admin) |
