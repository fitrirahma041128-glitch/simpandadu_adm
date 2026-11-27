import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import Parser from 'rss-parser';
import {
  buildEmailVerificationEmail,
  buildLoginConfirmationEmail,
  buildLoginDecisionResultEmail,
  buildSecurityAlertEmail,
  getSmtpStatus,
  isSmtpConfigured,
  sendTransactionalEmail,
} from './server/mailer.ts';
import {
  createSecurityNotification,
  estimateLoginLocation,
  formatWaktuIndonesia,
  getAdminAccount,
  getAdminAccountByUsername,
  getSecurityDb,
  maskEmailAddress,
  parseDeviceContext,
  recordActivityLog,
  recordEmailOutbox,
  sha256Hex,
  type DbActivityLog,
  type DbAdminAccount,
  type DbEmailOutboxLog,
  type DbEmailVerificationToken,
  type DbLoginChallenge,
  type DbSecurityNotification,
  type DbTrustedDevice,
} from './server/securityDb.ts';
import type {
  AdminAccountProfile,
  AdminUser,
  AssetCategory,
  AssetCondition,
  MapConfig,
  MusrenbangProposal,
  NewsArticle,
  NewsCategory,
  NewsResponse,
  ProposalCategory,
  ProposalPriority,
  ProposalStatus,
  PublicApprovedProposal,
  PublicProposalStatusItem,
  VillageAsset,
  VillageProfile,
} from './src/types.ts';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');
const STORE_FILE = path.join(DATA_DIR, 'simpandadu-store.json');
const SESSION_COOKIE_NAME = 'simpandadu_sid';
const DEVICE_COOKIE_NAME = 'simpandadu_device';
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

interface AdminAccountRecord {
  username: string;
  passwordHash: string;
  fullName: string;
  role: string;
  createdAt: string;
}

interface StoreData {
  adminAccount: AdminAccountRecord | null;
  assets: VillageAsset[];
  proposals: MusrenbangProposal[];
  mapConfig: MapConfig;
  villageProfile: VillageProfile;
}

function createInitialStore(): StoreData {
  const now = new Date().toISOString();
  return {
    adminAccount: null,
    assets: [
      {
        id: 'ast-001',
        nama: 'Gedung Balai Desa Adimulya (Contoh Data)',
        kategori: 'Bangunan',
        lokasi: 'Dusun I (Pusat Pemerintahan)',
        tahunPerolehan: 2018,
        jumlah: 1,
        satuan: 'Unit',
        kondisi: 'Baik',
        keterangan: 'Contoh data awal. Silakan sesuaikan atau tambahkan koordinat resmi pada menu Edit.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ast-002',
        nama: 'Tanah Kas Desa Blok Persawahan (Contoh Data)',
        kategori: 'Tanah Desa',
        lokasi: 'Dusun II',
        tahunPerolehan: 1995,
        jumlah: 2,
        satuan: 'Bidang',
        kondisi: 'Baik',
        keterangan: 'Lahan produktif desa seluas contoh; perbarui sesuai Buku Inventaris Aset Desa.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ast-003',
        nama: 'Saluran Irigasi Tersier Padi (Contoh Data)',
        kategori: 'Pertanian',
        lokasi: 'Dusun II',
        tahunPerolehan: 2020,
        jumlah: 450,
        satuan: 'Meter',
        kondisi: 'Perlu Perbaikan',
        keterangan: 'Sebagian dinding beton mengalami retakan ringan menjelang musim tanam.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ast-004',
        nama: 'Jembatan Penghubung Antar Dusun (Contoh Data)',
        kategori: 'Infrastruktur',
        lokasi: 'Perbatasan Dusun I & III',
        tahunPerolehan: 2012,
        jumlah: 1,
        satuan: 'Unit',
        kondisi: 'Rusak Berat',
        keterangan: 'Memerlukan rehabilitasi struktur abutment dan lantai jembatan.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ast-005',
        nama: 'Ambulans Siaga Desa (Contoh Data)',
        kategori: 'Kendaraan',
        lokasi: 'Garasi Balai Desa',
        tahunPerolehan: 2022,
        jumlah: 1,
        satuan: 'Unit',
        kondisi: 'Baik',
        keterangan: 'Siap operasional 24 jam untuk layanan rujukan kesehatan warga.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ast-006',
        nama: 'Perangkat Komputer & Server Administrasi (Contoh Data)',
        kategori: 'Peralatan',
        lokasi: 'Ruang Pelayanan Balai Desa',
        tahunPerolehan: 2023,
        jumlah: 4,
        satuan: 'Unit',
        kondisi: 'Baik',
        keterangan: 'Digunakan untuk pelayanan surat-menyurat dan administrasi kependudukan.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ast-007',
        nama: 'Posyandu Melati & Taman Baca (Contoh Data)',
        kategori: 'Fasilitas Umum',
        lokasi: 'Dusun III',
        tahunPerolehan: 2019,
        jumlah: 1,
        satuan: 'Unit',
        kondisi: 'Perlu Perbaikan',
        keterangan: 'Atap teras memerlukan penggantian genteng dan pengecatan ulang.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ast-008',
        nama: 'Jaringan Penerangan Jalan Umum Tenaga Surya (Contoh Data)',
        kategori: 'Jaringan',
        lokasi: 'Jalan Poros Desa Adimulya',
        tahunPerolehan: 2024,
        jumlah: 18,
        satuan: 'Titik',
        kondisi: 'Baik',
        keterangan: 'Sebanyak 18 titik lampu terpasang di sepanjang jalur utama desa.',
        koordinat: { lat: null, lng: null },
        createdAt: now,
        updatedAt: now,
      },
    ],
    proposals: [
      {
        id: 'mus-001',
        nomorPengajuan: 'MSRB-2026-0001',
        sumber: 'Admin',
        namaPengusul: 'Kadus I / Ketua RW 01 (Contoh)',
        dusun: 'Dusun I',
        rtRw: 'RT 02 / RW 01',
        judulUsulan: 'Pengaspalan Jalan Lingkungan Poros Dusun I',
        kategori: 'Infrastruktur',
        lokasi: 'Dusun I RT 02 / RW 01',
        tanggalPengajuan: '2026-01-14',
        prioritas: 'Tinggi',
        status: 'Disetujui',
        estimasiAnggaran: 'Rp 185.000.000',
        deskripsi: 'Peningkatan kualitas jalan akses utama warga dan distribusi hasil pertanian sepanjang 400 meter.',
        catatanVerifikasi: 'Masuk prioritas RKPDes tahun anggaran berjalan.',
        catatanUntukPengusul: 'Usulan disetujui dalam MusrenbangDes dan masuk daftar prioritas RKPDes.',
        fotoUrl: null,
        dipublikasikan: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mus-002',
        nomorPengajuan: 'MSRB-2026-0002',
        sumber: 'Admin',
        namaPengusul: 'Kader Posyandu (Contoh)',
        dusun: 'Dusun II',
        judulUsulan: 'Pengadaan Alat Antropometri & PMT Balita Terpadu',
        kategori: 'Kesehatan',
        lokasi: 'Posyandu Dusun II & III',
        tanggalPengajuan: '2026-01-19',
        prioritas: 'Tinggi',
        status: 'Dalam Pembahasan',
        estimasiAnggaran: 'Rp 42.500.000',
        deskripsi: 'Pencegahan stunting dan peningkatan kualitas pemeriksaan ibu hamil serta balita.',
        catatanVerifikasi: 'Menunggu sinkronisasi pagu anggaran bidang kesehatan.',
        catatanUntukPengusul: 'Sedang dalam pembahasan pagu anggaran bersama BPD.',
        fotoUrl: null,
        dipublikasikan: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mus-003',
        nomorPengajuan: 'MSRB-2026-0003',
        sumber: 'Admin',
        namaPengusul: 'Kelompok Tani Karya Makmur (Contoh)',
        dusun: 'Dusun II',
        judulUsulan: 'Rehabilitasi Saluran Irigasi Tersier Blok Timur',
        kategori: 'Pertanian',
        lokasi: 'Dusun II',
        tanggalPengajuan: '2026-02-02',
        prioritas: 'Tinggi',
        status: 'Menunggu Verifikasi',
        estimasiAnggaran: 'Rp 110.000.000',
        deskripsi: 'Perbaikan tanggul dan pintu air guna menjaga pasokan irigasi lahan sawah warga.',
        catatanVerifikasi: 'Tim teknis desa dijadwalkan melakukan survei lapangan.',
        catatanUntukPengusul: 'Menunggu jadwal peninjauan lokasi oleh tim teknis desa.',
        fotoUrl: null,
        dipublikasikan: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mus-004',
        nomorPengajuan: 'MSRB-2026-0004',
        sumber: 'Admin',
        namaPengusul: 'Karang Taruna Adimulya (Contoh)',
        dusun: 'Dusun I',
        judulUsulan: 'Pelatihan Kewirausahaan Digital & Kemasan UMKM',
        kategori: 'Ekonomi',
        lokasi: 'Aula Balai Desa Adimulya',
        tanggalPengajuan: '2026-02-08',
        prioritas: 'Sedang',
        status: 'Diajukan',
        estimasiAnggaran: 'Rp 28.000.000',
        deskripsi: 'Peningkatan kapasitas pelaku usaha mikro lokal dalam pemasaran daring dan legalitas NIB.',
        catatanVerifikasi: '',
        catatanUntukPengusul: '',
        fotoUrl: null,
        dipublikasikan: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mus-005',
        nomorPengajuan: 'MSRB-2025-0005',
        sumber: 'Admin',
        namaPengusul: 'Pengurus PAUD Harapan (Contoh)',
        dusun: 'Dusun III',
        judulUsulan: 'Renovasi Ruang Belajar PAUD & Pengadaan Buku Bacaan',
        kategori: 'Pendidikan',
        lokasi: 'Dusun III',
        tanggalPengajuan: '2025-11-20',
        prioritas: 'Sedang',
        status: 'Selesai',
        estimasiAnggaran: 'Rp 65.000.000',
        deskripsi: 'Pengecatan ruang kelas, perbaikan plafon, serta penambahan koleksi buku anak.',
        catatanVerifikasi: 'Telah direalisasikan dan diserahterimakan.',
        catatanUntukPengusul: 'Kegiatan telah selesai dilaksanakan dan dapat dimanfaatkan warga.',
        fotoUrl: null,
        dipublikasikan: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'mus-006',
        nomorPengajuan: 'MSRB-2026-0006',
        sumber: 'Admin',
        namaPengusul: 'Bank Sampah Berseri (Contoh)',
        dusun: 'Dusun II',
        judulUsulan: 'Pembangunan TPS3R Mini & Pengadaan Mesin Pencacah Kompos',
        kategori: 'Lingkungan',
        lokasi: 'Dusun II Area Terbuka',
        tanggalPengajuan: '2026-02-12',
        prioritas: 'Rendah',
        status: 'Diajukan',
        estimasiAnggaran: 'Rp 75.000.000',
        deskripsi: 'Pengelolaan sampah terpadu berbasis masyarakat untuk mengurangi timbunan sampah rumah tangga.',
        catatanVerifikasi: '',
        catatanUntukPengusul: '',
        fotoUrl: null,
        dipublikasikan: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    mapConfig: {
      balaiDesaLat: null,
      balaiDesaLng: null,
      defaultZoom: 14,
      batasUtara: '[Belum diisi — masukkan batas wilayah utara resmi]',
      batasSelatan: '[Belum diisi — masukkan batas wilayah selatan resmi]',
      batasTimur: '[Belum diisi — masukkan batas wilayah timur resmi]',
      batasBarat: '[Belum diisi — masukkan batas wilayah barat resmi]',
      boundaryCoordinates: [],
      dusunList: [
        {
          id: 'dsn-1',
          nama: 'Dusun I (Contoh — Edit Nama Resmi)',
          kepalaDusun: '[Nama Kepala Dusun I]',
          jumlahRW: 2,
          jumlahRT: 6,
          lat: null,
          lng: null,
          keterangan: 'Wilayah pusat pelayanan Balai Desa Adimulya. Silakan isi koordinat resmi.',
        },
        {
          id: 'dsn-2',
          nama: 'Dusun II (Contoh — Edit Nama Resmi)',
          kepalaDusun: '[Nama Kepala Dusun II]',
          jumlahRW: 2,
          jumlahRT: 5,
          lat: null,
          lng: null,
          keterangan: 'Kawasan permukiman dan lahan pertanian produktif. Silakan isi koordinat resmi.',
        },
        {
          id: 'dsn-3',
          nama: 'Dusun III (Contoh — Edit Nama Resmi)',
          kepalaDusun: '[Nama Kepala Dusun III]',
          jumlahRW: 2,
          jumlahRT: 5,
          lat: null,
          lng: null,
          keterangan: 'Kawasan fasilitas pendidikan dan sentra UMKM warga. Silakan isi koordinat resmi.',
        },
      ],
    },
    villageProfile: {
      tentang: {
        deskripsi:
          '[Contoh Konten — Silakan Ubah Sesuai Data Resmi Desa] Desa Adimulya merupakan desa yang berkomitmen mewujudkan tata kelola pemerintahan yang transparan, partisipatif, dan berbasis data terpadu melalui platform SIMPANDADU. Seluruh informasi pada halaman ini dapat disesuaikan oleh perangkat desa dengan data resmi profil desa.',
        alamatBalaiDesa: '[Masukkan Alamat Resmi Balai Desa Adimulya]',
        emailResmi: '[pemdes@adimulya.desa.id — sesuaikan]',
        telepon: '[Masukkan Nomor Telepon Resmi Balai Desa]',
        kodePos: '[Kode Pos]',
        kecamatan: '[Nama Kecamatan]',
        kabupaten: '[Nama Kabupaten]',
        provinsi: '[Nama Provinsi]',
      },
      sejarah: {
        ringkasan:
          '[Contoh Konten Sejarah Desa] Bagian ini disiapkan untuk mendokumentasikan sejarah berdirinya Desa Adimulya, asal-usul penamaan wilayah, serta tonggak penting pembangunan desa dari masa ke masa berdasarkan arsip resmi desa dan penuturan tokoh masyarakat.',
        linimasa: [
          {
            tahun: '[Tahun Berdiri]',
            peristiwa: 'Pembentukan awal wilayah permukiman dan pemerintahan Desa Adimulya (contoh entri — silakan perbarui).',
          },
          {
            tahun: '[Tahun Pembangunan Balai Desa]',
            peristiwa: 'Pembangunan pusat administrasi Balai Desa sebagai sentra pelayanan publik warga.',
          },
          {
            tahun: '2026',
            peristiwa: 'Penerapan SIMPANDADU untuk digitalisasi inventaris aset, pemetaan wilayah, dan Musrenbang desa.',
          },
        ],
      },
      visiMisi: {
        visi:
          '[Contoh Visi — Ganti dengan Visi RPJMDes Resmi] "Terwujudnya Desa Adimulya yang Mandiri, Sejahtera, Transparan, dan Berdaya Saing Berbasis Tata Kelola Pemerintahan Digital."',
        misi: [
          'Meningkatkan kualitas pelayanan administrasi pemerintahan desa yang cepat, akurat, dan transparan.',
          'Mengoptimalkan pengelolaan serta pemeliharaan aset desa dan infrastruktur dasar masyarakat.',
          'Mendorong partisipasi aktif warga dalam perencanaan pembangunan melalui Musrenbang desa.',
          'Mengembangkan potensi ekonomi lokal, sektor pertanian, serta pemberdayaan UMKM desa.',
        ],
      },
      geografisDemografi: {
        luasWilayah: '[Isi Luas Wilayah Resmi, mis. ... Ha / km²]',
        ketinggian: '[Isi Ketinggian mdpl]',
        topografi: '[Contoh: Dataran rendah / perbukitan — sesuaikan]',
        jumlahPenduduk: '[Isi Total Penduduk Resmi]',
        jumlahKK: '[Isi Jumlah Kepala Keluarga]',
        lakiLaki: '[Isi Jumlah Laki-laki]',
        perempuan: '[Isi Jumlah Perempuan]',
        catatanSumber: 'Contoh struktur data demografi. Silakan perbarui dari Buku Induk Penduduk / Profil Desa resmi.',
      },
      potensi: [
        {
          id: 'pot-1',
          bidang: 'Pertanian & Ketahanan Pangan',
          judul: 'Lahan Pertanian Produktif (Contoh)',
          deskripsi:
            'Sebagian besar wilayah desa memiliki potensi lahan pertanian pangan dan hortikultura yang didukung jaringan irigasi desa.',
        },
        {
          id: 'pot-2',
          bidang: 'Ekonomi & UMKM',
          judul: 'Sentra Usaha Mikro & Produk Olahan Desa (Contoh)',
          deskripsi:
            'Pelaku usaha rumah tangga dan BUMDes memiliki peluang pengembangan produk olahan lokal bernilai tambah.',
        },
        {
          id: 'pot-3',
          bidang: 'Sosial & Budaya',
          judul: 'Gotong Royong & Kelembagaan Masyarakat (Contoh)',
          deskripsi:
            'Aktivitas PKK, Karang Taruna, Kelompok Tani, serta lembaga adat menjadi modal sosial utama pembangunan desa.',
        },
      ],
      strukturOrganisasi: [
        {
          id: 'str-1',
          jabatan: 'Kepala Desa',
          nama: '[Nama Kepala Desa Adimulya]',
          nipAtauKeterangan: 'Pimpinan Pemerintahan Desa (Contoh — Edit)',
          urutan: 1,
        },
        {
          id: 'str-2',
          jabatan: 'Sekretaris Desa',
          nama: '[Nama Sekretaris Desa]',
          nipAtauKeterangan: 'Koordinator Pelaksana Teknis Pengelolaan Keuangan & Administrasi',
          urutan: 2,
        },
        {
          id: 'str-3',
          jabatan: 'Kaur Tata Usaha & Umum',
          nama: '[Nama Kaur TU & Umum]',
          nipAtauKeterangan: 'Pengelolaan Arsip, Surat-Menyurat & Inventaris Aset Desa',
          urutan: 3,
        },
        {
          id: 'str-4',
          jabatan: 'Kaur Perencanaan',
          nama: '[Nama Kaur Perencanaan]',
          nipAtauKeterangan: 'Koordinator RPJMDes, RKPDes & Musrenbang',
          urutan: 4,
        },
        {
          id: 'str-5',
          jabatan: 'Kaur Keuangan',
          nama: '[Nama Kaur Keuangan]',
          nipAtauKeterangan: 'Pelaksana Fungsi Kebendaharaan Desa',
          urutan: 5,
        },
        {
          id: 'str-6',
          jabatan: 'Kasi Pemerintahan',
          nama: '[Nama Kasi Pemerintahan]',
          nipAtauKeterangan: 'Administrasi Kependudukan, Pertanahan & Batas Wilayah',
          urutan: 6,
        },
      ],
    },
  };
}

function loadStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    const initial = createInitialStore();
    saveStore(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StoreData;
    parsed.proposals = (parsed.proposals || []).map((p, idx) => ({
      ...p,
      nomorPengajuan:
        p.nomorPengajuan ||
        `MSRB-2026-${String(idx + 1).padStart(4, '0')}`,
      sumber: p.sumber === 'Warga' ? 'Warga' : 'Admin',
      dipublikasikan:
        typeof p.dipublikasikan === 'boolean'
          ? p.dipublikasikan
          : p.status === 'Disetujui' || p.status === 'Selesai',
      catatanUntukPengusul: p.catatanUntukPengusul ?? '',
      fotoUrl: p.fotoUrl ?? null,
    }));
    return parsed;
  } catch {
    const fallback = createInitialStore();
    saveStore(fallback);
    return fallback;
  }
}

function saveStore(data: StoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_FILE);
}

