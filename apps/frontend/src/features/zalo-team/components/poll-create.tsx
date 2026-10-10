'use client';
import { TeamDatePicker } from './team-date-picker';
import { teamFetch } from '@/features/zalo-team/request';

import { useEffect, useRef, useState } from 'react';
import { TopicCreateDialog, TopicIcon } from './topic-create';
import { Icon } from './icon';
import { PollIcon } from './poll-card';
import { validPoll, type PollCreate, type PollCatalog } from '../polls';
import styles from '../zalo-team.module.css';

const drafts = new Map<string, PollCreate>();
const initial: PollCreate = {
  kind: 'create',
  question: '',
  options: ['', ''],
  expiredTime: 0,
  pinAct: false,
  allowMultiChoices: true,
  allowAddNewOption: true,
  isAnonymous: false,
  isHideVotePreview: false,
};
export function PollCreateDialog({
  accountId,
  conversationId,
  onClose,
}: {
  accountId: number;
  conversationId: string;
  onClose: () => void;
}) {
  const key = `${accountId}:${conversationId}`;
  const dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false),
    requestId = useRef<string>();
  const [form, setForm] = useState<PollCreate>(
    () => drafts.get(key) || { ...initial, options: ['', ''] },
  );
  const [dateValid, setDateValid] = useState(true);
  const [settings, setSettings] = useState(false),
    [catalog, setCatalog] = useState<PollCatalog | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const options = form.options.map((x) => x.trim()).filter(Boolean);
  const duplicate = new Set(options).size !== options.length;
  const payload = {
    ...form,
    options,
    allowAddNewOption: form.allowAddNewOption && !form.isHideVotePreview,
  };
  async function request(poll: object, signal?: AbortSignal, id?: string) {
    const response = await teamFetch('/api/zalo-team/web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        action: 'poll-action',
        accountId,
        conversationId,
        poll,
        requestId: id,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'WEB_UNAVAILABLE');
    if (data.accountId !== accountId || data.conversationId !== conversationId)
      throw Error('WEB_IDENTITY_MISMATCH');
    return data;
  }
  useEffect(() => {
    dialog.current?.showModal();
    const abort = new AbortController();
    request({ kind: 'catalog' }, abort.signal)
      .then(setCatalog)
      .catch(() => {
        if (!abort.signal.aborted)
          setError('Chưa tải được thiết lập bình chọn. Đóng và mở lại để thử lại.');
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    drafts.set(key, form);
  }, [form, key]);
  const change = (part: Partial<PollCreate>) => setForm((old) => ({ ...old, ...part }));
  async function submit() {
    if (lock.current || !catalog || !validPoll(payload) || uncertain || !dateValid) return;
    if (payload.expiredTime && payload.expiredTime <= Date.now()) {
      setError('Vui lòng chọn thời hạn trong tương lai.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const data = await request(payload, undefined, requestId.current);
      if (data.status !== 'confirmed') {
        setUncertain(true);
        setError('Chưa xác nhận được kết quả. Kiểm tra hội thoại trước khi tạo bình chọn khác.');
        return;
      }
      drafts.delete(key);
      window.dispatchEvent(
        new CustomEvent('zalo-team-poll-created', { detail: { accountId, conversationId } }),
      );
      if (payload.pinAct && data.pinStatus !== 'confirmed') {
        setUncertain(true);
        setError(
          'Đã tạo bình chọn, nhưng chưa xác nhận được ghim. Đóng hộp và kiểm tra hội thoại; không tạo lại.',
        );
        return;
      }
      onClose();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (
        [
          'INVALID_REQUEST',
          'WEB_GROUP_PERMISSION_DENIED',
          'WEB_ACCOUNT_OFFLINE',
          'WEB_POLL_NOT_READY',
        ].includes(code)
      ) {
        requestId.current = undefined;
        setError(
          code === 'WEB_GROUP_PERMISSION_DENIED'
            ? 'Bạn không có quyền tạo hoặc ghim bình chọn trong nhóm này.'
            : 'Chưa thể tạo bình chọn. Kiểm tra kết nối, thời hạn và các lựa chọn.',
        );
      } else {
        setUncertain(true);
        setError('Chưa xác nhận được kết quả. Kiểm tra hội thoại trước khi tạo bình chọn khác.');
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const toggle = (
    field:
      'pinAct' | 'allowMultiChoices' | 'allowAddNewOption' | 'isAnonymous' | 'isHideVotePreview',
    label: string,
    disabled = false,
  ) => (
    <label className={styles.pollSettingRow}>
      {label}
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={
          field === 'allowAddNewOption' ? form[field] && !form.isHideVotePreview : form[field]
        }
        disabled={disabled || busy || uncertain}
        onClick={() => change({ [field]: !form[field] })}
      >
        <span />
      </button>
    </label>
  );
  return (
    <dialog
      ref={dialog}
      aria-label="Tạo bình chọn"
      className={`${styles.settingsDialog} ${styles.pollDialog}`}
      data-expanded={settings}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <header>
          <strong>Tạo bình chọn</strong>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d="m4 4 12 12M16 4 4 16" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </header>
        <div className={styles.pollBody}>
          <div className={styles.pollForm}>
            <label htmlFor="poll-question">Chủ đề bình chọn</label>
            <div className={styles.pollQuestion}>
              <textarea
                id="poll-question"
                autoFocus
                placeholder="Đặt câu hỏi bình chọn"
                maxLength={200}
                value={form.question}
                disabled={busy || uncertain}
                onChange={(e) => change({ question: e.target.value })}
              />
              <small>{form.question.length}/200</small>
            </div>
            <label>Các lựa chọn</label>
            {form.options.map((value, i) => (
              <div key={i} className={styles.pollOption}>
                <input
                  aria-label={`Lựa chọn ${i + 1}`}
                  placeholder={`Lựa chọn ${i + 1}`}
                  maxLength={120}
                  value={value}
                  disabled={busy || uncertain}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((old) => ({
                      ...old,
                      options: old.options.map((x, j) => (i === j ? value : x)),
                    }));
                  }}
                />
                {form.options.length > 2 && (
                  <button
                    type="button"
                    disabled={busy || uncertain}
                    aria-label={`Xóa lựa chọn ${i + 1}`}
                    onClick={() => change({ options: form.options.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {duplicate && (
              <p role="alert" className={styles.pollError}>
                Các lựa chọn không được trùng nhau.
              </p>
            )}
            <button
              type="button"
              className={styles.pollAddOption}
              disabled={busy || uncertain || form.options.length >= (catalog?.maxOptions || 30)}
              onClick={() => change({ options: [...form.options, ''] })}
            >
              <span>＋</span>Thêm lựa chọn
            </button>
          </div>
          {settings && (
            <aside className={styles.pollSettings}>
              <strong>Thời hạn bình chọn</strong>
              <div className={styles.pollDeadline} data-empty={!form.expiredTime}>
                <TeamDatePicker
                  withTime
                  onValidityChange={setDateValid}
                  label="Thời hạn (bỏ trống: không thời hạn)"
                  disabled={busy || uncertain}
                  value={
                    form.expiredTime
                      ? new Date(
                          form.expiredTime - new Date(form.expiredTime).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ''
                  }
                  onChange={(value) =>
                    change({ expiredTime: value ? new Date(value).getTime() : 0 })
                  }
                />
              </div>
              <hr />
              <strong>Thiết lập nâng cao</strong>
              {toggle('pinAct', 'Ghim lên đầu trò chuyện', !catalog?.canPin)}
              {toggle('allowMultiChoices', 'Chọn nhiều phương án')}
              {toggle('allowAddNewOption', 'Có thể thêm phương án', form.isHideVotePreview)}
              <hr />
              <strong>Bình chọn ẩn danh</strong>
              {toggle('isHideVotePreview', 'Ẩn kết quả khi chưa bình chọn', !catalog?.hidePreview)}
              {toggle('isAnonymous', 'Ẩn người bình chọn', !catalog?.anonymous)}
            </aside>
          )}
        </div>
        {error && (
          <p className={styles.pollError} role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className={styles.pollSettingsButton}
            aria-label="Thiết lập bình chọn"
            aria-pressed={settings}
            onClick={() => setSettings((v) => !v)}
          >
            <Icon name="groupSettings" size={24} />
          </button>
          <button type="button" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy || uncertain || !catalog || !validPoll(payload) || !dateValid}
          >
            {busy ? 'Đang tạo…' : 'Tạo bình chọn'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export function PollMenu({
  accountId,
  conversationId,
  blocked,
}: {
  accountId?: number;
  conversationId?: string;
  blocked: boolean;
}) {
  const [topicKind, setTopicKind] = useState<'note' | 'reminder' | null>(null);
  const [menu, setMenu] = useState(false),
    [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    function close(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    setOpen(false);
    setTopicKind(null);
  }, [accountId, conversationId]);
  return (
    <span ref={ref} className={styles.pollMenuAnchor}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label="Thêm"
        aria-expanded={menu}
        disabled={blocked || !accountId || !conversationId}
        onClick={() => {
          const rect = ref.current?.getBoundingClientRect();
          if (rect)
            setPosition({ left: Math.min(rect.left, window.innerWidth - 280), top: rect.top - 8 });
          setMenu((v) => !v);
        }}
      >
        <Icon name="more" size={24} />
      </button>
      {menu && (
        <div role="menu" className={styles.pollMenu} style={position}>
          <button
            type="button"
            role="menuitem"
            disabled={!conversationId?.startsWith('g')}
            onClick={() => {
              setMenu(false);
              setOpen(true);
            }}
          >
            <PollIcon />
            Tạo bình chọn
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              setTopicKind('reminder');
            }}
          >
            <TopicIcon kind="reminder" />
            Tạo nhắc hẹn
          </button>
          {conversationId?.startsWith('g') && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                setTopicKind('note');
              }}
            >
              <TopicIcon kind="note" />
              Tạo ghi chú
            </button>
          )}
        </div>
      )}
      {topicKind && accountId && conversationId && (
        <TopicCreateDialog
          key={`${accountId}:${conversationId}:${topicKind}`}
          kind={topicKind}
          accountId={accountId}
          conversationId={conversationId}
          onClose={() => setTopicKind(null)}
        />
      )}
      {open && accountId && conversationId && (
        <PollCreateDialog
          key={`${accountId}:${conversationId}`}
          accountId={accountId}
          conversationId={conversationId}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
