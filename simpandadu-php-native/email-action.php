<?php
/**
 * Penanganan Tautan Satu Kali dari Email Admin:
 * 1. Konfirmasi Login (?loginConfirm=TOKEN&action=approve|deny)
 * 2. Verifikasi Email Baru (?verifyEmail=TOKEN)
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$db = get_db();
$loginToken = trim((string) ($_GET['loginConfirm'] ?? ($_POST['loginConfirm'] ?? '')));
$loginAction = (($_GET['action'] ?? ($_POST['action'] ?? 'approve')) === 'deny') ? 'deny' : 'approve';
$verifyToken = trim((string) ($_GET['verifyEmail'] ?? ($_POST['verifyEmail'] ?? '')));

$resultMsg = '';
$resultError = '';
$challengePreview = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $loginToken !== '') {
    if (!verify_csrf()) {
        $resultError = 'Validasi keamanan formulir gagal.';
    } else {
        $col = $loginAction === 'deny' ? 'deny_token_hash' : 'approve_token_hash';
        $stmt = $db->prepare("SELECT * FROM login_challenges WHERE {$col} = ? LIMIT 1");
        $stmt->execute([sha256_hex($loginToken)]);
        $ch = $stmt->fetch();
        $nowMs = (int) round(microtime(true) * 1000);

        if (!$ch) {
            $resultError = 'Tautan konfirmasi login tidak valid.';
        } elseif ($ch['status'] === 'pending' && $nowMs > (int) $ch['expires_at']) {
            $db->prepare("UPDATE login_challenges SET status = 'expired', decision_reason = 'Batas waktu konfirmasi habis.', decided_at = NOW() WHERE id = ? AND status = 'pending'")
               ->execute([$ch['id']]);
            $resultError = 'Permintaan konfirmasi login telah kedaluwarsa.';
        } elseif ($ch['status'] !== 'pending') {
            $resultError = 'Tautan konfirmasi ini sudah pernah digunakan atau permintaan login telah selesai diproses.';
        } else {
            $admin = get_admin_by_username($ch['username']);
            if ($loginAction === 'approve') {
                $rawDevToken = bin2hex(random_bytes(32));
                $upd = $db->prepare(
                    "UPDATE login_challenges SET status = 'approved', trusted_device_token = ?, decided_at = NOW(), decision_reason = 'Diizinkan oleh admin melalui tautan email.' WHERE id = ? AND status = 'pending'"
                );
                $upd->execute([$rawDevToken, $ch['id']]);
                if ($upd->rowCount() === 0) {
                    $resultError = 'Tautan sudah digunakan sebelumnya.';
                } else {
                    register_trusted_device($ch['username'], [
                        'deviceLabel' => $ch['device_label'],
                        'ipAddress' => $ch['ip_address'],
                        'locationEstimate' => $ch['location_estimate'],
                    ], $rawDevToken);

                    create_security_notification(
                        $ch['username'],
                        'login_success',
                        'Percobaan Login Diizinkan Admin',
                        "Akses login dari {$ch['device_label']} ({$ch['location_estimate']}) telah disetujui melalui email.",
                        'success'
                    );
                    record_activity_log(
                        $ch['username'],
                        'KONFIRMASI_LOGIN_DIIZINKAN',
                        'Admin mengklik IZINKAN LOGIN melalui tautan email.',
                        $ch['device_label'],
                        $ch['ip_address'],
                        $ch['location_estimate'],
                        'Disetujui'
                    );

                    if ($admin && !empty($admin['email'])) {
                        $resMail = build_login_decision_result_email([
                            'decision' => 'approved',
                            'fullName' => $admin['full_name'],
                            'username' => $admin['username'],
                            'timeLabel' => format_waktu_indonesia(),
                            'deviceLabel' => $ch['device_label'],
                            'locationEstimate' => $ch['location_estimate'],
                            'ipAddress' => $ch['ip_address'],
                        ]);
                        $deliv = send_transactional_email($admin['email'], $resMail['subject'], $resMail['html'], $resMail['text']);
                        record_email_outbox($admin['email'], $resMail['subject'], 'login_result', $deliv, $resMail['html'], $resMail['text'], $ch['id']);
                    }
                    $resultMsg = 'Login berhasil DIIZINKAN. Perangkat pemohon kini otomatis masuk ke dashboard SIMPANDADU.';
                }
            } else {
                $upd = $db->prepare(
                    "UPDATE login_challenges SET status = 'denied', decided_at = NOW(), decision_reason = 'Ditolak oleh admin melalui tautan email.' WHERE id = ? AND status = 'pending'"
                );
                $upd->execute([$ch['id']]);
                if ($upd->rowCount() === 0) {
                    $resultError = 'Tautan sudah digunakan sebelumnya.';
                } else {
                    create_security_notification(
                        $ch['username'],
                        'login_denied',
                        'Percobaan Login Ditolak Admin',
                        "Akses login dari {$ch['device_label']} ({$ch['ip_address']}) dibatalkan melalui tautan TOLAK LOGIN.",
                        'danger'
                    );
                    record_activity_log(
                        $ch['username'],
                        'KONFIRMASI_LOGIN_DITOLAK',
                        'Admin mengklik TOLAK LOGIN dan membatalkan sesi percobaan masuk.',
                        $ch['device_label'],
                        $ch['ip_address'],
                        $ch['location_estimate'],
                        'Ditolak'
                    );
                    if ($admin && !empty($admin['email'])) {
                        $resMail = build_login_decision_result_email([
                            'decision' => 'denied',
                            'fullName' => $admin['full_name'],
                            'username' => $admin['username'],
                            'timeLabel' => format_waktu_indonesia(),
                            'deviceLabel' => $ch['device_label'],
                            'locationEstimate' => $ch['location_estimate'],
                            'ipAddress' => $ch['ip_address'],
                        ]);
                        $deliv = send_transactional_email($admin['email'], $resMail['subject'], $resMail['html'], $resMail['text']);
                        record_email_outbox($admin['email'], $resMail['subject'], 'login_result', $deliv, $resMail['html'], $resMail['text'], $ch['id']);
                    }
                    $resultMsg = 'Percobaan login berhasil DITOLAK dan akses telah dibatalkan.';
                }
            }
        }
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $verifyToken !== '') {
    if (!verify_csrf()) {
        $resultError = 'Validasi keamanan formulir gagal.';
    } else {
        $stmt = $db->prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ? LIMIT 1');
        $stmt->execute([sha256_hex($verifyToken)]);
        $row = $stmt->fetch();
        $nowMs = (int) round(microtime(true) * 1000);

        if (!$row) {
            $resultError = 'Token verifikasi email tidak valid.';
        } elseif ($row['used_at'] !== null) {
            $resultError = 'Tautan verifikasi email ini sudah pernah digunakan.';
        } elseif ($nowMs > (int) $row['expires_at']) {
            $resultError = 'Tautan verifikasi email sudah kedaluwarsa. Ajukan ulang dari menu Profil Akun.';
        } else {
            $db->prepare('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?')->execute([$row['id']]);
            $db->prepare('UPDATE admin_accounts SET email = ?, email_verified = 1, pending_email = NULL, updated_at = NOW() WHERE username = ?')
               ->execute([$row['new_email'], $row['username']]);
            $ctx = parse_device_context();
            create_security_notification(
                $row['username'],
                'profile_updated',
                'Email Baru Terverifikasi',
                "Alamat email aktif akun diubah menjadi {$row['new_email']}.",
                'success'
            );
            record_activity_log(
                $row['username'],
                'VERIFIKASI_EMAIL_BARU',
                "Email akun terverifikasi menjadi {$row['new_email']}.",
                $ctx['deviceLabel'],
                $ctx['ipAddress'],
                $ctx['locationEstimate'],
                'Berhasil'
            );
            $resultMsg = 'Email baru ' . $row['new_email'] . ' berhasil diverifikasi dan kini aktif.';
        }
    }
}

// Mode Pratinjau GET (aman dari scanner prefetch email)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $loginToken !== '') {
    $col = $loginAction === 'deny' ? 'deny_token_hash' : 'approve_token_hash';
    $stmt = $db->prepare("SELECT * FROM login_challenges WHERE {$col} = ? LIMIT 1");
    $stmt->execute([sha256_hex($loginToken)]);
    $challengePreview = $stmt->fetch() ?: null;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konfirmasi Keamanan Email — SIMPANDADU</title>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body style="background:#f1f5f9;padding:32px 16px;">
  <div style="max-width:540px;margin:0 auto;">
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
        <img src="assets/images/logo_desa_adimulya.jpg" alt="Logo" style="width:42px;height:42px;border-radius:9px;object-fit:cover;">
        <div>
          <h1 style="margin:0;font-size:18px;color:#0b1f3a;">Konfirmasi Keamanan Email SIMPANDADU</h1>
          <div style="font-size:12.5px;color:#64748b;">Tautan Satu Kali &bull; Desa Adimulya</div>
        </div>
      </div>

      <?php if ($resultMsg !== ''): ?>
        <div class="alert alert-success"><?= e($resultMsg) ?></div>
        <a href="login.php" class="btn btn-primary">Kembali ke Halaman Login / Dashboard</a>

      <?php elseif ($resultError !== ''): ?>
        <div class="alert alert-danger"><?= e($resultError) ?></div>
        <a href="login.php" class="btn btn-outline">Kembali</a>

      <?php elseif ($loginToken !== ''): ?>
        <?php if (!$challengePreview): ?>
          <div class="alert alert-danger">Tautan konfirmasi login tidak ditemukan atau tidak valid.</div>
        <?php elseif ($challengePreview['status'] !== 'pending' || (int) round(microtime(true) * 1000) > (int) $challengePreview['expires_at']): ?>
          <div class="alert alert-warning">Permintaan login ini sudah diproses (<?= e($challengePreview['status']) ?>) atau telah kedaluwarsa.</div>
        <?php else: ?>
          <p>Mohon konfirmasi permintaan login untuk akun <strong><?= e($challengePreview['username']) ?></strong>:</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:13.5px;margin-bottom:16px;">
            <div><strong>Waktu:</strong> <?= e(format_waktu_indonesia($challengePreview['created_at'])) ?></div>
            <div><strong>Perangkat:</strong> <?= e($challengePreview['device_label']) ?></div>
            <div><strong>Lokasi / IP:</strong> <?= e($challengePreview['location_estimate']) ?> (<?= e($challengePreview['ip_address']) ?>)</div>
          </div>
          <form method="post" action="email-action.php">
            <?= csrf_field() ?>
            <input type="hidden" name="loginConfirm" value="<?= e($loginToken) ?>">
            <input type="hidden" name="action" value="<?= e($loginAction) ?>">
            <?php if ($loginAction === 'approve'): ?>
              <button type="submit" class="btn btn-primary" style="width:100%;">Konfirmasi: IZINKAN LOGIN</button>
            <?php else: ?>
              <button type="submit" class="btn btn-danger" style="width:100%;">Konfirmasi: TOLAK LOGIN</button>
            <?php endif; ?>
          </form>
        <?php endif; ?>

      <?php elseif ($verifyToken !== ''): ?>
        <p>Klik tombol di bawah ini untuk menyelesaikan verifikasi alamat email baru akun administrator SIMPANDADU:</p>
        <form method="post" action="email-action.php">
          <?= csrf_field() ?>
          <input type="hidden" name="verifyEmail" value="<?= e($verifyToken) ?>">
          <button type="submit" class="btn btn-primary" style="width:100%;">Verifikasi Email Baru Sekarang</button>
        </form>
      <?php else: ?>
        <div class="alert alert-info">Tidak ada parameter tindakan email yang dipilih.</div>
        <a href="login.php" class="btn btn-outline">Buka Halaman Login</a>
      <?php endif; ?>
    </div>
  </div>
</body>
</html>
