import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  MonitorSmartphone,
  MapPin,
  ArrowLeft,
  MailCheck,
  ShieldCheck,
} from 'lucide-react';
import { ASSET_IMAGES } from '../constants';
import { api } from '../lib/api';
import type { LoginConfirmationPreview } from '../types';

interface EmailActionHandlerPageProps {
  loginConfirmToken?: string;
  loginConfirmAction?: 'approve' | 'deny';
  verifyEmailToken?: string;
  onFinishToApp: () => void;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}

export function EmailActionHandlerPage({
  loginConfirmToken,
  loginConfirmAction = 'approve',
  verifyEmailToken,
  onFinishToApp,
  onNotify,
}: EmailActionHandlerPageProps) {
  const [logoError, setLogoError] = useState(false);

  // Login confirm states
  const [previewLoading, setPreviewLoading] = useState(Boolean(loginConfirmToken));
  const [preview, setPreview] = useState<LoginConfirmationPreview | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmOutcome, setConfirmOutcome] = useState<{
    outcome: 'approved' | 'denied';
    decidedAt: string;
  } | null>(null);
  const [confirmError, setConfirmError] = useState('');

  // Verify email states
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailVerifiedResult, setEmailVerifiedResult] = useState<{
    newEmail: string;
    verifiedAt: string;
  } | null>(null);
  const [emailVerifyError, setEmailVerifyError] = useState('');

  useEffect(() => {
    if (!loginConfirmToken) return;
    let active = true;
    setPreviewLoading(true);
    setConfirmError('');
    api
      .previewLoginConfirmation(loginConfirmToken, loginConfirmAction)
      .then((res) => {
        if (!active) return;
        setPreview(res);
      })
      .catch((err) => {
        if (!active) return;
        setConfirmError(
          err instanceof Error ? err.message : 'Gagal memuat detail konfirmasi login.',
        );
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loginConfirmToken, loginConfirmAction]);

  const handleConfirmLogin = async (action: 'approve' | 'deny') => {
    if (!loginConfirmToken) return;
    setConfirmSubmitting(true);
    setConfirmError('');
    try {
      const res = await api.confirmLoginFromEmail(loginConfirmToken, action);
      setConfirmOutcome({ outcome: res.outcome, decidedAt: res.decidedAt });
      onNotify(
        res.outcome === 'approved' ? 'success' : 'info',
        res.outcome === 'approved' ? 'Login Diizinkan' : 'Login Ditolak',
        res.outcome === 'approved'
          ? 'Permintaan masuk perangkat baru telah disetujui.'
          : 'Percobaan masuk perangkat baru telah dibatalkan.',
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal memproses konfirmasi login.';
      setConfirmError(msg);
      onNotify('error', 'Konfirmasi Gagal', msg);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verifyEmailToken) return;
    setEmailVerifying(true);
    setEmailVerifyError('');
    try {
      const res = await api.verifyEmailChange({ token: verifyEmailToken });
      setEmailVerifiedResult({
        newEmail: res.newEmail,
        verifiedAt: res.verifiedAt,
      });
      onNotify(
        'success',
        'Email Berhasil Diverifikasi',
        `Alamat email aktif admin kini adalah ${res.newEmail}.`,
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal memverifikasi tautan email baru.';
      setEmailVerifyError(msg);
      onNotify('error', 'Verifikasi Email Gagal', msg);
    } finally {
      setEmailVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Brand Header */}
        <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
          {!logoError ? (
            <img
              src={ASSET_IMAGES.logo}
              alt="Lambang Desa Adimulya"
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="h-11 w-11 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0B1D3A] text-[#E5B84B]">
              <ShieldCheck className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="text-base font-bold text-[#0B1D3A]">SIMPANDADU</p>
            <p className="text-xs text-slate-500">
              Pusat Verifikasi Keamanan Akun · Desa Adimulya
            </p>
          </div>
        </div>

        {/* Mode 1: Login Confirmation Link */}
        {loginConfirmToken && (
          <div>
            {previewLoading ? (
              <div className="py-10 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-[#0B1D3A]" />
                <p className="mt-3 text-sm text-slate-600">
                  Memeriksa tautan konfirmasi satu kali pakai...
                </p>
              </div>
            ) : confirmOutcome ? (
              <div className="space-y-4 text-center">
                {confirmOutcome.outcome === 'approved' ? (
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                ) : (
                  <XCircle className="mx-auto h-12 w-12 text-red-600" />
                )}
                <h1 className="text-xl font-bold text-[#0B1D3A]">
                  {confirmOutcome.outcome === 'approved'
                    ? 'Permintaan Login Diizinkan'
                    : 'Percobaan Login Ditolak'}
                </h1>
                <p className="text-sm leading-relaxed text-slate-600">
                  {confirmOutcome.outcome === 'approved'
                    ? 'Akses telah disetujui. Perangkat yang menunggu dapat langsung masuk ke dashboard SIMPANDADU, dan pemberitahuan hasil konfirmasi telah dicatat.'
                    : 'Percobaan masuk dibatalkan dan akses ditolak. Aktivitas ini telah dicatat ke riwayat keamanan akun.'}
                </p>
                {preview && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-700 space-y-1.5">
                    <p>
                      <span className="text-slate-500">Perangkat:</span>{' '}
                      <span className="font-semibold">{preview.deviceLabel}</span>
                    </p>
                    <p>
                      <span className="text-slate-500">Lokasi & IP:</span>{' '}
                      <span className="font-semibold">
                        {preview.locationEstimate} ({preview.ipAddress})
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ) : confirmError || (preview && !preview.valid) ? (
              <div className="space-y-4 text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-amber-600" />
                <h1 className="text-xl font-bold text-[#0B1D3A]">
                  Tautan Tidak Berlaku
                </h1>
                <p className="text-sm text-slate-600">
                  {confirmError ||
                    preview?.reason ||
                    'Tautan konfirmasi login sudah kedaluwarsa atau pernah digunakan.'}
                </p>
              </div>
            ) : preview ? (
              <div className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-[#0B1D3A]">
                    Konfirmasi Percobaan Login Baru
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Periksa rincian perangkat di bawah sebelum melanjutkan tindakan satu kali pakai untuk akun{' '}
                    <span className="font-semibold text-slate-900">
                      @{preview.username}
                    </span>
                    .
                  </p>
                </div>

                <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">Waktu Percobaan</p>
                      <p className="font-medium text-slate-900">
                        {new Date(preview.requestedAt).toLocaleString('id-ID', {
                          dateStyle: 'long',
                          timeStyle: 'medium',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">Perangkat & Browser</p>
                      <p className="font-medium text-slate-900">
                        {preview.deviceLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <div>
                      <p className="text-xs text-slate-500">
                        Perkiraan Lokasi & Alamat IP
                      </p>
                      <p className="font-medium text-slate-900">
                        {preview.locationEstimate} ·{' '}
                        <span className="font-mono text-xs">{preview.ipAddress}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                  {loginConfirmAction === 'approve'
                    ? 'Anda memilih tautan IZINKAN LOGIN. Pastikan percobaan masuk ini benar-benar dilakukan oleh Anda.'
                    : 'Anda memilih tautan TOLAK LOGIN. Akses dari perangkat tersebut akan segera dibatalkan.'}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={confirmSubmitting}
                    onClick={() => handleConfirmLogin('approve')}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                      loginConfirmAction === 'approve'
                        ? 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-700/30'
                        : 'bg-emerald-700/90 hover:bg-emerald-800'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {confirmSubmitting && loginConfirmAction === 'approve'
                        ? 'Memproses...'
                        : 'IZINKAN LOGIN'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={confirmSubmitting}
                    onClick={() => handleConfirmLogin('deny')}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                      loginConfirmAction === 'deny'
                        ? 'bg-red-700 hover:bg-red-800 ring-2 ring-red-700/30'
                        : 'bg-red-700/90 hover:bg-red-800'
                    }`}
                  >
                    <XCircle className="h-4 w-4" />
                    <span>
                      {confirmSubmitting && loginConfirmAction === 'deny'
                        ? 'Memproses...'
                        : 'TOLAK LOGIN'}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Mode 2: Verify New Email Link */}
        {verifyEmailToken && (
          <div className="space-y-4">
            {emailVerifiedResult ? (
              <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <h1 className="text-xl font-bold text-[#0B1D3A]">
                  Alamat Email Baru Terverifikasi
                </h1>
                <p className="text-sm text-slate-600">
                  Email aktif administrator SIMPANDADU telah diperbarui menjadi{' '}
                  <span className="font-semibold text-slate-900">
                    {emailVerifiedResult.newEmail}
                  </span>
                  . Pemberitahuan perubahan email juga telah dikirim dan dicatat ke riwayat keamanan.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#1D4ED8]/10 text-[#1D4ED8]">
                    <MailCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-[#0B1D3A]">
                      Verifikasi Alamat Email Admin Baru
                    </h1>
                    <p className="text-xs text-slate-500">
                      Tautan verifikasi satu kali pakai
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  Klik tombol di bawah ini untuk menyelesaikan perubahan alamat email aktif akun administrator SIMPANDADU Anda.
                </p>
                {emailVerifyError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                    {emailVerifyError}
                  </div>
                )}
                <button
                  type="button"
                  disabled={emailVerifying}
                  onClick={handleVerifyEmail}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#0B1D3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60"
                >
                  <MailCheck className="h-4 w-4" />
                  <span>
                    {emailVerifying
                      ? 'Memverifikasi Email...'
                      : 'Konfirmasi Verifikasi Email Baru'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 border-t border-slate-200 pt-4 text-center">
          <button
            type="button"
            onClick={onFinishToApp}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke SIMPANDADU</span>
          </button>
        </div>
      </div>
    </div>
  );
}
