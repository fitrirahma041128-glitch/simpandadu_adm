import { useEffect, useMemo, useState } from 'react';
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
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Phone,
  Image as ImageIcon,
} from 'lucide-react';
import {
  PROPOSAL_CATEGORIES,
  PROPOSAL_PRIORITIES,
  PROPOSAL_STATUSES,
} from '../constants';
import { api } from '../lib/api';
import {
  exportProposalsToExcel,
  exportProposalsToPDF,
} from '../lib/exportUtils';
import { ConfirmModal } from './ConfirmModal';
import type {
  MusrenbangProposal,
  ProposalCategory,
  ProposalPriority,
  ProposalStatus,
} from '../types';

interface MusrenbangPageProps {
  proposals: MusrenbangProposal[];
  onProposalsChange: (next: MusrenbangProposal[]) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

interface ProposalFormState {
  namaPengusul: string;
  nomorHp: string;
  dusun: string;
  rtRw: string;
  judulUsulan: string;
  kategori: ProposalCategory;
  lokasi: string;
  tanggalPengajuan: string;
  prioritas: ProposalPriority;
  status: ProposalStatus;
  estimasiAnggaran: string;
  deskripsi: string;
  catatanVerifikasi: string;
  catatanUntukPengusul: string;
  dipublikasikan: boolean;
}

const EMPTY_FORM: ProposalFormState = {
  namaPengusul: '',
  nomorHp: '',
  dusun: '',
  rtRw: '',
  judulUsulan: '',
  kategori: 'Infrastruktur',
  lokasi: '',
  tanggalPengajuan: new Date().toISOString().slice(0, 10),
  prioritas: 'Sedang',
  status: 'Diajukan',
  estimasiAnggaran: '',
  deskripsi: '',
  catatanVerifikasi: '',
  catatanUntukPengusul: '',
  dipublikasikan: false,
};

const PAGE_SIZE = 8;

export function MusrenbangPage({
  proposals,
  onProposalsChange,
  onNotify,
}: MusrenbangPageProps) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'Semua' | 'Warga' | 'Admin'>('Semua');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MusrenbangProposal | null>(null);
  const [form, setForm] = useState<ProposalFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail & Verification state
  const [detailTarget, setDetailTarget] = useState<MusrenbangProposal | null>(null);
  const [detailPhotoBlobUrl, setDetailPhotoBlobUrl] = useState<string | null>(null);
  const [detailPhotoLoading, setDetailPhotoLoading] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<ProposalStatus>('Menunggu Verifikasi');
  const [verifyPriority, setVerifyPriority] = useState<ProposalPriority>('Sedang');
  const [verifyBudget, setVerifyBudget] = useState('');
  const [verifyNoteCitizen, setVerifyNoteCitizen] = useState('');
  const [verifyNoteInternal, setVerifyNoteInternal] = useState('');
  const [verifyPublished, setVerifyPublished] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MusrenbangProposal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sourceCounts = useMemo(() => {
    const warga = proposals.filter((p) => p.sumber === 'Warga').length;
    const admin = proposals.filter((p) => p.sumber !== 'Warga').length;
    return { total: proposals.length, warga, admin };
  }, [proposals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proposals.filter((item) => {
      const matchSearch =
        !q ||
        item.judulUsulan.toLowerCase().includes(q) ||
        item.namaPengusul.toLowerCase().includes(q) ||
        item.lokasi.toLowerCase().includes(q) ||
        item.nomorPengajuan.toLowerCase().includes(q);
      const matchSource =
        sourceFilter === 'Semua' ||
        (sourceFilter === 'Warga' ? item.sumber === 'Warga' : item.sumber !== 'Warga');
      const matchStatus =
        statusFilter === 'Semua' || item.status === statusFilter;
      const matchCategory =
        categoryFilter === 'Semua' || item.kategori === categoryFilter;
      return matchSearch && matchSource && matchStatus && matchCategory;
    });
  }, [proposals, search, sourceFilter, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Load protected citizen photo when Detail modal opens
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!detailTarget || !detailTarget.fotoUrl) {
      setDetailPhotoBlobUrl(null);
      setDetailPhotoLoading(false);
      return;
    }

    setDetailPhotoLoading(true);
    api
      .fetchProtectedPhotoBlobUrl(detailTarget.fotoUrl)
      .then((blobUrl) => {
        if (!active) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        createdUrl = blobUrl;
        setDetailPhotoBlobUrl(blobUrl);
      })
      .catch(() => {
        if (active) setDetailPhotoBlobUrl(null);
      })
      .finally(() => {
        if (active) setDetailPhotoLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [detailTarget]);

  const openDetailModal = (item: MusrenbangProposal) => {
    setDetailTarget(item);
    setVerifyStatus(item.status);
    setVerifyPriority(item.prioritas);
    setVerifyBudget(item.estimasiAnggaran || '');
    setVerifyNoteCitizen(item.catatanUntukPengusul || '');
    setVerifyNoteInternal(item.catatanVerifikasi || '');
    setVerifyPublished(Boolean(item.dipublikasikan));
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      tanggalPengajuan: new Date().toISOString().slice(0, 10),
    });
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (p: MusrenbangProposal) => {
    setEditing(p);
    setForm({
      namaPengusul: p.namaPengusul,
      nomorHp: p.nomorHp || '',
      dusun: p.dusun || '',
      rtRw: p.rtRw || '',
      judulUsulan: p.judulUsulan,
      kategori: p.kategori,
      lokasi: p.lokasi,
      tanggalPengajuan: p.tanggalPengajuan,
      prioritas: p.prioritas,
      status: p.status,
      estimasiAnggaran: p.estimasiAnggaran,
      deskripsi: p.deskripsi,
      catatanVerifikasi: p.catatanVerifikasi,
      catatanUntukPengusul: p.catatanUntukPengusul || '',
      dipublikasikan: Boolean(p.dipublikasikan),
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (
      !form.namaPengusul.trim() ||
      !form.judulUsulan.trim() ||
      !form.lokasi.trim()
    ) {
      setFormError('Nama pengusul, judul usulan, dan lokasi wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        namaPengusul: form.namaPengusul.trim(),
        nomorHp: form.nomorHp.trim() || undefined,
        dusun: form.dusun.trim() || undefined,
        rtRw: form.rtRw.trim() || undefined,
        judulUsulan: form.judulUsulan.trim(),
        kategori: form.kategori,
        lokasi: form.lokasi.trim(),
        tanggalPengajuan: form.tanggalPengajuan,
        prioritas: form.prioritas,
        status: form.status,
        estimasiAnggaran: form.estimasiAnggaran.trim() || 'Belum diestimasi',
        deskripsi: form.deskripsi.trim(),
        catatanVerifikasi: form.catatanVerifikasi.trim(),
        catatanUntukPengusul: form.catatanUntukPengusul.trim(),
        dipublikasikan: form.dipublikasikan,
      };

      if (editing) {
        const res = await api.updateProposal(editing.id, payload);
        onProposalsChange(
          proposals.map((p) => (p.id === editing.id ? res.proposal : p)),
        );
        onNotify(
          'success',
          'Usulan Diperbarui',
          `Usulan "${res.proposal.judulUsulan}" berhasil diperbarui.`,
        );
      } else {
        const res = await api.createProposal(payload);
        onProposalsChange([res.proposal, ...proposals]);
        setPage(1);
        onNotify(
          'success',
          'Usulan Musrenbang Ditambahkan',
          `Usulan "${res.proposal.judulUsulan}" berhasil dicatat (${res.proposal.nomorPengajuan}).`,
        );
      }
      setFormOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menyimpan usulan.';
      setFormError(msg);
      onNotify('error', 'Penyimpanan Gagal', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveVerification = async (overrideStatus?: ProposalStatus) => {
    if (!detailTarget) return;
    const targetStatus = overrideStatus || verifyStatus;
    if (targetStatus === 'Ditolak' && !verifyNoteCitizen.trim()) {
      onNotify(
        'error',
        'Alasan Penolakan Diperlukan',
        'Mohon isi catatan / alasan penolakan untuk pengusul sebelum menolak usulan.',
      );
      return;
    }

    setVerifying(true);
    try {
      const shouldPublish =
        (targetStatus === 'Disetujui' || targetStatus === 'Selesai') &&
        (overrideStatus === 'Disetujui' ? true : verifyPublished);

      const res = await api.updateProposal(detailTarget.id, {
        status: targetStatus,
        prioritas: verifyPriority,
        estimasiAnggaran: verifyBudget.trim() || detailTarget.estimasiAnggaran,
        catatanUntukPengusul: verifyNoteCitizen.trim(),
        catatanVerifikasi: verifyNoteInternal.trim(),
        dipublikasikan: shouldPublish,
      });

      onProposalsChange(
        proposals.map((p) => (p.id === detailTarget.id ? res.proposal : p)),
      );
      setDetailTarget(res.proposal);
      setVerifyStatus(res.proposal.status);
      setVerifyPublished(Boolean(res.proposal.dipublikasikan));
      onNotify(
        'success',
        'Verifikasi Usulan Disimpan',
        `Status usulan ${res.proposal.nomorPengajuan} diperbarui menjadi "${res.proposal.status}".`,
      );
    } catch (err) {
      onNotify(
        'error',
        'Gagal Memperbarui Verifikasi',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteProposal(deleteTarget.id);
      onProposalsChange(proposals.filter((p) => p.id !== deleteTarget.id));
      onNotify(
        'success',
        'Usulan Dihapus',
        `Usulan "${deleteTarget.judulUsulan}" telah dihapus.`,
      );
      setDeleteTarget(null);
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menghapus Usulan',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  };

  const statusTextClass = (status: ProposalStatus) => {
    switch (status) {
      case 'Disetujui':
      case 'Selesai':
        return 'text-emerald-700 font-semibold';
      case 'Dalam Pembahasan':
      case 'Menunggu Verifikasi':
        return 'text-[#1D4ED8] font-semibold';
      case 'Ditolak':
        return 'text-red-700 font-semibold';
      default:
        return 'text-amber-700 font-semibold';
    }
  };

  const priorityTextClass = (priority: ProposalPriority) => {
    if (priority === 'Tinggi') return 'text-red-700 font-semibold';
    if (priority === 'Sedang') return 'text-amber-700 font-medium';
    return 'text-slate-600 font-medium';
  };

  return (
    <div className="space-y-6">
      {/* Print Kop Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
        <h1 className="text-lg font-bold text-slate-900">
          PEMERINTAH DESA ADIMULYA — SIMPANDADU
        </h1>
        <p className="text-xs text-slate-700">
          Rekapitulasi Usulan Pembangunan Musrenbang Desa · Dicetak{' '}
          {new Date().toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Header */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1D3A]">
            Usulan Pembangunan Desa (Musrenbang)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Kelola dan verifikasi usulan yang masuk langsung dari masyarakat Desa Adimulya maupun input internal perangkat desa.
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
                await exportProposalsToExcel(filtered);
                onNotify(
                  'success',
                  'Export Excel Berhasil',
                  `${filtered.length} usulan Musrenbang diekspor ke file .xlsx.`,
                );
              } catch {
                onNotify(
                  'error',
                  'Export Excel Gagal',
                  'Terjadi kendala saat membuat file Excel.',
                );
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
              exportProposalsToPDF(filtered);
              onNotify(
                'success',
                'Export PDF Berhasil',
                `${filtered.length} usulan Musrenbang diekspor ke dokumen PDF.`,
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
            <span>Tambah Usulan</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="no-print space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          {(
            [
              ['Semua', `Semua Usulan (${sourceCounts.total})`],
              ['Warga', `Usulan Warga (${sourceCounts.warga})`],
              ['Admin', `Input Perangkat Desa (${sourceCounts.admin})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSourceFilter(key);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                sourceFilter === key
                  ? 'bg-[#0B1D3A] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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
              placeholder="Cari nomor pengajuan, judul, pengusul, atau lokasi..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3.5 pl-10 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <select
              aria-label="Filter status usulan"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="Semua">Semua Status Usulan</option>
              {PROPOSAL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filter kategori usulan"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="Semua">Semua Kategori</option>
              {PROPOSAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              {proposals.length === 0
                ? 'Belum Ada Usulan Musrenbang'
                : 'Usulan Tidak Ditemukan'}
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              {proposals.length === 0
                ? 'Tambahkan usulan pembangunan desa atau tunggu kiriman usulan dari warga.'
                : 'Tidak ada usulan yang cocok dengan pencarian atau filter yang dipilih.'}
            </p>
            <div className="mt-5 flex items-center gap-3">
              {proposals.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSourceFilter('Semua');
                    setStatusFilter('Semua');
                    setCategoryFilter('Semua');
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
                <span>Tambah Usulan</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="w-12 px-4 py-3 text-center">No</th>
                    <th className="px-4 py-3">Nomor &amp; Sumber</th>
                    <th className="px-4 py-3">Nama Pengusul</th>
                    <th className="px-4 py-3">Judul Usulan</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Lokasi</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Prioritas</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="no-print px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((item, idx) => {
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-slate-500">
                          {rowNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-mono text-xs font-semibold text-[#0B1D3A]">
                            {item.nomorPengajuan}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {item.sumber === 'Warga' ? 'Kiriman Warga' : 'Input Admin'}
                            {item.fotoUrl ? ' · Ada Foto' : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">
                            {item.namaPengusul}
                          </p>
                          {item.nomorHp && (
                            <p className="font-mono text-[11px] text-slate-500">
                              {item.nomorHp}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.judulUsulan}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {item.kategori}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <p>{item.lokasi}</p>
                          {(item.dusun || item.rtRw) && (
                            <p className="text-[11px] text-slate-500">
                              {[item.dusun, item.rtRw].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {item.tanggalPengajuan}
                        </td>
                        <td
                          className={`px-4 py-3 text-xs whitespace-nowrap ${priorityTextClass(
                            item.prioritas,
                          )}`}
                        >
                          {item.prioritas}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <p className={statusTextClass(item.status)}>
                            {item.status}
                          </p>
                          {item.dipublikasikan && (
                            <p className="text-[11px] text-slate-500">
                              Dipublikasikan
                            </p>
                          )}
                        </td>
                        <td className="no-print px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openDetailModal(item)}
                              title="Detail & Verifikasi usulan"
                              aria-label={`Detail dan verifikasi ${item.judulUsulan}`}
                              className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0B1D3A]"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit usulan"
                              aria-label={`Edit ${item.judulUsulan}`}
                              className="rounded-md p-1.5 text-blue-700 transition-colors hover:bg-blue-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Hapus usulan"
                              aria-label={`Hapus ${item.judulUsulan}`}
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
                {filtered.length} usulan
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

      {/* Add / Edit Proposal Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <h2 className="text-lg font-bold text-[#0B1D3A]">
                {editing
                  ? `Edit Usulan (${editing.nomorPengajuan})`
                  : 'Tambah Usulan Musrenbang Baru'}
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
                    Judul Usulan Pembangunan *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.judulUsulan}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        judulUsulan: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Pembangunan Drainase Lingkungan RW 02"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Nama Pengusul / Lembaga *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.namaPengusul}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        namaPengusul: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Ketua RW 02 / Nama Warga"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Nomor HP Pengusul (Khusus Admin)
                  </label>
                  <input
                    type="text"
                    value={form.nomorHp}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nomorHp: e.target.value }))
                    }
                    placeholder="08xxxxxxxxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Dusun
                  </label>
                  <input
                    type="text"
                    value={form.dusun}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dusun: e.target.value }))
                    }
                    placeholder="Contoh: Dusun I"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    RT / RW
                  </label>
                  <input
                    type="text"
                    value={form.rtRw}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, rtRw: e.target.value }))
                    }
                    placeholder="Contoh: RT 02 / RW 01"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Kategori Usulan *
                  </label>
                  <select
                    value={form.kategori}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        kategori: e.target.value as ProposalCategory,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {PROPOSAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Lokasi Kegiatan *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lokasi}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lokasi: e.target.value }))
                    }
                    placeholder="Contoh: Dusun II RT 04"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tanggal Pengajuan *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.tanggalPengajuan}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tanggalPengajuan: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tingkat Prioritas
                  </label>
                  <select
                    value={form.prioritas}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        prioritas: e.target.value as ProposalPriority,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {PROPOSAL_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Status Usulan
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value as ProposalStatus,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {PROPOSAL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Estimasi Anggaran
                  </label>
                  <input
                    type="text"
                    value={form.estimasiAnggaran}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        estimasiAnggaran: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Rp 85.000.000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Deskripsi &amp; Manfaat Usulan
                  </label>
                  <textarea
                    rows={3}
                    value={form.deskripsi}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        deskripsi: e.target.value,
                      }))
                    }
                    placeholder="Jelaskan urgensi, volume pekerjaan, dan penerima manfaat..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Catatan untuk Pengusul (Ditampilkan di Cek Status Warga)
                  </label>
                  <textarea
                    rows={2}
                    value={form.catatanUntukPengusul}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        catatanUntukPengusul: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Disetujui untuk masuk RKPDes atau alasan penolakan..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Catatan Verifikasi Internal Perangkat Desa
                  </label>
                  <textarea
                    rows={2}
                    value={form.catatanVerifikasi}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        catatanVerifikasi: e.target.value,
                      }))
                    }
                    placeholder="Catatan hasil survei lapangan atau pembahasan internal..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.dipublikasikan}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          dipublikasikan: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#1D4ED8]"
                    />
                    <span>
                      Publikasikan ke halaman publik warga apabila status Disetujui atau Selesai
                    </span>
                  </label>
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
                    : editing
                      ? 'Simpan Perubahan'
                      : 'Simpan Usulan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail & Verifikasi Modal */}
      {detailTarget && (
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <p className="font-mono text-xs font-semibold text-[#1E40AF]">
                  {detailTarget.nomorPengajuan} ·{' '}
                  {detailTarget.sumber === 'Warga'
                    ? 'Pengajuan Masyarakat'
                    : 'Input Perangkat Desa'}
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#0B1D3A]">
                  {detailTarget.judulUsulan}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Citizen Identity & Proposal Info */}
              <div className="space-y-4 lg:col-span-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <p className="text-xs font-bold tracking-wide text-[#0B1D3A] uppercase">
                    Identitas Pengusul (Khusus Admin)
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {detailTarget.namaPengusul}
                  </p>
                  {detailTarget.nomorHp && (
                    <p className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      {detailTarget.nomorHp}
                    </p>
                  )}
                  <p className="text-xs text-slate-600">
                    {[detailTarget.dusun, detailTarget.rtRw]
                      .filter(Boolean)
                      .join(' · ') || 'Wilayah belum dirinci'}
                  </p>
                </div>

                <dl className="space-y-2.5 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-slate-500">Kategori</dt>
                      <dd className="font-medium text-slate-900">
                        {detailTarget.kategori}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Tanggal Pengajuan
                      </dt>
                      <dd className="font-mono text-xs tabular-nums text-slate-900">
                        {detailTarget.tanggalPengajuan}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Lokasi Kegiatan</dt>
                    <dd className="text-slate-900">{detailTarget.lokasi}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">
                      Alasan &amp; Penjelasan Usulan
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-slate-700">
                      {detailTarget.deskripsi || '-'}
                    </dd>
                  </div>
                </dl>

                {/* Location Photo Preview */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-600">
                    Foto Kondisi Lokasi
                  </p>
                  {detailPhotoLoading ? (
                    <div className="h-44 animate-pulse rounded-lg bg-slate-200" />
                  ) : detailPhotoBlobUrl ? (
                    <img
                      src={detailPhotoBlobUrl}
                      alt="Foto kondisi lokasi dari pengusul"
                      className="max-h-60 w-full rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                      <ImageIcon className="h-5 w-5" />
                      <span className="mt-1">Tidak ada foto terlampir</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Admin Verification & Status Controls */}
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-6">
                <h3 className="text-sm font-bold text-[#0B1D3A]">
                  Verifikasi &amp; Keputusan Admin Desa
                </h3>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleSaveVerification('Disetujui')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Setujui Usulan</span>
                  </button>
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => handleSaveVerification('Ditolak')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Tolak Usulan</span>
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Ubah Status Tahapan
                  </label>
                  <select
                    value={verifyStatus}
                    onChange={(e) =>
                      setVerifyStatus(e.target.value as ProposalStatus)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  >
                    {PROPOSAL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Prioritas
                    </label>
                    <select
                      value={verifyPriority}
                      onChange={(e) =>
                        setVerifyPriority(e.target.value as ProposalPriority)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                    >
                      {PROPOSAL_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Estimasi Anggaran
                    </label>
                    <input
                      type="text"
                      value={verifyBudget}
                      onChange={(e) => setVerifyBudget(e.target.value)}
                      placeholder="Rp ..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Catatan / Alasan untuk Pengusul (Terlihat saat Cek Status)
                  </label>
                  <textarea
                    rows={3}
                    value={verifyNoteCitizen}
                    onChange={(e) => setVerifyNoteCitizen(e.target.value)}
                    placeholder="Berikan catatan perkembangan, persetujuan, atau alasan penolakan yang jelas untuk warga..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Catatan Verifikasi Internal
                  </label>
                  <textarea
                    rows={2}
                    value={verifyNoteInternal}
                    onChange={(e) => setVerifyNoteInternal(e.target.value)}
                    placeholder="Catatan internal hasil peninjauan tim desa..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={verifyPublished}
                    onChange={(e) => setVerifyPublished(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span>
                    <strong>Publikasikan ke Halaman Warga</strong> — hanya berlaku saat status{' '}
                    <strong>Disetujui</strong> atau <strong>Selesai</strong> (identitas pengusul tetap dirahasiakan).
                  </span>
                </label>

                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => handleSaveVerification()}
                  className="w-full rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-50"
                >
                  {verifying
                    ? 'Menyimpan Keputusan...'
                    : 'Simpan Verifikasi & Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Konfirmasi Penghapusan Usulan"
        description={`Apakah Anda yakin ingin menghapus usulan "${deleteTarget?.judulUsulan || ''}"?`}
        confirmLabel="Ya, Hapus Usulan"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
