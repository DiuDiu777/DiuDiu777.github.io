import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'visitors.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    prepareStatements();
  }
  return db;
}

// Prepared statements cache
let stmts = {};

function prepareStatements() {
  stmts.insertVisit = db.prepare(`
    INSERT INTO visits (ip_hash, ip_prefix, page_path, referrer, user_agent, country, timestamp)
    VALUES (@ip_hash, @ip_prefix, @page_path, @referrer, @user_agent, @country, datetime('now'))
  `);

  stmts.insertIpLog = db.prepare(`
    INSERT INTO ip_log (ip_hash) VALUES (@ip_hash)
  `);

  stmts.getTotalVisits = db.prepare(`
    SELECT COUNT(*) as count FROM visits
  `);

  stmts.getUniqueIps = db.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as count FROM visits
  `);

  stmts.getUniqueIpsToday = db.prepare(`
    SELECT COUNT(DISTINCT ip_hash) as count FROM visits
    WHERE date(timestamp) = date('now')
  `);

  stmts.getVisitsToday = db.prepare(`
    SELECT COUNT(*) as count FROM visits
    WHERE date(timestamp) = date('now')
  `);

  stmts.getTopPages = db.prepare(`
    SELECT page_path, COUNT(*) as count
    FROM visits
    GROUP BY page_path
    ORDER BY count DESC
    LIMIT 20
  `);

  stmts.getPageBreakdown = db.prepare(`
    SELECT page_path,
           COUNT(*) as count,
           COUNT(DISTINCT ip_hash) as unique_ips,
           MAX(timestamp) as last_visit
    FROM visits
    GROUP BY page_path
    ORDER BY count DESC
  `);

  stmts.getRecentVisitors = db.prepare(`
    SELECT ip_prefix, page_path, user_agent, timestamp
    FROM visits
    ORDER BY timestamp DESC
    LIMIT 50
  `);

  stmts.getTimeline = db.prepare(`
    SELECT date(timestamp) as day, COUNT(*) as count
    FROM visits
    WHERE date(timestamp) >= date('now', @range)
    GROUP BY day
    ORDER BY day ASC
  `);

  stmts.getTimelineHours = db.prepare(`
    SELECT strftime('%Y-%m-%d %H:00:00', timestamp) as hour, COUNT(*) as count
    FROM visits
    WHERE timestamp >= datetime('now', @range)
    GROUP BY hour
    ORDER BY hour ASC
  `);

  stmts.cleanupOldIpLog = db.prepare(`
    DELETE FROM ip_log WHERE timestamp < datetime('now', '-1 minute')
  `);

  stmts.getRecentIpCount = db.prepare(`
    SELECT COUNT(*) as count FROM ip_log
    WHERE ip_hash = @ip_hash AND timestamp > datetime('now', '-1 second')
  `);

  stmts.cleanupOldVisits = db.prepare(`
    DELETE FROM visits WHERE timestamp < datetime('now', @retention)
  `);
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash    TEXT    NOT NULL,
      ip_prefix  TEXT    NOT NULL,
      page_path  TEXT    NOT NULL,
      referrer   TEXT    DEFAULT '',
      user_agent TEXT    DEFAULT '',
      country    TEXT    DEFAULT '',
      timestamp  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp);
    CREATE INDEX IF NOT EXISTS idx_visits_page      ON visits(page_path);
    CREATE INDEX IF NOT EXISTS idx_visits_ip_prefix ON visits(ip_prefix);

    CREATE TABLE IF NOT EXISTS ip_log (
      ip_hash    TEXT NOT NULL,
      timestamp  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ip_log_ts ON ip_log(timestamp);
  `);
}

/**
 * Hash an IP address with the secret salt for privacy-preserving storage.
 */
export function hashIp(ip, salt) {
  return createHash('sha256').update(ip + salt).digest('hex');
}

/**
 * Extract /24 subnet prefix from an IPv4 address.
 * For IPv6, take /48 prefix.
 */
export function getIpPrefix(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return parts.slice(0, 3).join('.') + '.0';
    }
  }
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + '::';
  }
  return ip;
}

/**
 * Record a page visit.
 */
export function recordVisit({ ip, page_path, referrer, user_agent, country, salt }) {
  const ipHash = hashIp(ip, salt);
  const ipPrefix = getIpPrefix(ip);
  const d = getDb();

  d.transaction(() => {
    stmts.insertVisit.run({
      ip_hash: ipHash,
      ip_prefix: ipPrefix,
      page_path: page_path || '/',
      referrer: referrer || '',
      user_agent: (user_agent || '').slice(0, 500),
      country: country || ''
    });
    stmts.insertIpLog.run({ ip_hash: ipHash });
  })();
}

/**
 * Check rate limit for an IP (max 5 writes per second).
 * Returns true if the rate limit is exceeded.
 */
export function isRateLimited(ip, salt) {
  const ipHash = hashIp(ip, salt);
  const d = getDb();
  const result = stmts.getRecentIpCount.get({ ip_hash: ipHash });
  return result.count >= 5;
}

/**
 * Get summary statistics.
 */
export function getSummary() {
  const d = getDb();
  return {
    total_visits: stmts.getTotalVisits.get().count,
    unique_ips: stmts.getUniqueIps.get().count,
    unique_ips_today: stmts.getUniqueIpsToday.get().count,
    visits_today: stmts.getVisitsToday.get().count,
    top_pages: stmts.getTopPages.all()
  };
}

/**
 * Get per-page breakdown.
 */
export function getPageBreakdown() {
  const d = getDb();
  return stmts.getPageBreakdown.all();
}

/**
 * Get recent visitors.
 */
export function getRecentVisitors(limit = 50) {
  const d = getDb();
  return stmts.getRecentVisitors.all().slice(0, limit);
}

/**
 * Get timeline data.
 */
export function getTimeline(period = 'day') {
  const d = getDb();
  let range = '-30 days';
  let rows;

  if (period === 'hour') {
    range = '-24 hours';
    rows = stmts.getTimelineHours.all({ range });
    return {
      labels: rows.map(r => r.hour),
      visits: rows.map(r => r.count),
      period: 'hour'
    };
  }

  rows = stmts.getTimeline.all({ range });
  return {
    labels: rows.map(r => r.day),
    visits: rows.map(r => r.count),
    period: 'day'
  };
}

/**
 * Clean up old IP log entries (call periodically).
 */
export function cleanupIpLog() {
  const d = getDb();
  stmts.cleanupOldIpLog.run();
}

/**
 * Clean up old visit records.
 */
export function cleanupOldVisits(retentionDays = 90) {
  const d = getDb();
  stmts.cleanupOldVisits.run({ retention: `-${retentionDays} days` });
}
