import type { Metadata } from 'next';
import ContactsLayout from './contacts-layout';
export const metadata: Metadata = { title: 'Danh bạ — Zalo Team' };
export default function Page() {
  return <ContactsLayout />;
}
