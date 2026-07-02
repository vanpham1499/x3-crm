import { ErrorState } from '@/components/feedback/error-state';

export default function NotFound() {
  return (
    <ErrorState
      code="404"
      title="Không tìm thấy trang"
      description="Đường dẫn này không tồn tại hoặc đã được di chuyển. Bạn có thể quay lại Dashboard để tiếp tục làm việc."
      primaryHref="/dashboard"
      primaryLabel="Về Dashboard"
      secondaryHref="/login"
      secondaryLabel="Đăng nhập"
    />
  );
}
