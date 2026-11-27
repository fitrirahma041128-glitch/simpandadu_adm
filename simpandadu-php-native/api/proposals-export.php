<?php
/**
 * Export Usulan Musrenbang Desa Adimulya ke Format Excel (.xls)
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

require_admin();
$db = get_db();

$stmt = $db->query('SELECT * FROM musrenbang_proposals ORDER BY created_at DESC');
$rows = $stmt->fetchAll();

function excel_safe_proposal_cell(?string $val): string
{
    $v = (string) ($val ?? '');
    if (preg_match('/^[=+\-@]/', $v)) {
        $v = "'" . $v;
    }
    return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$filename = 'Laporan-Musrenbang-Desa-Adimulya-' . date('Y-m-d') . '.xls';
header('Content-Type: application/vnd.ms-excel; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: max-age=0');

echo "\xEF\xBB\xBF";
?>
<html>
<head><meta charset="UTF-8"></head>
<body>
<h3>REKAPITULASI USULAN MUSRENBANG DESA ADIMULYA (SIMPANDADU)</h3>
<p>Tanggal Ekspor: <?= e(format_waktu_indonesia()) ?></p>
<table border="1" cellpadding="6" cellspacing="0">
  <thead>
    <tr style="background:#0B1F3A;color:#FFFFFF;font-weight:bold;">
      <th>No</th>
      <th>Nomor Pengajuan</th>
      <th>Sumber</th>
      <th>Pengusul</th>
      <th>Nomor HP</th>
      <th>Dusun / RT RW</th>
      <th>Judul Usulan</th>
      <th>Kategori</th>
      <th>Lokasi Kegiatan</th>
      <th>Tanggal</th>
      <th>Prioritas</th>
      <th>Status</th>
      <th>Estimasi Anggaran</th>
      <th>Dipublikasikan</th>
      <th>Catatan Verifikasi</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($rows as $idx => $p): ?>
    <tr>
      <td><?= $idx + 1 ?></td>
      <td><?= excel_safe_proposal_cell($p['nomor_pengajuan']) ?></td>
      <td><?= excel_safe_proposal_cell($p['sumber']) ?></td>
      <td><?= excel_safe_proposal_cell($p['nama_pengusul']) ?></td>
      <td><?= excel_safe_proposal_cell($p['nomor_hp']) ?></td>
      <td><?= excel_safe_proposal_cell(trim($p['dusun'] . ' ' . $p['rt_rw'])) ?></td>
      <td><?= excel_safe_proposal_cell($p['judul_usulan']) ?></td>
      <td><?= excel_safe_proposal_cell($p['kategori']) ?></td>
      <td><?= excel_safe_proposal_cell($p['lokasi']) ?></td>
      <td><?= excel_safe_proposal_cell($p['tanggal_pengajuan']) ?></td>
      <td><?= excel_safe_proposal_cell($p['prioritas']) ?></td>
      <td><?= excel_safe_proposal_cell($p['status']) ?></td>
      <td><?= excel_safe_proposal_cell($p['estimasi_anggaran']) ?></td>
      <td><?= !empty($p['dipublikasikan']) ? 'Ya' : 'Tidak' ?></td>
      <td><?= excel_safe_proposal_cell($p['catatan_verifikasi']) ?></td>
    </tr>
    <?php endforeach; ?>
  </tbody>
</table>
</body>
</html>
