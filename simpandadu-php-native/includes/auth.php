<?php
/**
 * Autentikasi, Session Admin, Perangkat Terpercaya, Notifikasi & Log Aktivitas (MySQL)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';
require_once __DIR__ . '/helpers.php';

define('TRUSTED_DEVICE_COOKIE', 'simpandadu_device');

function get_admin_count(): int
{
    $db = get_db();
    return (int) $db->query('SELECT COUNT(*) FROM admin_accounts')->fetchColumn();
}

function get_admin_by_username(string $username): ?array
{
    $db = get_db();
    $stmt = $db->prepare('SELECT * FROM admin_accounts WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function current_admin(): ?array
{
    ensure_session_started();
    if (empty($_SESSION['admin_username'])) {
        return null;
    }
    $admin = get_admin_by_username((string) $_SESSION['admin_username']);
    if (!$admin) {
        unset($_SESSION['admin_username']);
        return null;
    }
    return $admin;
}

function require_admin(): array
{
    $admin = current_admin();
    if (!$admin) {
        header('Location: login.php');
        exit;
    }
    return $admin;
}

function create_security_notification(
    string $username,
    string $type,
    string $title,
    string $message,
    string $severity = 'info',
    array $metadata = []
): void {
    $db = get_db();
    $stmt = $db->prepare(
        'INSERT INTO security_notifications (id, username, type, title, message, severity, metadata_json, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())'
    );
    $stmt->execute([
        'ntf-' . generate_uuid_v4(),
        $username,
        $type,
        $title,
        $message,
        $severity,
        json_encode($metadata, JSON_UNESCAPED_UNICODE),
    ]);
}

function record_activity_log(
    string $username,
    string $eventType,
    string $description,
    string $deviceLabel,
    string $ipAddress,
    string $locationEstimate,
    string $status = 'Berhasil'
): void {
    $db = get_db();
    $stmt = $db->prepare(
        'INSERT INTO activity_logs (id, username, event_type, description, device_label, ip_address, location_estimate, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([
        'act-' . generate_uuid_v4(),
        $username,
        $eventType,
        $description,
        $deviceLabel,
        $ipAddress,
        $locationEstimate,
        $status,
    ]);
}

function record_email_outbox(
    string $recipientEmail,
    string $subject,
    string $category,
    array $deliveryResult,
    string $html,
    string $text,
    ?string $challengeId = null
): void {
    $db = get_db();
    $stmt = $db->prepare(
        'INSERT INTO email_outbox_logs (id, recipient_email, subject, category, delivery_mode, delivery_status, error_message, preview_html, preview_text, challenge_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    );
    $stmt->execute([
        'eml-' . generate_uuid_v4(),
        $recipientEmail,
        $subject,
        $category,
        $deliveryResult['deliveryMode'],
        $deliveryResult['deliveryStatus'],
        $deliveryResult['errorMessage'] ?? '',
        $html,
        $text,
        $challengeId,
    ]);
}

function get_trusted_device_by_cookie(string $username): ?array
{
    $raw = trim((string) ($_COOKIE[TRUSTED_DEVICE_COOKIE] ?? ''));
    if ($raw === '') {
        return null;
    }
    $db = get_db();
    $stmt = $db->prepare(
        'SELECT * FROM trusted_devices WHERE username = ? AND token_hash = ? AND revoked_at IS NULL LIMIT 1'
    );
    $stmt->execute([$username, sha256_hex($raw)]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function set_trusted_device_cookie(string $rawToken): void
{
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie(TRUSTED_DEVICE_COOKIE, $rawToken, [
        'expires' => time() + (30 * 86400),
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function register_trusted_device(string $username, array $ctx, ?string $rawToken = null): string
{
    $token = $rawToken ?: bin2hex(random_bytes(32));
    $db = get_db();
    $stmt = $db->prepare(
        'INSERT INTO trusted_devices (id, username, token_hash, device_label, ip_address, location_estimate, last_used_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())'
    );
    $stmt->execute([
        'dev-' . generate_uuid_v4(),
        $username,
        sha256_hex($token),
        $ctx['deviceLabel'],
        $ctx['ipAddress'],
        $ctx['locationEstimate'],
    ]);
    return $token;
}

function complete_admin_session_login(array $admin): void
{
    ensure_session_started();
    session_regenerate_id(true);
    $_SESSION['admin_username'] = $admin['username'];
    $_SESSION['logged_in_at'] = time();
}

function get_unread_notification_count(string $username): int
{
    $db = get_db();
    $stmt = $db->prepare('SELECT COUNT(*) FROM security_notifications WHERE username = ? AND is_read = 0');
    $stmt->execute([$username]);
    return (int) $stmt->fetchColumn();
}
