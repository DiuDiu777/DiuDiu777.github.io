import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  recordVisit,
  isRateLimited,
  getSummary,
  getPageBreakdown,
  getRecentVisitors,
  getTimeline,
  cleanupIpLog,
  cleanupOldVisits
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

const PORT = process.env.PORT || 3000;
const SALT = process.env.SALT || 'default-salt-change-me';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret-change-me';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ---- Middleware ----
// Trust the first proxy (needed for correct IP detection behind Railway/Nginx/etc.)
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // allow dashboard scripts
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Token']
}));

app.use(express.json({ limit: '2kb' }));

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' }
});
app.use('/api/', globalLimiter);

// ---- Token auth middleware ----
function requireToken(req, res, next) {
  const token = req.query.token || req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Provide ?token= or X-Admin-Token header.' });
  }
  next();
}

// ---- IP extraction helper ----
function getClientIp(req) {
  // Check common headers (order by trust)
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // Take the first (original client) IP in the chain
    return xForwardedFor.split(',')[0].trim();
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) return xRealIp.trim();

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ---- Routes ----

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Track a page visit
app.post('/api/track', (req, res) => {
  try {
    const ip = getClientIp(req);

    // Skip if IP is invalid
    if (!ip || ip === 'unknown') {
      return res.status(400).json({ error: 'Could not determine IP' });
    }

    // Rate limit check (per-IP write throttle)
    if (isRateLimited(ip, SALT)) {
      return res.status(429).json({ error: 'Rate limited' });
    }

    const { page_path, referrer, user_agent, country } = req.body;

    recordVisit({
      ip,
      page_path: page_path || '/',
      referrer: referrer || '',
      user_agent: user_agent || req.headers['user-agent'] || '',
      country: country || '',
      salt: SALT
    });

    res.status(201).json({ status: 'recorded' });
  } catch (err) {
    console.error('Track error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get summary stats
app.get('/api/stats/summary', requireToken, (req, res) => {
  try {
    const summary = getSummary();
    res.json(summary);
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get page breakdown
app.get('/api/stats/pages', requireToken, (req, res) => {
  try {
    const pages = getPageBreakdown();
    res.json(pages);
  } catch (err) {
    console.error('Pages error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent visitors
app.get('/api/stats/visitors', requireToken, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const visitors = getRecentVisitors(Math.min(limit, 200));
    res.json(visitors);
  } catch (err) {
    console.error('Visitors error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get timeline
app.get('/api/stats/timeline', requireToken, (req, res) => {
  try {
    const period = req.query.period || 'day';
    const timeline = getTimeline(period);
    res.json(timeline);
  } catch (err) {
    console.error('Timeline error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---- Static files (dashboard) ----
app.use(express.static(join(__dirname, 'public')));

// ---- Periodic cleanup ----
// Clean IP log every 5 minutes, old visits daily
setInterval(() => {
  try {
    cleanupIpLog();
  } catch (e) { /* ignore cleanup errors */ }
}, 5 * 60 * 1000);

setInterval(() => {
  try {
    cleanupOldVisits(90); // keep 90 days
  } catch (e) { /* ignore cleanup errors */ }
}, 24 * 60 * 60 * 1000);

// ---- Start ----
app.listen(PORT, () => {
  console.log(`Visitor tracker running on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`Dashboard: http://localhost:${PORT}/?token=${ADMIN_TOKEN}`);
});
