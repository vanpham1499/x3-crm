import type { Metadata } from 'next';
import { AccountsPage } from '@/features/zalo-team/components/accounts-page';

export const metadata: Metadata = { title: 'Liên kết tài khoản | Zalo Team' };

export default function Page() {
  return <AccountsPage />;
}
