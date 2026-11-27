<?php
/**
 * Export Data Aset Desa Adimulya ke Format Excel (.xls)
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

require_admin();
$db = get_db();

$q = trim((string) ($_GET['q'] ?? ''));
$kategori = trim((string) ($_GET['kategori'] ?? ''));

$sql = 'SELECT * FROM village_assets WHERE 1=1';
$params = [];
if ($q !== '') {
    $sql .= ' AND (nama LIKE ? OR lokasi LIKE ? OR keterangan LIKE ?)';
    $like = '%' . $q . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}
if ($kategori !== '' && $kategori !== 'Semua') {
    $sql .= ' AND kategori = ?';
    $params[] = $kategori;
}
$sql .= ' ORDER BY tahun_perolehan DESC, nama ASC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$assets = $stmt->fetchAll();

function excel_safe_cell(?string $val): string
{
    $v = (string) ($val ?? '');
    if (preg_match('/^[=+\-@]/', $v)) {
        $v = "'" . $v;
    }
    return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$filename = 'Data-Aset-Desa-Adimulya-' . date('Y-m-d') . '.xls';
header('Content-Type: application/vnd.ms-excel; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: max-age=0');

echo "\xEF\xBB\xBF";
?>
<html>
<head><meta charset="UTF-8"></head>
<body>
<h3>INVENTARIS DATA ASET DESA ADIMULYA (SIMPANDADU)</h3>
<p>Tanggal Ekspor: <?= e(format_waktu_indonesia()) ?></p>
<table border="1" cellpadding="6" cellspacing="0">
  <thead>
    <tr style="background:#0B1F3A;color:#FFFFFF;font-weight:bold;">
      <th>No</th>
      <th>Nama Aset</th>
      <th>Kategori</th>
      <th>Lokasi</th>
      <th>Tahun Perolehan</th>
      <th>Jumlah</th>
      <th>Satuan</th>
      <th>Kondisi</th>
      <th>Koordinat (Lat, Lng)</th>
      <th>Keterangan</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($assets as $idx => $a): ?>
    <tr>
      <td><?= $idx + 1 ?></td>
      <td><?= excel_safe_cell($a['nama']) ?></td>
      <td><?= excel_safe_cell($a['kategori']) ?></td>
      <td><?= excel_safe_cell($a['lokasi']) ?></td>
      <td><?= (int) $a['tahun_perolehan'] ?></td>
      <td><?= (int) $a['jumlah'] ?></td>
      <td><?= excel_safe_cell($a['satuan']) ?></td>
      <td><?= excel_safe_cell($a['kondisi']) ?></td>
      <td><?= ($a['lat'] !== null && $a['lng'] !== null) ? e($a['lat'] . ', ' . $a['lng']) : 'Belum diisi' ?></td>
      <td><?= excel_safe_cell($a['keterangan']) ?></td>
    </tr>
    <?php endforeach; ?>
  </tbody>
</table>
</body>
</html>
