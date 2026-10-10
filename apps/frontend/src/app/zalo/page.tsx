import { redirect } from 'next/navigation';

export const metadata = { title: 'Zalo | X3 CRM' };

export default function ZaloPage() {
  redirect('/zalo-team');
}
