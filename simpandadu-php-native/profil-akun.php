<?php
/**
 * Menu Profil Akun Admin SIMPANDADU (11 Fitur Lengkap + Keamanan Login Email + Riwayat Aktivitas)
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$admin = require_admin();
$db = get_db();
$ctx = parse_device_context();
$activeTab = (string) ($_GET['tab'] ?? 'profil');
$validTabs = ['profil', 'email_password', 'keamanan', 'riwayat'];
if (!in_array($activeTab, $validTabs, true)) {
    $activeTab = 'profil';
}

$localPreviewNotice = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf()) {
        set_flash('danger', 'Validasi Keamanan Gagal', 'Token CSRF tidak valid.');
        header('Location: profil-akun.php?tab=' . urlencode($activeTab));
        exit;
    }

    $action = $_POST['action'] ?? '';

    if ($action === 'upload_avatar') {
        if (!empty($_FILES['avatar'])) {
            $up = save_uploaded_image($_FILES['avatar'], UPLOAD_AVATARS_DIR, 'avatar-' . $admin['username']);
            if (isset($up['error'])) {
                set_flash('danger', 'Gagal Unggah Foto', $up['error']);
            } else {
                delete_confined_file(UPLOAD_AVATARS_DIR, $admin['avatar_file'] ?? null);
                $db->prepare('UPDATE admin_accounts SET avatar_file = ?, updated_at = NOW() WHERE username = ?')
                   ->execute([$up['fileName'], $admin['username']]);
                record_activity_log($admin['username'], 'UNGGAH_FOTO_PROFIL', 'Memperbarui foto profil admin.', $ctx['deviceLabel'], $ctx['ipAddress'], $ctx['locationEstimate'], 'Berhasil');
                set_flash('success', 'Foto Profil Diperbarui', 'Foto profil akun berhasil disimpan.');
            }
        }
        header('Location: profil-akun.php?tab=profil');
        exit;
    }

    if ($action === 'delete_avatar') {
        delete_confined_file(UPLOAD_AVATARS_DIR, $admin['avatar_file'] ?? null);
        $db->prepare('UPDATE admin_accounts SET avatar_file = NULL, updated_at = NOW() WHERE username = ?')
           ->execute([$admin['username']]);
        set_flash('info', 'Foto Profil Dihapus', 'Foto profil dikembalikan ke inisial akun.');
        header('Location: profil-akun.php?tab=profil');
        exit;
    }

    if ($action === 'update_profile') {
        $fullName = trim((string) ($_POST['full_name'] ?? ''));
        $phone = trim((string) ($_POST['phone'] ?? ''));
        $jabatan = trim((string) ($_POST['jabatan'] ?? ''));
        if ($fullName === '' || $jabatan === '') {
            set_flash('danger', 'Data Wajib Kosong', 'Nama lengkap dan jabatan tidak boleh kosong.');
        } else {
            $db->prepare('UPDATE admin_accounts SET full_name = ?, phone = ?, jabatan = ?, role = ?, updated_at = NOW() WHERE username = ?')
               ->execute([$fullName, $phone, $jabatan, $jabatan, $admin['username']]);
            create_security_notification($admin['username'], 'profile_updated', 'Informasi Profil Diperbarui', "Data profil {$fullName} ({$jabatan}) diperbarui.", 'info');
            record_activity_log($admin['username'], 'UBAH_PROFIL', 'Memperbarui nama lengkap, nomor HP, atau jabatan.', $ctx['deviceLabel'], $ctx['ipAddress'], $ctx['locationEstimate'], 'Berhasil');
            set_flash('success', 'Profil Disimpan', 'Informasi akun admin berhasil diperbarui.');
        }
        header('Location: profil-akun.php?tab=profil');
        exit;
    }

    if ($action === 'change_password') {
        $currentPw = (string) ($_POST['current_password'] ?? '');
        $newPw = (string) ($_POST['new_password'] ?? '');
        $confirmPw = (string) ($_POST['confirm_password'] ?? '');
        if (!password_verify($currentPw, (string) $admin['password_hash'])) {
            set_flash('danger', 'Password Lama Salah', 'Verifikasi password saat ini gagal.');
        } elseif (strlen($newPw) < 8) {
            set_flash('danger', 'Password Terlalu Pendek', 'Password baru minimal 8 karakter.');
        } elseif ($newPw !== $confirmPw) {
            set_flash('danger', 'Konfirmasi Tidak Cocok', 'Password baru dan ulangi password harus sama.');
        } else {
            $newHash = password_hash($newPw, PASSWORD_DEFAULT);
            $db->prepare('UPDATE admin_accounts SET password_hash = ?, updated_at = NOW() WHERE username = ?')
               ->execute([$newHash, $admin['username']]);
            create_security_notification($admin['username'], 'password_changed', 'Password Akun Diubah', "Password berhasil diganti dari {$ctx['deviceLabel']}.", 'warning');
            record_activity_log($admin['username'], 'GANTI_PASSWORD', 'Password akun diperbarui.', $ctx['deviceLabel'], $ctx['ipAddress'], $ctx['locationEstimate'], 'Berhasil');
            if (!empty($admin['email']) && (int) $admin['email_verified'] === 1 && is_smtp_configured()) {
                $mail = build_security_alert_email([
                    'title' => 'Perubahan Password Akun Admin',
                    'fullName' => $admin['full_name'],
                    'detail' => 'Password akun SIMPANDADU Anda baru saja diubah.',
                    'timeLabel' => format_waktu_indonesia(),
                    'deviceLabel' => $ctx['deviceLabel'],
                    'locationEstimate' => $ctx['locationEstimate'],
                    'ipAddress' => $ctx['ipAddress'],
                ]);
                $deliv = send_transactional_email($admin['email'], $mail['subject'], $mail['html'], $mail['text']);
                record_email_outbox($admin['email'], $mail['subject'], 'security_alert', $deliv, $mail['html'], $mail['text']);
            }
            set_flash('success', 'Password Diperbarui', 'Password akun berhasil diubah.');
        }
        header('Location: profil-akun.php?tab=email_password');
        exit;
    }

    if ($action === 'request_email_change') {
        $newEmail = trim((string) ($_POST['new_email'] ?? ''));
        $currentPw = (string) ($_POST['current_password'] ?? '');
        if (!password_verify($currentPw, (string) $admin['password_hash'])) {
            set_flash('danger', 'Verifikasi Password Gagal', 'Masukkan password saat ini dengan benar sebelum mengubah email.');
        } elseif (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            set_flash('danger', 'Email Tidak Valid', 'Masukkan alamat email aktif yang benar.');
        } else {
            $rawToken = bin2hex(random_bytes(24));
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $expiresMs = (int) round((microtime(true) + 1800) * 1000);
            $db->prepare('INSERT INTO email_verification_tokens (id, username, new_email, token_hash, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())')
               ->execute(['evt-' . generate_uuid_v4(), $admin['username'], $newEmail, sha256_hex($rawToken), sha256_hex($code), $expiresMs]);
            $db->prepare('UPDATE admin_accounts SET pending_email = ?, updated_at = NOW() WHERE username = ?')
               ->execute([$newEmail, $admin['username']]);

            $verifyUrl = app_base_url() . '/email-action.php?verifyEmail=' . urlencode($rawToken);
            $mail = build_email_verification_email([
                'fullName' => $admin['full_name'],
                'newEmail' => $newEmail,
                'code' => $code,
                'verifyUrl' => $verifyUrl,
            ]);
            $deliv = send_transactional_email($newEmail, $mail['subject'], $mail['html'], $mail['text']);
            record_email_outbox($newEmail, $mail['subject'], 'email_verification', $deliv, $mail['html'], $mail['text']);
            record_activity_log($admin['username'], 'PENGAJUAN_UBAH_EMAIL', "Mengajukan verifikasi email baru ke {$newEmail}.", $ctx['deviceLabel'], $ctx['ipAddress'], $ctx['locationEstimate'], 'Menunggu');

            if (is_smtp_configured()) {
                set_flash('success', 'Email Verifikasi Terkirim', "Kode 6 digit dan tautan verifikasi telah dikirim ke {$newEmail}.");
            } else {
                $_SESSION['dev_verify_preview'] = ['newEmail' => $newEmail, 'code' => $code, 'verifyUrl' => $verifyUrl];
                set_flash('info', 'Verifikasi Email Siap (Mode Uji Lokal)', "SMTP belum diisi di config/config.php. Gunakan kode {$code} atau tautan pratinjau di bawah.");
            }
        }
        header('Location: profil-akun.php?tab=email_password');
        exit;
    }

    if ($action === 'verify_email_code') {
        $code = trim((string) ($_POST['verification_code'] ?? ''));
        $stmt = $db->prepare('SELECT * FROM email_verification_tokens WHERE username = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1');
        $stmt->execute([$admin['username']]);
        $row = $stmt->fetch();
        $nowMs = (int) round(microtime(true) * 1000);
        if (!$row || $nowMs > (int) $row['expires_at'] || !hash_equals((string) $row['code_hash'], sha256_hex($code))) {
            set_flash('danger', 'Kode Verifikasi Tidak Valid', 'Kode salah atau telah kedaluwarsa.');
        } else {
            $db->prepare('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?')->execute([$row['id']]);
            $db->prepare('UPDATE admin_accounts SET email = ?, email_verified = 1, pending_email = NULL, updated_at = NOW() WHERE username = ?')
               ->execute([$row['new_email'], $admin['username']]);
            unset($_SESSION['dev_verify_preview']);
            create_security_notification($admin['username'], 'profile_updated', 'Email Admin Terverifikasi', "Email akun aktif menjadi {$row['new_email']}.", 'success');
            record_activity_log($admin['username'], 'VERIFIKASI_EMAIL_BARU', "Email terverifikasi menjadi {$row['new_email']}.", $ctx['deviceLabel'], $ctx['ipAddress'], $ctx['locationEstimate'], 'Berhasil');
            set_flash('success', 'Email Terverifikasi', "Alamat email {$row['new_email']} kini aktif.");
        }
        header('Location: profil-akun.php?tab=email_password');
        exit;
    }

    if ($action === 'update_security_settings') {
        $reqApproval = !empty($_POST['require_email_login_approval']) ? 1 : 0;
        $notifySuccess = !empty($_POST['notify_on_login_success']) ? 1 : 0;
        $notifyChange = !empty($_POST['notify_on_security_change']) ? 1 : 0;
        $ttl = max(3, min(30, (int) ($_POST['login_approval_ttl_minutes'] ?? 10)));
        $policy = ($_POST['approval_policy'] ?? 'new_device') === 'every_login' ? 'every_login' : 'new_device';

        $db->prepare(
            'UPDATE admin_accounts
             SET require_email_login_approval = ?, notify_on_login_success = ?, notify_on_security_change = ?,
                 login_approval_ttl_minutes = ?, approval_policy = ?, updated_at = NOW()
             WHERE username = ?'
        )->execute([$reqApproval, $notifySuccess, $notifyChange, $ttl, $policy, $admin['username']]);
        create_security_notification($admin['username'], 'security_alert', 'Pengaturan Keamanan Diperbarui', 'Preferensi konfirmasi login email diperbarui.', 'info');
        record_activity_log($admin['username'], 'UBAH_PENGATURAN_KEAMANAN', 'Memperbarui kebijakan konfirmasi login email.', $ctx['deviceLabel'], $ctx['ipAddress'], $ctx['locationEstimate'], 'Berhasil');
        set_flash('success', 'Pengaturan Keamanan Disimpan', 'Kebijakan keamanan akun telah diperbarui.');
        header('Location: profil-akun.php?tab=keamanan');
        exit;
    }

    if ($action === 'revoke_device') {
        $devId = trim((string) ($_POST['device_id'] ?? ''));
        if ($devId !== '') {
            $db->prepare('UPDATE trusted_devices SET revoked_at = NOW() WHERE id = ? AND username = ?')
               ->execute([$devId, $admin['username']]);
            record_activity_log($admin['username'], 'CABUT_PERANGKAT', 'Mencabut izin perangkat terpercaya.', $ctx['deviceLabel'], $ctx['ipAddress'], $ctx['locationEstimate'], 'Peringatan');
            set_flash('info', 'Perangkat Dicabut', 'Login berikutnya dari perangkat tersebut wajib konfirmasi email.');
        }
        header('Location: profil-akun.php?tab=keamanan');
        exit;
    }

    if ($action === 'test_email') {
        if (empty($admin['email'])) {
            set_flash('warning', 'Email Belum Diisi', 'Simpan dan verifikasi email admin terlebih dahulu.');
        } else {
            $mail = build_security_alert_email([
                'title' => 'Uji Pengiriman Email SMTP SIMPANDADU',
                'fullName' => $admin['full_name'],
                'detail' => 'Pengujian koneksi pengiriman email keamanan SIMPANDADU berhasil diproses.',
                'timeLabel' => format_waktu_indonesia(),
                'deviceLabel' => $ctx['deviceLabel'],
                'locationEstimate' => $ctx['locationEstimate'],
                'ipAddress' => $ctx['ipAddress'],
            ]);
            $deliv = send_transactional_email($admin['email'], $mail['subject'], $mail['html'], $mail['text']);
            record_email_outbox($admin['email'], $mail['subject'], 'test_email', $deliv, $mail['html'], $mail['text']);
            if ($deliv['deliveryStatus'] === 'sent') {
                set_flash('success', 'Email Uji Terkirim', "Email uji berhasil dikirim melalui SMTP ke {$admin['email']}.");
            } elseif ($deliv['deliveryStatus'] === 'failed') {
                set_flash('danger', 'Pengiriman SMTP Gagal', $deliv['errorMessage']);
            } else {
                set_flash('info', 'Mode Uji Lokal', 'SMTP belum diisi pada config/config.php. Log pratinjau tersimpan di database.');
            }
        }
        header('Location: profil-akun.php?tab=keamanan');
        exit;
    }
}

// Muat ulang data admin terbaru
$admin = get_admin_by_username($admin['username']) ?: $admin;
$smtpStatus = get_smtp_status();
$devPreview = $_SESSION['dev_verify_preview'] ?? null;

$devicesStmt = $db->prepare('SELECT * FROM trusted_devices WHERE username = ? AND revoked_at IS NULL ORDER BY last_used_at DESC');
$devicesStmt->execute([$admin['username']]);
$trustedDevices = $devicesStmt->fetchAll();

$statusFilter = trim((string) ($_GET['status'] ?? 'Semua'));
$actSql = 'SELECT * FROM activity_logs WHERE username = ?';
$actParams = [$admin['username']];
if ($statusFilter !== '' && $statusFilter !== 'Semua') {
    $actSql .= ' AND status = ?';
    $actParams[] = $statusFilter;
}
$actSql .= ' ORDER BY created_at DESC LIMIT 40';
$actStmt = $db->prepare($actSql);
$actStmt->execute($actParams);
$activities = $actStmt->fetchAll();

$activePage = 'profil';
$pageTitle = 'Profil Akun Admin';
$pageSubtitle = 'Kelola Identitas Akun, Email Terverifikasi, Password, Keamanan Login Email, & Riwayat Aktivitas';

require __DIR__ . '/includes/header.php';

$avatarUrlProfile = !empty($admin['avatar_file'])
    ? 'uploads/avatars/' . rawurlencode(basename((string) $admin['avatar_file']))
    : null;
$initialsProfile = strtoupper(substr(trim((string) $admin['full_name']), 0, 2) ?: 'AD');
?>

<div class="tabs-bar">
  <a href="profil-akun.php?tab=profil" class="tab-btn <?= $activeTab === 'profil' ? 'active' : '' ?>" style="text-decoration:none;">1. Informasi Profil</a>
  <a href="profil-akun.php?tab=email_password" class="tab-btn <?= $activeTab === 'email_password' ? 'active' : '' ?>" style="text-decoration:none;">2. Ubah Email & Password</a>
  <a href="profil-akun.php?tab=keamanan" class="tab-btn <?= $activeTab === 'keamanan' ? 'active' : '' ?>" style="text-decoration:none;">3. Pengaturan Keamanan</a>
  <a href="profil-akun.php?tab=riwayat" class="tab-btn <?= $activeTab === 'riwayat' ? 'active' : '' ?>" style="text-decoration:none;">4. Riwayat Aktivitas & Login</a>
</div>

<?php if ($activeTab === 'profil'): ?>
  <div class="grid-2" style="align-items:start;">
    <section class="card">
      <div class="card-header"><h2 class="card-title">Foto Profil & Ringkasan Akun</h2></div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
        <?php if ($avatarUrlProfile): ?>
          <img src="<?= e($avatarUrlProfile) ?>" alt="Foto Profil Admin" style="width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #D97706;">
        <?php else: ?>
          <div style="width:84px;height:84px;border-radius:50%;background:#0B1F3A;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;border:3px solid #D97706;"><?= e($initialsProfile) ?></div>
        <?php endif; ?>
        <div>
          <h3 style="margin:0;font-size:18px;color:#0b1f3a;"><?= e($admin['full_name']) ?></h3>
          <div style="font-size:13.5px;color:#475569;"><?= e($admin['jabatan']) ?></div>
          <div style="font-size:12.5px;color:#64748b;">Username: <strong><?= e($admin['username']) ?></strong></div>
        </div>
      </div>

      <form method="post" action="profil-akun.php?tab=profil" enctype="multipart/form-data" style="margin-bottom:12px;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="upload_avatar">
        <div class="form-group">
          <label for="avatar_file">Unggah Foto Profil Baru (JPG/PNG/WebP maks. 2 MB)</label>
          <input type="file" id="avatar_file" name="avatar" class="form-control" accept="image/jpeg,image/png,image/webp" required>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">Simpan Foto Profil</button>
      </form>

      <?php if ($avatarUrlProfile): ?>
        <form method="post" action="profil-akun.php?tab=profil">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="delete_avatar">
          <button type="submit" class="btn btn-outline btn-sm">Hapus Foto Profil</button>
        </form>
      <?php endif; ?>
    </section>

    <section class="card">
      <div class="card-header"><h2 class="card-title">Edit Informasi Profil Admin</h2></div>
      <form method="post" action="profil-akun.php?tab=profil">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="update_profile">
        <div class="form-group">
          <label>Username</label>
          <input type="text" class="form-control" value="<?= e($admin['username']) ?>" disabled>
        </div>
        <div class="form-group">
          <label for="pf_name">Nama Lengkap *</label>
          <input type="text" id="pf_name" name="full_name" class="form-control" value="<?= e($admin['full_name']) ?>" required>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label for="pf_phone">Nomor HP</label>
            <input type="text" id="pf_phone" name="phone" class="form-control" value="<?= e($admin['phone']) ?>">
          </div>
          <div class="form-group">
            <label for="pf_jabatan">Jabatan *</label>
            <input type="text" id="pf_jabatan" name="jabatan" class="form-control" value="<?= e($admin['jabatan']) ?>" required>
          </div>
        </div>
        <div class="form-group">
          <label>Email Aktif</label>
          <input type="text" class="form-control" value="<?= e($admin['email'] ?: 'Belum terdaftar') ?> <?= (int)$admin['email_verified'] === 1 ? '(Terverifikasi)' : '(Belum Terverifikasi)' ?>" disabled>
        </div>
        <button type="submit" class="btn btn-primary">Simpan Perubahan Profil</button>
      </form>
    </section>
  </div>

<?php elseif ($activeTab === 'email_password'): ?>
  <div class="grid-2" style="align-items:start;">
    <section class="card">
      <div class="card-header"><h2 class="card-title">Ubah Email dengan Verifikasi Email Baru</h2></div>
      <p style="font-size:13.5px;color:#475569;margin-top:0;">
        Email aktif saat ini: <strong><?= e($admin['email'] ?: 'Belum ada') ?></strong>
        <?= (int) $admin['email_verified'] === 1 ? '<span class="badge badge-success">Terverifikasi</span>' : '<span class="badge badge-warning">Belum Terverifikasi</span>' ?>
      </p>

      <form method="post" action="profil-akun.php?tab=email_password">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="request_email_change">
        <div class="form-group">
          <label for="new_email">Alamat Email Baru *</label>
          <input type="email" id="new_email" name="new_email" class="form-control" required placeholder="nama@adimulya.desa.id">
        </div>
        <div class="form-group">
          <label for="email_pw">Konfirmasi Password Saat Ini *</label>
          <div class="input-password-wrap">
            <input type="password" id="email_pw" name="current_password" class="form-control" required>
            <button type="button" class="password-toggle-btn" data-toggle-password="email_pw">Tampilkan</button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Kirim Verifikasi ke Email Baru</button>
      </form>

      <?php if (!empty($admin['pending_email'])): ?>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;">
        <h3 style="margin:0 0 8px;font-size:15px;color:#0b1f3a;">Verifikasi Email Menunggu: <?= e($admin['pending_email']) ?></h3>
        <?php if ($devPreview): ?>
          <div class="alert alert-info" style="font-size:12.5px;">
            Mode Uji Lokal — Kode: <strong><?= e($devPreview['code']) ?></strong> atau <a href="<?= e($devPreview['verifyUrl']) ?>" target="_blank">Klik Tautan Verifikasi</a>
          </div>
        <?php endif; ?>
        <form method="post" action="profil-akun.php?tab=email_password" style="display:flex;gap:8px;">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="verify_email_code">
          <input type="text" name="verification_code" class="form-control" placeholder="Masukkan kode 6 digit" maxlength="6" required>
          <button type="submit" class="btn btn-navy">Verifikasi</button>
        </form>
      <?php endif; ?>
    </section>

    <section class="card">
      <div class="card-header"><h2 class="card-title">Ganti Password Akun</h2></div>
      <form method="post" action="profil-akun.php?tab=email_password">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="change_password">
        <div class="form-group">
          <label for="old_pw">Password Saat Ini *</label>
          <div class="input-password-wrap">
            <input type="password" id="old_pw" name="current_password" class="form-control" required>
            <button type="button" class="password-toggle-btn" data-toggle-password="old_pw">Tampilkan</button>
          </div>
        </div>
        <div class="form-group">
          <label for="new_pw">Password Baru (min. 8 karakter) *</label>
          <div class="input-password-wrap">
            <input type="password" id="new_pw" name="new_password" class="form-control" required minlength="8">
            <button type="button" class="password-toggle-btn" data-toggle-password="new_pw">Tampilkan</button>
          </div>
        </div>
        <div class="form-group">
          <label for="cnf_pw">Ulangi Password Baru *</label>
          <div class="input-password-wrap">
            <input type="password" id="cnf_pw" name="confirm_password" class="form-control" required minlength="8">
            <button type="button" class="password-toggle-btn" data-toggle-password="cnf_pw">Tampilkan</button>
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Perbarui Password</button>
      </form>
    </section>
  </div>

<?php elseif ($activeTab === 'keamanan'): ?>
  <div class="grid-2" style="align-items:start;">
    <section class="card">
      <div class="card-header"><h2 class="card-title">Pengaturan Konfirmasi Login Email</h2></div>
      <form method="post" action="profil-akun.php?tab=keamanan">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="update_security_settings">
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" name="require_email_login_approval" value="1" <?= (int)$admin['require_email_login_approval'] === 1 ? 'checked' : '' ?>>
            <span>Wajibkan konfirmasi email (IZINKAN / TOLAK LOGIN) saat masuk</span>
          </label>
        </div>
        <div class="form-group">
          <label for="approval_policy">Kebijakan Verifikasi Perangkat</label>
          <select id="approval_policy" name="approval_policy" class="form-control">
            <option value="new_device" <?= $admin['approval_policy'] === 'new_device' ? 'selected' : '' ?>>Hanya Perangkat atau Sesi Baru</option>
            <option value="every_login" <?= $admin['approval_policy'] === 'every_login' ? 'selected' : '' ?>>Setiap Kali Percobaan Login</option>
          </select>
        </div>
        <div class="form-group">
          <label for="ttl_minutes">Batas Waktu Kedaluwarsa Tautan (menit)</label>
          <input type="number" id="ttl_minutes" name="login_approval_ttl_minutes" min="3" max="30" class="form-control" value="<?= (int) $admin['login_approval_ttl_minutes'] ?>">
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" name="notify_on_login_success" value="1" <?= (int)$admin['notify_on_login_success'] === 1 ? 'checked' : '' ?>>
            <span>Kirim notifikasi email saat login berhasil</span>
          </label>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" name="notify_on_security_change" value="1" <?= (int)$admin['notify_on_security_change'] === 1 ? 'checked' : '' ?>>
            <span>Kirim notifikasi saat ada perubahan password atau keamanan</span>
          </label>
        </div>
        <button type="submit" class="btn btn-primary">Simpan Pengaturan Keamanan</button>
      </form>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;">
      <div style="font-size:13.5px;margin-bottom:10px;">
        <strong>Status Layanan SMTP:</strong>
        <?php if ($smtpStatus['configured']): ?>
          <span class="badge badge-success">Aktif (<?= e($smtpStatus['hostLabel']) ?>:<?= (int) $smtpStatus['port'] ?>)</span>
        <?php else: ?>
          <span class="badge badge-warning">Belum Diisi di config/config.php</span>
        <?php endif; ?>
      </div>
      <form method="post" action="profil-akun.php?tab=keamanan">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="test_email">
        <button type="submit" class="btn btn-outline btn-sm">Uji Pengiriman Email ke <?= e($admin['email'] ?: 'Email Admin') ?></button>
      </form>
    </section>

    <section class="card">
      <div class="card-header"><h2 class="card-title">Daftar Perangkat Terpercaya</h2></div>
      <?php if (empty($trustedDevices)): ?>
        <p style="font-size:13.5px;color:#64748b;margin:0;">Belum ada perangkat terpercaya terdaftar.</p>
      <?php else: ?>
        <?php foreach ($trustedDevices as $dev): ?>
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div>
              <strong style="font-size:13.5px;"><?= e($dev['device_label']) ?></strong>
              <div style="font-size:12px;color:#64748b;"><?= e($dev['location_estimate']) ?> (<?= e($dev['ip_address']) ?>)</div>
              <div style="font-size:11.5px;color:#64748b;" class="tabular-nums">Terakhir aktif: <?= e(format_waktu_indonesia($dev['last_used_at'])) ?></div>
            </div>
            <form method="post" action="profil-akun.php?tab=keamanan">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="revoke_device">
              <input type="hidden" name="device_id" value="<?= e($dev['id']) ?>">
              <button type="submit" class="btn btn-danger btn-sm">Cabut</button>
            </form>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </section>
  </div>

<?php else: ?>
  <section class="card">
    <div class="card-header">
      <h2 class="card-title">Riwayat Aktivitas & Keamanan Login</h2>
      <form method="get" action="profil-akun.php" style="display:flex;gap:8px;">
        <input type="hidden" name="tab" value="riwayat">
        <select name="status" class="form-control" style="max-width:190px;">
          <?php foreach (['Semua', 'Berhasil', 'Menunggu', 'Disetujui', 'Ditolak', 'Kedaluwarsa', 'Peringatan'] as $st): ?>
            <option value="<?= e($st) ?>" <?= $statusFilter === $st ? 'selected' : '' ?>><?= e($st) ?></option>
          <?php endforeach; ?>
        </select>
        <button type="submit" class="btn btn-navy btn-sm">Filter</button>
      </form>
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Aktivitas</th>
            <th>Keterangan</th>
            <th>Perangkat & Lokasi</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <?php if (empty($activities)): ?>
            <tr><td colspan="5" style="text-align:center;color:#64748b;padding:20px;">Belum ada catatan aktivitas.</td></tr>
          <?php else: ?>
            <?php foreach ($activities as $act): ?>
              <?php
                $badge = match ($act['status']) {
                    'Berhasil', 'Disetujui' => 'badge-success',
                    'Ditolak' => 'badge-danger',
                    'Menunggu', 'Peringatan' => 'badge-warning',
                    default => 'badge-neutral',
                };
              ?>
              <tr>
                <td class="tabular-nums" style="white-space:nowrap;"><?= e(format_waktu_indonesia($act['created_at'])) ?></td>
                <td><strong><?= e($act['event_type']) ?></strong></td>
                <td><?= e($act['description']) ?></td>
                <td><?= e($act['device_label']) ?><br><span style="font-size:12px;color:#64748b;"><?= e($act['location_estimate']) ?> (<?= e($act['ip_address']) ?>)</span></td>
                <td><span class="badge <?= $badge ?>"><?= e($act['status']) ?></span></td>
              </tr>
            <?php endforeach; ?>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
