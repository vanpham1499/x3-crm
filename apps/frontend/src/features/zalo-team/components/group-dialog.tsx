'use client';
import { teamFetch } from '@/features/zalo-team/request';

import { useSharedTags, matchesTags } from './shared-tags';
import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../types';
import type { GroupCatalog, GroupContact } from '../group-actions';
import { Avatar } from './avatar';
import { Icon } from './icon';
import styles from '../zalo-team.module.css';

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
export function GroupDialog({
  conversation,
  account,
  initialMembers,
  onClose,
}: {
  conversation?: Conversation;
  account?: { id: number; name: string };
  initialMembers?: string[];
  onClose: () => void;
}) {
  const accountId = conversation?.accountId ?? account?.id;
  const tags = useSharedTags();
  const conversationId = conversation?.conversationId;
  const isGroup = !!conversation?.group;
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const receipt = useRef<string | null>(null);
  const [catalog, setCatalog] = useState<GroupCatalog | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [retry, setRetry] = useState(0);
  const [label, setLabel] = useState('');
  const filters = useRef<HTMLDivElement>(null);
  const [filterScroll, setFilterScroll] = useState({ left: false, right: false });
  const title = isGroup ? 'Thêm thành viên' : 'Tạo nhóm';
  async function request(group: object, signal?: AbortSignal, requestId?: string) {
    const response = await teamFetch('/api/zalo-team/web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        action: 'group-action',
        accountId: accountId,
        conversationId: conversationId,
        group,
        requestId,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw Error(data.error || 'WEB_UNAVAILABLE');
    }
    if (data.accountId !== accountId || data.conversationId !== conversationId)
      throw Error('WEB_IDENTITY_MISMATCH');
    return data;
  }
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    request({ kind: 'catalog' }, controller.signal)
      .then((data: GroupCatalog) => {
        if (controller.signal.aborted) return;
        setCatalog(data);
        setSelected(
          initialMembers
            ? initialMembers.filter((id) => data.contacts.some((p) => p.id === id && !p.joined))
            : data.initial,
        );
        if (!data.canAdd) setError('Bạn không có quyền thêm thành viên trong nhóm này.');
        else if (initialMembers?.some((id) => !data.contacts.some((p) => p.id === id)))
          setError('Người này chưa có trong danh sách có thể thêm của tài khoản đã chọn.');
        else if (
          initialMembers?.length &&
          initialMembers.every((id) => data.contacts.some((p) => p.id === id && p.joined))
        )
          setResult('Người này đã tham gia nhóm.');
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Chưa tải được danh sách liên hệ.');
      });
    return () => controller.abort();
  }, [accountId, conversationId, retry]);
  const chosen = (catalog?.contacts || []).filter((p) => selected.includes(p.id));
  const visible = (catalog?.contacts || []).filter(
    (p) =>
      normalize(p.name).includes(normalize(query)) &&
      matchesTags(tags.data, `${accountId}:${p.id}`, label ? [label] : []),
  );
  const measureFilters = () => {
    const el = filters.current;
    if (el)
      setFilterScroll({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
  };
  useEffect(() => {
    measureFilters();
  }, [catalog]);
  const recent = visible.filter((p) => p.recent);
  const friends = visible
    .filter((p) => !p.recent)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  function toggle(p: GroupContact) {
    if (busy || receipt.current || p.joined) return;
    setSelected((ids) =>
      ids.includes(p.id)
        ? ids.filter((id) => id !== p.id)
        : ids.length < (catalog?.limit || 0)
          ? [...ids, p.id]
          : ids,
    );
  }
  async function submit() {
    if (lock.current || !catalog?.canAdd) return;
    lock.current = true;
    setBusy(true);
    setError('');
    // Reuse the same durable request after an uncertain HTTP response.
    receipt.current ||= crypto.randomUUID();
    try {
      const data = await request(
        isGroup
          ? { kind: 'add', members: selected }
          : { kind: 'create', members: selected, name: name.trim() },
        undefined,
        receipt.current,
      );
      if (data.status === 'unknown') {
        setResult(
          'Chưa xác nhận được kết quả. Kiểm tra danh sách nhóm/thành viên trước khi tạo yêu cầu mới.',
        );
        return;
      }
      if (data.status === 'partial' || data.status === 'pending') {
        setResult(
          data.status === 'pending'
            ? 'Zalo đã tiếp nhận yêu cầu. Thành viên có thể cần xác nhận hoặc được quản trị viên duyệt.'
            : 'Zalo chỉ xử lý được một phần danh sách. Hãy kiểm tra thành viên trong nhóm.',
        );
      } else onClose();
      if (data.groupId)
        window.dispatchEvent(
          new CustomEvent('zalo-team-group-updated', {
            detail: {
              accountId: accountId,
              groupId: data.groupId,
              open: !isGroup,
            },
          }),
        );
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (
        [
          'WEB_GROUP_PERMISSION_DENIED',
          'WEB_GROUP_MEMBER_INVALID',
          'WEB_GROUP_MEMBER_LIMIT',
          'INVALID_REQUEST',
        ].includes(code)
      ) {
        receipt.current = null;
        setError(
          code === 'WEB_GROUP_PERMISSION_DENIED'
            ? 'Bạn không có quyền thêm thành viên.'
            : 'Danh sách thành viên đã thay đổi hoặc vượt giới hạn. Đóng hộp và chọn lại.',
        );
      } else setResult('Chưa xác nhận được kết quả. Kiểm tra nhóm trước khi gửi yêu cầu mới.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function row(p: GroupContact) {
    const checked = p.joined || selected.includes(p.id);
    return (
      <button
        key={p.id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={p.name}
        disabled={
          p.joined ||
          busy ||
          !!result ||
          !catalog?.canAdd ||
          (!checked && selected.length >= catalog.limit)
        }
        className={styles.groupContact}
        onClick={() => toggle(p)}
      >
        <span className={styles.groupCheck} data-checked={checked}>
          {checked && '✓'}
        </span>
        <Avatar
          conversation={{ name: p.name, avatarSrc: p.avatarSrc, color: '#b8c7e3' }}
          size={40}
        />
        <span className={styles.groupContactName}>
          {p.name}
          {p.joined && <small>Đã tham gia</small>}
        </span>
      </button>
    );
  }
  return (
    <dialog
      ref={dialog}
      className={`${styles.settingsDialog} ${styles.groupDialog}`}
      aria-label={title}
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
          <strong>{title}</strong>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4 16 16M16 4 4 16" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </header>
        {account && <p className={styles.groupAccountHint}>Tạo nhóm bằng {account.name}</p>}
        {!isGroup && (
          <div className={styles.groupNameInput}>
            <span>
              <Icon name="group" size={24} />
            </span>
            <input
              aria-label="Tên nhóm"
              autoFocus
              placeholder="Nhập tên nhóm..."
              maxLength={50}
              value={name}
              disabled={busy || !!result}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div className={styles.groupSearch}>
          <Icon name="search" size={16} />
          <input
            aria-label="Tìm liên hệ"
            autoFocus={Boolean(isGroup)}
            placeholder="Nhập tên để tìm liên hệ"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.groupFilter}>
          {filterScroll.left && (
            <button
              type="button"
              className={styles.groupFilterArrow}
              data-side="left"
              aria-label="Phân loại trước"
              onClick={() => filters.current?.scrollBy({ left: -200, behavior: 'smooth' })}
            >
              <Icon name="back" size={16} />
            </button>
          )}
          <div ref={filters} onScroll={measureFilters} className={styles.groupFilterTabs}>
            {[
              { id: '', name: 'Tất cả' },
              ...(tags.data?.tags.filter((t) => !t.archived) || []),
            ].map((l) => (
              <button
                type="button"
                key={l.id}
                aria-pressed={label === l.id}
                onClick={() => {
                  setLabel(l.id);
                  setQuery('');
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
          {filterScroll.right && (
            <button
              type="button"
              className={styles.groupFilterArrow}
              data-side="right"
              aria-label="Phân loại tiếp theo"
              onClick={() => filters.current?.scrollBy({ left: 200, behavior: 'smooth' })}
            >
              <Icon name="next" size={16} />
            </button>
          )}
        </div>
        <div className={styles.groupPicker} data-selected={chosen.length > 0}>
          <div className={styles.groupContacts}>
            {!catalog && !error && <p>Đang tải danh sách liên hệ…</p>}
            {recent.length > 0 && (
              <>
                <h4>Trò chuyện gần đây</h4>
                {recent.map(row)}
              </>
            )}
            {friends.map((p, i) => (
              <div key={p.id}>
                {(!i || normalize(friends[i - 1].name)[0] !== normalize(p.name)[0]) && (
                  <h4>{p.name[0].toUpperCase()}</h4>
                )}
                {row(p)}
              </div>
            ))}
            {catalog && !visible.length && <p>Không tìm thấy liên hệ</p>}
          </div>
          {chosen.length > 0 && (
            <aside className={styles.groupChosen}>
              <h4>
                Đã chọn{' '}
                <span>
                  {chosen.length}/{catalog?.limit}
                </span>
              </h4>
              {chosen.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  disabled={busy || !!result}
                  onClick={() => toggle(p)}
                  title={`Bỏ chọn ${p.name}`}
                >
                  <Avatar
                    conversation={{ name: p.name, avatarSrc: p.avatarSrc, color: '#b8c7e3' }}
                    size={24}
                  />
                  <span>{p.name}</span>
                  <Icon name="close" size={14} />
                </button>
              ))}
            </aside>
          )}
        </div>
        {error && (
          <p role="alert" className={styles.groupError}>
            {error}{' '}
            {!catalog && (
              <button type="button" onClick={() => setRetry((n) => n + 1)}>
                Thử lại
              </button>
            )}
          </p>
        )}
        {result && (
          <p role="status" className={styles.groupError}>
            {result}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {result ? 'Đóng' : 'Hủy'}
          </button>
          <button
            type="submit"
            disabled={busy || !!result || !catalog?.canAdd || selected.length < (isGroup ? 1 : 2)}
          >
            {busy ? 'Đang xử lý…' : isGroup ? 'Xác nhận' : 'Tạo nhóm'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
