export type AssetCategory =
  | 'Tanah Desa'
  | 'Bangunan'
  | 'Infrastruktur'
  | 'Kendaraan'
  | 'Peralatan'
  | 'Fasilitas Umum'
  | 'Pertanian'
  | 'Jaringan'
  | 'Konservasi'
  | 'Lainnya';

export type AssetCondition = 'Baik' | 'Perlu Perbaikan' | 'Rusak Berat';

export interface VillageAsset {
  id: string;
  nama: string;
  kategori: AssetCategory;
  lokasi: string;
  tahunPerolehan: number;
  jumlah: number;
  satuan: string;
  kondisi: AssetCondition;
  keterangan: string;
  koordinat: {
    lat: number | null;
    lng: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

export type ProposalCategory =
  | 'Infrastruktur'
  | 'Pendidikan'
  | 'Kesehatan'
  | 'Ekonomi'
  | 'Pertanian'
  | 'Sarana dan Prasarana'
  | 'Lingkungan';

export type ProposalPriority = 'Tinggi' | 'Sedang' | 'Rendah';

export type ProposalStatus =
  | 'Diajukan'
  | 'Menunggu Verifikasi'
  | 'Dalam Pembahasan'
  | 'Disetujui'
  | 'Ditolak'
  | 'Selesai';

export interface MusrenbangProposal {
  id: string;
  nomorPengajuan: string;
  sumber: 'Warga' | 'Admin';
  namaPengusul: string;
  nomorHp?: string;
  dusun?: string;
  rtRw?: string;
  judulUsulan: string;
  kategori: ProposalCategory;
  lokasi: string;
  tanggalPengajuan: string;
  prioritas: ProposalPriority;
  status: ProposalStatus;
  estimasiAnggaran: string;
  deskripsi: string;
  catatanVerifikasi: string;
  catatanUntukPengusul?: string;
  fotoUrl?: string | null;
  dipublikasikan: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProposalStatusItem {
  nomorPengajuan: string;
  judulUsulan: string;
  kategori: ProposalCategory;
  dusun: string;
  lokasi: string;
  tanggalPengajuan: string;
  prioritas: ProposalPriority;
  status: ProposalStatus;
  deskripsi: string;
  catatanUntukPengusul: string;
  dipublikasikan: boolean;
  updatedAt: string;
}

export interface PublicApprovedProposal {
  id: string;
  nomorPengajuan: string;
  judulUsulan: string;
  kategori: ProposalCategory;
  dusun: string;
  lokasi: string;
  tanggalPengajuan: string;
  prioritas: ProposalPriority;
  status: ProposalStatus;
  estimasiAnggaran: string;
  deskripsi: string;
  catatanUntukPengusul: string;
}

export type NewsCategory =
  | 'Semua Berita'
  | 'Nasional'
  | 'Daerah'
  | 'Politik'
  | 'Ekonomi'
  | 'Teknologi'
  | 'Pendidikan'
  | 'Kesehatan'
  | 'Olahraga'
  | 'Lingkungan';

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  publishedAt: string;
  source: string;
  sourceUrl: string;
  category: Exclude<NewsCategory, 'Semua Berita'>;
  imageUrl: string | null;
  isDemo?: boolean;
}

export interface NewsResponse {
  articles: NewsArticle[];
  isDemoFallback: boolean;
  lastUpdated: string;
  sourcesChecked: string[];
}

export interface DusunInfo {
  id: string;
  nama: string;
  kepalaDusun: string;
  jumlahRW: number;
  jumlahRT: number;
  lat: number | null;
  lng: number | null;
  keterangan: string;
}

export interface MapConfig {
  balaiDesaLat: number | null;
  balaiDesaLng: number | null;
  defaultZoom: number;
  batasUtara: string;
  batasSelatan: string;
  batasTimur: string;
  batasBarat: string;
  boundaryCoordinates: Array<[number, number]>;
  dusunList: DusunInfo[];
}

export interface VillageProfile {
  tentang: {
    deskripsi: string;
    alamatBalaiDesa: string;
    emailResmi: string;
    telepon: string;
    kodePos: string;
    kecamatan: string;
    kabupaten: string;
    provinsi: string;
  };
  sejarah: {
    ringkasan: string;
    linimasa: Array<{ tahun: string; peristiwa: string }>;
  };
  visiMisi: {
    visi: string;
    misi: string[];
  };
  geografisDemografi: {
    luasWilayah: string;
    ketinggian: string;
    topografi: string;
    jumlahPenduduk: string;
    jumlahKK: string;
    lakiLaki: string;
    perempuan: string;
    catatanSumber: string;
  };
  potensi: Array<{
    id: string;
    bidang: string;
    judul: string;
    deskripsi: string;
  }>;
  strukturOrganisasi: Array<{
    id: string;
    jabatan: string;
    nama: string;
    nipAtauKeterangan: string;
    urutan: number;
  }>;
}

export interface AdminUser {
  username: string;
  fullName: string;
  role: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  jabatan: string;
  hasAvatar: boolean;
  avatarUpdatedAt?: string;
}

export interface AdminAccountProfile extends AdminUser {
  pendingEmail: string | null;
  requireEmailLoginApproval: boolean;
  notifyOnLoginSuccess: boolean;
  notifyOnSecurityChange: boolean;
  loginApprovalTtlMinutes: number;
  approvalPolicy: 'new_device' | 'every_login';
  createdAt: string;
  updatedAt: string;
}

export interface TrustedDeviceItem {
  id: string;
  deviceLabel: string;
  ipAddress: string;
  locationEstimate: string;
  lastUsedAt: string;
  createdAt: string;
  isCurrentDevice: boolean;
}

export interface SecurityActivityItem {
  id: string;
  eventType: string;
  description: string;
  deviceLabel: string;
  ipAddress: string;
  locationEstimate: string;
  status: 'Berhasil' | 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Kedaluwarsa' | 'Peringatan';
  createdAt: string;
}

export type SecurityNotificationType =
  | 'login_attempt'
  | 'login_confirmation_request'
  | 'login_success'
  | 'login_denied'
  | 'profile_updated'
  | 'password_changed'
  | 'security_alert';

export interface SecurityNotificationItem {
  id: string;
  type: SecurityNotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  isRead: boolean;
  createdAt: string;
}

export interface SmtpStatusInfo {
  configured: boolean;
  hostLabel: string;
  port: number | null;
  fromAddress: string;
}

export interface EmailOutboxLogItem {
  id: string;
  recipientEmail: string;
  subject: string;
  category: string;
  deliveryMode: 'smtp' | 'local_preview';
  deliveryStatus: 'sent' | 'failed' | 'preview_only';
  errorMessage: string;
  previewHtml?: string;
  previewText?: string;
  createdAt: string;
}

export interface LoginChallengePendingInfo {
  status: 'confirmation_required';
  challengeId: string;
  pollSecret: string;
  expiresAt: number;
  ttlMinutes: number;
  maskedEmail: string;
  deviceLabel: string;
  locationEstimate: string;
  ipAddress: string;
  requestedAt: string;
  smtpConfigured: boolean;
  emailDeliveryStatus: 'sent' | 'failed' | 'preview_only';
}

export interface LoginConfirmationPreview {
  valid: boolean;
  reason?: string;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'completed';
  action: 'approve' | 'deny';
  username: string;
  deviceLabel: string;
  ipAddress: string;
  locationEstimate: string;
  requestedAt: string;
  expiresAt: number;
}

export type AppPage =
  | 'dashboard'
  | 'peta'
  | 'aset'
  | 'berita'
  | 'musrenbang'
  | 'profil';

export type ProfilSubmenu =
  | 'tentang'
  | 'sejarah'
  | 'visi-misi'
  | 'peta'
  | 'geografis-demografi'
  | 'potensi'
  | 'struktur';

