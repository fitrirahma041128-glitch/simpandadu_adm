<?php
/**
 * Halaman Login Admin SIMPANDADU + Setup Admin Pertama + Konfirmasi Login Email
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

if (current_admin() !== null) {
    header('Location: dashboard.php');
    exit;
}

$db = get_db();
$adminCount = get_admin_count();
$errorMsg = '';
$infoMsg = '';
$pendingChallenge = null;
$localEmailPreview = null;

// Jika user kembali dari tombol selesaikan login atau status polling approved
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'complete_challenge') {
    if (!verify_csrf()) {
        $errorMsg = 'Validasi keamanan gagal. Silakan muat ulang halaman.';
    } else {
        $chId = trim((string) ($_POST['challenge_id'] ?? ''));
        $pollSecret = trim((string) ($_POST['poll_secret'] ?? ''));
        $stmt = $db->prepare('SELECT * FROM login_challenges WHERE id = ? LIMIT 1');
        $stmt->execute([$chId]);
        $ch = $stmt->fetch();

        if (!$ch || !hash_equals((string) $ch['poll_secret_hash'], sha256_hex($pollSecret))) {
            $errorMsg = 'Permintaan login tidak valid.';
        } elseif ($ch['status'] !== 'approved') {
            $errorMsg = 'Permintaan login belum disetujui atau telah kedaluwarsa.';
        } else {
            $admin = get_admin_by_username($ch['username']);
            if (!$admin) {
                $errorMsg = 'Akun admin tidak ditemukan.';
            } else {
                $db->prepare("UPDATE login_challenges SET status = 'completed', completed_at = NOW() WHERE id = ? AND status = 'approved'")
                   ->execute([$ch['id']]);
                if (!empty($ch['trusted_device_token'])) {
                    set_trusted_device_cookie((string) $ch['trusted_device_token']);
                }
                complete_admin_session_login($admin);
                set_flash('success', 'Login Berhasil', 'Konfirmasi email diterima. Selamat datang di SIMPANDADU.');
                header('Location: dashboard.php');
                exit;
            }
        }
    }
}

// Setup akun admin pertama kali (jika tabel admin_accounts masih kosong)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'setup_first_admin' && $adminCount === 0) {
    if (!verify_csrf()) {
        $errorMsg = 'Validasi CSRF gagal.';
    } else {
        $username = trim((string) ($_POST['username'] ?? ''));
        $fullName = trim((string) ($_POST['full_name'] ?? ''));
        $email = trim((string) ($_POST['email'] ?? ''));
        $phone = trim((string) ($_POST['phone'] ?? ''));
        $jabatan = trim((string) ($_POST['jabatan'] ?? 'Administrator Balai Desa'));
        $password = (string) ($_POST['password'] ?? '');
        $confirm = (string) ($_POST['password_confirm'] ?? '');

        if (!preg_match('/^[a-zA-Z0-9_.-]{4,32}$/', $username)) {
            $errorMsg = 'Username harus 4–32 karakter (huruf, angka, titik, garis bawah, atau tanda hubung).';
        } elseif ($fullName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errorMsg = 'Nama lengkap dan alamat email aktif yang valid wajib diisi.';
        } elseif (strlen($password) < 8) {
            $errorMsg = 'Password minimal 8 karakter.';
        } elseif ($password !== $confirm) {
            $errorMsg = 'Konfirmasi password tidak cocok.';
        } else {
            $ctx = parse_device_context();
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $db->prepare(
                'INSERT INTO admin_accounts (
                    id, username, password_hash, full_name, email, email_verified, phone, jabatan, role,
                    require_email_login_approval, notify_on_login_success, notify_on_security_change,
                    login_approval_ttl_minutes, approval_policy, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 1, 1, 1, 10, ?, NOW(), NOW())'
            );
            $stmt->execute([
                'adm-' . generate_uuid_v4(),
                $username, $hash, $fullName, $email, $phone, $jabatan, $jabatan, 'new_device',
            ]);
            $devToken = register_trusted_device($username, $ctx);
            set_trusted_device_cookie($devToken);
            create_security_notification(
                $username,
                'login_success',
                'Akun Admin Pertama Berhasil Dibuat',
                "Akun {$username} berhasil didaftarkan dan langsung masuk dari {$ctx['deviceLabel']}.",
                'success'
            );
            record_activity_log(
                $username,
                'SETUP_ADMIN_AWAL',
                'Pendaftaran akun administrator pertama SIMPANDADU.',
                $ctx['deviceLabel'],
                $ctx['ipAddress'],
                $ctx['locationEstimate'],
                'Berhasil'
            );
            $newAdmin = get_admin_by_username($username);
            if ($newAdmin) {
                complete_admin_session_login($newAdmin);
                set_flash('success', 'Akun Admin Siap Digunakan', 'Selamat datang di SIMPANDADU Desa Adimulya.');
                header('Location: dashboard.php');
                exit;
            }
        }
    }
}

// Proses Login Reguler
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login' && $adminCount > 0) {
    if (!verify_csrf()) {
        $errorMsg = 'Validasi keamanan sesi gagal. Silakan muat ulang halaman.';
    } else {
        $username = trim((string) ($_POST['username'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $ctx = parse_device_context();

        $admin = get_admin_by_username($username);
        if (!$admin || !password_verify($password, (string) $admin['password_hash'])) {
            if ($admin) {
                create_security_notification(
                    $admin['username'],
                    'login_denied',
                    'Percobaan Login dengan Password Salah',
                    "Percobaan masuk gagal dari {$ctx['deviceLabel']} ({$ctx['ipAddress']}).",
                    'danger'
                );
                record_activity_log(
                    $admin['username'],
                    'LOGIN_GAGAL',
                    'Password salah saat percobaan masuk.',
                    $ctx['deviceLabel'],
                    $ctx['ipAddress'],
                    $ctx['locationEstimate'],
                    'Ditolak'
                );
            }
            $errorMsg = 'Username atau password salah. Silakan periksa kembali.';
        } else {
            $trustedDevice = get_trusted_device_by_cookie($admin['username']);
            $hasVerifiedEmail = !empty($admin['email']) && (int) $admin['email_verified'] === 1;
            $requireApproval = (int) $admin['require_email_login_approval'] === 1
                && $hasVerifiedEmail
                && ($admin['approval_policy'] === 'every_login' || $trustedDevice === null);

            if ($requireApproval) {
                $chId = 'ch-' . bin2hex(random_bytes(8));
                $pollSecret = bin2hex(random_bytes(24));
                $approveToken = bin2hex(random_bytes(24));
                $denyToken = bin2hex(random_bytes(24));
                $ttlMinutes = max(3, min(30, (int) $admin['login_approval_ttl_minutes']));
                $expiresAtMs = (int) round((microtime(true) + ($ttlMinutes * 60)) * 1000);

                $ins = $db->prepare(
                    'INSERT INTO login_challenges (
                        id, username, admin_email, poll_secret_hash, approve_token_hash, deny_token_hash,
                        device_fingerprint, device_label, browser_name, os_name, ip_address, location_estimate,
                        status, decision_reason, expires_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
                );
                $ins->execute([
                    $chId, $admin['username'], $admin['email'],
                    sha256_hex($pollSecret), sha256_hex($approveToken), sha256_hex($denyToken),
                    $ctx['fingerprint'], $ctx['deviceLabel'], $ctx['browserName'], $ctx['osName'],
                    $ctx['ipAddress'], $ctx['locationEstimate'],
                    'pending', '', $expiresAtMs,
                ]);

                $baseUrl = app_base_url();
                $approveUrl = $baseUrl . '/email-action.php?loginConfirm=' . urlencode($approveToken) . '&action=approve';
                $denyUrl = $baseUrl . '/email-action.php?loginConfirm=' . urlencode($denyToken) . '&action=deny';
                $timeLabel = format_waktu_indonesia();

                $mailData = build_login_confirmation_email([
                    'fullName' => $admin['full_name'],
                    'username' => $admin['username'],
                    'timeLabel' => $timeLabel,
                    'deviceLabel' => $ctx['deviceLabel'],
                    'locationEstimate' => $ctx['locationEstimate'],
                    'ipAddress' => $ctx['ipAddress'],
                    'ttlMinutes' => $ttlMinutes,
                    'approveUrl' => $approveUrl,
                    'denyUrl' => $denyUrl,
                ]);

                $delivery = send_transactional_email($admin['email'], $mailData['subject'], $mailData['html'], $mailData['text']);
                record_email_outbox($admin['email'], $mailData['subject'], 'login_confirmation', $delivery, $mailData['html'], $mailData['text'], $chId);

                create_security_notification(
                    $admin['username'],
                    'login_confirmation_request',
                    'Permintaan Konfirmasi Login Baru',
                    "Percobaan login dari {$ctx['deviceLabel']} ({$ctx['locationEstimate']}) menunggu konfirmasi melalui email.",
                    'warning'
                );
                record_activity_log(
                    $admin['username'],
                    'PERMINTAAN_KONFIRMASI_LOGIN',
                    'Email konfirmasi IZINKAN / TOLAK LOGIN dikirim ke ' . mask_email_address((string) $admin['email']),
                    $ctx['deviceLabel'],
                    $ctx['ipAddress'],
                    $ctx['locationEstimate'],
                    'Menunggu'
                );

                $pendingChallenge = [
                    'challengeId' => $chId,
                    'pollSecret' => $pollSecret,
                    'maskedEmail' => mask_email_address((string) $admin['email']),
                    'deviceLabel' => $ctx['deviceLabel'],
                    'locationEstimate' => $ctx['locationEstimate'],
                    'ipAddress' => $ctx['ipAddress'],
                    'ttlMinutes' => $ttlMinutes,
                    'expiresAt' => $expiresAtMs,
                    'smtpConfigured' => is_smtp_configured(),
                    'deliveryStatus' => $delivery['deliveryStatus'],
                ];
                if (!is_smtp_configured()) {
                    $localEmailPreview = [
                        'approveUrl' => $approveUrl,
                        'denyUrl' => $denyUrl,
                    ];
                }
            } else {
                if ($trustedDevice) {
                    $db->prepare('UPDATE trusted_devices SET last_used_at = NOW(), ip_address = ? WHERE id = ?')
                       ->execute([$ctx['ipAddress'], $trustedDevice['id']]);
                } else {
                    $devToken = register_trusted_device($admin['username'], $ctx);
                    set_trusted_device_cookie($devToken);
                }

                create_security_notification(
                    $admin['username'],
                    'login_success',
                    'Login Berhasil ke SIMPANDADU',
                    "Sesi masuk berhasil dari {$ctx['deviceLabel']} ({$ctx['ipAddress']}).",
                    'success'
                );
                record_activity_log(
                    $admin['username'],
                    'LOGIN_BERHASIL',
                    'Berhasil masuk ke dashboard SIMPANDADU.',
                    $ctx['deviceLabel'],
                    $ctx['ipAddress'],
                    $ctx['locationEstimate'],
                    'Berhasil'
                );

                if ($hasVerifiedEmail && (int) $admin['notify_on_login_success'] === 1 && is_smtp_configured()) {
                    $alertMail = build_security_alert_email([
                        'title' => 'Login Berhasil ke SIMPANDADU',
                        'fullName' => $admin['full_name'],
                        'detail' => 'Akun administrator Anda baru saja berhasil masuk ke dashboard SIMPANDADU.',
                        'timeLabel' => format_waktu_indonesia(),
                        'deviceLabel' => $ctx['deviceLabel'],
                        'locationEstimate' => $ctx['locationEstimate'],
                        'ipAddress' => $ctx['ipAddress'],
                    ]);
                    $deliv = send_transactional_email($admin['email'], $alertMail['subject'], $alertMail['html'], $alertMail['text']);
                    record_email_outbox($admin['email'], $alertMail['subject'], 'security_alert', $deliv, $alertMail['html'], $alertMail['text']);
                }

                complete_admin_session_login($admin);
                set_flash('success', 'Login Berhasil', 'Selamat datang kembali di SIMPANDADU Desa Adimulya.');
                header('Location: dashboard.php');
                exit;
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Masuk Sistem — SIMPANDADU Desa Adimulya</title>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
<div class="login-shell">
  <section class="login-hero">
    <div style="display:flex;align-items:center;gap:14px;">
      <img src="assets/images/logo_desa_adimulya.jpg" alt="Lambang Desa Adimulya" style="width:56px;height:56px;border-radius:12px;object-fit:cover;border:2px solid #D97706;background:#fff;">
      <div>
        <div style="font-size:22px;font-weight:800;letter-spacing:0.5px;">SIMPANDADU</div>
        <div style="font-size:13px;color:#e2e8f0;">Pemerintah Desa Adimulya</div>
      </div>
    </div>
    <div>
      <h1 style="font-size:32px;line-height:1.25;margin:0 0 14px;">Sistem Informasi Perencanaan dan Administrasi Desa Adimulya Terpadu</h1>
      <p style="font-size:15px;color:#e2e8f0;line-height:1.7;margin:0;">
        Pusat pengelolaan inventaris aset desa, peta wilayah berbasis koordinat resmi, portal berita Indonesia terkini, usulan Musrenbang warga, serta perlindungan keamanan akun berbasis konfirmasi email.
      </p>
    </div>
    <div style="font-size:13px;color:#cbd5e1;">
      &copy; <?= date('Y') ?> Balai Desa Adimulya &bull; <a href="index.php" style="color:#FCD34D;">Kembali ke Portal Musrenbang Warga</a>
    </div>
  </section>

  <section class="login-form-panel">
    <div class="login-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
        <img src="assets/images/logo_desa_adimulya.jpg" alt="Logo" style="width:46px;height:46px;border-radius:10px;object-fit:cover;border:1px solid #cbd5e1;">
        <div>
          <h2 style="margin:0;font-size:20px;color:#0b1f3a;">SIMPANDADU</h2>
          <p style="margin:2px 0 0;font-size:12.5px;color:#64748b;">Sistem Informasi Perencanaan & Administrasi Desa Adimulya Terpadu</p>
        </div>
      </div>

      <?php if ($errorMsg !== ''): ?>
        <div class="alert alert-danger"><?= e($errorMsg) ?></div>
      <?php endif; ?>

      <?php if ($pendingChallenge): ?>
        <div class="alert alert-info">
          <strong>Konfirmasi Email Diperlukan</strong>
          <p style="margin:6px 0 0;">Kami telah mengirimkan permintaan konfirmasi ke email <strong><?= e($pendingChallenge['maskedEmail']) ?></strong>. Klik <strong>IZINKAN LOGIN</strong> pada email untuk melanjutkan masuk.</p>
        </div>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:13px;margin-bottom:16px;">
          <div><strong>Perangkat:</strong> <?= e($pendingChallenge['deviceLabel']) ?></div>
          <div><strong>Perkiraan Lokasi:</strong> <?= e($pendingChallenge['locationEstimate']) ?></div>
          <div><strong>Alamat IP:</strong> <?= e($pendingChallenge['ipAddress']) ?></div>
          <div style="margin-top:6px;"><strong>Status:</strong> <span id="challengeStatusLabel" class="badge badge-warning">Menunggu Konfirmasi Email...</span></div>
        </div>

        <?php if ($localEmailPreview): ?>
          <div class="alert alert-warning" style="font-size:12.5px;">
            <strong>Mode Uji Lokal (SMTP Belum Diatur di config/config.php)</strong><br>
            Gunakan tautan uji di bawah ini seolah-olah Anda membukanya dari kotak masuk email admin:
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
              <a href="<?= e($localEmailPreview['approveUrl']) ?>" target="_blank" class="btn btn-primary btn-sm">Simulasi Buka Tautan IZINKAN</a>
              <a href="<?= e($localEmailPreview['denyUrl']) ?>" target="_blank" class="btn btn-danger btn-sm">Simulasi Buka Tautan TOLAK</a>
            </div>
          </div>
        <?php endif; ?>

        <form id="completeLoginForm" method="post" action="login.php">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="complete_challenge">
          <input type="hidden" name="challenge_id" value="<?= e($pendingChallenge['challengeId']) ?>">
          <input type="hidden" name="poll_secret" value="<?= e($pendingChallenge['pollSecret']) ?>">
          <button type="submit" id="completeLoginBtn" class="btn btn-primary" style="width:100%;display:none;">Lanjutkan ke Dashboard</button>
        </form>
        <div style="margin-top:10px;text-align:center;">
          <a href="login.php" style="font-size:13px;">Batalkan & Kembali ke Form Login</a>
        </div>

        <script>
        (function () {
          var chId = <?= json_encode($pendingChallenge['challengeId']) ?>;
          var secret = <?= json_encode($pendingChallenge['pollSecret']) ?>;
          var statusEl = document.getElementById('challengeStatusLabel');
          var formEl = document.getElementById('completeLoginForm');
          var btnEl = document.getElementById('completeLoginBtn');
          var timer = setInterval(function () {
            fetch('api/login-status.php?challengeId=' + encodeURIComponent(chId) + '&pollSecret=' + encodeURIComponent(secret))
              .then(function (r) { return r.json(); })
              .then(function (data) {
                if (!data || !data.status) return;
                if (data.status === 'approved') {
                  clearInterval(timer);
                  statusEl.className = 'badge badge-success';
                  statusEl.textContent = 'Disetujui! Mengarahkan ke Dashboard...';
                  btnEl.style.display = 'inline-flex';
                  formEl.submit();
                } else if (data.status === 'denied') {
                  clearInterval(timer);
                  statusEl.className = 'badge badge-danger';
                  statusEl.textContent = 'Login Ditolak oleh Admin';
                } else if (data.status === 'expired') {
                  clearInterval(timer);
                  statusEl.className = 'badge badge-neutral';
                  statusEl.textContent = 'Permintaan Kedaluwarsa';
                }
              })
              .catch(function () {});
          }, 2500);
        })();
        </script>

      <?php elseif ($adminCount === 0): ?>
        <div class="alert alert-info">
          <strong>Pendaftaran Akun Admin Pertama</strong><br>
          Database belum memiliki akun admin. Buat akun administrator pertama Balai Desa Adimulya sekarang.
        </div>
        <form method="post" action="login.php">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="setup_first_admin">
          <div class="form-group">
            <label for="setup_full_name">Nama Lengkap *</label>
            <input type="text" id="setup_full_name" name="full_name" class="form-control" required value="<?= e($_POST['full_name'] ?? '') ?>">
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label for="setup_username">Username *</label>
              <input type="text" id="setup_username" name="username" class="form-control" required placeholder="admin_adimulya" value="<?= e($_POST['username'] ?? '') ?>">
            </div>
            <div class="form-group">
              <label for="setup_jabatan">Jabatan *</label>
              <input type="text" id="setup_jabatan" name="jabatan" class="form-control" required value="<?= e($_POST['jabatan'] ?? 'Administrator Balai Desa') ?>">
            </div>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label for="setup_email">Email Admin Aktif *</label>
              <input type="email" id="setup_email" name="email" class="form-control" required placeholder="admin@adimulya.desa.id" value="<?= e($_POST['email'] ?? '') ?>">
            </div>
            <div class="form-group">
              <label for="setup_phone">Nomor HP</label>
              <input type="text" id="setup_phone" name="phone" class="form-control" placeholder="08xxxxxxxxxx" value="<?= e($_POST['phone'] ?? '') ?>">
            </div>
          </div>
          <div class="form-group">
            <label for="setup_pw">Password (min. 8 karakter) *</label>
            <div class="input-password-wrap">
              <input type="password" id="setup_pw" name="password" class="form-control" required minlength="8">
              <button type="button" class="password-toggle-btn" data-toggle-password="setup_pw">Tampilkan</button>
            </div>
          </div>
          <div class="form-group">
            <label for="setup_pw2">Ulangi Password *</label>
            <div class="input-password-wrap">
              <input type="password" id="setup_pw2" name="password_confirm" class="form-control" required minlength="8">
              <button type="button" class="password-toggle-btn" data-toggle-password="setup_pw2">Tampilkan</button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Buat Akun & Masuk Dashboard</button>
        </form>

      <?php else: ?>
        <form method="post" action="login.php">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="login">
          <div class="form-group">
            <label for="login_username">Username</label>
            <input type="text" id="login_username" name="username" class="form-control" required autocomplete="username" placeholder="Masukkan username perangkat desa" value="<?= e($_POST['username'] ?? '') ?>">
          </div>
          <div class="form-group">
            <label for="login_password">Password</label>
            <div class="input-password-wrap">
              <input type="password" id="login_password" name="password" class="form-control" required autocomplete="current-password" placeholder="Masukkan password">
              <button type="button" class="password-toggle-btn" data-toggle-password="login_password">Tampilkan</button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;">Masuk</button>
        </form>
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0;text-align:center;font-size:13px;">
          Warga Desa Adimulya? <a href="index.php">Ajukan Usulan Musrenbang di sini</a>
        </div>
      <?php endif; ?>
    </div>
  </section>
</div>
<script src="assets/js/app.js"></script>
</body>
</html>
