import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Map as MapIcon,
  Package,
  Newspaper,
  ClipboardList,
  UserCircle,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { ASSET_IMAGES } from './constants';
import { api, setInMemoryToken } from './lib/api';
import { ToastContainer, type ToastItem, type ToastType } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { CitizenMusrenbangPortal } from './components/CitizenMusrenbangPortal';
import { LoginPage } from './components/LoginPage';
import { EmailActionHandlerPage } from './components/EmailActionHandlerPage';
import { NotificationBell } from './components/NotificationBell';
import { DashboardPage } from './components/DashboardPage';
import { PetaDesaPage } from './components/PetaDesaPage';
import { DataAsetPage } from './components/DataAsetPage';
import { BeritaIndonesiaPage } from './components/BeritaIndonesiaPage';
import { MusrenbangPage } from './components/MusrenbangPage';
import { ProfilAkunPage } from './components/ProfilAkunPage';
import type {
  AdminUser,
  AppPage,
  MapConfig,
  MusrenbangProposal,
  NewsArticle,
  NewsResponse,
  SecurityNotificationItem,
  VillageAsset,
  VillageProfile,
} from './types';

const NAV_ITEMS: Array<{
  id: AppPage;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'peta', label: 'Peta Desa', icon: MapIcon },
  { id: 'aset', label: 'Data Aset', icon: Package },
  { id: 'berita', label: 'Berita Indonesia', icon: Newspaper },
  { id: 'musrenbang', label: 'Musrenbang', icon: ClipboardList },
  { id: 'profil', label: 'Profil Akun', icon: UserCircle },
];

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(true);
  const [envManaged, setEnvManaged] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [publicView, setPublicView] = useState<'citizen' | 'login'>('citizen');

  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [dataLoading, setDataLoading] = useState(false);
  const [assets, setAssets] = useState<VillageAsset[]>([]);
  const [proposals, setProposals] = useState<MusrenbangProposal[]>([]);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [profile, setProfile] = useState<VillageProfile | null>(null);
  const [newsData, setNewsData] = useState<NewsResponse>({
    articles: [],
    isDemoFallback: false,
    lastUpdated: new Date().toISOString(),
    sourcesChecked: [],
  });
  const [newsLoading, setNewsLoading] = useState(false);
  const [selectedNewsArticle, setSelectedNewsArticle] =
    useState<NewsArticle | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [logoFailed, setLogoFailed] = useState(false);

  // Notifications & Avatar state
  const [notifications, setNotifications] = useState<SecurityNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Email one-time action links from URL query
  const [emailActionParams, setEmailActionParams] = useState<{
    loginConfirmToken?: string;
    loginConfirmAction?: 'approve' | 'deny';
    verifyEmailToken?: string;
  } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const loginConfirm = params.get('loginConfirm');
    const actionParam = params.get('action') === 'deny' ? 'deny' : 'approve';
    const verifyEmail = params.get('verifyEmail');
    if (loginConfirm) {
      return { loginConfirmToken: loginConfirm, loginConfirmAction: actionParam };
    }
    if (verifyEmail) {
      return { verifyEmailToken: verifyEmail };
    }
    return null;
  });

  const notify = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    [],
  );

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.fetchNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore transient errors
    }
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [assetsRes, proposalsRes, mapRes, profileRes, newsRes, notifRes] =
        await Promise.all([
          api.fetchAssets(),
          api.fetchProposals(),
          api.fetchMapConfig(),
          api.fetchProfile(),
          api.fetchNews(false),
          api.fetchNotifications().catch(() => ({ notifications: [], unreadCount: 0 })),
        ]);
      setAssets(assetsRes.assets);
      setProposals(proposalsRes.proposals);
      setMapConfig(mapRes.mapConfig);
      setProfile(profileRes.profile);
      setNewsData(newsRes);
      setNotifications(notifRes.notifications);
      setUnreadCount(notifRes.unreadCount);
    } catch (err) {
      notify(
        'error',
        'Gagal Memuat Data Sistem',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setDataLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await api.getAuthStatus();
        if (!active) return;
        setAuthInitialized(status.initialized);
        setEnvManaged(status.envManaged);

        try {
          const me = await api.getMe();
          if (!active) return;
          setUser(me.user);
          await loadWorkspaceData();
        } catch {
          if (!active) return;
          setUser(null);
        }
      } catch {
        // fallback state
      } finally {
        if (active) setAuthChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadWorkspaceData]);

  // Periodically refresh notifications while logged in
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      loadNotifications();
    }, 25000);
    return () => window.clearInterval(timer);
  }, [user, loadNotifications]);

  // Sync admin avatar blob URL whenever avatar changes
  useEffect(() => {
    if (!user || !user.hasAvatar) {
      setAvatarUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let active = true;
    api
      .fetchAvatarBlobUrl()
      .then((blobUrl) => {
        if (!active) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }
        setAvatarUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return blobUrl;
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const handleLoginSuccess = async (
    loggedInUser: AdminUser,
    isFirstSetup = false,
  ) => {
    if (isFirstSetup) {
      setAuthInitialized(true);
    }
    setUser(loggedInUser);
    setActivePage('dashboard');
    await loadWorkspaceData();
  };

  const handleRefreshNews = async () => {
    setNewsLoading(true);
    try {
      const fresh = await api.fetchNews(true);
      setNewsData(fresh);
      notify(
        fresh.isDemoFallback ? 'info' : 'success',
        fresh.isDemoFallback
          ? 'RSS Eksternal Belum Tersedia'
          : 'Berita Indonesia Diperbarui',
        fresh.isDemoFallback
          ? 'Menampilkan struktur data DEMO karena feed eksternal tidak dapat diakses saat ini.'
          : `${fresh.articles.length} berita terbaru berhasil dimuat.`,
      );
    } catch (err) {
      notify(
        'error',
        'Gagal Memperbarui Berita',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setNewsLoading(false);
    }
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
      setInMemoryToken(null);
      setUser(null);
      setNotifications([]);
      setUnreadCount(0);
      setPublicView('login');
      setLogoutModalOpen(false);
      setMobileMenuOpen(false);
      setSelectedNewsArticle(null);
      notify('info', 'Anda Telah Keluar', 'Sesi SIMPANDADU telah diakhiri.');
    } catch {
      setInMemoryToken(null);
      setUser(null);
      setNotifications([]);
      setUnreadCount(0);
      setPublicView('login');
      setLogoutModalOpen(false);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleNavigate = (page: AppPage) => {
    setActivePage(page);
    setMobileMenuOpen(false);
    if (page !== 'berita') {
      setSelectedNewsArticle(null);
    }
  };

  if (emailActionParams) {
    return (
      <>
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) =>
            setToasts((prev) => prev.filter((t) => t.id !== id))
          }
        />
        <EmailActionHandlerPage
          loginConfirmToken={emailActionParams.loginConfirmToken}
          loginConfirmAction={emailActionParams.loginConfirmAction}
          verifyEmailToken={emailActionParams.verifyEmailToken}
          onFinishToApp={async () => {
            window.history.replaceState({}, '', window.location.pathname);
            setEmailActionParams(null);
            if (user) {
              try {
                const me = await api.getMe();
                setUser(me.user);
                await loadNotifications();
              } catch {
                // ignore
              }
            }
          }}
          onNotify={notify}
        />
      </>
    );
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-[#0B1D3A]" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Memuat SIMPANDADU...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) =>
            setToasts((prev) => prev.filter((t) => t.id !== id))
          }
        />
        {publicView === 'citizen' ? (
          <CitizenMusrenbangPortal
            onGoToAdminLogin={() => setPublicView('login')}
            onNotify={notify}
          />
        ) : (
          <LoginPage
            initialized={authInitialized}
            envManaged={envManaged}
            onLoginSuccess={handleLoginSuccess}
            onBackToCitizenPortal={() => setPublicView('citizen')}
            onNotify={notify}
          />
        )}
      </>
    );
  }

  const currentNavLabel =
    NAV_ITEMS.find((item) => item.id === activePage)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />

      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-[264px] shrink-0 flex-col bg-[#0B1D3A] text-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Block */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            {!logoFailed ? (
              <img
                src={ASSET_IMAGES.logo}
                alt="Lambang Desa Adimulya"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="h-10 w-10 rounded-lg border border-[#C99A2E]/60 bg-white object-contain p-0.5"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#C99A2E]/60 bg-[#122B54] text-[#E5B84B]">
                <ShieldCheck className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-white">
                SIMPANDADU
              </p>
              <p className="truncate text-[11px] text-[#E5B84B]">
                Desa Adimulya
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Tutup menu navigasi"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav
          aria-label="Navigasi utama SIMPANDADU"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1D4ED8] text-white shadow-xs'
                    : 'text-slate-300 hover:bg-[#122B54] hover:text-white'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-[#FDE68A]' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Admin Account & Logout */}
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={() => handleNavigate('profil')}
            className="mb-3 flex w-full items-center gap-2.5 rounded-lg bg-[#122B54] px-3 py-2.5 text-left transition-colors hover:bg-[#19386B]"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.fullName}
                className="h-9 w-9 shrink-0 rounded-lg border border-[#C99A2E]/50 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0B1D3A] text-xs font-bold text-[#E5B84B]">
                {user.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {user.fullName}
              </p>
              <p className="truncate text-[11px] text-slate-300">
                @{user.username} · {user.jabatan || user.role}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-transparent px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-red-700/90 hover:border-red-600 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar (3-zone layout with Notification Bell) */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xs sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0B1D3A]">
                SIMPANDADU <span className="text-slate-400">/</span>{' '}
                <span className="text-[#1E40AF]">{currentNavLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onRefresh={loadNotifications}
              onOpenAccountSecurity={() => handleNavigate('profil')}
            />
            <button
              type="button"
              onClick={() => handleNavigate('profil')}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex whitespace-nowrap"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.fullName}
                  className="h-6 w-6 rounded-md object-cover"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0B1D3A] text-[10px] font-bold text-[#E5B84B]">
                  {user.fullName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="max-w-[140px] truncate">{user.fullName}</span>
            </button>
            <button
              type="button"
              onClick={() => setLogoutModalOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-6 lg:p-8">
          {dataLoading || !mapConfig || !profile ? (
            <div className="space-y-4">
              <div className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
              </div>
              <div className="h-80 animate-pulse rounded-xl bg-slate-200/70" />
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardPage
                  user={user}
                  assets={assets}
                  proposals={proposals}
                  news={newsData.articles}
                  newsIsDemo={newsData.isDemoFallback}
                  mapConfig={mapConfig}
                  onNavigate={handleNavigate}
                  onSelectNewsArticle={(article) =>
                    setSelectedNewsArticle(article)
                  }
                />
              )}

              {activePage === 'peta' && (
                <PetaDesaPage
                  mapConfig={mapConfig}
                  assets={assets}
                  onMapConfigUpdated={setMapConfig}
                  onNotify={notify}
                />
              )}

              {activePage === 'aset' && (
                <DataAsetPage
                  assets={assets}
                  onAssetsChange={setAssets}
                  onNotify={notify}
                />
              )}

              {activePage === 'berita' && (
                <BeritaIndonesiaPage
                  newsData={newsData}
                  loading={newsLoading}
                  selectedArticle={selectedNewsArticle}
                  onSelectArticle={setSelectedNewsArticle}
                  onRefreshNews={handleRefreshNews}
                />
              )}

              {activePage === 'musrenbang' && (
                <MusrenbangPage
                  proposals={proposals}
                  onProposalsChange={setProposals}
                  onNotify={notify}
                />
              )}

              {activePage === 'profil' && (
                <ProfilAkunPage
                  user={user}
                  onUserUpdated={setUser}
                  onNotificationsRefresh={loadNotifications}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </main>
      </div>

      <ConfirmModal
        open={logoutModalOpen}
        title="Konfirmasi Keluar dari Sistem"
        description="Apakah Anda yakin ingin keluar dari SIMPANDADU? Anda perlu masuk kembali untuk mengakses menu pengelolaan Desa Adimulya."
        confirmLabel="Ya, Keluar"
        cancelLabel="Tetap di Sistem"
        variant="primary"
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutModalOpen(false)}
      />
    </div>
  );
}
