import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  Phone,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Clock,
  MonitorSmartphone,
  MapPin,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import { ASSET_IMAGES } from '../constants';
import { api, setInMemoryToken } from '../lib/api';
import type {
  AdminUser,
  EmailOutboxLogItem,
  LoginChallengePendingInfo,
} from '../types';

interface LoginPageProps {
  initialized: boolean;
  envManaged: boolean;
  onLoginSuccess: (user: AdminUser, isFirstSetup?: boolean) => void;
  onBackToCitizenPortal: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export function LoginPage({
  initialized,
  envManaged,
  onLoginSuccess,
  onBackToCitizenPortal,
  onNotify,
}: LoginPageProps) {
  const [username, setUsername] = useState(initialized ? '' : 'admin_adimulya');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('Perangkat Desa Adimulya');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jabatan, setJabatan] = useState('Administrator Balai Desa');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [imgError, setImgError] = useState(false);

  // Email Confirmation Waiting State
  const [pendingChallenge, setPendingChallenge] =
    useState<LoginChallengePendingInfo | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<
    'pending' | 'approved' | 'denied' | 'expired' | 'completed'
  >('pending');
  const [challengeMessage, setChallengeMessage] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [devPreviewEmails, setDevPreviewEmails] = useState<EmailOutboxLogItem[]>([]);
  const [completingLogin, setCompletingLogin] = useState(false);

  // Countdown timer for waiting challenge
  useEffect(() => {
    if (!pendingChallenge || challengeStatus !== 'pending') return;
    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((pendingChallenge.expiresAt - Date.now()) / 1000),
      );
      setSecondsLeft(diff);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [pendingChallenge, challengeStatus]);

