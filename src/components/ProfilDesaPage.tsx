import { useState } from 'react';
import {
  Building2,
  History,
  Target,
  Map as MapIcon,
  Users,
  Sprout,
  Network,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Info,
  ArrowRight,
} from 'lucide-react';
import { ASSET_IMAGES } from '../constants';
import { api } from '../lib/api';
import { VillageLeafletMap } from './VillageLeafletMap';
import type {
  AppPage,
  MapConfig,
  ProfilSubmenu,
  VillageAsset,
  VillageProfile,
} from '../types';

interface ProfilDesaPageProps {
  profile: VillageProfile;
  mapConfig: MapConfig;
  assets: VillageAsset[];
  onProfileUpdated: (next: VillageProfile) => void;
  onNavigate: (page: AppPage) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

const SUBMENUS: Array<{
  id: ProfilSubmenu;
  label: string;
  icon: typeof Building2;
}> = [
  { id: 'tentang', label: 'Tentang Desa', icon: Building2 },
  { id: 'sejarah', label: 'Sejarah Desa', icon: History },
  { id: 'visi-misi', label: 'Visi dan Misi', icon: Target },
  { id: 'peta', label: 'Peta Desa', icon: MapIcon },
  {
    id: 'geografis-demografi',
    label: 'Geografis & Demografi',
    icon: Users,
  },
  { id: 'potensi', label: 'Potensi Desa', icon: Sprout },
  {
    id: 'struktur',
    label: 'Struktur Organisasi',
    icon: Network,
  },
];

export function ProfilDesaPage({
  profile,
  mapConfig,
  assets,
  onProfileUpdated,
  onNavigate,
  onNotify,
}: ProfilDesaPageProps) {
  const [activeTab, setActiveTab] = useState<ProfilSubmenu>('tentang');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VillageProfile>(profile);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(JSON.parse(JSON.stringify(profile)) as VillageProfile);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.updateProfile(draft);
      onProfileUpdated(res.profile);
      setEditing(false);
      onNotify(
        'success',
        'Profil Desa Disimpan',
        'Perubahan konten profil Desa Adimulya telah disimpan permanen.',
      );
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menyimpan Profil',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1D3A]">
            Profil Desa Adimulya
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Informasi kelembagaan, sejarah, visi misi, demografi, potensi wilayah, serta struktur pemerintahan desa.
          </p>
        </div>

        {activeTab !== 'peta' && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  <span>Batal</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Konten Profil'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1D3A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] whitespace-nowrap"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit Konten Profil</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editable Example Data Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]" />
        <span>
          Konten awal berikut merupakan <strong>templat contoh</strong> agar tidak ada data resmi desa yang dikarang. Perangkat desa dapat menekan tombol <strong>Edit Konten Profil</strong> untuk mengganti seluruh teks, angka demografi, potensi, dan nama pejabat dengan data resmi Desa Adimulya.
        </span>
      </div>

      {/* Submenu Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
        {SUBMENUS.map((sub) => {
          const Icon = sub.icon;
          const active = activeTab === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                setActiveTab(sub.id);
                setEditing(false);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#0B1D3A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Tentang Desa */}
      {activeTab === 'tentang' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-5">
              <img
                src={ASSET_IMAGES.balaiDesa}
                alt="Balai Desa Adimulya"
                referrerPolicy="no-referrer"
                className="h-64 w-full object-cover lg:h-full"
              />
            </div>
            <div className="p-6 sm:p-8 lg:col-span-7">
              <div className="flex items-center gap-3">
                <img
                  src={ASSET_IMAGES.logo}
                  alt="Lambang Desa Adimulya"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-lg border border-slate-200 bg-white object-contain p-1"
                />
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#0B1D3A]">
                    Pemerintah Desa Adimulya
                  </h2>
                  <p className="text-xs text-slate-500">
                    Profil Umum &amp; Identitas Administratif
                  </p>
                </div>
              </div>

              {editing ? (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Deskripsi Tentang Desa
                    </label>
                    <textarea
                      rows={4}
                      value={draft.tentang.deskripsi}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          tentang: {
                            ...prev.tentang,
                            deskripsi: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Alamat Balai Desa
                      </label>
                      <input
                        type="text"
                        value={draft.tentang.alamatBalaiDesa}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            tentang: {
                              ...prev.tentang,
                              alamatBalaiDesa: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Kecamatan
                      </label>
                      <input
                        type="text"
                        value={draft.tentang.kecamatan}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            tentang: {
                              ...prev.tentang,
                              kecamatan: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Kabupaten
                      </label>
                      <input
                        type="text"
                        value={draft.tentang.kabupaten}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            tentang: {
                              ...prev.tentang,
                              kabupaten: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Provinsi
                      </label>
                      <input
                        type="text"
                        value={draft.tentang.provinsi}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            tentang: {
                              ...prev.tentang,
                              provinsi: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Email Resmi
                      </label>
                      <input
                        type="text"
                        value={draft.tentang.emailResmi}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            tentang: {
                              ...prev.tentang,
                              emailResmi: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Telepon &amp; Kode Pos
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={draft.tentang.telepon}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              tentang: {
                                ...prev.tentang,
                                telepon: e.target.value,
                              },
                            }))
                          }
                          placeholder="Telepon"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={draft.tentang.kodePos}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              tentang: {
                                ...prev.tentang,
                                kodePos: e.target.value,
                              },
                            }))
                          }
                          placeholder="Kode Pos"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-5 text-sm leading-relaxed text-slate-700">
                    {profile.tentang.deskripsi}
                  </p>
                  <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-slate-500">
                        Alamat Balai Desa
                      </dt>
                      <dd className="mt-0.5 font-medium text-slate-900">
                        {profile.tentang.alamatBalaiDesa}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">
                        Wilayah Administratif
                      </dt>
                      <dd className="mt-0.5 font-medium text-slate-900">
                        Kec. {profile.tentang.kecamatan}, Kab.{' '}
                        {profile.tentang.kabupaten}, {profile.tentang.provinsi}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">
                        Email Resmi
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-slate-900">
                        {profile.tentang.emailResmi}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-500">
                        Telepon · Kode Pos
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs text-slate-900">
                        {profile.tentang.telepon} · {profile.tentang.kodePos}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2. Sejarah Desa */}
      {activeTab === 'sejarah' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#0B1D3A]">
              Sejarah Desa Adimulya
            </h2>
            {editing ? (
              <textarea
                rows={4}
                value={draft.sejarah.ringkasan}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    sejarah: { ...prev.sejarah, ringkasan: e.target.value },
                  }))
                }
                className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
            ) : (
              <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-700">
                {profile.sejarah.ringkasan}
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B1D3A]">
                Linimasa Perkembangan Desa
              </h3>
              {editing && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      sejarah: {
                        ...prev.sejarah,
                        linimasa: [
                          ...prev.sejarah.linimasa,
                          { tahun: '', peristiwa: '' },
                        ],
                      },
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Peristiwa</span>
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                {draft.sejarah.linimasa.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12"
                  >
                    <input
                      type="text"
                      value={item.tahun}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          sejarah: {
                            ...prev.sejarah,
                            linimasa: prev.sejarah.linimasa.map((l, i) =>
                              i === idx ? { ...l, tahun: e.target.value } : l,
                            ),
                          },
                        }))
                      }
                      placeholder="Tahun"
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs sm:col-span-3"
                    />
                    <input
                      type="text"
                      value={item.peristiwa}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          sejarah: {
                            ...prev.sejarah,
                            linimasa: prev.sejarah.linimasa.map((l, i) =>
                              i === idx
                                ? { ...l, peristiwa: e.target.value }
                                : l,
                            ),
                          },
                        }))
                      }
                      placeholder="Uraian peristiwa sejarah"
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs sm:col-span-8"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          sejarah: {
                            ...prev.sejarah,
                            linimasa: prev.sejarah.linimasa.filter(
                              (_, i) => i !== idx,
                            ),
                          },
                        }))
                      }
                      className="flex items-center justify-center rounded text-red-600 hover:bg-red-50 sm:col-span-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {profile.sejarah.linimasa.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <p className="font-mono text-xs font-bold text-[#1E40AF]">
                      {item.tahun}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                      {item.peristiwa}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Visi dan Misi */}
      {activeTab === 'visi-misi' && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-[#0B1D3A] p-6 text-white sm:p-8 lg:col-span-5">
            <p className="text-xs font-semibold tracking-wider text-[#E5B84B] uppercase">
              Visi Pemerintah Desa Adimulya
            </p>
            {editing ? (
              <textarea
                rows={5}
                value={draft.visiMisi.visi}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    visiMisi: { ...prev.visiMisi, visi: e.target.value },
                  }))
                }
                className="mt-4 w-full rounded-lg border border-white/20 bg-[#122B54] p-3 text-sm text-white"
              />
            ) : (
              <blockquote className="mt-4 font-serif text-xl leading-relaxed font-medium text-white">
                {profile.visiMisi.visi}
              </blockquote>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0B1D3A]">
                Misi Pembangunan Desa
              </h2>
              {editing && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      visiMisi: {
                        ...prev.visiMisi,
                        misi: [...prev.visiMisi.misi, ''],
                      },
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Misi</span>
                </button>
              )}
            </div>

            {editing ? (
              <div className="mt-4 space-y-2.5">
                {draft.visiMisi.misi.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 font-mono text-xs font-bold text-slate-500">
                      0{idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={m}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          visiMisi: {
                            ...prev.visiMisi,
                            misi: prev.visiMisi.misi.map((item, i) =>
                              i === idx ? e.target.value : item,
                            ),
                          },
                        }))
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          visiMisi: {
                            ...prev.visiMisi,
                            misi: prev.visiMisi.misi.filter((_, i) => i !== idx),
                          },
                        }))
                      }
                      className="rounded p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <ol className="mt-4 divide-y divide-slate-100">
                {profile.visiMisi.misi.map((m, idx) => (
                  <li key={idx} className="flex gap-3 py-3 text-sm text-slate-700">
                    <span className="font-mono text-xs font-bold text-[#1E40AF] pt-0.5">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <span className="leading-relaxed">{m}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {/* 4. Peta Desa */}
      {activeTab === 'peta' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0B1D3A]">
                Peta Wilayah Desa Adimulya
              </h2>
              <p className="text-xs text-slate-500">
                Terhubung langsung dengan konfigurasi koordinat resmi pada menu Peta Desa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('peta')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1D3A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF]"
            >
              <span>Kelola Koordinat di Peta Desa</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <VillageLeafletMap
            mapConfig={mapConfig}
            assets={assets}
            heightClass="h-[420px]"
          />
        </section>
      )}

      {/* 5. Geografis dan Demografi */}
      {activeTab === 'geografis-demografi' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#0B1D3A]">
              Kondisi Geografis &amp; Data Demografi Desa
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {profile.geografisDemografi.catatanSumber}
            </p>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ['luasWilayah', 'Luas Wilayah'],
                  ['ketinggian', 'Ketinggian Wilayah'],
                  ['topografi', 'Topografi'],
                  ['jumlahPenduduk', 'Jumlah Penduduk Total'],
                  ['jumlahKK', 'Jumlah Kepala Keluarga (KK)'],
                  ['lakiLaki', 'Penduduk Laki-laki'],
                  ['perempuan', 'Penduduk Perempuan'],
                  ['catatanSumber', 'Catatan Sumber Data'],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={draft.geografisDemografi[field]}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        geografisDemografi: {
                          ...prev.geografisDemografi,
                          [field]: e.target.value,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">Luas Wilayah</p>
                <p className="mt-1.5 text-base font-bold text-[#0B1D3A]">
                  {profile.geografisDemografi.luasWilayah}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">Ketinggian</p>
                <p className="mt-1.5 text-base font-bold text-[#0B1D3A]">
                  {profile.geografisDemografi.ketinggian}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-medium text-slate-500">Topografi</p>
                <p className="mt-1.5 text-base font-bold text-[#0B1D3A]">
                  {profile.geografisDemografi.topografi}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">
                  Total Penduduk
                </p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-[#1E40AF]">
                  {profile.geografisDemografi.jumlahPenduduk}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">
                  Jumlah Kepala Keluarga
                </p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-[#1E40AF]">
                  {profile.geografisDemografi.jumlahKK}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">Laki-laki</p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-slate-900">
                  {profile.geografisDemografi.lakiLaki}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">Perempuan</p>
                <p className="mt-1.5 font-mono text-lg font-bold tabular-nums text-slate-900">
                  {profile.geografisDemografi.perempuan}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. Potensi Desa */}
      {activeTab === 'potensi' && (
        <section className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-5">
                <img
                  src={ASSET_IMAGES.pertanian}
                  alt="Potensi Pertanian Desa Adimulya"
                  referrerPolicy="no-referrer"
                  className="h-60 w-full object-cover lg:h-full"
                />
              </div>
              <div className="p-6 sm:p-8 lg:col-span-7">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-serif text-xl font-bold text-[#0B1D3A]">
                    Potensi Unggulan Desa Adimulya
                  </h2>
                  {editing && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          potensi: [
                            ...prev.potensi,
                            {
                              id: `pot-${Date.now()}`,
                              bidang: 'Bidang Baru',
                              judul: '',
                              deskripsi: '',
                            },
                          ],
                        }))
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah Potensi</span>
                    </button>
                  )}
                </div>

                <div className="mt-5 space-y-4">
                  {(editing ? draft.potensi : profile.potensi).map((p, idx) =>
                    editing ? (
                      <div
                        key={p.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={p.bidang}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                potensi: prev.potensi.map((item, i) =>
                                  i === idx
                                    ? { ...item, bidang: e.target.value }
                                    : item,
                                ),
                              }))
                            }
                            placeholder="Bidang potensi"
                            className="w-1/2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                potensi: prev.potensi.filter(
                                  (_, i) => i !== idx,
                                ),
                              }))
                            }
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={p.judul}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              potensi: prev.potensi.map((item, i) =>
                                i === idx
                                  ? { ...item, judul: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="Judul potensi"
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium"
                        />
                        <textarea
                          rows={2}
                          value={p.deskripsi}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              potensi: prev.potensi.map((item, i) =>
                                i === idx
                                  ? { ...item, deskripsi: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="Deskripsi potensi"
                          className="w-full rounded border border-slate-300 bg-white p-2.5 text-xs"
                        />
                      </div>
                    ) : (
                      <div
                        key={p.id}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <p className="text-xs font-semibold text-[#1E40AF]">
                          {p.bidang}
                        </p>
                        <h3 className="mt-1 text-base font-bold text-[#0B1D3A]">
                          {p.judul}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {p.deskripsi}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 7. Struktur Organisasi Pemerintahan Desa */}
      {activeTab === 'struktur' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-bold text-[#0B1D3A]">
                Struktur Organisasi Pemerintahan Desa Adimulya
              </h2>
              <p className="text-xs text-slate-500">
                Susunan perangkat pelaksana pemerintahan dan pelayanan administrasi Balai Desa.
              </p>
            </div>
            {editing && (
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    strukturOrganisasi: [
                      ...prev.strukturOrganisasi,
                      {
                        id: `str-${Date.now()}`,
                        jabatan: 'Jabatan Baru',
                        nama: '',
                        nipAtauKeterangan: '',
                        urutan: prev.strukturOrganisasi.length + 1,
                      },
                    ],
                  }))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Jabatan</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(editing
              ? draft.strukturOrganisasi
              : [...profile.strukturOrganisasi].sort(
                  (a, b) => a.urutan - b.urutan,
                )
            ).map((person, idx) =>
              editing ? (
                <div
                  key={person.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      Posisi #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          strukturOrganisasi: prev.strukturOrganisasi.filter(
                            (_, i) => i !== idx,
                          ),
                        }))
                      }
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={person.jabatan}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        strukturOrganisasi: prev.strukturOrganisasi.map(
                          (s, i) =>
                            i === idx ? { ...s, jabatan: e.target.value } : s,
                        ),
                      }))
                    }
                    placeholder="Jabatan"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    value={person.nama}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        strukturOrganisasi: prev.strukturOrganisasi.map(
                          (s, i) =>
                            i === idx ? { ...s, nama: e.target.value } : s,
                        ),
                      }))
                    }
                    placeholder="Nama Pejabat"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                  <input
                    type="text"
                    value={person.nipAtauKeterangan}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        strukturOrganisasi: prev.strukturOrganisasi.map(
                          (s, i) =>
                            i === idx
                              ? { ...s, nipAtauKeterangan: e.target.value }
                              : s,
                        ),
                      }))
                    }
                    placeholder="Tugas pokok / keterangan"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
              ) : (
                <div
                  key={person.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-5"
                >
                  <p className="text-xs font-semibold tracking-wide text-[#1E40AF] uppercase">
                    {person.jabatan}
                  </p>
                  <h3 className="mt-1.5 text-base font-bold text-[#0B1D3A]">
                    {person.nama}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {person.nipAtauKeterangan}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
