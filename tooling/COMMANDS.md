# Các lệnh có thể chạy

File tra cứu nhanh các lệnh phát triển, kiểm tra và triển khai X3 CRM.
Thông tin kiến trúc, nghiệp vụ và giải thích chi tiết vẫn lấy từ `../README.md`.

> Chạy lệnh local bằng Windows PowerShell tại thư mục gốc repository,
> trừ khi từng phần ghi rõ phải chạy trên VPS.

### Nhắc công việc Zalo Team — đợt D

- `npm run dev:zalo-work`: chạy riêng worker nhắc hạn nội bộ CRM mỗi phút; không chạy archive/campaign và không gửi tin Zalo.
- `npm run dev` hoặc `npm run dev:scheduler`: đã đăng ký lịch `zalo-team:work-reminders`; không cần chạy thêm worker riêng.
- Backend CLI `php artisan zalo-team:work-reminders`: chạy một lượt; `--watch`: chạy liên tục. Các lệnh cần PHP có driver database tương ứng.
- Hồi quy D: `php -d extension=pdo_sqlite -d extension=sqlite3 tooling/tests/zalo-team-collaboration.php` (102 kiểm tra D1–D4, database trong bộ nhớ, không dùng VPS).
- Tối ưu D: `php -d extension=pdo_sqlite -d extension=sqlite3 tooling/tests/zalo-team-work-optimization.php` (thêm 15 kiểm tra nhắc/bàn giao/lịch lặp/quyền).
- Ngân sách query D: `php -d extension=pdo_sqlite -d extension=sqlite3 tooling/tests/zalo-team-work-performance.php --check` (fixture SQLite, không phải benchmark HTTP/VPS).
- Migration `2026_10_09_000240_create_zalo_crm_collaboration.php` chạy tại **CRM**, không chạy trên runtime `zalo`. Xem README.ZALO-TEAM.md trước khi deploy.

<a id="vai-trò-các-thư-mục--rà-soát-07102026"></a>

## Vai trò các thư mục — cập nhật sau đợt A 09/10/2026

Mã Zalo đang dùng thuộc `apps/backend/integrations/zalo/`. `tooling` giữ công cụ phát triển/triển khai và kiểm tra hồi quy. Đã dọn bộ Wine/bridge cũ và các script thử nghiệm hết vai trò; các lệnh npm và tác vụ Windows vẫn dùng công cụ vận hành ở đây.

| Thư mục | Vai trò hiện tại | Khi dọn |
| --- | --- | --- |
| `development/` | Lệnh chạy frontend/backend, queue, scheduler, database và tunnel | Giữ; `package.json` gọi trực tiếp |
| `deployment/production/` | Docker/Nginx và cấu hình deploy CRM | Giữ source/config |
| `zalo-team/web/` | Dockerfile, Compose và chuẩn bị secret | Source nằm ở `apps/backend/integrations/zalo/web/` |
| `zalo-team/call/` | Khởi động tương thích và kiểm tra âm thanh/WAN | Gateway + unit test nằm ở backend; Dockerfile hiện hành ở `service/` |
| `apps/backend/integrations/zalo/file-import/` | Bộ đọc file xuất, codec và launcher do PHP gọi | Source trong backend; dependency riêng theo package-lock |
| `zalo-team/service/` | Docker, tunnel và vận hành VPS Zalo | Giữ; tác vụ Windows tham chiếu `tunnel.ps1` |
| `apps/backend/integrations/zalo/metrics/` | Collector tài nguyên host và test offline | Unit cài đặt ở tooling; không đổi đường dẫn snapshot dữ liệu |
| `zalo-bridge/.local/`, `zalo-runtime/.local/` | Trạng thái/bằng chứng riêng tư cũ | Source/test cũ đã gỡ; không triển khai các thư mục này |
| `archive/` | Kho lịch sử có cả tệp đính kèm | Không phải cache/source đang chạy; giữ dữ liệu |
| `tests/`, `*.test.*` | Kiểm thử hồi quy/chẩn đoán | `npm run test:zalo`; không COPY test vào Docker |
| `binaries/` | Chương trình hỗ trợ dev, ví dụ ngrok | Không commit binary; lệnh dev có thể cần |
| `backups/`, `.work/server/backups/` | Bản sao lưu dữ liệu/image cũ | Không xóa như cache thông thường |
| `.work/`, `.local/` | File sinh ra, bằng chứng thử nghiệm và cả khóa/token | Chỉ dọn theo danh sách đã kiểm tra; không xóa toàn bộ |

Mốc dọn local đầu tiên 07/10: xóa 10 gói transfer/image export đã dùng xong, giải phóng 784,54 MiB. Manifest nằm ở `.local/project-cleanup-20261007.json`. `.gitignore` đã bỏ quy tắc chặn toàn bộ `tooling/`; source mới hiện untracked để review/commit, secrets và dữ liệu sinh ra vẫn bị loại trừ.

