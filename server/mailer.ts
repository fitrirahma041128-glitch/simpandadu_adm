import nodemailer from 'nodemailer';

export interface SmtpStatusInfo {
  configured: boolean;
  hostLabel: string;
  port: number | null;
  fromAddress: string;
}

export function isSmtpConfigured(): boolean {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  // Allow unauthenticated relay hosts if SMTP_HOST is explicitly set (e.g. local Mailpit/Postfix),
  // or standard authenticated SMTP when user+pass are present.
  if (!host) return false;
  if (user && !pass) return false;
  return true;
}

export function getSmtpStatus(): SmtpStatusInfo {
  const configured = isSmtpConfigured();
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const from =
    (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim() ||
    'noreply@adimulya.desa.id';
  return {
    configured,
    hostLabel: configured ? host : 'Belum dikonfigurasi',
    port: configured && Number.isFinite(port) ? port : null,
    fromAddress: from,
  };
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailSendResult {
  deliveredVia: 'smtp' | 'local_preview';
  status: 'sent' | 'failed' | 'preview_only';
  messageId?: string;
  errorMessage?: string;
  html: string;
  text: string;
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailSendResult> {
  if (!isSmtpConfigured()) {
    return {
      deliveredVia: 'local_preview',
      status: 'preview_only',
      html: params.html,
      text: params.text,
    };
  }

  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = String(process.env.SMTP_SECURE || '').toLowerCase();
  const secure = secureEnv === 'true' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from =
    (process.env.SMTP_FROM || '').trim() ||
    (user ? `"SIMPANDADU Desa Adimulya" <${user}>` : '"SIMPANDADU Desa Adimulya" <noreply@adimulya.desa.id>');

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });

    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    return {
      deliveredVia: 'smtp',
      status: 'sent',
      messageId: info.messageId,
      html: params.html,
      text: params.text,
    };
  } catch (err) {
    return {
      deliveredVia: 'smtp',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'Gagal mengirim email SMTP',
      html: params.html,
      text: params.text,
    };
  }
}

