const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Load optional prod deps gracefully
let helmet, compression;
try { helmet = require('helmet'); } catch(e) {}
try { compression = require('compression'); } catch(e) {}

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// ── Security & Performance ────────────────────────────────────────────────────
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for React
    crossOriginEmbedderPolicy: false,
  }));
}
if (compression) app.use(compression());

// ── CORS (allow all origins in dev, restrict in prod via env) ─────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true; // true = allow all

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 500,
  message: { message: 'Too many requests. Please slow down.' },
  standardHeaders: true, legacyHeaders: false,
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/', globalLimiter);
app.use('/api/auth/login', loginLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/hostels',       require('./routes/hostels'));
app.use('/api/rooms',         require('./routes/rooms'));
app.use('/api/members',       require('./routes/members'));
app.use('/api/receipts',      require('./routes/receipts'));
app.use('/api/electric',      require('./routes/electric'));
app.use('/api/salary',        require('./routes/salary'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/audit',         require('./routes/audit'));
app.use('/api/backup',        require('./routes/backup'));

// ── Google Sheets (optional backup only) ─────────────────────────────────────
let sheetsModule = null;
try { sheetsModule = require('./sheets'); logger.info('Google Sheets ready'); } catch(e) {}

const Member   = require('./models/Member');
const Receipt  = require('./models/Receipt');
const Electric = require('./models/Electric');
const Salary   = require('./models/Salary');

async function autoSync() {
  if (!sheetsModule) return;
  try {
    const [members, receipts, electric, salaries] = await Promise.all([
      Member.find(), Receipt.find(), Electric.find(), Salary.find()
    ]);
    await sheetsModule.syncAll({ members, receipts, electric, salaries });
  } catch(err) { logger.error('Sheets sync error', { error: err.message }); }
}

app.post('/api/sync-sheets', async (req, res) => {
  if (!sheetsModule) return res.status(503).json({ message: 'Google Sheets not configured.' });
  try { await autoSync(); res.json({ message: 'Synced!' }); }
  catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Serve React Build (Production) ────────────────────────────────────────────
const clientBuild = path.join(__dirname, '../client/build');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild, {
    maxAge: '1d',
    etag: true,
  }));
  // All non-API routes serve React app
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'API route not found' });
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
  logger.info('Serving React build from /client/build');
} else {
  logger.info('No React build found. Run "npm run build" in /client to enable production mode.');
}

// ── Error Handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Daily Backup ──────────────────────────────────────────────────────────────
async function runAutoBackup() {
  try {
    const BACKUP_DIR = path.join(__dirname, 'backups');
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const ArchivedMember = require('./models/ArchivedMember');
    const Hostel = require('./models/Hostel');
    const [members, archived, receipts, electric, salaries, hostels] = await Promise.all([
      Member.find().lean(), ArchivedMember.find().lean(), Receipt.find().lean(),
      Electric.find().lean(), Salary.find().lean(), Hostel.find().lean(),
    ]);
    const backup = {
      exportedAt: new Date().toISOString(), version: '10.0',
      counts: { members: members.length, receipts: receipts.length },
      data: { hostels, members, archivedMembers: archived, receipts, electric, salaries },
    };
    const dateStr = new Date().toISOString().split('T')[0];
    const filepath = path.join(BACKUP_DIR, `hostel-backup-${dateStr}.json`);
    fs.writeFileSync(filepath, JSON.stringify(backup));
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('hostel-backup-')).sort();
    while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    logger.info('Daily backup saved', { file: `hostel-backup-${dateStr}.json` });
  } catch(err) { logger.error('Auto backup failed', { error: err.message }); }
}

// ── Database & Bootstrap ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management')
  .then(async () => {
    logger.info('MongoDB connected');

    const User   = require('./models/User');
    const Hostel = require('./models/Hostel');
    const count  = await User.countDocuments();
    if (count === 0) {
      const hostel = await new Hostel({
        name: 'Shiv Kripa Hostel',
        address: '1-B Shivkripa Colony Sajan Nagar, Indore',
        totalRooms: 20
      }).save();
      await new User({
        username: 'owner',
        password: 'owner123',
        name: 'Dinesh Singh Thakur',
        role: 'owner',
        mobile: '9826400917',
      }).save();
      logger.info('Default hostel + owner created — CHANGE PASSWORD IMMEDIATELY at /login');
    }

    // Auto notifications every hour
    const { generateAutoNotifications } = require('./services/notifications');
    setInterval(() => generateAutoNotifications().catch(() => {}), 60 * 60 * 1000);

    // Daily backup at 2 AM
    const now = new Date();
    const next2am = new Date(now);
    next2am.setHours(2, 0, 0, 0);
    if (next2am <= now) next2am.setDate(next2am.getDate() + 1);
    const msUntil2am = next2am - now;
    setTimeout(() => {
      runAutoBackup();
      setInterval(runAutoBackup, 24 * 60 * 60 * 1000);
    }, msUntil2am);
    logger.info(`Daily backup scheduled in ${Math.round(msUntil2am / 3600000)}h`);
  })
  .catch(err => logger.error('MongoDB error', { error: err.message }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
