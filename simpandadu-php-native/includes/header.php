<?php
/**
 * Header & Sidebar Navigasi Dashboard Admin SIMPANDADU
 */

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$admin = $admin ?? require_admin();
$activePage = $activePage ?? 'dashboard';
$pageTitle = $pageTitle ?? 'Dashboard';
$pageSubtitle = $pageSubtitle ?? 'Sistem Informasi Perencanaan dan Administrasi Desa Adimulya Terpadu';
$unreadCount = get_unread_notification_count($admin['username']);
$flash = get_flash();

$avatarUrl = null;
if (!empty($admin['avatar_file'])) {
    $avatarUrl = 'uploads/avatars/' . rawurlencode(basename((string) $admin['avatar_file']));
}
$initials = strtoupper(substr(trim((string) $admin['full_name']), 0, 2) ?: 'AD');

$navItems = [
    ['id' => 'dashboard', 'href' => 'dashboard.php', 'label' => 'Dashboard'],
    ['id' => 'peta', 'href' => 'peta-desa.php', 'label' => 'Peta Desa'],
    ['id' => 'aset', 'href' => 'data-aset.php', 'label' => 'Data Aset'],
    ['id' => 'berita', 'href' => 'berita.php', 'label' => 'Berita Indonesia'],
    ['id' => 'musrenbang', 'href' => 'musrenbang.php', 'label' => 'Musrenbang'],
    ['id' => 'profil', 'href' => 'profil-akun.php', 'label' => 'Profil Akun'],
];
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
  <title><?= e($pageTitle) ?> — SIMPANDADU Desa Adimulya</title>
  <link rel="stylesheet" href="assets/css/style.css">
  <?php if (!empty($includeLeaflet)): ?>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <?php endif; ?>
</head>
<body>
<div class="app-shell">
  <aside id="appSidebar" class="sidebar">
    <div class="sidebar-brand">
      <img src="assets/images/logo_desa_adimulya.jpg" alt="Lambang Desa Adimulya">
      <div>
        <p class="sidebar-brand-title">SIMPANDADU</p>
        <p class="sidebar-brand-sub">Balai Desa Adimulya</p>
      </div>
    </div>

    <nav class="sidebar-nav" aria-label="Menu Utama">
      <?php foreach ($navItems as $item): ?>
        <a href="<?= e($item['href']) ?>" class="sidebar-link <?= $activePage === $item['id'] ? 'active' : '' ?>">
          <span><?= e($item['label']) ?></span>
        </a>
      <?php endforeach; ?>
      <a href="index.php" class="sidebar-link" style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:14px;">
        <span>Portal Musrenbang Warga</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <a href="profil-akun.php" class="sidebar-user-card">
        <?php if ($avatarUrl): ?>
          <img src="<?= e($avatarUrl) ?>" alt="Foto Profil" class="avatar-circle">
        <?php else: ?>
          <span class="avatar-circle"><?= e($initials) ?></span>
        <?php endif; ?>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?= e($admin['full_name']) ?></div>
          <div style="font-size:11.5px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><?= e($admin['jabatan']) ?></div>
        </div>
      </a>
      <form method="post" action="logout.php" style="margin:0;">
        <?= csrf_field() ?>
        <button type="submit" class="btn btn-outline" style="width:100%;background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.2);color:#fff;">
          Keluar Sistem
        </button>
      </form>
    </div>
  </aside>

  <div class="main-area">
    <header class="topbar">
      <div class="topbar-left">
        <button type="button" id="mobileMenuBtn" class="mobile-menu-btn" aria-label="Buka Menu">☰</button>
        <div>
          <h1 class="topbar-title"><?= e($pageTitle) ?></h1>
          <p class="topbar-subtitle"><?= e($pageSubtitle) ?></p>
        </div>
      </div>

      <div class="topbar-right">
        <div class="notif-wrapper">
          <button type="button" id="notifBellBtn" class="notif-bell-btn" aria-label="Notifikasi Keamanan" title="Notifikasi Keamanan">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            <span id="notifBadge" class="notif-badge tabular-nums" style="display:<?= $unreadCount > 0 ? 'inline-flex' : 'none' ?>;"><?= $unreadCount > 99 ? '99+' : (int) $unreadCount ?></span>
          </button>

          <div id="notifDropdown" class="notif-dropdown">
            <div class="notif-header">
              <strong style="font-size:13.5px;color:#0b1f3a;">Notifikasi Keamanan</strong>
              <button type="button" id="notifMarkAllBtn" class="btn btn-outline btn-sm">Tandai Semua Dibaca</button>
            </div>
            <div id="notifList" class="notif-list">
              <div style="padding:18px;text-align:center;color:#64748b;font-size:13px;">Memuat notifikasi...</div>
            </div>
            <div style="padding:10px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <a href="profil-akun.php?tab=riwayat" style="font-size:12.5px;font-weight:600;">Buka Riwayat & Pengaturan Akun →</a>
            </div>
          </div>
        </div>

        <a href="profil-akun.php" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:8px;">
          <?php if ($avatarUrl): ?>
            <img src="<?= e($avatarUrl) ?>" alt="Avatar" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">
          <?php endif; ?>
          <span><?= e($admin['username']) ?></span>
        </a>
      </div>
    </header>

    <main class="page-content">
      <?php if ($flash): ?>
        <?php
          $alertCls = match ($flash['type']) {
              'success' => 'alert-success',
              'danger', 'error' => 'alert-danger',
              'warning' => 'alert-warning',
              default => 'alert-info',
          };
        ?>
        <div class="alert <?= $alertCls ?>">
          <strong><?= e($flash['title']) ?></strong>
          <?php if (!empty($flash['message'])): ?>
            <div><?= e($flash['message']) ?></div>
          <?php endif; ?>
        </div>
      <?php endif; ?>
