import type {
  AssetCategory,
  AssetCondition,
  NewsCategory,
  ProposalCategory,
  ProposalPriority,
  ProposalStatus,
} from './types';

export const ASSET_CATEGORIES: AssetCategory[] = [
  'Tanah Desa',
  'Bangunan',
  'Infrastruktur',
  'Kendaraan',
  'Peralatan',
  'Fasilitas Umum',
  'Pertanian',
  'Jaringan',
  'Konservasi',
  'Lainnya',
];

export const ASSET_CONDITIONS: AssetCondition[] = [
  'Baik',
  'Perlu Perbaikan',
  'Rusak Berat',
];

export const PROPOSAL_CATEGORIES: ProposalCategory[] = [
  'Infrastruktur',
  'Pendidikan',
  'Kesehatan',
  'Ekonomi',
  'Pertanian',
  'Sarana dan Prasarana',
  'Lingkungan',
];

export const PROPOSAL_PRIORITIES: ProposalPriority[] = [
  'Tinggi',
  'Sedang',
  'Rendah',
];

export const PROPOSAL_STATUSES: ProposalStatus[] = [
  'Diajukan',
  'Menunggu Verifikasi',
  'Dalam Pembahasan',
  'Disetujui',
  'Ditolak',
  'Selesai',
];

export const NEWS_CATEGORIES: NewsCategory[] = [
  'Semua Berita',
  'Nasional',
  'Daerah',
  'Politik',
  'Ekonomi',
  'Teknologi',
  'Pendidikan',
  'Kesehatan',
  'Olahraga',
  'Lingkungan',
];

export const ASSET_IMAGES = {
  logo: '/src/assets/images/logo_desa_adimulya_1795762867118.jpg',
  balaiDesa: '/src/assets/images/balai_desa_adimulya_1795762867405.jpg',
  pertanian: '/src/assets/images/potensi_desa_pertanian_1795762867749.jpg',
  loginBackdrop: '/src/assets/images/login_backdrop_desa_1795762868618.jpg',
};
