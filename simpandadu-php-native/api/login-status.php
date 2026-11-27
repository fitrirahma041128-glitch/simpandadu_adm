<?php
/**
 * API Polling Status Konfirmasi Login Email
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

$challengeId = trim((string) ($_GET['challengeId'] ?? ''));
$pollSecret = trim((string) ($_GET['pollSecret'] ?? ''));

if ($challengeId === '' || $pollSecret === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Parameter tidak lengkap.']);
    exit;
}

$db = get_db();
$stmt = $db->prepare('SELECT * FROM login_challenges WHERE id = ? LIMIT 1');
$stmt->execute([$challengeId]);
$ch = $stmt->fetch();

if (!$ch || !hash_equals((string) $ch['poll_secret_hash'], sha256_hex($pollSecret))) {
    http_response_code(404);
    echo json_encode(['error' => 'Permintaan login tidak ditemukan.']);
    exit;
}

$nowMs = (int) round(microtime(true) * 1000);
if ($ch['status'] === 'pending' && $nowMs > (int) $ch['expires_at']) {
    $upd = $db->prepare(
        "UPDATE login_challenges SET status = 'expired', decision_reason = 'Batas waktu konfirmasi habis.', decided_at = NOW() WHERE id = ? AND status = 'pending'"
    );
    $upd->execute([$ch['id']]);
    $ch['status'] = 'expired';
    $ch['decision_reason'] = 'Permintaan konfirmasi login kedaluwarsa karena melebihi batas waktu.';

    create_security_notification(
        $ch['username'],
        'login_denied',
        'Permintaan Login Kedaluwarsa',
        "Permintaan konfirmasi login dari {$ch['device_label']} tidak dikonfirmasi hingga batas waktu habis.",
        'warning'
    );
    record_activity_log(
        $ch['username'],
        'LOGIN_KEDALUWARSA',
        'Permintaan konfirmasi login melalui email kedaluwarsa tanpa persetujuan.',
        $ch['device_label'],
        $ch['ip_address'],
        $ch['location_estimate'],
        'Kedaluwarsa'
    );
}

echo json_encode([
    'status' => $ch['status'],
    'reason' => $ch['decision_reason'],
    'expiresAt' => (int) $ch['expires_at'],
], JSON_UNESCAPED_UNICODE);
