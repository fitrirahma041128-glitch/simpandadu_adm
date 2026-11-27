<?php
/**
 * Menu Manajemen Usulan Musrenbang Admin Desa Adimulya
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$admin = require_admin();
$db = get_db();

$categories = ['Infrastruktur', 'Pendidikan', 'Kesehatan', 'Ekonomi', 'Pertanian', 'Sarana dan Prasarana', 'Lingkungan'];
$priorities = ['Tinggi', 'Sedang', 'Rendah'];
$statuses = ['Diajukan', 'Menunggu Verifikasi', 'Dalam Pembahasan', 'Disetujui', 'Ditolak', 'Selesai'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf()) {
        set_flash('danger', 'Validasi Keamanan Gagal', 'Token CSRF tidak valid.');
        header('Location: musrenbang.php');
        exit;
    }

    $action = $_POST['action'] ?? '';
    if ($action === 'verify_update') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $status = trim((string) ($_POST['status'] ?? 'Menunggu Verifikasi'));
        $prioritas = trim((string) ($_POST['prioritas'] ?? 'Sedang'));
        $estimasi = trim((string) ($_POST['estimasi_anggaran'] ?? ''));
        $catatanVer = trim((string) ($_POST['catatan_verifikasi'] ?? ''));
        $catatanPub = trim((string) ($_POST['catatan_untuk_pengusul'] ?? ''));
        $dipub = !empty($_POST['dipublikasikan']) ? 1 : 0;

        if ($id !== '' && in_array($status, $statuses, true) && in_array($prioritas, $priorities, true)) {
            $stmt = $db->prepare(
                'UPDATE musrenbang_proposals
                 SET status = ?, prioritas = ?, estimasi_anggaran = ?, catatan_verifikasi = ?, catatan_untuk_pengusul = ?, dipublikasikan = ?, updated_at = NOW()
                 WHERE id = ?'
            );
            $stmt->execute([$status, $prioritas, $estimasi, $catatanVer, $catatanPub, $dipub, $id]);
            set_flash('success', 'Status Usulan Diperbarui', "Status usulan berhasil diubah menjadi {$status}.");
        }
    } elseif ($action === 'create_admin') {
        $nama = trim((string) ($_POST['nama_pengusul'] ?? ''));
        $dusun = trim((string) ($_POST['dusun'] ?? ''));
        $judul = trim((string) ($_POST['judul_usulan'] ?? ''));
        $kategori = trim((string) ($_POST['kategori'] ?? 'Infrastruktur'));
        $lokasi = trim((string) ($_POST['lokasi'] ?? ''));
        $prioritas = trim((string) ($_POST['prioritas'] ?? 'Sedang'));
        $estimasi = trim((string) ($_POST['estimasi_anggaran'] ?? ''));
        $deskripsi = trim((string) ($_POST['deskripsi'] ?? ''));

        if ($nama !== '' && $judul !== '' && $lokasi !== '' && in_array($kategori, $categories, true)) {
            $year = date('Y');
            $seq = ((int) $db->query('SELECT COUNT(*) FROM musrenbang_proposals')->fetchColumn()) + 1;
            $nomor = sprintf('MSRB-%s-%04d', $year, $seq);
            $id = 'mus-' . bin2hex(random_bytes(5));
            $stmt = $db->prepare(
                'INSERT INTO musrenbang_proposals (
                    id, nomor_pengajuan, sumber, nama_pengusul, nomor_hp, dusun, rt_rw,
                    judul_usulan, kategori, lokasi, tanggal_pengajuan, prioritas, status,
                    estimasi_anggaran, deskripsi, catatan_verifikasi, catatan_untuk_pengusul,
                    foto_file, dipublikasikan, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, NULL, 0, NOW(), NOW())'
            );
            $stmt->execute([
                $id, $nomor, 'Admin', $nama, '', $dusun, '',
                $judul, $kategori, $lokasi, $prioritas, 'Dalam Pembahasan',
                $estimasi, $deskripsi, '', '',
            ]);
            set_flash('success', 'Usulan Ditambahkan', "Usulan {$nomor} berhasil disimpan.");
        }
    } elseif ($action === 'delete') {
        $id = trim((string) ($_POST['id'] ?? ''));
        if ($id !== '') {
            $rowStmt = $db->prepare('SELECT foto_file FROM musrenbang_proposals WHERE id = ? LIMIT 1');
            $rowStmt->execute([$id]);
            $foto = $rowStmt->fetchColumn();
            if ($foto) {
                delete_confined_file(UPLOAD_PROPOSALS_DIR, (string) $foto);
            }
            $db->prepare('DELETE FROM musrenbang_proposals WHERE id = ?')->execute([$id]);
            set_flash('info', 'Usulan Dihapus', 'Data usulan Musrenbang berhasil dihapus.');
        }
    }

    header('Location: musrenbang.php');
    exit;
}

$q = trim((string) ($_GET['q'] ?? ''));
$filterStatus = trim((string) ($_GET['status'] ?? 'Semua'));

$sql = 'SELECT * FROM musrenbang_proposals WHERE 1=1';
$params = [];
if ($q !== '') {
    $sql .= ' AND (nomor_pengajuan LIKE ? OR nama_pengusul LIKE ? OR judul_usulan LIKE ? OR lokasi LIKE ?)';
    $like = '%' . $q . '%';
    $params = [$like, $like, $like, $like];
}
if ($filterStatus !== '' && $filterStatus !== 'Semua' && in_array($filterStatus, $statuses, true)) {
    $sql .= ' AND status = ?';
    $params[] = $filterStatus;
}
$sql .= ' ORDER BY created_at DESC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$proposals = $stmt->fetchAll();

$activePage = 'musrenbang';
$pageTitle = 'Manajemen Usulan Musrenbang';
$pageSubtitle = 'Verifikasi Usulan Warga & Perangkat Desa, Foto Lapangan, dan Publikasi Transparansi';

require __DIR__ . '/includes/header.php';
?>

<div class="card">
  <div class="card-header">
    <form method="get" action="musrenbang.php" style="display:flex;gap:10px;flex-wrap:wrap;flex:1;">
      <input type="text" name="q" class="form-control" style="max-width:270px;" placeholder="Cari nomor, pengusul, judul..." value="<?= e($q) ?>">
      <select name="status" class="form-control" style="max-width:210px;">
        <option value="Semua">Semua Status</option>
        <?php foreach ($statuses as $st): ?>
          <option value="<?= e($st) ?>" <?= $filterStatus === $st ? 'selected' : '' ?>><?= e($st) ?></option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="btn btn-navy">Filter</button>
    </form>

    <div style="display:flex;gap:8px;flex-wrap:wrap;" class="no-print">
      <button type="button" class="btn btn-outline" onclick="window.print()">Cetak Laporan</button>
      <a href="api/proposals-export.php" class="btn btn-outline">Export Excel</a>
      <button type="button" class="btn btn-primary" onclick="openModalById('newProposalModal')">+ Tambah Usulan</button>
    </div>
  </div>

  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Nomor</th>
          <th>Sumber & Pengusul</th>
          <th>Judul Usulan & Lokasi</th>
          <th>Kategori</th>
          <th>Prioritas</th>
          <th>Status</th>
          <th>Publik</th>
          <th class="no-print">Aksi</th>
        </tr>
      </thead>
      <tbody>
        <?php if (empty($proposals)): ?>
          <tr><td colspan="8" style="text-align:center;color:#64748b;padding:24px;">Belum ada usulan sesuai filter.</td></tr>
        <?php else: ?>
          <?php foreach ($proposals as $p): ?>
            <?php
              $stBadge = match ($p['status']) {
                  'Disetujui', 'Selesai' => 'badge-success',
                  'Ditolak' => 'badge-danger',
                  'Menunggu Verifikasi', 'Dalam Pembahasan' => 'badge-warning',
                  default => 'badge-info',
              };
            ?>
            <tr>
              <td class="tabular-nums"><strong><?= e($p['nomor_pengajuan']) ?></strong><br><span style="font-size:11.5px;color:#64748b;"><?= e($p['tanggal_pengajuan']) ?></span></td>
              <td>
                <span class="badge <?= $p['sumber'] === 'Warga' ? 'badge-info' : 'badge-neutral' ?>"><?= e($p['sumber']) ?></span><br>
                <strong><?= e($p['nama_pengusul']) ?></strong>
                <?php if (!empty($p['nomor_hp'])): ?>
                  <div style="font-size:12px;color:#475569;" class="tabular-nums">HP: <?= e($p['nomor_hp']) ?></div>
                <?php endif; ?>
              </td>
              <td style="max-width:270px;">
                <strong><?= e($p['judul_usulan']) ?></strong>
                <div style="font-size:12px;color:#64748b;"><?= e($p['lokasi']) ?> <?= !empty($p['dusun']) ? '(' . e($p['dusun']) . ')' : '' ?></div>
              </td>
              <td><?= e($p['kategori']) ?></td>
              <td><?= e($p['prioritas']) ?></td>
              <td><span class="badge <?= $stBadge ?>"><?= e($p['status']) ?></span></td>
              <td><?= !empty($p['dipublikasikan']) ? '<span class="badge badge-success">Ya</span>' : '<span class="badge badge-neutral">Tidak</span>' ?></td>
              <td class="no-print" style="white-space:nowrap;">
                <button type="button" class="btn btn-primary btn-sm" onclick='openVerifyModal(<?= json_encode($p, JSON_HEX_APOS | JSON_HEX_QUOT) ?>)'>Verifikasi / Detail</button>
                <form method="post" action="musrenbang.php" style="display:inline;" onsubmit="return confirm('Hapus usulan <?= e($p['nomor_pengajuan']) ?>?');">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= e($p['id']) ?>">
                  <button type="submit" class="btn btn-danger btn-sm">Hapus</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
        <?php endif; ?>
      </tbody>
    </table>
  </div>
</div>

<!-- Modal Verifikasi & Detail Foto -->
<div id="verifyProposalModal" class="modal-backdrop">
  <div class="modal-box">
    <div class="modal-header">
      <h3 id="verTitle" class="card-title">Verifikasi Usulan Musrenbang</h3>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeModalById('verifyProposalModal')">Tutup</button>
    </div>
    <div id="verMetaBox" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:13.5px;margin-bottom:14px;"></div>
    <div id="verPhotoBox" style="margin-bottom:14px;"></div>

    <form method="post" action="musrenbang.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="verify_update">
      <input type="hidden" name="id" id="ver_id" value="">

      <div class="form-grid">
        <div class="form-group">
          <label for="ver_status">Status Usulan</label>
          <select id="ver_status" name="status" class="form-control">
            <?php foreach ($statuses as $st): ?>
              <option value="<?= e($st) ?>"><?= e($st) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="ver_prioritas">Prioritas</label>
          <select id="ver_prioritas" name="prioritas" class="form-control">
            <?php foreach ($priorities as $pr): ?>
              <option value="<?= e($pr) ?>"><?= e($pr) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="ver_estimasi">Estimasi Anggaran</label>
        <input type="text" id="ver_estimasi" name="estimasi_anggaran" class="form-control" placeholder="Contoh: Rp 75.000.000">
      </div>
      <div class="form-group">
        <label for="ver_catatan_internal">Catatan Verifikasi Internal Admin (Alasan Setuju/Tolak)</label>
        <textarea id="ver_catatan_internal" name="catatan_verifikasi" class="form-control"></textarea>
      </div>
      <div class="form-group">
        <label for="ver_catatan_pengusul">Catatan untuk Pengusul (Ditampilkan saat Warga Cek Status)</label>
        <textarea id="ver_catatan_pengusul" name="catatan_untuk_pengusul" class="form-control"></textarea>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="ver_publikasikan" name="dipublikasikan" value="1">
          <span>Publikasikan ke Halaman Publik Warga (tanpa menampilkan identitas & nomor HP pengusul)</span>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Simpan Keputusan Verifikasi</button>
    </form>
  </div>
</div>

<!-- Modal Tambah Usulan Admin -->
<div id="newProposalModal" class="modal-backdrop">
  <div class="modal-box">
    <div class="modal-header">
      <h3 class="card-title">Tambah Usulan Musrenbang (Admin)</h3>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeModalById('newProposalModal')">Tutup</button>
    </div>
    <form method="post" action="musrenbang.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="create_admin">
      <div class="form-grid">
        <div class="form-group"><label>Pengusul / Lembaga *</label><input type="text" name="nama_pengusul" class="form-control" required></div>
        <div class="form-group"><label>Dusun</label><input type="text" name="dusun" class="form-control" placeholder="Dusun I"></div>
      </div>
      <div class="form-group"><label>Judul Usulan *</label><input type="text" name="judul_usulan" class="form-control" required></div>
      <div class="form-grid">
        <div class="form-group">
          <label>Kategori *</label>
          <select name="kategori" class="form-control">
            <?php foreach ($categories as $cat): ?><option value="<?= e($cat) ?>"><?= e($cat) ?></option><?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label>Prioritas</label>
          <select name="prioritas" class="form-control">
            <?php foreach ($priorities as $pr): ?><option value="<?= e($pr) ?>"><?= e($pr) ?></option><?php endforeach; ?>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Lokasi *</label><input type="text" name="lokasi" class="form-control" required></div>
        <div class="form-group"><label>Estimasi Anggaran</label><input type="text" name="estimasi_anggaran" class="form-control" placeholder="Rp ..."></div>
      </div>
      <div class="form-group"><label>Deskripsi Usulan</label><textarea name="deskripsi" class="form-control"></textarea></div>
      <button type="submit" class="btn btn-primary">Simpan Usulan</button>
    </form>
  </div>
</div>

<script>
function openVerifyModal(p) {
  document.getElementById('verTitle').textContent = 'Verifikasi: ' + (p.nomor_pengajuan || '');
  document.getElementById('ver_id').value = p.id;
  document.getElementById('ver_status').value = p.status || 'Menunggu Verifikasi';
  document.getElementById('ver_prioritas').value = p.prioritas || 'Sedang';
  document.getElementById('ver_estimasi').value = p.estimasi_anggaran || '';
  document.getElementById('ver_catatan_internal').value = p.catatan_verifikasi || '';
  document.getElementById('ver_catatan_pengusul').value = p.catatan_untuk_pengusul || '';
  document.getElementById('ver_publikasikan').checked = Number(p.dipublikasikan) === 1;

  var meta = document.getElementById('verMetaBox');
  meta.innerHTML = '';
  var lines = [
    'Pengusul: ' + (p.nama_pengusul || '-') + (p.nomor_hp ? ' (' + p.nomor_hp + ')' : ''),
    'Wilayah: ' + (p.dusun || '-') + ' ' + (p.rt_rw || '') + ' — ' + (p.lokasi || ''),
    'Judul: ' + (p.judul_usulan || ''),
    'Alasan / Deskripsi: ' + (p.deskripsi || '-')
  ];
  lines.forEach(function (txt) {
    var d = document.createElement('div');
    d.textContent = txt;
    d.style.marginBottom = '4px';
    meta.appendChild(d);
  });

  var photoBox = document.getElementById('verPhotoBox');
  photoBox.innerHTML = '';
  if (p.foto_file) {
    var img = document.createElement('img');
    img.src = 'uploads/proposals/' + encodeURIComponent(p.foto_file);
    img.alt = 'Foto Lokasi Usulan';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '240px';
    img.style.borderRadius = '10px';
    img.style.border = '1px solid #cbd5e1';
    photoBox.appendChild(img);
  }
  openModalById('verifyProposalModal');
}
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
