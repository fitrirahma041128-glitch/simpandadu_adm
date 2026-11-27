import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  KeyRound,
  UserCog,
  Info,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import type { SecurityNotificationItem } from '../types';

interface NotificationBellProps {
  notifications: SecurityNotificationItem[];
  unreadCount: number;
  onRefresh: () => void;
  onOpenAccountSecurity: () => void;
}

function getNotificationIcon(type: SecurityNotificationItem['type']) {
  switch (type) {
    case 'login_success':
      return <CheckCircle2 className="h-4 w-4 text-emerald-700" />;
    case 'login_denied':
      return <XCircle className="h-4 w-4 text-red-700" />;
    case 'login_attempt':
    case 'login_confirmation_request':
      return <ShieldAlert className="h-4 w-4 text-amber-700" />;
    case 'password_changed':
      return <KeyRound className="h-4 w-4 text-[#1E40AF]" />;
    case 'profile_updated':
      return <UserCog className="h-4 w-4 text-[#1E40AF]" />;
    default:
      return <Info className="h-4 w-4 text-slate-600" />;
  }
}

function formatRelativeOrDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationBell({
  notifications,
  unreadCount,
  onRefresh,
  onOpenAccountSecurity,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleMarkOne = async (id: string, isRead: boolean) => {
    if (isRead) return;
    try {
      await api.markNotificationRead(id);
      onRefresh();
    } catch {
      // ignore transient errors
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    setMarking(true);
    try {
      await api.markAllNotificationsRead();
      onRefresh();
    } finally {
      setMarking(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) onRefresh();
        }}
        aria-label={`Notifikasi keamanan (${unreadCount} belum dibaca)`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:outline-none"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-[#B91C1C] px-1 font-mono text-[11px] font-bold tabular-nums text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#0B1D3A]">
                Notifikasi Keamanan
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                {unreadCount} belum dibaca · {notifications.length} terbaru
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={marking}
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-slate-100 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Tandai dibaca</span>
              </button>
            )}
          </div>

          <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                Belum ada notifikasi aktivitas keamanan akun.
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleMarkOne(item.id, item.isRead)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    item.isRead ? 'bg-white' : 'bg-blue-50/40'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-xs font-semibold ${
                          item.isRead ? 'text-slate-800' : 'text-[#0B1D3A]'
                        }`}
                      >
                        {item.title}
                      </p>
                      {!item.isRead && (
                        <span className="shrink-0 text-[10px] font-semibold text-[#1D4ED8]">
                          Baru
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      {item.message}
                    </p>
                    <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-400">
                      {formatRelativeOrDate(item.createdAt)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenAccountSecurity();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-slate-50"
            >
              <span>Lihat Riwayat & Profil Akun</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
