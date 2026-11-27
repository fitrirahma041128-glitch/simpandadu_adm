import { useState } from 'react';
import {
  MapPin,
  Compass,
  Crosshair,
  Save,
  Plus,
  Trash2,
  Building2,
} from 'lucide-react';
import { VillageLeafletMap } from './VillageLeafletMap';
import { api } from '../lib/api';
import type { DusunInfo, MapConfig, VillageAsset } from '../types';

interface PetaDesaPageProps {
  mapConfig: MapConfig;
  assets: VillageAsset[];
  onMapConfigUpdated: (next: MapConfig) => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export function PetaDesaPage({
  mapConfig,
  assets,
  onMapConfigUpdated,
  onNotify,
}: PetaDesaPageProps) {
  const [selectedAsset, setSelectedAsset] = useState<VillageAsset | null>(null);
  const [selectedDusun, setSelectedDusun] = useState<DusunInfo | null>(null);
  const [focusCoord, setFocusCoord] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  // Coordinate editing state
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [pickTarget, setPickTarget] = useState<'balai' | string | null>(null);
  const [draft, setDraft] = useState<MapConfig>(mapConfig);
  const [boundaryText, setBoundaryText] = useState(() =>
    mapConfig.boundaryCoordinates
      .map(([lat, lng]) => `${lat}, ${lng}`)
      .join('\n'),
  );
  const [saving, setSaving] = useState(false);

  const openEditor = () => {
    setDraft(JSON.parse(JSON.stringify(mapConfig)) as MapConfig);
    setBoundaryText(
      mapConfig.boundaryCoordinates
        .map(([lat, lng]) => `${lat}, ${lng}`)
        .join('\n'),
    );
    setShowConfigPanel(true);
  };

  const handlePickFromMap = (lat: number, lng: number) => {
    if (pickTarget === 'balai') {
      setDraft((prev) => ({
        ...prev,
        balaiDesaLat: lat,
        balaiDesaLng: lng,
      }));
      onNotify(
        'info',
        'Koordinat Balai Desa Diambil',
        `Lat: ${lat}, Lng: ${lng}. Klik Simpan Pengaturan Peta untuk menerapkan.`,
      );
    } else if (pickTarget) {
      setDraft((prev) => ({
        ...prev,
        dusunList: prev.dusunList.map((d) =>
          d.id === pickTarget ? { ...d, lat, lng } : d,
        ),
      }));
      onNotify(
        'info',
        'Koordinat Dusun Diambil',
        `Lat: ${lat}, Lng: ${lng}. Klik Simpan Pengaturan Peta untuk menerapkan.`,
      );
    }
    setPickTarget(null);
  };

  const parseBoundaryText = (raw: string): Array<[number, number]> => {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const coords: Array<[number, number]> = [];
    for (const line of lines) {
      const parts = line.split(/[,\s;]+/).map((p) => Number(p.trim()));
      if (
        parts.length >= 2 &&
        Number.isFinite(parts[0]) &&
        Number.isFinite(parts[1]) &&
        parts[0] >= -90 &&
        parts[0] <= 90 &&
        parts[1] >= -180 &&
        parts[1] <= 180
      ) {
        coords.push([parts[0], parts[1]]);
      }
    }
    return coords;
  };

  const handleAddDusun = () => {
    const newId = `dsn-${Date.now().toString().slice(-5)}`;
    setDraft((prev) => ({
      ...prev,
      dusunList: [
        ...prev.dusunList,
        {
          id: newId,
          nama: `Dusun Baru`,
          kepalaDusun: '',
          jumlahRW: 1,
          jumlahRT: 2,
          lat: null,
          lng: null,
          keterangan: '',
        },
      ],
    }));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const parsedBoundary = parseBoundaryText(boundaryText);
      const payload: MapConfig = {
        ...draft,
        boundaryCoordinates: parsedBoundary,
      };
      const res = await api.updateMapConfig(payload);
      onMapConfigUpdated(res.mapConfig);
      setShowConfigPanel(false);
      setPickTarget(null);
      onNotify(
        'success',
        'Koordinat & Batas Wilayah Disimpan',
        'Peta Desa Adimulya telah diperbarui sesuai data resmi.',
      );
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menyimpan Pengaturan Peta',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  const assetsWithCoords = assets.filter(
    (a) => a.koordinat.lat !== null && a.koordinat.lng !== null,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1D3A]">
            Peta Wilayah &amp; Sebaran Aset Desa Adimulya
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Peta interaktif berbasis Leaflet dan OpenStreetMap. Seluruh koordinat mengikuti data resmi yang diinput perangkat desa.
          </p>
        </div>
        <button
          type="button"
          onClick={showConfigPanel ? () => setShowConfigPanel(false) : openEditor}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] whitespace-nowrap shrink-0"
        >
          <Compass className="h-4 w-4" />
          <span>
            {showConfigPanel
              ? 'Tutup Editor Koordinat'
              : 'Input Koordinat Resmi'}
          </span>
        </button>
      </div>

