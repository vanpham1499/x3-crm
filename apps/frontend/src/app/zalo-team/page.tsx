import type { Metadata } from 'next';
import MessagesLayout from './messages-layout';

export const metadata: Metadata = {
  title: 'Zalo Team',
};

export default function ZaloTeamPage() {
  return <MessagesLayout />;
}
