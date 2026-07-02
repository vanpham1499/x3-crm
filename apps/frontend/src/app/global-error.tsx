'use client';

import '@fontsource-variable/public-sans';
import '@/styles/globals.css';
import { ErrorState } from '@/components/feedback/error-state';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <html lang="vi">
      <body>
        <ErrorState
          code="500"
          title="Hệ thống bị gián đoạn"
          description="Ứng dụng gặp lỗi nghiêm trọng khi khởi tạo. Hãy thử tải lại để khôi phục phiên làm việc."
          secondaryHref="/login"
          secondaryLabel="Đăng nhập"
          onRetry={reset}
        />
      </body>
    </html>
  );
}
