<?php
/**
 * Portal Berita Indonesia Terkini (Gaya Media Berita Nasional)
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/api/news.php';

$admin = require_admin();
$forceRefresh = !empty($_GET['refresh']);
$newsData = fetch_indonesian_news($forceRefresh);
$allArticles = $newsData['articles'] ?? [];

$categories = [
    'Semua Berita', 'Nasional', 'Daerah', 'Politik', 'Ekonomi',
    'Teknologi', 'Pendidikan', 'Kesehatan', 'Olahraga', 'Lingkungan',
];

$selectedCat = trim((string) ($_GET['kategori'] ?? 'Semua Berita'));
if (!in_array($selectedCat, $categories, true)) {
    $selectedCat = 'Semua Berita';
}
$q = trim((string) ($_GET['q'] ?? ''));

$filtered = array_values(array_filter($allArticles, static function (array $a) use ($selectedCat, $q): bool {
    if ($selectedCat !== 'Semua Berita' && ($a['category'] ?? '') !== $selectedCat) {
        return false;
    }
    if ($q !== '') {
        $hay = mb_strtolower(($a['title'] ?? '') . ' ' . ($a['summary'] ?? '') . ' ' . ($a['source'] ?? ''));
        return str_contains($hay, mb_strtolower($q));
    }
    return true;
}));

$headline = $filtered[0] ?? null;
$restArticles = array_slice($filtered, 1);

$activePage = 'berita';
$pageTitle = 'Portal Berita Indonesia Terkini';
$pageSubtitle = 'Berita Nasional, Daerah, Ekonomi, Politik, Teknologi, Pendidikan, & Pembangunan Indonesia';

require __DIR__ . '/includes/header.php';
?>

<div class="card" style="margin-bottom:20px;">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
    <form method="get" action="berita.php" style="display:flex;gap:10px;flex-wrap:wrap;flex:1;">
      <input type="hidden" name="kategori" value="<?= e($selectedCat) ?>">
      <input type="text" name="q" class="form-control" style="max-width:340px;" placeholder="Cari topik berita Indonesia..." value="<?= e($q) ?>">
      <button type="submit" class="btn btn-navy">Cari Berita</button>
      <?php if ($q !== '' || $selectedCat !== 'Semua Berita'): ?>
        <a href="berita.php" class="btn btn-outline">Reset</a>
      <?php endif; ?>
    </form>
    <a href="berita.php?refresh=1&kategori=<?= urlencode($selectedCat) ?>" class="btn btn-primary btn-sm">Muat Ulang RSS Terkini</a>
  </div>

  <div class="tabs-bar" style="margin-bottom:0;border-bottom:none;padding-bottom:0;">
    <?php foreach ($categories as $cat): ?>
      <a href="berita.php?kategori=<?= urlencode($cat) ?>&q=<?= urlencode($q) ?>" class="tab-btn <?= $selectedCat === $cat ? 'active' : '' ?>" style="text-decoration:none;"><?= e($cat) ?></a>
    <?php endforeach; ?>
  </div>
</div>

<?php if (!empty($newsData['isDemoFallback'])): ?>
  <div class="alert alert-warning">
    <strong>Mode Berita Contoh (Offline):</strong> Feed RSS eksternal belum terjangkau dari koneksi XAMPP saat ini. Klik <strong>Muat Ulang RSS Terkini</strong> saat terhubung ke internet.
  </div>
<?php endif; ?>

<?php if ($headline): ?>
  <article class="news-hero">
    <img src="<?= e($headline['imageUrl'] ?: 'assets/images/balai_desa_adimulya.jpg') ?>" alt="<?= e($headline['title']) ?>">
    <div style="padding:24px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">
        Berita Utama &bull; <?= e($headline['category']) ?> &bull; <?= e($headline['source']) ?>
      </div>
      <h2 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#0b1f3a;"><?= e($headline['title']) ?></h2>
      <p style="margin:0 0 14px;color:#475569;"><?= e($headline['summary']) ?></p>
      <div style="font-size:12px;color:#64748b;margin-bottom:14px;" class="tabular-nums"><?= e(format_waktu_indonesia($headline['publishedAt'])) ?></div>
      <div>
        <button type="button" class="btn btn-primary btn-sm" onclick='openNewsModal(<?= json_encode($headline, JSON_HEX_APOS | JSON_HEX_QUOT) ?>)'>Baca Selengkapnya</button>
      </div>
    </div>
  </article>
<?php endif; ?>

<?php if (empty($filtered)): ?>
  <div class="card"><p style="margin:0;color:#64748b;">Tidak ada berita ditemukan untuk kategori/kata kunci ini.</p></div>
<?php else: ?>
  <div class="grid-3">
    <?php foreach ($restArticles as $art): ?>
      <article class="news-card">
        <img src="<?= e($art['imageUrl'] ?: 'assets/images/potensi_desa_pertanian.jpg') ?>" alt="<?= e($art['title']) ?>">
        <div class="news-card-body">
          <div style="font-size:11.5px;font-weight:700;color:#1d4ed8;margin-bottom:6px;"><?= e($art['category']) ?> &bull; <?= e($art['source']) ?></div>
          <h3 style="margin:0 0 8px;font-size:15.5px;line-height:1.35;color:#0b1f3a;"><?= e($art['title']) ?></h3>
          <p style="margin:0 0 12px;font-size:13px;color:#475569;flex:1;"><?= e($art['summary']) ?></p>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:10px;border-top:1px solid #e2e8f0;">
            <span style="font-size:11.5px;color:#64748b;" class="tabular-nums"><?= e(date('d/m/Y H:i', strtotime($art['publishedAt']))) ?></span>
            <button type="button" class="btn btn-outline btn-sm" onclick='openNewsModal(<?= json_encode($art, JSON_HEX_APOS | JSON_HEX_QUOT) ?>)'>Baca</button>
          </div>
        </div>
      </article>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<div id="newsDetailModal" class="modal-backdrop">
  <div class="modal-box">
    <div class="modal-header">
      <h3 id="newsModalTitle" class="card-title">Detail Berita</h3>
      <button type="button" class="btn btn-outline btn-sm" onclick="closeModalById('newsDetailModal')">Tutup</button>
    </div>
    <div id="newsModalMeta" style="font-size:12.5px;color:#1d4ed8;font-weight:700;margin-bottom:10px;"></div>
    <p id="newsModalContent" style="font-size:14.5px;line-height:1.7;color:#1e293b;"></p>
    <div id="newsModalLinkWrap" style="margin-top:16px;"></div>
  </div>
</div>

<script>
function openNewsModal(art) {
  document.getElementById('newsModalTitle').textContent = art.title || '';
  document.getElementById('newsModalMeta').textContent = (art.category || '') + ' • ' + (art.source || '');
  document.getElementById('newsModalContent').textContent = art.content || art.summary || '';
  var linkWrap = document.getElementById('newsModalLinkWrap');
  linkWrap.innerHTML = '';
  if (art.sourceUrl && /^https?:\/\//i.test(art.sourceUrl)) {
    var a = document.createElement('a');
    a.href = art.sourceUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'btn btn-primary btn-sm';
    a.textContent = 'Buka Sumber Berita Asli →';
    linkWrap.appendChild(a);
  }
  openModalById('newsDetailModal');
}
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
