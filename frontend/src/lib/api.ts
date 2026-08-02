// MailDay API client — browser-only. Handles JWT access/refresh rotation.

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

const ACCESS_KEY = 'md_access';
const REFRESH_KEY = 'md_refresh';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalMessages: number;
  admins: number;
  activeToday: number;
  byMailbox: Record<string, number>;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count?: { messages: number };
}

export interface AdminUsersResponse {
  items: AdminUser[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AdminMessage {
  id: string;
  ownerId: string;
  mailbox: MailboxName;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  isRead: boolean;
  sentAt: string;
}

export interface AdminMessagesResponse {
  items: AdminMessage[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type MailboxName = 'INBOX' | 'SENT' | 'DRAFT' | 'ARCHIVE' | 'TRASH' | 'SPAM';

export interface MessageSummary {
  id: string;
  mailbox: MailboxName;
  state: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  labels: string[];
  hasAttachments: boolean;
  sentAt: string;
}

export interface Message extends MessageSummary {
  body: string;
}

export interface MessageListResponse {
  items: MessageSummary[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
export function isAuthed(): boolean {
  return Boolean(getAccessToken());
}

async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as TokenPair;
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function fetchWithAuth<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const doFetch = (token: string | null) =>
    fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let res = await doFetch(getAccessToken());
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(getAccessToken());
    } else {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (typeof j?.message === 'string') msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const api = `${API_URL}/api`;

export const authApi = {
  async register(body: { email: string; username: string; password: string; displayName?: string }) {
    const data = await fetchWithAuth<TokenPair>(`${api}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },
  async login(body: { identifier: string; password: string }) {
    const data = await fetchWithAuth<TokenPair>(`${api}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },
  async logout() {
    const rt = getRefreshToken();
    await fetchWithAuth(`${api}/auth/logout`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => undefined);
    clearTokens();
  },
};

export const usersApi = {
  me: () => fetchWithAuth<UserProfile>(`${api}/users/me`),
  update: (body: { displayName?: string; avatarUrl?: string }) =>
    fetchWithAuth<UserProfile>(`${api}/users/me`, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const adminApi = {
  stats: () => fetchWithAuth<AdminStats>(`${api}/admin/stats`),
  users: (params: { page?: number; limit?: number; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    const q = qs.toString();
    return fetchWithAuth<AdminUsersResponse>(`${api}/admin/users${q ? `?${q}` : ''}`);
  },
  updateUser: (id: string, body: { role?: 'USER' | 'ADMIN'; isActive?: boolean }) =>
    fetchWithAuth<AdminUser>(`${api}/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  removeUser: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`${api}/admin/users/${id}`, { method: 'DELETE' }),
  messages: (params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return fetchWithAuth<AdminMessagesResponse>(`${api}/admin/messages${q ? `?${q}` : ''}`);
  },
};

export type AiMode = 'draft' | 'reply' | 'summarize' | 'rewrite';
export type AiTone = 'professional' | 'friendly' | 'short' | 'expand';

export const aiApi = {
  generate: (body: { mode: AiMode; text: string; subject?: string; tone?: AiTone }) =>
    fetchWithAuth<{ text: string }>(`${api}/ai/generate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export interface ImapAccount {
  id: string;
  host: string;
  port: number;
  username: string;
  secure: boolean;
  lastError: string | null;
  createdAt: string;
}

export const mailApi = {
  listImap: () => fetchWithAuth<ImapAccount[]>(`${api}/mail/imap`),
  connectImap: (body: { host: string; port?: number; username: string; password: string; secure?: boolean }) =>
    fetchWithAuth<ImapAccount>(`${api}/mail/imap`, { method: 'POST', body: JSON.stringify(body) }),
  removeImap: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`${api}/mail/imap/${id}`, { method: 'DELETE' }),
  syncImap: (id: string) =>
    fetchWithAuth<ImapAccount>(`${api}/mail/imap/${id}/sync`, { method: 'POST' }),
};

export const messagesApi = {
  list: (params: { mailbox?: string; search?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.mailbox) qs.set('mailbox', params.mailbox);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return fetchWithAuth<MessageListResponse>(`${api}/messages${q ? `?${q}` : ''}`);
  },
  get: (id: string) => fetchWithAuth<Message>(`${api}/messages/${id}`),
  create: (body: { to: string[]; subject?: string; body?: string; mailbox?: MailboxName; labels?: string[]; isImportant?: boolean }) =>
    fetchWithAuth<Message>(`${api}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) =>
    fetchWithAuth<Message>(`${api}/messages/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`${api}/messages/${id}`, { method: 'DELETE' }),
};
