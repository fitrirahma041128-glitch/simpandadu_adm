<?php
/**
 * Menu Data Aset Desa Adimulya (CRUD MySQL, Pencarian, Filter, Cetak, Export Excel)
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$admin = require_admin();
$db = get_db();

$categories = [
    'Tanah Desa', 'Bangunan', 'Infrastruktur', 'Kendaraan', 'Peralatan',
    'Fasilitas Umum', 'Pertanian', 'Jaringan', 'Konservasi', 'Lainnya',
];
$conditions = ['Baik', 'Perlu Perbaikan', 'Rusak Berat'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf()) {
        set_flash('danger', 'Validasi Gagal', 'Token CSRF tidak valid.');
        header('Location: data-aset.php');
        exit;
    }

    $action = $_POST['action'] ?? '';
    if ($action === 'create' || $action === 'update') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $nama = trim((string) ($_POST['nama'] ?? ''));
        $kategori = trim((string) ($_POST['kategori'] ?? 'Lainnya'));
        $lokasi = trim((string) ($_POST['lokasi'] ?? ''));
        $tahun = (int) ($_POST['tahun_perolehan'] ?? date('Y'));
        $jumlah = max(1, (int) ($_POST['jumlah'] ?? 1));
        $satuan = trim((string) ($_POST['satuan'] ?? 'Unit'));
        $kondisi = trim((string) ($_POST['kondisi'] ?? 'Baik'));
        $keterangan = trim((string) ($_POST['keterangan'] ?? ''));
        $latRaw = trim((string) ($_POST['lat'] ?? ''));
        $lngRaw = trim((string) ($_POST['lng'] ?? ''));
        $lat = $latRaw !== '' && is_numeric($latRaw) ? (float) $latRaw : null;
        $lng = $lngRaw !== '' && is_numeric($lngRaw) ? (float) $lngRaw : null;

        if ($nama === '' || $lokasi === '' || !in_array($kategori, $categories, true) || !in_array($kondisi, $conditions, true)) {
            set_flash('danger', 'Data Tidak Lengkap', 'Periksa nama aset, kategori, lokasi, dan kondisi.');
        } elseif ($action === 'create') {
            $newId = 'ast-' . bin2hex(random_bytes(5));
            $stmt = $db->prepare(
                'INSERT INTO village_assets (id, nama, kategori, lokasi, tahun_perolehan, jumlah, satuan, kondisi, keterangan, lat, lng, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())'
            );
            $stmt->execute([$newId, $nama, $kategori, $lokasi, $tahun, $jumlah, $satuan, $kondisi, $keterangan, $lat, $lng]);
            set_flash('success', 'Aset Ditambahkan', "Data aset \"{$nama}\" berhasil disimpan ke database.");
        } elseif ($id !== '') {
            $stmt = $db->prepare(
                'UPDATE village_assets SET nama = ?, kategori = ?, lokasi = ?, tahun_perolehan = ?, jumlah = ?, satuan = ?, kondisi = ?, keterangan = ?, lat = ?, lng = ?, updated_at = NOW() WHERE id = ?'
            );
            $stmt->execute([$nama, $kategori, $lokasi, $tahun, $jumlah, $satuan, $kondisi, $keterangan, $lat, $lng, $id]);
            set_flash('success', 'Aset Diperbarui', "Data aset \"{$nama}\" berhasil diperbarui.");
        }
    } elseif ($action === 'delete') {
        $id = trim((string) ($_POST['id'] ?? ''));
        if ($id !== '') {
            $stmt = $db->prepare('DELETE FROM village_assets WHERE id = ?');
            $stmt->execute([$id]);
            set_flash('info', 'Aset Dihapus', 'Data aset telah dihapus dari inventaris desa.');
        }
    }
    header('Location: data-aset.php');
    exit;
}

$q = trim((string) ($_GET['q'] ?? ''));
$filterCat = trim((string) ($_GET['kategori'] ?? 'Semua'));

$sql = 'SELECT * FROM village_assets WHERE 1=1';
$params = [];
if ($q !== '') {
    $sql .= ' AND (nama LIKE ? OR lokasi LIKE ? OR keterangan LIKE ?)';
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}
if ($filterCat !== '' && $filterCat !== 'Semua' && in_array($filterCat, $categories, true)) {
    $sql .= ' AND kategori = ?';
    $params[] = $filterCat;
}
$sql .= ' ORDER BY tahun_perolehan DESC, nama ASC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$assets = $stmt->fetchAll();

$activePage = 'aset';
$pageTitle = 'Data Inventaris Aset Desa';
$pageSubtitle = 'Kelola Inventaris Tanah, Bangunan, Infrastruktur, Kendaraan, & Fasilitas Desa Adimulya';

require __DIR__ . '/includes/header.php';
?>

<div class="card" style="margin-bottom:20px;">
  <div class="card-header">
    <form method="get" action="data-aset.php" style="display:flex;gap:10px;flex-wrap:wrap;flex:1;">
      <input type="text" name="q" class="form-control" style="max-width:280px;" placeholder="Cari nama, lokasi, keterangan..." value="<?= e($q) ?>">
      <select name="kategori" class="form-control" style="max-width:210px;">
        <option value="Semua">Semua Kategori</option>
        <?php foreach ($categories as $cat): ?>
          <option value="<?= e($cat) ?>" <?= $filterCat === $cat ? 'selected' : '' ?>><?= e($cat) ?></option>
        <?php endforeach; ?>
      </select>
      <button type="submit" class="btn btn-navy">Filter</button>
      <?php if ($q !== '' || $filterCat !== 'Semua'): ?>
        <a href="data-aset.php" class="btn btn-outline">Reset</a>
      <?php endif; ?>
    </form>

    <div style="display:flex;gap:8px;flex-wrap:wrap;" class="no-print">
      <button type="button" class="btn btn-outline" onclick="window.print()">Cetak / PDF</button>
      <a href="api/assets-export.php?q=<?= urlencode($q) ?>&kategori=<?= urlencode($filterCat) ?>" class="btn btn-outline">Export Excel</a>
      <button type="button" class="btn btn-primary" onclick="openAssetCreateModal()">+ Tambah Aset</button>
    </div>
  </div>

  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>No</th>
          <th>Nama Aset</th>
          <th>Kategori Aset</th>
          <th>Lokasi</th>
          <th>Tahun Perolehan</th>
          <th>Jumlah</th>
          <th>Kondisi</th>
          <th>Keterangan</th>
          <th class="no-print">Aksi</th>
        </tr>
      </thead>
      <tbody>
        <?php if (empty($assets)): ?>
          <tr><td colspan="9" style="text-align:center;color:#64748b;padding:24px;">Tidak ada data aset sesuai pencarian.</td></tr>
        <?php else: ?>
          <?php foreach ($assets as $idx => $a): ?>
            <?php
              $condBadge = match ($a['kondisi']) {
                  'Baik' => 'badge-success',
                  'Perlu Perbaikan' => 'badge-warning',
                  default => 'badge-danger',
              };
            ?>
            <tr>
              <td class="tabular-nums"><?= $idx + 1 ?></td>
              <td><strong><?= e($a['nama']) ?></strong></td>
              <td><?= e($a['kategori']) ?></td>
              <td><?= e($a['lokasi']) ?></td>
              <td class="tabular-nums"><?= (int) $a['tahun_perolehan'] ?></td>
              <td class="tabular-nums"><?= (int) $a['jumlah'] ?> <?= e($a['satuan']) ?></td>
              <td><span class="badge <?= $condBadge ?>"><?= e($a['kondisi']) ?></span></td>
              <td style="max-width:240px;"><?= e($a['keterangan']) ?></td>
              <td class="no-print" style="white-space:nowrap;">
                <button type="button" class="btn btn-outline btn-sm" onclick='openAssetDetailModal(<?= json_encode($a, JSON_HEX_APOS | JSON_HEX_QUOT) ?>)'>Detail</button>
                <button type="button" class="btn btn-outline btn-sm" onclick='openAssetEditModal(<?= json_encode($a, JSON_HEX_APOS | JSON_HEX_QUOT) ?>)'>Edit</button>
                <form method="post" action="data-aset.php" style="display:inline;" onsubmit="return confirm('Hapus aset <?= e($a['nama']) ?>?');">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= e($a['id']) ?>">
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

<!-- Modal Form Tambah/Edit Aset -->
<div id="assetFormModal" class="modal-backdrop">
  <div class="modal-box">
    <div class="modal-header">
      <h3 id="assetFormTitle" class="card-title">Tambah Aset Desa</h3>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeModalById('assetFormModal')">Tutup</button>
    </div>
    <form method="post" action="data-aset.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" id="assetFormAction" value="create">
      <input type="hidden" name="id" id="assetFormId" value="">
      <div class="form-group">
        <label for="ast_nama">Nama Aset *</label>
        <input type="text" id="ast_nama" name="nama" class="form-control" required>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="ast_kategori">Kategori Aset *</label>
          <select id="ast_kategori" name="kategori" class="form-control">
            <?php foreach ($categories as $cat): ?>
              <option value="<?= e($cat) ?>"><?= e($cat) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="form-group">
          <label for="ast_kondisi">Kondisi *</label>
          <select id="ast_kondisi" name="kondisi" class="form-control">
            <?php foreach ($conditions as $cond): ?>
              <option value="<?= e($cond) ?>"><?= e($cond) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="ast_lokasi">Lokasi Aset *</label>
        <input type="text" id="ast_lokasi" name="lokasi" class="form-control" required>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="ast_tahun">Tahun Perolehan *</label>
          <input type="number" id="ast_tahun" name="tahun_perolehan" class="form-control" value="<?= date('Y') ?>" required>
        </div>
        <div class="form-group">
          <label for="ast_jumlah">Jumlah & Satuan *</label>
          <div style="display:flex;gap:8px;">
            <input type="number" id="ast_jumlah" name="jumlah" class="form-control" value="1" min="1" required>
            <input type="text" id="ast_satuan" name="satuan" class="form-control" value="Unit" required>
          </div>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="ast_lat">Koordinat Latitude (Opsional)</label>
          <input type="text" id="ast_lat" name="lat" class="form-control" placeholder="-7.xxxxxx">
        </div>
        <div class="form-group">
          <label for="ast_lng">Koordinat Longitude (Opsional)</label>
          <input type="text" id="ast_lng" name="lng" class="form-control" placeholder="109.xxxxxx">
        </div>
      </div>
      <div class="form-group">
        <label for="ast_ket">Keterangan</label>
        <textarea id="ast_ket" name="keterangan" class="form-control"></textarea>
      </div>
      <button type="submit" class="btn btn-primary">Simpan Data Aset</button>
    </form>
  </div>
</div>

<!-- Modal Detail Aset -->
<div id="assetDetailModal" class="modal-backdrop">
  <div class="modal-box">
    <div class="modal-header">
      <h3 class="card-title">Detail Aset Desa</h3>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeModalById('assetDetailModal')">Tutup</button>
    </div>
    <div id="assetDetailBody" style="font-size:14px;line-height:1.7;"></div>
  </div>
</div>

<script>
function openAssetCreateModal() {
  document.getElementById('assetFormTitle').textContent = 'Tambah Aset Desa';
  document.getElementById('assetFormAction').value = 'create';
  document.getElementById('assetFormId').value = '';
  document.getElementById('ast_nama').value = '';
  document.getElementById('ast_lokasi').value = '';
  document.getElementById('ast_tahun').value = String(new Date().getFullYear());
  document.getElementById('ast_jumlah').value = '1';
  document.getElementById('ast_satuan').value = 'Unit';
  document.getElementById('ast_lat').value = '';
  document.getElementById('ast_lng').value = '';
  document.getElementById('ast_ket').value = '';
  openModalById('assetFormModal');
}

function openAssetEditModal(a) {
  document.getElementById('assetFormTitle').textContent = 'Edit Data Aset';
  document.getElementById('assetFormAction').value = 'update';
  document.getElementById('assetFormId').value = a.id;
  document.getElementById('ast_nama').value = a.nama || '';
  document.getElementById('ast_kategori').value = a.kategori || 'Lainnya';
  document.getElementById('ast_kondisi').value = a.kondisi || 'Baik';
  document.getElementById('ast_lokasi').value = a.lokasi || '';
  document.getElementById('ast_tahun').value = a.tahun_perolehan || 2024;
  document.getElementById('ast_jumlah').value = a.jumlah || 1;
  document.getElementById('ast_satuan').value = a.satuan || 'Unit';
  document.getElementById('ast_lat').value = a.lat !== null ? String(a.lat) : '';
  document.getElementById('ast_lng').value = a.lng !== null ? String(a.lng) : '';
  document.getElementById('ast_ket').value = a.keterangan || '';
  openModalById('assetFormModal');
}

function openAssetDetailModal(a) {
  var body = document.getElementById('assetDetailBody');
  body.innerHTML = '';
  var rows = [
    ['Nama Aset', a.nama],
    ['Kategori', a.kategori],
    ['Lokasi', a.lokasi],
    ['Tahun Perolehan', a.tahun_perolehan],
    ['Jumlah', a.jumlah + ' ' + a.satuan],
    ['Kondisi', a.kondisi],
    ['Koordinat Resmi', (a.lat !== null && a.lng !== null) ? (a.lat + ', ' + a.lng) : 'Belum diisi'],
    ['Keterangan', a.keterangan || '-']
  ];
  rows.forEach(function (r) {
    var div = document.createElement('div');
    div.style.padding = '6px 0';
    div.style.borderBottom = '1px solid #e2e8f0';
    var strong = document.createElement('strong');
    strong.textContent = r[0] + ': ';
    var span = document.createElement('span');
    span.textContent = String(r[1] ?? '');
    div.appendChild(strong);
    div.appendChild(span);
    body.appendChild(div);
  });
  openModalById('assetDetailModal');
}
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
