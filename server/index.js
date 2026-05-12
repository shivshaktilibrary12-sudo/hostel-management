const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Rate limiting ──
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { message: 'Too many requests. Please slow down.' } });
const loginLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: { message: 'Too many login attempts. Try again in 15 minutes.' } });
app.use('/api/', globalLimiter);
app.use('/api/auth/login', loginLimiter);

// ── Routes ──
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

// ── Google Sheets (optional) ──
let sheetsModule = null;
try { sheetsModule = require('./sheets'); logger.info('Google Sheets ready'); } catch(e) {}

const Member  = require('./models/Member');
const Receipt = require('./models/Receipt');
const Electric = require('./models/Electric');
const Salary  = require('./models/Salary');

async function autoSync() {
  if (!sheetsModule) return;
  try {
    const [members, receipts, electric, salaries] = await Promise.all([Member.find(), Receipt.find(), Electric.find(), Salary.find()]);
    await sheetsModule.syncAll({ members, receipts, electric, salaries });
  } catch(err) { logger.error('Sheets sync error', { error: err.message }); }
}

app.post('/api/sync-sheets', async (req, res) => {
  if (!sheetsModule) return res.status(503).json({ message: 'Google Sheets not configured.' });
  try { await autoSync(); res.json({ message: 'Synced!' }); } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Daily auto-backup ──
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
      exportedAt: new Date().toISOString(), version: '9.0',
      counts: { members: members.length, archived: archived.length, receipts: receipts.length },
      data: { hostels, members, archivedMembers: archived, receipts, electric, salaries },
    };
    const dateStr = new Date().toISOString().split('T')[0];
    const filepath = path.join(BACKUP_DIR, `hostel-backup-${dateStr}.json`);
    fs.writeFileSync(filepath, JSON.stringify(backup));
    // Keep only last 30
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('hostel-backup-')).sort();
    while (files.length > 30) { fs.unlinkSync(path.join(BACKUP_DIR, files.shift())); }
    logger.info('Daily backup saved', { file: filepath });
  } catch(err) { logger.error('Auto backup failed', { error: err.message }); }
}

app.use(notFound);
app.use(errorHandler);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management')
  .then(async () => {
    logger.info('MongoDB connected');
    const User   = require('./models/User');
    const Hostel = require('./models/Hostel');
    const count  = await User.countDocuments();
    if (count === 0) {
      await new Hostel({ name: 'Shiv Kripa Hostel', address: '1-B Shivkripa Colony Sajan Nagar, Indore', totalRooms: 20 }).save();
      await new User({ username: 'owner', password: 'owner123', name: 'Dinesh Singh Thakur', role: 'owner', mobile: '9826400917' }).save();
      logger.info('Default hostel + owner created — CHANGE PASSWORD IMMEDIATELY');
    }

    // Auto-notifications every hour
    const { generateAutoNotifications } = require('./services/notifications');
    setInterval(() => generateAutoNotifications(), 60 * 60 * 1000);

    // Daily backup at 2 AM
    const now = new Date();
    const next2am = new Date(now); next2am.setHours(2, 0, 0, 0);
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
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Mode: ${process.env.NODE_ENV || 'development'}`);

  // ── Keep-Alive Ping (prevents Render free tier sleep) ────────────────────
  // Pings the server every 10 minutes so it never goes idle
  if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
    const https = require('https');
    const pingUrl = process.env.RENDER_EXTERNAL_URL + '/api/health';
    setInterval(() => {
      https.get(pingUrl, (res) => {
        logger.debug(`Keep-alive ping: ${res.statusCode}`);
      }).on('error', (e) => {
        logger.debug('Keep-alive ping failed (non-critical):', e.message);
      });
    }, 10 * 60 * 1000); // every 10 minutes
    logger.info('Keep-alive ping scheduled every 10 minutes');
  }
});