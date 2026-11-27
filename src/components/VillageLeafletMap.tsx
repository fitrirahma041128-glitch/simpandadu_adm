import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed, Layers, Plus, Minus, Crosshair } from 'lucide-react';
import type { DusunInfo, MapConfig, VillageAsset } from '../types';

interface VillageLeafletMapProps {
  mapConfig: MapConfig;
  assets: VillageAsset[];
  heightClass?: string;
  pickMode?: boolean;
  onPickCoordinate?: (lat: number, lng: number) => void;
  onSelectAsset?: (asset: VillageAsset) => void;
  onSelectDusun?: (dusun: DusunInfo) => void;
  focusCoordinate?: { lat: number; lng: number } | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPinIcon(color: string, labelText: string, isBalai = false): L.DivIcon {
  const size = isBalai ? 34 : 26;
  const ring = isBalai ? 'border: 2px solid #C99A2E;' : 'border: 2px solid #FFFFFF;';
  return L.divIcon({
    className: 'simpandadu-map-pin',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};${ring}box-shadow:0 3px 10px rgba(11,29,58,0.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:700;font-size:${isBalai ? 12 : 10}px;font-family:'Plus Jakarta Sans',sans-serif;">${escapeHtml(labelText)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function VillageLeafletMap({
  mapConfig,
  assets,
  heightClass = 'h-[440px]',
  pickMode = false,
  onPickCoordinate,
  onSelectAsset,
  onSelectDusun,
  focusCoordinate = null,
}: VillageLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [baseLayer, setBaseLayer] = useState<'osm' | 'satellite'>('osm');
  const [zoomLevel, setZoomLevel] = useState<number>(mapConfig.defaultZoom || 14);

  const hasOfficialCenter =
    mapConfig.balaiDesaLat !== null && mapConfig.balaiDesaLng !== null;

  const assetsWithCoords = assets.filter(
    (a) => a.koordinat.lat !== null && a.koordinat.lng !== null,
  );
  const dusunWithCoords = mapConfig.dusunList.filter(
    (d) => d.lat !== null && d.lng !== null,
  );

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = hasOfficialCenter
      ? [mapConfig.balaiDesaLat as number, mapConfig.balaiDesaLng as number]
      : [-7.25, 110.0];
    const initialZoom = hasOfficialCenter ? mapConfig.defaultZoom || 14 : 6;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
    });

