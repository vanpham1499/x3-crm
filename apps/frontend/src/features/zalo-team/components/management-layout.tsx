import type { ReactNode } from 'react';
import layout from '../management-layout.module.css';
import styles from '../zalo-team.module.css';

type LayoutClasses = Pick<typeof layout, 'layout' | 'sidebar' | 'sidebarTitle'>;

export function TeamManagementLayout({
  title,
  navigationLabel,
  navigation,
  children,
  classNames = {
    layout: layout.layout,
    sidebar: layout.sidebar,
    sidebarTitle: layout.sidebarTitle,
  },
}: {
  title: string;
  navigationLabel: string;
  navigation: ReactNode;
  children: ReactNode;
  classNames?: LayoutClasses;
}) {
  return (
    <div className={classNames.layout}>
      <nav
        className={`${styles.inbox} ${styles.directorySidebar} ${classNames.sidebar}`}
        aria-label={navigationLabel}
      >
        <div className={classNames.sidebarTitle}>{title}</div>
        {navigation}
      </nav>
      {children}
    </div>
  );
}
