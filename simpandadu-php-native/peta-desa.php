<?php
/**
 * Menu Peta Desa Adimulya (Leaflet + OpenStreetMap + Koordinat Resmi)
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

$admin = require_admin();
$db = get_db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf()) {
        set_flash('danger', 'Validasi Keamanan Gagal', 'Token CSRF tidak valid.');
        header('Location: peta-desa.php');
        exit;
    }

    $action = $_POST['action'] ?? '';
    if ($action === 'save_map_config') {
        $latRaw = trim((string) ($_POST['balai_desa_lat'] ?? ''));
        $lngRaw = trim((string) ($_POST['balai_desa_lng'] ?? ''));
        $lat = $latRaw !== '' && is_numeric($latRaw) ? (float) $latRaw : null;
        $lng = $lngRaw !== '' && is_numeric($lngRaw) ? (float) $lngRaw : null;
        $zoom = max(5, min(19, (int) ($_POST['default_zoom'] ?? 14)));
        $utara = trim((string) ($_POST['batas_utara'] ?? ''));
        $selatan = trim((string) ($_POST['batas_selatan'] ?? ''));
        $timur = trim((string) ($_POST['batas_timur'] ?? ''));
        $barat = trim((string) ($_POST['batas_barat'] ?? ''));

        $stmt = $db->prepare(
            'UPDATE map_config SET balai_desa_lat = ?, balai_desa_lng = ?, default_zoom = ?, batas_utara = ?, batas_selatan = ?, batas_timur = ?, batas_barat = ?, updated_at = NOW() WHERE id = 1'
        );
        $stmt->execute([$lat, $lng, $zoom, $utara, $selatan, $timur, $barat]);
        set_flash('success', 'Konfigurasi Peta Disimpan', 'Koordinat resmi Balai Desa dan batas wilayah telah diperbarui.');
        header('Location: peta-desa.php');
        exit;
    } elseif ($action === 'save_dusun') {
        $id = trim((string) ($_POST['dusun_id'] ?? ''));
        $nama = trim((string) ($_POST['nama'] ?? ''));
        $kadus = trim((string) ($_POST['kepala_dusun'] ?? ''));
        $rw = max(0, (int) ($_POST['jumlah_rw'] ?? 1));
        $rt = max(0, (int) ($_POST['jumlah_rt'] ?? 1));
        $latRaw = trim((string) ($_POST['lat'] ?? ''));
        $lngRaw = trim((string) ($_POST['lng'] ?? ''));
        $lat = $latRaw !== '' && is_numeric($latRaw) ? (float) $latRaw : null;
        $lng = $lngRaw !== '' && is_numeric($lngRaw) ? (float) $lngRaw : null;
        $ket = trim((string) ($_POST['keterangan'] ?? ''));

        if ($id !== '' && $nama !== '') {
            $stmt = $db->prepare(
                'UPDATE village_dusun SET nama = ?, kepala_dusun = ?, jumlah_rw = ?, jumlah_rt = ?, lat = ?, lng = ?, keterangan = ? WHERE id = ?'
            );
            $stmt->execute([$nama, $kadus, $rw, $rt, $lat, $lng, $ket, $id]);
            set_flash('success', 'Data Dusun Diperbarui', "Informasi dan koordinat {$nama} berhasil disimpan.");
        }
        header('Location: peta-desa.php');
        exit;
    }
}

$mapConfig = $db->query('SELECT * FROM map_config WHERE id = 1')->fetch() ?: [];
$dusunList = $db->query('SELECT * FROM village_dusun ORDER BY urutan ASC')->fetchAll();
$assets = $db->query('SELECT * FROM village_assets WHERE lat IS NOT NULL AND lng IS NOT NULL')->fetchAll();

$activePage = 'peta';
$pageTitle = 'Peta Wilayah Desa Adimulya';
$pageSubtitle = 'Peta Interaktif OpenStreetMap dengan Input Koordinat Resmi & Batas Wilayah';
$includeLeaflet = true;

require __DIR__ . '/includes/header.php';
?>

<?php if (empty($mapConfig['balai_desa_lat']) && empty($assets)): ?>
  <div class="alert alert-info">
    <strong>Koordinat Resmi Belum Diisi:</strong> Sistem tidak menghasilkan titik koordinat atau batas wilayah fiktif. Silakan masukkan koordinat resmi Balai Desa, Dusun, dan masing-masing aset pada formulir di bawah ini.
  </div>
<?php endif; ?>

<div class="card" style="margin-bottom:20px;">
  <div class="card-header">
    <h2 class="card-title">Peta Interaktif Wilayah & Sebaran Aset Desa</h2>
    <div style="display:flex;gap:8px;">
      <button type="button" id="btnZoomIn" class="btn btn-outline btn-sm">Zoom In (+)</button>
      <button type="button" id="btnZoomOut" class="btn btn-outline btn-sm">Zoom Out (-)</button>
    </div>
  </div>
  <div id="villageMapMain" class="leaflet-container-box"></div>
</div>

<div class="grid-2" style="align-items:start;">
  <section class="card">
    <div class="card-header">
      <h3 class="card-title">Koordinat Resmi Balai Desa & Batas Wilayah</h3>
    </div>
    <form method="post" action="peta-desa.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="save_map_config">
      <div class="form-grid">
        <div class="form-group">
          <label for="balai_desa_lat">Latitude Balai Desa</label>
          <input type="text" id="balai_desa_lat" name="balai_desa_lat" class="form-control" placeholder="Contoh: -7.123456" value="<?= e($mapConfig['balai_desa_lat'] !== null ? (string) $mapConfig['balai_desa_lat'] : '') ?>">
        </div>
        <div class="form-group">
          <label for="balai_desa_lng">Longitude Balai Desa</label>
          <input type="text" id="balai_desa_lng" name="balai_desa_lng" class="form-control" placeholder="Contoh: 109.123456" value="<?= e($mapConfig['balai_desa_lng'] !== null ? (string) $mapConfig['balai_desa_lng'] : '') ?>">
        </div>
      </div>
      <div class="form-group">
        <label for="default_zoom">Tingkat Zoom Awal (5–19)</label>
        <input type="number" id="default_zoom" name="default_zoom" min="5" max="19" class="form-control" value="<?= (int) ($mapConfig['default_zoom'] ?? 14) ?>">
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label for="batas_utara">Batas Sebelah Utara</label>
          <input type="text" id="batas_utara" name="batas_utara" class="form-control" value="<?= e($mapConfig['batas_utara'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label for="batas_selatan">Batas Sebelah Selatan</label>
          <input type="text" id="batas_selatan" name="batas_selatan" class="form-control" value="<?= e($mapConfig['batas_selatan'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label for="batas_timur">Batas Sebelah Timur</label>
          <input type="text" id="batas_timur" name="batas_timur" class="form-control" value="<?= e($mapConfig['batas_timur'] ?? '') ?>">
        </div>
        <div class="form-group">
          <label for="batas_barat">Batas Sebelah Barat</label>
          <input type="text" id="batas_barat" name="batas_barat" class="form-control" value="<?= e($mapConfig['batas_barat'] ?? '') ?>">
        </div>
      </div>
      <button type="submit" class="btn btn-primary">Simpan Koordinat & Batas Wilayah</button>
    </form>
  </section>

  <section class="card">
    <div class="card-header">
      <h3 class="card-title">Daftar & Koordinat Resmi Dusun</h3>
    </div>
    <?php foreach ($dusunList as $dsn): ?>
      <form method="post" action="peta-desa.php" style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_dusun">
        <input type="hidden" name="dusun_id" value="<?= e($dsn['id']) ?>">
        <div class="form-grid">
          <div class="form-group">
            <label>Nama Dusun</label>
            <input type="text" name="nama" class="form-control" value="<?= e($dsn['nama']) ?>" required>
          </div>
          <div class="form-group">
            <label>Kepala Dusun</label>
            <input type="text" name="kepala_dusun" class="form-control" value="<?= e($dsn['kepala_dusun']) ?>">
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Jumlah RW / RT</label>
            <div style="display:flex;gap:8px;">
              <input type="number" name="jumlah_rw" class="form-control" value="<?= (int) $dsn['jumlah_rw'] ?>" title="RW">
              <input type="number" name="jumlah_rt" class="form-control" value="<?= (int) $dsn['jumlah_rt'] ?>" title="RT">
            </div>
          </div>
          <div class="form-group">
            <label>Koordinat Resmi (Lat / Lng)</label>
            <div style="display:flex;gap:8px;">
              <input type="text" name="lat" class="form-control" placeholder="Latitude" value="<?= e($dsn['lat'] !== null ? (string) $dsn['lat'] : '') ?>">
              <input type="text" name="lng" class="form-control" placeholder="Longitude" value="<?= e($dsn['lng'] !== null ? (string) $dsn['lng'] : '') ?>">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Keterangan Wilayah</label>
          <input type="text" name="keterangan" class="form-control" value="<?= e($dsn['keterangan']) ?>">
        </div>
        <button type="submit" class="btn btn-outline btn-sm">Simpan Perubahan Dusun</button>
      </form>
    <?php endforeach; ?>
  </section>
</div>

<script>
(function () {
  if (typeof L === 'undefined') return;
  var balaiLat = <?= json_encode($mapConfig['balai_desa_lat'] !== null ? (float) $mapConfig['balai_desa_lat'] : null) ?>;
  var balaiLng = <?= json_encode($mapConfig['balai_desa_lng'] !== null ? (float) $mapConfig['balai_desa_lng'] : null) ?>;
  var defZoom = <?= (int) ($mapConfig['default_zoom'] ?? 14) ?>;
  var dusunMarkers = <?= json_encode(array_values(array_filter($dusunList, static fn ($d) => $d['lat'] !== null && $d['lng'] !== null)), JSON_UNESCAPED_UNICODE) ?>;
  var assetMarkers = <?= json_encode($assets, JSON_UNESCAPED_UNICODE) ?>;

  var cLat = balaiLat !== null ? balaiLat : (dusunMarkers[0]?.lat ?? assetMarkers[0]?.lat ?? -2.5489);
  var cLng = balaiLng !== null ? balaiLng : (dusunMarkers[0]?.lng ?? assetMarkers[0]?.lng ?? 118.0149);
  var startZoom = (balaiLat !== null || dusunMarkers.length || assetMarkers.length) ? defZoom : 5;

  var map = L.map('villageMapMain').setView([Number(cLat), Number(cLng)], startZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  function escPop(s) {
    var d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }
  if (balaiLat !== null && balaiLng !== null) {
    L.marker([balaiLat, balaiLng]).addTo(map)
      .bindPopup('<strong>Balai Desa Adimulya</strong><br>Pusat Pemerintahan Desa');
  }
  dusunMarkers.forEach(function (d) {
    L.circleMarker([Number(d.lat), Number(d.lng)], { radius: 9, color: '#D97706', fillColor: '#F59E0B', fillOpacity: 0.85 })
      .addTo(map)
      .bindPopup('<strong>' + escPop(d.nama) + '</strong><br>Kadus: ' + escPop(d.kepala_dusun) + '<br>RW/RT: ' + escPop(d.jumlah_rw) + '/' + escPop(d.jumlah_rt));
  });
  assetMarkers.forEach(function (a) {
    L.marker([Number(a.lat), Number(a.lng)]).addTo(map)
      .bindPopup('<strong>' + escPop(a.nama) + '</strong><br>Kategori: ' + escPop(a.kategori) + '<br>Kondisi: ' + escPop(a.kondisi) + '<br>Lokasi: ' + escPop(a.lokasi));
  });

  document.getElementById('btnZoomIn')?.addEventListener('click', function () { map.zoomIn(); });
  document.getElementById('btnZoomOut')?.addEventListener('click', function () { map.zoomOut(); });
})();
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
