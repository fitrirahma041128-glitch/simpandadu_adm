import { useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  Newspaper,
  Clock,
  Info,
} from 'lucide-react';
import { NEWS_CATEGORIES } from '../constants';
import type { NewsArticle, NewsCategory, NewsResponse } from '../types';

interface BeritaIndonesiaPageProps {
  newsData: NewsResponse;
  loading: boolean;
  selectedArticle: NewsArticle | null;
  onSelectArticle: (article: NewsArticle | null) => void;
  onRefreshNews: () => void;
}

function formatDateTimeWIB(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }) +
    ' · ' +
    date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }) +
    ' WIB'
  );
}

function NewsImage({
  src,
  alt,
  source,
  className,
}: {
  src: string | null;
  alt: string;
  source: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B1D3A] via-[#122B54] to-[#1E40AF] p-6 text-center text-white ${className}`}
      >
        <Newspaper className="h-9 w-9 text-[#E5B84B] opacity-90" />
        <p className="mt-2.5 text-xs font-semibold tracking-wider text-slate-200 uppercase">
          {source}
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

export function BeritaIndonesiaPage({
  newsData,
  loading,
  selectedArticle,
  onSelectArticle,
  onRefreshNews,
}: BeritaIndonesiaPageProps) {
  const [category, setCategory] = useState<NewsCategory>('Semua Berita');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return newsData.articles.filter((art) => {
      const matchCategory =
        category === 'Semua Berita' || art.category === category;
      const matchSearch =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.summary.toLowerCase().includes(q) ||
        art.source.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [newsData.articles, category, search]);

  const leadArticle = filtered[0] || null;
  const secondaryArticles = filtered.slice(1);

  // Article Detail View
  if (selectedArticle) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelectArticle(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Berita</span>
          </button>

          <a
            href={selectedArticle.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF]"
          >
            <span>Buka Artikel Asli di {selectedArticle.source}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <NewsImage
            src={selectedArticle.imageUrl}
            alt={selectedArticle.title}
            source={selectedArticle.source}
            className="h-72 w-full sm:h-96"
          />

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-[#1E40AF]">
                {selectedArticle.source}
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedArticle.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {formatDateTimeWIB(selectedArticle.publishedAt)}
              </span>
            </div>

            {selectedArticle.isDemo && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <Info className="h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  Data ini berlabel <strong>DEMO</strong> karena server umpan RSS media eksternal belum dapat diakses dari lingkungan saat ini. Gunakan tautan sumber resmi untuk mengakses berita aktual.
                </span>
              </div>
            )}

            <h1 className="mt-4 font-serif text-2xl leading-tight font-bold text-[#0B1D3A] sm:text-3xl text-balance">
              {selectedArticle.title}
            </h1>

            <div className="mt-6 space-y-4 border-t border-slate-100 pt-6 text-base leading-relaxed text-slate-700">
              <p className="font-medium text-slate-900">
                {selectedArticle.summary}
              </p>
              {selectedArticle.content &&
                selectedArticle.content !== selectedArticle.summary && (
                  <p>{selectedArticle.content}</p>
                )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
              <div className="text-xs text-slate-500">
                Sumber resmi: <strong className="text-slate-800">{selectedArticle.source}</strong>
              </div>
              <a
                href={selectedArticle.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF]"
              >
                <span>Baca Artikel Lengkap di Sumber Asli</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Editorial Portal Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#1E40AF] uppercase">
              Portal Berita Nasional Terintegrasi · SIMPANDADU
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#0B1D3A] sm:text-3xl">
              Berita Indonesia Terkini
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Pembaruan terakhir:{' '}
                <strong className="font-mono tabular-nums text-slate-800">
                  {formatDateTimeWIB(newsData.lastUpdated)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>Sumber: {newsData.sourcesChecked.join(', ')}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari berita atau media..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pr-3.5 pl-10 text-sm text-slate-900 focus:border-[#1D4ED8] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={onRefreshNews}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1D3A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              <span>{loading ? 'Memperbarui...' : 'Perbarui Berita'}</span>
            </button>
          </div>
        </div>

        {/* Demo Fallback Notice */}
        {newsData.isDemoFallback && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold">
                Mode Contoh Integrasi (DEMO) — Umpan RSS Eksternal Tidak Dapat Dijangkau
              </p>
              <p className="mt-0.5 text-amber-800">
                Server tidak memperoleh respons dari feed RSS media nasional saat ini. Data di bawah diberi label <strong>DEMO</strong> sebagai struktur integrasi dan bukan merupakan klaim berita terkini.
              </p>
            </div>
          </div>
        )}

        {/* Category Filter Tabs */}
        <div className="mt-5 flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 pt-4 pb-1">
          {NEWS_CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0B1D3A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <Newspaper className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            Berita Tidak Ditemukan
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tidak ada artikel yang cocok dengan kategori &ldquo;{category}&rdquo; atau pencarian Anda.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategory('Semua Berita');
              setSearch('');
            }}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tampilkan Semua Berita
          </button>
        </div>
      ) : (
        <>
          {/* Headline Lead Story */}
          {leadArticle && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                <div className="lg:col-span-7">
                  <NewsImage
                    src={leadArticle.imageUrl}
                    alt={leadArticle.title}
                    source={leadArticle.source}
                    className="h-64 w-full sm:h-80 lg:h-full lg:min-h-[340px]"
                  />
                </div>
                <div className="flex flex-col justify-between p-6 sm:p-8 lg:col-span-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-bold text-[#1E40AF]">
                        Berita Utama
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">
                        {leadArticle.source}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{leadArticle.category}</span>
                    </div>
                    <h2 className="mt-3 font-serif text-2xl leading-snug font-bold text-[#0B1D3A] text-balance">
                      {leadArticle.title}
                    </h2>
                    <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-600">
                      {leadArticle.summary}
                    </p>
                  </div>

                  <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
                    <p className="font-mono text-xs tabular-nums text-slate-500">
                      {formatDateTimeWIB(leadArticle.publishedAt)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectArticle(leadArticle)}
                        className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap"
                      >
                        Baca Selengkapnya
                      </button>
                      <a
                        href={leadArticle.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                      >
                        <span>Sumber Asli</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Grid of Latest News */}
          {secondaryArticles.length > 0 && (
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {secondaryArticles.map((art) => (
                <article
                  key={art.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-md"
                >
                  <NewsImage
                    src={art.imageUrl}
                    alt={art.title}
                    source={art.source}
                    className="h-48 w-full"
                  />

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-semibold text-[#1E40AF]">
                          {art.source}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{art.category}</span>
                      </div>

                      <h3 className="mt-2 line-clamp-2 font-serif text-lg leading-snug font-bold text-[#0B1D3A]">
                        {art.title}
                      </h3>

                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">
                        {art.summary}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-3.5">
                      <p className="font-mono text-[11px] tabular-nums text-slate-500">
                        {formatDateTimeWIB(art.publishedAt)}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectArticle(art)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-[#0B1D3A] transition-colors hover:bg-[#0B1D3A] hover:text-white whitespace-nowrap"
                        >
                          Baca Selengkapnya
                        </button>
                        <a
                          href={art.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap"
                        >
                          <span>Artikel Asli</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