let store: StoreData = loadStore();

const VALID_PROPOSAL_CATEGORIES: ProposalCategory[] = [
  'Infrastruktur',
  'Pendidikan',
  'Kesehatan',
  'Ekonomi',
  'Pertanian',
  'Sarana dan Prasarana',
  'Lingkungan',
];

function generateNomorPengajuan(proposals: MusrenbangProposal[]): string {
  const year = new Date().getFullYear();
  const existing = new Set(proposals.map((p) => p.nomorPengajuan));
  let seq = proposals.length + 1;
  while (existing.has(`MSRB-${year}-${String(seq).padStart(4, '0')}`)) {
    seq += 1;
  }
  return `MSRB-${year}-${String(seq).padStart(4, '0')}`;
}

function saveProposalPhoto(
  proposalId: string,
  dataUrl: string,
): { fileName: string } | { error: string } {
  const match = dataUrl.match(
    /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) {
    return {
      error: 'Format foto tidak didukung. Gunakan gambar JPG, PNG, atau WebP.',
    };
  }
  const extRaw = match[1].toLowerCase();
  const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
    return { error: 'Ukuran foto maksimal 2 MB.' };
  }

  // Verify magic bytes so non-image payloads cannot masquerade as images
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47;
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';

  if (
    (ext === 'jpg' && !isJpeg) ||
    (ext === 'png' && !isPng) ||
    (ext === 'webp' && !isWebp)
  ) {
    return { error: 'File foto tidak valid atau rusak.' };
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const fileName = `${proposalId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const targetPath = path.resolve(UPLOADS_DIR, fileName);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    return { error: 'Path penyimpanan tidak valid.' };
  }
  fs.writeFileSync(targetPath, buf);
  return { fileName };
}

function deleteProposalPhotoFile(fotoFileName: string | null | undefined): void {
  if (!fotoFileName) return;
  const safeName = path.basename(fotoFileName);
  const resolved = path.resolve(UPLOADS_DIR, safeName);
  if (resolved.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
  }
}

function toPublicStatusDTO(p: MusrenbangProposal): PublicProposalStatusItem {
  return {
    nomorPengajuan: p.nomorPengajuan,
    judulUsulan: p.judulUsulan,
    kategori: p.kategori,
    dusun: p.dusun || '-',
    lokasi: p.lokasi,
    tanggalPengajuan: p.tanggalPengajuan,
    prioritas: p.prioritas,
    status: p.status,
    deskripsi: p.deskripsi,
    catatanUntukPengusul: p.catatanUntukPengusul || '',
    dipublikasikan: Boolean(p.dipublikasikan),
    updatedAt: p.updatedAt,
  };
}

function toPublicApprovedDTO(p: MusrenbangProposal): PublicApprovedProposal {
  return {
    id: p.id,
    nomorPengajuan: p.nomorPengajuan,
    judulUsulan: p.judulUsulan,
    kategori: p.kategori,
    dusun: p.dusun || '-',
    lokasi: p.lokasi,
    tanggalPengajuan: p.tanggalPengajuan,
    prioritas: p.prioritas,
    status: p.status,
    estimasiAnggaran: p.estimasiAnggaran,
    deskripsi: p.deskripsi,
    catatanUntukPengusul: p.catatanUntukPengusul || '',
  };
}

// Password hashing with scrypt
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derived);
}

function hasEnvAdmin(): boolean {
  return Boolean(
    process.env.SIMPANDADU_ADMIN_PASSWORD &&
      process.env.SIMPANDADU_ADMIN_PASSWORD.trim().length > 0,
  );
}

interface SessionPayload {
  username: string;
  fullName: string;
  role: string;
  exp: number;
}

function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (!parsed.username || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      result[k] = decodeURIComponent(v);
    }
  }
  return result;
}

function appendCookieHeader(res: Response, cookieStr: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieStr);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=86400',
  ];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  appendCookieHeader(res, attrs.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
  ];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  appendCookieHeader(res, attrs.join('; '));
}

function setTrustedDeviceCookie(req: Request, res: Response, rawToken: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const attrs = [
    `${DEVICE_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=2592000',
  ];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  appendCookieHeader(res, attrs.join('; '));
}

function clearTrustedDeviceCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const attrs = [
    `${DEVICE_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
  ];
  if (isHttps) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  appendCookieHeader(res, attrs.join('; '));
}

function getPublicAppBaseUrl(req: Request): string {
  const envUrl = (process.env.APP_URL || '').trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      // fall through
    }
  }
  const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').trim();
  const safeHost = /^[a-zA-Z0-9.:-]+$/.test(rawHost) ? rawHost : 'localhost:3000';
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  return `${isHttps ? 'https' : 'http'}://${safeHost}`;
}

function saveAdminAvatar(
  username: string,
  dataUrl: string,
): { fileName: string } | { error: string } {
  const match = dataUrl.match(
    /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) {
    return {
      error: 'Format foto profil tidak didukung. Gunakan JPG, PNG, atau WebP.',
    };
  }
  const extRaw = match[1].toLowerCase();
  const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length === 0 || buf.length > 2 * 1024 * 1024) {
    return { error: 'Ukuran foto profil maksimal 2 MB.' };
  }
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng =
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  if (
    (ext === 'jpg' && !isJpeg) ||
    (ext === 'png' && !isPng) ||
    (ext === 'webp' && !isWebp)
  ) {
    return { error: 'File foto tidak valid atau rusak.' };
  }
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }
  const safeUser = username.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `avatar-${safeUser}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const resolved = path.resolve(AVATARS_DIR, fileName);
  if (!resolved.startsWith(AVATARS_DIR + path.sep)) {
    return { error: 'Path penyimpanan avatar tidak valid.' };
  }
  fs.writeFileSync(resolved, buf);
  return { fileName };
}

function deleteAdminAvatarFile(fileName: string | null | undefined): void {
  if (!fileName) return;
  const safeName = path.basename(fileName);
  const resolved = path.resolve(AVATARS_DIR, safeName);
  if (resolved.startsWith(AVATARS_DIR + path.sep) && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
  }
}

function toAdminUserDTO(account: DbAdminAccount): AdminUser {
  return {
    username: account.username,
    fullName: account.full_name,
    role: account.role,
    email: account.email,
    emailVerified: account.email_verified === 1,
    phone: account.phone,
    jabatan: account.jabatan,
    hasAvatar: Boolean(account.avatar_file),
    avatarUpdatedAt: account.updated_at,
  };
}

function toAdminAccountProfileDTO(account: DbAdminAccount): AdminAccountProfile {
  return {
    ...toAdminUserDTO(account),
    pendingEmail: account.pending_email,
    requireEmailLoginApproval: account.require_email_login_approval === 1,
    notifyOnLoginSuccess: account.notify_on_login_success === 1,
    notifyOnSecurityChange: account.notify_on_security_change === 1,
    loginApprovalTtlMinutes: account.login_approval_ttl_minutes,
    approvalPolicy: account.approval_policy === 'every_login' ? 'every_login' : 'new_device',
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

function syncSecurityDatabaseWithLegacyStore(): void {
  const db = getSecurityDb();
  const existing = getAdminAccount();
  const envEmail = (process.env.SIMPANDADU_ADMIN_EMAIL || '').trim();

  if (!existing && store.adminAccount) {
    const now = store.adminAccount.createdAt || new Date().toISOString();
    db.prepare(
      `INSERT INTO admin_accounts (
        id, username, password_hash, full_name, email, email_verified, pending_email,
        phone, jabatan, role, avatar_file, require_email_login_approval,
        notify_on_login_success, notify_on_security_change, login_approval_ttl_minutes,
        approval_policy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, '', ?, ?, NULL, 1, 1, 1, 10, 'new_device', ?, ?)`,
    ).run(
      'admin-primary',
      store.adminAccount.username,
      store.adminAccount.passwordHash,
      store.adminAccount.fullName,
      envEmail,
      envEmail ? 1 : 0,
      store.adminAccount.role || 'Administrator Balai Desa',
      store.adminAccount.role || 'Administrator Balai Desa',
      now,
      now,
    );
  } else if (!existing && hasEnvAdmin()) {
    const expectedUser = (process.env.SIMPANDADU_ADMIN_USERNAME || 'admin').trim();
    const expectedPass = process.env.SIMPANDADU_ADMIN_PASSWORD || '';
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO admin_accounts (
        id, username, password_hash, full_name, email, email_verified, pending_email,
        phone, jabatan, role, avatar_file, require_email_login_approval,
        notify_on_login_success, notify_on_security_change, login_approval_ttl_minutes,
        approval_policy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, '', 'Administrator Balai Desa', 'Administrator Balai Desa', NULL, 1, 1, 1, 10, 'new_device', ?, ?)`,
    ).run(
      'admin-primary',
      expectedUser,
      hashPassword(expectedPass),
      'Administrator Desa Adimulya',
      envEmail,
      envEmail ? 1 : 0,
      now,
      now,
    );
  } else if (existing && !existing.email && envEmail) {
    db.prepare(
      `UPDATE admin_accounts SET email = ?, email_verified = 1, updated_at = ? WHERE id = ?`,
    ).run(envEmail, new Date().toISOString(), existing.id);
  }
}

function findActiveTrustedDevice(req: Request, username: string): DbTrustedDevice | null {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[DEVICE_COOKIE_NAME];
  if (!rawToken) return null;
  const db = getSecurityDb();
  const row = db
    .prepare(
      `SELECT * FROM trusted_devices WHERE username = ? AND token_hash = ? AND revoked_at IS NULL LIMIT 1`,
    )
    .get(username, sha256Hex(rawToken)) as DbTrustedDevice | undefined;
  return row || null;
}