      {/* Main Map + Side Detail Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-4">
          <VillageLeafletMap
            mapConfig={showConfigPanel ? draft : mapConfig}
            assets={assets}
            heightClass="h-[500px]"
            pickMode={pickTarget !== null}
            onPickCoordinate={handlePickFromMap}
            onSelectAsset={(asset) => {
              setSelectedAsset(asset);
              setSelectedDusun(null);
            }}
            onSelectDusun={(dusun) => {
              setSelectedDusun(dusun);
              setSelectedAsset(null);
            }}
            focusCoordinate={focusCoord}
          />

          {/* Official Boundary Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-[#0B1D3A]">
              Informasi Batas Wilayah Administratif Desa Adimulya
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Sebelah Utara</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {mapConfig.batasUtara}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Sebelah Selatan</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {mapConfig.batasSelatan}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Sebelah Timur</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {mapConfig.batasTimur}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Sebelah Barat</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {mapConfig.batasBarat}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Selected Marker Info + Dusun List */}
        <div className="space-y-4 xl:col-span-4">
          {/* Selected Pin Detail */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-[#0B1D3A]">
              Detail Penanda Lokasi Terpilih
            </h2>
            {selectedAsset ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-semibold text-slate-900">
                  {selectedAsset.nama}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedAsset.kategori} · Kondisi: {selectedAsset.kondisi}
                </p>
                <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-700">
                  <p>
                    <span className="font-semibold">Lokasi:</span>{' '}
                    {selectedAsset.lokasi}
                  </p>
                  <p>
                    <span className="font-semibold">Tahun Perolehan:</span>{' '}
                    {selectedAsset.tahunPerolehan}
                  </p>
                  <p>
                    <span className="font-semibold">Jumlah:</span>{' '}
                    {selectedAsset.jumlah} {selectedAsset.satuan}
                  </p>
                  <p className="font-mono tabular-nums">
                    <span className="font-sans font-semibold">Koordinat:</span>{' '}
                    {selectedAsset.koordinat.lat}, {selectedAsset.koordinat.lng}
                  </p>
                  <p>
                    <span className="font-semibold">Keterangan:</span>{' '}
                    {selectedAsset.keterangan || '-'}
                  </p>
                </div>
              </div>
            ) : selectedDusun ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-semibold text-slate-900">
                  {selectedDusun.nama}
                </p>
                <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-700">
                  <p>
                    <span className="font-semibold">Kepala Dusun:</span>{' '}
                    {selectedDusun.kepalaDusun || '-'}
                  </p>
                  <p>
                    <span className="font-semibold">Wilayah:</span>{' '}
                    {selectedDusun.jumlahRW} RW · {selectedDusun.jumlahRT} RT
                  </p>
                  <p className="font-mono tabular-nums">
                    <span className="font-sans font-semibold">Koordinat:</span>{' '}
                    {selectedDusun.lat}, {selectedDusun.lng}
                  </p>
                  <p>{selectedDusun.keterangan}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Klik salah satu penanda pada peta atau pilih dusun/aset di bawah untuk melihat rincian lokasinya.
              </p>
            )}
          </div>

          {/* Dusun List */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold text-[#0B1D3A]">
              Informasi Wilayah per Dusun
            </h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {mapConfig.dusunList.map((d) => (
                <li key={d.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {d.nama}
                      </p>
                      <p className="text-xs text-slate-500">
                        Kadus: {d.kepalaDusun || '-'} · {d.jumlahRW} RW /{' '}
                        {d.jumlahRT} RT
                      </p>
                      {d.lat !== null && d.lng !== null ? (
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-emerald-700">
                          {d.lat}, {d.lng}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          Koordinat resmi belum diisi
                        </p>
                      )}
                    </div>
                    {d.lat !== null && d.lng !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setFocusCoord({ lat: d.lat!, lng: d.lng! });
                          setSelectedDusun(d);
                          setSelectedAsset(null);
                        }}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-slate-50 whitespace-nowrap"
                      >
                        Fokus
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Geotagged Assets */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0B1D3A]">
                Aset dengan Koordinat Resmi
              </h2>
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-600">
                {assetsWithCoords.length}/{assets.length}
              </span>
            </div>
            {assetsWithCoords.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Belum ada aset yang memiliki koordinat GPS. Tambahkan koordinat resmi pada menu Data Aset saat menambah atau mengedit aset.
              </p>
            ) : (
              <ul className="mt-3 max-h-52 divide-y divide-slate-100 overflow-y-auto">
                {assetsWithCoords.map((a) => (
                  <li key={a.id} className="py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusCoord({
                          lat: a.koordinat.lat!,
                          lng: a.koordinat.lng!,
                        });
                        setSelectedAsset(a);
                        setSelectedDusun(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 text-left text-xs hover:text-[#1D4ED8]"
                    >
                      <span className="truncate font-medium text-slate-800">
                        {a.nama}
                      </span>
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Official Coordinates & Boundaries Form */}
      {showConfigPanel && (
        <form
          onSubmit={handleSaveConfig}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-5 w-5 text-[#1E40AF]" />
              <div>
                <h2 className="text-base font-bold text-[#0B1D3A]">
                  Pengaturan Koordinat Resmi Balai Desa, Dusun &amp; Batas Wilayah
                </h2>
                <p className="text-xs text-slate-500">
                  Masukkan koordinat GPS resmi (lintang/bujur) atau klik tombol &ldquo;Pilih di Peta&rdquo; lalu klik lokasi pada peta di atas.
                </p>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Peta'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Balai Desa Center + Batas Administratif */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Titik Pusat Balai Desa Adimulya
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setPickTarget(pickTarget === 'balai' ? null : 'balai')
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    pickTarget === 'balai'
                      ? 'border-[#1D4ED8] bg-blue-50 text-[#1D4ED8]'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  <span>
                    {pickTarget === 'balai' ? 'Batal Pilih' : 'Pilih di Peta'}
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={draft.balaiDesaLat ?? ''}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        balaiDesaLat:
                          e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="-7.xxxxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={draft.balaiDesaLng ?? ''}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        balaiDesaLng:
                          e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="109.xxxxxx"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Zoom Awal
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={19}
                    value={draft.defaultZoom}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        defaultZoom: Number(e.target.value) || 14,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <h3 className="pt-2 text-sm font-semibold text-slate-900">
                Batas Wilayah Administratif
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Batas Utara
                  </label>
                  <input
                    type="text"
                    value={draft.batasUtara}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, batasUtara: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Batas Selatan
                  </label>
                  <input
                    type="text"
                    value={draft.batasSelatan}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        batasSelatan: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Batas Timur
                  </label>
                  <input
                    type="text"
                    value={draft.batasTimur}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, batasTimur: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Batas Barat
                  </label>
                  <input
                    type="text"
                    value={draft.batasBarat}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, batasBarat: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Koordinat Poligon Batas Resmi (1 pasang lat, lng per baris)
                </label>
                <textarea
                  rows={4}
                  value={boundaryText}
                  onChange={(e) => setBoundaryText(e.target.value)}
                  placeholder={'Contoh format:\n-7.123456, 109.123456\n-7.124456, 109.125456\n-7.125456, 109.122456'}
                  className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
                />
              </div>
            </div>

            {/* Dusun Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Daftar Dusun &amp; Koordinat Resmi
                </h3>
                <button
                  type="button"
                  onClick={handleAddDusun}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Dusun</span>
                </button>
              </div>
              <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
                {draft.dusunList.map((d, index) => (
                  <div
                    key={d.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Dusun #{index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPickTarget(pickTarget === d.id ? null : d.id)
                          }
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                            pickTarget === d.id
                              ? 'border-[#1D4ED8] bg-blue-100 text-[#1D4ED8]'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                        >
                          <Crosshair className="h-3 w-3" />
                          <span>
                            {pickTarget === d.id ? 'Klik Peta...' : 'Ambil Titik'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              dusunList: prev.dusunList.filter(
                                (item) => item.id !== d.id,
                              ),
                            }))
                          }
                          aria-label="Hapus dusun"
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={d.nama}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dusunList: prev.dusunList.map((item) =>
                              item.id === d.id
                                ? { ...item, nama: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        placeholder="Nama Dusun"
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={d.kepalaDusun}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dusunList: prev.dusunList.map((item) =>
                              item.id === d.id
                                ? { ...item, kepalaDusun: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        placeholder="Nama Kepala Dusun"
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="number"
                        min={0}
                        value={d.jumlahRW}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dusunList: prev.dusunList.map((item) =>
                              item.id === d.id
                                ? { ...item, jumlahRW: Number(e.target.value) }
                                : item,
                            ),
                          }))
                        }
                        placeholder="RW"
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        value={d.jumlahRT}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dusunList: prev.dusunList.map((item) =>
                              item.id === d.id
                                ? { ...item, jumlahRT: Number(e.target.value) }
                                : item,
                            ),
                          }))
                        }
                        placeholder="RT"
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        step="any"
                        value={d.lat ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dusunList: prev.dusunList.map((item) =>
                              item.id === d.id
                                ? {
                                    ...item,
                                    lat:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  }
                                : item,
                            ),
                          }))
                        }
                        placeholder="Lat"
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                      />
                      <input
                        type="number"
                        step="any"
                        value={d.lng ?? ''}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            dusunList: prev.dusunList.map((item) =>
                              item.id === d.id
                                ? {
                                    ...item,
                                    lng:
                                      e.target.value === ''
                                        ? null
                                        : Number(e.target.value),
                                  }
                                : item,
                            ),
                          }))
                        }
                        placeholder="Lng"
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
