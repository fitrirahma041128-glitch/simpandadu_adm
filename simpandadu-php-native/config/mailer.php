<?php
/**
 * Pengirim Email SMTP Native PHP (Tanpa Composer / Library Eksternal)
 * Mendukung STARTTLS (port 587/2525), SSL/TLS (port 465), dan logging outbox ke MySQL.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

function is_smtp_configured(): bool
{
    return trim(SMTP_HOST) !== '' && trim(SMTP_USER) !== '' && trim(SMTP_PASS) !== '';
}

function get_smtp_status(): array
{
    return [
        'configured' => is_smtp_configured(),
        'hostLabel' => trim(SMTP_HOST) !== '' ? trim(SMTP_HOST) : 'Belum dikonfigurasi',
        'port' => is_smtp_configured() ? SMTP_PORT : null,
        'fromAddress' => trim(SMTP_FROM),
    ];
}

function esc_html_mail(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function smtp_read_response($socket): string
{
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    return $response;
}

function smtp_expect($socket, array $expectedCodes): string
{
    $resp = smtp_read_response($socket);
    $code = (int) substr(trim($resp), 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP error (' . $code . '): ' . trim($resp));
    }
    return $resp;
}

function smtp_send_command($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");
    return smtp_expect($socket, $expectedCodes);
}

function send_smtp_native(string $to, string $subject, string $html, string $text): void
{
    $host = trim(SMTP_HOST);
    $port = SMTP_PORT > 0 ? SMTP_PORT : 587;
    $secure = strtolower(trim(SMTP_SECURE));
    $transportHost = ($secure === 'ssl' || $port === 465) ? 'ssl://' . $host : $host;

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
        ],
    ]);

    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client($transportHost . ':' . $port, $errno, $errstr, 12, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        throw new RuntimeException("Gagal terhubung ke server SMTP {$host}:{$port} ({$errstr})");
    }

    stream_set_timeout($socket, 12);

    try {
        smtp_expect($socket, [220]);
        $ehloHost = preg_replace('/[^a-zA-Z0-9.-]/', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost';
        smtp_send_command($socket, 'EHLO ' . $ehloHost, [250]);

        if ($secure !== 'ssl' && $port !== 465 && ($secure === 'tls' || $secure === 'starttls')) {
            smtp_send_command($socket, 'STARTTLS', [220]);
            $cryptoOk = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if (!$cryptoOk) {
                throw new RuntimeException('Gagal mengaktifkan enkripsi STARTTLS.');
            }
            smtp_send_command($socket, 'EHLO ' . $ehloHost, [250]);
        }

        smtp_send_command($socket, 'AUTH LOGIN', [334]);
        smtp_send_command($socket, base64_encode(SMTP_USER), [334]);
        smtp_send_command($socket, base64_encode(SMTP_PASS), [235]);

        $fromEmail = filter_var(SMTP_FROM, FILTER_VALIDATE_EMAIL) ? SMTP_FROM : SMTP_USER;
        smtp_send_command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        smtp_send_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtp_send_command($socket, 'DATA', [354]);

        $boundary = 'simpandadu_' . bin2hex(random_bytes(12));
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedFromName = '=?UTF-8?B?' . base64_encode(SMTP_FROM_NAME) . '?=';

        $headers = [
            'Date: ' . date('r'),
            'From: ' . $encodedFromName . ' <' . $fromEmail . '>',
            'To: <' . $to . '>',
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        $body = "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text)) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html)) . "\r\n"
            . "--{$boundary}--\r\n.";

        // Dot-stuffing safety is avoided because base64 never produces leading dots
        fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n");
        smtp_expect($socket, [250]);
        @fwrite($socket, "QUIT\r\n");
    } finally {
        fclose($socket);
    }
}

function send_transactional_email(string $to, string $subject, string $html, string $text): array
{
    if (!is_smtp_configured()) {
        return [
            'deliveryMode' => 'local_preview',
            'deliveryStatus' => 'preview_only',
            'errorMessage' => '',
        ];
    }

    try {
        send_smtp_native($to, $subject, $html, $text);
        return [
            'deliveryMode' => 'smtp',
            'deliveryStatus' => 'sent',
            'errorMessage' => '',
        ];
    } catch (Throwable $e) {
        return [
            'deliveryMode' => 'smtp',
            'deliveryStatus' => 'failed',
            'errorMessage' => $e->getMessage(),
        ];
    }
}

function build_login_confirmation_email(array $p): array
{
    $subject = '[SIMPANDADU] Konfirmasi Percobaan Login Baru - ' . $p['username'];
    $approveUrl = esc_html_mail($p['approveUrl']);
    $denyUrl = esc_html_mail($p['denyUrl']);
    $fullName = esc_html_mail($p['fullName']);
    $username = esc_html_mail($p['username']);
    $timeLabel = esc_html_mail($p['timeLabel']);
    $deviceLabel = esc_html_mail($p['deviceLabel']);
    $locationEstimate = esc_html_mail($p['locationEstimate']);
    $ipAddress = esc_html_mail($p['ipAddress']);
    $ttl = (int) $p['ttlMinutes'];

    $html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a;">'
        . '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">'
        . '<div style="background:#0B1F3A;padding:20px 24px;color:#ffffff;border-bottom:3px solid #D97706;">'
        . '<p style="margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#FCD34D;">Keamanan Akun SIMPANDADU</p>'
        . '<h1 style="margin:6px 0 0;font-size:19px;">Konfirmasi Percobaan Login Baru</h1>'
        . '</div>'
        . '<div style="padding:24px;">'
        . '<p style="margin-top:0;font-size:14px;line-height:1.6;">Halo <strong>' . $fullName . '</strong>, sistem mendeteksi percobaan login ke akun administrator <strong>' . $username . '</strong>.</p>'
        . '<table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:16px 0;font-size:13px;">'
        . '<tr><td style="padding:10px 14px;color:#475569;width:150px;border-bottom:1px solid #e2e8f0;">Waktu Percobaan</td><td style="padding:10px 14px;font-weight:bold;border-bottom:1px solid #e2e8f0;">' . $timeLabel . '</td></tr>'
        . '<tr><td style="padding:10px 14px;color:#475569;border-bottom:1px solid #e2e8f0;">Perangkat / Browser</td><td style="padding:10px 14px;font-weight:bold;border-bottom:1px solid #e2e8f0;">' . $deviceLabel . '</td></tr>'
        . '<tr><td style="padding:10px 14px;color:#475569;border-bottom:1px solid #e2e8f0;">Perkiraan Lokasi</td><td style="padding:10px 14px;font-weight:bold;border-bottom:1px solid #e2e8f0;">' . $locationEstimate . '</td></tr>'
        . '<tr><td style="padding:10px 14px;color:#475569;">Alamat IP</td><td style="padding:10px 14px;font-weight:bold;">' . $ipAddress . '</td></tr>'
        . '</table>'
        . '<p style="font-size:13px;color:#334155;line-height:1.6;">Tautan konfirmasi ini berlaku <strong>' . $ttl . ' menit</strong> dan hanya dapat digunakan satu kali. Demi keamanan, sistem tidak pernah mengirimkan password melalui email.</p>'
        . '<div style="margin:22px 0;">'
        . '<a href="' . $approveUrl . '" style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 20px;border-radius:8px;margin-right:10px;">IZINKAN LOGIN</a>'
        . '<a href="' . $denyUrl . '" style="display:inline-block;background:#DC2626;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 20px;border-radius:8px;">TOLAK LOGIN</a>'
        . '</div>'
        . '<p style="font-size:12px;color:#64748b;margin-bottom:0;">Jika Anda tidak mencoba masuk, segera pilih <strong>TOLAK LOGIN</strong> dan perbarui password di menu Profil Akun.</p>'
        . '</div></div></div>';

    $text = "Konfirmasi Percobaan Login Baru SIMPANDADU\n"
        . "Akun: {$p['fullName']} ({$p['username']})\n"
        . "Waktu: {$p['timeLabel']}\n"
        . "Perangkat: {$p['deviceLabel']}\n"
        . "Perkiraan Lokasi: {$p['locationEstimate']}\n"
        . "Alamat IP: {$p['ipAddress']}\n"
        . "Berlaku: {$ttl} menit (sekali pakai)\n\n"
        . "IZINKAN LOGIN: {$p['approveUrl']}\n"
        . "TOLAK LOGIN: {$p['denyUrl']}\n";

    return compact('subject', 'html', 'text');
}

function build_login_decision_result_email(array $p): array
{
    $isApproved = $p['decision'] === 'approved';
    $label = $isApproved ? 'Login Diizinkan' : 'Login Ditolak & Dibatalkan';
    $color = $isApproved ? '#15803D' : '#B91C1C';
    $subject = "[SIMPANDADU] Pemberitahuan Hasil Konfirmasi: {$label}";

    $html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a;">'
        . '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">'
        . '<div style="background:#0B1F3A;padding:18px 24px;color:#ffffff;">'
        . '<h2 style="margin:0;font-size:18px;">Hasil Konfirmasi Keamanan Login</h2>'
        . '</div><div style="padding:24px;">'
        . '<p style="margin-top:0;font-size:14px;">Halo <strong>' . esc_html_mail($p['fullName']) . '</strong>,</p>'
        . '<p style="font-size:14px;font-weight:bold;color:' . $color . ';">Status Konfirmasi: ' . esc_html_mail($label) . '</p>'
        . '<p style="font-size:13px;color:#334155;line-height:1.6;">Akun: ' . esc_html_mail($p['username']) . '<br>'
        . 'Waktu Keputusan: ' . esc_html_mail($p['timeLabel']) . '<br>'
        . 'Perangkat: ' . esc_html_mail($p['deviceLabel']) . '<br>'
        . 'Lokasi / IP: ' . esc_html_mail($p['locationEstimate']) . ' (' . esc_html_mail($p['ipAddress']) . ')</p>'
        . '<p style="font-size:12px;color:#64748b;margin-bottom:0;">Aktivitas ini telah dicatat dalam riwayat keamanan akun SIMPANDADU.</p>'
        . '</div></div></div>';

    $text = "Hasil Konfirmasi Login SIMPANDADU: {$label}\n"
        . "Waktu: {$p['timeLabel']}\nPerangkat: {$p['deviceLabel']}\nLokasi: {$p['locationEstimate']} ({$p['ipAddress']})\n";

    return compact('subject', 'html', 'text');
}

function build_email_verification_email(array $p): array
{
    $subject = '[SIMPANDADU] Verifikasi Perubahan Alamat Email Admin';
    $html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a;">'
        . '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">'
        . '<div style="background:#0B1F3A;padding:18px 24px;color:#ffffff;border-bottom:3px solid #D97706;">'
        . '<h2 style="margin:0;font-size:18px;">Verifikasi Email Baru Admin SIMPANDADU</h2>'
        . '</div><div style="padding:24px;">'
        . '<p style="margin-top:0;font-size:14px;">Halo <strong>' . esc_html_mail($p['fullName']) . '</strong>, Anda mengajukan pembaruan email ke <strong>' . esc_html_mail($p['newEmail']) . '</strong>.</p>'
        . '<p style="font-size:13px;color:#334155;">Kode Verifikasi 6 Digit:</p>'
        . '<div style="display:inline-block;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px 18px;font-size:22px;font-weight:bold;letter-spacing:4px;color:#0B1F3A;">' . esc_html_mail($p['code']) . '</div>'
        . '<p style="font-size:13px;color:#334155;margin-top:16px;">Atau klik tautan sekali pakai di bawah ini (berlaku 30 menit):</p>'
        . '<a href="' . esc_html_mail($p['verifyUrl']) . '" style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;padding:11px 18px;border-radius:8px;">VERIFIKASI EMAIL BARU</a>'
        . '</div></div></div>';

    $text = "Verifikasi Email Baru SIMPANDADU\nEmail Baru: {$p['newEmail']}\nKode 6 Digit: {$p['code']}\nTautan: {$p['verifyUrl']}\n";
    return compact('subject', 'html', 'text');
}

function build_security_alert_email(array $p): array
{
    $subject = '[SIMPANDADU] Pemberitahuan Keamanan: ' . $p['title'];
    $html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px;color:#0f172a;">'
        . '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;">'
        . '<div style="background:#0B1F3A;padding:18px 24px;color:#ffffff;">'
        . '<h2 style="margin:0;font-size:18px;">' . esc_html_mail($p['title']) . '</h2>'
        . '</div><div style="padding:24px;">'
        . '<p style="margin-top:0;font-size:14px;">Halo <strong>' . esc_html_mail($p['fullName']) . '</strong>,</p>'
        . '<p style="font-size:13px;color:#334155;line-height:1.6;">' . esc_html_mail($p['detail']) . '</p>'
        . '<p style="font-size:12px;color:#64748b;margin-bottom:0;">Waktu: ' . esc_html_mail($p['timeLabel']) . '<br>Perangkat: ' . esc_html_mail($p['deviceLabel']) . '<br>Lokasi/IP: ' . esc_html_mail($p['locationEstimate']) . ' (' . esc_html_mail($p['ipAddress']) . ')</p>'
        . '</div></div></div>';

    $text = "{$p['title']}\n{$p['detail']}\nWaktu: {$p['timeLabel']}\nPerangkat: {$p['deviceLabel']}\nLokasi: {$p['locationEstimate']} ({$p['ipAddress']})\n";
    return compact('subject', 'html', 'text');
}
