'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/feedback/error-state';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      compact
      code="500"
      title="Màn hình bị lỗi"
      description="Dữ liệu hoặc thao tác ở màn hình này chưa xử lý được. Hãy thử lại, phần khung CRM vẫn được giữ để bạn không bị văng khỏi hệ thống."
      secondaryHref="/dashboard"
      secondaryLabel="Về Dashboard"
      onRetry={reset}
    />
  );
}
