import { useEffect, useMemo, useState } from 'react';
import {
  Send,
  Search,
  CheckCircle2,
  ClipboardCheck,
  Upload,
  X,
  Copy,
  ShieldCheck,
  LogIn,
  FileCheck2,
  MapPin,
  Clock,
  Info,
} from 'lucide-react';
import { ASSET_IMAGES, PROPOSAL_CATEGORIES } from '../constants';
import { api } from '../lib/api';
import type {
  ProposalCategory,
  ProposalStatus,
  PublicApprovedProposal,
  PublicProposalStatusItem,
} from '../types';

type CitizenTab = 'ajukan' | 'cek-status' | 'disetujui';

interface CitizenMusrenbangPortalProps {
  onGoToAdminLogin: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

const DEFAULT_DUSUN_FALLBACK = [
  { id: 'dsn-1', nama: 'Dusun I' },
  { id: 'dsn-2', nama: 'Dusun II' },
  { id: 'dsn-3', nama: 'Dusun III' },
];

export function CitizenMusrenbangPortal({
  onGoToAdminLogin,
  onNotify,
}: CitizenMusrenbangPortalProps) {
  const [activeTab, setActiveTab] = useState<CitizenTab>('ajukan');
  const [logoError, setLogoError] = useState(false);

  // Dusun list from server
  const [dusunList, setDusunList] = useState<Array<{ id: string; nama: string }>>(
    DEFAULT_DUSUN_FALLBACK,
  );

  // Form state
  const [namaPengusul, setNamaPengusul] = useState('');
  const [nomorHp, setNomorHp] = useState('');
  const [dusun, setDusun] = useState('');
  const [rtRw, setRtRw] = useState('');
  const [kategori, setKategori] = useState<ProposalCategory>('Infrastruktur');
  const [judulUsulan, setJudulUsulan] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [fotoFileName, setFotoFileName] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    nomorPengajuan: string;
    proposal: PublicProposalStatusItem;
  } | null>(null);

