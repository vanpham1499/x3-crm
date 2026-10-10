'use client';
import { TeamDatePicker } from './team-date-picker';
import { teamFetch } from '@/features/zalo-team/request';

import { TeamSelect } from './team-select';
import { useEffect, useRef, useState } from 'react';
import { validTopic, type TopicCreate, type TopicCatalog } from '../topics';
import styles from '../zalo-team.module.css';
const drafts = new Map<string, TopicCreate>();
export function TopicIcon({ kind }: { kind: 'note' | 'reminder' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'reminder' ? (
        <>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 8v5l3 2M4 3 1 6m19-3 3 3M8 1h8" />
        </>
      ) : (
        <>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h6" />
        </>
      )}
    </svg>
  );
}
export function TopicCreateDialog({
  kind,
  accountId,
  conversationId,
  onClose,
}: {
  kind: 'note' | 'reminder';
  accountId: number;
  conversationId: string;
  onClose: () => void;
}) {
  const key = `${accountId}:${conversationId}:${kind}`,
    dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false),
    requestId = useRef<string>();
  const [form, setForm] = useState<TopicCreate>(
    () =>
      drafts.get(key) ||
      (kind === 'note'
        ? { kind, title: '', pin: false }
        : {
            kind,
            title: '',
            onlyMe: false,
            startTime: Math.floor((Date.now() + 1800000) / 60000) * 60000,
            repeat: 'none',
            byDay: [],
          }),
  );
  const [dateValid, setDateValid] = useState(true);
  const [catalog, setCatalog] = useState<TopicCatalog | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false),
    [chip, setChip] = useState('30');
  const title = kind === 'note' ? 'Tạo ghi chú' : 'Tạo nhắc hẹn';
  const change = (patch: Partial<TopicCreate>) =>
    setForm((old) => ({ ...old, ...patch }) as TopicCreate);
  async function request(topic: object, id?: string, signal?: AbortSignal) {
    const response = await teamFetch('/api/zalo-team/web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        action: 'topic-action',
        accountId,
        conversationId,
        topic,
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
    request({ kind: 'catalog' }, undefined, abort.signal)
      .then(setCatalog)
      .catch(() => {
        if (!abort.signal.aborted) setError('Chưa tải được thiết lập. Đóng và mở lại để thử lại.');
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    drafts.set(key, form);
  }, [key, form]);
  const available = !!catalog && (kind === 'note' ? catalog.canNote : catalog.canReminder);
  const timeValid =
    form.kind === 'note' || form.startTime >= Date.now() + (catalog?.minLeadMs || 60000);
  async function submit() {
    if (lock.current || uncertain || !available || !validTopic(form) || !dateValid) return;
    if (!timeValid) {
      setError('Vui lòng chọn thời gian nhắc hẹn ít nhất 1 phút nữa.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const data = await request(form, requestId.current);
      if (data.status !== 'confirmed') {
        setUncertain(true);
        setError('Chưa xác nhận được kết quả. Kiểm tra hội thoại trước khi tạo lại.');
        return;
      }
      drafts.delete(key);
      window.dispatchEvent(
        new CustomEvent('zalo-team-topic-created', { detail: { accountId, conversationId } }),
      );
      onClose();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (
        [
          'INVALID_REQUEST',
          'WEB_TOPIC_NOT_READY',
          'WEB_REMINDER_TIME_INVALID',
          'WEB_GROUP_PERMISSION_DENIED',
          'WEB_ACCOUNT_OFFLINE',
          'WEB_CONVERSATION_NOT_FOUND',
        ].includes(code)
      ) {
        requestId.current = undefined;
        setError(
          code === 'WEB_REMINDER_TIME_INVALID'
            ? 'Vui lòng chọn thời gian trong tương lai.'
            : code === 'WEB_GROUP_PERMISSION_DENIED'
              ? 'Bạn chưa có quyền thực hiện hoặc danh sách ghim đã đầy.'
              : 'Không thực hiện được. Kiểm tra kết nối và thử lại.',
        );
      } else {
        setUncertain(true);
        setError('Chưa xác nhận được kết quả. Kiểm tra hội thoại trước khi tạo lại.');
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function chooseTime(value: string) {
    setChip(value);
    if (form.kind !== 'reminder' || value === 'other') return;
    const d = new Date();
    if (value === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else {
      d.setMinutes(d.getMinutes() + Number(value));
      d.setSeconds(0, 0);
    }
    change({ startTime: d.getTime() });
  }
  return (
    <dialog
      ref={dialog}
      className={`${styles.settingsDialog} ${styles.topicDialog}`}
      data-kind={kind}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <header>
          <strong>{title}</strong>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            >
              <path d="m5 5 14 14M19 5 5 19" />
            </svg>
          </button>
        </header>
        <div className={styles.topicBody}>
          <label className={styles.topicContent}>
            Nội dung
            <textarea
              aria-label="Nội dung"
              autoFocus
              placeholder={
                kind === 'note' ? 'Nhập nội dung mới hoặc dán link' : 'Nhập nội dung mới hoặc link'
              }
              maxLength={3000}
              value={form.title}
              disabled={busy || uncertain}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          {form.kind === 'note' ? (
            <label className={styles.topicPin}>
              <input
                type="checkbox"
                checked={form.pin}
                disabled={!catalog?.canPin || busy || uncertain}
                onChange={(e) => change({ pin: e.target.checked })}
              />
              Ghim lên đầu trò chuyện
            </label>
          ) : (
            <>
              <fieldset disabled={busy || uncertain}>
                <legend>Kiểu nhắc hẹn</legend>
                <label>
                  <input
                    type="radio"
                    name="audience"
                    checked={!form.onlyMe}
                    onChange={() => change({ onlyMe: false })}
                  />
                  Tất cả
                </label>
                <label>
                  <input
                    type="radio"
                    name="audience"
                    checked={form.onlyMe}
                    disabled={!catalog?.onlyMe}
                    onChange={() => change({ onlyMe: true })}
                  />
                  Chỉ mình tôi
                </label>
              </fieldset>
              <section>
                <span>Chọn thời gian</span>
                <div className={styles.topicTimeChips}>
                  {[
                    ['15', '15 phút nữa'],
                    ['30', '30 phút nữa'],
                    ['tomorrow', '9:00 ngày mai'],
                    ['other', 'Khác'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy || uncertain}
                      aria-pressed={chip === value}
                      onClick={() => chooseTime(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
              <div>
                <TeamDatePicker
                  withTime
                  onValidityChange={setDateValid}
                  clearable={false}
                  label="Chọn ngày nhắc hẹn"
                  value={new Date(
                    form.startTime - new Date(form.startTime).getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)}
                  disabled={busy || uncertain}
                  onChange={(value) => {
                    if (value) {
                      setChip('other');
                      change({ startTime: new Date(value).getTime() });
                    }
                  }}
                />
              </div>
              <label>
                Chọn kiểu lặp lại (vd: Lặp lại hằng tuần)
                <TeamSelect
                  aria-label="Chọn kiểu lặp lại"
                  disabled={busy || uncertain}
                  value={form.repeat}
                  onChange={(e) =>
                    change({
                      repeat: e.target.value as typeof form.repeat,
                      byDay:
                        e.target.value === 'weeklyMultiDays' ? ['MO', 'TU', 'WE', 'TH', 'FR'] : [],
                    })
                  }
                >
                  {[
                    ['none', 'Không lặp lại'],
                    ['daily', 'Hằng ngày'],
                    ['weekly', 'Hằng tuần'],
                    ['weeklyMultiDays', 'Nhiều ngày hằng tuần'],
                    ['monthly', 'Hằng tháng'],
                    ['yearly', 'Hằng năm'],
                  ].map(([value, label]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={
                        ['weeklyMultiDays', 'yearly'].includes(value) && !catalog?.advancedRepeat
                      }
                    >
                      {label}
                    </option>
                  ))}
                </TeamSelect>
              </label>
              {form.repeat === 'weeklyMultiDays' && (
                <div className={styles.topicWeekdays}>
                  {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day, i) => (
                    <label key={day}>
                      <input
                        type="checkbox"
                        disabled={busy || uncertain}
                        checked={form.byDay.includes(day)}
                        onChange={(e) =>
                          change({
                            byDay: e.target.checked
                              ? [...form.byDay, day]
                              : form.byDay.filter((d) => d !== day),
                          })
                        }
                      />
                      {i === 6 ? 'CN' : `T${i + 2}`}
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
          {!timeValid && (
            <p role="alert" className={styles.topicError}>
              Chọn thời gian nhắc hẹn ít nhất 1 phút nữa.
            </p>
          )}
          {catalog && !available && (
            <p role="alert" className={styles.topicError}>
              Phiên Zalo này chưa hỗ trợ tạo {kind === 'note' ? 'ghi chú' : 'nhắc hẹn'} trong cuộc
              trò chuyện này.
            </p>
          )}
          {form.title.trim() && !validTopic(form) && (
            <p className={styles.topicError}>
              Nội dung tối đa 3.000 ký tự và 3.700 byte; hãy kiểm tra nội dung và ngày lặp lại.
            </p>
          )}
          {error && (
            <p role="alert" className={styles.topicError}>
              {error}
            </p>
          )}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            disabled={
              busy || uncertain || !available || !timeValid || !validTopic(form) || !dateValid
            }
          >
            {busy ? 'Đang tạo…' : title}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
