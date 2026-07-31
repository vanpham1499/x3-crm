# Các lệnh có thể chạy

File tra cứu nhanh các lệnh phát triển, kiểm tra và triển khai X3 CRM.
Thông tin kiến trúc, nghiệp vụ và giải thích chi tiết vẫn lấy từ `../README.md`.

> Chạy lệnh local bằng Windows PowerShell tại thư mục gốc repository,
> trừ khi từng phần ghi rõ phải chạy trên VPS.

## 1. Cài đặt lần đầu

```powershell
npm install
Copy-Item apps/backend/.env.example apps/backend/.env

Set-Location apps/backend
composer install
php artisan key:generate
Set-Location ../..
```

Yêu cầu: Node.js 20+, npm và Docker Desktop. Backend chạy ngoài Docker cần
PHP 8.2+, Composer và extension `pdo_pgsql`.

## 2. Chạy môi trường phát triển

Chạy PostgreSQL local trước, sau đó chạy frontend và backend:

```powershell
npm run dev:db
npm run dev
```

Chạy riêng từng phần:

```powershell
npm run dev:frontend
npm run dev:backend
```

Chạy backend với domain ngrok dev cố định:

```powershell
npm run dev:backend:x3sales
```

Chạy backend nhưng không mở ngrok:

```powershell
$env:START_NGROK = '0'
npm run dev:backend
Remove-Item Env:START_NGROK
```

Kiểm tra hoặc tải ngrok local:

```powershell
.\tooling\development\ensure-ngrok.cmd
```

Địa chỉ thường dùng:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/documentation`
- PostgreSQL local: `127.0.0.1:5433`
- Ngrok inspector: `http://127.0.0.1:4040`

## 3. Chạy toàn bộ bằng Docker

`apps/backend/.env` phải có `APP_KEY`.

```powershell
npm run dev:docker
docker compose -f tooling/development/compose.full.yml ps
docker compose -f tooling/development/compose.full.yml logs -f --tail=200
```

Dừng các container local, không xóa volume database:

```powershell
docker compose -f tooling/development/compose.full.yml down
docker compose -f tooling/development/compose.local.yml down
```

Kiểm tra cấu hình Compose:

```powershell
docker compose -f tooling/development/compose.local.yml config
docker compose -f tooling/development/compose.full.yml config
```

> Không thêm `-v` vào lệnh `down` nếu muốn giữ dữ liệu database.

## 4. Database local

```powershell
npm run db:migrate
npm run db:seed
```

Chạy migrate và seed bằng script hỗ trợ:

```powershell
.\tooling\development\db-migrate-seed.cmd
```

Xóa và tạo lại toàn bộ dữ liệu local:

```powershell
# CẢNH BÁO: lệnh này xóa dữ liệu database local hiện tại.
npm run db:fresh
```

Các lệnh Laravel hữu ích:

```powershell
Set-Location apps/backend
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan route:list
php artisan migrate:status
php artisan l5-swagger:generate
Set-Location ../..
```

## 5. Kết nối database VPS từ máy local

Mở tunnel và giữ cửa sổ PowerShell này hoạt động:

```powershell
npm run db:tunnel
```

Trong `apps/backend/.env`, đặt:

```dotenv
DB_PROFILE=server
```

Sau đó mở cửa sổ PowerShell khác:

```powershell
Set-Location apps/backend
php artisan config:clear
php artisan serve --host=0.0.0.0 --port=4000
Set-Location ../..
```

Database server được chuyển tiếp qua `127.0.0.1:5434`.

## 6. Kiểm tra code

Kiểm tra tối thiểu trước khi bàn giao:

```powershell
Set-Location apps/frontend
npm exec tsc -- --noEmit
npm run format:check

Set-Location ../backend
php artisan route:list
php artisan migrate:status
Set-Location ../..
```

Chỉ build toàn bộ khi cần xác nhận release:

```powershell
npm run build:frontend
npm run build:backend
```

