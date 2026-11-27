import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Request } from 'express';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'simpandadu.db');

export interface DbAdminAccount {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string;
  email_verified: number;
  pending_email: string | null;
  phone: string;
  jabatan: string;
  role: string;
  avatar_file: string | null;
  require_email_login_approval: number;
  notify_on_login_success: number;
  notify_on_security_change: number;
  login_approval_ttl_minutes: number;
  approval_policy: 'new_device' | 'every_login';
  created_at: string;
  updated_at: string;
}

export interface DbLoginChallenge {
  id: string;
  username: string;
  admin_email: string;
  poll_secret_hash: string;
  approve_token_hash: string;
  deny_token_hash: string;
  device_fingerprint: string;
  device_label: string;
  browser_name: string;
  os_name: string;
  ip_address: string;
  location_estimate: string;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'completed';
  trusted_device_token: string | null;
  decision_reason: string;
  expires_at: number;
  decided_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DbEmailVerificationToken {
  id: string;
  username: string;
  new_email: string;
  token_hash: string;
  code_hash: string;
  expires_at: number;
  used_at: string | null;
  created_at: string;
}

export interface DbTrustedDevice {
  id: string;
  username: string;
  token_hash: string;
  device_label: string;
  ip_address: string;
  location_estimate: string;
  last_used_at: string;
  created_at: string;
  revoked_at: string | null;
}

export type SecurityNotificationType =
  | 'login_attempt'
  | 'login_confirmation_request'
  | 'login_success'
  | 'login_denied'
  | 'profile_updated'
  | 'password_changed'
  | 'security_alert';

export interface DbSecurityNotification {
  id: string;
  username: string;
  type: SecurityNotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  metadata_json: string;
  is_read: number;
  created_at: string;
}

export interface DbActivityLog {
  id: string;
  username: string;
  event_type: string;
  description: string;
  device_label: string;
  ip_address: string;
  location_estimate: string;
  status: 'Berhasil' | 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Kedaluwarsa' | 'Peringatan';
  created_at: string;
}

export interface DbEmailOutboxLog {
  id: string;
  recipient_email: string;
  subject: string;
  category: string;
  delivery_mode: 'smtp' | 'local_preview';
  delivery_status: 'sent' | 'failed' | 'preview_only';
  error_message: string;
  preview_html: string;
  preview_text: string;
  challenge_id: string | null;
  created_at: string;
}

let dbInstance: DatabaseSync | null = null;

export function getSecurityDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const db = new DatabaseSync(DB_FILE);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS admin_accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      email_verified INTEGER NOT NULL DEFAULT 0,
      pending_email TEXT,
      phone TEXT NOT NULL DEFAULT '',
      jabatan TEXT NOT NULL DEFAULT 'Administrator Balai Desa',
      role TEXT NOT NULL DEFAULT 'Administrator Balai Desa',
      avatar_file TEXT,
      require_email_login_approval INTEGER NOT NULL DEFAULT 1,
      notify_on_login_success INTEGER NOT NULL DEFAULT 1,
      notify_on_security_change INTEGER NOT NULL DEFAULT 1,
      login_approval_ttl_minutes INTEGER NOT NULL DEFAULT 10,
      approval_policy TEXT NOT NULL DEFAULT 'new_device',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_challenges (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      poll_secret_hash TEXT NOT NULL,
      approve_token_hash TEXT UNIQUE NOT NULL,
      deny_token_hash TEXT UNIQUE NOT NULL,
      device_fingerprint TEXT NOT NULL,
      device_label TEXT NOT NULL,
      browser_name TEXT NOT NULL,
      os_name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      location_estimate TEXT NOT NULL,
      status TEXT NOT NULL,
      trusted_device_token TEXT,
      decision_reason TEXT NOT NULL DEFAULT '',
      expires_at INTEGER NOT NULL,
      decided_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      new_email TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trusted_devices (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      device_label TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      location_estimate TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS security_notifications (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      device_label TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      location_estimate TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_outbox_logs (
      id TEXT PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL,
      delivery_mode TEXT NOT NULL,
      delivery_status TEXT NOT NULL,
      error_message TEXT NOT NULL DEFAULT '',
      preview_html TEXT NOT NULL DEFAULT '',
      preview_text TEXT NOT NULL DEFAULT '',
      challenge_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  dbInstance = db;
  return db;
}

export function sha256Hex(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function formatWaktuIndonesia(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  return `${d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Jakarta',
  })} WIB`;
}

export function maskEmailAddress(email: string): string {
  const clean = email.trim();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 1) return clean;
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${'*'.repeat(Math.max(3, local.length - shown.length))}@${domain}`;
}

export function parseDeviceContext(req: Request): {
  userAgent: string;
  browserName: string;
  osName: string;
  deviceLabel: string;
  ipAddress: string;
  deviceFingerprint: string;
} {
  const ua = String(req.headers['user-agent'] || 'Perangkat Tidak Dikenal');
  let browserName = 'Browser Lainnya';
  if (/Edg\//i.test(ua)) browserName = 'Microsoft Edge';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browserName = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browserName = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browserName = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browserName = 'Apple Safari';
  else if (/curl/i.test(ua)) browserName = 'CLI / HTTP Client';

  let osName = 'Sistem Tidak Dikenal';
  if (/Windows NT/i.test(ua)) osName = 'Windows';
  else if (/Android/i.test(ua)) osName = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) osName = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(ua)) osName = 'macOS';
  else if (/Linux/i.test(ua)) osName = 'Linux';

  const formFactor = /Mobile|Android|iPhone/i.test(ua)
    ? 'Mobile'
    : /iPad|Tablet/i.test(ua)
      ? 'Tablet'
      : 'Desktop';

  const deviceLabel = `${browserName} · ${osName} (${formFactor})`;

  const xff = String(req.headers['x-forwarded-for'] || '');
  const rawIp = xff ? xff.split(',')[0].trim() : String(req.ip || req.socket.remoteAddress || '127.0.0.1');
  const ipAddress = rawIp.replace(/^::ffff:/, '');
  const deviceFingerprint = sha256Hex(`${ua}|${ipAddress}`).slice(0, 24);

  return {
    userAgent: ua,
    browserName,
    osName,
    deviceLabel,
    ipAddress,
    deviceFingerprint,
  };
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  return net.isIP(ip) === 0;
}

export async function estimateLoginLocation(req: Request, ipAddress: string): Promise<string> {
  const cityHeader = String(req.headers['x-appengine-city'] || req.headers['cf-ipcity'] || '').trim();
  const regionHeader = String(req.headers['x-appengine-region'] || '').trim();
  const countryHeader = String(req.headers['x-appengine-country'] || req.headers['cf-ipcountry'] || '').trim();

  const headerParts = [cityHeader, regionHeader, countryHeader].filter(Boolean);
  if (headerParts.length > 0) {
    return headerParts.join(', ');
  }

  if (isPrivateOrLocalIp(ipAddress)) {
    return 'Jaringan Lokal / Server Internal';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress)}`, {
      signal: controller.signal,
    });
    if (res.ok) {
      const json = (await res.json()) as {
        success?: boolean;
        city?: string;
        region?: string;
        country?: string;
      };
      if (json.success) {
        const parts = [json.city, json.region, json.country].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
    }
  } catch {
    // Graceful fallback without blocking login
  } finally {
    clearTimeout(timer);
  }

  return `Akses Publik (IP ${ipAddress})`;
}

export function getAdminAccount(): DbAdminAccount | null {
  const db = getSecurityDb();
  const row = db
    .prepare('SELECT * FROM admin_accounts ORDER BY created_at ASC LIMIT 1')
    .get() as DbAdminAccount | undefined;
  return row || null;
}

export function getAdminAccountByUsername(username: string): DbAdminAccount | null {
  const db = getSecurityDb();
  const row = db
    .prepare('SELECT * FROM admin_accounts WHERE username = ? LIMIT 1')
    .get(username) as DbAdminAccount | undefined;
  return row || null;
}

export function recordActivityLog(input: {
  username: string;
  eventType: string;
  description: string;
  deviceLabel: string;
  ipAddress: string;
  locationEstimate: string;
  status: DbActivityLog['status'];
}): void {
  const db = getSecurityDb();
  db.prepare(
    `INSERT INTO activity_logs (
      id, username, event_type, description, device_label, ip_address, location_estimate, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `act-${crypto.randomUUID().slice(0, 8)}`,
    input.username,
    input.eventType,
    input.description,
    input.deviceLabel,
    input.ipAddress,
    input.locationEstimate,
    input.status,
    new Date().toISOString(),
  );
}

export function createSecurityNotification(input: {
  username: string;
  type: SecurityNotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  metadata?: Record<string, unknown>;
}): void {
  const db = getSecurityDb();
  db.prepare(
    `INSERT INTO security_notifications (
      id, username, type, title, message, severity, metadata_json, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    `ntf-${crypto.randomUUID().slice(0, 8)}`,
    input.username,
    input.type,
    input.title,
    input.message,
    input.severity,
    JSON.stringify(input.metadata || {}),
    new Date().toISOString(),
  );
}

export function recordEmailOutbox(input: {
  recipientEmail: string;
  subject: string;
  category: string;
  deliveryMode: 'smtp' | 'local_preview';
  deliveryStatus: 'sent' | 'failed' | 'preview_only';
  errorMessage?: string;
  previewHtml?: string;
  previewText?: string;
  challengeId?: string | null;
}): void {
  const db = getSecurityDb();
  // Never store raw one-time action tokens in outbox if real SMTP is configured
  const safeHtml = input.deliveryMode === 'local_preview' ? input.previewHtml || '' : '';
  const safeText = input.deliveryMode === 'local_preview' ? input.previewText || '' : '';
  db.prepare(
    `INSERT INTO email_outbox_logs (
      id, recipient_email, subject, category, delivery_mode, delivery_status,
      error_message, preview_html, preview_text, challenge_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `eml-${crypto.randomUUID().slice(0, 8)}`,
    input.recipientEmail,
    input.subject,
    input.category,
    input.deliveryMode,
    input.deliveryStatus,
    input.errorMessage || '',
    safeHtml,
    safeText,
    input.challengeId || null,
    new Date().toISOString(),
  );
}
