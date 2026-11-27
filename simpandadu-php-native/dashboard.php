<?php
/**
 * Dashboard Utama Admin SIMPANDADU
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/api/news.php';

$admin = require_admin();
$db = get_db();

$assets = $db->query('SELECT * FROM village_assets ORDER BY updated_at DESC')->fetchAll();
$proposals = $db->query('SELECT * FROM musrenbang_proposals ORDER BY created_at DESC')->fetchAll();
$mapConfig = $db->query('SELECT * FROM map_config WHERE id = 1')->fetch() ?: [];
$newsPayload = fetch_indonesian_news(false);
$articles = $newsPayload['articles'] ?? [];

$totalAset = count($assets);
$baikCount = 0;
$perbaikanCount = 0;
$rusakCount = 0;
foreach ($assets as $a) {
    if ($a['kondisi'] === 'Baik') $baikCount++;
    elseif ($a['kondisi'] === 'Perlu Perbaikan') $perbaikanCount++;
    elseif ($a['kondisi'] === 'Rusak Berat') $rusakCount++;
}

$search = trim((string) ($_GET['cari'] ?? ''));
$searchAssets = [];
$searchProposals = [];
$searchNews = [];

if ($search !== '') {
    $qLower = mb_strtolower($search);
    foreach ($assets as $a) {
        if (str_contains(mb_strtolower($a['nama'] . ' ' . $a['kategori'] . ' ' . $a['lokasi']), $qLower)) {
            $searchAssets[] = $a;
        }
    }
    foreach ($proposals as $p) {
        if (str_contains(mb_strtolower($p['nomor_pengajuan'] . ' ' . $p['judul_usulan'] . ' ' . $p['lokasi']), $qLower)) {
            $searchProposals[] = $p;
        }
    }
    foreach ($articles as $n) {
        if (str_contains(mb_strtolower($n['title'] . ' ' . $n['summary'] . ' ' . $n['category']), $qLower)) {
            $searchNews[] = $n;
        }
    }
}

$mappedAssets = array_values(array_filter($assets, static fn ($a) => $a['lat'] !== null && $a['lng'] !== null));

$activePage = 'dashboard';
$pageTitle = 'Dashboard SIMPANDADU';
$pageSubtitle = 'Ringkasan Aset, Peta Sebaran, Berita Indonesia, dan Usulan Musrenbang Desa Adimulya';
$includeLeaflet = true;

require __DIR__ . '/includes/header.php';
?>

<div class="card" style="background:linear-gradient(115deg,#0B1F3A 0%,#1D4ED8 100%);color:#fff;margin-bottom:20px;border:none;">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
    <div>
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.8px;color:#FCD34D;font-weight:700;">SIMPANDADU &bull; Balai Desa Adimulya</div>
      <h2 style="margin:4px 0 6px;font-size:22px;">Selamat Datang, <?= e($admin['full_name']) ?></h2>
      <p style="margin:0;color:#e2e8f0;font-size:13.5px;">Jabatan: <?= e($admin['jabatan']) ?> &bull; Status Email: <?= !empty($admin['email']) && (int)$admin['email_verified'] === 1 ? e($admin['email']) . ' (Terverifikasi)' : 'Belum diverifikasi — lengkapi di Profil Akun' ?></p>
    </div>
    <form method="get" action="dashboard.php" style="display:flex;gap:8px;min-width:280px;max-width:420px;width:100%;">
      <input type="text" name="cari" class="form-control" placeholder="Cari aset, berita, atau usulan..." value="<?= e($search) ?>">
      <button type="submit" class="btn btn-gold">Cari</button>
    </form>
  </div>
</div>

<?php if ($search !== ''): ?>
  <div class="card" style="margin-bottom:20px;">
    <div class="card-header">
      <h3 class="card-title">Hasil Pencarian Terpadu: "<?= e($search) ?>"</h3>
      <a href="dashboard.php" class="btn btn-outline btn-sm">Reset Pencarian</a>
    </div>
    <div class="grid-3">
      <div>
        <strong style="font-size:13px;color:#0b1f3a;">Aset Desa (<?= count($searchAssets) ?>)</strong>
        <ul style="padding-left:18px;margin:8px 0 0;font-size:13px;">
          <?php foreach (array_slice($searchAssets, 0, 5) as $sa): ?>
            <li><a href="data-aset.php?q=<?= urlencode($sa['nama']) ?>"><?= e($sa['nama']) ?></a> (<?= e($sa['kondisi']) ?>)</li>
          <?php endforeach; ?>
          <?php if (empty($searchAssets)): ?><li style="color:#64748b;">Tidak ada aset cocok.</li><?php endif; ?>
        </ul>
      </div>
      <div>
        <strong style="font-size:13px;color:#0b1f3a;">Usulan Musrenbang (<?= count($searchProposals) ?>)</strong>
        <ul style="padding-left:18px;margin:8px 0 0;font-size:13px;">
          <?php foreach (array_slice($searchProposals, 0, 5) as $sp): ?>
            <li><a href="musrenbang.php?q=<?= urlencode($sp['nomor_pengajuan']) ?>"><?= e($sp['judul_usulan']) ?></a> (<?= e($sp['status']) ?>)</li>
          <?php endforeach; ?>
          <?php if (empty($searchProposals)): ?><li style="color:#64748b;">Tidak ada usulan cocok.</li><?php endif; ?>
        </ul>
      </div>
      <div>
        <strong style="font-size:13px;color:#0b1f3a;">Berita Indonesia (<?= count($searchNews) ?>)</strong>
        <ul style="padding-left:18px;margin:8px 0 0;font-size:13px;">
          <?php foreach (array_slice($searchNews, 0, 5) as $sn): ?>
            <li><a href="berita.php?q=<?= urlencode($search) ?>"><?= e($sn['title']) ?></a></li>
          <?php endforeach; ?>
          <?php if (empty($searchNews)): ?><li style="color:#64748b;">Tidak ada berita cocok.</li><?php endif; ?>
        </ul>
      </div>
    </div>
  </div>
<?php endif; ?>

<section class="stats-grid">
  <div class="stat-card">
    <p class="stat-label">Total Aset Desa</p>
    <p class="stat-value tabular-nums"><?= $totalAset ?></p>
    <p class="stat-note">Terdaftar di inventaris desa</p>
  </div>
  <div class="stat-card">
    <p class="stat-label">Kondisi Baik</p>
    <p class="stat-value tabular-nums" style="color:#15803d;"><?= $baikCount ?></p>
    <p class="stat-note">Siap operasional</p>
  </div>
  <div class="stat-card">
    <p class="stat-label">Perlu Perbaikan</p>
    <p class="stat-value tabular-nums" style="color:#b45309;"><?= $perbaikanCount ?></p>
    <p class="stat-note">Perlu pemeliharaan berkala</p>
  </div>
  <div class="stat-card">
    <p class="stat-label">Rusak Berat</p>
    <p class="stat-value tabular-nums" style="color:#b91c1c;"><?= $rusakCount ?></p>
    <p class="stat-note">Prioritas rehabilitasi</p>
  </div>
</section>

<div class="grid-2" style="margin-bottom:20px;">
  <section class="card">
    <div class="card-header">
      <h3 class="card-title">Grafik Kondisi Aset Desa Adimulya</h3>
      <a href="data-aset.php" class="btn btn-outline btn-sm">Kelola Aset</a>
    </div>
    <canvas id="assetConditionChart" width="520" height="230" data-baik="<?= $baikCount ?>" data-perbaikan="<?= $perbaikanCount ?>" data-rusak="<?= $rusakCount ?>" style="width:100%;height:auto;"></canvas>
  </section>

  <section class="card">
    <div class="card-header">
      <h3 class="card-title">Peta Sebaran Aset Desa Adimulya</h3>
      <a href="peta-desa.php" class="btn btn-outline btn-sm">Atur Koordinat Resmi</a>
    </div>
    <?php if (empty($mappedAssets) && empty($mapConfig['balai_desa_lat'])): ?>
      <div class="alert alert-info" style="margin-bottom:12px;">
        Koordinat resmi Balai Desa dan aset belum dimasukkan. Buka menu <strong>Peta Desa</strong> untuk mengisi koordinat resmi tanpa titik fiktif.
      </div>
    <?php endif; ?>
    <div id="miniVillageMap" style="width:100%;height:230px;border-radius:10px;border:1px solid #e2e8f0;"></div>
  </section>
</div>

<div class="grid-2">
  <section class="card">
    <div class="card-header">
      <h3 class="card-title">Ringkasan Berita Indonesia Terkini</h3>
      <a href="berita.php" class="btn btn-outline btn-sm">Buka Portal Berita</a>
    </div>
    <?php foreach (array_slice($articles, 0, 4) as $art): ?>
      <div style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:11.5px;color:#1d4ed8;font-weight:700;"><?= e($art['category']) ?> &bull; <?= e($art['source']) ?></div>
        <div style="font-weight:700;color:#0b1f3a;margin:2px 0;"><?= e($art['title']) ?></div>
        <div style="font-size:12.5px;color:#475569;"><?= e($art['summary']) ?></div>
      </div>
    <?php endforeach; ?>
  </section>

  <section class="card">
    <div class="card-header">
      <h3 class="card-title">Ringkasan Usulan Musrenbang</h3>
      <a href="musrenbang.php" class="btn btn-outline btn-sm">Kelola Musrenbang</a>
    </div>
    <?php foreach (array_slice($proposals, 0, 5) as $prop): ?>
      <div style="padding:10px 0;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
        <div>
          <div style="font-size:11.5px;font-weight:700;color:#475569;" class="tabular-nums"><?= e($prop['nomor_pengajuan']) ?> &bull; <?= e($prop['sumber']) ?></div>
          <div style="font-weight:700;color:#0b1f3a;"><?= e($prop['judul_usulan']) ?></div>
          <div style="font-size:12px;color:#64748b;"><?= e($prop['lokasi']) ?> &bull; <?= e($prop['kategori']) ?></div>
        </div>
        <span class="badge badge-info"><?= e($prop['status']) ?></span>
      </div>
    <?php endforeach; ?>
  </section>
</div>

<script>
(function () {
  if (typeof L === 'undefined') return;
  var balaiLat = <?= json_encode($mapConfig['balai_desa_lat'] !== null ? (float) $mapConfig['balai_desa_lat'] : null) ?>;
  var balaiLng = <?= json_encode($mapConfig['balai_desa_lng'] !== null ? (float) $mapConfig['balai_desa_lng'] : null) ?>;
  var mappedAssets = <?= json_encode(array_map(static fn ($a) => [
      'nama' => $a['nama'],
      'kondisi' => $a['kondisi'],
      'lat' => (float) $a['lat'],
      'lng' => (float) $a['lng'],
  ], $mappedAssets), JSON_UNESCAPED_UNICODE) ?>;

  var centerLat = balaiLat !== null ? balaiLat : (mappedAssets.length ? mappedAssets[0].lat : -2.5489);
  var centerLng = balaiLng !== null ? balaiLng : (mappedAssets.length ? mappedAssets[0].lng : 118.0149);
  var zoom = (balaiLat !== null || mappedAssets.length) ? 14 : 5;

  var map = L.map('miniVillageMap').setView([centerLat, centerLng], zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  function escPop(s) {
    var d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }
  if (balaiLat !== null && balaiLng !== null) {
    L.marker([balaiLat, balaiLng]).addTo(map).bindPopup('<strong>Balai Desa Adimulya</strong>');
  }
  mappedAssets.forEach(function (a) {
    L.marker([a.lat, a.lng]).addTo(map).bindPopup('<strong>' + escPop(a.nama) + '</strong><br>Kondisi: ' + escPop(a.kondisi));
  });
})();
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
