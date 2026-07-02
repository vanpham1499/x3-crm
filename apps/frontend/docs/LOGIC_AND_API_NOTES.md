# Logic And API Notes

File này dùng để ghi chú dần mọi thứ liên quan đến logic nghiệp vụ và API của dự án.

Nguyên tắc cập nhật:

- Chỉ note khi người dùng hỏi hoặc yêu cầu làm rõ một phần cụ thể.
- Không tự suy đoán hoặc ghi trước các logic/API chưa được xác nhận.
- Khi note API, ưu tiên ghi rõ route, method, payload, response, nơi gọi trong frontend, và trạng thái tích hợp.
- Khi note logic, ưu tiên ghi rõ màn hình/tính năng, luồng xử lý, dữ liệu đầu vào/đầu ra, và các ràng buộc nghiệp vụ.

## API

### Auth Login

- Route backend: `POST /api/auth/login`.
- Route gọi từ frontend: `POST /auth/login` qua `src/services/api/client.ts`.
- Base URL: `NEXT_PUBLIC_API_URL`, fallback `http://127.0.0.1:4000/api`.
- Payload:
  - `email`: email đăng nhập.
  - `password`: mật khẩu.
- Response frontend đang hỗ trợ:
  - Token: `access_token` hoặc `token`, có thể nằm ở root response hoặc trong `data`.
  - User: `user`, có thể nằm ở root response hoặc trong `data`.
- Nơi gọi: `src/app/(auth)/login/page.tsx`.
- Trạng thái tích hợp: đã nối với form login, lưu token vào localStorage key `access_token`, lưu user nếu backend trả về.
- Header xác thực: các request sau login tự gắn `Authorization: Bearer <token>` trong API client.
- Xử lý lỗi auth: response `401` sẽ xóa `access_token` và `user`, sau đó redirect về `/login`.

## Logic

### Login Và Auth Guard

- Màn `/login` validate `email` và `password` bằng React Hook Form + Zod.
- Submit login gọi `POST /auth/login` với `{ email, password }`.
- Nếu response không có token, frontend xem như login thất bại.
- Nếu login thành công, `auth-store` lưu token và user optional, sau đó redirect bằng `router.replace('/users')`.
- Khi refresh trang, `src/app/providers.tsx` gọi `auth-store.init()` để khôi phục auth từ localStorage.
- Các route trong `src/app/(app)` yêu cầu token. Nếu auth đã init xong mà không có token, layout redirect về `/login`.
- Màn `/login` không render form cho tới khi auth init xong. Nếu người dùng đã có token và mở `/login`, màn login hiển thị `AppSplashScreen` trong lúc redirect về `/users` để tránh nháy form login.
- Các giai đoạn auth init, auth redirect, và Next route loading dùng `src/components/shell/app-splash-screen.tsx` làm loading toàn trang: nền trắng, logo X3Sales ở giữa, và thanh progress shimmer mảnh bên dưới.
- Sau khi đã vào authenticated app shell, route/data loading dùng `src/components/shell/content-loading.tsx` để giữ nguyên header/sidebar và chỉ loading vùng main content bằng thanh progress mảnh ở giữa.
