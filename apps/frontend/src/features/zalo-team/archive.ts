import { teamFetch } from './request';
import type { ChatMessage } from './types';
import { initializeCsrfProtection } from '@/services/api/client';

let csrfRefresh: Promise<unknown> | null = null;
export type ArchiveSource = {
  id: string;
  account_id: number;
  conversation_id: string;
  name: string;
  account_name: string;
  canonical: string;
  oldest: number | null;
  latest: number | null;
  last_sync: string | null;
  error: string | null;
  history_done: boolean;
  catchup_cursor?: string | null;
};
export type ArchiveStatus = {
  canMonitorServer?: boolean;
  storageLocation?: 'local' | 'vps';
  pcRecovery?: { queued: number; checked: number; accounts?: { name: string; queued: number }[] };
  fileSummary?: {
    ready: number;
    pending: number;
    failed: number;
    dismissed?: number;
    retrying: number;
    retryDue: number;
    nextRetryAt: string | null;
    needsAttention: number;
    originalErrors: number;
    previewErrors: number;
    groups: Record<string, number>;
  };
  progress: {
    phase: string;
    pages: number;
    processed: number;
    at: string;
    source?: string;
    account?: string;
    oldest?: number;
    file?: string;
    time?: number;
  } | null;
  storage: { archive: string; backups: string; database: string };
  settings: {
    enabled: boolean;
    media: boolean;
    daily_backup: boolean;
    accounts: number[];
    heartbeat: string | null;
    last_sync: string | null;
    error: string | null;
  };
  accounts: { id: number; name: string; status: string; avatarSrc?: string }[];
  sources: Pick<
    ArchiveSource,
    'id' | 'account_id' | 'account_name' | 'history_done' | 'catchup_cursor' | 'error'
  >[];
  issuesLoaded?: boolean;
  fileIssues: {
    id: string;
    name: string;
    error: string;
    time: number;
    autoRetry: boolean;
    retryAt: string | null;
    pcCheck?: 'queued' | 'checked';
    role?: 'preview' | 'original';
    originalSaved?: boolean;
    pcCheckedAt?: string | null;
    sources?: Pick<ArchiveSource, 'account_id' | 'conversation_id' | 'name' | 'account_name'>[];
  }[];
  maxFileBytes: number;
  imports?: {
    id: string;
    source_id: string;
    state: string;
    updated_at: string;
    summary: {
      total: number;
      processed: number;
      added: number;
      existing: number;
      repaired?: number;
      conflicts: number;
      files: number;
      filesAdded?: number;
      filesReused?: number;
      availableFiles?: number;
      phase?: 'files' | 'complete';
      name: string;
      accountName: string;
      oldest: number | null;
      newest: number | null;
      coverage?: {
        skipped: number;
        complete: boolean;
        mode?: string;
        scanned?: number;
        unchanged?: number;
        reusedFiles?: number;
      };
    };
  }[];
  checkpoints: ArchiveCheckpoint[];
  stats: {
    messages: number;
    observations: number;
    savedMessages: number;
    bytes: number;
    savedBytes: number;
    pendingFiles: number;
    failedFiles: number;
    readyFiles: number;
  };
  backups: {
    id: string;
    state: string;
    bytes: number;
    created_at: string;
    verified_at: string | null;
    error: string | null;
  }[];
};
export type ArchiveDay = {
  dismissed?: number;
  date: string;
  messages: number;
  conversations: number;
  files: number;
  ready: number;
  pending: number;
  failed: number;
  blobs: number;
  bytes: number;
  unscanned: number;
  gaps: number;
  oldest: number;
  latest: number;
};
export async function archiveRequest<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const send = async () => {
    try {
      return await teamFetch('/api/zalo-team/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Mất kết nối tới kho lưu trữ. Kiểm tra kết nối rồi thử lại.');
    }
  };
  let r = await send();
  // A 419 is rejected before the command runs; refresh the session token once.
  if (r.status === 419) {
    csrfRefresh ??= initializeCsrfProtection().finally(() => {
      csrfRefresh = null;
    });
    await csrfRefresh;
    r = await send();
  }
  if (r.status === 401) throw Error('Phiên CRM đã hết hạn. Vui lòng đăng nhập lại.');
  const v = await r.json();
  if (!r.ok) throw Error(v.message || 'Chưa thực hiện được thao tác.');
  return v;
}
export const archiveDate = (v: string | number | null) => {
  if (!v) return 'Chưa có';
  if (typeof v === 'string') {
    v = v.replace(' ', 'T');
    if (/[+-]\d{2}$/.test(v)) v += ':00';
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(v)) v += 'Z';
  }
  const date = new Date(v);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định' : date.toLocaleString('vi-VN');
};
export const archiveBytes = (v: number) =>
  v >= 1073741824
    ? (v / 1073741824).toFixed(2) + ' GB'
    : v >= 1048576
      ? (v / 1048576).toFixed(1) + ' MB'
      : Math.round(v / 1024) + ' KB';

export async function prioritizePcSources(
  sources: Pick<ArchiveSource, 'account_id' | 'conversation_id'>[],
) {
  const pc = await archiveRequest<{
    state: string;
    accountId?: number;
    workerOnline: boolean;
  }>({ kind: 'pc-status' });
  const source = sources.find((s) => s.account_id === pc.accountId);
  if (!pc.workerOnline) throw Error('Dịch vụ PC chưa chạy. Khởi động dịch vụ rồi thử lại.');
  if (!source || !['ready', 'queued-import', 'exporting', 'importing'].includes(pc.state))
    throw Error('Kết nối Zalo PC với tài khoản của hội thoại ở phía trên, rồi thử lại.');
  await archiveRequest({
    kind: 'pc-prioritize',
    accountId: source.account_id,
    conversationId: source.conversation_id,
    start: true,
  });
}
export type ArchiveHistory = {
  messages: ChatMessage[];
  cursor: { id: string; time: string } | null;
  hasMore: boolean;
};

export type ArchiveCheckpoint = {
  id: string;
  date: string;
  created_at: string;
  verified_at: string | null;
  summary: {
    messages: number;
    contents: number;
    files: number;
    bytes: number;
    pendingFiles: number;
    unscannedSources: number;
    sources: {
      id: string;
      name: string;
      account_name: string;
      messages: number;
    }[];
  };
  verification: {
    ok: boolean;
    messages: number;
    missingMessages: number;
    changedMessages: number;
    files: number;
    missingFiles: number;
  } | null;
};