## 7. Deploy production từ máy phát triển

Lệnh chuẩn:

```powershell
npm run deploy:production
```

Deploy bằng SSH key và tham số cụ thể:

```powershell
.\tooling\deployment\deploy-production.ps1 `
  -Server 45.252.251.120 `
  -SshUser root `
  -SshKey C:\path\to\id_ed25519 `
  -PublicUrl https://crm.x3sales.com
```

Script sẽ build image, backup database, upload cấu hình, chạy migration,
khởi động lại dịch vụ và kiểm tra HTTP.

## 8. Vận hành production trên VPS

Các lệnh trong phần này chạy sau khi đã SSH vào VPS:

```bash
cd /opt/x3crm
docker compose ps
docker compose logs -f --tail=200
docker compose logs -f --tail=200 backend
docker compose up -d
docker compose restart backend
docker compose exec -T backend php artisan migrate --force
docker stats --no-stream
df -h
free -h
```

Tạo lại admin production sau deploy, không chạy seeder mẫu:

```bash
cd /opt/x3crm
read -rsp 'Mật khẩu admin mới: ' X3_ADMIN_PASSWORD
echo
export X3_ADMIN_PASSWORD
docker compose exec -T -e X3_ADMIN_PASSWORD="$X3_ADMIN_PASSWORD" \
  backend php artisan admin:ensure \
  --email=admin@x3crm.com --code=NV000 --name="Admin X3"
unset X3_ADMIN_PASSWORD
```

Reset dữ liệu nghiệp vụ sau khi đã backup và kiểm tra backup:

```bash
cd /opt/x3crm
docker compose exec -T db psql -U x3crm -d x3crm \
  < reset-keep-accounts-services.sql
```

Script giữ account/phân quyền/phòng ban và toàn bộ dữ liệu các page `/settings`
(`services`, `service_packages`, `options`); các bảng public khác bị reset.
Lệnh này chỉ reset database, không xóa volume `x3crm_uploads_data`.

Kiểm tra sau deploy:

```bash
cd /opt/x3crm
docker compose ps
docker compose logs --since=10m --tail=200
curl -I https://crm.x3sales.com/
curl -H 'Accept: application/json' -i https://crm.x3sales.com/api/
```

Backup database:

```bash
cd /opt/x3crm
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
docker compose exec -T db pg_dump \
  -U x3crm -d x3crm -Fc --no-owner --no-privileges \
  > "backups/x3crm-db-${ts}.dump"
chmod 600 "backups/x3crm-db-${ts}.dump"
docker compose exec -T db pg_restore -l \
  < "backups/x3crm-db-${ts}.dump" > /dev/null
sha256sum "backups/x3crm-db-${ts}.dump"
```

Backup uploads:

```bash
cd /opt/x3crm
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
docker run --rm \
  -v x3crm_uploads_data:/source:ro \
  -v /opt/x3crm/backups:/backup alpine:3.22 \
  sh -c "tar -czf /backup/x3crm-uploads-${ts}.tar.gz -C /source ."
chmod 600 "backups/x3crm-uploads-${ts}.tar.gz"
sha256sum "backups/x3crm-uploads-${ts}.tar.gz"
```

Rollback image:

```bash
cd /opt/x3crm
docker image ls --filter 'reference=x3crm-*'

# Thay <release> bằng release cần rollback
docker tag x3crm-backend:rollback-<release> x3crm-backend:deploy
docker tag x3crm-frontend:rollback-<release> x3crm-frontend:deploy
docker compose up -d --force-recreate backend frontend nginx
docker compose ps
docker compose logs --since=5m --tail=200
```

> Không chạy `docker compose down -v` trên production. Lệnh này có thể xóa
> database volume. Restore và reset dữ liệu là thao tác phá hủy; xem quy trình,
> điều kiện backup và cảnh báo đầy đủ trong `../README.md` trước khi chạy.
