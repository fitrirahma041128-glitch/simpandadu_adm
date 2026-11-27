<?php
/**
 * API Lonceng Notifikasi Keamanan Admin (JSON)
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

$admin = current_admin();
if (!$admin) {
    http_response_code(401);
    echo json_encode(['error' => 'Autentikasi diperlukan.']);
    exit;
}

$db = get_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $csrfSent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    ensure_session_started();
    $sessionCsrf = (string) ($_SESSION['csrf_token'] ?? '');
    if ($sessionCsrf === '' || !hash_equals($sessionCsrf, $csrfSent)) {
        http_response_code(403);
        echo json_encode(['error' => 'Token CSRF tidak valid.']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    $action = $body['action'] ?? '';

    if ($action === 'read_all') {
        $stmt = $db->prepare('UPDATE security_notifications SET is_read = 1 WHERE username = ?');
        $stmt->execute([$admin['username']]);
    } elseif ($action === 'read' && !empty($body['id'])) {
        $stmt = $db->prepare('UPDATE security_notifications SET is_read = 1 WHERE id = ? AND username = ?');
        $stmt->execute([(string) $body['id'], $admin['username']]);
    }

    echo json_encode(['ok' => true]);
    exit;
}

$stmt = $db->prepare(
    'SELECT id, type, title, message, severity, is_read, created_at
     FROM security_notifications
     WHERE username = ?
     ORDER BY created_at DESC
     LIMIT 25'
);
$stmt->execute([$admin['username']]);
$rows = $stmt->fetchAll();

$items = array_map(static function (array $r): array {
    return [
        'id' => $r['id'],
        'type' => $r['type'],
        'title' => $r['title'],
        'message' => $r['message'],
        'severity' => $r['severity'],
        'isRead' => (bool) $r['is_read'],
        'createdAt' => $r['created_at'],
        'formattedTime' => format_waktu_indonesia($r['created_at']),
    ];
}, $rows);

echo json_encode([
    'notifications' => $items,
    'unreadCount' => get_unread_notification_count($admin['username']),
], JSON_UNESCAPED_UNICODE);
