import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Search,
  ArrowRight,
  Package,
  CheckCircle2,
  Wrench,
  AlertOctagon,
  Newspaper,
  ClipboardList,
  MapPin,
} from 'lucide-react';
import { VillageLeafletMap } from './VillageLeafletMap';
import type {
  AdminUser,
  AppPage,
  MapConfig,
  MusrenbangProposal,
  NewsArticle,
  VillageAsset,
} from '../types';

interface DashboardPageProps {
  user: AdminUser;
  assets: VillageAsset[];
  proposals: MusrenbangProposal[];
  news: NewsArticle[];
  newsIsDemo: boolean;
  mapConfig: MapConfig;
  onNavigate: (page: AppPage) => void;
  onSelectNewsArticle: (article: NewsArticle) => void;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function DashboardPage({
  user,
  assets,
  proposals,
  news,
  newsIsDemo,
  mapConfig,
  onNavigate,
  onSelectNewsArticle,
}: DashboardPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const assetStats = useMemo(() => {
    const total = assets.length;
    const totalUnits = assets.reduce((acc, a) => acc + (a.jumlah || 0), 0);
    const baik = assets.filter((a) => a.kondisi === 'Baik').length;
    const perluPerbaikan = assets.filter(
      (a) => a.kondisi === 'Perlu Perbaikan',
    ).length;
    const rusakBerat = assets.filter((a) => a.kondisi === 'Rusak Berat').length;

    return { total, totalUnits, baik, perluPerbaikan, rusakBerat };
  }, [assets]);

  const conditionChartData = useMemo(
    () => [
      { name: 'Kondisi Baik', jumlah: assetStats.baik, fill: '#15803D' },
      {
        name: 'Perlu Perbaikan',
        jumlah: assetStats.perluPerbaikan,
        fill: '#B45309',
      },
      { name: 'Rusak Berat', jumlah: assetStats.rusakBerat, fill: '#B91C1C' },
    ],
    [assetStats],
  );

  const categoryChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of assets) {
      counts.set(item.kategori, (counts.get(item.kategori) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([kategori, jumlah]) => ({ kategori, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 6);
  }, [assets]);

  const proposalSummary = useMemo(() => {
    return {
      total: proposals.length,
      warga: proposals.filter((p) => p.sumber === 'Warga').length,
      diajukan: proposals.filter(
        (p) => p.status === 'Diajukan' || p.status === 'Menunggu Verifikasi',
      ).length,
      pembahasan: proposals.filter((p) => p.status === 'Dalam Pembahasan').length,
      disetujui: proposals.filter(
        (p) => p.status === 'Disetujui' || p.status === 'Selesai',
      ).length,
    };
  }, [proposals]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return {
      assets: assets
        .filter(
          (a) =>
            a.nama.toLowerCase().includes(q) ||
            a.kategori.toLowerCase().includes(q) ||
            a.lokasi.toLowerCase().includes(q),
        )
        .slice(0, 4),
      proposals: proposals
        .filter(
          (p) =>
            p.judulUsulan.toLowerCase().includes(q) ||
            p.nomorPengajuan.toLowerCase().includes(q) ||
            p.namaPengusul.toLowerCase().includes(q) ||
            (p.dusun || '').toLowerCase().includes(q) ||
            p.lokasi.toLowerCase().includes(q),
        )
        .slice(0, 4),
      news: news
        .filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.source.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q),
        )
        .slice(0, 4),
    };
  }, [searchQuery, assets, proposals, news]);

  const recentNews = news.slice(0, 4);
  const recentProposals = proposals.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome & Global Search Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#1E40AF] uppercase">
              SIMPANDADU · Balai Desa Adimulya
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0B1D3A] sm:text-3xl">
              Selamat Datang, {user.fullName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Sistem Informasi Perencanaan dan Administrasi Desa Adimulya Terpadu
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            <label htmlFor="dashboard-global-search" className="sr-only">
              Cari aset, berita, dan usulan pembangunan
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="dashboard-global-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari aset desa, berita nasional, atau usulan Musrenbang..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pr-4 pl-10 text-sm text-slate-900 transition-colors focus:border-[#1D4ED8] focus:bg-white focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Global Search Results Drawer */}
        {searchResults && (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">
                Hasil Pencarian untuk &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-medium text-[#1D4ED8] hover:underline"
              >
                Bersihkan pencarian
              </button>
            </div>
            {searchResults.assets.length === 0 &&
            searchResults.proposals.length === 0 &&
            searchResults.news.length === 0 ? (
              <p className="text-sm text-slate-500">
                Tidak ada data aset, berita, atau usulan pembangunan yang cocok.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    Aset Desa ({searchResults.assets.length})
                  </p>
                  <ul className="space-y-1.5">
                    {searchResults.assets.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate('aset')}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                        >
                          <p className="font-semibold text-slate-900 truncate">
                            {item.nama}
                          </p>
                          <p className="text-slate-500">
                            {item.kategori} · {item.kondisi}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    Usulan Musrenbang ({searchResults.proposals.length})
                  </p>
                  <ul className="space-y-1.5">
                    {searchResults.proposals.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate('musrenbang')}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                        >
                          <p className="font-semibold text-slate-900 truncate">
                            {item.judulUsulan}
                          </p>
                          <p className="text-slate-500">
                            {item.nomorPengajuan} · {item.sumber} · {item.status}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">
                    Berita Indonesia ({searchResults.news.length})
                  </p>
                  <ul className="space-y-1.5">
                    {searchResults.news.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectNewsArticle(item);
                            onNavigate('berita');
                          }}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                        >
                          <p className="font-semibold text-slate-900 truncate">
                            {item.title}
                          </p>
                          <p className="text-slate-500">
                            {item.source} · {item.category}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4 Asset KPI Stat Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Total Aset Desa
            </span>
            <Package className="h-5 w-5 text-[#1E40AF]" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-[#0B1D3A]">
            {assetStats.total}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Total {assetStats.totalUnits} unit/bidang tercatat
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Aset Kondisi Baik
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-emerald-700">
            {assetStats.baik}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {assetStats.total > 0
              ? `${Math.round((assetStats.baik / assetStats.total) * 100)}% dari total inventaris`
              : 'Belum ada data aset'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Perlu Perbaikan
            </span>
            <Wrench className="h-5 w-5 text-amber-700" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-amber-700">
            {assetStats.perluPerbaikan}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Memerlukan pemeliharaan berkala
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Rusak Berat
            </span>
            <AlertOctagon className="h-5 w-5 text-red-700" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-red-700">
            {assetStats.rusakBerat}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Prioritas rehabilitasi / penggantian
          </p>
        </div>
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Grafik Kondisi Aset Desa
              </h2>
              <p className="text-xs text-slate-500">
                Pembaruan otomatis mengikuti data inventaris aset tersimpan
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('aset')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline whitespace-nowrap"
            >
              Kelola Aset <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-64 w-full">
            {assets.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                Belum ada data aset untuk ditampilkan pada grafik.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={conditionChartData}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#334155' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#475569' }}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [`${value} item`, 'Jumlah']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="jumlah" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {conditionChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Sebaran Aset Berdasarkan Kategori
              </h2>
              <p className="text-xs text-slate-500">
                6 kategori terbanyak dalam inventaris Desa Adimulya
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            {categoryChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
                Belum ada data kategori aset.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#475569' }}
                  />
                  <YAxis
                    dataKey="kategori"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11, fill: '#334155' }}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [`${value} item`, 'Jumlah']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="jumlah"
                    fill="#1E40AF"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Peta Sebaran Aset & Ringkasan Musrenbang */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-[#1E40AF]" />
              <div>
                <h2 className="text-base font-bold text-[#0B1D3A]">
                  Peta Sebaran Aset Desa Adimulya
                </h2>
                <p className="text-xs text-slate-500">
                  Integrasi OpenStreetMap ·{' '}
                  {
                    assets.filter(
                      (a) =>
                        a.koordinat.lat !== null && a.koordinat.lng !== null,
                    ).length
                  }{' '}
                  aset memiliki koordinat resmi
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('peta')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Buka Peta Desa <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <VillageLeafletMap
            mapConfig={mapConfig}
            assets={assets}
            heightClass="h-[320px]"
          />
        </div>

        {/* Ringkasan Usulan Musrenbang */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ClipboardList className="h-5 w-5 text-[#C99A2E]" />
              <div>
                <h2 className="text-base font-bold text-[#0B1D3A]">
                  Ringkasan Usulan Musrenbang
                </h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  {proposalSummary.total} usulan · {proposalSummary.warga} dari
                  warga · {proposalSummary.disetujui} disetujui/selesai
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('musrenbang')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0"
            >
              Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2.5 border-b border-slate-100 pb-4 text-center">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="font-mono text-lg font-bold tabular-nums text-[#0B1D3A]">
                {proposalSummary.diajukan}
              </p>
              <p className="text-[11px] text-slate-600">Menunggu Verifikasi</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="font-mono text-lg font-bold tabular-nums text-[#1E40AF]">
                {proposalSummary.pembahasan}
              </p>
              <p className="text-[11px] text-slate-600">Pembahasan</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="font-mono text-lg font-bold tabular-nums text-emerald-700">
                {proposalSummary.disetujui}
              </p>
              <p className="text-[11px] text-slate-600">Disetujui / Selesai</p>
            </div>
          </div>

          {recentProposals.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Belum ada usulan pembangunan yang tercatat.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentProposals.map((p) => (
                <li key={p.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {p.judulUsulan}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono">{p.nomorPengajuan}</span> ·{' '}
                        {p.sumber} · {p.kategori} · {p.tanggalPengajuan}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[#1E40AF]">
                      {p.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Informasi Terbaru & Ringkasan Berita Terkini Indonesia */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Newspaper className="h-5 w-5 text-[#1E40AF]" />
            <div>
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Ringkasan Berita Indonesia Terkini
              </h2>
              <p className="text-xs text-slate-500">
                {newsIsDemo
                  ? 'Mode DEMO (RSS eksternal tidak terjangkau saat ini) — bukan klaim berita terkini'
                  : 'Diperbarui otomatis dari umpan RSS media nasional tepercaya'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('berita')}
            className="inline-flex items-center gap-1 rounded-lg bg-[#0B1D3A] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap"
          >
            Buka Portal Berita <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {recentNews.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectNewsArticle(item);
                onNavigate('berita');
              }}
              className="group flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-left transition-colors hover:border-[#1D4ED8]/40 hover:bg-white"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {item.source} · {item.category}
                </p>
                <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-[#1D4ED8]">
                  {item.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {item.summary}
                </p>
              </div>
              <p className="mt-3 font-mono text-[11px] tabular-nums text-slate-500">
                {formatShortDate(item.publishedAt)}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
