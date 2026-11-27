<?php
/**
 * Koneksi PDO MySQL untuk SIMPANDADU
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function get_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_PORT,
        DB_NAME
    );

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: text/html; charset=utf-8');
        $msg = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
        echo '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Koneksi Database Gagal - SIMPANDADU</title>';
        echo '<style>body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;padding:40px 20px;}';
        echo '.box{max-width:640px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:28px;}';
        echo 'h1{margin:0 0 12px;font-size:20px;color:#0b1f3a;}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;}</style></head><body>';
        echo '<div class="box"><h1>Koneksi Database MySQL Belum Siap</h1>';
        echo '<p>Pastikan service <strong>MySQL</strong> di XAMPP sedang berjalan, database <code>' . htmlspecialchars(DB_NAME, ENT_QUOTES, 'UTF-8') . '</code> sudah dibuat, dan file <code>database/simpandadu.sql</code> telah diimpor via phpMyAdmin.</p>';
        echo '<p>Periksa juga kredensial pada <code>config/config.php</code>.</p>';
        echo '<p style="font-size:13px;color:#64748b;">Detail teknis: ' . $msg . '</p></div></body></html>';
        exit;
    }
}