interface AuthenticatedRequest extends Request {
  adminUser?: SessionPayload;
}

function extractSession(req: Request): SessionPayload | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifySessionToken(token);
    if (verified) return verified;
  }
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return verifySessionToken(cookieToken);
  }
  return null;
}

function requireCsrfCheck(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const customHeader = req.headers['x-requested-with'];
  if (customHeader === 'SIMPANDADU-Web') {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        next();
        return;
      }
    } catch {
      // fall through to reject
    }
  }
  res.status(403).json({ error: 'Permintaan ditolak oleh validasi keamanan CSRF.' });
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const session = extractSession(req);
  if (!session) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' });
    return;
  }
  req.adminUser = session;
  next();
}

// ---------- RSS News Aggregation ----------
const rssParser = new Parser({
  timeout: 6000,
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

interface FeedSourceConfig {
  source: string;
  url: string;
  defaultCategory: Exclude<NewsCategory, 'Semua Berita'>;
}

const INDONESIAN_RSS_FEEDS: FeedSourceConfig[] = [
  {
    source: 'ANTARA News',
    url: 'https://www.antaranews.com/rss/terkini.xml',
    defaultCategory: 'Nasional',
  },
  {
    source: 'ANTARA News',
    url: 'https://www.antaranews.com/rss/ekonomi.xml',
    defaultCategory: 'Ekonomi',
  },
  {
    source: 'ANTARA News',
    url: 'https://www.antaranews.com/rss/politik.xml',
    defaultCategory: 'Politik',
  },
  {
    source: 'ANTARA News',
    url: 'https://www.antaranews.com/rss/tekno.xml',
    defaultCategory: 'Teknologi',
  },
  {
    source: 'ANTARA News',
    url: 'https://www.antaranews.com/rss/olahraga.xml',
    defaultCategory: 'Olahraga',
  },
  {
    source: 'CNN Indonesia',
    url: 'https://www.cnnindonesia.com/nasional/rss',
    defaultCategory: 'Nasional',
  },
  {
    source: 'CNN Indonesia',
    url: 'https://www.cnnindonesia.com/ekonomi/rss',
    defaultCategory: 'Ekonomi',
  },
  {
    source: 'CNN Indonesia',
    url: 'https://www.cnnindonesia.com/teknologi/rss',
    defaultCategory: 'Teknologi',
  },
  {
    source: 'CNN Indonesia',
    url: 'https://www.cnnindonesia.com/olahraga/rss',
    defaultCategory: 'Olahraga',
  },
  {
    source: 'CNBC Indonesia',
    url: 'https://www.cnbcindonesia.com/news/rss',
    defaultCategory: 'Ekonomi',
  },
  {
    source: 'Tempo',
    url: 'https://rss.tempo.co/nasional',
    defaultCategory: 'Nasional',
  },
  {
    source: 'Detik',
    url: 'https://news.detik.com/berita/rss',
    defaultCategory: 'Daerah',
  },
];

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSafeHttpUrl(urlStr: string | undefined | null): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function extractImageFromItem(item: Record<string, unknown>): string | null {
  const enclosure = item.enclosure as { url?: string } | undefined;
  if (enclosure?.url) {
    const safe = isSafeHttpUrl(enclosure.url);
    if (safe) return safe;
  }
  const mediaContent = item.mediaContent as
    | { $?: { url?: string } }
    | Array<{ $?: { url?: string } }>
    | undefined;
  if (Array.isArray(mediaContent) && mediaContent[0]?.$?.url) {
    const safe = isSafeHttpUrl(mediaContent[0].$.url);
    if (safe) return safe;
  } else if (!Array.isArray(mediaContent) && mediaContent?.$?.url) {
    const safe = isSafeHttpUrl(mediaContent.$.url);
    if (safe) return safe;
  }
  const mediaThumb = item.mediaThumbnail as { $?: { url?: string } } | undefined;
  if (mediaThumb?.$?.url) {
    const safe = isSafeHttpUrl(mediaThumb.$.url);
    if (safe) return safe;
  }
  const htmlSource = String(
    item.contentEncoded || item.content || item.description || '',
  );
  const imgMatch = htmlSource.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    const safe = isSafeHttpUrl(imgMatch[1]);
    if (safe) return safe;
  }
  return null;
}

function inferCategory(
  title: string,
  summary: string,
  fallback: Exclude<NewsCategory, 'Semua Berita'>,
): Exclude<NewsCategory, 'Semua Berita'> {
  const text = `${title} ${summary}`.toLowerCase();
  if (/(iklim|hutan|sampah|banjir|lingkungan|emisi|sungai|reboisasi)/.test(text)) {
    return 'Lingkungan';
  }
  if (/(kesehatan|kemenkes|puskesmas|rumah sakit|stunting|bpjs|vaksin|gizi)/.test(text)) {
    return 'Kesehatan';
  }
  if (/(pendidikan|sekolah|kurikulum|mahasiswa|guru|kampus|kemendikbud|beasiswa)/.test(text)) {
    return 'Pendidikan';
  }
  if (/(pemilu|dpr|partai|koalisi|menteri|pilkada|legislatif|politik)/.test(text)) {
    return 'Politik';
  }
  if (/(sepak bola|timnas|liga|olimpiade|badminton|bulu tangkis|motogp|atlet)/.test(text)) {
    return 'Olahraga';
  }
  if (/(teknologi|ai |kecerdasan buatan|digital|siber|aplikasi|startup|satelit|internet)/.test(text)) {
    return 'Teknologi';
  }
  if (/(ekonomi|inflasi|ihsg|rupiah|umkm|apbn|dana desa|pajak|investasi|ekspor)/.test(text)) {
    return 'Ekonomi';
  }
  if (/(pemda|gubernur|bupati|desa|kecamatan|kabupaten|daerah|provinsi)/.test(text)) {
    return 'Daerah';
  }
  return fallback;
}

function buildDemoFallbackNews(): NewsArticle[] {
  const now = Date.now();
  return [
    {
      id: 'demo-antara-1',
      title: '[DEMO] Penguatan Tata Kelola Desa Digital & Transparansi Data Nasional',
      summary:
        'Catatan DEMO: Layanan RSS eksternal saat ini belum dapat dijangkau dari lingkungan server. Konten ini adalah contoh struktur integrasi berita untuk menguji tampilan portal.',
      content:
        'Ini adalah artikel contoh (DEMO) karena koneksi keluar ke server RSS media nasional belum tersedia saat ini. Klik tombol Perbarui Berita ketika koneksi internet aktif untuk memuat berita terbaru secara otomatis dari ANTARA News, CNN Indonesia, CNBC Indonesia, Tempo, dan Detik.',
      publishedAt: new Date(now - 1000 * 60 * 15).toISOString(),
      source: 'ANTARA News (DEMO)',
      sourceUrl: 'https://www.antaranews.com',
      category: 'Nasional',
      imageUrl: null,
      isDemo: true,
    },
    {
      id: 'demo-kompas-2',
      title: '[DEMO] Prioritas Dana Desa untuk Ketahanan Pangan dan Infrastruktur Daerah',
      summary:
        'Catatan DEMO: Contoh berita kategori Ekonomi & Daerah dengan tautan langsung ke situs resmi Kompas.',
      content:
        'Artikel contoh (DEMO) yang menampilkan bagaimana ringkasan berita daerah dan ekonomi disajikan pada portal SIMPANDADU. Silakan buka tautan sumber resmi untuk membaca berita aktual.',
      publishedAt: new Date(now - 1000 * 60 * 45).toISOString(),
      source: 'Kompas (DEMO)',
      sourceUrl: 'https://www.kompas.com',
      category: 'Ekonomi',
      imageUrl: null,
      isDemo: true,
    },
    {
      id: 'demo-cnn-3',
      title: '[DEMO] Transformasi Layanan Publik Berbasis Peta Geospasial di Daerah',
      summary:
        'Catatan DEMO: Contoh berita kategori Teknologi yang menyoroti pemanfaatan sistem informasi terpadu di tingkat pemerintahan.',
      content:
        'Artikel contoh (DEMO) sebagai placeholder terstruktur ketika umpan RSS eksternal tidak dapat diakses. Tidak mengklaim sebagai berita terkini.',
      publishedAt: new Date(now - 1000 * 60 * 90).toISOString(),
      source: 'CNN Indonesia (DEMO)',
      sourceUrl: 'https://www.cnnindonesia.com',
      category: 'Teknologi',
      imageUrl: null,
      isDemo: true,
    },
    {
      id: 'demo-tempo-4',
      title: '[DEMO] Kolaborasi Posyandu dan Pemerintah Daerah dalam Layanan Kesehatan Warga',
      summary:
        'Catatan DEMO: Contoh berita kategori Kesehatan pada struktur portal berita SIMPANDADU.',
      content:
        'Artikel contoh (DEMO). Gunakan tombol Perbarui Berita untuk mencoba kembali pengambilan RSS feed langsung dari media terpercaya Indonesia.',
      publishedAt: new Date(now - 1000 * 60 * 140).toISOString(),
      source: 'Tempo (DEMO)',
      sourceUrl: 'https://www.tempo.co',
      category: 'Kesehatan',
      imageUrl: null,
      isDemo: true,
    },
    {
      id: 'demo-detik-5',
      title: '[DEMO] Program Penghijauan dan Pengelolaan Sampah Berkelanjutan di Pedesaan',
      summary:
        'Catatan DEMO: Contoh berita kategori Lingkungan dengan struktur filter kategori dan pencarian berita.',
      content:
        'Artikel contoh (DEMO) untuk memastikan seluruh filter kategori, pencarian, dan halaman detail berita dapat diuji meskipun offline.',
      publishedAt: new Date(now - 1000 * 60 * 200).toISOString(),
      source: 'Detik (DEMO)',
      sourceUrl: 'https://news.detik.com',
      category: 'Lingkungan',
      imageUrl: null,
      isDemo: true,
    },
  ];
}

let newsCache: { data: NewsResponse; fetchedAt: number } | null = null;
const NEWS_CACHE_TTL_MS = 1000 * 60 * 10;

async function fetchIndonesianNews(forceRefresh = false): Promise<NewsResponse> {
  if (
    !forceRefresh &&
    newsCache &&
    Date.now() - newsCache.fetchedAt < NEWS_CACHE_TTL_MS
  ) {
    return newsCache.data;
  }

  const results = await Promise.allSettled(
    INDONESIAN_RSS_FEEDS.map(async (feedCfg) => {
      const feed = await rssParser.parseURL(feedCfg.url);
      const articles: NewsArticle[] = [];
      for (const rawItem of (feed.items || []).slice(0, 8)) {
        const item = rawItem as unknown as Record<string, unknown>;
        const title = stripHtmlTags(String(item.title || ''));
        const safeLink = isSafeHttpUrl(String(item.link || ''));
        if (!title || !safeLink) continue;

        const rawDesc = String(
          item.contentSnippet || item.summary || item.content || item.description || '',
        );
        const cleanSummary = stripHtmlTags(rawDesc).slice(0, 260);
        const cleanContent = stripHtmlTags(
          String(item.contentEncoded || item.content || item.description || rawDesc),
        );
        const pubDateRaw = String(item.isoDate || item.pubDate || '');
        const parsedDate = pubDateRaw ? new Date(pubDateRaw) : new Date();
        const publishedAt = Number.isNaN(parsedDate.getTime())
          ? new Date().toISOString()
          : parsedDate.toISOString();

        const idHash = crypto
          .createHash('sha1')
          .update(`${feedCfg.source}:${safeLink}`)
          .digest('hex')
          .slice(0, 12);

        articles.push({
          id: `rss-${idHash}`,
          title,
          summary: cleanSummary || title,
          content: cleanContent || cleanSummary || title,
          publishedAt,
          source: feedCfg.source,
          sourceUrl: safeLink,
          category: inferCategory(title, cleanSummary, feedCfg.defaultCategory),
          imageUrl: extractImageFromItem(item),
          isDemo: false,
        });
      }
      return { source: feedCfg.source, articles };
    }),
  );

  const collected: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  const activeSources = new Set<string>();

  for (const res of results) {
    if (res.status === 'fulfilled') {
      if (res.value.articles.length > 0) {
        activeSources.add(res.value.source);
      }
      for (const art of res.value.articles) {
        if (!seenUrls.has(art.sourceUrl)) {
          seenUrls.add(art.sourceUrl);
          collected.push(art);
        }
      }
    }
  }

  collected.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const isDemoFallback = collected.length === 0;
  const responsePayload: NewsResponse = {
    articles: isDemoFallback ? buildDemoFallbackNews() : collected.slice(0, 60),
    isDemoFallback,
    lastUpdated: new Date().toISOString(),
    sourcesChecked: isDemoFallback
      ? ['ANTARA News', 'Kompas', 'CNN Indonesia', 'Tempo', 'Detik']
      : Array.from(activeSources),
  };

  newsCache = {
    data: responsePayload,
    fetchedAt: Date.now(),
  };

  return responsePayload;
}

// ---------- Express App Setup ----------
async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  app.use('/api', requireCsrfCheck);

  // ---------- Public Citizen Musrenbang Endpoints (No PII Exposed) ----------
  app.get('/api/public/dusun', (_req: Request, res: Response) => {
    res.json({
      dusunList: store.mapConfig.dusunList.map((d) => ({
        id: d.id,
        nama: d.nama,
      })),
    });
  });

  app.post('/api/public/proposals', (req: Request, res: Response) => {
    const body = req.body as {
      namaPengusul?: string;
      nomorHp?: string;
      dusun?: string;
      rtRw?: string;
      kategori?: ProposalCategory;
      judulUsulan?: string;
      lokasi?: string;
      deskripsi?: string;
      fotoDataUrl?: string | null;
    };

    const namaPengusul = String(body.namaPengusul || '').trim();
    const nomorHpRaw = String(body.nomorHp || '').trim();
    const nomorHpClean = nomorHpRaw.replace(/[\s-]/g, '');
    const dusun = String(body.dusun || '').trim();
    const rtRw = String(body.rtRw || '').trim();
    const kategori = body.kategori as ProposalCategory;
    const judulUsulan = String(body.judulUsulan || '').trim();
    const lokasi = String(body.lokasi || '').trim();
    const deskripsi = String(body.deskripsi || '').trim();

    if (namaPengusul.length < 2) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (!/^(\+62|62|0)8[0-9]{7,13}$/.test(nomorHpClean)) {
      res.status(400).json({
        error: 'Nomor HP tidak valid. Gunakan format nomor Indonesia (contoh: 081234567890).',
      });
      return;
    }
    if (!dusun || !rtRw) {
      res.status(400).json({ error: 'Dusun dan RT/RW wajib diisi.' });
      return;
    }
    if (!VALID_PROPOSAL_CATEGORIES.includes(kategori)) {
      res.status(400).json({ error: 'Kategori usulan tidak valid.' });
      return;
    }
    if (judulUsulan.length < 5) {
      res.status(400).json({ error: 'Judul usulan minimal 5 karakter.' });
      return;
    }
    if (!lokasi) {
      res.status(400).json({ error: 'Lokasi kegiatan wajib diisi.' });
      return;
    }
    if (deskripsi.length < 10) {
      res.status(400).json({
        error: 'Alasan dan penjelasan usulan minimal 10 karakter.',
      });
      return;
    }

    const proposalId = `mus-${crypto.randomUUID().slice(0, 8)}`;
    let storedFotoName: string | null = null;
    if (body.fotoDataUrl && typeof body.fotoDataUrl === 'string') {
      const saved = saveProposalPhoto(proposalId, body.fotoDataUrl);
      if ('error' in saved) {
        res.status(400).json({ error: saved.error });
        return;
      }
      storedFotoName = saved.fileName;
    }

    const now = new Date().toISOString();
    const nomorPengajuan = generateNomorPengajuan(store.proposals);
    const newProposal: MusrenbangProposal = {
      id: proposalId,
      nomorPengajuan,
      sumber: 'Warga',
      namaPengusul,
      nomorHp: nomorHpClean,
      dusun,
      rtRw,
      judulUsulan,
      kategori,
      lokasi,
      tanggalPengajuan: now.slice(0, 10),
      prioritas: 'Sedang',
      status: 'Menunggu Verifikasi',
      estimasiAnggaran: 'Menunggu kajian teknis',
      deskripsi,
      catatanVerifikasi: '',
      catatanUntukPengusul:
        'Usulan telah diterima sistem dan menunggu verifikasi perangkat Desa Adimulya.',
      fotoUrl: storedFotoName,
      dipublikasikan: false,
      createdAt: now,
      updatedAt: now,
    };

    store.proposals.unshift(newProposal);
    saveStore(store);

    res.status(201).json({
      nomorPengajuan,
      proposal: toPublicStatusDTO(newProposal),
    });
  });

  app.get('/api/public/proposals/status/:nomor', (req: Request, res: Response) => {
    const nomor = String(req.params.nomor || '').trim().toUpperCase();
    if (!nomor) {
      res.status(400).json({ error: 'Nomor pengajuan wajib diisi.' });
      return;
    }
    const found = store.proposals.find(
      (p) => p.nomorPengajuan.toUpperCase() === nomor,
    );
    if (!found) {
      res.status(404).json({
        error: `Nomor pengajuan "${nomor}" tidak ditemukan. Periksa kembali nomor bukti pengajuan Anda.`,
      });
      return;
    }
    res.json({ proposal: toPublicStatusDTO(found) });
  });

  app.get('/api/public/proposals/approved', (_req: Request, res: Response) => {
    const approved = store.proposals
      .filter(
        (p) =>
          p.dipublikasikan &&
          (p.status === 'Disetujui' || p.status === 'Selesai'),
      )
      .map(toPublicApprovedDTO);
    res.json({ proposals: approved });
  });

  // Sync SQLite security tables on startup
  syncSecurityDatabaseWithLegacyStore();

  // Auth status
  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const envManaged = hasEnvAdmin();
    const dbAccount = getAdminAccount();
    const initialized = envManaged || dbAccount !== null || store.adminAccount !== null;
    res.json({
      initialized,
      envManaged,
      smtpConfigured: isSmtpConfigured(),
    });
  });

  // First-run admin claim route (only active when no env password and no claimed account)
  app.post('/api/auth/setup', async (req: Request, res: Response) => {
    const existingDb = getAdminAccount();
    if (hasEnvAdmin() || existingDb !== null || store.adminAccount !== null) {
      res.status(403).json({
        error: 'Akun admin sudah diaktifkan. Silakan masuk menggunakan username dan password.',
      });
      return;
    }

    const { username, password, fullName, email, phone, jabatan } = req.body as {
      username?: string;
      password?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      jabatan?: string;
    };

    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');
    const cleanFullName = String(fullName || 'Administrator Desa Adimulya').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim().replace(/[\s-]/g, '');
    const cleanJabatan = String(jabatan || 'Administrator Balai Desa').trim();

    if (cleanUsername.length < 4 || !/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
      res.status(400).json({
        error: 'Username minimal 4 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau hubung.',
      });
      return;
    }
    if (cleanPassword.length < 6) {
      res.status(400).json({
        error: 'Password minimal 6 karakter demi keamanan akun perangkat desa.',
      });
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({
        error: 'Email aktif admin wajib diisi dengan format yang benar untuk keamanan login.',
      });
      return;
    }

    const now = new Date().toISOString();
    const pwHash = hashPassword(cleanPassword);
    const db = getSecurityDb();
    db.prepare(
      `INSERT INTO admin_accounts (
        id, username, password_hash, full_name, email, email_verified, pending_email,
        phone, jabatan, role, avatar_file, require_email_login_approval,
        notify_on_login_success, notify_on_security_change, login_approval_ttl_minutes,
        approval_policy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, NULL, ?, ?, 'Administrator Balai Desa', NULL, 1, 1, 1, 10, 'new_device', ?, ?)`,
    ).run(
      'admin-primary',
      cleanUsername,
      pwHash,
      cleanFullName || 'Administrator Desa Adimulya',
      cleanEmail,
      cleanPhone,
      cleanJabatan || 'Administrator Balai Desa',
      now,
      now,
    );

    store.adminAccount = {
      username: cleanUsername,
      passwordHash: pwHash,
      fullName: cleanFullName || 'Administrator Desa Adimulya',
      role: cleanJabatan || 'Administrator Balai Desa',
      createdAt: now,
    };
    saveStore(store);

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);
    const rawDeviceToken = crypto.randomBytes(32).toString('hex');
    db.prepare(
      `INSERT INTO trusted_devices (
        id, username, token_hash, device_label, ip_address, location_estimate, last_used_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `dev-${crypto.randomUUID().slice(0, 8)}`,
      cleanUsername,
      sha256Hex(rawDeviceToken),
      ctx.deviceLabel,
      ctx.ipAddress,
      locationEstimate,
      now,
      now,
    );

    recordActivityLog({
      username: cleanUsername,
      eventType: 'Aktivasi Akun Admin',
      description: `Akun admin diaktifkan dengan email ${cleanEmail}.`,
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: cleanUsername,
      type: 'security_alert',
      title: 'Akun Admin SIMPANDADU Diaktifkan',
      message: `Verifikasi login melalui email aktif telah diaktifkan untuk ${cleanEmail}.`,
      severity: 'success',
    });

    const createdAccount = getAdminAccount()!;
    const sessionPayload: SessionPayload = {
      username: createdAccount.username,
      fullName: createdAccount.full_name,
      role: createdAccount.role,
      exp: Date.now() + 1000 * 60 * 60 * 24,
    };
    const token = signSessionToken(sessionPayload);
    setSessionCookie(req, res, token);
    setTrustedDeviceCookie(req, res, rawDeviceToken);

    res.status(201).json({
      token,
      user: toAdminUserDTO(createdAccount),
    });
  });

  // Login (supports email confirmation on new device/session)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanUsername || !cleanPassword) {
      res.status(400).json({ error: 'Username dan password wajib diisi.' });
      return;
    }

    const dbAccount = getAdminAccount();
    if (!hasEnvAdmin() && !dbAccount) {
      res.status(400).json({
        error: 'Akun admin belum diaktifkan. Silakan lakukan aktivasi admin pertama.',
      });
      return;
    }

    let valid = false;
    if (hasEnvAdmin()) {
      const expectedUser = (process.env.SIMPANDADU_ADMIN_USERNAME || 'admin').trim();
      const expectedPass = process.env.SIMPANDADU_ADMIN_PASSWORD || '';
      const userMatch = cleanUsername === expectedUser;
      const passBufA = Buffer.from(cleanPassword);
      const passBufB = Buffer.from(expectedPass);
      const passMatch =
        passBufA.length === passBufB.length &&
        crypto.timingSafeEqual(passBufA, passBufB);
      valid = userMatch && passMatch;
    } else if (dbAccount) {
      valid =
        cleanUsername === dbAccount.username &&
        verifyPassword(cleanPassword, dbAccount.password_hash);
    }

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    if (!valid) {
      if (dbAccount && cleanUsername === dbAccount.username) {
        recordActivityLog({
          username: dbAccount.username,
          eventType: 'Percobaan Login Gagal',
          description: 'Kata sandi yang dimasukkan tidak cocok.',
          deviceLabel: ctx.deviceLabel,
          ipAddress: ctx.ipAddress,
          locationEstimate,
          status: 'Peringatan',
        });
        createSecurityNotification({
          username: dbAccount.username,
          type: 'login_attempt',
          title: 'Percobaan Login Gagal Terdeteksi',
          message: `Percobaan masuk dengan password salah dari ${ctx.deviceLabel} (${locationEstimate}).`,
          severity: 'warning',
        });
      }
      res.status(401).json({
        error: 'Username atau password salah. Periksa kembali kredensial Anda.',
      });
      return;
    }

    const activeAccount = dbAccount!;
    const db = getSecurityDb();
    const nowIso = new Date().toISOString();

    const emailConfirmationEnabled =
      activeAccount.require_email_login_approval === 1 &&
      Boolean(activeAccount.email) &&
      activeAccount.email_verified === 1;

    const existingTrustedDevice = findActiveTrustedDevice(req, activeAccount.username);
    const needsConfirmation =
      emailConfirmationEnabled &&
      (activeAccount.approval_policy === 'every_login' || !existingTrustedDevice);

    if (needsConfirmation) {
      const challengeId = `chl-${crypto.randomUUID().slice(0, 12)}`;
      const pollSecret = crypto.randomBytes(24).toString('hex');
      const approveToken = crypto.randomBytes(32).toString('hex');
      const denyToken = crypto.randomBytes(32).toString('hex');
      const ttlMinutes = Math.min(
        30,
        Math.max(5, Number(activeAccount.login_approval_ttl_minutes || 10)),
      );
      const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

      db.prepare(
        `INSERT INTO login_challenges (
          id, username, admin_email, poll_secret_hash, approve_token_hash, deny_token_hash,
          device_fingerprint, device_label, browser_name, os_name, ip_address, location_estimate,
          status, trusted_device_token, decision_reason, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, '', ?, ?)`,
      ).run(
        challengeId,
        activeAccount.username,
        activeAccount.email,
        sha256Hex(pollSecret),
        sha256Hex(approveToken),
        sha256Hex(denyToken),
        ctx.deviceFingerprint,
        ctx.deviceLabel,
        ctx.browserName,
        ctx.osName,
        ctx.ipAddress,
        locationEstimate,
        expiresAt,
        nowIso,
      );

      recordActivityLog({
        username: activeAccount.username,
        eventType: 'Permintaan Konfirmasi Login',
        description: `Menunggu persetujuan email untuk perangkat baru (${ctx.deviceLabel}).`,
        deviceLabel: ctx.deviceLabel,
        ipAddress: ctx.ipAddress,
        locationEstimate,
        status: 'Menunggu',
      });

      createSecurityNotification({
        username: activeAccount.username,
        type: 'login_confirmation_request',
        title: 'Permintaan Konfirmasi Login Baru',
        message: `Menunggu konfirmasi email dari ${ctx.deviceLabel} · ${locationEstimate}.`,
        severity: 'warning',
      });

      const baseUrl = getPublicAppBaseUrl(req);
      const approveUrl = `${baseUrl}/?loginConfirm=${encodeURIComponent(approveToken)}&action=approve`;
      const denyUrl = `${baseUrl}/?loginConfirm=${encodeURIComponent(denyToken)}&action=deny`;

      const mail = buildLoginConfirmationEmail({
        adminName: activeAccount.full_name,
        username: activeAccount.username,
        requestedAtFormatted: formatWaktuIndonesia(nowIso),
        deviceLabel: ctx.deviceLabel,
        ipAddress: ctx.ipAddress,
        locationEstimate,
        ttlMinutes,
        approveUrl,
        denyUrl,
      });

      const emailRes = await sendTransactionalEmail({
        to: activeAccount.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });

      recordEmailOutbox({
        recipientEmail: activeAccount.email,
        subject: mail.subject,
        category: 'login_confirmation',
        deliveryMode: emailRes.deliveredVia,
        deliveryStatus: emailRes.status,
        errorMessage: emailRes.errorMessage,
        previewHtml: emailRes.html,
        previewText: emailRes.text,
        challengeId,
      });

      res.status(202).json({
        status: 'confirmation_required',
        challengeId,
        pollSecret,
        expiresAt,
        ttlMinutes,
        maskedEmail: maskEmailAddress(activeAccount.email),
        deviceLabel: ctx.deviceLabel,
        locationEstimate,
        ipAddress: ctx.ipAddress,
        requestedAt: nowIso,
        smtpConfigured: isSmtpConfigured(),
        emailDeliveryStatus: emailRes.status,
      });
      return;
    }

    // Immediate authenticated session (trusted device or email verification not yet registered/disabled)
    if (existingTrustedDevice) {
      db.prepare(
        `UPDATE trusted_devices SET last_used_at = ?, ip_address = ?, location_estimate = ? WHERE id = ?`,
      ).run(nowIso, ctx.ipAddress, locationEstimate, existingTrustedDevice.id);
    } else {
      const rawDeviceToken = crypto.randomBytes(32).toString('hex');
      db.prepare(
        `INSERT INTO trusted_devices (
          id, username, token_hash, device_label, ip_address, location_estimate, last_used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        `dev-${crypto.randomUUID().slice(0, 8)}`,
        activeAccount.username,
        sha256Hex(rawDeviceToken),
        ctx.deviceLabel,
        ctx.ipAddress,
        locationEstimate,
        nowIso,
        nowIso,
      );
      setTrustedDeviceCookie(req, res, rawDeviceToken);
    }

    recordActivityLog({
      username: activeAccount.username,
      eventType: 'Login Berhasil',
      description: existingTrustedDevice
        ? 'Masuk menggunakan perangkat terpercaya.'
        : 'Masuk berhasil ke sistem SIMPANDADU.',
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: activeAccount.username,
      type: 'login_success',
      title: 'Login Berhasil',
      message: `Akun masuk dari ${ctx.deviceLabel} · ${locationEstimate}.`,
      severity: 'success',
    });

    if (
      activeAccount.email &&
      activeAccount.email_verified === 1 &&
      activeAccount.notify_on_login_success === 1
    ) {
      const alertMail = buildSecurityAlertEmail({
        adminName: activeAccount.full_name,
        username: activeAccount.username,
        title: 'Pemberitahuan Login Berhasil',
        detail: `Akun administrator SIMPANDADU Anda baru saja masuk ke dashboard dari perangkat tepercaya (${ctx.deviceLabel}).`,
        occurredAtFormatted: formatWaktuIndonesia(nowIso),
        deviceLabel: ctx.deviceLabel,
        ipAddress: ctx.ipAddress,
      });
      sendTransactionalEmail({
        to: activeAccount.email,
        subject: alertMail.subject,
        html: alertMail.html,
        text: alertMail.text,
      })
        .then((emailRes) => {
          recordEmailOutbox({
            recipientEmail: activeAccount.email,
            subject: alertMail.subject,
            category: 'login_success_notice',
            deliveryMode: emailRes.deliveredVia,
            deliveryStatus: emailRes.status,
            errorMessage: emailRes.errorMessage,
          });
        })
        .catch(() => {});
    }

    const sessionPayload: SessionPayload = {
      username: activeAccount.username,
      fullName: activeAccount.full_name,
      role: activeAccount.role,
      exp: Date.now() + 1000 * 60 * 60 * 24,
    };
    const token = signSessionToken(sessionPayload);
    setSessionCookie(req, res, token);

    res.json({
      status: 'authenticated',
      token,
      user: toAdminUserDTO(activeAccount),
    });
  });

  // Poll login confirmation status (gated by pollSecret)
  app.get('/api/auth/login-status/:challengeId', async (req: Request, res: Response) => {
    const challengeId = String(req.params.challengeId || '').trim();
    const pollSecret = String(req.headers['x-login-poll-secret'] || '').trim();
    if (!challengeId || !pollSecret) {
      res.status(400).json({ error: 'Permintaan pemeriksaan status tidak valid.' });
      return;
    }

    const db = getSecurityDb();
    const challenge = db
      .prepare('SELECT * FROM login_challenges WHERE id = ? LIMIT 1')
      .get(challengeId) as DbLoginChallenge | undefined;

    if (!challenge || challenge.poll_secret_hash !== sha256Hex(pollSecret)) {
      res.status(404).json({ error: 'Sesi konfirmasi login tidak ditemukan.' });
      return;
    }

    if (challenge.status === 'pending' && Date.now() > challenge.expires_at) {
      const nowIso = new Date().toISOString();
      db.prepare(
        `UPDATE login_challenges SET status = 'expired', decision_reason = ?, decided_at = ? WHERE id = ? AND status = 'pending'`,
      ).run('Batas waktu konfirmasi email habis.', nowIso, challenge.id);

      recordActivityLog({
        username: challenge.username,
        eventType: 'Konfirmasi Login Kedaluwarsa',
        description: 'Tidak ada konfirmasi email sebelum batas waktu berakhir.',
        deviceLabel: challenge.device_label,
        ipAddress: challenge.ip_address,
        locationEstimate: challenge.location_estimate,
        status: 'Kedaluwarsa',
      });
      createSecurityNotification({
        username: challenge.username,
        type: 'security_alert',
        title: 'Permintaan Login Kedaluwarsa',
        message: `Permintaan login dari ${challenge.device_label} kedaluwarsa tanpa konfirmasi.`,
        severity: 'warning',
      });

      const account = getAdminAccountByUsername(challenge.username);
      if (account && account.email) {
        const resMail = buildLoginDecisionResultEmail({
          adminName: account.full_name,
          username: account.username,
          outcome: 'expired',
          decidedAtFormatted: formatWaktuIndonesia(nowIso),
          deviceLabel: challenge.device_label,
          ipAddress: challenge.ip_address,
          locationEstimate: challenge.location_estimate,
        });
        const emailRes = await sendTransactionalEmail({
          to: account.email,
          subject: resMail.subject,
          html: resMail.html,
          text: resMail.text,
        });
        recordEmailOutbox({
          recipientEmail: account.email,
          subject: resMail.subject,
          category: 'login_expired_notice',
          deliveryMode: emailRes.deliveredVia,
          deliveryStatus: emailRes.status,
          errorMessage: emailRes.errorMessage,
        });
      }

      res.json({
        status: 'expired',
        expiresAt: challenge.expires_at,
        decidedAt: nowIso,
        decisionReason: 'Batas waktu konfirmasi email habis.',
      });
      return;
    }

    res.json({
      status: challenge.status,
      expiresAt: challenge.expires_at,
      decidedAt: challenge.decided_at,
      decisionReason: challenge.decision_reason,
    });
  });

  // Complete approved login from waiting browser
  app.post('/api/auth/login-complete', (req: Request, res: Response) => {
    const { challengeId, pollSecret } = req.body as {
      challengeId?: string;
      pollSecret?: string;
    };
    const cid = String(challengeId || '').trim();
    const secret = String(pollSecret || '').trim();
    if (!cid || !secret) {
      res.status(400).json({ error: 'Parameter penyelesaian login tidak lengkap.' });
      return;
    }

    const db = getSecurityDb();
    const challenge = db
      .prepare('SELECT * FROM login_challenges WHERE id = ? LIMIT 1')
      .get(cid) as DbLoginChallenge | undefined;

    if (!challenge || challenge.poll_secret_hash !== sha256Hex(secret)) {
      res.status(404).json({ error: 'Sesi konfirmasi login tidak ditemukan.' });
      return;
    }
    if (challenge.status === 'denied') {
      res.status(403).json({
        error: 'Percobaan login ini telah ditolak oleh administrator melalui email.',
      });
      return;
    }
    if (challenge.status === 'expired' || Date.now() > challenge.expires_at) {
      res.status(410).json({
        error: 'Permintaan konfirmasi login telah kedaluwarsa. Silakan ulangi proses masuk.',
      });
      return;
    }
    if (challenge.status !== 'approved') {
      res.status(409).json({
        error: 'Login belum dikonfirmasi melalui tautan email admin.',
      });
      return;
    }

    const account = getAdminAccountByUsername(challenge.username);
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const updateRes = db
      .prepare(
        `UPDATE login_challenges SET status = 'completed', completed_at = ?, trusted_device_token = NULL WHERE id = ? AND status = 'approved'`,
      )
      .run(nowIso, challenge.id);

    if (updateRes.changes === 0) {
      res.status(409).json({ error: 'Tautan penyelesaian login sudah pernah digunakan.' });
      return;
    }

    if (challenge.trusted_device_token) {
      setTrustedDeviceCookie(req, res, challenge.trusted_device_token);
    }

    recordActivityLog({
      username: account.username,
      eventType: 'Login Berhasil (Terkonfirmasi Email)',
      description: `Sesi masuk disetujui melalui email dan diaktifkan (${challenge.device_label}).`,
      deviceLabel: challenge.device_label,
      ipAddress: challenge.ip_address,
      locationEstimate: challenge.location_estimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: account.username,
      type: 'login_success',
      title: 'Login Berhasil Setelah Konfirmasi Email',
      message: `Perangkat baru (${challenge.device_label}) berhasil masuk setelah disetujui.`,
      severity: 'success',
    });

    const sessionPayload: SessionPayload = {
      username: account.username,
      fullName: account.full_name,
      role: account.role,
      exp: Date.now() + 1000 * 60 * 60 * 24,
    };
    const token = signSessionToken(sessionPayload);
    setSessionCookie(req, res, token);

    res.json({
      token,
      user: toAdminUserDTO(account),
    });
  });

  // Read-only preview of one-time login confirmation link (safe against email prefetch scanners)
  app.get('/api/auth/login-confirm-preview', (req: Request, res: Response) => {
    const token = String(req.query.token || '').trim();
    const action = req.query.action === 'deny' ? 'deny' : 'approve';
    if (!token) {
      res.status(400).json({ error: 'Token konfirmasi tidak ditemukan.' });
      return;
    }

    const db = getSecurityDb();
    const tokenHash = sha256Hex(token);
    const column = action === 'deny' ? 'deny_token_hash' : 'approve_token_hash';
    const challenge = db
      .prepare(`SELECT * FROM login_challenges WHERE ${column} = ? LIMIT 1`)
      .get(tokenHash) as DbLoginChallenge | undefined;

    if (!challenge) {
      res.json({
        valid: false,
        reason: 'Tautan konfirmasi tidak valid atau tidak ditemukan.',
        status: 'expired',
        action,
        username: '-',
        deviceLabel: '-',
        ipAddress: '-',
        locationEstimate: '-',
        requestedAt: new Date().toISOString(),
        expiresAt: 0,
      });
      return;
    }

    let currentStatus = challenge.status;
    if (currentStatus === 'pending' && Date.now() > challenge.expires_at) {
      currentStatus = 'expired';
      db.prepare(
        `UPDATE login_challenges SET status = 'expired', decision_reason = 'Batas waktu konfirmasi habis.', decided_at = ? WHERE id = ? AND status = 'pending'`,
      ).run(new Date().toISOString(), challenge.id);
    }

    const valid = currentStatus === 'pending';
    let reason: string | undefined;
    if (currentStatus === 'approved' || currentStatus === 'completed') {
      reason = 'Permintaan login ini sudah disetujui sebelumnya (tautan hanya berlaku 1 kali).';
    } else if (currentStatus === 'denied') {
      reason = 'Permintaan login ini sudah ditolak sebelumnya (tautan hanya berlaku 1 kali).';
    } else if (currentStatus === 'expired') {
      reason = 'Batas waktu konfirmasi permintaan login ini telah kedaluwarsa.';
    }

    res.json({
      valid,
      reason,
      status: currentStatus,
      action,
      username: challenge.username,
      deviceLabel: challenge.device_label,
      ipAddress: challenge.ip_address,
      locationEstimate: challenge.location_estimate,
      requestedAt: challenge.created_at,
      expiresAt: challenge.expires_at,
    });
  });

  // Execute one-time login approval or denial from email link
  app.post('/api/auth/login-confirm', async (req: Request, res: Response) => {
    const { token, action } = req.body as {
      token?: string;
      action?: 'approve' | 'deny';
    };
    const cleanToken = String(token || '').trim();
    const cleanAction = action === 'deny' ? 'deny' : 'approve';
    if (!cleanToken) {
      res.status(400).json({ error: 'Token konfirmasi wajib disertakan.' });
      return;
    }

    const db = getSecurityDb();
    const tokenHash = sha256Hex(cleanToken);
    const column = cleanAction === 'deny' ? 'deny_token_hash' : 'approve_token_hash';
    const challenge = db
      .prepare(`SELECT * FROM login_challenges WHERE ${column} = ? LIMIT 1`)
      .get(tokenHash) as DbLoginChallenge | undefined;

    if (!challenge) {
      res.status(404).json({ error: 'Tautan konfirmasi login tidak valid.' });
      return;
    }

    const nowIso = new Date().toISOString();
    if (challenge.status === 'pending' && Date.now() > challenge.expires_at) {
      db.prepare(
        `UPDATE login_challenges SET status = 'expired', decision_reason = 'Batas waktu konfirmasi habis.', decided_at = ? WHERE id = ? AND status = 'pending'`,
      ).run(nowIso, challenge.id);
      res.status(410).json({
        error: 'Permintaan konfirmasi login ini telah kedaluwarsa.',
      });
      return;
    }

    if (challenge.status !== 'pending') {
      res.status(409).json({
        error:
          'Tautan konfirmasi ini sudah pernah digunakan atau permintaan login sudah diproses.',
      });
      return;
    }

    const account = getAdminAccountByUsername(challenge.username);

    if (cleanAction === 'approve') {
      const rawDeviceToken = crypto.randomBytes(32).toString('hex');
      const result = db
        .prepare(
          `UPDATE login_challenges SET status = 'approved', trusted_device_token = ?, decided_at = ?, decision_reason = ? WHERE id = ? AND status = 'pending'`,
        )
        .run(
          rawDeviceToken,
          nowIso,
          'Disetujui admin melalui tautan email (IZINKAN LOGIN).',
          challenge.id,
        );
      if (result.changes === 0) {
        res.status(409).json({ error: 'Tautan sudah pernah diproses.' });
        return;
      }

      db.prepare(
        `INSERT INTO trusted_devices (
          id, username, token_hash, device_label, ip_address, location_estimate, last_used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        `dev-${crypto.randomUUID().slice(0, 8)}`,
        challenge.username,
        sha256Hex(rawDeviceToken),
        challenge.device_label,
        challenge.ip_address,
        challenge.location_estimate,
        nowIso,
        nowIso,
      );

      recordActivityLog({
        username: challenge.username,
        eventType: 'Konfirmasi Login Disetujui',
        description: `Admin menyetujui login dari ${challenge.device_label} melalui email.`,
        deviceLabel: challenge.device_label,
        ipAddress: challenge.ip_address,
        locationEstimate: challenge.location_estimate,
        status: 'Disetujui',
      });

      createSecurityNotification({
        username: challenge.username,
        type: 'login_success',
        title: 'Konfirmasi Login Disetujui',
        message: `Anda mengizinkan login dari ${challenge.device_label} (${challenge.location_estimate}).`,
        severity: 'success',
      });

      if (account && account.email) {
        const resMail = buildLoginDecisionResultEmail({
          adminName: account.full_name,
          username: account.username,
          outcome: 'approved',
          decidedAtFormatted: formatWaktuIndonesia(nowIso),
          deviceLabel: challenge.device_label,
          ipAddress: challenge.ip_address,
          locationEstimate: challenge.location_estimate,
        });
        const emailRes = await sendTransactionalEmail({
          to: account.email,
          subject: resMail.subject,
          html: resMail.html,
          text: resMail.text,
        });
        recordEmailOutbox({
          recipientEmail: account.email,
          subject: resMail.subject,
          category: 'login_decision_notice',
          deliveryMode: emailRes.deliveredVia,
          deliveryStatus: emailRes.status,
          errorMessage: emailRes.errorMessage,
        });
      }

      res.json({
        ok: true,
        outcome: 'approved',
        deviceLabel: challenge.device_label,
        ipAddress: challenge.ip_address,
        locationEstimate: challenge.location_estimate,
        decidedAt: nowIso,
      });
      return;
    }

    // Action === 'deny'
    const denyResult = db
      .prepare(
        `UPDATE login_challenges SET status = 'denied', decided_at = ?, decision_reason = ? WHERE id = ? AND status = 'pending'`,
      )
      .run(
        nowIso,
        'Ditolak admin melalui tautan email (TOLAK LOGIN).',
        challenge.id,
      );
    if (denyResult.changes === 0) {
      res.status(409).json({ error: 'Tautan sudah pernah diproses.' });
      return;
    }

    recordActivityLog({
      username: challenge.username,
      eventType: 'Percobaan Login Ditolak',
      description: `Admin menolak percobaan login dari ${challenge.device_label} melalui email.`,
      deviceLabel: challenge.device_label,
      ipAddress: challenge.ip_address,
      locationEstimate: challenge.location_estimate,
      status: 'Ditolak',
    });

    createSecurityNotification({
      username: challenge.username,
      type: 'login_denied',
      title: 'Percobaan Login Ditolak',
      message: `Permintaan login dari ${challenge.device_label} (${challenge.location_estimate}) telah dibatalkan.`,
      severity: 'danger',
    });

    if (account && account.email) {
      const resMail = buildLoginDecisionResultEmail({
        adminName: account.full_name,
        username: account.username,
        outcome: 'denied',
        decidedAtFormatted: formatWaktuIndonesia(nowIso),
        deviceLabel: challenge.device_label,
        ipAddress: challenge.ip_address,
        locationEstimate: challenge.location_estimate,
      });
      const emailRes = await sendTransactionalEmail({
        to: account.email,
        subject: resMail.subject,
        html: resMail.html,
        text: resMail.text,
      });
      recordEmailOutbox({
        recipientEmail: account.email,
        subject: resMail.subject,
        category: 'login_decision_notice',
        deliveryMode: emailRes.deliveredVia,
        deliveryStatus: emailRes.status,
        errorMessage: emailRes.errorMessage,
      });
    }

    res.json({
      ok: true,
      outcome: 'denied',
      deviceLabel: challenge.device_label,
      ipAddress: challenge.ip_address,
      locationEstimate: challenge.location_estimate,
      decidedAt: nowIso,
    });
  });

  // Local test outbox viewer (ONLY active when SMTP is not yet configured)
  app.get('/api/auth/dev-outbox', (req: Request, res: Response) => {
    if (isSmtpConfigured()) {
      res.status(404).json({
        error: 'Mode pratinjau lokal nonaktif karena SMTP server sudah dikonfigurasi.',
      });
      return;
    }
    const db = getSecurityDb();
    const challengeId = String(req.query.challengeId || '').trim();
    const pollSecret = String(req.headers['x-login-poll-secret'] || '').trim();

    if (challengeId) {
      const challenge = db
        .prepare('SELECT poll_secret_hash FROM login_challenges WHERE id = ? LIMIT 1')
        .get(challengeId) as { poll_secret_hash: string } | undefined;
      if (!challenge || !pollSecret || challenge.poll_secret_hash !== sha256Hex(pollSecret)) {
        res.status(403).json({ error: 'Akses pratinjau email ditolak.' });
        return;
      }
      const rows = db
        .prepare(
          `SELECT id, recipient_email, subject, category, delivery_mode, delivery_status, error_message, preview_html, preview_text, created_at
           FROM email_outbox_logs WHERE challenge_id = ? ORDER BY created_at DESC LIMIT 5`,
        )
        .all(challengeId) as unknown as Array<DbEmailOutboxLog>;
      res.json({
        emails: rows.map((r) => ({
          id: r.id,
          recipientEmail: r.recipient_email,
          subject: r.subject,
          category: r.category,
          deliveryMode: r.delivery_mode,
          deliveryStatus: r.delivery_status,
          errorMessage: r.error_message,
          previewHtml: r.preview_html,
          previewText: r.preview_text,
          createdAt: r.created_at,
        })),
      });
      return;
    }

    const session = extractSession(req);
    if (!session) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    const rows = db
      .prepare(
        `SELECT id, recipient_email, subject, category, delivery_mode, delivery_status, error_message, preview_html, preview_text, created_at
         FROM email_outbox_logs ORDER BY created_at DESC LIMIT 10`,
      )
      .all() as unknown as Array<DbEmailOutboxLog>;
    res.json({
      emails: rows.map((r) => ({
        id: r.id,
        recipientEmail: r.recipient_email,
        subject: r.subject,
        category: r.category,
        deliveryMode: r.delivery_mode,
        deliveryStatus: r.delivery_status,
        errorMessage: r.error_message,
        previewHtml: r.preview_html,
        previewText: r.preview_text,
        createdAt: r.created_at,
      })),
    });
  });

  // Verify email via one-time link token or authenticated 6-digit code
  app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
    const { token, code } = req.body as { token?: string; code?: string };
    const cleanToken = String(token || '').trim();
    const cleanCode = String(code || '').trim();

    if (!cleanToken && !cleanCode) {
      res.status(400).json({ error: 'Token atau kode verifikasi email wajib diisi.' });
      return;
    }

    const db = getSecurityDb();
    let row: DbEmailVerificationToken | undefined;

    if (cleanToken) {
      row = db
        .prepare('SELECT * FROM email_verification_tokens WHERE token_hash = ? LIMIT 1')
        .get(sha256Hex(cleanToken)) as DbEmailVerificationToken | undefined;
    } else {
      const session = extractSession(req);
      if (!session) {
        res.status(401).json({ error: 'Masuk terlebih dahulu untuk memverifikasi kode 6 digit.' });
        return;
      }
      row = db
        .prepare(
          `SELECT * FROM email_verification_tokens WHERE username = ? AND code_hash = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        )
        .get(session.username, sha256Hex(cleanCode)) as DbEmailVerificationToken | undefined;
    }

    if (!row) {
      res.status(404).json({ error: 'Token atau kode verifikasi email tidak valid.' });
      return;
    }
    if (row.used_at) {
      res.status(409).json({ error: 'Tautan/kode verifikasi ini sudah pernah digunakan.' });
      return;
    }
    if (Date.now() > row.expires_at) {
      res.status(410).json({ error: 'Tautan/kode verifikasi telah kedaluwarsa. Ajukan ulang perubahan email.' });
      return;
    }

    const account = getAdminAccountByUsername(row.username);
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const oldEmail = account.email;
    const nowIso = new Date().toISOString();

    const markRes = db
      .prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL')
      .run(nowIso, row.id);
    if (markRes.changes === 0) {
      res.status(409).json({ error: 'Token sudah pernah digunakan.' });
      return;
    }

    db.prepare(
      `UPDATE admin_accounts SET email = ?, email_verified = 1, pending_email = NULL, updated_at = ? WHERE id = ?`,
    ).run(row.new_email, nowIso, account.id);

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    recordActivityLog({
      username: account.username,
      eventType: 'Verifikasi Email Baru',
      description: `Email aktif admin diperbarui menjadi ${row.new_email}.`,
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: account.username,
      type: 'security_alert',
      title: 'Alamat Email Admin Terverifikasi',
      message: `Email aktif akun diperbarui ke ${row.new_email}.`,
      severity: 'success',
    });

    const confirmAlert = buildSecurityAlertEmail({
      adminName: account.full_name,
      username: account.username,
      title: 'Alamat Email Admin Berhasil Diperbarui',
      detail: `Alamat email aktif akun SIMPANDADU Anda telah diverifikasi dan diperbarui menjadi ${row.new_email}.`,
      occurredAtFormatted: formatWaktuIndonesia(nowIso),
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
    });

    const newSendRes = await sendTransactionalEmail({
      to: row.new_email,
      subject: confirmAlert.subject,
      html: confirmAlert.html,
      text: confirmAlert.text,
    });
    recordEmailOutbox({
      recipientEmail: row.new_email,
      subject: confirmAlert.subject,
      category: 'email_changed_notice',
      deliveryMode: newSendRes.deliveredVia,
      deliveryStatus: newSendRes.status,
      errorMessage: newSendRes.errorMessage,
    });

    if (oldEmail && oldEmail !== row.new_email) {
      sendTransactionalEmail({
        to: oldEmail,
        subject: confirmAlert.subject,
        html: confirmAlert.html,
        text: confirmAlert.text,
      }).catch(() => {});
    }

    res.json({
      ok: true,
      newEmail: row.new_email,
      verifiedAt: nowIso,
    });
  });

  // Current user
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const session = extractSession(req);
    if (!session) {
      res.status(401).json({ error: 'Belum masuk.' });
      return;
    }
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(401).json({ error: 'Akun tidak ditemukan.' });
      return;
    }
    res.json({
      user: toAdminUserDTO(account),
    });
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // ---------- Account Profile, Security, Notifications & Activity Logs ----------
  app.get('/api/account/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const db = getSecurityDb();
    const cookies = parseCookies(req.headers.cookie);
    const currentDeviceHash = cookies[DEVICE_COOKIE_NAME]
      ? sha256Hex(cookies[DEVICE_COOKIE_NAME])
      : null;

    const deviceRows = db
      .prepare(
        `SELECT * FROM trusted_devices WHERE username = ? AND revoked_at IS NULL ORDER BY last_used_at DESC LIMIT 20`,
      )
      .all(account.username) as unknown as Array<DbTrustedDevice>;

    const logRows = db
      .prepare(
        `SELECT * FROM activity_logs WHERE username = ? ORDER BY created_at DESC LIMIT 50`,
      )
      .all(account.username) as unknown as Array<DbActivityLog>;

    const pendingToken = db
      .prepare(
        `SELECT new_email, expires_at, created_at FROM email_verification_tokens WHERE username = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(account.username, Date.now()) as
      | { new_email: string; expires_at: number; created_at: string }
      | undefined;

    const outboxRows = !isSmtpConfigured()
      ? (db
          .prepare(
            `SELECT id, recipient_email, subject, category, delivery_mode, delivery_status, error_message, preview_html, preview_text, created_at
             FROM email_outbox_logs ORDER BY created_at DESC LIMIT 8`,
          )
          .all() as unknown as Array<DbEmailOutboxLog>)
      : (db
          .prepare(
            `SELECT id, recipient_email, subject, category, delivery_mode, delivery_status, error_message, '' AS preview_html, '' AS preview_text, created_at
             FROM email_outbox_logs ORDER BY created_at DESC LIMIT 8`,
          )
          .all() as unknown as Array<DbEmailOutboxLog>);

    res.json({
      profile: toAdminAccountProfileDTO(account),
      envManaged: hasEnvAdmin(),
      pendingEmailVerification: pendingToken
        ? {
            newEmail: pendingToken.new_email,
            expiresAt: pendingToken.expires_at,
            createdAt: pendingToken.created_at,
          }
        : null,
      trustedDevices: deviceRows.map((d) => ({
        id: d.id,
        deviceLabel: d.device_label,
        ipAddress: d.ip_address,
        locationEstimate: d.location_estimate,
        lastUsedAt: d.last_used_at,
        createdAt: d.created_at,
        isCurrentDevice: Boolean(currentDeviceHash && d.token_hash === currentDeviceHash),
      })),
      activityLogs: logRows.map((l) => ({
        id: l.id,
        eventType: l.event_type,
        description: l.description,
        deviceLabel: l.device_label,
        ipAddress: l.ip_address,
        locationEstimate: l.location_estimate,
        status: l.status,
        createdAt: l.created_at,
      })),
      smtpStatus: getSmtpStatus(),
      recentEmails: outboxRows.map((e) => ({
        id: e.id,
        recipientEmail: e.recipient_email,
        subject: e.subject,
        category: e.category,
        deliveryMode: e.delivery_mode,
        deliveryStatus: e.delivery_status,
        errorMessage: e.error_message,
        previewHtml: !isSmtpConfigured() ? e.preview_html : undefined,
        previewText: !isSmtpConfigured() ? e.preview_text : undefined,
        createdAt: e.created_at,
      })),
    });
  });

  app.put('/api/account/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const { fullName, username, phone, jabatan } = req.body as {
      fullName?: string;
      username?: string;
      phone?: string;
      jabatan?: string;
    };

    const cleanFullName = String(fullName ?? account.full_name).trim();
    const cleanUsername = hasEnvAdmin()
      ? account.username
      : String(username ?? account.username).trim();
    const cleanPhone = String(phone ?? account.phone).trim().replace(/[\s-]/g, '');
    const cleanJabatan = String(jabatan ?? account.jabatan).trim();

    if (cleanFullName.length < 2) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (cleanUsername.length < 4 || !/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
      res.status(400).json({
        error: 'Username minimal 4 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau hubung.',
      });
      return;
    }
    if (cleanPhone && !/^(\+62|62|0)8[0-9]{7,13}$/.test(cleanPhone)) {
      res.status(400).json({
        error: 'Format nomor HP tidak valid (contoh: 081234567890).',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const db = getSecurityDb();
    const oldUsername = account.username;

    db.prepare(
      `UPDATE admin_accounts SET username = ?, full_name = ?, phone = ?, jabatan = ?, role = ?, updated_at = ? WHERE id = ?`,
    ).run(
      cleanUsername,
      cleanFullName,
      cleanPhone,
      cleanJabatan || 'Administrator Balai Desa',
      cleanJabatan || account.role,
      nowIso,
      account.id,
    );

    if (oldUsername !== cleanUsername) {
      db.prepare('UPDATE trusted_devices SET username = ? WHERE username = ?').run(cleanUsername, oldUsername);
      db.prepare('UPDATE activity_logs SET username = ? WHERE username = ?').run(cleanUsername, oldUsername);
      db.prepare('UPDATE security_notifications SET username = ? WHERE username = ?').run(cleanUsername, oldUsername);
      db.prepare('UPDATE login_challenges SET username = ? WHERE username = ?').run(cleanUsername, oldUsername);
      db.prepare('UPDATE email_verification_tokens SET username = ? WHERE username = ?').run(cleanUsername, oldUsername);
    }

    if (store.adminAccount) {
      store.adminAccount.username = cleanUsername;
      store.adminAccount.fullName = cleanFullName;
      store.adminAccount.role = cleanJabatan || store.adminAccount.role;
      saveStore(store);
    }

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    recordActivityLog({
      username: cleanUsername,
      eventType: 'Perubahan Profil Akun',
      description: `Informasi profil (${cleanFullName}, ${cleanJabatan || 'Admin'}) diperbarui.`,
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: cleanUsername,
      type: 'profile_updated',
      title: 'Perubahan Informasi Akun',
      message: `Data profil akun ${cleanFullName} (@${cleanUsername}) berhasil diperbarui.`,
      severity: 'info',
    });

    const updated = getAdminAccount()!;
    const newSession: SessionPayload = {
      username: updated.username,
      fullName: updated.full_name,
      role: updated.role,
      exp: Date.now() + 1000 * 60 * 60 * 24,
    };
    const token = signSessionToken(newSession);
    setSessionCookie(req, res, token);

    res.json({
      token,
      user: toAdminUserDTO(updated),
      profile: toAdminAccountProfileDTO(updated),
    });
  });

  app.get('/api/account/avatar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account || !account.avatar_file) {
      res.status(404).json({ error: 'Foto profil belum tersedia.' });
      return;
    }
    const safeName = path.basename(account.avatar_file);
    const resolved = path.resolve(AVATARS_DIR, safeName);
    if (!resolved.startsWith(AVATARS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File foto profil tidak ditemukan.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(resolved);
  });

  app.post('/api/account/avatar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }
    const { imageDataUrl } = req.body as { imageDataUrl?: string };
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      res.status(400).json({ error: 'Data foto profil wajib diisi.' });
      return;
    }

    const saved = saveAdminAvatar(account.username, imageDataUrl);
    if ('error' in saved) {
      res.status(400).json({ error: saved.error });
      return;
    }

    deleteAdminAvatarFile(account.avatar_file);
    const nowIso = new Date().toISOString();
    const db = getSecurityDb();
    db.prepare('UPDATE admin_accounts SET avatar_file = ?, updated_at = ? WHERE id = ?').run(
      saved.fileName,
      nowIso,
      account.id,
    );

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    recordActivityLog({
      username: account.username,
      eventType: 'Perubahan Foto Profil',
      description: 'Foto profil admin berhasil diperbarui.',
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: account.username,
      type: 'profile_updated',
      title: 'Foto Profil Diperbarui',
      message: 'Foto profil akun administrator telah diperbarui.',
      severity: 'info',
    });

    const updated = getAdminAccount()!;
    res.json({
      user: toAdminUserDTO(updated),
      profile: toAdminAccountProfileDTO(updated),
    });
  });

  app.delete('/api/account/avatar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    deleteAdminAvatarFile(account.avatar_file);
    const nowIso = new Date().toISOString();
    const db = getSecurityDb();
    db.prepare('UPDATE admin_accounts SET avatar_file = NULL, updated_at = ? WHERE id = ?').run(
      nowIso,
      account.id,
    );

    const updated = getAdminAccount()!;
    res.json({
      user: toAdminUserDTO(updated),
      profile: toAdminAccountProfileDTO(updated),
    });
  });

  app.put('/api/account/password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (hasEnvAdmin()) {
      res.status(400).json({
        error: 'Password dikelola melalui variabel lingkungan server (SIMPANDADU_ADMIN_PASSWORD). Ubah melalui menu Secrets.',
      });
      return;
    }

    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    const curr = String(currentPassword || '');
    const next = String(newPassword || '');

    if (!curr || !verifyPassword(curr, account.password_hash)) {
      res.status(401).json({ error: 'Password saat ini tidak sesuai.' });
      return;
    }
    if (next.length < 8) {
      res.status(400).json({
        error: 'Password baru minimal 8 karakter demi keamanan akun admin.',
      });
      return;
    }
    if (curr === next) {
      res.status(400).json({
        error: 'Password baru harus berbeda dari password saat ini.',
      });
      return;
    }

    const newHash = hashPassword(next);
    const nowIso = new Date().toISOString();
    const db = getSecurityDb();
    db.prepare('UPDATE admin_accounts SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      newHash,
      nowIso,
      account.id,
    );

    if (store.adminAccount) {
      store.adminAccount.passwordHash = newHash;
      saveStore(store);
    }

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    recordActivityLog({
      username: account.username,
      eventType: 'Perubahan Password',
      description: 'Password akun administrator berhasil diganti.',
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: account.username,
      type: 'password_changed',
      title: 'Password Akun Diperbarui',
      message: `Password akun berhasil diganti dari ${ctx.deviceLabel} (${locationEstimate}).`,
      severity: 'warning',
    });

    if (account.email && account.email_verified === 1) {
      const mail = buildSecurityAlertEmail({
        adminName: account.full_name,
        username: account.username,
        title: 'Pemberitahuan Perubahan Password',
        detail:
          'Password akun administrator SIMPANDADU Anda baru saja diubah. Jika Anda tidak merasa melakukan perubahan ini, segera hubungi pengelola teknis desa.',
        occurredAtFormatted: formatWaktuIndonesia(nowIso),
        deviceLabel: ctx.deviceLabel,
        ipAddress: ctx.ipAddress,
      });
      const emailRes = await sendTransactionalEmail({
        to: account.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      recordEmailOutbox({
        recipientEmail: account.email,
        subject: mail.subject,
        category: 'password_changed_notice',
        deliveryMode: emailRes.deliveredVia,
        deliveryStatus: emailRes.status,
        errorMessage: emailRes.errorMessage,
      });
    }

    res.json({ ok: true });
  });

  app.post('/api/account/email/request', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const { currentPassword, newEmail } = req.body as {
      currentPassword?: string;
      newEmail?: string;
    };

    const curr = String(currentPassword || '');
    const cleanEmail = String(newEmail || '').trim().toLowerCase();

    if (!hasEnvAdmin()) {
      if (!curr || !verifyPassword(curr, account.password_hash)) {
        res.status(401).json({ error: 'Password saat ini salah. Verifikasi identitas diperlukan untuk mengubah email.' });
        return;
      }
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Format alamat email baru tidak valid.' });
      return;
    }
    if (cleanEmail === account.email && account.email_verified === 1) {
      res.status(400).json({ error: 'Alamat email baru sama dengan email aktif saat ini.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const code6 = String(crypto.randomInt(100000, 999999));
    const ttlMinutes = 15;
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    const nowIso = new Date().toISOString();

    const db = getSecurityDb();
    db.prepare(
      `UPDATE email_verification_tokens SET used_at = ? WHERE username = ? AND used_at IS NULL`,
    ).run(nowIso, account.username);

    db.prepare(
      `INSERT INTO email_verification_tokens (
        id, username, new_email, token_hash, code_hash, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `evt-${crypto.randomUUID().slice(0, 8)}`,
      account.username,
      cleanEmail,
      sha256Hex(rawToken),
      sha256Hex(code6),
      expiresAt,
      nowIso,
    );

    db.prepare(
      `UPDATE admin_accounts SET pending_email = ?, updated_at = ? WHERE id = ?`,
    ).run(cleanEmail, nowIso, account.id);

    const baseUrl = getPublicAppBaseUrl(req);
    const verifyUrl = `${baseUrl}/?verifyEmail=${encodeURIComponent(rawToken)}`;
    const mail = buildEmailVerificationEmail({
      adminName: account.full_name,
      username: account.username,
      newEmail: cleanEmail,
      verifyUrl,
      verificationCode: code6,
      ttlMinutes,
    });

    const emailRes = await sendTransactionalEmail({
      to: cleanEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    recordEmailOutbox({
      recipientEmail: cleanEmail,
      subject: mail.subject,
      category: 'email_verification',
      deliveryMode: emailRes.deliveredVia,
      deliveryStatus: emailRes.status,
      errorMessage: emailRes.errorMessage,
      previewHtml: emailRes.html,
      previewText: emailRes.text,
    });

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    recordActivityLog({
      username: account.username,
      eventType: 'Permintaan Ubah Email',
      description: `Mengirim tautan verifikasi perubahan email ke ${cleanEmail}.`,
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Menunggu',
    });

    createSecurityNotification({
      username: account.username,
      type: 'security_alert',
      title: 'Permintaan Verifikasi Email Baru',
      message: `Tautan verifikasi dikirim ke ${cleanEmail} (berlaku ${ttlMinutes} menit).`,
      severity: 'info',
    });

    res.json({
      ok: true,
      pendingEmail: cleanEmail,
      expiresAt,
      smtpConfigured: isSmtpConfigured(),
      deliveryStatus: emailRes.status,
    });
  });

  app.delete('/api/account/email/pending', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const db = getSecurityDb();
    db.prepare(`UPDATE email_verification_tokens SET used_at = ? WHERE username = ? AND used_at IS NULL`).run(
      nowIso,
      account.username,
    );
    db.prepare(`UPDATE admin_accounts SET pending_email = NULL, updated_at = ? WHERE id = ?`).run(
      nowIso,
      account.id,
    );
    res.json({ ok: true });
  });

  app.put('/api/account/security', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const body = req.body as {
      requireEmailLoginApproval?: boolean;
      notifyOnLoginSuccess?: boolean;
      notifyOnSecurityChange?: boolean;
      loginApprovalTtlMinutes?: number;
      approvalPolicy?: 'new_device' | 'every_login';
    };

    const requireEmailApproval =
      typeof body.requireEmailLoginApproval === 'boolean'
        ? body.requireEmailLoginApproval
        : account.require_email_login_approval === 1;

    if (requireEmailApproval && (!account.email || account.email_verified !== 1)) {
      res.status(400).json({
        error: 'Daftarkan dan verifikasi alamat email aktif terlebih dahulu sebelum mengaktifkan konfirmasi login via email.',
      });
      return;
    }

    const notifySuccess =
      typeof body.notifyOnLoginSuccess === 'boolean'
        ? body.notifyOnLoginSuccess
        : account.notify_on_login_success === 1;
    const notifyChange =
      typeof body.notifyOnSecurityChange === 'boolean'
        ? body.notifyOnSecurityChange
        : account.notify_on_security_change === 1;
    const ttl = Math.min(
      30,
      Math.max(5, Number(body.loginApprovalTtlMinutes ?? account.login_approval_ttl_minutes ?? 10)),
    );
    const policy =
      body.approvalPolicy === 'every_login' || body.approvalPolicy === 'new_device'
        ? body.approvalPolicy
        : account.approval_policy;

    const nowIso = new Date().toISOString();
    const db = getSecurityDb();
    db.prepare(
      `UPDATE admin_accounts SET
        require_email_login_approval = ?,
        notify_on_login_success = ?,
        notify_on_security_change = ?,
        login_approval_ttl_minutes = ?,
        approval_policy = ?,
        updated_at = ?
       WHERE id = ?`,
    ).run(
      requireEmailApproval ? 1 : 0,
      notifySuccess ? 1 : 0,
      notifyChange ? 1 : 0,
      ttl,
      policy,
      nowIso,
      account.id,
    );

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    recordActivityLog({
      username: account.username,
      eventType: 'Pengaturan Keamanan Diperbarui',
      description: `Konfirmasi email login: ${requireEmailApproval ? 'Aktif' : 'Nonaktif'} (${policy === 'every_login' ? 'Setiap Login' : 'Perangkat Baru'}), kedaluwarsa ${ttl} menit.`,
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: account.username,
      type: 'security_alert',
      title: 'Pengaturan Keamanan Akun Diubah',
      message: `Konfirmasi email login ${requireEmailApproval ? 'diaktifkan' : 'dinonaktifkan'} (${ttl} menit).`,
      severity: 'info',
    });

    const updated = getAdminAccount()!;
    res.json({ profile: toAdminAccountProfileDTO(updated) });
  });

  app.delete('/api/account/trusted-devices/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }

    const deviceId = String(req.params.id || '').trim();
    const db = getSecurityDb();
    const device = db
      .prepare('SELECT * FROM trusted_devices WHERE id = ? AND username = ? AND revoked_at IS NULL LIMIT 1')
      .get(deviceId, account.username) as DbTrustedDevice | undefined;

    if (!device) {
      res.status(404).json({ error: 'Perangkat tidak ditemukan atau sudah dicabut.' });
      return;
    }

    const nowIso = new Date().toISOString();
    db.prepare('UPDATE trusted_devices SET revoked_at = ? WHERE id = ?').run(nowIso, device.id);

    const cookies = parseCookies(req.headers.cookie);
    if (cookies[DEVICE_COOKIE_NAME] && sha256Hex(cookies[DEVICE_COOKIE_NAME]) === device.token_hash) {
      clearTrustedDeviceCookie(req, res);
    }

    const ctx = parseDeviceContext(req);
    const locationEstimate = await estimateLoginLocation(req, ctx.ipAddress);

    recordActivityLog({
      username: account.username,
      eventType: 'Pencabutan Perangkat Terpercaya',
      description: `Kepercayaan perangkat "${device.device_label}" dicabut. Login berikutnya wajib konfirmasi email.`,
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
      locationEstimate,
      status: 'Berhasil',
    });

    createSecurityNotification({
      username: account.username,
      type: 'security_alert',
      title: 'Perangkat Terpercaya Dicabut',
      message: `Akses terpercaya untuk ${device.device_label} dicabut.`,
      severity: 'warning',
    });

    res.json({ ok: true });
  });

  app.post('/api/account/test-email', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    if (!account) {
      res.status(404).json({ error: 'Akun admin tidak ditemukan.' });
      return;
    }
    const targetEmail = account.email || account.pending_email;
    if (!targetEmail) {
      res.status(400).json({ error: 'Belum ada alamat email terdaftar pada akun admin.' });
      return;
    }
    const ctx = parseDeviceContext(req);
    const nowIso = new Date().toISOString();
    const mail = buildSecurityAlertEmail({
      adminName: account.full_name,
      username: account.username,
      title: 'Uji Pengiriman Email Keamanan SIMPANDADU',
      detail: `Email ini adalah pesan uji coba dari sistem keamanan SIMPANDADU Desa Adimulya ke ${targetEmail}.`,
      occurredAtFormatted: formatWaktuIndonesia(nowIso),
      deviceLabel: ctx.deviceLabel,
      ipAddress: ctx.ipAddress,
    });

    const emailRes = await sendTransactionalEmail({
      to: targetEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    recordEmailOutbox({
      recipientEmail: targetEmail,
      subject: mail.subject,
      category: 'smtp_test',
      deliveryMode: emailRes.deliveredVia,
      deliveryStatus: emailRes.status,
      errorMessage: emailRes.errorMessage,
      previewHtml: emailRes.html,
      previewText: emailRes.text,
    });

    res.json({
      ok: emailRes.status !== 'failed',
      deliveryMode: emailRes.deliveredVia,
      deliveryStatus: emailRes.status,
      errorMessage: emailRes.errorMessage || null,
      targetEmail,
    });
  });

  // Notifications API (Header Bell)
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    const targetUsername = account?.username || session.username;
    const db = getSecurityDb();

    const rows = db
      .prepare(
        `SELECT * FROM security_notifications WHERE username = ? ORDER BY created_at DESC LIMIT 30`,
      )
      .all(targetUsername) as unknown as Array<DbSecurityNotification>;

    const unreadRow = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM security_notifications WHERE username = ? AND is_read = 0`,
      )
      .get(targetUsername) as { cnt: number };

    res.json({
      notifications: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        message: r.message,
        severity: r.severity,
        isRead: r.is_read === 1,
        createdAt: r.created_at,
      })),
      unreadCount: Number(unreadRow?.cnt || 0),
    });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    const targetUsername = account?.username || session.username;
    const db = getSecurityDb();
    db.prepare(
      `UPDATE security_notifications SET is_read = 1 WHERE id = ? AND username = ?`,
    ).run(String(req.params.id || ''), targetUsername);
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const session = req.adminUser!;
    const account = getAdminAccountByUsername(session.username) || getAdminAccount();
    const targetUsername = account?.username || session.username;
    const db = getSecurityDb();
    db.prepare(
      `UPDATE security_notifications SET is_read = 1 WHERE username = ? AND is_read = 0`,
    ).run(targetUsername);
    res.json({ ok: true });
  });

  // ---------- Protected Data Endpoints ----------
  // Assets CRUD
  app.get('/api/assets', requireAuth, (_req: Request, res: Response) => {
    res.json({ assets: store.assets });
  });

  app.post('/api/assets', requireAuth, (req: Request, res: Response) => {
    const body = req.body as Partial<VillageAsset>;
    const nama = String(body.nama || '').trim();
    const lokasi = String(body.lokasi || '').trim();
    const kategori = body.kategori as AssetCategory;
    const kondisi = body.kondisi as AssetCondition;
    const tahunPerolehan = Number(body.tahunPerolehan);
    const jumlah = Number(body.jumlah);
    const satuan = String(body.satuan || 'Unit').trim();
    const keterangan = String(body.keterangan || '').trim();

    if (!nama || !lokasi || !kategori || !kondisi) {
      res.status(400).json({ error: 'Nama aset, kategori, lokasi, dan kondisi wajib diisi.' });
      return;
    }
    if (!Number.isFinite(tahunPerolehan) || tahunPerolehan < 1945 || tahunPerolehan > 2100) {
      res.status(400).json({ error: 'Tahun perolehan tidak valid.' });
      return;
    }
    if (!Number.isFinite(jumlah) || jumlah < 1) {
      res.status(400).json({ error: 'Jumlah aset minimal 1.' });
      return;
    }

    const latRaw = body.koordinat?.lat;
    const lngRaw = body.koordinat?.lng;
    const lat =
      latRaw !== null && latRaw !== undefined && String(latRaw) !== '' && Number.isFinite(Number(latRaw))
        ? Number(latRaw)
        : null;
    const lng =
      lngRaw !== null && lngRaw !== undefined && String(lngRaw) !== '' && Number.isFinite(Number(lngRaw))
        ? Number(lngRaw)
        : null;

    const now = new Date().toISOString();
    const newAsset: VillageAsset = {
      id: `ast-${crypto.randomUUID().slice(0, 8)}`,
      nama,
      kategori,
      lokasi,
      tahunPerolehan,
      jumlah,
      satuan: satuan || 'Unit',
      kondisi,
      keterangan,
      koordinat: { lat, lng },
      createdAt: now,
      updatedAt: now,
    };

    store.assets.unshift(newAsset);
    saveStore(store);
    res.status(201).json({ asset: newAsset });
  });

  app.put('/api/assets/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = store.assets.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data aset tidak ditemukan.' });
      return;
    }

    const body = req.body as Partial<VillageAsset>;
    const nama = String(body.nama || '').trim();
    const lokasi = String(body.lokasi || '').trim();
    const kategori = body.kategori as AssetCategory;
    const kondisi = body.kondisi as AssetCondition;
    const tahunPerolehan = Number(body.tahunPerolehan);
    const jumlah = Number(body.jumlah);
    const satuan = String(body.satuan || 'Unit').trim();
    const keterangan = String(body.keterangan || '').trim();

    if (!nama || !lokasi || !kategori || !kondisi) {
      res.status(400).json({ error: 'Nama aset, kategori, lokasi, dan kondisi wajib diisi.' });
      return;
    }

    const latRaw = body.koordinat?.lat;
    const lngRaw = body.koordinat?.lng;
    const lat =
      latRaw !== null && latRaw !== undefined && String(latRaw) !== '' && Number.isFinite(Number(latRaw))
        ? Number(latRaw)
        : null;
    const lng =
      lngRaw !== null && lngRaw !== undefined && String(lngRaw) !== '' && Number.isFinite(Number(lngRaw))
        ? Number(lngRaw)
        : null;

    const existing = store.assets[idx];
    const updated: VillageAsset = {
      ...existing,
      nama,
      kategori,
      lokasi,
      tahunPerolehan: Number.isFinite(tahunPerolehan) ? tahunPerolehan : existing.tahunPerolehan,
      jumlah: Number.isFinite(jumlah) && jumlah >= 1 ? jumlah : existing.jumlah,
      satuan: satuan || existing.satuan,
      kondisi,
      keterangan,
      koordinat: { lat, lng },
      updatedAt: new Date().toISOString(),
    };

    store.assets[idx] = updated;
    saveStore(store);
    res.json({ asset: updated });
  });

  app.delete('/api/assets/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = store.assets.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data aset tidak ditemukan.' });
      return;
    }
    store.assets.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true });
  });

  // Musrenbang Proposals CRUD (Admin Only — includes Citizen PII & Photo)
  app.get('/api/proposals', requireAuth, (_req: Request, res: Response) => {
    const proposalsWithPhotoUrl = store.proposals.map((p) => ({
      ...p,
      fotoUrl: p.fotoUrl ? `/api/proposals/${encodeURIComponent(p.id)}/photo` : null,
    }));
    res.json({ proposals: proposalsWithPhotoUrl });
  });

  app.get('/api/proposals/:id/photo', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const found = store.proposals.find((p) => p.id === id);
    if (!found || !found.fotoUrl) {
      res.status(404).json({ error: 'Foto lokasi tidak ditemukan.' });
      return;
    }
    const safeName = path.basename(found.fotoUrl);
    const resolved = path.resolve(UPLOADS_DIR, safeName);
    if (
      !resolved.startsWith(UPLOADS_DIR + path.sep) ||
      !fs.existsSync(resolved)
    ) {
      res.status(404).json({ error: 'File foto tidak ditemukan.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(resolved);
  });

  app.post('/api/proposals', requireAuth, (req: Request, res: Response) => {
    const body = req.body as Partial<MusrenbangProposal>;
    const namaPengusul = String(body.namaPengusul || '').trim();
    const judulUsulan = String(body.judulUsulan || '').trim();
    const kategori = body.kategori as ProposalCategory;
    const lokasi = String(body.lokasi || '').trim();
    const tanggalPengajuan = String(body.tanggalPengajuan || new Date().toISOString().slice(0, 10));
    const prioritas = (body.prioritas || 'Sedang') as ProposalPriority;
    const status = (body.status || 'Diajukan') as ProposalStatus;
    const estimasiAnggaran = String(body.estimasiAnggaran || '').trim();
    const deskripsi = String(body.deskripsi || '').trim();
    const catatanVerifikasi = String(body.catatanVerifikasi || '').trim();
    const catatanUntukPengusul = String(body.catatanUntukPengusul || '').trim();
    const dusun = String(body.dusun || '').trim();
    const rtRw = String(body.rtRw || '').trim();
    const nomorHp = String(body.nomorHp || '').trim();
    const dipublikasikan =
      typeof body.dipublikasikan === 'boolean'
        ? body.dipublikasikan
        : status === 'Disetujui' || status === 'Selesai';

    if (!namaPengusul || !judulUsulan || !kategori || !lokasi) {
      res.status(400).json({
        error: 'Nama pengusul, judul usulan, kategori, dan lokasi wajib diisi.',
      });
      return;
    }

    const now = new Date().toISOString();
    const newProposal: MusrenbangProposal = {
      id: `mus-${crypto.randomUUID().slice(0, 8)}`,
      nomorPengajuan: generateNomorPengajuan(store.proposals),
      sumber: 'Admin',
      namaPengusul,
      nomorHp: nomorHp || undefined,
      dusun: dusun || undefined,
      rtRw: rtRw || undefined,
      judulUsulan,
      kategori,
      lokasi,
      tanggalPengajuan,
      prioritas,
      status,
      estimasiAnggaran: estimasiAnggaran || 'Belum diestimasi',
      deskripsi,
      catatanVerifikasi,
      catatanUntukPengusul,
      fotoUrl: null,
      dipublikasikan,
      createdAt: now,
      updatedAt: now,
    };

    store.proposals.unshift(newProposal);
    saveStore(store);
    res.status(201).json({ proposal: newProposal });
  });

  app.put('/api/proposals/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = store.proposals.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Usulan Musrenbang tidak ditemukan.' });
      return;
    }

    const body = req.body as Partial<MusrenbangProposal>;
    const existing = store.proposals[idx];
    const namaPengusul = String(body.namaPengusul ?? existing.namaPengusul).trim();
    const judulUsulan = String(body.judulUsulan ?? existing.judulUsulan).trim();
    const lokasi = String(body.lokasi ?? existing.lokasi).trim();
    if (!namaPengusul || !judulUsulan || !lokasi) {
      res.status(400).json({ error: 'Nama pengusul, judul usulan, dan lokasi wajib diisi.' });
      return;
    }

    const nextStatus = (body.status || existing.status) as ProposalStatus;
    const updated: MusrenbangProposal = {
      ...existing,
      namaPengusul,
      nomorHp: body.nomorHp !== undefined ? String(body.nomorHp).trim() : existing.nomorHp,
      dusun: body.dusun !== undefined ? String(body.dusun).trim() : existing.dusun,
      rtRw: body.rtRw !== undefined ? String(body.rtRw).trim() : existing.rtRw,
      judulUsulan,
      kategori: (body.kategori || existing.kategori) as ProposalCategory,
      lokasi,
      tanggalPengajuan: body.tanggalPengajuan || existing.tanggalPengajuan,
      prioritas: (body.prioritas || existing.prioritas) as ProposalPriority,
      status: nextStatus,
      estimasiAnggaran: String(body.estimasiAnggaran ?? existing.estimasiAnggaran),
      deskripsi: String(body.deskripsi ?? existing.deskripsi),
      catatanVerifikasi: String(body.catatanVerifikasi ?? existing.catatanVerifikasi),
      catatanUntukPengusul: String(
        body.catatanUntukPengusul ?? existing.catatanUntukPengusul ?? '',
      ),
      dipublikasikan:
        typeof body.dipublikasikan === 'boolean'
          ? body.dipublikasikan
          : existing.dipublikasikan,
      updatedAt: new Date().toISOString(),
    };

    store.proposals[idx] = updated;
    saveStore(store);
    res.json({
      proposal: {
        ...updated,
        fotoUrl: updated.fotoUrl
          ? `/api/proposals/${encodeURIComponent(updated.id)}/photo`
          : null,
      },
    });
  });

  app.delete('/api/proposals/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const idx = store.proposals.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Usulan Musrenbang tidak ditemukan.' });
      return;
    }
    const [removed] = store.proposals.splice(idx, 1);
    deleteProposalPhotoFile(removed?.fotoUrl);
    saveStore(store);
    res.json({ ok: true });
  });

  // Map Config (Official coordinates & boundary management)
  app.get('/api/map-config', requireAuth, (_req: Request, res: Response) => {
    res.json({ mapConfig: store.mapConfig });
  });

  app.put('/api/map-config', requireAuth, (req: Request, res: Response) => {
    const body = req.body as Partial<MapConfig>;
    const nextConfig: MapConfig = {
      balaiDesaLat:
        body.balaiDesaLat !== null &&
        body.balaiDesaLat !== undefined &&
        Number.isFinite(Number(body.balaiDesaLat))
          ? Number(body.balaiDesaLat)
          : null,
      balaiDesaLng:
        body.balaiDesaLng !== null &&
        body.balaiDesaLng !== undefined &&
        Number.isFinite(Number(body.balaiDesaLng))
          ? Number(body.balaiDesaLng)
          : null,
      defaultZoom:
        Number.isFinite(Number(body.defaultZoom)) &&
        Number(body.defaultZoom) >= 5 &&
        Number(body.defaultZoom) <= 19
          ? Number(body.defaultZoom)
          : store.mapConfig.defaultZoom,
      batasUtara: String(body.batasUtara ?? store.mapConfig.batasUtara),
      batasSelatan: String(body.batasSelatan ?? store.mapConfig.batasSelatan),
      batasTimur: String(body.batasTimur ?? store.mapConfig.batasTimur),
      batasBarat: String(body.batasBarat ?? store.mapConfig.batasBarat),
      boundaryCoordinates: Array.isArray(body.boundaryCoordinates)
        ? body.boundaryCoordinates.filter(
            (pt): pt is [number, number] =>
              Array.isArray(pt) &&
              pt.length === 2 &&
              Number.isFinite(Number(pt[0])) &&
              Number.isFinite(Number(pt[1])),
          )
        : store.mapConfig.boundaryCoordinates,
      dusunList: Array.isArray(body.dusunList)
        ? body.dusunList
        : store.mapConfig.dusunList,
    };

    store.mapConfig = nextConfig;
    saveStore(store);
    res.json({ mapConfig: store.mapConfig });
  });

  // Village Profile
  app.get('/api/profile', requireAuth, (_req: Request, res: Response) => {
    res.json({ profile: store.villageProfile });
  });

  app.put('/api/profile', requireAuth, (req: Request, res: Response) => {
    const body = req.body as Partial<VillageProfile>;
    store.villageProfile = {
      tentang: body.tentang ?? store.villageProfile.tentang,
      sejarah: body.sejarah ?? store.villageProfile.sejarah,
      visiMisi: body.visiMisi ?? store.villageProfile.visiMisi,
      geografisDemografi:
        body.geografisDemografi ?? store.villageProfile.geografisDemografi,
      potensi: Array.isArray(body.potensi) ? body.potensi : store.villageProfile.potensi,
      strukturOrganisasi: Array.isArray(body.strukturOrganisasi)
        ? body.strukturOrganisasi
        : store.villageProfile.strukturOrganisasi,
    };
    saveStore(store);
    res.json({ profile: store.villageProfile });
  });

  // Indonesian News RSS Proxy
  app.get('/api/news', requireAuth, async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await fetchIndonesianNews(forceRefresh);
      res.json(data);
    } catch {
      res.json({
        articles: buildDemoFallbackNews(),
        isDemoFallback: true,
        lastUpdated: new Date().toISOString(),
        sourcesChecked: ['ANTARA News', 'Kompas', 'CNN Indonesia', 'Tempo', 'Detik'],
      });
    }
  });

  // Vite or Static Frontend
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIMPANDADU server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
