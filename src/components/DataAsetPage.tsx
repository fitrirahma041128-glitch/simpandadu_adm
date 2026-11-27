import { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  FileText,
  Eye,
  Pencil,
  Trash2,
  X,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ASSET_CATEGORIES, ASSET_CONDITIONS } from '../constants';
import { api } from '../lib/api';
import { exportAssetsToExcel, exportAssetsToPDF } from '../lib/exportUtils';
import { ConfirmModal } from './ConfirmModal';
import type {
  AssetCategory,
  AssetCondition,
  VillageAsset,
} from '../types';

interface DataAsetPageProps {
  assets: VillageAsset[];
  onAssetsChange: (next: VillageAsset[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

interface AssetFormState {
  nama: string;
  kategori: AssetCategory;
  lokasi: string;
  tahunPerolehan: string;
  jumlah: string;
  satuan: string;
  kondisi: AssetCondition;
  keterangan: string;
  lat: string;
  lng: string;
}

const EMPTY_FORM: AssetFormState = {
  nama: '',
  kategori: 'Bangunan',
  lokasi: '',
  tahunPerolehan: String(new Date().getFullYear()),
  jumlah: '1',
  satuan: 'Unit',
  kondisi: 'Baik',
  keterangan: '',
  lat: '',
  lng: '',
};

const PAGE_SIZE = 8;

export function DataAsetPage({
  assets,
  onAssetsChange,
  onNotify,
}: DataAsetPageProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [conditionFilter, setConditionFilter] = useState<string>('Semua');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<VillageAsset | null>(null);
  const [form, setForm] = useState<AssetFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detailAsset, setDetailAsset] = useState<VillageAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VillageAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((item) => {
      const matchSearch =
        !q ||
        item.nama.toLowerCase().includes(q) ||
        item.lokasi.toLowerCase().includes(q) ||
        item.keterangan.toLowerCase().includes(q);
      const matchCategory =
        categoryFilter === 'Semua' || item.kategori === categoryFilter;
      const matchCondition =
        conditionFilter === 'Semua' || item.kondisi === conditionFilter;
      return matchSearch && matchCategory && matchCondition;
    });
  }, [assets, search, categoryFilter, conditionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const openCreateModal = () => {
    setEditingAsset(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (asset: VillageAsset) => {
    setEditingAsset(asset);
    setForm({
      nama: asset.nama,
      kategori: asset.kategori,
      lokasi: asset.lokasi,
      tahunPerolehan: String(asset.tahunPerolehan),
      jumlah: String(asset.jumlah),
      satuan: asset.satuan || 'Unit',
      kondisi: asset.kondisi,
      keterangan: asset.keterangan,
      lat: asset.koordinat.lat !== null ? String(asset.koordinat.lat) : '',
      lng: asset.koordinat.lng !== null ? String(asset.koordinat.lng) : '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nama = form.nama.trim();
    const lokasi = form.lokasi.trim();
    const tahun = Number(form.tahunPerolehan);
    const jumlah = Number(form.jumlah);

    if (!nama || !lokasi) {
      setFormError('Nama aset dan lokasi wajib diisi.');
      return;
    }
    if (!Number.isFinite(tahun) || tahun < 1945 || tahun > 2100) {
      setFormError('Tahun perolehan harus antara 1945 hingga 2100.');
      return;
    }
    if (!Number.isFinite(jumlah) || jumlah < 1) {
      setFormError('Jumlah aset minimal 1.');
      return;
    }

    const latVal = form.lat.trim() ? Number(form.lat.trim()) : null;
    const lngVal = form.lng.trim() ? Number(form.lng.trim()) : null;
    if (
      (latVal !== null && (!Number.isFinite(latVal) || latVal < -90 || latVal > 90)) ||
      (lngVal !== null && (!Number.isFinite(lngVal) || lngVal < -180 || lngVal > 180))
    ) {
      setFormError('Koordinat Latitude/Longitude tidak valid.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nama,
        kategori: form.kategori,
        lokasi,
        tahunPerolehan: tahun,
        jumlah,
        satuan: form.satuan.trim() || 'Unit',
        kondisi: form.kondisi,
        keterangan: form.keterangan.trim(),
        koordinat: { lat: latVal, lng: lngVal },
      };

      if (editingAsset) {
        const res = await api.updateAsset(editingAsset.id, payload);
        onAssetsChange(
          assets.map((a) => (a.id === editingAsset.id ? res.asset : a)),
        );
        onNotify(
          'success',
          'Aset Diperbarui',
          `Data "${res.asset.nama}" berhasil disimpan.`,
        );
      } else {
        const res = await api.createAsset(payload);
        onAssetsChange([res.asset, ...assets]);
        setPage(1);
        onNotify(
          'success',
          'Aset Ditambahkan',
          `Data "${res.asset.nama}" berhasil ditambahkan ke inventaris.`,
        );
      }
      setFormOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menyimpan data aset.';
      setFormError(msg);
      onNotify('error', 'Penyimpanan Gagal', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteAsset(deleteTarget.id);
      onAssetsChange(assets.filter((a) => a.id !== deleteTarget.id));
      onNotify(
        'success',
        'Aset Dihapus',
        `Data "${deleteTarget.nama}" telah dihapus dari inventaris.`,
      );
      setDeleteTarget(null);
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menghapus Aset',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  };

  const conditionTextClass = (kondisi: AssetCondition) => {
    if (kondisi === 'Baik') return 'text-emerald-700 font-semibold';
    if (kondisi === 'Perlu Perbaikan') return 'text-amber-700 font-semibold';
    return 'text-red-700 font-semibold';
  };

  return (
    <div className="space-y-6">
      {/* Print Kop Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <h1 className="text-lg font-bold text-slate-900">
          PEMERINTAH DESA ADIMULYA — SIMPANDADU
        </h1>
        <p className="text-xs text-slate-700">
          Laporan Inventaris Data Aset Desa · Dicetak{' '}
          {new Date().toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Header & Action Bar */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1D3A]">
            Inventaris Data Aset Desa Adimulya
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kelola catatan barang milik desa, kondisi fisik, dan sebaran lokasi aset secara permanen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak Laporan</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await exportAssetsToExcel(filtered);
                onNotify(
                  'success',
                  'Export Excel Berhasil',
                  `${filtered.length} baris data aset diekspor ke file .xlsx.`,
                );
              } catch {
                onNotify('error', 'Export Excel Gagal', 'Terjadi kendala saat membuat file Excel.');
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={() => {
              exportAssetsToPDF(filtered);
              onNotify(
                'success',
                'Export PDF Berhasil',
                `${filtered.length} baris data aset diekspor ke dokumen PDF.`,
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-700/30 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-100 whitespace-nowrap"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Aset</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="no-print rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama aset, lokasi, atau keterangan..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3.5 pl-10 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <select
              aria-label="Filter kategori aset"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="Semua">Semua Kategori Aset</option>
              {ASSET_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter kondisi aset"
              value={conditionFilter}
              onChange={(e) => {
                setConditionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="Semua">Semua Kondisi</option>
              {ASSET_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <PackageOpen className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              {assets.length === 0
                ? 'Belum Ada Data Aset Desa'
                : 'Data Aset Tidak Ditemukan'}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {assets.length === 0
                ? 'Mulai catat inventaris aset Desa Adimulya dengan menekan tombol Tambah Aset.'
                : 'Tidak ada aset yang sesuai dengan kata kunci pencarian atau filter kategori yang dipilih.'}
            </p>
            <div className="mt-5 flex items-center gap-3">
              {assets.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('Semua');
                    setConditionFilter('Semua');
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Filter
                </button>
              )}
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Aset</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 text-center w-12">No</th>
                    <th className="px-4 py-3">Nama Aset</th>
                    <th className="px-4 py-3">Kategori Aset</th>
                    <th className="px-4 py-3">Lokasi</th>
                    <th className="px-4 py-3 text-right">Tahun</th>
                    <th className="px-4 py-3 text-right">Jumlah</th>
                    <th className="px-4 py-3">Kondisi</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="no-print px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((asset, idx) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr
                        key={asset.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-slate-500">
                          {rowNumber}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {asset.nama}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {asset.kategori}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {asset.lokasi}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-700">
                          {asset.tahunPerolehan}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-800 whitespace-nowrap">
                          {asset.jumlah} {asset.satuan}
                        </td>
                        <td
                          className={`px-4 py-3 text-xs whitespace-nowrap ${conditionTextClass(
                            asset.kondisi,
                          )}`}
                        >
                          {asset.kondisi}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-600">
                          {asset.keterangan || '-'}
                        </td>
                        <td className="no-print px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailAsset(asset)}
                              title="Detail aset"
                              aria-label={`Detail ${asset.nama}`}
                              className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0B1D3A]"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(asset)}
                              title="Edit aset"
                              aria-label={`Edit ${asset.nama}`}
                              className="rounded-md p-1.5 text-blue-700 transition-colors hover:bg-blue-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(asset)}
                              title="Hapus aset"
                              aria-label={`Hapus ${asset.nama}`}
                              className="rounded-md p-1.5 text-red-700 transition-colors hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
              <p className="tabular-nums">
                Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} dari{' '}
                {filtered.length} aset
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Sebelumnya</span>
                </button>
                <span className="px-2 font-mono tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Asset Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <h2 className="text-lg font-bold text-[#0B1D3A]">
                {editingAsset ? 'Edit Data Aset Desa' : 'Tambah Aset Desa Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Nama Aset *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nama}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nama: e.target.value }))
                    }
                    placeholder="Contoh: Gedung Posyandu Dusun I"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Kategori Aset *
                  </label>
                  <select
                    value={form.kategori}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        kategori: e.target.value as AssetCategory,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {ASSET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Kondisi Aset *
                  </label>
                  <select
                    value={form.kondisi}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        kondisi: e.target.value as AssetCondition,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {ASSET_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Lokasi / Dusun *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lokasi}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lokasi: e.target.value }))
                    }
                    placeholder="Contoh: Dusun I RT 02 / RW 01"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tahun Perolehan *
                  </label>
                  <input
                    type="number"
                    required
                    min={1945}
                    max={2100}
                    value={form.tahunPerolehan}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tahunPerolehan: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Jumlah *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={form.jumlah}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, jumlah: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Satuan
                    </label>
                    <input
                      type="text"
                      value={form.satuan}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, satuan: e.target.value }))
                      }
                      placeholder="Unit / Bidang / Meter"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Latitude Resmi (Opsional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lat: e.target.value }))
                    }
                    placeholder="-7.xxxxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Longitude Resmi (Opsional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lng: e.target.value }))
                    }
                    placeholder="109.xxxxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Keterangan Tambahan
                  </label>
                  <textarea
                    rows={3}
                    value={form.keterangan}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        keterangan: e.target.value,
                      }))
                    }
                    placeholder="Catatan kondisi fisik, nomor sertifikat, atau spesifikasi aset..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  {submitting
                    ? 'Menyimpan...'
                    : editingAsset
                      ? 'Simpan Perubahan'
                      : 'Simpan Aset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Asset Modal */}
      {detailAsset && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-[#0B1D3A]">
                Rincian Inventaris Aset
              </h2>
              <button
                type="button"
                onClick={() => setDetailAsset(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Nama Aset</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {detailAsset.nama}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Kategori</dt>
                  <dd className="mt-0.5 text-slate-900">{detailAsset.kategori}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Kondisi</dt>
                  <dd className={`mt-0.5 ${conditionTextClass(detailAsset.kondisi)}`}>
                    {detailAsset.kondisi}
                  </dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Tahun Perolehan
                  </dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                    {detailAsset.tahunPerolehan}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Jumlah</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-slate-900">
                    {detailAsset.jumlah} {detailAsset.satuan}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Lokasi</dt>
                <dd className="mt-0.5 text-slate-900">{detailAsset.lokasi}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Koordinat GPS Resmi
                </dt>
                <dd className="mt-0.5 font-mono text-xs tabular-nums text-slate-700">
                  {detailAsset.koordinat.lat !== null &&
                  detailAsset.koordinat.lng !== null
                    ? `${detailAsset.koordinat.lat}, ${detailAsset.koordinat.lng}`
                    : 'Belum diisi'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Keterangan</dt>
                <dd className="mt-0.5 leading-relaxed text-slate-700">
                  {detailAsset.keterangan || '-'}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = detailAsset;
                  setDetailAsset(null);
                  openEditModal(target);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit Aset
              </button>
              <button
                type="button"
                onClick={() => setDetailAsset(null)}
                className="rounded-lg bg-[#0B1D3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Konfirmasi Penghapusan Aset"
        description={`Apakah Anda yakin ingin menghapus data aset "${deleteTarget?.nama || ''}" secara permanen dari inventaris Desa Adimulya?`}
        confirmLabel="Ya, Hapus Aset"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
