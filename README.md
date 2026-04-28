# 🏠 Hostel Management System v10

A production-ready MERN stack hostel management system.

---

## 🚀 DEPLOYMENT OPTIONS

### Option A — Render.com (FREE, Recommended — Access from any device)

**Step 1 — MongoDB Atlas (Free Cloud Database)**
1. Go to https://www.mongodb.com/atlas
2. Sign up for free → Create a cluster (free tier)
3. Click "Connect" → "Connect your application"
4. Copy the connection string (looks like: `mongodb+srv://user:pass@cluster.mongodb.net/hostel`)
5. Replace `<password>` with your actual password
6. **Save this string — you'll need it in step 3**

**Step 2 — Push code to GitHub**
1. Go to https://github.com → Create account → New Repository
2. Name it `hostel-management` → Create
3. On your PC, open Command Prompt in the hostel-management folder:
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hostel-management.git
git push -u origin main
```

**Step 3 — Deploy on Render**
1. Go to https://render.com → Sign up with GitHub
2. Click "New +" → "Web Service"
3. Connect your GitHub repo: `hostel-management`
4. Fill in these settings:
   - **Name:** hostel-management
   - **Region:** Singapore (closest to India)
   - **Build Command:** `npm install --prefix server && npm install --prefix client && npm run build --prefix client`
   - **Start Command:** `node server/index.js`
   - **Plan:** Free
5. Add Environment Variables (click "Add Environment Variable"):
   - `MONGODB_URI` = your Atlas connection string from Step 1
   - `JWT_SECRET` = any long random text (e.g. `myHostelSuperSecretKey2026dinesh`)
   - `NODE_ENV` = `production`
   - `PORT` = `10000`
6. Click "Create Web Service"
7. Wait 5-10 minutes for build to complete
8. Your app will be live at: `https://hostel-management.onrender.com`

**Access from any device:** Phone, tablet, laptop — just open the URL in any browser!

---

### Option B — Railway.app (Alternative Free Hosting)

1. Go to https://railway.app → Sign up with GitHub
2. New Project → Deploy from GitHub repo
3. Add environment variables (same as Render above)
4. Railway auto-detects Node.js — just set the Start Command: `node server/index.js`
5. Add MongoDB plugin or use Atlas URI

---

### Option C — Local Network (Access on home WiFi)

Run on your PC and access from any phone/tablet on the same WiFi:

1. Run `start.bat`
2. Find your PC's local IP: Open Command Prompt → type `ipconfig` → find "IPv4 Address" (e.g. `192.168.1.5`)
3. On any phone/tablet on same WiFi, open browser → go to `http://192.168.1.5:3000`

---

## 🔐 Default Login

| Username | Password | Role |
|---|---|---|
| `owner` | `owner123` | Full access |

⚠️ **Change the password immediately after first login!**

---

## ⚙️ Local Development

```bash
# Install all dependencies
npm run install-all

# Start development (two terminals)
npm run dev-server     # Terminal 1 — starts backend on :5000
npm run dev-client     # Terminal 2 — starts frontend on :3000

# OR just double-click start.bat on Windows
```

---

## 🏗️ Project Structure

```
hostel-management/
├── server/                  # Node.js + Express backend
│   ├── controllers/         # Business logic (memberController, receiptController)
│   ├── middleware/          # auth.js, errorHandler.js
│   ├── models/              # MongoDB schemas
│   ├── routes/              # API route definitions
│   ├── services/            # audit.js, notifications.js
│   ├── utils/               # logger.js, validate.js
│   ├── backups/             # Auto daily backups (JSON)
│   ├── index.js             # Server entry point
│   └── .env                 # Environment variables
│
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable: SearchBar, Pagination, etc.
│   │   ├── hooks/           # useAutoLogout, etc.
│   │   ├── pages/           # All page components
│   │   ├── utils/           # api.js
│   │   └── App.jsx          # Main app with routing
│   └── build/               # Production build (created by npm run build)
│
├── package.json             # Root — build & deploy scripts
├── render.yaml              # Render.com deployment config
└── README.md
```

---

## 📱 Features

- 🔐 Two-role login (Owner / Manager)
- 👥 Member registration with unique ID (SS/26-27/001)
- 🏠 20 rooms with color-coded occupancy
- 🧾 Receipts with PDF print (SB/year/number format)
- 📑 Final billing per room
- ⚡ Monthly electric readings
- 🚔 Police verification form (Hindi)
- 📊 Dashboard with revenue charts
- 📈 Reports with Excel export
- 💰 Salary & expenses
- 🗂️ Archive system for vacated members
- 🔔 Auto notifications (due alerts, expiry alerts)
- 📋 Audit log (who did what, when)
- 💾 Daily automatic backup
- 🔍 Search by name / room / mobile across all pages

---

## 🔒 Security Features

- JWT authentication (12h expiry)
- Auto logout after 2h inactivity
- Password hashing (bcrypt)
- Rate limiting (prevent brute force)
- Input validation (10-digit mobile, 12-digit Aadhar)
- Centralized error handling
- Audit trail for all actions

---

## 🆘 Troubleshooting

| Problem | Fix |
|---|---|
| App won't start | Check MongoDB is running. Check `.env` has correct `MONGODB_URI` |
| Login not working | Default: owner / owner123 |
| Render build fails | Check build logs — usually a missing env variable |
| Can't access from phone | Check you're on same WiFi, use PC's local IP |
| Atlas connection refused | Whitelist `0.0.0.0/0` in Atlas Network Access |
