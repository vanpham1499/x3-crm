'use client';
import { useEffect, useState } from 'react';
import type { Conversation } from '../types';
import { requestFriend, type FriendPerson } from '../friend-actions';
import { subscribeChanges, affects } from '../live';
import { InboxCreateDialog } from './inbox-create-dialog';
import { Icon } from './icon';
import { ConversationListMenu } from './conversation-list-menu';
import styles from '../zalo-team.module.css';

export function FriendshipBanner({ conversation }: { conversation: Conversation }) {
  const [person, setPerson] = useState<FriendPerson | null>(null);
  const [open, setOpen] = useState(false),
    [retry, setRetry] = useState(0);
  const [menu, setMenu] = useState<HTMLButtonElement | null>(null);
  const { accountId, conversationId } = conversation;
  useEffect(() => {
    if (!accountId || !conversationId || conversation.group || conversation.name === 'My Documents')
      return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let loading = false,
      lastLoaded = 0;
    const load = () => {
      if (loading || abort.signal.aborted) return;
      loading = true;
      lastLoaded = Date.now();
      return requestFriend(accountId, { kind: 'status', userId: conversationId }, abort.signal)
        .then((r) => {
          if (!abort.signal.aborted) setPerson(r.person || null);
        })
        .catch(() => {})
        .finally(() => {
          loading = false;
        });
    };
    void load();
    const off = subscribeChanges((e) => {
      if (affects(e, 'directory', accountId, conversationId)) {
        clearTimeout(timer);
        timer = setTimeout(() => void load(), Math.max(1500, 20000 - (Date.now() - lastLoaded)));
      }
    });
    return () => {
      off();
      clearTimeout(timer);
      abort.abort();
    };
  }, [accountId, conversationId, conversation.group, retry]);
  if (!person || person.self || person.isFriend || !accountId) return null;
  return (
    <>
      <div className={styles.friendshipBanner}>
        <Icon name="addContact" size={20} />
        <span>
          {person.requested
            ? 'Đã gửi lời mời kết bạn'
            : person.incoming
              ? 'Người này đã gửi lời mời kết bạn cho bạn'
              : 'Gửi yêu cầu kết bạn tới người này'}
        </span>
        {!person.requested && !person.incoming && (
          <button onClick={() => setOpen(true)}>Gửi kết bạn</button>
        )}
        <button
          className={styles.friendshipMore}
          aria-label={`Thao tác người lạ bằng ${conversation.accountName}`}
          onClick={(e) => setMenu(e.currentTarget)}
        >
          <Icon name="more" size={16} />
        </button>
      </div>
      {open && (
        <InboxCreateDialog
          kind="friend"
          accounts={[
            {
              id: accountId,
              name: conversation.accountName || '',
              state: 'connected',
              count: 0,
              error: null,
            },
          ]}
          initialAccountId={accountId}
          target={person}
          onSent={() => setRetry((n) => n + 1)}
          onClose={() => {
            setOpen(false);
            setRetry((n) => n + 1);
          }}
        />
      )}
      {menu && (
        <ConversationListMenu
          conversation={conversation}
          anchor={menu}
          onClose={() => setMenu(null)}
          onChanged={() => setRetry((n) => n + 1)}
        />
      )}
    </>
  );
}
