# Chuyển database local/server

Backend hỗ trợ chọn database bằng một biến trong `apps/backend/.env`:

```dotenv
DB_PROFILE=local
```

## Dùng database Docker local

1. Đặt `DB_PROFILE=local`.
2. Khởi động PostgreSQL:

   ```powershell
   docker compose -f compose.local.yml up -d postgres
   ```

3. Xóa cache cấu hình và chạy backend:

   ```powershell
   php artisan config:clear
   php artisan serve --host=0.0.0.0 --port=4000
   ```

Database local sử dụng `127.0.0.1:5433` và các biến `DB_LOCAL_*`.

## Dùng database trên server

1. Chạy `scripts\db-server-tunnel.cmd`, nhập mật khẩu SSH và giữ cửa sổ đó mở.
2. Đặt `DB_PROFILE=server`.
3. Chạy lại:

   ```powershell
   php artisan config:clear
   php artisan serve --host=0.0.0.0 --port=4000
   ```

Database server được truy cập qua SSH tunnel tại `127.0.0.1:5434` và các biến
`DB_SERVER_*`. PostgreSQL trên VPS chỉ lắng nghe ở loopback, không mở công khai
ra Internet.

## Lưu ý

- Luôn chạy `php artisan config:clear` và khởi động lại backend sau khi đổi profile.
- Ưu tiên `local` cho phát triển thường ngày để tránh sửa nhầm dữ liệu server.
- `scripts\dev-backend.cmd` không tự chạy migration/seed khi profile là `server`.
  Migration trên server vẫn được thực hiện trong quy trình deploy production.
- Không commit file `.env` hoặc mật khẩu database.
- `DB_PROFILE=default` giữ cơ chế cũ dùng trực tiếp các biến `DB_HOST`,
  `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` và phù hợp cho VPS.

## Deploy production

Từ thư mục `apps/backend`, chạy một lệnh:

```powershell
.\scripts\deploy-production.cmd
```

Script tự động build backend/frontend, backup database VPS, tải image và cấu hình
lên server, chạy migration, khởi động lại container và kiểm tra HTTP. Database và
volume uploads hiện tại không bị thay thế.