function wrapEmailLayout(title: string, subtitle: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="id">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:24px;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">
    <div style="background:#0B1D3A;padding:22px 28px;border-bottom:3px solid #C99A2E;">
      <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#E5B84B;font-weight:700;">SIMPANDADU · Pemerintah Desa Adimulya</p>
      <h1 style="margin:6px 0 0 0;font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;">${escapeHtml(title)}</h1>
      <p style="margin:4px 0 0 0;font-size:13px;color:#cbd5e1;">${escapeHtml(subtitle)}</p>
    </div>
    <div style="padding:24px 28px;font-size:14px;line-height:1.65;color:#334155;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      Email ini dikirim otomatis oleh sistem keamanan SIMPANDADU Balai Desa Adimulya. Sistem tidak pernah mengirimkan password Anda melalui email.
    </div>
  </div>
</body>
</html>`;
}

export function buildLoginConfirmationEmail(input: {
  adminName: string;
  username: string;
  requestedAtFormatted: string;
  deviceLabel: string;
  ipAddress: string;
  locationEstimate: string;
  ttlMinutes: number;
  approveUrl: string;
  denyUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `[SIMPANDADU] Konfirmasi Percobaan Login Baru (@${input.username})`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Yth. <strong>${escapeHtml(input.adminName)}</strong>,</p>
    <p style="margin:0 0 16px 0;">Terdeteksi percobaan masuk ke akun administrator <strong>@${escapeHtml(input.username)}</strong> pada sistem <strong>SIMPANDADU Desa Adimulya</strong> dari perangkat atau sesi baru.</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;width:36%;">Waktu Percobaan</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${escapeHtml(input.requestedAtFormatted)}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;">Perangkat / Browser</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${escapeHtml(input.deviceLabel)}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;">Alamat IP</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-family:monospace;color:#0f172a;">${escapeHtml(input.ipAddress)}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;">Perkiraan Lokasi</td><td style="padding:10px 14px;font-weight:600;color:#0f172a;">${escapeHtml(input.locationEstimate)}</td></tr>
    </table>
    <p style="margin:0 0 16px 0;">Apakah Anda yang melakukan percobaan login ini? Pilih salah satu tindakan di bawah ini dalam waktu <strong>${input.ttlMinutes} menit</strong> (tautan hanya berlaku satu kali):</p>
    <div style="margin:20px 0;text-align:center;">
      <a href="${escapeHtml(input.approveUrl)}" style="display:inline-block;background:#15803D;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;margin:6px;">IZINKAN LOGIN</a>
      <a href="${escapeHtml(input.denyUrl)}" style="display:inline-block;background:#B91C1C;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;margin:6px;">TOLAK LOGIN</a>
    </div>
    <p style="margin:16px 0 0 0;font-size:12px;color:#64748b;">Jika Anda tidak mengenali aktivitas ini, segera pilih <strong>TOLAK LOGIN</strong> dan perbarui password Anda melalui menu Profil Akun SIMPANDADU.</p>
  `;

  const html = wrapEmailLayout(
    'Konfirmasi Keamanan Login',
    'Verifikasi Perangkat / Sesi Baru SIMPANDADU',
    bodyHtml,
  );

  const text = [
    `SIMPANDADU - KONFIRMASI PERCOBAAN LOGIN BARU`,
    `Yth. ${input.adminName} (@${input.username}),`,
    ``,
    `Terdeteksi percobaan login baru:`,
    `- Waktu: ${input.requestedAtFormatted}`,
    `- Perangkat: ${input.deviceLabel}`,
    `- Alamat IP: ${input.ipAddress}`,
    `- Perkiraan Lokasi: ${input.locationEstimate}`,
    ``,
    `Tautan satu kali pakai (berlaku ${input.ttlMinutes} menit):`,
    `IZINKAN LOGIN: ${input.approveUrl}`,
    `TOLAK LOGIN: ${input.denyUrl}`,
    ``,
    `Sistem tidak pernah mengirimkan password Anda melalui email.`,
  ].join('\n');

  return { subject, html, text };
}

