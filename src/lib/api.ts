import type {
  AdminAccountProfile,
  AdminUser,
  EmailOutboxLogItem,
  LoginChallengePendingInfo,
  LoginConfirmationPreview,
  MapConfig,
  MusrenbangProposal,
  NewsResponse,
  ProposalCategory,
  PublicApprovedProposal,
  PublicProposalStatusItem,
  SecurityActivityItem,
  SecurityNotificationItem,
  SmtpStatusInfo,
  TrustedDeviceItem,
  VillageAsset,
  VillageProfile,
} from '../types';

let inMemoryToken: string | null = null;

export function setInMemoryToken(token: string | null): void {
  inMemoryToken = token;
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'SIMPANDADU-Web');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ||
      `Permintaan gagal (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export interface CitizenProposalPayload {
  namaPengusul: string;
  nomorHp: string;
  dusun: string;
  rtRw: string;
  kategori: ProposalCategory;
  judulUsulan: string;
  lokasi: string;
  deskripsi: string;
  fotoDataUrl?: string | null;
}

export type AdminProposalInput = Omit<
  MusrenbangProposal,
  'id' | 'nomorPengajuan' | 'sumber' | 'createdAt' | 'updatedAt' | 'fotoUrl'
>;

export type LoginResponse =
  | { status: 'authenticated'; token: string; user: AdminUser }
  | LoginChallengePendingInfo;

export interface AccountProfileBundle {
  profile: AdminAccountProfile;
  envManaged: boolean;
  pendingEmailVerification: {
    newEmail: string;
    expiresAt: number;
    createdAt: string;
  } | null;
  trustedDevices: TrustedDeviceItem[];
  activityLogs: SecurityActivityItem[];
  smtpStatus: SmtpStatusInfo;
  recentEmails: EmailOutboxLogItem[];
}

export const api = {
  // Public Citizen Endpoints
  getPublicDusun: () =>
    request<{ dusunList: Array<{ id: string; nama: string }> }>(
      '/api/public/dusun',
    ),

  submitPublicProposal: (payload: CitizenProposalPayload) =>
    request<{ nomorPengajuan: string; proposal: PublicProposalStatusItem }>(
      '/api/public/proposals',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  checkPublicProposalStatus: (nomor: string) =>
    request<{ proposal: PublicProposalStatusItem }>(
      `/api/public/proposals/status/${encodeURIComponent(nomor.trim())}`,
    ),

  fetchPublicApprovedProposals: () =>
    request<{ proposals: PublicApprovedProposal[] }>(
      '/api/public/proposals/approved',
    ),

  // Auth & Email Login Confirmation
  getAuthStatus: () =>
    request<{
      initialized: boolean;
      envManaged: boolean;
      smtpConfigured: boolean;
    }>('/api/auth/status'),

  setupAdmin: (payload: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    phone?: string;
    jabatan?: string;
  }) =>
    request<{ token: string; user: AdminUser }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { username: string; password: string }) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  checkLoginChallengeStatus: (challengeId: string, pollSecret: string) =>
    request<{
      status: 'pending' | 'approved' | 'denied' | 'expired' | 'completed';
      expiresAt: number;
      decidedAt: string | null;
      decisionReason: string;
    }>(`/api/auth/login-status/${encodeURIComponent(challengeId)}`, {
      headers: {
        'X-Login-Poll-Secret': pollSecret,
      },
    }),

  completeLoginChallenge: (challengeId: string, pollSecret: string) =>
    request<{ token: string; user: AdminUser }>('/api/auth/login-complete', {
      method: 'POST',
      body: JSON.stringify({ challengeId, pollSecret }),
    }),

  previewLoginConfirmation: (token: string, action: 'approve' | 'deny') =>
    request<LoginConfirmationPreview>(
      `/api/auth/login-confirm-preview?token=${encodeURIComponent(token)}&action=${encodeURIComponent(action)}`,
    ),

  confirmLoginFromEmail: (token: string, action: 'approve' | 'deny') =>
    request<{
      ok: boolean;
      outcome: 'approved' | 'denied';
      deviceLabel: string;
      ipAddress: string;
      locationEstimate: string;
      decidedAt: string;
    }>('/api/auth/login-confirm', {
      method: 'POST',
      body: JSON.stringify({ token, action }),
    }),

  fetchDevOutbox: (challengeId?: string, pollSecret?: string) =>
    request<{ emails: EmailOutboxLogItem[] }>(
      challengeId
        ? `/api/auth/dev-outbox?challengeId=${encodeURIComponent(challengeId)}`
        : '/api/auth/dev-outbox',
      pollSecret
        ? { headers: { 'X-Login-Poll-Secret': pollSecret } }
        : undefined,
    ),

  verifyEmailChange: (payload: { token?: string; code?: string }) =>
    request<{ ok: boolean; newEmail: string; verifiedAt: string }>(
      '/api/auth/verify-email',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getMe: () => request<{ user: AdminUser }>('/api/auth/me'),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Account Profile & Security
  fetchAccountProfile: () =>
    request<AccountProfileBundle>('/api/account/profile'),

  updateAccountProfile: (payload: {
    fullName: string;
    username: string;
    phone: string;
    jabatan: string;
  }) =>
    request<{
      token: string;
      user: AdminUser;
      profile: AdminAccountProfile;
    }>('/api/account/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  uploadAvatar: (imageDataUrl: string) =>
    request<{ user: AdminUser; profile: AdminAccountProfile }>(
      '/api/account/avatar',
      {
        method: 'POST',
        body: JSON.stringify({ imageDataUrl }),
      },
    ),

  deleteAvatar: () =>
    request<{ user: AdminUser; profile: AdminAccountProfile }>(
      '/api/account/avatar',
      { method: 'DELETE' },
    ),

  fetchAvatarBlobUrl: async (): Promise<string | null> => {
    const headers = new Headers();
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }
    const res = await fetch(`/api/account/avatar?t=${Date.now()}`, {
      headers,
      credentials: 'include',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Gagal memuat foto profil');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
  }) =>
    request<{ ok: boolean }>('/api/account/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  requestEmailChange: (payload: {
    currentPassword: string;
    newEmail: string;
  }) =>
    request<{
      ok: boolean;
      pendingEmail: string;
      expiresAt: number;
      smtpConfigured: boolean;
      deliveryStatus: 'sent' | 'failed' | 'preview_only';
    }>('/api/account/email/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelPendingEmail: () =>
    request<{ ok: boolean }>('/api/account/email/pending', {
      method: 'DELETE',
    }),

  updateSecuritySettings: (payload: {
    requireEmailLoginApproval?: boolean;
    notifyOnLoginSuccess?: boolean;
    notifyOnSecurityChange?: boolean;
    loginApprovalTtlMinutes?: number;
    approvalPolicy?: 'new_device' | 'every_login';
  }) =>
    request<{ profile: AdminAccountProfile }>('/api/account/security', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  revokeTrustedDevice: (id: string) =>
    request<{ ok: boolean }>(
      `/api/account/trusted-devices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  sendTestEmail: () =>
    request<{
      ok: boolean;
      deliveryMode: 'smtp' | 'local_preview';
      deliveryStatus: 'sent' | 'failed' | 'preview_only';
      errorMessage: string | null;
      targetEmail: string;
    }>('/api/account/test-email', { method: 'POST' }),

  // Header Notifications
  fetchNotifications: () =>
    request<{
      notifications: SecurityNotificationItem[];
      unreadCount: number;
    }>('/api/notifications'),

  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(
      `/api/notifications/${encodeURIComponent(id)}/read`,
      { method: 'POST' },
    ),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/api/notifications/read-all', {
      method: 'POST',
    }),

  // Assets
  fetchAssets: () => request<{ assets: VillageAsset[] }>('/api/assets'),

  createAsset: (
    payload: Omit<VillageAsset, 'id' | 'createdAt' | 'updatedAt'>,
  ) =>
    request<{ asset: VillageAsset }>('/api/assets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAsset: (
    id: string,
    payload: Omit<VillageAsset, 'id' | 'createdAt' | 'updatedAt'>,
  ) =>
    request<{ asset: VillageAsset }>(`/api/assets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteAsset: (id: string) =>
    request<{ ok: boolean }>(`/api/assets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Musrenbang (Admin)
  fetchProposals: () =>
    request<{ proposals: MusrenbangProposal[] }>('/api/proposals'),

  createProposal: (payload: AdminProposalInput) =>
    request<{ proposal: MusrenbangProposal }>('/api/proposals', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProposal: (id: string, payload: Partial<AdminProposalInput>) =>
    request<{ proposal: MusrenbangProposal }>(
      `/api/proposals/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),

  deleteProposal: (id: string) =>
    request<{ ok: boolean }>(`/api/proposals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  fetchProtectedPhotoBlobUrl: async (photoUrl: string): Promise<string> => {
    const headers = new Headers();
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }
    const res = await fetch(photoUrl, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Gagal memuat foto lokasi');
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // Map & Profile & News
  fetchMapConfig: () => request<{ mapConfig: MapConfig }>('/api/map-config'),

  updateMapConfig: (payload: MapConfig) =>
    request<{ mapConfig: MapConfig }>('/api/map-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  fetchProfile: () => request<{ profile: VillageProfile }>('/api/profile'),

  updateProfile: (payload: VillageProfile) =>
    request<{ profile: VillageProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  fetchNews: (refresh = false) =>
    request<NewsResponse>(`/api/news${refresh ? '?refresh=true' : ''}`),
};
