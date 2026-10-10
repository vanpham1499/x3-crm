import Link from 'next/link';
import type { ConversationListResponse } from '../types';
import { inboxNotice, type InboxNoticeInput } from '../inbox-notice';
import styles from '../zalo-team.module.css';

export function InboxStatus({
  retry,
  retrying,
  accounts = [],
  retryAccount,
  ...input
}: InboxNoticeInput & { retry: () => void; retrying: boolean; accounts?: ConversationListResponse['accounts']; retryAccount?: (id:number) => void }) {
  const notice = inboxNotice(input);
  if (!notice) return null;
  return (
    <aside
      className={styles.inboxStatus}
      aria-label="Trạng thái danh sách trò chuyện"
      role="status"
    >
      <strong>{notice.title}</strong>
      <p>{notice.description}</p>
      <div className={styles.inboxStatusActions}>
        <button onClick={retry} disabled={retrying}>
          {retrying ? 'Đang thử lại…' : 'Thử lại'}
        </button>
        {notice.showAccounts && <Link href="/zalo-team/accounts">Kiểm tra tài khoản</Link>}
        <details>
          <summary>Chi tiết</summary>
          <ul>
            {notice.details.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          {accounts.map(account => {
            const r = account.readiness;
            const stages: Record<string, string> = {
              frame_loading: 'Trang Zalo chưa sẵn sàng', modules_loading: 'Đang chờ bộ đọc Zalo',
              privacy_loading: 'Đang chờ thông tin hội thoại ẩn', database_loading: 'Zalo chưa tải xong dữ liệu',
              preview_loading: 'Zalo chưa khởi tạo xong danh sách', read_timeout: 'Quá thời gian đọc dữ liệu',
              list_read: 'Chưa đọc được danh sách',
            };
            const time = (value: string) => new Date(value).toLocaleTimeString('vi-VN');
            return <div key={account.id} className={styles.inboxAccountState}>
              <strong>{account.name}</strong>
              <p>{stages[r?.stage || 'list_read'] || 'Chưa đọc được danh sách'}.
                {r?.nextRetryAt ? ` Thử lại lúc ${time(r.nextRetryAt)}.` : ' Cần kiểm tra tài khoản.'}
                {r?.lastSuccessAt && ` Đọc thành công gần nhất: ${time(r.lastSuccessAt)}.`}
              </p>
              <button disabled={retrying} onClick={() => retryAccount?.(account.id)}>Thử lại {account.name}</button>
              {r?.requestId && <small className={styles.inboxTrace}>Mã kiểm tra: {r.requestId.slice(0, 8)}</small>}
            </div>;
          })}
        </details>
      </div>
    </aside>
  );
}
