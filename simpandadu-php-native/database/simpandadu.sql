-- =============================================================================
-- DATABASE SIMPANDADU (Sistem Informasi Perencanaan & Administrasi Desa Adimulya Terpadu)
-- Kompatibel dengan MySQL 5.7+ / MariaDB 10.4+ (XAMPP)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `simpandadu_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `simpandadu_db`;

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+07:00";

-- -----------------------------------------------------------------------------
-- 1. Tabel Akun Admin & Pengaturan Keamanan Akun
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_accounts` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(180) NOT NULL DEFAULT '',
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `pending_email` VARCHAR(180) DEFAULT NULL,
  `phone` VARCHAR(40) NOT NULL DEFAULT '',
  `jabatan` VARCHAR(120) NOT NULL DEFAULT 'Administrator Balai Desa',
  `role` VARCHAR(120) NOT NULL DEFAULT 'Administrator Balai Desa',
  `avatar_file` VARCHAR(255) DEFAULT NULL,
  `require_email_login_approval` TINYINT(1) NOT NULL DEFAULT 1,
  `notify_on_login_success` TINYINT(1) NOT NULL DEFAULT 1,
  `notify_on_security_change` TINYINT(1) NOT NULL DEFAULT 1,
  `login_approval_ttl_minutes` INT NOT NULL DEFAULT 10,
  `approval_policy` ENUM('new_device','every_login') NOT NULL DEFAULT 'new_device',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Tabel Tantangan Konfirmasi Login Email (IZINKAN LOGIN / TOLAK LOGIN)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_challenges` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL,
  `admin_email` VARCHAR(180) NOT NULL,
  `poll_secret_hash` CHAR(64) NOT NULL,
  `approve_token_hash` CHAR(64) NOT NULL,
  `deny_token_hash` CHAR(64) NOT NULL,
  `device_fingerprint` CHAR(64) NOT NULL,
  `device_label` VARCHAR(255) NOT NULL,
  `browser_name` VARCHAR(80) NOT NULL,
  `os_name` VARCHAR(80) NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `location_estimate` VARCHAR(180) NOT NULL,
  `status` ENUM('pending','approved','denied','expired','completed') NOT NULL DEFAULT 'pending',
  `trusted_device_token` VARCHAR(128) DEFAULT NULL,
  `decision_reason` VARCHAR(255) NOT NULL DEFAULT '',
  `expires_at` BIGINT NOT NULL,
  `decided_at` DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_login_challenges_user` (`username`, `created_at`),
  INDEX `idx_login_challenges_approve` (`approve_token_hash`),
  INDEX `idx_login_challenges_deny` (`deny_token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Tabel Token Verifikasi Perubahan Email Admin
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL,
  `new_email` VARCHAR(180) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `code_hash` CHAR(64) NOT NULL,
  `expires_at` BIGINT NOT NULL,
  `used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_email_verify_token` (`token_hash`),
  INDEX `idx_email_verify_user` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Tabel Perangkat Terpercaya
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trusted_devices` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `device_label` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `location_estimate` VARCHAR(180) NOT NULL,
  `last_used_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` DATETIME DEFAULT NULL,
  INDEX `idx_trusted_devices_user` (`username`, `revoked_at`),
  INDEX `idx_trusted_devices_token` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Tabel Notifikasi Keamanan (Lonceng Header Dashboard)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `security_notifications` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL,
  `type` ENUM('login_attempt','login_confirmation_request','login_success','login_denied','profile_updated','password_changed','security_alert') NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `severity` ENUM('info','warning','danger','success') NOT NULL DEFAULT 'info',
  `metadata_json` TEXT,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notifications_user_read` (`username`, `is_read`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Tabel Riwayat Aktivitas & Login Admin
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(80) NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `description` TEXT NOT NULL,
  `device_label` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `location_estimate` VARCHAR(180) NOT NULL,
  `status` ENUM('Berhasil','Menunggu','Disetujui','Ditolak','Kedaluwarsa','Peringatan') NOT NULL DEFAULT 'Berhasil',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_activity_logs_user` (`username`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Tabel Outbox Email (Log Pengiriman SMTP & Pratinjau Lokal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `email_outbox_logs` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `recipient_email` VARCHAR(180) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `category` VARCHAR(60) NOT NULL,
  `delivery_mode` ENUM('smtp','local_preview') NOT NULL,
  `delivery_status` ENUM('sent','failed','preview_only') NOT NULL,
  `error_message` TEXT,
  `preview_html` MEDIUMTEXT,
  `preview_text` MEDIUMTEXT,
  `challenge_id` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_outbox_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Tabel Inventaris Aset Desa Adimulya
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `village_assets` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `nama` VARCHAR(200) NOT NULL,
  `kategori` ENUM('Tanah Desa','Bangunan','Infrastruktur','Kendaraan','Peralatan','Fasilitas Umum','Pertanian','Jaringan','Konservasi','Lainnya') NOT NULL,
  `lokasi` VARCHAR(200) NOT NULL,
  `tahun_perolehan` INT NOT NULL,
  `jumlah` INT NOT NULL DEFAULT 1,
  `satuan` VARCHAR(60) NOT NULL DEFAULT 'Unit',
  `kondisi` ENUM('Baik','Perlu Perbaikan','Rusak Berat') NOT NULL DEFAULT 'Baik',
  `keterangan` TEXT,
  `lat` DECIMAL(10,7) DEFAULT NULL,
  `lng` DECIMAL(10,7) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_assets_kategori` (`kategori`),
  INDEX `idx_assets_kondisi` (`kondisi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Tabel Usulan Musrenbang (Warga & Admin)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `musrenbang_proposals` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `nomor_pengajuan` VARCHAR(40) NOT NULL UNIQUE,
  `sumber` ENUM('Warga','Admin') NOT NULL DEFAULT 'Warga',
  `nama_pengusul` VARCHAR(150) NOT NULL,
  `nomor_hp` VARCHAR(40) DEFAULT '',
  `dusun` VARCHAR(100) DEFAULT '',
  `rt_rw` VARCHAR(60) DEFAULT '',
  `judul_usulan` VARCHAR(220) NOT NULL,
  `kategori` ENUM('Infrastruktur','Pendidikan','Kesehatan','Ekonomi','Pertanian','Sarana dan Prasarana','Lingkungan') NOT NULL,
  `lokasi` VARCHAR(200) NOT NULL,
  `tanggal_pengajuan` DATE NOT NULL,
  `prioritas` ENUM('Tinggi','Sedang','Rendah') NOT NULL DEFAULT 'Sedang',
  `status` ENUM('Diajukan','Menunggu Verifikasi','Dalam Pembahasan','Disetujui','Ditolak','Selesai') NOT NULL DEFAULT 'Menunggu Verifikasi',
  `estimasi_anggaran` VARCHAR(100) DEFAULT 'Menunggu verifikasi RAB desa',
  `deskripsi` TEXT NOT NULL,
  `catatan_verifikasi` TEXT,
  `catatan_untuk_pengusul` TEXT,
  `foto_file` VARCHAR(255) DEFAULT NULL,
  `dipublikasikan` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_proposals_status` (`status`),
  INDEX `idx_proposals_public` (`dipublikasikan`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. Tabel Konfigurasi Peta Wilayah & Dusun Desa Adimulya
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `map_config` (
  `id` INT NOT NULL PRIMARY KEY,
  `balai_desa_lat` DECIMAL(10,7) DEFAULT NULL,
  `balai_desa_lng` DECIMAL(10,7) DEFAULT NULL,
  `default_zoom` INT NOT NULL DEFAULT 14,
  `batas_utara` VARCHAR(255) NOT NULL DEFAULT '[Belum diisi - masukkan batas wilayah utara resmi]',
  `batas_selatan` VARCHAR(255) NOT NULL DEFAULT '[Belum diisi - masukkan batas wilayah selatan resmi]',
  `batas_timur` VARCHAR(255) NOT NULL DEFAULT '[Belum diisi - masukkan batas wilayah timur resmi]',
  `batas_barat` VARCHAR(255) NOT NULL DEFAULT '[Belum diisi - masukkan batas wilayah barat resmi]',
  `boundary_json` TEXT,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `village_dusun` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `nama` VARCHAR(150) NOT NULL,
  `kepala_dusun` VARCHAR(150) NOT NULL,
  `jumlah_rw` INT NOT NULL DEFAULT 1,
  `jumlah_rt` INT NOT NULL DEFAULT 1,
  `lat` DECIMAL(10,7) DEFAULT NULL,
  `lng` DECIMAL(10,7) DEFAULT NULL,
  `keterangan` TEXT,
  `urutan` INT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. Tabel Cache Berita Indonesia Terkini
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `news_cache` (
  `id` INT NOT NULL PRIMARY KEY,
  `payload_json` LONGTEXT NOT NULL,
  `is_demo_fallback` TINYINT(1) NOT NULL DEFAULT 0,
  `fetched_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- DATA AWAL CONTOH (SILAKAN SESUAIKAN DENGAN DATA RESMI DESA ADIMULYA)
-- =============================================================================

INSERT IGNORE INTO `map_config` (`id`, `balai_desa_lat`, `balai_desa_lng`, `default_zoom`, `batas_utara`, `batas_selatan`, `batas_timur`, `batas_barat`, `boundary_json`) VALUES
(1, NULL, NULL, 14, '[Belum diisi — masukkan batas wilayah utara resmi]', '[Belum diisi — masukkan batas wilayah selatan resmi]', '[Belum diisi — masukkan batas wilayah timur resmi]', '[Belum diisi — masukkan batas wilayah barat resmi]', '[]');

INSERT IGNORE INTO `village_dusun` (`id`, `nama`, `kepala_dusun`, `jumlah_rw`, `jumlah_rt`, `lat`, `lng`, `keterangan`, `urutan`) VALUES
('dsn-1', 'Dusun I (Contoh — Edit Nama Resmi)', '[Nama Kepala Dusun I]', 2, 6, NULL, NULL, 'Wilayah pusat pelayanan Balai Desa Adimulya. Silakan isi koordinat resmi.', 1),
('dsn-2', 'Dusun II (Contoh — Edit Nama Resmi)', '[Nama Kepala Dusun II]', 2, 5, NULL, NULL, 'Kawasan permukiman dan lahan pertanian produktif. Silakan isi koordinat resmi.', 2),
('dsn-3', 'Dusun III (Contoh — Edit Nama Resmi)', '[Nama Kepala Dusun III]', 2, 5, NULL, NULL, 'Kawasan fasilitas pendidikan dan sentra UMKM warga. Silakan isi koordinat resmi.', 3);

INSERT IGNORE INTO `village_assets` (`id`, `nama`, `kategori`, `lokasi`, `tahun_perolehan`, `jumlah`, `satuan`, `kondisi`, `keterangan`, `lat`, `lng`) VALUES
('ast-001', 'Gedung Balai Desa Adimulya (Contoh Data)', 'Bangunan', 'Dusun I (Pusat Pemerintahan)', 2018, 1, 'Unit', 'Baik', 'Contoh data awal. Silakan sesuaikan atau tambahkan koordinat resmi pada menu Edit.', NULL, NULL),
('ast-002', 'Tanah Kas Desa Blok Persawahan (Contoh Data)', 'Tanah Desa', 'Dusun II', 1995, 2, 'Bidang', 'Baik', 'Lahan produktif desa; perbarui sesuai Buku Inventaris Aset Desa.', NULL, NULL),
('ast-003', 'Saluran Irigasi Tersier Padi (Contoh Data)', 'Pertanian', 'Dusun II', 2020, 450, 'Meter', 'Perlu Perbaikan', 'Sebagian dinding beton mengalami retakan ringan menjelang musim tanam.', NULL, NULL),
('ast-004', 'Jembatan Penghubung Antar Dusun (Contoh Data)', 'Infrastruktur', 'Perbatasan Dusun I & III', 2012, 1, 'Unit', 'Rusak Berat', 'Memerlukan rehabilitasi struktur abutment dan lantai jembatan.', NULL, NULL),
('ast-005', 'Ambulans Siaga Desa (Contoh Data)', 'Kendaraan', 'Garasi Balai Desa', 2022, 1, 'Unit', 'Baik', 'Siap operasional 24 jam untuk layanan rujukan kesehatan warga.', NULL, NULL),
('ast-006', 'Perangkat Komputer & Server Administrasi (Contoh Data)', 'Peralatan', 'Ruang Pelayanan Balai Desa', 2023, 4, 'Unit', 'Baik', 'Digunakan untuk pelayanan surat-menyurat dan administrasi kependudukan.', NULL, NULL),
('ast-007', 'Posyandu Melati & Taman Baca (Contoh Data)', 'Fasilitas Umum', 'Dusun III', 2019, 1, 'Unit', 'Perlu Perbaikan', 'Atap teras memerlukan penggantian genteng dan pengecatan ulang.', NULL, NULL),
('ast-008', 'Jaringan Penerangan Jalan Umum Tenaga Surya (Contoh Data)', 'Jaringan', 'Jalan Poros Desa Adimulya', 2024, 18, 'Titik', 'Baik', 'Sebanyak 18 titik lampu terpasang di sepanjang jalur utama desa.', NULL, NULL);

INSERT IGNORE INTO `musrenbang_proposals` (`id`, `nomor_pengajuan`, `sumber`, `nama_pengusul`, `nomor_hp`, `dusun`, `rt_rw`, `judul_usulan`, `kategori`, `lokasi`, `tanggal_pengajuan`, `prioritas`, `status`, `estimasi_anggaran`, `deskripsi`, `catatan_verifikasi`, `catatan_untuk_pengusul`, `foto_file`, `dipublikasikan`) VALUES
('mus-001', 'MSRB-2026-0001', 'Admin', 'Kadus I / Ketua RW 01 (Contoh)', '', 'Dusun I', 'RT 02 / RW 01', 'Pengaspalan Jalan Lingkungan Poros Dusun I', 'Infrastruktur', 'Dusun I RT 02 / RW 01', '2026-01-14', 'Tinggi', 'Disetujui', 'Rp 185.000.000', 'Peningkatan kualitas jalan akses utama warga dan distribusi hasil pertanian sepanjang 400 meter.', 'Masuk prioritas RKPDes tahun anggaran berjalan.', 'Usulan disetujui dalam MusrenbangDes dan masuk daftar prioritas RKPDes.', NULL, 1),
('mus-002', 'MSRB-2026-0002', 'Admin', 'Kader Posyandu (Contoh)', '', 'Dusun II', '', 'Pengadaan Alat Antropometri & PMT Balita Terpadu', 'Kesehatan', 'Posyandu Dusun II & III', '2026-01-19', 'Tinggi', 'Dalam Pembahasan', 'Rp 42.500.000', 'Pencegahan stunting dan peningkatan kualitas pemeriksaan ibu hamil serta balita.', 'Menunggu sinkronisasi pagu anggaran bidang kesehatan.', 'Sedang dalam pembahasan pagu anggaran bersama BPD.', NULL, 0),
('mus-003', 'MSRB-2026-0003', 'Admin', 'Kelompok Tani Karya Makmur (Contoh)', '', 'Dusun II', '', 'Rehabilitasi Saluran Irigasi Tersier Blok Timur', 'Pertanian', 'Dusun II', '2026-02-02', 'Tinggi', 'Menunggu Verifikasi', 'Rp 110.000.000', 'Perbaikan tanggul dan pintu air guna menjaga pasokan irigasi lahan sawah warga.', 'Tim teknis desa dijadwalkan melakukan survei lapangan.', 'Menunggu jadwal peninjauan lokasi oleh tim teknis desa.', NULL, 0),
('mus-004', 'MSRB-2026-0004', 'Admin', 'Karang Taruna Adimulya (Contoh)', '', 'Dusun I', '', 'Pelatihan Kewirausahaan Digital & Kemasan UMKM', 'Ekonomi', 'Aula Balai Desa Adimulya', '2026-02-08', 'Sedang', 'Diajukan', 'Rp 28.000.000', 'Peningkatan kapasitas pelaku usaha mikro lokal dalam pemasaran daring dan legalitas NIB.', '', '', NULL, 0),
('mus-005', 'MSRB-2025-0005', 'Admin', 'Pengurus PAUD Harapan (Contoh)', '', 'Dusun III', '', 'Renovasi Ruang Belajar PAUD & Pengadaan Buku Bacaan', 'Pendidikan', 'Dusun III', '2025-11-20', 'Sedang', 'Selesai', 'Rp 65.000.000', 'Pengecatan ruang kelas, perbaikan plafon, serta penambahan koleksi buku anak.', 'Telah direalisasikan dan diserahterimakan.', 'Kegiatan telah selesai dilaksanakan dan dapat dimanfaatkan warga.', NULL, 1);