  // Status checker state
  const [lookupNomor, setLookupNomor] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] =
    useState<PublicProposalStatusItem | null>(null);

  // Public approved proposals state
  const [approvedList, setApprovedList] = useState<PublicApprovedProposal[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedSearch, setApprovedSearch] = useState('');
  const [approvedCategory, setApprovedCategory] = useState('Semua');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.getPublicDusun();
        if (active && res.dusunList.length > 0) {
          setDusunList(res.dusunList);
          setDusun((prev) => prev || res.dusunList[0].nama);
        }
      } catch {
        setDusun((prev) => prev || DEFAULT_DUSUN_FALLBACK[0].nama);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadApprovedProposals = async () => {
    setApprovedLoading(true);
    try {
      const res = await api.fetchPublicApprovedProposals();
      setApprovedList(res.proposals);
    } catch {
      onNotify(
        'error',
        'Gagal Memuat Daftar Usulan',
        'Terjadi kendala saat mengambil daftar usulan yang disetujui.',
      );
    } finally {
      setApprovedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'disetujui') {
      void loadApprovedProposals();
    }
  }, [activeTab]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onNotify(
        'error',
        'Format Foto Tidak Sesuai',
        'Pilih foto dengan format JPG, PNG, atau WebP.',
      );
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onNotify(
        'error',
        'Ukuran Foto Terlalu Besar',
        'Ukuran maksimal foto kondisi lokasi adalah 2 MB.',
      );
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFotoDataUrl(reader.result);
        setFotoFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanNama = namaPengusul.trim();
    const cleanHp = nomorHp.trim().replace(/[\s-]/g, '');
    const cleanDusun = dusun.trim();
    const cleanRtRw = rtRw.trim();
    const cleanJudul = judulUsulan.trim();
    const cleanLokasi = lokasi.trim();
    const cleanDeskripsi = deskripsi.trim();

    if (cleanNama.length < 2) {
      setFormError('Mohon isi nama lengkap Anda (minimal 2 huruf).');
      return;
    }
    if (!/^(\+62|62|0)8[0-9]{7,13}$/.test(cleanHp)) {
      setFormError(
        'Mohon isi nomor HP yang aktif (contoh: 081234567890).',
      );
      return;
    }
    if (!cleanDusun || !cleanRtRw) {
      setFormError('Mohon pilih dusun dan isi RT/RW Anda.');
      return;
    }
    if (cleanJudul.length < 5) {
      setFormError('Mohon tulis judul usulan secara singkat dan jelas.');
      return;
    }
    if (!cleanLokasi) {
      setFormError('Mohon isi lokasi kegiatan usulan.');
      return;
    }
    if (cleanDeskripsi.length < 10) {
      setFormError(
        'Mohon jelaskan alasan dan manfaat usulan minimal 10 karakter.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitPublicProposal({
        namaPengusul: cleanNama,
        nomorHp: cleanHp,
        dusun: cleanDusun,
        rtRw: cleanRtRw,
        kategori,
        judulUsulan: cleanJudul,
        lokasi: cleanLokasi,
        deskripsi: cleanDeskripsi,
        fotoDataUrl,
      });

      setSubmittedReceipt(res);
      setNamaPengusul('');
      setNomorHp('');
      setRtRw('');
      setJudulUsulan('');
      setLokasi('');
      setDeskripsi('');
      setFotoDataUrl(null);
      setFotoFileName('');
      onNotify(
        'success',
        'Usulan Berhasil Dikirim',
        `Nomor pengajuan Anda: ${res.nomorPengajuan}. Simpan nomor ini untuk cek status.`,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal mengirim usulan.';
      setFormError(msg);
      onNotify('error', 'Pengiriman Gagal', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const runStatusCheck = async (nomorToCheck: string) => {
    const cleaned = nomorToCheck.trim().toUpperCase();
    if (!cleaned) {
      setLookupError('Masukkan nomor pengajuan Anda terlebih dahulu.');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const res = await api.checkPublicProposalStatus(cleaned);
      setLookupResult(res.proposal);
    } catch (err) {
      setLookupResult(null);
      setLookupError(
        err instanceof Error
          ? err.message
          : 'Nomor pengajuan tidak ditemukan.',
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCopyNomor = async (nomor: string) => {
    try {
      await navigator.clipboard.writeText(nomor);
      onNotify('success', 'Nomor Disalin', `Nomor ${nomor} telah disalin.`);
    } catch {
      onNotify('info', 'Nomor Pengajuan', `Catat nomor Anda: ${nomor}`);
    }
  };

  const filteredApproved = useMemo(() => {
    const q = approvedSearch.trim().toLowerCase();
    return approvedList.filter((item) => {
      const matchSearch =
        !q ||
        item.judulUsulan.toLowerCase().includes(q) ||
        item.lokasi.toLowerCase().includes(q) ||
        item.dusun.toLowerCase().includes(q);
      const matchCat =
        approvedCategory === 'Semua' || item.kategori === approvedCategory;
      return matchSearch && matchCat;
    });
  }, [approvedList, approvedSearch, approvedCategory]);

  const statusColorClass = (status: ProposalStatus) => {
    switch (status) {
      case 'Disetujui':
      case 'Selesai':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Ditolak':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'Dalam Pembahasan':
      case 'Menunggu Verifikasi':
        return 'bg-blue-50 text-[#1E40AF] border-blue-200';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Zone 1: Brand */}
          <div className="flex items-center gap-3 min-w-0">
            {!logoError ? (
              <img
                src={ASSET_IMAGES.logo}
                alt="Lambang Desa Adimulya"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0B1D3A] text-[#C99A2E]">
                <ShieldCheck className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-[#0B1D3A] whitespace-nowrap">
                SIMPANDADU
              </p>
              <p className="truncate text-[11px] text-slate-600">
                Desa Adimulya
              </p>
            </div>
          </div>

          {/* Zone 2: Desktop Nav */}
          <nav
            aria-label="Navigasi layanan warga"
            className="hidden md:flex items-center gap-6 text-sm font-semibold"
          >
            <button
              type="button"
              onClick={() => setActiveTab('ajukan')}
              className={`whitespace-nowrap shrink-0 border-b-2 py-2 transition-colors ${
                activeTab === 'ajukan'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Ajukan Usulan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cek-status')}
              className={`whitespace-nowrap shrink-0 border-b-2 py-2 transition-colors ${
                activeTab === 'cek-status'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Cek Status
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('disetujui')}
              className={`whitespace-nowrap shrink-0 border-b-2 py-2 transition-colors ${
                activeTab === 'disetujui'
                  ? 'border-[#1D4ED8] text-[#1D4ED8]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Usulan Disetujui
            </button>
          </nav>

          {/* Zone 3: Admin Login CTA */}
          <button
            type="button"
            onClick={onGoToAdminLogin}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1D3A] px-3.5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Masuk Admin</span>
          </button>
        </div>

        {/* Mobile Tab Bar */}
        <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50 md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('ajukan')}
            className={`py-3 text-center text-xs font-semibold transition-colors ${
              activeTab === 'ajukan'
                ? 'border-b-2 border-[#1D4ED8] bg-white text-[#1D4ED8]'
                : 'text-slate-600'
            }`}
          >
            Ajukan Usulan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cek-status')}
            className={`py-3 text-center text-xs font-semibold transition-colors ${
              activeTab === 'cek-status'
                ? 'border-b-2 border-[#1D4ED8] bg-white text-[#1D4ED8]'
                : 'text-slate-600'
            }`}
          >
            Cek Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('disetujui')}
            className={`py-3 text-center text-xs font-semibold transition-colors ${
              activeTab === 'disetujui'
                ? 'border-b-2 border-[#1D4ED8] bg-white text-[#1D4ED8]'
                : 'text-slate-600'
            }`}
          >
            Disetujui
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Hero Intro Strip */}
        <section className="mb-6 rounded-xl bg-[#0B1D3A] p-6 text-white sm:p-8">
          <p className="text-xs font-semibold tracking-wider text-[#E5B84B] uppercase">
            Layanan Partisipasi Masyarakat · Balai Desa Adimulya
          </p>
          <h1 className="mt-1.5 font-serif text-2xl leading-snug font-bold sm:text-3xl text-balance">
            Musrenbang Warga Desa Adimulya
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">
            Sampaikan usulan pembangunan lingkungan Anda secara langsung, pantau proses verifikasinya melalui nomor pengajuan, dan lihat daftar rencana pembangunan yang telah disetujui.
          </p>
        </section>

        {/* TAB 1: FORMULIR PENGAJUAN WARGA */}
        {activeTab === 'ajukan' && (
          <section className="space-y-6">
            {submittedReceipt ? (
              <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-xs sm:p-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-700" />
                  <div>
                    <h2 className="text-xl font-bold text-[#0B1D3A]">
                      Usulan Anda Berhasil Dikirim
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Data pengajuan sudah langsung masuk ke sistem Pemerintah Desa Adimulya untuk diverifikasi.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center sm:text-left">
                  <p className="text-xs font-semibold text-slate-500 uppercase">
                    Nomor Pengajuan Anda (Simpan Nomor Ini)
                  </p>
                  <div className="mt-2 flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="font-mono text-2xl font-bold tracking-wider text-[#1E40AF] sm:text-3xl">
                      {submittedReceipt.nomorPengajuan}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyNomor(submittedReceipt.nomorPengajuan)
                      }
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Salin Nomor</span>
                    </button>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Judul Usulan</dt>
                    <dd className="font-semibold text-slate-900">
                      {submittedReceipt.proposal.judulUsulan}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Status Saat Ini</dt>
                    <dd className="font-semibold text-[#1E40AF]">
                      {submittedReceipt.proposal.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Kategori</dt>
                    <dd className="text-slate-800">
                      {submittedReceipt.proposal.kategori}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Lokasi</dt>
                    <dd className="text-slate-800">
                      {submittedReceipt.proposal.dusun} ·{' '}
                      {submittedReceipt.proposal.lokasi}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      const num = submittedReceipt.nomorPengajuan;
                      setLookupNomor(num);
                      setActiveTab('cek-status');
                      void runStatusCheck(num);
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF]"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    <span>Cek Status Usulan Ini</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmittedReceipt(null)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Ajukan Usulan Lain
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-8">
                <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs leading-relaxed text-slate-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]" />
                  <span>
                    <strong>Perlindungan Data Pribadi:</strong> Nama lengkap, nomor HP, dan RT/RW Anda hanya dapat dilihat oleh admin desa yang berwenang untuk keperluan verifikasi.
                  </span>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                  >
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmitProposal} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="warga-nama"
                        className="mb-1.5 block text-sm font-semibold text-slate-800"
                      >
                        Nama Lengkap *
                      </label>
                      <input
                        id="warga-nama"
                        type="text"
                        required
                        value={namaPengusul}
                        onChange={(e) => setNamaPengusul(e.target.value)}
                        placeholder="Contoh: Budi Santoso"
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="warga-hp"
                        className="mb-1.5 block text-sm font-semibold text-slate-800"
                      >
                        Nomor HP / WhatsApp *
                      </label>
                      <input
                        id="warga-hp"
                        type="tel"
                        inputMode="tel"
                        required
                        value={nomorHp}
                        onChange={(e) => setNomorHp(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="warga-dusun"
                        className="mb-1.5 block text-sm font-semibold text-slate-800"
                      >
                        Dusun *
                      </label>
                      <select
                        id="warga-dusun"
                        value={dusun}
                        onChange={(e) => setDusun(e.target.value)}
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                      >
                        {dusunList.map((d) => (
                          <option key={d.id} value={d.nama}>
                            {d.nama}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="warga-rtrw"
                        className="mb-1.5 block text-sm font-semibold text-slate-800"
                      >
                        RT / RW *
                      </label>
                      <input
                        id="warga-rtrw"
                        type="text"
                        required
                        value={rtRw}
                        onChange={(e) => setRtRw(e.target.value)}
                        placeholder="Contoh: RT 02 / RW 01"
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="warga-kategori"
                        className="mb-1.5 block text-sm font-semibold text-slate-800"
                      >
                        Kategori Usulan *
                      </label>
                      <select
                        id="warga-kategori"
                        value={kategori}
                        onChange={(e) =>
                          setKategori(e.target.value as ProposalCategory)
                        }
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                      >
                        {PROPOSAL_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="warga-lokasi"
                        className="mb-1.5 block text-sm font-semibold text-slate-800"
                      >
                        Lokasi Kegiatan *
                      </label>
                      <input
                        id="warga-lokasi"
                        type="text"
                        required
                        value={lokasi}
                        onChange={(e) => setLokasi(e.target.value)}
                        placeholder="Contoh: Gang Melati dekat Balai Pertemuan"
                        className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="warga-judul"
                      className="mb-1.5 block text-sm font-semibold text-slate-800"
                    >
                      Judul Usulan *
                    </label>
                    <input
                      id="warga-judul"
                      type="text"
                      required
                      value={judulUsulan}
                      onChange={(e) => setJudulUsulan(e.target.value)}
                      placeholder="Contoh: Perbaikan Saluran Drainase Gang Melati"
                      className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="warga-alasan"
                      className="mb-1.5 block text-sm font-semibold text-slate-800"
                    >
                      Alasan dan Penjelasan Usulan *
                    </label>
                    <textarea
                      id="warga-alasan"
                      rows={4}
                      required
                      value={deskripsi}
                      onChange={(e) => setDeskripsi(e.target.value)}
                      placeholder="Ceritakan kondisi saat ini, mengapa usulan ini penting, dan manfaatnya bagi warga sekitar..."
                      className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-base leading-relaxed text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                    />
                  </div>

                  {/* Optional Location Photo Upload */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                      Foto Kondisi Lokasi (Opsional, maks. 2 MB)
                    </label>
                    {fotoDataUrl ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-medium text-slate-700">
                            {fotoFileName || 'Foto terlampir'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFotoDataUrl(null);
                              setFotoFileName('');
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Hapus Foto</span>
                          </button>
                        </div>
                        <img
                          src={fotoDataUrl}
                          alt="Pratinjau foto kondisi lokasi"
                          className="mt-3 max-h-56 w-full rounded-lg object-cover"
                        />
                      </div>
                    ) : (
                      <label className="flex min-h-[104px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition-colors hover:border-[#1D4ED8] hover:bg-blue-50/30">
                        <Upload className="h-6 w-6 text-slate-400" />
                        <span className="mt-2 text-sm font-medium text-slate-700">
                          Ketuk untuk memilih foto kondisi lokasi
                        </span>
                        <span className="mt-0.5 text-xs text-slate-500">
                          Format JPG, PNG, atau WebP (maksimal 2 MB)
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoChange}
                          className="sr-only"
                        />
                      </label>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#1E40AF] focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    <span>{submitting ? 'Mengirim Usulan...' : 'Kirim Usulan'}</span>
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: CEK STATUS PENGAJUAN */}
        {activeTab === 'cek-status' && (
          <section className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-8">
              <h2 className="text-lg font-bold text-[#0B1D3A]">
                Cek Status Usulan Musrenbang
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Masukkan nomor pengajuan yang Anda terima saat mengirim usulan (contoh:{' '}
                <span className="font-mono font-semibold text-slate-800">
                  MSRB-2026-0001
                </span>
                ).
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runStatusCheck(lookupNomor);
                }}
                className="mt-5 flex flex-col gap-3 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={lookupNomor}
                    onChange={(e) => setLookupNomor(e.target.value)}
                    placeholder="Masukkan Nomor Pengajuan (mis. MSRB-2026-0001)"
                    className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3.5 pl-10 font-mono text-base uppercase text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="min-h-[46px] rounded-lg bg-[#0B1D3A] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap"
                >
                  {lookupLoading ? 'Mencari...' : 'Periksa Status'}
                </button>
              </form>

              {lookupError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <p className="font-mono text-xs font-semibold text-slate-500">
                        {lookupResult.nomorPengajuan}
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-[#0B1D3A]">
                        {lookupResult.judulUsulan}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold ${statusColorClass(
                        lookupResult.status,
                      )}`}
                    >
                      {lookupResult.status}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-slate-500">Kategori</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">
                        {lookupResult.kategori}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Wilayah / Lokasi</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">
                        {lookupResult.dusun} · {lookupResult.lokasi}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Tanggal Pengajuan
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs tabular-nums text-slate-900">
                        {lookupResult.tanggalPengajuan}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-500">
                      Penjelasan Usulan
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">
                      {lookupResult.deskripsi}
                    </p>
                  </div>

                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
                    <p className="text-xs font-semibold text-[#1E40AF]">
                      Catatan dari Pemerintah Desa Adimulya
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">
                      {lookupResult.catatanUntukPengusul ||
                        'Belum ada catatan tambahan. Usulan sedang diproses sesuai tahapan.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: DAFTAR PUBLIK USULAN YANG DISETUJUI */}
        {activeTab === 'disetujui' && (
          <section className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#0B1D3A]">
                    Usulan Pembangunan yang Disetujui
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Daftar usulan yang telah diverifikasi, disetujui, dan dipublikasikan secara resmi tanpa menampilkan data pribadi pengusul.
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-[#1E40AF] whitespace-nowrap">
                  {filteredApproved.length} usulan dipublikasikan
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="relative sm:col-span-7">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={approvedSearch}
                    onChange={(e) => setApprovedSearch(e.target.value)}
                    placeholder="Cari judul kegiatan atau lokasi dusun..."
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pr-3.5 pl-10 text-sm text-slate-900 focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-5">
                  <select
                    aria-label="Filter kategori usulan disetujui"
                    value={approvedCategory}
                    onChange={(e) => setApprovedCategory(e.target.value)}
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#1D4ED8] focus:outline-none"
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

            {approvedLoading ? (
              <div className="space-y-3">
                <div className="h-32 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-32 animate-pulse rounded-xl bg-slate-200/70" />
              </div>
            ) : filteredApproved.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
                <FileCheck2 className="mx-auto h-11 w-11 text-slate-300" />
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  Belum Ada Usulan Disetujui yang Dipublikasikan
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Usulan warga yang telah disetujui dan dipilih untuk publikasi oleh Pemerintah Desa akan tampil di halaman ini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredApproved.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-mono text-xs font-medium text-slate-500">
                          {item.nomorPengajuan} · {item.kategori}
                        </span>
                        <span
                          className={`shrink-0 rounded border px-2.5 py-0.5 text-xs font-semibold ${statusColorClass(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-bold text-[#0B1D3A]">
                        {item.judulUsulan}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {item.deskripsi}
                      </p>
                      {item.catatanUntukPengusul && (
                        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                          <strong className="text-[#0B1D3A]">Keterangan:</strong>{' '}
                          {item.catatanUntukPengusul}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#1D4ED8]" />
                        {item.dusun} · {item.lokasi}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {item.tanggalPengajuan}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
