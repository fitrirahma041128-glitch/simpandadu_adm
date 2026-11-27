import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  History,
  Camera,
  Trash2,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  MonitorSmartphone,
  Send,
  KeyRound,
  RefreshCw,
  X,
} from 'lucide-react';
import { api, setInMemoryToken, type AccountProfileBundle } from '../lib/api';
import type { AdminUser, SecurityActivityItem } from '../types';

interface ProfilAkunPageProps {
  user: AdminUser;
  onUserUpdated: (nextUser: AdminUser) => void;
  onNotificationsRefresh: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

type AccountTab = 'profil' | 'email-password' | 'keamanan' | 'riwayat';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ProfilAkunPage({
  user,
  onUserUpdated,
  onNotificationsRefresh,
  onNotify,
}: ProfilAkunPageProps) {
  const [activeTab, setActiveTab] = useState<AccountTab>('profil');
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<AccountProfileBundle | null>(null);
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null);

  // Edit profile form
  const [fullName, setFullName] = useState(user.fullName);
  const [username, setUsername] = useState(user.username);
  const [phone, setPhone] = useState(user.phone || '');
  const [jabatan, setJabatan] = useState(user.jabatan || user.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Change password form
  const [currentPasswordPw, setCurrentPasswordPw] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrPw, setShowCurrPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Change email form
  const [newEmailInput, setNewEmailInput] = useState('');
  const [currentPasswordEmail, setCurrentPasswordEmail] = useState('');
  const [requestingEmail, setRequestingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Security settings form
  const [reqEmailApproval, setReqEmailApproval] = useState(true);
  const [approvalPolicy, setApprovalPolicy] = useState<'new_device' | 'every_login'>('new_device');
  const [ttlMinutes, setTtlMinutes] = useState(10);
  const [notifyLoginSuccess, setNotifyLoginSuccess] = useState(true);
  const [notifySecChange, setNotifySecChange] = useState(true);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);

  // Activity filter
  const [activityFilter, setActivityFilter] = useState<string>('Semua');

  const loadAccountData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchAccountProfile();
      setBundle(data);
      setFullName(data.profile.fullName);
      setUsername(data.profile.username);
      setPhone(data.profile.phone || '');
      setJabatan(data.profile.jabatan || data.profile.role);
      setReqEmailApproval(data.profile.requireEmailLoginApproval);
      setApprovalPolicy(data.profile.approvalPolicy);
      setTtlMinutes(data.profile.loginApprovalTtlMinutes);
      setNotifyLoginSuccess(data.profile.notifyOnLoginSuccess);
      setNotifySecChange(data.profile.notifyOnSecurityChange);

      if (data.profile.hasAvatar) {
        const blob = await api.fetchAvatarBlobUrl().catch(() => null);
        setAvatarBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return blob;
        });
      } else {
        setAvatarBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    } catch (err) {
      onNotify(
        'error',
        'Gagal Memuat Profil Akun',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadAccountData();
  }, [loadAccountData]);

  useEffect(() => {
    return () => {
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl);
      }
    };
  }, [avatarBlobUrl]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      onNotify('error', 'Format Tidak Didukung', 'Gunakan foto JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onNotify('error', 'Ukuran Terlalu Besar', 'Ukuran foto profil maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setUploadingAvatar(true);
      try {
        const res = await api.uploadAvatar(dataUrl);
        onUserUpdated(res.user);
        onNotify('success', 'Foto Profil Diperbarui', 'Foto profil akun berhasil disimpan.');
        await loadAccountData();
        onNotificationsRefresh();
      } catch (err) {
        onNotify(
          'error',
          'Gagal Mengunggah Foto',
          err instanceof Error ? err.message : undefined,
        );
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await api.deleteAvatar();
      onUserUpdated(res.user);
      onNotify('info', 'Foto Profil Dihapus', 'Foto profil dikembalikan ke inisial akun.');
      await loadAccountData();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menghapus Foto',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      onNotify('error', 'Validasi Profil', 'Nama lengkap minimal 2 karakter.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await api.updateAccountProfile({
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        jabatan: jabatan.trim(),
      });
      setInMemoryToken(res.token);
      onUserUpdated(res.user);
      onNotify('success', 'Profil Diperbarui', 'Informasi profil akun admin berhasil disimpan.');
      await loadAccountData();
      onNotificationsRefresh();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menyimpan Profil',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPasswordPw) {
      onNotify('error', 'Validasi Password', 'Masukkan password saat ini.');
      return;
    }
    if (newPassword.length < 8) {
      onNotify('error', 'Validasi Password', 'Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      onNotify('error', 'Validasi Password', 'Konfirmasi password baru tidak cocok.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword({
        currentPassword: currentPasswordPw,
        newPassword,
      });
      setCurrentPasswordPw('');
      setNewPassword('');
      setConfirmNewPassword('');
      onNotify(
        'success',
        'Password Berhasil Diganti',
        'Password baru telah aktif dan pemberitahuan keamanan telah dicatat.',
      );
      await loadAccountData();
      onNotificationsRefresh();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Mengganti Password',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmailInput.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      onNotify('error', 'Validasi Email', 'Masukkan alamat email baru yang valid.');
      return;
    }
    setRequestingEmail(true);
    try {
      const res = await api.requestEmailChange({
        currentPassword: currentPasswordEmail,
        newEmail: cleanEmail,
      });
      setCurrentPasswordEmail('');
      setNewEmailInput('');
      onNotify(
        'success',
        'Verifikasi Email Dikirim',
        res.smtpConfigured
          ? `Tautan dan kode verifikasi dikirim ke ${res.pendingEmail}.`
          : `Permintaan verifikasi untuk ${res.pendingEmail} dibuat (gunakan kode/pratinjau lokal).`,
      );
      await loadAccountData();
      onNotificationsRefresh();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Mengubah Email',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setRequestingEmail(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim().length < 6) {
      onNotify('error', 'Kode Tidak Lengkap', 'Masukkan 6 digit kode verifikasi.');
      return;
    }
    setVerifyingCode(true);
    try {
      const res = await api.verifyEmailChange({ code: verificationCode.trim() });
      setVerificationCode('');
      onNotify(
        'success',
        'Email Baru Terverifikasi',
        `Alamat email aktif akun diperbarui ke ${res.newEmail}.`,
      );
      const me = await api.getMe();
      onUserUpdated(me.user);
      await loadAccountData();
      onNotificationsRefresh();
    } catch (err) {
      onNotify(
        'error',
        'Verifikasi Gagal',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleCancelPendingEmail = async () => {
    try {
      await api.cancelPendingEmail();
      onNotify('info', 'Permintaan Dibatalkan', 'Permintaan perubahan email dibatalkan.');
      await loadAccountData();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Membatalkan',
        err instanceof Error ? err.message : undefined,
      );
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSecurity(true);
    try {
      await api.updateSecuritySettings({
        requireEmailLoginApproval: reqEmailApproval,
        approvalPolicy,
        loginApprovalTtlMinutes: ttlMinutes,
        notifyOnLoginSuccess: notifyLoginSuccess,
        notifyOnSecurityChange: notifySecChange,
      });
      onNotify(
        'success',
        'Pengaturan Keamanan Disimpan',
        'Preferensi verifikasi login dan notifikasi keamanan diperbarui.',
      );
      await loadAccountData();
      onNotificationsRefresh();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menyimpan Pengaturan',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleRevokeDevice = async (id: string) => {
    setRevokingDeviceId(id);
    try {
      await api.revokeTrustedDevice(id);
      onNotify(
        'info',
        'Kepercayaan Perangkat Dicabut',
        'Login berikutnya dari perangkat tersebut akan meminta konfirmasi email admin.',
      );
      await loadAccountData();
      onNotificationsRefresh();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Mencabut Perangkat',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setRevokingDeviceId(null);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const res = await api.sendTestEmail();
      if (res.deliveryStatus === 'sent') {
        onNotify(
          'success',
          'Email Uji Coba Terkirim',
          `Email berhasil dikirim melalui SMTP ke ${res.targetEmail}.`,
        );
      } else if (res.deliveryStatus === 'preview_only') {
        onNotify(
          'info',
          'Pratinjau Lokal Tersimpan',
          'SMTP belum dikonfigurasi pada Secrets server. Atur SMTP_HOST, SMTP_USER, dan SMTP_PASS untuk pengiriman nyata.',
        );
      } else {
        onNotify(
          'error',
          'Pengiriman SMTP Gagal',
          res.errorMessage || 'Periksa konfigurasi kredensial SMTP pada server.',
        );
      }
      await loadAccountData();
    } catch (err) {
      onNotify(
        'error',
        'Gagal Menguji Email',
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSendingTestEmail(false);
    }
  };

  const filteredLogs: SecurityActivityItem[] = useMemo(() => {
    const logs = bundle?.activityLogs || [];
    if (activityFilter === 'Semua') return logs;
    return logs.filter((l) => l.status === activityFilter);
  }, [bundle, activityFilter]);

  if (loading && !bundle) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-slate-200/70" />
        <div className="h-80 animate-pulse rounded-xl bg-slate-200/70" />
      </div>
    );
  }

  const profile = bundle?.profile;

  return (
    <div className="space-y-6">
      {/* Header Identity Banner */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              {avatarBlobUrl ? (
                <img
                  src={avatarBlobUrl}
                  alt={profile?.fullName || user.fullName}
                  className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-slate-200 bg-[#0B1D3A] text-xl font-bold text-[#E5B84B]">
                  {getInitials(profile?.fullName || user.fullName)}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#1E40AF]">
                Profil Akun Administrator SIMPANDADU
              </p>
              <h1 className="mt-0.5 truncate text-xl font-bold text-[#0B1D3A] sm:text-2xl">
                {profile?.fullName || user.fullName}
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                @{profile?.username || user.username} ·{' '}
                {profile?.jabatan || user.jabatan} ·{' '}
                {profile?.email ? (
                  <span className="font-medium text-slate-800">
                    {profile.email}{' '}
                    {profile.emailVerified ? '(Terverifikasi)' : '(Belum Verifikasi)'}
                  </span>
                ) : (
                  <span className="font-medium text-amber-700">
                    Email admin belum didaftarkan
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadAccountData}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Warning if active admin has no email yet */}
        {profile && (!profile.email || !profile.emailVerified) && (
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-xs text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold">
                  Daftarkan & Verifikasi Email Aktif Admin
                </p>
                <p className="mt-0.5 leading-relaxed text-amber-900">
                  Akun Anda belum memiliki alamat email terverifikasi. Daftarkan email aktif pada tab <strong>Email & Password</strong> agar fitur konfirmasi login perangkat baru dapat melindungi akun Anda.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('email-password')}
              className="shrink-0 rounded-lg bg-amber-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-900 whitespace-nowrap"
            >
              Atur Email Sekarang
            </button>
          </div>
        )}

        {/* Submenu Navigation Tabs */}
        <div className="mt-6 flex flex-wrap gap-1.5 border-t border-slate-200 pt-4">
          {(
            [
              { id: 'profil', label: 'Informasi Profil', icon: User },
              { id: 'email-password', label: 'Email & Password', icon: KeyRound },
              { id: 'keamanan', label: 'Keamanan & Perangkat', icon: ShieldCheck },
              { id: 'riwayat', label: 'Riwayat Aktivitas & Login', icon: History },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0B1D3A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* TAB 1: Informasi Profil & Foto Profil */}
      {activeTab === 'profil' && profile && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Avatar Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4 space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Foto Profil Admin
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Disimpan aman di server dan hanya dapat diakses oleh sesi admin terautentikasi.
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
              {avatarBlobUrl ? (
                <img
                  src={avatarBlobUrl}
                  alt={profile.fullName}
                  className="h-32 w-32 rounded-2xl border border-slate-200 object-cover shadow-xs"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-2xl border border-slate-200 bg-[#0B1D3A] text-3xl font-bold text-[#E5B84B]">
                  {getInitials(profile.fullName)}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E40AF]">
                  <Camera className="h-3.5 w-3.5" />
                  <span>
                    {uploadingAvatar ? 'Mengunggah...' : 'Unggah Foto'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                    disabled={uploadingAvatar}
                    className="sr-only"
                  />
                </label>

                {profile.hasAvatar && (
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={handleDeleteAvatar}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Format JPG, PNG, atau WebP · Maksimal 2 MB
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Email Aktif</span>
                <span className="font-semibold text-slate-900 truncate">
                  {profile.email || 'Belum diatur'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Status Email</span>
                <span
                  className={`font-semibold ${
                    profile.emailVerified ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {profile.emailVerified ? 'Terverifikasi' : 'Belum Terverifikasi'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Terdaftar Sejak</span>
                <span className="font-mono text-slate-700 tabular-nums">
                  {formatDateTime(profile.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Profile Form */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Edit Informasi Profil Akun
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Perbarui identitas resmi akun administrator yang sedang login. Perubahan email aktif dilakukan pada tab Email & Password dengan verifikasi.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="acc-fullname"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Nama Lengkap
                  </label>
                  <input
                    id="acc-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="acc-username"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Username {bundle?.envManaged && '(Dikelola Server Env)'}
                  </label>
                  <input
                    id="acc-username"
                    type="text"
                    value={username}
                    disabled={bundle?.envManaged}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="acc-phone"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Nomor HP
                  </label>
                  <input
                    id="acc-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="acc-jabatan"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Jabatan
                  </label>
                  <input
                    id="acc-jabatan"
                    type="text"
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    placeholder="Contoh: Sekretaris Desa / Kaur Perencanaan"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Email Aktif Terhubung:</span>{' '}
                {profile.email ? (
                  <span className="font-medium text-slate-900">{profile.email}</span>
                ) : (
                  <span className="text-amber-700">Belum didaftarkan</span>
                )}{' '}
                · Untuk mengubah email dengan verifikasi email baru, buka tab{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('email-password')}
                  className="font-semibold text-[#1D4ED8] hover:underline"
                >
                  Email & Password
                </button>
                .
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0B1D3A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingProfile ? 'Menyimpan...' : 'Simpan Perubahan Profil'}</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* TAB 2: Ubah Email (dengan Verifikasi) & Ganti Password */}
      {activeTab === 'email-password' && profile && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Ubah Email */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
              <Mail className="mt-0.5 h-5 w-5 text-[#1E40AF]" />
              <div>
                <h2 className="text-base font-bold text-[#0B1D3A]">
                  Email Aktif & Verifikasi Email Baru
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Email ini menerima tautan konfirmasi login (IZINKAN / TOLAK LOGIN) dan peringatan keamanan.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <p className="text-slate-500">Email Aktif Saat Ini</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#0B1D3A]">
                  {profile.email || 'Belum ada email terdaftar'}
                </span>
                {profile.email && (
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      profile.emailVerified ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {profile.emailVerified ? 'Terverifikasi' : 'Belum Terverifikasi'}
                  </span>
                )}
              </div>
            </div>

            {bundle?.pendingEmailVerification && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-blue-950">
                      Menunggu Verifikasi Email Baru
                    </p>
                    <p className="mt-0.5 text-xs text-blue-900">
                      Tautan & kode 6 digit telah dikirim ke{' '}
                      <span className="font-semibold">
                        {bundle.pendingEmailVerification.newEmail}
                      </span>
                      .
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelPendingEmail}
                    title="Batalkan permintaan perubahan email"
                    className="rounded-md p-1 text-blue-800 hover:bg-blue-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleVerifyEmailCode} className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Kode 6 digit"
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 font-mono text-sm tracking-widest text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={verifyingCode}
                    className="shrink-0 rounded-lg bg-[#1D4ED8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E40AF] disabled:opacity-60"
                  >
                    {verifyingCode ? 'Cek...' : 'Verifikasi'}
                  </button>
                </form>

                {/* Show preview only when SMTP is not configured */}
                {!bundle.smtpStatus.configured &&
                  bundle.recentEmails
                    .filter((em) => em.category === 'email_verification' && em.previewText)
                    .slice(0, 1)
                    .map((em) => {
                      const codeMatch = em.previewText?.match(/Kode verifikasi.*?:\s*(\d{6})/);
                      return (
                        <div
                          key={em.id}
                          className="rounded border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-950"
                        >
                          <span className="font-semibold">
                            Pratinjau Lokal (SMTP belum diatur):
                          </span>{' '}
                          Kode verifikasi untuk{' '}
                          <span className="font-medium">{em.recipientEmail}</span>:{' '}
                          <span className="font-mono font-bold">
                            {codeMatch?.[1] || '-'}
                          </span>
                        </div>
                      );
                    })}
              </div>
            )}

            <form onSubmit={handleRequestEmailChange} className="space-y-3.5">
              <div>
                <label
                  htmlFor="acc-new-email"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Alamat Email Baru
                </label>
                <input
                  id="acc-new-email"
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  placeholder="nama@adimulya.desa.id"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                />
              </div>

              {!bundle?.envManaged && (
                <div>
                  <label
                    htmlFor="acc-email-password"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Konfirmasi Password Saat Ini
                  </label>
                  <input
                    id="acc-email-password"
                    type="password"
                    value={currentPasswordEmail}
                    onChange={(e) => setCurrentPasswordEmail(e.target.value)}
                    placeholder="Masukkan password saat ini"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={requestingEmail}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                <span>
                  {requestingEmail
                    ? 'Mengirim Tautan Verifikasi...'
                    : 'Kirim Verifikasi Email Baru'}
                </span>
              </button>
            </form>
          </div>

          {/* Ganti Password */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
              <Lock className="mt-0.5 h-5 w-5 text-[#1E40AF]" />
              <div>
                <h2 className="text-base font-bold text-[#0B1D3A]">
                  Ganti Password Akun
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Password di-hash dengan scrypt di server dan tidak pernah dikirim melalui email.
                </p>
              </div>
            </div>

            {bundle?.envManaged ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                Password akun saat ini dikelola melalui variabel lingkungan server (
                <span className="font-mono">SIMPANDADU_ADMIN_PASSWORD</span>). Ubah langsung melalui panel Secrets server apabila ingin mengganti password.
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="acc-curr-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Password Saat Ini
                  </label>
                  <div className="relative">
                    <input
                      id="acc-curr-pw"
                      type={showCurrPw ? 'text' : 'password'}
                      value={currentPasswordPw}
                      onChange={(e) => setCurrentPasswordPw(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      required
                      className="w-full rounded-lg border border-slate-300 py-2.5 pr-10 pl-3.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrPw((p) => !p)}
                      aria-label="Tampilkan atau sembunyikan password saat ini"
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                    >
                      {showCurrPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="acc-new-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Password Baru (Minimal 8 karakter)
                  </label>
                  <div className="relative">
                    <input
                      id="acc-new-pw"
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Buat password baru yang kuat"
                      required
                      className="w-full rounded-lg border border-slate-300 py-2.5 pr-10 pl-3.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((p) => !p)}
                      aria-label="Tampilkan atau sembunyikan password baru"
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="acc-confirm-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Konfirmasi Password Baru
                  </label>
                  <input
                    id="acc-confirm-pw"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    required
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>{savingPassword ? 'Menyimpan...' : 'Perbarui Password'}</span>
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* TAB 3: Pengaturan Keamanan Akun & Perangkat Terpercaya */}
      {activeTab === 'keamanan' && bundle && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-5">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Pengaturan Keamanan Login & Notifikasi Email
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Atur konfirmasi persetujuan login melalui email (IZINKAN / TOLAK LOGIN) untuk sesi atau perangkat baru.
              </p>
            </div>

            <form onSubmit={handleSaveSecurity} className="space-y-4">
              <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Verifikasi Login via Email Admin
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Minta persetujuan satu kali pakai ke email terdaftar sebelum akses login diterbitkan.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={reqEmailApproval}
                  onChange={(e) => setReqEmailApproval(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1D4ED8]"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="sec-policy"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Kebijakan Konfirmasi Email
                  </label>
                  <select
                    id="sec-policy"
                    value={approvalPolicy}
                    onChange={(e) =>
                      setApprovalPolicy(
                        e.target.value === 'every_login' ? 'every_login' : 'new_device',
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="new_device">Perangkat / Sesi Baru Saja</option>
                    <option value="every_login">Setiap Percobaan Login</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="sec-ttl"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Batas Waktu Kedaluwarsa
                  </label>
                  <select
                    id="sec-ttl"
                    value={ttlMinutes}
                    onChange={(e) => setTtlMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value={5}>5 Menit</option>
                    <option value={10}>10 Menit (Disarankan)</option>
                    <option value={15}>15 Menit</option>
                    <option value={30}>30 Menit</option>
                  </select>
                </div>
              </div>

              <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Pemberitahuan Email Saat Login Berhasil
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Kirim laporan ringkas ke email admin ketika berhasil masuk.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyLoginSuccess}
                  onChange={(e) => setNotifyLoginSuccess(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1D4ED8]"
                />
              </label>

              <label className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Pemberitahuan Perubahan Keamanan & Password
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Selalu beri tahu melalui email jika terjadi perubahan password atau email akun.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifySecChange}
                  onChange={(e) => setNotifySecChange(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#1D4ED8]"
                />
              </label>

              <button
                type="submit"
                disabled={savingSecurity}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{savingSecurity ? 'Menyimpan...' : 'Simpan Pengaturan Keamanan'}</span>
              </button>
            </form>

            {/* SMTP Integration Status Box */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#0B1D3A]">
                    Layanan Pengiriman Email (SMTP Transactional)
                  </p>
                  <p className="text-xs text-slate-500">
                    Status:{' '}
                    <span
                      className={`font-semibold ${
                        bundle.smtpStatus.configured
                          ? 'text-emerald-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {bundle.smtpStatus.configured
                        ? `Terhubung (${bundle.smtpStatus.hostLabel}:${bundle.smtpStatus.port})`
                        : 'Belum Dikonfigurasi di Server (.env / Secrets)'}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={sendingTestEmail}
                  onClick={handleSendTestEmail}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{sendingTestEmail ? 'Mengirim...' : 'Uji Kirim Email'}</span>
                </button>
              </div>
              {!bundle.smtpStatus.configured && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                  Untuk mengirim email persetujuan ke kotak masuk admin secara langsung, atur variabel{' '}
                  <span className="font-mono">SMTP_HOST</span>,{' '}
                  <span className="font-mono">SMTP_PORT</span>,{' '}
                  <span className="font-mono">SMTP_USER</span>,{' '}
                  <span className="font-mono">SMTP_PASS</span>, dan{' '}
                  <span className="font-mono">SMTP_FROM</span> di panel Secrets server.
                </p>
              )}
            </div>
          </div>

          {/* Perangkat Terpercaya */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-4">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Perangkat & Sesi Terpercaya ({bundle.trustedDevices.length})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Perangkat yang telah Anda setujui melalui email. Cabut kepercayaan kapan saja untuk memaksa verifikasi email ulang.
              </p>
            </div>

            {bundle.trustedDevices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500">
                Belum ada perangkat terpercaya terdaftar.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {bundle.trustedDevices.map((dev) => (
                  <li
                    key={dev.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#1E40AF]" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {dev.deviceLabel}{' '}
                          {dev.isCurrentDevice && (
                            <span className="text-xs font-semibold text-emerald-700">
                              · Perangkat Ini
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {dev.locationEstimate} ·{' '}
                          <span className="font-mono">{dev.ipAddress}</span>
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-400">
                          Terakhir aktif: {formatDateTime(dev.lastUsedAt)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={revokingDeviceId === dev.id}
                      onClick={() => handleRevokeDevice(dev.id)}
                      className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {revokingDeviceId === dev.id ? 'Mencabut...' : 'Cabut Akses'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* TAB 4: Riwayat Aktivitas & Login */}
      {activeTab === 'riwayat' && bundle && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B1D3A]">
                Riwayat Aktivitas & Keamanan Login
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Seluruh percobaan login, persetujuan/penolakan email, kedaluwarsa, serta perubahan profil tercatat di basis data server.
              </p>
            </div>

            <div className="flex flex-wrap gap-1">
              {['Semua', 'Berhasil', 'Menunggu', 'Disetujui', 'Ditolak', 'Kedaluwarsa', 'Peringatan'].map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setActivityFilter(st)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      activityFilter === st
                        ? 'bg-[#0B1D3A] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ),
              )}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Tidak ada catatan aktivitas untuk filter yang dipilih.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-3 py-3 font-semibold">Waktu</th>
                    <th className="px-3 py-3 font-semibold">Aktivitas</th>
                    <th className="px-3 py-3 font-semibold">Rincian</th>
                    <th className="px-3 py-3 font-semibold">Perangkat</th>
                    <th className="px-3 py-3 font-semibold">Lokasi & IP</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {log.eventType}
                      </td>
                      <td className="px-3 py-3 text-slate-700 max-w-xs">
                        {log.description}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {log.deviceLabel}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <span>{log.locationEstimate}</span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {log.ipAddress}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-semibold">
                        <span
                          className={
                            log.status === 'Berhasil' || log.status === 'Disetujui'
                              ? 'text-emerald-700'
                              : log.status === 'Ditolak'
                                ? 'text-red-700'
                                : log.status === 'Menunggu'
                                  ? 'text-[#1D4ED8]'
                                  : 'text-amber-700'
                          }
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