Quyết định người dùng sau lượt dọn: mã sản phẩm thuộc backend/frontend, không thêm thư mục `services/` ngoài apps. Đã di chuyển source và dependencies local, cập nhật import/PHP/npm/Docker build context. Giữ nguyên đường dẫn Scheduled Task, secret và profile. Đây là thay đổi source local, chưa deploy/restart VPS; container đang chạy vẫn dùng image đã triển khai trước đó.

```text
apps/backend/app/                   Laravel API, nghiệp vụ, đồng bộ và backup
apps/backend/integrations/zalo/     web, call, file-import, pc, shared, metrics
apps/frontend/src/                 giao diện và Next.js API trung gian
tooling/                           dev/deploy, cấu hình Docker, chẩn đoán
```

Cài dependencies cho worker khi cần chạy/build local (từ root):

```powershell
npm --prefix apps/backend/integrations/zalo/web ci
npm --prefix apps/backend/integrations/zalo/call ci
npm --prefix apps/backend/integrations/zalo/file-import ci
node --test tooling/tests/zalo-source-layout.test.cjs
npm run test:zalo
python -B apps/backend/integrations/zalo/metrics/server-metrics-test.py
```

File import dùng `node:sqlite`, cần Node hỗ trợ API này (máy dev hiện dùng Node 24); không chạy worker nhập nguồn thật chỉ để kiểm tra cài đặt. Docker build từ root repo bằng Compose trong tooling, chỉ COPY source backend vào image. Test unit worker nằm cạnh source; test liên kết frontend/backend và công cụ chẩn đoán vẫn ở tooling.

`npm run test:zalo` gom bộ kiểm tra tự động dùng fixture (Web, gọi, nhập file, PC/shared, UI/API và cấu trúc). Xem danh sách bằng `npm run test:zalo -- --list`. Các bài PHP dùng database thử nghiệm và kiểm tra browser/WAN cần môi trường riêng, không tự chạy trong lệnh này. Không dùng tài khoản thật để chạy lại script gửi tin thử nghiệm.

Lượt tổng dọn 07/10: loại 178 file khỏi cây cũ, giữ lại 3 test helper tại backend. Source gỡ có bản phục hồi đã đối chiếu SHA-256 trong `.local/cleanup-recovery/`; không nằm trong Git/gói deploy. Không xóa kho dữ liệu, profile, khóa hay backup. Nguồn runtime hiện còn các nhánh tương thích PC/Windows được PHP/API gọi; không xóa chúng chỉ vì tab PC cũ đã ẩn.

Đợt A 09/10: gỡ 6 module UI không dùng và CSS riêng; gỡ `dev:zalo-pc` cùng launcher/probe của worker đã nghỉ. Artisan `zalo-team:pc-worker` vẫn giữ thông báo nghỉ cho caller cũ. `npm run zalo:pc -- list|export` là công cụ quản trị nguồn PC cũ, không dùng để khởi động ứng dụng; call Windows vẫn được cấu hình dev tham chiếu nên giữ. Nhập dữ liệu hiện hành qua UI Nhập từ file. Collector metrics chuyển về backend; chỉ deploy unit mới sau khi có file ở đường dẫn mới. Không triển khai VPS trong đợt này.

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

Chạy PostgreSQL local trước, sau đó chạy frontend, backend, Reverb, queue worker và scheduler:

```powershell
npm run dev:db
npm run dev
```

Chạy riêng từng phần:

```powershell
npm run dev:frontend
npm run dev:backend
npm run dev:realtime
npm run dev:reverb
npm run dev:queue
npm run dev:scheduler
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
- Reverb WebSocket: `ws://localhost:8080`
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
php artisan notifications:dispatch-reminders
php artisan queue:work database --queue=realtime,default --sleep=1 --tries=3 --timeout=60
php artisan reverb:start --host=0.0.0.0 --port=8080
php artisan schedule:list
Set-Location ../..
```

## 5. Kết nối database VPS từ máy local

Thay toàn bộ database và ảnh upload local bằng dữ liệu production hiện tại:

```powershell
# CẢNH BÁO: xóa database và ảnh upload local sau khi bản tải về đã được kiểm tra.
npm run sync:production-data
```

Lệnh hỏi mật khẩu SSH ở chế độ ẩn, stream database/uploads trực tiếp về máy nên không tạo file backup
trên VPS. Database production được restore thử vào database tạm trước khi thay database local; file
trung gian được dọn sau khi hoàn tất. Những lần chạy backend sau đó chỉ tự migrate và bỏ qua seeder
mẫu khi còn `tooling/backups/last-production-sync.json`.

Nếu chủ động muốn chạy seeder trên snapshot này:

```powershell
$env:FORCE_LOCAL_SEED = '1'
npm run dev:backend
Remove-Item Env:FORCE_LOCAL_SEED
```

Chỉ kết nối trực tiếp database VPS mà không sao chép dữ liệu:

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
`npm run deploy:production`
```