  // Poll server for email confirmation decision
  useEffect(() => {
    if (!pendingChallenge || challengeStatus !== 'pending') return;
    let active = true;

    const checkOnce = async () => {
      try {
        const res = await api.checkLoginChallengeStatus(
          pendingChallenge.challengeId,
          pendingChallenge.pollSecret,
        );
        if (!active) return;

        if (res.status === 'approved') {
          setChallengeStatus('approved');
          setCompletingLogin(true);
          try {
            const done = await api.completeLoginChallenge(
              pendingChallenge.challengeId,
              pendingChallenge.pollSecret,
            );
            if (!active) return;
            setInMemoryToken(done.token);
            onNotify(
              'success',
              'Login Disetujui & Berhasil',
              `Selamat datang, ${done.user.fullName}.`,
            );
            onLoginSuccess(done.user, false);
          } catch (err) {
            if (!active) return;
            setChallengeStatus('denied');
            setChallengeMessage(
              err instanceof Error ? err.message : 'Gagal menyelesaikan login.',
            );
          } finally {
            if (active) setCompletingLogin(false);
          }
        } else if (res.status === 'denied') {
          setChallengeStatus('denied');
          setChallengeMessage(
            res.decisionReason ||
              'Percobaan login ditolak oleh administrator melalui email.',
          );
          onNotify(
            'error',
            'Login Ditolak',
            'Permintaan login dibatalkan melalui tautan TOLAK LOGIN pada email admin.',
          );
        } else if (res.status === 'expired') {
          setChallengeStatus('expired');
          setChallengeMessage(
            res.decisionReason ||
              'Permintaan konfirmasi login telah kedaluwarsa karena batas waktu berakhir.',
          );
          onNotify(
            'error',
            'Permintaan Kedaluwarsa',
            'Batas waktu konfirmasi login telah habis.',
          );
        }
      } catch {
        // Retry on next interval
      }
    };

    const interval = window.setInterval(checkOnce, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pendingChallenge, challengeStatus, onLoginSuccess, onNotify]);

  // Load local preview outbox ONLY when SMTP server is not configured yet
  useEffect(() => {
    if (!pendingChallenge || pendingChallenge.smtpConfigured) return;
    let active = true;
    api
      .fetchDevOutbox(pendingChallenge.challengeId, pendingChallenge.pollSecret)
      .then((res) => {
        if (active) setDevPreviewEmails(res.emails);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pendingChallenge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      const msg = 'Username wajib diisi.';
      setFormError(msg);
      onNotify('error', 'Validasi Gagal', msg);
      return;
    }
    if (!password) {
      const msg = 'Password wajib diisi.';
      setFormError(msg);
      onNotify('error', 'Validasi Gagal', msg);
      return;
    }

    if (!initialized && !envManaged) {
      if (trimmedUser.length < 4) {
        const msg = 'Username minimal 4 karakter.';
        setFormError(msg);
        onNotify('error', 'Validasi Gagal', msg);
        return;
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        const msg = 'Email aktif admin wajib diisi dengan format yang benar.';
        setFormError(msg);
        onNotify('error', 'Validasi Gagal', msg);
        return;
      }
      if (password.length < 6) {
        const msg = 'Password minimal 6 karakter.';
        setFormError(msg);
        onNotify('error', 'Validasi Gagal', msg);
        return;
      }
      if (password !== confirmPassword) {
        const msg = 'Konfirmasi password tidak cocok.';
        setFormError(msg);
        onNotify('error', 'Validasi Gagal', msg);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (!initialized && !envManaged) {
        const res = await api.setupAdmin({
          username: trimmedUser,
          password,
          fullName: fullName.trim() || 'Administrator Desa Adimulya',
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          jabatan: jabatan.trim() || 'Administrator Balai Desa',
        });
        setInMemoryToken(res.token);
        onNotify(
          'success',
          'Akun Admin Berhasil Diaktifkan',
          `Selamat datang di SIMPANDADU, ${res.user.fullName}.`,
        );
        onLoginSuccess(res.user, true);
      } else {
        const res = await api.login({ username: trimmedUser, password });
        if (res.status === 'confirmation_required') {
          setPendingChallenge(res);
          setChallengeStatus('pending');
          setChallengeMessage('');
          setDevPreviewEmails([]);
          onNotify(
            'info',
            'Konfirmasi Email Diperlukan',
            `Tautan persetujuan login telah dikirim ke ${res.maskedEmail}.`,
          );
        } else {
          setInMemoryToken(res.token);
          onNotify(
            'success',
            'Login Berhasil',
            `Selamat datang kembali, ${res.user.fullName}.`,
          );
          onLoginSuccess(res.user, false);
        }
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal masuk ke sistem. Periksa username dan password.';
      setFormError(msg);
      onNotify('error', 'Login Gagal', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const extractActionUrls = (text: string) => {
    const approveMatch = text.match(/IZINKAN LOGIN:\s*(\S+)/);
    const denyMatch = text.match(/TOLAK LOGIN:\s*(\S+)/);
    return {
      approveUrl: approveMatch?.[1] || null,
      denyUrl: denyMatch?.[1] || null,
    };
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 lg:grid lg:grid-cols-12">
      {/* Left Institutional Panel */}
      <div className="relative hidden overflow-hidden bg-[#0B1D3A] text-white lg:col-span-7 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <img
          src={ASSET_IMAGES.loginBackdrop}
          alt="Pemandangan pagi pedesaan Indonesia"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#071327]/95 via-[#0B1D3A]/85 to-[#1E40AF]/65" />

        <div className="relative z-10 flex items-center gap-4">
          {!imgError ? (
            <img
              src={ASSET_IMAGES.logo}
              alt="Lambang Desa Adimulya"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-14 w-14 rounded-xl border border-[#C99A2E]/60 bg-white object-contain p-1 shadow-md"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#C99A2E]/60 bg-[#122B54] text-[#C99A2E]">
              <ShieldCheck className="h-7 w-7" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#E5B84B] uppercase">
              Pemerintah Desa Adimulya
            </p>
            <h1 className="text-xl font-bold tracking-tight text-white">
              SIMPANDADU
            </h1>
          </div>
        </div>

        <div className="relative z-10 max-w-xl space-y-5">
          <h2 className="font-serif text-4xl leading-tight font-semibold text-white text-balance">
            Sistem Informasi Perencanaan dan Administrasi Desa Adimulya Terpadu
          </h2>
          <p className="text-base leading-relaxed text-slate-200">
            Platform resmi Balai Desa Adimulya untuk pengelolaan inventaris aset desa, pemetaan wilayah berbasis OpenStreetMap, pemantauan berita nasional terkini, serta administrasi usulan Musrenbang dengan verifikasi login berbasis email.
          </p>
          <div className="grid grid-cols-3 gap-4 border-t border-white/15 pt-6 text-sm">
            <div>
              <p className="font-semibold text-[#E5B84B]">Inventaris Aset</p>
              <p className="mt-1 text-xs text-slate-300">
                Pencatatan kondisi, kategori, serta ekspor Excel & PDF.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#E5B84B]">Keamanan Email</p>
              <p className="mt-1 text-xs text-slate-300">
                Konfirmasi perangkat baru melalui tautan satu kali pakai.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#E5B84B]">Musrenbang</p>
              <p className="mt-1 text-xs text-slate-300">
                Penjaringan dan pemantauan status usulan pembangunan.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-5 text-xs text-slate-300">
          <span>Balai Desa Adimulya · Portal Administrasi Perangkat Desa</span>
          <span>SIMPANDADU</span>
        </div>
      </div>

      {/* Right Authentication Form / Email Confirmation View */}
      <div className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:col-span-5 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="mb-8 flex items-center gap-3.5 lg:hidden">
            {!imgError ? (
              <img
                src={ASSET_IMAGES.logo}
                alt="Lambang Desa Adimulya"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-xs"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B1D3A] text-[#C99A2E]">
                <ShieldCheck className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-lg font-bold tracking-tight text-[#0B1D3A]">
                SIMPANDADU
              </p>
              <p className="text-xs text-slate-600">Desa Adimulya</p>
            </div>
          </div>

          {pendingChallenge ? (
            <div className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8 space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8]/10 text-[#1D4ED8]">
                  <MailCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0B1D3A]">
                    {challengeStatus === 'pending'
                      ? 'Menunggu Konfirmasi Login via Email'
                      : challengeStatus === 'approved'
                        ? 'Login Disetujui — Memasuki Dashboard'
                        : challengeStatus === 'denied'
                          ? 'Percobaan Login Ditolak'
                          : 'Permintaan Login Kedaluwarsa'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {challengeStatus === 'pending'
                      ? `Perangkat atau sesi baru terdeteksi. Konfirmasi dikirim ke ${pendingChallenge.maskedEmail}.`
                      : challengeMessage}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <MonitorSmartphone className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">{pendingChallenge.deviceLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <span>
                    {pendingChallenge.locationEstimate} ·{' '}
                    <span className="font-mono">{pendingChallenge.ipAddress}</span>
                  </span>
                </div>
                {challengeStatus === 'pending' && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-700" />
                      Batas waktu konfirmasi
                    </span>
                    <span className="font-mono font-bold tabular-nums text-[#0B1D3A]">
                      {formatCountdown(secondsLeft)}
                    </span>
                  </div>
                )}
              </div>

              {challengeStatus === 'pending' && (
                <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-900">
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-[#1D4ED8]" />
                  <span>
                    {completingLogin
                      ? 'Menyelesaikan sesi aman...'
                      : 'Buka email admin Anda lalu klik IZINKAN LOGIN atau TOLAK LOGIN. Halaman ini akan otomatis melanjutkan.'}
                  </span>
                </div>
              )}

              {/* Preview inbox ONLY when SMTP server is not configured */}
              {!pendingChallenge.smtpConfigured &&
                challengeStatus === 'pending' &&
                devPreviewEmails.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs space-y-2">
                    <p className="font-semibold text-amber-950">
                      Pratinjau Email Lokal (SMTP Belum Dikonfigurasi di Server)
                    </p>
                    <p className="text-amber-900 leading-relaxed">
                      Konfigurasikan variabel <span className="font-mono">SMTP_HOST</span>,{' '}
                      <span className="font-mono">SMTP_USER</span>, dan{' '}
                      <span className="font-mono">SMTP_PASS</span> di Secrets server agar email dikirim langsung ke kotak masuk. Untuk pengujian lokal saat ini, gunakan tautan satu kali pakai berikut:
                    </p>
                    {devPreviewEmails.map((em) => {
                      const urls = extractActionUrls(em.previewText || '');
                      return (
                        <div
                          key={em.id}
                          className="rounded border border-amber-200 bg-white p-2.5 space-y-2"
                        >
                          <p className="font-medium text-slate-800 truncate">
                            Kepada: {em.recipientEmail}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {urls.approveUrl && (
                              <a
                                href={urls.approveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                IZINKAN LOGIN
                              </a>
                            )}
                            {urls.denyUrl && (
                              <a
                                href={urls.denyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
                              >
                                TOLAK LOGIN
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              <button
                type="button"
                onClick={() => {
                  setPendingChallenge(null);
                  setChallengeStatus('pending');
                  setChallengeMessage('');
                  setPassword('');
                }}
                className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Batalkan & Kembali ke Form Login</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
              <div className="mb-6">
                <div className="mb-3 hidden lg:block">
                  <span className="text-xs font-semibold tracking-wide text-[#1E40AF]">
                    Akses Perangkat Desa
                  </span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-[#0B1D3A]">
                  {!initialized && !envManaged
                    ? 'Aktivasi Akun Admin SIMPANDADU'
                    : 'Masuk ke SIMPANDADU'}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {!initialized && !envManaged
                    ? 'Lengkapi identitas dan email aktif admin Desa Adimulya untuk mengaktifkan keamanan verifikasi email.'
                    : 'Sistem Informasi Perencanaan dan Administrasi Desa Adimulya Terpadu'}
                </p>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {!initialized && !envManaged && (
                  <>
                    <div>
                      <label
                        htmlFor="login-fullname"
                        className="mb-1.5 block text-sm font-medium text-slate-800"
                      >
                        Nama Lengkap
                      </label>
                      <input
                        id="login-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nama lengkap perangkat desa"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="login-jabatan"
                          className="mb-1.5 block text-sm font-medium text-slate-800"
                        >
                          Jabatan
                        </label>
                        <div className="relative">
                          <Briefcase className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            id="login-jabatan"
                            type="text"
                            value={jabatan}
                            onChange={(e) => setJabatan(e.target.value)}
                            placeholder="Sekretaris Desa / Kaur"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="login-phone"
                          className="mb-1.5 block text-sm font-medium text-slate-800"
                        >
                          Nomor HP
                        </label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            id="login-phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="081234567890"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="login-email"
                        className="mb-1.5 block text-sm font-medium text-slate-800"
                      >
                        Email Aktif Admin
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="login-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="admin@adimulya.desa.id"
                          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3.5 pl-10 text-sm text-slate-900 focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-1.5 block text-sm font-medium text-slate-800"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username perangkat desa"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3.5 pl-10 text-sm text-slate-900 transition-colors focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-sm font-medium text-slate-800"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        !initialized && !envManaged
                          ? 'new-password'
                          : 'current-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        !initialized && !envManaged
                          ? 'Buat password minimal 6 karakter'
                          : 'Masukkan password'
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-11 pl-10 text-sm text-slate-900 transition-colors focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? 'Sembunyikan password'
                          : 'Tampilkan password'
                      }
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {!initialized && !envManaged && (
                  <div>
                    <label
                      htmlFor="login-confirm-password"
                      className="mb-1.5 block text-sm font-medium text-slate-800"
                    >
                      Ulangi Password
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password yang sama"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-11 pl-10 text-sm text-slate-900 transition-colors focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={
                          showConfirmPassword
                            ? 'Sembunyikan konfirmasi password'
                            : 'Tampilkan konfirmasi password'
                        }
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {submitting
                      ? 'Memverifikasi...'
                      : !initialized && !envManaged
                        ? 'Aktifkan & Masuk'
                        : 'Masuk'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={onBackToCitizenPortal}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Portal Usulan Musrenbang Warga</span>
            </button>
            <p className="text-xs text-slate-500">
              Balai Desa Adimulya · Seluruh menu administrasi terlindungi sesi & verifikasi email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
