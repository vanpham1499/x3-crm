'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/feedback/error-state';

export default function RootError({
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
      code="500"
      title="Có lỗi xảy ra"
      description="Hệ thống đang gặp sự cố khi xử lý màn hình này. Bạn có thể thử tải lại, hoặc quay lại trang đăng nhập nếu phiên làm việc đã hết hạn."
      secondaryHref="/login"
      secondaryLabel="Đăng nhập"
      onRetry={reset}
    />
  );
}
