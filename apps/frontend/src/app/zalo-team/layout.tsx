import type { ReactNode } from 'react';
import { SharedTagsProvider } from '@/features/zalo-team/components/shared-tags';
import { TeamDataProvider } from '@/features/zalo-team/components/data-provider';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <TeamDataProvider>
      <SharedTagsProvider>{children}</SharedTagsProvider>
    </TeamDataProvider>
  );
}