Deploy bằng SSH key và tham số cụ thể:

```powershell
.\tooling\deployment\deploy-production.ps1 `
  -Server 45.252.251.120 `
  -SshUser root `
  -SshKey C:\path\to\id_ed25519 `
  -PublicUrl https://crm.x3sales.com
```

Script sẽ build image, tự khởi tạo `REVERB_APP_SECRET` trên VPS nếu còn thiếu, dọn deployment artifact cũ, upload cấu hình, chạy migration,
khởi động lại backend/scheduler/reverb/queue-worker/frontend/nginx và kiểm tra HTTP.

## 8. Vận hành production trên VPS

Các lệnh trong phần này chạy sau khi đã SSH vào VPS:

```bash
cd /opt/x3crm
docker compose ps
docker compose logs -f --tail=200
docker compose logs -f --tail=200 backend
docker compose logs -f --tail=200 scheduler
docker compose logs -f --tail=200 reverb
docker compose logs -f --tail=200 queue-worker
docker compose up -d
docker compose restart backend
docker compose restart scheduler
docker compose restart reverb queue-worker
docker compose exec -T backend php artisan migrate --force
docker compose exec -T backend php artisan notifications:dispatch-reminders
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
docker compose up -d --force-recreate backend scheduler reverb queue-worker frontend nginx
docker compose ps
docker compose logs --since=5m --tail=200
```

> Không chạy `docker compose down -v` trên production. Lệnh này có thể xóa
> database volume. Restore và reset dữ liệu là thao tác phá hủy; xem quy trình,
> điều kiện backup và cảnh báo đầy đủ trong `../README.md` trước khi chạy.

## Zalo Team hiện tại

Điểm sử dụng: `http://localhost:3000/zalo-team`; bookmark `/zalo` chuyển về Team.
Luồng Web, gọi thoại và cách chạy: [README.ZALO-TEAM.md](../README.ZALO-TEAM.md).

Kho lịch sử nằm trên VPS Zalo. Worker sync/backup chạy bằng Compose tại `tooling/zalo-team/service/`;
không chạy thêm worker kho local khi cấu hình đã trỏ VPS. `npm run dev:zalo-archive` chỉ dùng cho
môi trường kho local độc lập. Cấu hình hiện hành xem `zalo-team/service/README.md`.

Nhập lịch sử từ file xuất Zalo trên Windows local (07/10): cài runtime một lần bằng
`npm ci --prefix apps/backend/integrations/zalo/file-import` (Node 24+), rồi mở
**Đồng bộ & sao lưu → Đồng bộ → Nhập từ file**. Chọn tài khoản, bấm **Chọn file từ máy tính**,
chọn file .zl.zip trong hộp thoại Windows rồi bấm **Đọc file**. Bộ nhập hiện chạy qua localhost
trên Windows, không yêu cầu tải cả file lên server. Chưa hỗ trợ nhập qua link Drive.
File mã hóa cần mở khóa bằng đúng Zalo PC một lần; sau đó chọn hội thoại và Nhập.
Dừng/Tiếp tục giữ các batch đã commit. Không dùng worker nhập PC cũ.
Cấu hình `ZALO_TEAM_PC_INSTALL` chỉ cần cho bước mở khóa. Mặc định không giới hạn tổng lượt nhập;
có thể tự chọn giới hạn trên giao diện. Kết quả ghi rõ tệp thiếu/vượt giới hạn. Không xóa file xuất gốc.

```powershell
# Kiểm tra bản sao lưu, chưa khôi phục (chạy tại apps/backend).
php -d extension=pdo_pgsql artisan zalo-team:archive-restore <crm-user-id> <backup-uuid>
# Khi cần khôi phục phần dữ liệu Team bị thiếu, thêm --apply vào lệnh trên.
```

Phải giữ cả thư mục sao lưu của chủ sở hữu, gồm các ZIP snapshot và `blobs/`, cùng khóa
mã hóa ở nơi riêng. Chỉ sao chép một ZIP snapshot không đủ để khôi phục tệp đính kèm.

## Hệ thống Zalo cũ

Bộ Wine/bridge đã ngừng dùng và được gỡ khỏi source ngày 07/10. Không chạy lại các lệnh
runtime/viewer cũ. Kho `tooling/archive/zalo-legacy-2026-10-03/` còn chứa tệp đính kèm,
không được đưa vào image hoặc xóa như thư mục build. Luồng hiện hành xem README Zalo Team.
