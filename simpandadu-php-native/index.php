<?php
/**
 * Portal Warga Musrenbang Desa Adimulya (Akses Publik Tanpa Login)
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$db = get_db();
$submittedTicket = null;
$formError = '';

$categories = ['Infrastruktur', 'Pendidikan', 'Kesehatan', 'Ekonomi', 'Pertanian', 'Sarana dan Prasarana', 'Lingkungan'];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'submit_proposal') {
    if (!verify_csrf()) {
        $formError = 'Validasi keamanan formulir gagal. Silakan muat ulang halaman.';
    } else {
        $nama = trim((string) ($_POST['nama_pengusul'] ?? ''));
        $hp = trim((string) ($_POST['nomor_hp'] ?? ''));
        $dusun = trim((string) ($_POST['dusun'] ?? ''));
        $rtRw = trim((string) ($_POST['rt_rw'] ?? ''));
        $kategori = trim((string) ($_POST['kategori'] ?? ''));
        $judul = trim((string) ($_POST['judul_usulan'] ?? ''));
        $lokasi = trim((string) ($_POST['lokasi'] ?? ''));
        $deskripsi = trim((string) ($_POST['deskripsi'] ?? ''));

        if ($nama === '' || $hp === '' || $dusun === '' || $judul === '' || $lokasi === '' || $deskripsi === '') {
            $formError = 'Mohon lengkapi seluruh kolom wajib bertanda bintang (*).';
        } elseif (!in_array($kategori, $categories, true)) {
            $formError = 'Kategori usulan tidak valid.';
        } else {
            $fotoFile = null;
            if (!empty($_FILES['foto_lokasi']) && ($_FILES['foto_lokasi']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $upload = save_uploaded_image($_FILES['foto_lokasi'], UPLOAD_PROPOSALS_DIR, 'mus-warga');
                if (isset($upload['error'])) {
                    $formError = $upload['error'];
                } else {
                    $fotoFile = $upload['fileName'];
                }
            }

            if ($formError === '') {
                $year = date('Y');
                $count = (int) $db->query('SELECT COUNT(*) FROM musrenbang_proposals')->fetchColumn();
                $seq = $count + 1;
                do {
                    $nomor = sprintf('MSRB-%s-%04d', $year, $seq);
                    $chk = $db->prepare('SELECT 1 FROM musrenbang_proposals WHERE nomor_pengajuan = ? LIMIT 1');
                    $chk->execute([$nomor]);
                    $exists = (bool) $chk->fetchColumn();
                    $seq++;
                } while ($exists);

                $id = 'mus-' . bin2hex(random_bytes(6));
                $stmt = $db->prepare(
                    'INSERT INTO musrenbang_proposals (
                        id, nomor_pengajuan, sumber, nama_pengusul, nomor_hp, dusun, rt_rw,
                        judul_usulan, kategori, lokasi, tanggal_pengajuan, prioritas, status,
                        estimasi_anggaran, deskripsi, catatan_verifikasi, catatan_untuk_pengusul,
                        foto_file, dipublikasikan, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())'
                );
                $stmt->execute([
                    $id, $nomor, 'Warga', $nama, $hp, $dusun, $rtRw,
                    $judul, $kategori, $lokasi, 'Sedang', 'Menunggu Verifikasi',
                    'Menunggu verifikasi RAB desa', $deskripsi, '', 'Usulan berhasil diterima sistem dan sedang menunggu verifikasi perangkat desa.',
                    $fotoFile,
                ]);
                $submittedTicket = $nomor;
            }
        }
    }
}

// Cek status berdasarkan nomor pengajuan (tanpa membuka nama / nomor HP warga)
$lookupQuery = trim((string) ($_GET['cek'] ?? ''));
$lookupResult = null;
$lookupNotFound = false;
if ($lookupQuery !== '') {
    $stmt = $db->prepare(
        'SELECT nomor_pengajuan, judul_usulan, kategori, dusun, lokasi, tanggal_pengajuan, prioritas, status, deskripsi, catatan_untuk_pengusul, dipublikasikan, updated_at
         FROM musrenbang_proposals WHERE UPPER(nomor_pengajuan) = UPPER(?) LIMIT 1'
    );
    $stmt->execute([$lookupQuery]);
    $lookupResult = $stmt->fetch();
    if (!$lookupResult) {
        $lookupNotFound = true;
    }
}

// Daftar usulan publik yang disetujui & dipublikasikan (tanpa identitas pribadi pengusul)
$publicProposals = $db->query(
    'SELECT nomor_pengajuan, judul_usulan, kategori, dusun, lokasi, tanggal_pengajuan, prioritas, status, estimasi_anggaran, deskripsi, catatan_untuk_pengusul
     FROM musrenbang_proposals
     WHERE dipublikasikan = 1
     ORDER BY updated_at DESC
     LIMIT 12'
)->fetchAll();

$isAdminLoggedIn = current_admin() !== null;
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SIMPANDADU — Portal Usulan Musrenbang Warga Desa Adimulya</title>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
  <header class="public-header">
    <div class="public-header-inner">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="assets/images/logo_desa_adimulya.jpg" alt="Lambang Desa Adimulya" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:2px solid #D97706;background:#fff;">
        <div>
          <div style="font-weight:800;font-size:17px;letter-spacing:0.4px;">SIMPANDADU</div>
          <div style="font-size:12px;color:#cbd5e1;">Sistem Informasi Perencanaan & Administrasi Desa Adimulya Terpadu</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <a href="#cek-status" class="btn btn-outline btn-sm" style="background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.25);color:#fff;">Cek Status Usulan</a>
        <?php if ($isAdminLoggedIn): ?>
          <a href="dashboard.php" class="btn btn-gold btn-sm">Buka Dashboard Admin</a>
        <?php else: ?>
          <a href="login.php" class="btn btn-gold btn-sm">Masuk Perangkat Desa</a>
        <?php endif; ?>
      </div>
    </div>
  </header>

  <main class="public-container">
    <div class="card" style="background:linear-gradient(120deg,#0B1F3A 0%,#1D4ED8 100%);color:#fff;margin-bottom:24px;border:none;">
      <h1 style="margin:0 0 8px;font-size:24px;">Portal Usulan Musrenbang Masyarakat Desa Adimulya</h1>
      <p style="margin:0;color:#e2e8f0;max-width:760px;">
        Sampaikan aspirasi dan usulan pembangunan desa secara langsung melalui formulir di bawah ini. Setiap usulan memperoleh nomor pengajuan otomatis untuk memantau proses verifikasi oleh Pemerintah Desa Adimulya.
      </p>
    </div>

    <?php if ($submittedTicket): ?>
      <div class="alert alert-success">
        <strong>Usulan Musrenbang Berhasil Dikirim!</strong>
        <p style="margin:6px 0 4px;">Simpan nomor pengajuan Anda untuk mengecek perkembangan verifikasi:</p>
        <div style="font-size:20px;font-weight:800;color:#0b1f3a;" class="tabular-nums"><?= e($submittedTicket) ?></div>
      </div>
    <?php endif; ?>

    <?php if ($formError !== ''): ?>
      <div class="alert alert-danger"><?= e($formError) ?></div>
    <?php endif; ?>

    <div class="grid-2" style="align-items:start;">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Formulir Pengajuan Usulan Warga</h2>
          <span class="badge badge-info">Tanpa Perlu Login</span>
        </div>

        <form method="post" action="index.php" enctype="multipart/form-data">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="submit_proposal">

          <div class="form-grid">
            <div class="form-group">
              <label for="nama_pengusul">Nama Lengkap Pengusul *</label>
              <input type="text" id="nama_pengusul" name="nama_pengusul" class="form-control" required placeholder="Contoh: Ahmad Hidayat" value="<?= e($_POST['nama_pengusul'] ?? '') ?>">
            </div>
            <div class="form-group">
              <label for="nomor_hp">Nomor HP / WhatsApp *</label>
              <input type="text" id="nomor_hp" name="nomor_hp" class="form-control" required placeholder="08xxxxxxxxxx" value="<?= e($_POST['nomor_hp'] ?? '') ?>">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label for="dusun">Dusun *</label>
              <input type="text" id="dusun" name="dusun" class="form-control" required placeholder="Contoh: Dusun I" value="<?= e($_POST['dusun'] ?? '') ?>">
            </div>
            <div class="form-group">
              <label for="rt_rw">RT / RW</label>
              <input type="text" id="rt_rw" name="rt_rw" class="form-control" placeholder="Contoh: RT 02 / RW 01" value="<?= e($_POST['rt_rw'] ?? '') ?>">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label for="kategori">Kategori Usulan *</label>
              <select id="kategori" name="kategori" class="form-control" required>
                <?php foreach ($categories as $cat): ?>
                  <option value="<?= e($cat) ?>" <?= (($_POST['kategori'] ?? '') === $cat) ? 'selected' : '' ?>><?= e($cat) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="form-group">
              <label for="lokasi">Lokasi Kegiatan *</label>
              <input type="text" id="lokasi" name="lokasi" class="form-control" required placeholder="Contoh: Jalan Lingkungan RT 02" value="<?= e($_POST['lokasi'] ?? '') ?>">
            </div>
          </div>

          <div class="form-group">
            <label for="judul_usulan">Judul Usulan Pembangunan *</label>
            <input type="text" id="judul_usulan" name="judul_usulan" class="form-control" required placeholder="Contoh: Perbaikan Saluran Drainase Jalan Poros Dusun I" value="<?= e($_POST['judul_usulan'] ?? '') ?>">
          </div>

          <div class="form-group">
            <label for="deskripsi">Alasan & Penjelasan Usulan *</label>
            <textarea id="deskripsi" name="deskripsi" class="form-control" required placeholder="Jelaskan kondisi saat ini, urgensi, serta manfaat usulan bagi masyarakat..."><?= e($_POST['deskripsi'] ?? '') ?></textarea>
          </div>

          <div class="form-group">
            <label for="foto_lokasi">Foto Kondisi Lokasi (Opsional, JPG/PNG/WebP maks. 2 MB)</label>
            <input type="file" id="foto_lokasi" name="foto_lokasi" class="form-control" accept="image/jpeg,image/png,image/webp">
          </div>

          <p style="font-size:12px;color:#64748b;margin:0 0 14px;">
            Perlindungan Data Pribadi: Nama lengkap dan nomor HP Anda hanya dapat diakses oleh admin perangkat desa yang berwenang.
          </p>

          <button type="submit" class="btn btn-primary" style="width:100%;">Kirim Usulan Musrenbang</button>
        </form>
      </section>

      <div style="display:flex;flex-direction:column;gap:20px;">
        <section id="cek-status" class="card">
          <div class="card-header">
            <h2 class="card-title">Cek Status Pengajuan Usulan</h2>
          </div>
          <form method="get" action="index.php#cek-status" style="display:flex;gap:10px;margin-bottom:14px;">
            <input type="text" name="cek" class="form-control" placeholder="Masukkan Nomor Pengajuan (mis. MSRB-2026-0001)" value="<?= e($lookupQuery) ?>" required>
            <button type="submit" class="btn btn-navy">Cek</button>
          </form>

          <?php if ($lookupResult): ?>
            <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
                <strong class="tabular-nums" style="color:#0b1f3a;"><?= e($lookupResult['nomor_pengajuan']) ?></strong>
                <span class="badge badge-info"><?= e($lookupResult['status']) ?></span>
              </div>
              <div style="font-weight:700;font-size:15px;margin-bottom:4px;"><?= e($lookupResult['judul_usulan']) ?></div>
              <div style="font-size:13px;color:#475569;margin-bottom:8px;">
                Kategori: <?= e($lookupResult['kategori']) ?> &bull; Lokasi: <?= e($lookupResult['lokasi']) ?> (<?= e($lookupResult['dusun']) ?>)
              </div>
              <?php if (!empty($lookupResult['catatan_untuk_pengusul'])): ?>
                <div style="font-size:13px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
                  <strong>Catatan Perangkat Desa:</strong><br><?= e($lookupResult['catatan_untuk_pengusul']) ?>
                </div>
              <?php endif; ?>
            </div>
          <?php elseif ($lookupNotFound): ?>
            <div class="alert alert-warning" style="margin-bottom:0;">Nomor pengajuan <strong><?= e($lookupQuery) ?></strong> tidak ditemukan.</div>
          <?php else: ?>
            <p style="font-size:13px;color:#64748b;margin:0;">Masukkan nomor pengajuan untuk melihat status verifikasi dan catatan tindak lanjut dari Balai Desa.</p>
          <?php endif; ?>
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Usulan Disetujui & Dipublikasikan</h2>
            <span class="badge badge-success"><?= count($publicProposals) ?> Usulan</span>
          </div>
          <?php if (empty($publicProposals)): ?>
            <p style="font-size:13.5px;color:#64748b;margin:0;">Belum ada usulan yang dipublikasikan ke halaman publik.</p>
          <?php else: ?>
            <div style="display:flex;flex-direction:column;gap:12px;">
              <?php foreach ($publicProposals as $pub): ?>
                <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:4px;">
                    <span style="font-size:12px;font-weight:700;color:#1d4ed8;" class="tabular-nums"><?= e($pub['nomor_pengajuan']) ?></span>
                    <span class="badge badge-success"><?= e($pub['status']) ?></span>
                  </div>
                  <div style="font-weight:700;color:#0b1f3a;margin-bottom:3px;"><?= e($pub['judul_usulan']) ?></div>
                  <div style="font-size:12.5px;color:#475569;"><?= e($pub['kategori']) ?> &bull; <?= e($pub['lokasi']) ?> &bull; <?= e($pub['estimasi_anggaran']) ?></div>
                </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </section>
      </div>
    </div>
  </main>
  <script src="assets/js/app.js"></script>
</body>
</html>
