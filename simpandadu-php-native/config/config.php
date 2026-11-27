<?php
/**
 * Konfigurasi Utama SIMPANDADU (PHP Native + MySQL)
 * Sesuaikan pengaturan database MySQL dan SMTP email di file ini
 * atau melalui variabel environment server.
 */

declare(strict_types=1);

if (defined('SIMPANDADU_CONFIG_LOADED')) {
    return;
}
define('SIMPANDADU_CONFIG_LOADED', true);

date_default_timezone_set('Asia/Jakarta');

// -----------------------------------------------------------------------------
// Pengaturan Database MySQL (Default XAMPP: host=127.0.0.1, user=root, pass='')
// -----------------------------------------------------------------------------
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'simpandadu_db');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? (string) getenv('DB_PASS') : '');

// -----------------------------------------------------------------------------
// Pengaturan URL Aplikasi (kosongkan agar otomatis mengikuti domain/folder aktif)
// Contoh manual jika perlu: 'http://localhost/simpandadu'
// -----------------------------------------------------------------------------
define('APP_BASE_URL_OVERRIDE', getenv('APP_BASE_URL') ?: '');

// -----------------------------------------------------------------------------
// Pengaturan Email SMTP untuk Konfirmasi Login Admin & Verifikasi Email Baru
// Contoh Gmail: host='smtp.gmail.com', port=587, secure='tls', gunakan App Password 16 digit
// Contoh Mailtrap (Uji Coba): host='sandbox.smtp.mailtrap.io', port=2525, secure='tls'
// -----------------------------------------------------------------------------
define('SMTP_HOST', getenv('SMTP_HOST') ?: '');
define('SMTP_PORT', (int) (getenv('SMTP_PORT') ?: 587));
define('SMTP_SECURE', getenv('SMTP_SECURE') ?: 'tls'); // 'tls' (STARTTLS 587/2525), 'ssl' (SMTPS 465), atau ''
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASS', getenv('SMTP_PASS') ?: '');
define('SMTP_FROM', getenv('SMTP_FROM') ?: (getenv('SMTP_USER') ?: 'no-reply@adimulya.desa.id'));
define('SMTP_FROM_NAME', getenv('SMTP_FROM_NAME') ?: 'SIMPANDADU Desa Adimulya');

// Direktori Upload Aman
define('ROOT_DIR', dirname(__DIR__));
define('UPLOAD_AVATARS_DIR', ROOT_DIR . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'avatars');
define('UPLOAD_PROPOSALS_DIR', ROOT_DIR . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'proposals');
