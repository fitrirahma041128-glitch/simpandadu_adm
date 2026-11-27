<?php
/**
 * Logout Aman Admin SIMPANDADU (Wajib POST + CSRF)
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !verify_csrf()) {
    header('Location: dashboard.php');
    exit;
}

ensure_session_started();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}
session_destroy();

set_flash('info', 'Anda Telah Keluar', 'Sesi SIMPANDADU telah diakhiri.');
header('Location: login.php');
exit;
