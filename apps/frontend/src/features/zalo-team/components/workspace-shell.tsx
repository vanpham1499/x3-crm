'use client';
import { useAccountAccess, useAccountAccessError } from '../use-account-access';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from './icon';
import { AccountSwitcher, type AccountFilterProps } from './account-switcher';
import styles from '../zalo-team.module.css';

export function ZaloTeamShell({
  children,
  label = 'Zalo Team',
  activePage = 'messages',
  unreadCount = 0,
  accountFilter,
}: {
  children: ReactNode;
  label?: string;
  activePage?: 'messages' | 'accounts' | 'contacts' | 'archive' | 'campaigns' | 'work';
  unreadCount?: number;
  accountFilter?: AccountFilterProps;
}) {
  const access = useAccountAccess();
  const accessFailed = useAccountAccessError();
  return (
    <main className={styles.workspace} aria-label={label}>
      <nav className={styles.navigation} aria-label="Điều hướng Zalo">
        <AccountSwitcher filter={accountFilter} />
        <div className={styles.navTop}>
          <Link
            href="/zalo-team"
            className={`${styles.navButton} ${activePage === 'messages' ? styles.navSelected : ''}`}
            aria-label="Tin nhắn"
            aria-current={activePage === 'messages' ? 'page' : undefined}
            title="Tin nhắn"
          >
            <Icon name="message" size={28} />
            {unreadCount > 0 && (
              <span className={styles.navBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </Link>
          <Link
            href="/zalo-team/contacts"
            className={`${styles.navButton} ${activePage === 'contacts' ? styles.navSelected : ''}`}
            aria-current={activePage === 'contacts' ? 'page' : undefined}
            aria-label="Danh bạ"
            title="Danh bạ"
          >
            <Icon name="contact" size={28} />
          </Link>
          <button
            className={styles.navButton}
            aria-label="Quản lý thẻ chung"
            title="Quản lý thẻ chung"
            onClick={() => window.dispatchEvent(new CustomEvent('zalo-team-manage-tags'))}
          >
            <Icon name="tag" size={26} />
          </button>
          <Link
            href="/zalo-team/campaigns"
            className={`${styles.navButton} ${activePage === 'campaigns' ? styles.navSelected : ''}`}
            aria-label="Gửi hàng loạt"
            title="Gửi hàng loạt"
            aria-current={activePage === 'campaigns' ? 'page' : undefined}
          >
            <Icon name="share" size={26} />
          </Link>
          <Link
            href="/zalo-team/accounts"
            className={`${styles.navButton} ${activePage === 'accounts' ? styles.navSelected : ''}`}
            aria-label="Tài khoản"
            title="Tài khoản"
            aria-current={activePage === 'accounts' ? 'page' : undefined}
          >
            <Icon name="member" size={28} />
          </Link>
          <Link
            href="/zalo-team/work"
            className={`${styles.navButton} ${activePage === 'work' ? styles.navSelected : ''}`}
            aria-label="Công việc"
            title="Công việc"
            aria-current={activePage === 'work' ? 'page' : undefined}
          >
            <Icon name="documents" size={26} />
          </Link>
          <Link
            href="/zalo-team/archive"
            className={`${styles.navButton} ${activePage === 'archive' ? styles.navSelected : ''}`}
            aria-label="Đồng bộ và sao lưu"
            title="Đồng bộ và sao lưu"
            aria-current={activePage === 'archive' ? 'page' : undefined}
          >
            <Icon name="cloud" size={28} />
          </Link>
        </div>
      </nav>

      {access ? (
        children
      ) : (
        <div role="status" style={{ padding: 24 }}>
          {accessFailed ? (
            <>
              Chưa xác nhận được quyền truy cập. Đang thử lại… <a href="/login">Đăng nhập lại</a>
            </>
          ) : (
            'Đang xác nhận quyền truy cập Zalo…'
          )}
        </div>
      )}
    </main>
  );
}
