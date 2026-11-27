<?php
/**
 * Fungsi Bantu Umum: Sanitasi XSS, CSRF, Deteksi Perangkat, Format Waktu, Upload Aman
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

function e(?string $val): string
{
    return htmlspecialchars((string) ($val ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function app_base_url(): string
{
    if (APP_BASE_URL_OVERRIDE !== '') {
        return rtrim(APP_BASE_URL_OVERRIDE, '/');
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $scheme = $isHttps ? 'https' : 'http';
    $rawHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // Validasi host hanya karakter hostname:port yang sah
    if (!preg_match('/^[a-zA-Z0-9.\-:]+$/', $rawHost)) {
        $rawHost = 'localhost';
    }

    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
    $dir = str_replace('\\', '/', dirname($scriptName));
    // Jika dipanggil dari subfolder /api/, naik 1 tingkat
    if (preg_match('#/api$#', $dir)) {
        $dir = dirname($dir);
    }
    $dir = rtrim($dir, '/');
    if ($dir === '.' || $dir === '') {
        $dir = '';
    }

    return $scheme . '://' . $rawHost . $dir;
}

function is_safe_http_url(?string $url): bool
{
    if (!$url) {
        return false;
    }
    $parsed = parse_url($url);
    if (!$parsed || empty($parsed['scheme'])) {
        return false;
    }
    return in_array(strtolower($parsed['scheme']), ['http', 'https'], true);
}

function sha256_hex(string $value): string
{
    return hash('sha256', $value);
}

function generate_uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function ensure_session_started(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        session_name('SIMPANDADU_SESSID');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function csrf_token(): string
{
    ensure_session_started();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

function verify_csrf(): bool
{
    ensure_session_started();
    $sessionToken = (string) ($_SESSION['csrf_token'] ?? '');
    $sent = (string) ($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
    if ($sessionToken === '' || $sent === '') {
        return false;
    }
    return hash_equals($sessionToken, $sent);
}

function set_flash(string $type, string $title, string $message = ''): void
{
    ensure_session_started();
    $_SESSION['flash_message'] = [
        'type' => $type,
        'title' => $title,
        'message' => $message,
    ];
}

function get_flash(): ?array
{
    ensure_session_started();
    if (empty($_SESSION['flash_message'])) {
        return null;
    }
    $flash = $_SESSION['flash_message'];
    unset($_SESSION['flash_message']);
    return is_array($flash) ? $flash : null;
}

function format_waktu_indonesia(?string $isoOrMysqlDate = null): string
{
    $ts = $isoOrMysqlDate ? strtotime($isoOrMysqlDate) : time();
    if ($ts === false) {
        $ts = time();
    }
    $bulan = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];
    $d = (int) date('j', $ts);
    $m = $bulan[(int) date('n', $ts)] ?? date('F', $ts);
    $y = date('Y', $ts);
    $hm = date('H:i', $ts);
    return "{$d} {$m} {$y}, {$hm} WIB";
}

function mask_email_address(string $email): string
{
    if (!str_contains($email, '@')) {
        return $email;
    }
    [$local, $domain] = explode('@', $email, 2);
    $prefix = strlen($local) <= 2 ? substr($local, 0, 1) : substr($local, 0, 2);
    return $prefix . '***@' . $domain;
}

function get_client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
        $candidate = trim($parts[0]);
        if (filter_var($candidate, FILTER_VALIDATE_IP)) {
            $ip = $candidate;
        }
    }
    return str_replace('::ffff:', '', $ip);
}

function parse_device_context(): array
{
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $ip = get_client_ip();

    $browser = 'Browser Tidak Dikenal';
    if (stripos($ua, 'Edg/') !== false) $browser = 'Microsoft Edge';
    elseif (stripos($ua, 'OPR/') !== false || stripos($ua, 'Opera') !== false) $browser = 'Opera';
    elseif (stripos($ua, 'Chrome/') !== false && stripos($ua, 'Chromium') === false) $browser = 'Google Chrome';
    elseif (stripos($ua, 'Firefox/') !== false) $browser = 'Mozilla Firefox';
    elseif (stripos($ua, 'Safari/') !== false && stripos($ua, 'Chrome') === false) $browser = 'Safari';

    $os = 'Perangkat Lain';
    if (stripos($ua, 'Windows NT 10') !== false) $os = 'Windows 10/11';
    elseif (stripos($ua, 'Windows') !== false) $os = 'Windows';
    elseif (stripos($ua, 'Android') !== false) $os = 'Android';
    elseif (stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false) $os = 'iOS / iPadOS';
    elseif (stripos($ua, 'Mac OS X') !== false) $os = 'macOS';
    elseif (stripos($ua, 'Linux') !== false) $os = 'Linux';

    $location = 'Jaringan Publik / Perkiraan via IP';
    if ($ip === '127.0.0.1' || $ip === '::1') {
        $location = 'Jaringan Lokal (XAMPP Localhost)';
    } elseif (preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/', $ip)) {
        $location = 'Jaringan Internal Kantor / LAN Desa';
    }

    return [
        'browserName' => $browser,
        'osName' => $os,
        'deviceLabel' => "{$browser} di {$os}",
        'ipAddress' => $ip,
        'locationEstimate' => $location,
        'fingerprint' => sha256_hex($ua . '|' . $browser . '|' . $os),
    ];
}

function save_uploaded_image(array $file, string $targetDir, string $prefix, int $maxBytes = 2097152): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return ['error' => 'Gagal mengunggah file gambar.'];
    }
    if (($file['size'] ?? 0) <= 0 || $file['size'] > $maxBytes) {
        return ['error' => 'Ukuran file gambar maksimal 2 MB.'];
    }
    $tmpPath = (string) ($file['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        return ['error' => 'Sumber upload tidak valid.'];
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmpPath);
    $extMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    if (!isset($extMap[$mime])) {
        return ['error' => 'Format file harus JPG, PNG, atau WebP.'];
    }
    $imgInfo = @getimagesize($tmpPath);
    if ($imgInfo === false) {
        return ['error' => 'File bukan gambar yang valid atau rusak.'];
    }

    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    $safeBase = preg_replace('/[^a-zA-Z0-9_-]/', '', $prefix) ?: 'img';
    $fileName = $safeBase . '-' . bin2hex(random_bytes(5)) . '.' . $extMap[$mime];
    $realDir = realpath($targetDir);
    if ($realDir === false) {
        return ['error' => 'Direktori penyimpanan tidak tersedia.'];
    }
    $destPath = $realDir . DIRECTORY_SEPARATOR . $fileName;
    if (!str_starts_with($destPath, $realDir . DIRECTORY_SEPARATOR)) {
        return ['error' => 'Lokasi penyimpanan tidak valid.'];
    }
    if (!move_uploaded_file($tmpPath, $destPath)) {
        return ['error' => 'Tidak dapat menyimpan file ke folder upload.'];
    }

    return ['fileName' => $fileName];
}

function delete_confined_file(string $targetDir, ?string $fileName): void
{
    if (!$fileName) {
        return;
    }
    $realDir = realpath($targetDir);
    if ($realDir === false) {
        return;
    }
    $safeName = basename($fileName);
    $fullPath = $realDir . DIRECTORY_SEPARATOR . $safeName;
    if (str_starts_with($fullPath, $realDir . DIRECTORY_SEPARATOR) && is_file($fullPath)) {
        @unlink($fullPath);
    }
}
