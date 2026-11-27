# SIMPANDADU — Sistem Informasi Perencanaan dan Administrasi Desa Adimulya Terpadu
**(Versi PHP Native + MySQL untuk XAMPP & VS Code)**

Website resmi sistem informasi pemerintahan Balai Desa Adimulya yang mencakup:
1. **Portal Usulan Musrenbang Warga (`index.php`)**: Pengajuan usulan pembangunan oleh masyarakat tanpa login, upload foto kondisi lokasi, nomor pengajuan otomatis (`MSRB-YYYY-XXXX`), cek status pengajuan, dan daftar usulan terpublikasi dengan perlindungan privasi identitas warga.
2. **Autentikasi Aman & Konfirmasi Login Email (`login.php`, `email-action.php`)**: Pendaftaran akun admin pertama kali saat instalasi, toggle tampil/sembunyikan password, konfirmasi login perangkat/sesi baru melalui email dengan tombol sekali pakai **IZINKAN LOGIN** / **TOLAK LOGIN**, batas waktu kedaluwarsa, dan email hasil konfirmasi.
3. **Dashboard Admin (`dashboard.php`)**: Statistik aset desa, grafik kondisi aset, peta ringkas sebaran aset, ringkasan berita Indonesia, ringkasan usulan Musrenbang, dan pencarian terpadu.
4. **Peta Desa Interaktif (`peta-desa.php`)**: Integrasi Leaflet & OpenStreetMap untuk menampilkan penanda aset desa, data dusun, batas wilayah, dan formulir input koordinat resmi.
5. **Data Inventaris Aset (`data-aset.php`)**: CRUD penuh ke MySQL, filter 10 kategori aset, pencarian, cetak laporan/PDF, dan export Excel (`.xls`).
6. **Portal Berita Indonesia Terkini (`berita.php`)**: Agregasi RSS media nasional Indonesia dengan cache MySQL, filter kategori, pencarian, dan mode fallback saat offline.
7. **Manajemen Musrenbang Admin (`musrenbang.php`)**: Verifikasi usulan warga & admin, pratinjau foto lapangan, catatan internal & catatan untuk pengusul, toggle publikasi warga, cetak laporan, dan export Excel.
8. **Profil Akun Admin & Lonceng Notifikasi (`profil-akun.php`, `api/notifications.php`)**: Foto profil, edit informasi profil, ganti password, ubah email dengan verifikasi kode 6 digit & tautan sekali pakai, perangkat terpercaya, pengaturan keamanan SMTP, dan riwayat aktivitas/login.

---

## Panduan Instalasi Lengkap Menggunakan XAMPP & VS Code

### 1. Persiapan Software
Pastikan Anda sudah menginstal:
- **XAMPP** (dengan **PHP 8.0+** dan **MySQL / MariaDB**).
- **Visual Studio Code (VS Code)** untuk membuka dan mengedit source code.
- Browser modern (Google Chrome / Microsoft Edge / Firefox).

### 2. Ekstrak File ZIP ke Folder `htdocs` XAMPP
1. Ekstrak file ZIP hasil unduhan.
2. Pastikan nama folder proyek adalah **`simpandadu`** dan letakkan di dalam folder `htdocs` XAMPP:
   - **Windows**: `C:\xampp\htdocs\simpandadu`
   - **macOS**: `/Applications/XAMPP/htdocs/simpandadu`
   - **Linux**: `/opt/lampp/htdocs/simpandadu`

### 3. Buka Proyek di VS Code
1. Jalankan **VS Code**.
2. Klik menu **File → Open Folder...** lalu pilih folder `simpandadu` di dalam `htdocs`.
3. Anda dapat memeriksa seluruh struktur file (`config/`, `database/`, `includes/`, `api/`, `assets/`, `uploads/`, dan halaman `.php`).

### 4. Jalankan Apache & MySQL di XAMPP Control Panel
1. Buka **XAMPP Control Panel**.
2. Klik tombol **Start** pada modul **Apache**.
3. Klik tombol **Start** pada modul **MySQL**.
4. Pastikan keduanya berstatus hijau (**Running**).

### 5. Buat & Import Database MySQL lewat phpMyAdmin
1. Buka browser dan akses: **`http://localhost/phpmyadmin`**
2. Klik tab **Import** (atau buat database baru bernama `simpandadu_db`, lalu klik tab **Import**).
3. Klik **Choose File** dan pilih file:
   `database/simpandadu.sql` dari dalam folder proyek `simpandadu`.
4. Klik tombol **Import / Go** di bagian bawah.
5. Pastikan database `simpandadu_db` dan 12 tabel berhasil dibuat tanpa error.

### 6. Konfigurasi Koneksi Database & Email SMTP (VS Code)
Buka file **`config/config.php`** di VS Code:

1. **Database MySQL** (untuk XAMPP default biasanya tidak perlu diubah):
   ```php
   define('DB_HOST', '127.0.0.1');
   define('DB_PORT', '3306');
   define('DB_NAME', 'simpandadu_db');
   define('DB_USER', 'root');
   define('DB_PASS', '');
   ```
2. **Email SMTP (Opsional namun disarankan agar konfirmasi login dikirim langsung ke inbox email admin)**:
   Jika menggunakan Gmail, aktifkan *2-Step Verification* lalu buat *App Password* 16 digit, kemudian isi pada `config/config.php`:
   ```php
   define('SMTP_HOST', 'smtp.gmail.com');
   define('SMTP_PORT', 587);
   define('SMTP_SECURE', 'tls');
   define('SMTP_USER', 'emailadmin@gmail.com');
   define('SMTP_PASS', 'app_password_16_digit');
   define('SMTP_FROM', 'emailadmin@gmail.com');
   ```
   *(Catatan: Jika SMTP belum diisi, fitur konfirmasi login & verifikasi email tetap dapat diuji lewat tautan/kode pratinjau lokal di layar).*

### 7. Jalankan Website SIMPANDADU
1. Buka browser dan akses:
   - **Portal Warga Musrenbang**: `http://localhost/simpandadu/`
   - **Halaman Login Admin**: `http://localhost/simpandadu/login.php`
2. Pada kunjungan pertama ke `login.php`, sistem menampilkan **Form Pendaftaran Akun Admin Pertama** (membuat username, nama lengkap, jabatan, email admin, dan password yang otomatis di-hash aman di MySQL).
3. Setelah mendaftar, Anda langsung masuk ke **Dashboard SIMPANDADU**.

### 8. Pengaturan Permission Folder Upload (Khusus macOS / Linux)
Jika Anda menjalankan XAMPP di macOS atau Linux dan mengalami kendala saat upload foto profil atau foto usulan warga, jalankan perintah ini di terminal VS Code:
```bash
chmod -R 775 uploads/
```