    const osmTile = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      },
    ).addTo(map);

    tileLayerRef.current = osmTile;
    const group = L.layerGroup().addTo(map);
    layersGroupRef.current = group;
    mapInstanceRef.current = map;
    setZoomLevel(map.getZoom());

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layersGroupRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Switch tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const url =
      baseLayer === 'osm'
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const attribution =
      baseLayer === 'osm'
        ? '&copy; OpenStreetMap contributors'
        : '&copy; Esri World Imagery';
    tileLayerRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(
      map,
    );
  }, [baseLayer]);

  // Handle pick mode click
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (pickMode && onPickCoordinate) {
        onPickCoordinate(
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        );
      }
    };
    map.on('click', handleClick);

    const container = map.getContainer();
    container.style.cursor = pickMode ? 'crosshair' : '';

    return () => {
      map.off('click', handleClick);
      container.style.cursor = '';
    };
  }, [pickMode, onPickCoordinate]);

  // Render markers and official boundary polygon
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Official boundary polygon
    if (mapConfig.boundaryCoordinates.length >= 3) {
      const polygon = L.polygon(mapConfig.boundaryCoordinates, {
        color: '#1E40AF',
        weight: 2.5,
        dashArray: '6 4',
        fillColor: '#1D4ED8',
        fillOpacity: 0.08,
      });
      polygon.bindPopup(
        '<div style="font-size:12px;"><strong>Batas Wilayah Resmi Desa Adimulya</strong><br/>Sumber: Data Koordinat Resmi</div>',
      );
      group.addLayer(polygon);
    }

    // Balai Desa marker
    if (mapConfig.balaiDesaLat !== null && mapConfig.balaiDesaLng !== null) {
      const balaiMarker = L.marker(
        [mapConfig.balaiDesaLat, mapConfig.balaiDesaLng],
        {
          icon: createPinIcon('#0B1D3A', 'BD', true),
        },
      );
      balaiMarker.bindPopup(
        `<div style="font-size:12px;line-height:1.45;">
          <strong style="color:#0B1D3A;">Balai Desa Adimulya</strong><br/>
          <span>Pusat Pemerintahan Desa</span><br/>
          <span style="font-family:monospace;font-size:11px;color:#475569;">${mapConfig.balaiDesaLat.toFixed(6)}, ${mapConfig.balaiDesaLng.toFixed(6)}</span>
        </div>`,
      );
      group.addLayer(balaiMarker);
    }

    // Dusun markers
    for (const dusun of dusunWithCoords) {
      const marker = L.marker([dusun.lat as number, dusun.lng as number], {
        icon: createPinIcon('#1D4ED8', 'D'),
      });
      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.45;">
          <strong style="color:#1E40AF;">${escapeHtml(dusun.nama)}</strong><br/>
          <span>Kepala Dusun: ${escapeHtml(dusun.kepalaDusun)}</span><br/>
          <span>${dusun.jumlahRW} RW · ${dusun.jumlahRT} RT</span>
        </div>`,
      );
      marker.on('click', () => {
        if (onSelectDusun) onSelectDusun(dusun);
      });
      group.addLayer(marker);
    }

    // Asset markers
    for (const asset of assetsWithCoords) {
      const color =
        asset.kondisi === 'Baik'
          ? '#15803D'
          : asset.kondisi === 'Perlu Perbaikan'
            ? '#B45309'
            : '#B91C1C';
      const marker = L.marker(
        [asset.koordinat.lat as number, asset.koordinat.lng as number],
        {
          icon: createPinIcon(color, 'A'),
        },
      );
      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.45;min-width:180px;">
          <strong style="color:#0F172A;">${escapeHtml(asset.nama)}</strong><br/>
          <span>${escapeHtml(asset.kategori)} · ${escapeHtml(asset.kondisi)}</span><br/>
          <span>Lokasi: ${escapeHtml(asset.lokasi)}</span><br/>
          <span>Jumlah: ${asset.jumlah} ${escapeHtml(asset.satuan)}</span>
        </div>`,
      );
      marker.on('click', () => {
        if (onSelectAsset) onSelectAsset(asset);
      });
      group.addLayer(marker);
    }
  }, [mapConfig, assets, onSelectAsset, onSelectDusun]);

  // Focus map when center or focusCoordinate changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (focusCoordinate) {
      map.setView([focusCoordinate.lat, focusCoordinate.lng], 16, {
        animate: true,
      });
    } else if (
      mapConfig.balaiDesaLat !== null &&
      mapConfig.balaiDesaLng !== null
    ) {
      map.setView(
        [mapConfig.balaiDesaLat, mapConfig.balaiDesaLng],
        mapConfig.defaultZoom || 14,
      );
    }
  }, [
    focusCoordinate,
    mapConfig.balaiDesaLat,
    mapConfig.balaiDesaLng,
    mapConfig.defaultZoom,
  ]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (mapConfig.balaiDesaLat !== null && mapConfig.balaiDesaLng !== null) {
      map.setView(
        [mapConfig.balaiDesaLat, mapConfig.balaiDesaLng],
        mapConfig.defaultZoom || 14,
        { animate: true },
      );
    } else {
      map.setView([-7.25, 110.0], 6, { animate: true });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className={`w-full ${heightClass}`} />

      {/* Map Controls Top Right */}
      <div className="no-print absolute top-3 right-3 z-[400] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Perbesar peta (Zoom In)"
          aria-label="Perbesar peta"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Perkecil peta (Zoom Out)"
          aria-label="Perkecil peta"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          title="Pusatkan ke Balai Desa"
          aria-label="Pusatkan ke Balai Desa"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() =>
            setBaseLayer((prev) => (prev === 'osm' ? 'satellite' : 'osm'))
          }
          title={
            baseLayer === 'osm'
              ? 'Beralih ke Citra Satelit'
              : 'Beralih ke Peta Jalan OpenStreetMap'
          }
          aria-label="Ganti layer peta"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* Pick Mode Prompt */}
      {pickMode && (
        <div className="no-print absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-950/90 px-3 py-2 text-xs font-medium text-white shadow-md">
          <Crosshair className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Klik titik mana saja pada peta untuk mengambil koordinat resmi</span>
        </div>
      )}

      {/* Unconfigured Official Coordinates Notice */}
      {!hasOfficialCenter && !pickMode && (
        <div className="no-print pointer-events-none absolute top-3 left-3 right-14 z-[400] max-w-md rounded-lg border border-amber-200 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-xs">
          <p className="text-xs font-semibold text-slate-900">
            Koordinat Resmi Desa Adimulya Belum Diisi
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Sistem tidak menampilkan titik koordinat atau batas wilayah fiktif. Silakan masukkan koordinat resmi Balai Desa, dusun, atau batas wilayah melalui panel pengaturan koordinat.
          </p>
        </div>
      )}

      {/* Bottom Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0B1D3A] ring-1 ring-[#C99A2E]" />
            Balai Desa
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1D4ED8]" />
            Dusun ({dusunWithCoords.length})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#15803D]" />
            Aset Baik
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#B45309]" />
            Perlu Perbaikan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#B91C1C]" />
            Rusak Berat
          </span>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-slate-500">
          {baseLayer === 'osm' ? 'OpenStreetMap' : 'Citra Satelit'} · Zoom {zoomLevel}
        </span>
      </div>
    </div>
  );
}