export function buildLoginDecisionResultEmail(input: {
  adminName: string;
  username: string;
  outcome: 'approved' | 'denied' | 'expired';
  decidedAtFormatted: string;
  deviceLabel: string;
  ipAddress: string;
  locationEstimate: string;
}): { subject: string; html: string; text: string } {
  const labels = {
    approved: {
      badge: 'LOGIN DIIZINKAN',
      color: '#15803D',
      subject: `[SIMPANDADU] Konfirmasi Login Disetujui (@${input.username})`,
      desc: 'Permintaan login telah disetujui dan perangkat ditandai sebagai perangkat terpercaya untuk akun Anda.',
    },
    denied: {
      badge: 'LOGIN DITOLAK',
      color: '#B91C1C',
      subject: `[SIMPANDADU] Peringatan: Percobaan Login Ditolak (@${input.username})`,
      desc: 'Percobaan login telah ditolak dan akses dibatalkan. Disarankan segera mengganti password akun Anda jika aktivitas tersebut bukan dilakukan oleh Anda.',
    },
    expired: {
      badge: 'PERMINTAAN KEDALUWARSA',
      color: '#B45309',
      subject: `[SIMPANDADU] Permintaan Konfirmasi Login Kedaluwarsa (@${input.username})`,
      desc: 'Permintaan konfirmasi login tidak ditindaklanjuti sebelum batas waktu habis sehingga akses otomatis dibatalkan.',
    },
  }[input.outcome];

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">Yth. <strong>${escapeHtml(input.adminName)}</strong>,</p>
    <p style="margin:0 0 16px 0;"><strong style="color:${labels.color};">${labels.badge}</strong> — ${escapeHtml(labels.desc)}</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;width:36%;">Waktu Status</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${escapeHtml(input.decidedAtFormatted)}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;">Perangkat</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(input.deviceLabel)}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;">Alamat IP</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(input.ipAddress)}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;">Perkiraan Lokasi</td><td style="padding:10px 14px;">${escapeHtml(input.locationEstimate)}</td></tr>
    </table>
  `;

  return {
    subject: labels.subject,
    html: wrapEmailLayout(
      'Hasil Konfirmasi Keamanan Login',
      `Status: ${labels.badge}`,
      bodyHtml,
    ),
    text: `${labels.subject}\n\n${labels.desc}\nWaktu: ${input.decidedAtFormatted}\nPerangkat: ${input.deviceLabel}\nIP: ${input.ipAddress}\nLokasi: ${input.locationEstimate}`,
  };
}

export function buildEmailVerificationEmail(input: {
  adminName: string;
  username: string;
  newEmail: string;
  verifyUrl: string;
  verificationCode: string;
  ttlMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = `[SIMPANDADU] Verifikasi Alamat Email Baru Admin`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Yth. <strong>${escapeHtml(input.adminName)}</strong> (@${escapeHtml(input.username)}),</p>
    <p style="margin:0 0 16px 0;">Kami menerima permintaan untuk mendaftarkan/mengubah alamat email aktif admin SIMPANDADU menjadi <strong>${escapeHtml(input.newEmail)}</strong>.</p>
    <p style="margin:0 0 10px 0;">Klik tombol verifikasi di bawah ini (berlaku satu kali selama ${input.ttlMinutes} menit):</p>
    <div style="margin:18px 0;text-align:center;">
      <a href="${escapeHtml(input.verifyUrl)}" style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:8px;">VERIFIKASI EMAIL BARU</a>
    </div>
    <p style="margin:0 0 8px 0;">Atau masukkan kode verifikasi 6 digit berikut di halaman <strong>Profil Akun SIMPANDADU</strong>:</p>
    <div style="text-align:center;margin:14px 0;padding:14px;background:#f8fafc;border:1px dashed #94a3b8;border-radius:8px;font-family:monospace;font-size:24px;font-weight:700;letter-spacing:6px;color:#0B1D3A;">
      ${escapeHtml(input.verificationCode)}
    </div>
    <p style="margin:14px 0 0 0;font-size:12px;color:#64748b;">Jika Anda tidak meminta perubahan email ini, abaikan pesan ini dan periksa keamanan akun Anda.</p>
  `;

  return {
    subject,
    html: wrapEmailLayout(
      'Verifikasi Email Administrator',
      'Konfirmasi Perubahan Alamat Email SIMPANDADU',
      bodyHtml,
    ),
    text: `SIMPANDADU - VERIFIKASI EMAIL BARU\n\nEmail baru: ${input.newEmail}\nKode verifikasi (berlaku ${input.ttlMinutes} menit): ${input.verificationCode}\nTautan verifikasi: ${input.verifyUrl}`,
  };
}

export function buildSecurityAlertEmail(input: {
  adminName: string;
  username: string;
  title: string;
  detail: string;
  occurredAtFormatted: string;
  deviceLabel: string;
  ipAddress: string;
}): { subject: string; html: string; text: string } {
  const subject = `[SIMPANDADU] ${input.title} (@${input.username})`;
  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Yth. <strong>${escapeHtml(input.adminName)}</strong>,</p>
    <p style="margin:0 0 16px 0;">${escapeHtml(input.detail)}</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;width:36%;">Waktu</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(input.occurredAtFormatted)}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;">Perangkat</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(input.deviceLabel)}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;">Alamat IP</td><td style="padding:10px 14px;font-family:monospace;">${escapeHtml(input.ipAddress)}</td></tr>
    </table>
  `;

  return {
    subject,
    html: wrapEmailLayout(
      input.title,
      'Pemberitahuan Keamanan Akun SIMPANDADU',
      bodyHtml,
    ),
    text: `${subject}\n\n${input.detail}\nWaktu: ${input.occurredAtFormatted}\nPerangkat: ${input.deviceLabel}\nIP: ${input.ipAddress}`,
  };
}
