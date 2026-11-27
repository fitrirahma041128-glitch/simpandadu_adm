import writeXlsxFile, { type Column } from 'write-excel-file/browser';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MusrenbangProposal, VillageAsset } from '../types';

function formatDateId(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

interface AssetExportRow {
  no: number;
  nama: string;
  kategori: string;
  lokasi: string;
  tahunPerolehan: number;
  jumlah: number;
  satuan: string;
  kondisi: string;
  koordinat: string;
  keterangan: string;
}

export async function exportAssetsToExcel(assets: VillageAsset[]): Promise<void> {
  const rows: AssetExportRow[] = assets.map((item, idx) => ({
    no: idx + 1,
    nama: item.nama,
    kategori: item.kategori,
    lokasi: item.lokasi,
    tahunPerolehan: item.tahunPerolehan,
    jumlah: item.jumlah,
    satuan: item.satuan,
    kondisi: item.kondisi,
    koordinat:
      item.koordinat.lat !== null && item.koordinat.lng !== null
        ? `${item.koordinat.lat}, ${item.koordinat.lng}`
        : 'Belum diisi',
    keterangan: item.keterangan || '-',
  }));

  const columns: Column<AssetExportRow>[] = [
    { header: { value: 'No', fontWeight: 'bold' }, width: 6, cell: (r) => ({ type: Number, value: r.no }) },
    { header: { value: 'Nama Aset', fontWeight: 'bold' }, width: 32, cell: (r) => ({ type: String, value: r.nama }) },
    { header: { value: 'Kategori Aset', fontWeight: 'bold' }, width: 18, cell: (r) => ({ type: String, value: r.kategori }) },
    { header: { value: 'Lokasi', fontWeight: 'bold' }, width: 24, cell: (r) => ({ type: String, value: r.lokasi }) },
    { header: { value: 'Tahun Perolehan', fontWeight: 'bold' }, width: 16, cell: (r) => ({ type: Number, value: r.tahunPerolehan }) },
    { header: { value: 'Jumlah', fontWeight: 'bold' }, width: 10, cell: (r) => ({ type: Number, value: r.jumlah }) },
    { header: { value: 'Satuan', fontWeight: 'bold' }, width: 12, cell: (r) => ({ type: String, value: r.satuan }) },
    { header: { value: 'Kondisi', fontWeight: 'bold' }, width: 18, cell: (r) => ({ type: String, value: r.kondisi }) },
    { header: { value: 'Koordinat', fontWeight: 'bold' }, width: 22, cell: (r) => ({ type: String, value: r.koordinat }) },
    { header: { value: 'Keterangan', fontWeight: 'bold' }, width: 34, cell: (r) => ({ type: String, value: r.keterangan }) },
  ];

  await writeXlsxFile(rows, {
    columns,
    sheet: 'Data Aset Desa',
  }).toFile(
    `Laporan_Aset_Desa_Adimulya_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export function exportAssetsToPDF(assets: VillageAsset[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.text('PEMERINTAH DESA ADIMULYA — SIMPANDADU', 14, 15);
  doc.setFontSize(10);
  doc.text(
    `Laporan Inventaris Data Aset Desa | Dicetak: ${formatDateId(new Date())}`,
    14,
    21,
  );

  autoTable(doc, {
    startY: 26,
    head: [
      [
        'No',
        'Nama Aset',
        'Kategori',
        'Lokasi',
        'Tahun',
        'Jumlah',
        'Kondisi',
        'Keterangan',
      ],
    ],
    body: assets.map((item, idx) => [
      idx + 1,
      item.nama,
      item.kategori,
      item.lokasi,
      item.tahunPerolehan,
      `${item.jumlah} ${item.satuan}`,
      item.kondisi,
      item.keterangan || '-',
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [11, 29, 58], textColor: 255 },
  });

  doc.save(
    `Laporan_Aset_Desa_Adimulya_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

interface ProposalExportRow {
  no: number;
  nomorPengajuan: string;
  sumber: string;
  namaPengusul: string;
  nomorHp: string;
  dusun: string;
  rtRw: string;
  judulUsulan: string;
  kategori: string;
  lokasi: string;
  tanggalPengajuan: string;
  prioritas: string;
  status: string;
  estimasiAnggaran: string;
  deskripsi: string;
  catatanUntukPengusul: string;
}

export async function exportProposalsToExcel(
  proposals: MusrenbangProposal[],
): Promise<void> {
  const rows: ProposalExportRow[] = proposals.map((item, idx) => ({
    no: idx + 1,
    nomorPengajuan: item.nomorPengajuan,
    sumber: item.sumber || 'Admin',
    namaPengusul: item.namaPengusul,
    nomorHp: item.nomorHp || '-',
    dusun: item.dusun || '-',
    rtRw: item.rtRw || '-',
    judulUsulan: item.judulUsulan,
    kategori: item.kategori,
    lokasi: item.lokasi,
    tanggalPengajuan: item.tanggalPengajuan,
    prioritas: item.prioritas,
    status: item.status,
    estimasiAnggaran: item.estimasiAnggaran,
    deskripsi: item.deskripsi || '-',
    catatanUntukPengusul: item.catatanUntukPengusul || '-',
  }));

  const columns: Column<ProposalExportRow>[] = [
    { header: { value: 'No', fontWeight: 'bold' }, width: 6, cell: (r) => ({ type: Number, value: r.no }) },
    { header: { value: 'Nomor Pengajuan', fontWeight: 'bold' }, width: 18, cell: (r) => ({ type: String, value: r.nomorPengajuan }) },
    { header: { value: 'Sumber', fontWeight: 'bold' }, width: 10, cell: (r) => ({ type: String, value: r.sumber }) },
    { header: { value: 'Nama Pengusul', fontWeight: 'bold' }, width: 24, cell: (r) => ({ type: String, value: r.namaPengusul }) },
    { header: { value: 'No. HP', fontWeight: 'bold' }, width: 16, cell: (r) => ({ type: String, value: r.nomorHp }) },
    { header: { value: 'Dusun', fontWeight: 'bold' }, width: 16, cell: (r) => ({ type: String, value: r.dusun }) },
    { header: { value: 'RT/RW', fontWeight: 'bold' }, width: 14, cell: (r) => ({ type: String, value: r.rtRw }) },
    { header: { value: 'Judul Usulan', fontWeight: 'bold' }, width: 34, cell: (r) => ({ type: String, value: r.judulUsulan }) },
    { header: { value: 'Kategori', fontWeight: 'bold' }, width: 20, cell: (r) => ({ type: String, value: r.kategori }) },
    { header: { value: 'Lokasi', fontWeight: 'bold' }, width: 22, cell: (r) => ({ type: String, value: r.lokasi }) },
    { header: { value: 'Tanggal Pengajuan', fontWeight: 'bold' }, width: 16, cell: (r) => ({ type: String, value: r.tanggalPengajuan }) },
    { header: { value: 'Prioritas', fontWeight: 'bold' }, width: 12, cell: (r) => ({ type: String, value: r.prioritas }) },
    { header: { value: 'Status', fontWeight: 'bold' }, width: 20, cell: (r) => ({ type: String, value: r.status }) },
    { header: { value: 'Estimasi Anggaran', fontWeight: 'bold' }, width: 18, cell: (r) => ({ type: String, value: r.estimasiAnggaran }) },
    { header: { value: 'Deskripsi', fontWeight: 'bold' }, width: 36, cell: (r) => ({ type: String, value: r.deskripsi }) },
    { header: { value: 'Catatan Pengusul', fontWeight: 'bold' }, width: 32, cell: (r) => ({ type: String, value: r.catatanUntukPengusul }) },
  ];

  await writeXlsxFile(rows, {
    columns,
    sheet: 'Usulan Musrenbang',
  }).toFile(
    `Laporan_Musrenbang_Adimulya_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export function exportProposalsToPDF(proposals: MusrenbangProposal[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.text('PEMERINTAH DESA ADIMULYA — SIMPANDADU', 14, 15);
  doc.setFontSize(10);
  doc.text(
    `Rekapitulasi Usulan Pembangunan Musrenbang Desa | Dicetak: ${formatDateId(new Date())}`,
    14,
    21,
  );

  autoTable(doc, {
    startY: 26,
    head: [
      [
        'No',
        'No. Pengajuan',
        'Sumber',
        'Nama Pengusul',
        'Judul Usulan',
        'Kategori',
        'Lokasi',
        'Tanggal',
        'Prioritas',
        'Status',
      ],
    ],
    body: proposals.map((item, idx) => [
      idx + 1,
      item.nomorPengajuan,
      item.sumber || 'Admin',
      item.namaPengusul,
      item.judulUsulan,
      item.kategori,
      item.lokasi,
      item.tanggalPengajuan,
      item.prioritas,
      item.status,
    ]),
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [11, 29, 58], textColor: 255 },
  });

  doc.save(
    `Laporan_Musrenbang_Adimulya_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
