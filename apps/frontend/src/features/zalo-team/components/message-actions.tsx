'use client';
import { useAccountAccess } from '../use-account-access';
import { canAccount } from '../account-access';
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './icon';
import { emojiTokens, useEmojiArtwork } from '../emoji-artwork';
import type { ChatMessage, MessageOperation } from '../types';
import styles from '../zalo-team.module.css';

const reactions = [
  [3, '/-strong', 'Like', '👍'],
  [5, '/-heart', 'Tim', '❤️'],
  [0, ':>', 'Cười', '😆'],
  [32, ':o', 'Ngạc nhiên', '😮'],
  [2, ':-((', 'Buồn', '😢'],
  [20, ':-h', 'Giận', '😠'],
] as const;
function Reaction({ type, accountId }: { type: number; accountId?: number }) {
  const r = reactions.find((r) => r[0] === type) || reactions[0];
  useEmojiArtwork(accountId);
  const tokens = emojiTokens(r[1], accountId);
  const art = tokens.find((t) => t.sprite) || {
    sprite: 'https://chat.zalo.me/assets/emoji-md.6fa8afb705db684e87d22868d5d85557.png?v=20222710',
    position: (
      {
        3: '84% 82.5%',
        5: '84% 72.5%',
        0: '82% 7.5%',
        32: '84% 20%',
        2: '84% 2.5%',
        20: '84% 5%',
      } as Record<number, string>
    )[type],
  };
  return (
    <span className={styles.reactionArt}>
      {art ? (
        <span
          role="img"
          aria-label={r[2]}
          style={{
            display: 'inline-block',
            width: '100%',
            height: '100%',
            backgroundImage: `url("${art.sprite}")`,
            backgroundSize: '5100% auto',
            backgroundPosition: art.position,
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
        r[3]
      )}
    </span>
  );
}
const failures: Record<string, string> = {
  WEB_ACCESS_DENIED: 'Bạn không có quyền thực hiện thao tác này.',
  WEB_RECALL_NOT_ALLOWED: 'Tin nhắn này đã quá thời hạn thu hồi hoặc không do bạn gửi.',
  WEB_PIN_NOT_ALLOWED: 'Zalo không cho phép ghim tin nhắn này.',
  WEB_MESSAGE_NOT_FOUND: 'Tin nhắn không còn trong lịch sử của tài khoản này.',
  WEB_MESSAGE_UNAVAILABLE: 'Tin nhắn đã được thu hồi.',
  WEB_ACCOUNT_OFFLINE: 'Tài khoản Zalo đã mất kết nối.',
  WEB_ACTION_UNKNOWN: 'Chưa xác nhận được kết quả. Kiểm tra lại tin nhắn trước khi thao tác tiếp.',
};
export function MessageActions({
  message,
  accountId,
  conversationId,
  onReply,
  onAction,
  contextMenu,
}: {
  contextMenu?: { left: number; top: number } | null;
  message: ChatMessage;
  accountId?: number;
  conversationId?: string;
  onReply: () => void;
  onAction: (operation: MessageOperation, reaction?: number) => Promise<void>;
}) {
  const access = useAccountAccess();
  const canWrite = !!access && !!accountId && canAccount(access, accountId, 'write');
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const [confirm, setConfirm] = useState<'recall' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const reactorsId = useId();
  const [chosenReaction, setChosenReaction] = useState<number | null | undefined>();
  useEffect(() => {
    setChosenReaction(undefined);
  }, [message.id, message.currentReaction, message.reactions]);
  const currentReaction =
    chosenReaction !== undefined
      ? chosenReaction
      : (message.currentReaction ?? message.reactions?.find((r) => r.mine)?.type ?? null);
  const reactors = [
    ...new Map(
      (message.reactions || []).flatMap((r) => r.users || []).map((user) => [user.id, user]),
    ).values(),
  ];
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const box = menuRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(menu.left, window.innerWidth - box.width - 8));
    const top = Math.max(8, Math.min(menu.top, window.innerHeight - box.height - 8));
    if (left !== menu.left || top !== menu.top) setMenu({ left, top });
  }, [menu]);
  const recalled = message.kind === 'recalled';
  const menuHeight = recalled
    ? 50
    : (access?.admin && message.mine && message.canRecall ? 6 : 5) * 40 + 27 + 10;
  useEffect(() => {
    if (!contextMenu || busy) return;
    setMenu({
      left: Math.max(8, Math.min(contextMenu.left, window.innerWidth - 252)),
      top: Math.max(8, Math.min(contextMenu.top, window.innerHeight - menuHeight - 8)),
    });
    // Only a new pointer action opens the menu; data refreshes must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);
  async function act(op: MessageOperation, reaction?: number) {
    if (busy || message.archived) return;
    setBusy(true);
    setMenu(null);
    setConfirm(null);
    setNotice('');
    try {
      await onAction(op, reaction);
      if (alive.current && op === 'react') setChosenReaction(reaction === -1 ? null : reaction);
      if (alive.current && op === 'pin') setNotice('Đã ghim tin nhắn');
    } catch (e) {
      if (alive.current)
        setNotice(
          failures[e instanceof Error ? e.message : ''] ||
            'Chưa thực hiện được thao tác. Vui lòng kiểm tra kết nối Zalo.',
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const allEntries: {
    label: string;
    icon: IconName;
    run: () => void;
    danger?: boolean;
    separator?: boolean;
  }[] = [
    ...(canWrite && conversationId
      ? [
          {
            label: 'Tạo công việc',
            icon: 'documents' as const,
            run: () => {
              setMenu(null);
              window.dispatchEvent(
                new CustomEvent('zalo-work-create-task', {
                  detail: {
                    accountId,
                    conversationId,
                    id: message.id,
                    time: message.time,
                    text: message.text || 'Xử lý nội dung tin nhắn',
                  },
                }),
              );
            },
          },
        ]
      : []),
    {
      label: 'Trả lời',
      icon: 'replyLine',
      run: () => {
        setMenu(null);
        onReply();
      },
    },
    {
      label: 'Copy tin nhắn',
      separator: true,
      icon: 'copy',
      run: () => {
        setMenu(null);
        void navigator.clipboard
          .writeText(message.text || message.attachments.map((a) => a.url || a.name).join('\n'))
          .then(
            () => setNotice('Đã copy tin nhắn'),
            () =>
              setNotice('Không thể truy cập clipboard. Hãy cho phép sao chép trong trình duyệt.'),
          );
      },
    },
    { label: 'Ghim tin nhắn', icon: 'pinLine', separator: true, run: () => void act('pin') },
    {
      label: message.starred ? 'Bỏ đánh dấu tin nhắn' : 'Đánh dấu tin nhắn',
      icon: 'starLine',
      run: () => void act(message.starred ? 'unstar' : 'star'),
    },
    ...(access?.admin && message.mine && message.canRecall
      ? [
          {
            label: 'Thu hồi',
            icon: 'recallLine' as const,
            separator: true,
            danger: true,
            run: () => {
              setMenu(null);
              setConfirm('recall');
            },
          },
        ]
      : []),
    {
      label: 'Xóa chỉ ở phía tôi',
      icon: 'trashLine',
      separator: !(access?.admin && message.mine && message.canRecall),
      danger: true,
      run: () => {
        setMenu(null);
        setConfirm('delete');
      },
    },
  ];
  const allowedEntries = allEntries.filter(
    (entry) => access?.admin || entry.label !== 'Xóa chỉ ở phía tôi',
  );
  const entries = message.archived
    ? allEntries
        .filter((entry) => entry.label === 'Copy tin nhắn')
        .map((entry) => ({ ...entry, separator: false }))
    : recalled
      ? allowedEntries
          .filter((entry) => entry.label === 'Xóa chỉ ở phía tôi')
          .map((entry) => ({ ...entry, separator: false }))
      : allowedEntries;
  if (!canWrite) return null;
  return (
    <>
      {!recalled && (
        <>
          <div className={styles.messageActions} data-open={!!menu || undefined}>
            {!message.archived && (
              <>
                <button aria-label="Trả lời" title="Trả lời" onClick={onReply} disabled={busy}>
                  <Icon name="reply" size={14} />
                </button>
                <button
                  aria-label="Chia sẻ (chưa triển khai)"
                  title="Chia sẻ (chưa triển khai)"
                  aria-disabled="true"
                >
                  <Icon name="share" size={14} />
                </button>
              </>
            )}
            <button
              aria-label="Thêm thao tác tin nhắn"
              title="Thêm"
              aria-haspopup="menu"
              aria-expanded={!!menu}
              disabled={busy}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenu(
                  menu
                    ? null
                    : {
                        left: Math.max(8, Math.min(r.left, window.innerWidth - 252)),
                        top: Math.max(
                          8,
                          Math.min(
                            r.bottom + 4,
                            window.innerHeight - (entries.length * 40 + 27 + 10) - 8,
                          ),
                        ),
                      },
                );
              }}
            >
              <Icon name="more" size={14} />
            </button>
          </div>
          <div className={styles.messageReactionRow}>
            {!!message.reactions?.length && (
              <div
                className={styles.reactionCounts}
                role="group"
                tabIndex={0}
                aria-label="Người đã thả cảm xúc"
                aria-describedby={reactorsId}
              >
                {message.reactions.map((r) => (
                  <span
                    key={r.type}
                    aria-label={`${reactions.find((x) => x[0] === r.type)?.[2]}: ${r.count}`}
                  >
                    <Reaction type={r.type} accountId={accountId} />
                  </span>
                ))}
                <small>{message.reactions.reduce((n, r) => n + r.count, 0)}</small>
                <div className={styles.reactionPeople} role="tooltip" id={reactorsId}>
                  {reactors.length ? (
                    reactors.map((user) => <div key={user.id}>{user.mine ? 'Bạn' : user.name}</div>)
                  ) : (
                    <div>Chưa tải được người thả cảm xúc</div>
                  )}
                </div>
              </div>
            )}
            {!message.archived && (
              <div
                className={styles.reactionPicker}
                data-selected={currentReaction !== null || undefined}
              >
                <button
                  className={styles.reactButton}
                  disabled={busy}
                  aria-label="Thả cảm xúc"
                  title="Thả cảm xúc"
                  onClick={() => void act('react', currentReaction ?? 3)}
                >
                  {currentReaction !== null ? (
                    <Reaction type={currentReaction} accountId={accountId} />
                  ) : (
                    <img
                      alt=""
                      src="https://res-zalo.zadn.vn/upload/media/2019/1/25/iconlike_1548389696575_103596.png"
                    />
                  )}
                </button>
                <div className={styles.reactionPalette} role="group" aria-label="Chọn cảm xúc">
                  {reactions.map(([type, , label]) => (
                    <button
                      key={type}
                      title={label}
                      aria-label={label}
                      disabled={busy}
                      onClick={() => void act('react', type)}
                    >
                      <Reaction type={type} accountId={accountId} />
                    </button>
                  ))}
                  {message.reactions?.some((r) => r.mine) && (
                    <button
                      aria-label="Gỡ cảm xúc"
                      title="Gỡ cảm xúc"
                      disabled={busy}
                      onClick={() => void act('react', -1)}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {notice && (
        <div className={styles.actionNotice} role="status" onClick={() => setNotice('')}>
          {notice}
        </div>
      )}
      {menu &&
        createPortal(
          <div ref={menuRef} className={styles.messageMenu} role="menu" style={menu}>
            {entries.map((e) => (
              <Fragment key={e.label}>
                {e.separator && <div role="separator" className={styles.messageMenuSeparator} />}
                <button
                  role="menuitem"
                  className={e.danger ? styles.dangerAction : undefined}
                  onClick={e.run}
                >
                  <Icon name={e.icon} size={20} />
                  <span>{e.label}</span>
                </button>
              </Fragment>
            ))}
          </div>,
          document.body,
        )}
      {confirm &&
        createPortal(
          <div
            className={styles.actionBackdrop}
            onClick={() => setConfirm(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setConfirm(null);
            }}
          >
            <section
              className={styles.actionConfirm}
              role="dialog"
              aria-modal="true"
              aria-label={confirm === 'delete' ? 'Xóa tin nhắn' : 'Thu hồi tin nhắn'}
              onClick={(e) => e.stopPropagation()}
            >
              <strong>{confirm === 'delete' ? 'Xóa chỉ ở phía tôi' : 'Thu hồi tin nhắn'}</strong>
              <p>
                {confirm === 'delete'
                  ? 'Tin nhắn sẽ bị xóa ở tài khoản của bạn. Người khác vẫn xem được tin nhắn này.'
                  : 'Tin nhắn sẽ được thu hồi với mọi người trong cuộc trò chuyện.'}
              </p>
              <div>
                <button autoFocus onClick={() => setConfirm(null)}>
                  Hủy
                </button>
                <button className={styles.dangerAction} onClick={() => void act(confirm)}>
                  {confirm === 'delete' ? 'Xóa' : 'Thu hồi'}
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
