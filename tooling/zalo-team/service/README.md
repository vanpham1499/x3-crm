# Zalo Team trên VPS riêng, giữ `/zalo-team` trong CRM

> **08/10 — production đã mở:** https://crm.x3sales.com/zalo-team. Frontend image `live-20261008` chạy riêng VPS Zalo; identity dùng CRM production qua private 9342, origin HTTPS CRM. Menu Team ẩn khỏi sidebar. CRM dùng overlay `compose.crm-zalo.yml` cùng `compose.yml`, giữ secret mounts và shared owner. Tunnel `compose.edge-tunnel.yml` chạy trên CRM, không phụ thuộc Windows. Các hướng dẫn local/9341 phía dưới là cấu hình trước cutover, không phải production hiện tại. Xem mục hiện tại/rollback trong README.SERVER.md; không chạy full-deploy CRM cũ bỏ qua overlay này.

> **08/10 — quyền tài khoản:** triển khai migration `2026_10_08_000100_create_zalo_access` trên CRM trước. Đặt `ZALO_TEAM_STORAGE_OWNER` giống nhau trên CRM và API/worker VPS, lấy đúng owner hiện có trong profile/kho; tuyệt đối không tạo owner mới khi nâng cấp. Không chuyển bảng `zt_access_*` sang VPS archive. Đăng nhập admin, mở Tài khoản → Phân quyền để phân công; tài khoản cũ chưa phân công chỉ admin. Các danh tính/thử nghiệm trong test đều giả. Kiểm tra bằng `tooling/tests/zalo-team-access.php` (PDO SQLite), hai `zalo-team-access*.test.cjs` và TypeScript.

> **07/10 — dọn source local:** đã gỡ bộ Wine/bridge và các thử nghiệm cũ; vận hành hiện hành dùng thư mục service này. Docker ignore loại test khỏi Web/Call/API/Frontend; kiểm tra Docker COPY Web/Call đạt, không có test trong gói. `npm run test:zalo` chạy hồi quy bằng fixture, không cần dữ liệu thật. Chưa build image đầy đủ/deploy VPS sau lượt dọn. Xem hiện trạng tài khoản và dữ liệu mới nhất trong README.ZALO-TEAM.md; các số liệu lịch sử bên dưới không phải kiểm kê hiện tại.

> **07/10 — cấu trúc mới trong source local:** worker nằm ở `apps/backend/integrations/zalo/`, Dockerfile/Compose/dev/deploy ở tooling. Build web/call dùng context root repo. Khi cập nhật VPS cần mang cả source backend và cấu hình tooling mới; image đang chạy chưa đổi sau refactor này. Không dùng bản đóng gói chỉ có tooling để build lại worker.

> **07/10 — hiện trạng sau dọn test:** hai liên kết Zalo cũ và toàn bộ kho/backup/profile Team của chúng đã xóa theo yêu cầu; archive DB/tệp về 0. VPS giải phóng 17,9 GiB, còn dùng khoảng 13 GiB. Drive chuyển dữ liệu test vào thùng rác; kho mới trống `120YB-3_XyDDR7Euo-xDXpz8Tjhkid4Ut`, kết nối Contributor đã kiểm tra. Giữ image Drive hiện hành, schema, secrets, CRM, Tiny House và file xuất gốc. Các mốc dưới là lịch sử trước khi dọn.

> **07/10 — hiện tại, Google Drive:** dùng image `x3-zalo-team-api:drive-storage-20261007`/`local`. Khi cập nhật chạy Compose với **cả** `-f compose.vps-local.yml -f compose.drive.yml` để giữ secret Drive và worker. Đã kiểm chứng Drive thật, khóa Contributor chỉ trong Shared Drive riêng, cache mục tiêu 5 GiB. Hai tài khoản test hiện có được loại khỏi tự chuyển theo yêu cầu; không tiếp tục backfill toàn kho test. Dữ liệu tài khoản mới tự xếp hàng. Xem [DRIVE.md](DRIVE.md) về vận hành/quyền/khôi phục và README.ZALO-TEAM.md về nghiệm thu. Tiny House và CRM không đổi.

> **07/10 — hiện tại, sửa gián đoạn nhập file:** API/sync dùng `x3-zalo-team-api:file-native-priority-20261007`/`local`, manifest `sha256:97efe2b91aa8e84b51cb44c191f3102718c42e8a6652f5a27f0b3fcf7a904909`. API tối đa 4 CPU/3 GiB, FPM 6 children; `libjxl-tools` tạo JPEG trên VPS, tối đa 2 decoder đồng thời (mỗi decoder 2 thread/512 MiB/30 giây). Sync nhường owner có lease nhập file trong 120 giây sau hoạt động bridge cuối, tự chạy lại khi hết lease. Client tự thử HTTP 409/lỗi tạm có giới hạn, giữ batch/cursor. Đã kiểm chứng tự tiếp tục thật và đối soát 1.446 blob/1.017.875.968 byte, 0 sai hash; hàng đợi chưa hoàn tất toàn file. Không đổi DB, backup, profile, CRM hoặc Tiny House. Các đoạn dưới là mốc lịch sử; xem nhật ký mới nhất README.ZALO-TEAM.md.

> **07/10 — cập nhật truyền theo nhóm:** API đang dùng `x3-zalo-team-api:file-pack-20261007` (tag local), đã bổ sung file-plan/upload-pack với stream và SHA-256, không đổi DB/worker/CRM/Tiny House. UI local bỏ trần thử 9,5 GB mặc định; giữ lựa chọn giới hạn tự đặt. Mốc đối soát sau thử Dừng: 2.120 tin, 276 blob duy nhất, 183.076.440 byte, 0 sai checksum. Hàng đợi 517 hội thoại còn đang nhập; chưa xác minh toàn bộ file 29,69 GB. Các số liệu ở đoạn sau là mốc thử ban đầu, không phải số liệu hiện tại. Xem nhật ký mới nhất README.ZALO-TEAM.md.

> **07/10 — cập nhật sau reset kho:** đã xóa kho/backup Team cũ và dữ liệu nhập PC tạm theo xác nhận của người dùng; giữ Web profile, CRM và Tiny House. Luồng mới Nhập từ file đọc .zl.zip tại Windows và truyền từng đợt lên VPS. Đã thử 620 tin/72 blob, nhập lại không trùng, tổng truyền khoảng 4,3 MB. File gốc 29,69 GB giữ nguyên; chưa nhập toàn bộ. Những số liệu cutover/backup trước ngày này bên dưới chỉ là lịch sử và không còn là bản dữ liệu hiện có. Hiện kho thử khoảng 4,1 MB; toàn ổ VPS dùng khoảng 13 GiB, còn 84 GiB (gồm OS/Docker/profile). API image x3-zalo-team-api:file-import-20261007 (tag local), Web connector đã build lại; sync/backup đã khởi động, enabled=false và daily_backup=false. Xem nhật ký mới nhất trong README.ZALO-TEAM.md.

## Trạng thái

**07/10/2026:** API bổ sung truy vấn chỉ đọc `day-file-issues` cho chi tiết tệp chưa lấy được theo ngày/tài khoản; image `x3-zalo-team-api:day-files-20261007`/`local`, chỉ recreate `api`. Đã kiểm tra health và UI local với dữ liệu VPS thật. Worker vẫn chạy image trước (có tag `before-day-files-20261007`), không đổi logic worker/DB hay chạy migration. Hai file PHP mới cũng cập nhật vào cây source VPS để lần build đầy đủ tiếp theo giữ thay đổi này.

**05/10/2026: đã cutover Web connector, kho/thẻ, database và worker sync/backup lên 14.225.198.183.** Bản đang chạy dùng `compose.vps-local.yml`, frontend/CRM local và SSH tunnel. Không áp dụng `compose.yml`/edge production vào CRM đang vận hành. Đã khóa ghi kho local bằng cấu hình offload; hai kho local và bundle PC cũ đã dọn sau đối soát theo yêu cầu ngày 05/10. Gọi thoại VPS chưa nghiệm thu.

## Cấu hình đang chạy: local CRM → VPS

- Local backend vẫn `combined` để xác thực CRM và điều khiển PC Windows, đặt `ZALO_TEAM_REMOTE_API_URL=http://127.0.0.1:9340/api` và `ZALO_TEAM_SERVICE_KEY_FILE` trỏ file riêng trong `tooling/deployment/.work/zalo-vps/secrets`. Local frontend: `ZALO_TEAM_API_URL=http://127.0.0.1:9340/api`, `ZALO_TEAM_PC_API_URL=http://localhost:4000/api`, `ZALO_TEAM_WEB_URL=http://127.0.0.1:9250`, cùng service-key file. Không in nội dung khóa.
- VPS `/opt/x3-zalo-team`: backend `ZALO_TEAM_RUNTIME=zalo`, database `zalo_team` riêng; `ZALO_TEAM_CRM_API_URL=http://127.0.0.1:9341/api`. APP_KEY dịch vụ mới; khóa giải mã backup cũ giữ nguyên. Cấu hình thật nằm ở `service.env` và `secrets/`, không commit.
- `tunnel.ps1 -Watch`: local 9250/9340 đến VPS Web/API; reverse VPS 9341 đến CRM local 4000. Chỉ localhost được bind; SSH kiểm tra host key, dùng key riêng và keepalive, tự nối lại sau 10 giây. Task Windows **X3 Zalo VPS Tunnel** chạy khi Admin đăng nhập, đã được người dùng xác nhận riêng. Mutex chống chạy nhiều tunnel.
- Frontend/CRM vẫn cần khởi động bình thường; `npm run dev:zalo-vps` mở tunnel thủ công nếu cần. Đã gỡ autostart và npm launcher PC worker cũ. Bộ đọc file khởi động một lượt khi bấm Nhập từ file, giữ cursor để tiếp tục. Không khởi động Web Docker local cùng profile đang chạy trên VPS.
- 07/10: dev frontend/backend gọi `ensure-tunnel.cjs` trước khi phục vụ. Helper chỉ hoạt động trên Windows khi API Zalo cấu hình `http://127.0.0.1:9340` hoặc `http://localhost:9340`, kiểm tra 9250/9340 và `/api/health`, dùng task đã có hoặc watcher ẩn có mutex. Không tạo task/khóa mới, không đổi endpoint. Thiếu khóa hoặc VPS chưa tới được chỉ cảnh báo, CRM vẫn khởi động. Task hiện dùng đường dẫn PowerShell tuyệt đối và working directory repo; đã thử phục hồi khi task dừng, chưa thử đăng nhập Windows lại.
- Task tunnel đã bổ sung trigger `X3ZaloRecovery` mỗi phút cùng `StartWhenAvailable`, giữ trigger đăng nhập và `IgnoreNew`: tự bật lại nếu cả watcher bị ngắt. Tiến trình đang chạy không bị restart mỗi phút. Lần kiểm tra lại vẫn gặp mã ngắt `0xC000013A`; chưa xác định tác nhân gửi tín hiệu ngắt.
- **Chưa độc lập 24/7 với máy local**: CRM local/tunnel ngừng thì worker từ chối tiếp tục owner khi không xác minh được quyền. Connector Web và dữ liệu VPS vẫn tồn tại. Khi chuyển production cần dùng endpoint xác thực CRM hoạt động liên tục, chưa được cấu hình trong lượt này.

### Vận hành

Từ repo Windows (SSH helper không chứa mật khẩu):

```powershell
& tooling/zalo-team/service/vps.ps1 exec 'docker ps'
& tooling/zalo-team/service/vps.ps1 exec 'docker stats --no-stream'
& tooling/zalo-team/service/vps.ps1 exec 'curl -fsS http://127.0.0.1:9340/api/health'
Get-ScheduledTask -TaskName 'X3 Zalo VPS Tunnel'
```

Trên VPS, từ `/opt/x3-zalo-team`:

```sh
docker compose -f tooling/zalo-team/web/compose.yml up -d
docker compose -f tooling/zalo-team/service/compose.vps-local.yml up -d
docker compose -f tooling/zalo-team/service/compose.vps-local.yml logs --tail 50 sync backup
```

Không recreate/dừng backup khi đang giữ khóa kho và chưa verify xong. Sync không bắt đầu lượt mới nếu có backup pending/running; backup đang verify vẫn có thể giữ khóa sau khi state chuyển ready, kiểm tra thêm `verified_at`. Không chạy `down -v` hoặc xóa volume để cập nhật code.

### Dữ liệu và bằng chứng cutover

- Archive `/opt/x3-zalo-team/data/archive`, backup `/opt/x3-zalo-team/data/backups`; UID/GID 82. DB volume `x3-zalo-team-service_database`, profile volume `x3-zalo-team-web_web_profiles`.
- `migrate-data.php export/import/verify` dùng snapshot và không cho nhập đè DB có dữ liệu. Đã đối soát từng dòng 17 bảng Zalo + identity tối thiểu; 38.623 nội dung, 38.683 quan sát, 9.632 asset, 176 nguồn tại thời điểm cutover. Export SHA-256 `15c50cf7098b32e64f59f2703aff522716867910821f208311154ba5e3d1022e`.
- 12.520 tệp, 10.161.920.905 byte: mọi SHA-256 khớp. Bảy backup cũ đã giải mã/verify. Hai backup mới chạy trên VPS đã ready + verified; bản nhấn giao diện `acae818c-838b-4b0d-859e-69e9882f5a65` xác minh 10:31:15 ngày 05/10/2026.
- Hai kho local và ba bundle PC đã dọn (11,07 GB); các gói migration trong tooling vẫn giữ. Người dùng xác nhận dữ liệu test có thể xóa thẳng: đã xóa vĩnh viễn ba bundle PC gián đoạn và bản tar tại `/opt/x3-zalo-team/recovery/local-pc-20261005`; không còn bản phục hồi đó. PC local chỉ giữ trạng thái/heartbeat/lock khoảng 10 KB. Không coi chúng là bản dự phòng độc lập đầy đủ sau cutover; dữ liệu mới phát sinh trên VPS. Chưa chọn nơi dự phòng ngoài VPS. Nguồn Zalo hết hạn/chưa tìm được vẫn được giữ trạng thái, không báo đã lưu giả.
- RAM đo thực tế backup khoảng 170–206 MiB khi kiểm tra 6.000+ blobs, trần 384 MiB/PHP 256 MiB/CPU 1. Sync trần 256 MiB/PHP 192 MiB. Cấu hình VPS local chưa chạy Next/voice trên VPS; bảng tài nguyên dưới đây là phương án đầy đủ.

## Phương án đầy đủ khi chuyển CRM production (chưa áp dụng)

- Trình duyệt vẫn mở `https://<CRM>/zalo-team`.
- Reverse proxy chuyển `/zalo-team`, `/zalo-team/*`, `/api/zalo-team/*` và `/zalo-team-assets/*` đến Next trên VPS Zalo. API tin nhắn, upload, gọi, ảnh kho đi qua tiến trình Next này.
- Next gọi API kho/thẻ nội bộ trên VPS Zalo; connector Web và voice worker cũng ở VPS Zalo. Ảnh Web gần đây vẫn ưu tiên CDN Zalo như hiện tại.
- CRM chỉ xác nhận danh tính/quyền. Zalo không giữ mật khẩu, cookie phiên CRM hoặc quyền đăng nhập của CRM trong database. Bảng `users` của Zalo chỉ có ID và owner hash để giữ khóa ngoại.
- Worker xác nhận lại tài khoản với CRM trước mỗi lượt. CRM mất kết nối, vô hiệu hóa tài khoản hoặc thay đổi phạm vi owner thì dừng lượt của người đó; không tự cấp quyền từ cache cũ.
- Hai VPS không dùng chung DB, volume, APP_KEY hay scheduler. Service key riêng chỉ dành cho các request nội bộ. Khóa mã hóa backup phải được giữ nguyên nếu chuyển bản backup cũ.
- Nếu reverse proxy đặt trên VPS CRM, luồng dữ liệu vẫn đi qua mạng/Nginx của VPS CRM. Nginx tắt buffering; PHP/Node CRM không xử lý tải này. Muốn bỏ cả băng thông đi qua VPS CRM thì cần edge proxy định tuyến theo đường dẫn ở phía trước hai VPS.

## Tab Server và bộ thu thập tài nguyên

Đã triển khai cho VPS local ngày 05/10. `server-metrics.py` chạy trên host qua `x3-zalo-metrics.service`; host đọc `/proc` và Docker CLI với allowlist sáu container. Không cấp Docker socket cho PHP/Next. CPU toàn máy là delta `/proc/stat` (idle+iowait); RAM dùng `MemTotal - MemAvailable`, ổ đĩa dùng/available/reserved từ filesystem. Docker CPU dùng thang 100% = một core, RAM là số CLI đã loại cache.

Snapshot atomic và lịch sử tối đa 2.880 mẫu/24h nằm `/opt/x3-zalo-team/metrics/server.json`, API chỉ mount read-only ở `/run/zalo-metrics`. `ZALO_TEAM_METRICS_PATH` cho phép cấu hình đường dẫn snapshot cố định; request không nhận đường dẫn/lệnh. Chu kỳ 30 giây; thống kê du kho/database/profile 5 phút, timeout 25 giây mỗi đường dẫn; thiếu số liệu trả null, collector dừng thì API/UI đánh dấu stale sau 90 giây. Lịch sử bắt đầu từ khi bật, giữ qua restart, không phải dữ liệu 24h trước lúc triển khai.

Quản trị viên CRM được projection `can_monitor_server=true`; tài khoản khác nhận 403 khi gọi `kind=server-status`. Tài nguyên là toàn VPS, không phải số liệu riêng từng tài khoản Zalo. Frontend dừng polling khi rời tab Server hoặc trang không hiển thị.

Nguồn collector hiện ở `apps/backend/integrations/zalo/metrics/server-metrics.py`; unit và cấu hình cài đặt giữ trong tooling. Đợt A chỉ đổi đường dẫn trong source local, **chưa cập nhật unit/collector VPS**. Lần deploy sau phải chép file runtime mới trước khi cài unit mới; giữ snapshot `/opt/x3-zalo-team/metrics`.

Cài đặt từ `/opt/x3-zalo-team` khi triển khai bản mới:

```sh
install -d -m 755 /opt/x3-zalo-team/metrics
install -m 644 tooling/zalo-team/service/x3-zalo-metrics.service /etc/systemd/system/x3-zalo-metrics.service
systemctl daemon-reload
systemctl enable --now x3-zalo-metrics
```

`compose.vps-local.yml` có mount snapshot cho API. Đối chiếu compose hiệu lực theo README.SERVER.md khi deploy; API đọc snapshot read-only, không dùng Docker socket. Collector RAM 128 MiB, CPU 20%, không mở cổng mạng mới. Kiểm tra offline: `python3 -B apps/backend/integrations/zalo/metrics/server-metrics-test.py`; PHP `tooling/tests/zalo-team-server-metrics.php` cần môi trường PHP tương ứng.

## Runtime

| Chế độ | API CRM | API Zalo PHP | Lịch Zalo | Worker Zalo |
|---|---|---|---|---|
| `combined` (mặc định local) | Có | Có | Như trước | Cho phép |
| `crm` | Có | Không | Không | Chặn lệnh `zalo-team:*` |
| `zalo` | Không | Có, service key + phiên CRM | Không tự tạo lịch | Chạy riêng theo compose |

`zalo-team:migrate` chỉ chấp nhận database riêng; từ chối nếu thấy bảng CRM hoặc bảng users có schema CRM. Không chạy `migrate --force`, `db:seed` hoặc Docker CMD cũ trên dịch vụ này. Cấu hình dùng role mới cần xóa cache config/route từ bản build cũ trước khi khởi động.

## Giới hạn tài nguyên ban đầu

| Tiến trình | RAM container | Giới hạn bên trong |
|---|---:|---|
| API PHP | 512 MiB | 2 FPM workers, 192 MiB/worker, tái tạo sau 100 request |
| Đồng bộ | 256 MiB | PHP 192 MiB, 20 giây/chủ kho/lượt |
| Sao lưu | 384 MiB | PHP 256 MiB, 1 worker |
| Next Zalo | 512 MiB | Node heap 384 MiB |
| PostgreSQL Zalo | 512 MiB | 30 kết nối, shared buffers 128 MiB |
| Connector Web | 2 GiB | CPU 2, 256 PID |
| Voice (cấu hình bổ sung) | 384 MiB | CPU 1 |

Đây là trần cấu hình khởi đầu, chưa phải sizing đã đo với số account thật. Tổng trần cộng lại vượt 4 GiB, cần chừa RAM cho OS và filesystem cache. Không đặt tổng trần sát RAM vật lý. Worker đồng bộ/sao lưu tự thoát sau khoảng 30 phút (hoàn tất lượt hiện tại), compose khởi động lại; dữ liệu/hàng đợi trên DB và volume. Chỉ chạy một bản sao mỗi loại worker. Lượt backup bị dừng có thể dựng lại từ manifest/DB dưới khóa kho; không đánh dấu `ready` trước khi hoàn thành ghi file.

Tạo backup đọc DB theo lô 100 dòng trong snapshot nhất quán; danh sách asset đọc lại từ manifest trên đĩa. Kiểm tra backup còn giữ chỉ mục hash/size nhỏ trong RAM; metadata thẻ vẫn được snapshot theo cơ chế hiện tại. Chưa khẳng định toàn bộ bộ nhớ của mọi loại dữ liệu là hằng số. HTTP verify/restore chạy trong pool PHP có giới hạn trên VPS Zalo; chưa chuyển hai thao tác này thành job nền.

## Chuẩn bị và chạy compose production (khi có yêu cầu triển khai tiếp)

1. Tạo `.env` và `service.env` từ các bản mẫu; đặt APP_KEY mới, DB_PASSWORD khớp file `secrets/database-password`, khóa backup, public origin và địa chỉ API CRM nội bộ. Next chỉ nhận địa chỉ CRM và service key, không nhận mật khẩu DB/khóa backup. Không commit các file thật.
2. Tạo `secrets/service-key`, `connector-token`, `call-token` dạng 64 ký tự hex. Service key được đặt ở CRM qua `ZALO_TEAM_SERVICE_KEY_FILE`; quyền đọc chỉ cấp cho process cần dùng. Connector token/profile phải chuyển cùng nhau nếu giữ các phiên/account ID cũ.
3. Trên cả backend và Next của CRM đặt `ZALO_TEAM_RUNTIME=crm` khi cutover; Next CRM cũng từ chối chạy API Zalo nếu reverse proxy định tuyến sai; chỉ endpoint xác thực worker nhận service key. Cho phép truy cập `/api/internal/zalo-team/identity/{id}` từ mạng riêng của VPS Zalo; chặn trên public vhost theo mẫu Nginx. Truyền cookie chỉ qua TLS hoặc mạng riêng đã bảo vệ.
4. Đặt `CRM_PUBLIC_API_URL=https://<CRM>/api` khi build frontend. Đặt `ZALO_BIND_IP` là IP VPN/nội bộ VPS Zalo khi mở cho reverse proxy; không mở public port 9300, 9000, PostgreSQL, connector hay voice HTTP.
5. Build: `docker compose -f compose.yml build`. Tạo DB: `docker compose -f compose.yml up -d database`. Migration: `docker compose -f compose.yml run --rm api php artisan zalo-team:migrate`. Không tự seed.
6. Chỉ sau khi chuyển và đối soát dữ liệu: `docker compose -f compose.yml up -d`. Áp dụng `edge.nginx.conf.example` và `zalo-proxy.conf.example` vào vhost CRM, kiểm tra `nginx -t` trước reload. `/zalo-team-assets` phải trỏ đến đúng build Next riêng; không dùng chung chunk URL với frontend CRM.
7. Voice có cấu hình bổ sung `compose.call.yml`, dùng engine Node ZRTC hiện có. Cần `ZALO_MEDIA_IP`, UDP 41000–41031 và kiểm tra ICE/NAT/gọi hai chiều. Compose cơ bản chưa bật voice mới; không tuyên bố gọi trên VPS hoạt động chỉ từ test giả lập.

## Chuyển dữ liệu hiện có, không nhập nhầm kho

- Dừng worker Web/PC/backup và thao tác ghi Zalo trong cửa sổ chuyển. CRM nghiệp vụ vẫn chạy.
- Sao lưu database nguồn và toàn bộ thư mục blob/backup/profile trước khi chuyển. Không xóa kho nguồn sau khi copy.
- Database mới: chỉ chuyển bảng `zt_*`, giữ nguyên ID, owner, external account ID, mốc sync và trạng thái dọn dẹp. Không copy toàn bộ bảng users/CRM. Tạo các hàng FK identity bằng ID người dùng cũ và owner hash đã đối soát với CRM; include cả actor lịch sử cho FK audit/import.
- Chuyển cả archive blobs, encrypted backup manifests và thư mục `blobs` dùng chung của backup, connector profile; giữ nguyên workspace và khóa giải mã. Backup ứng dụng không bao gồm toàn bộ cấu hình thẻ, settings, profile và dữ liệu quản trị nên **không dùng riêng ZIP ứng dụng làm bản migration đầy đủ**.
- Đối soát số dòng từng bảng, số unique hash, tổng bytes, hash từng blob và giải mã/verify backup. Mở chat cũ, tải ảnh/file, xem thẻ, chạy đồng bộ hai lần để kiểm tra không nhân đôi. Xác nhận owner của từng account trước khi bật ghi.
- Rollback: ngừng ghi phía mới trước, giữ lại mọi dữ liệu mới phát sinh; chưa mở lại nguồn cũ cho ghi cho đến khi đối soát phần chênh. Không ghi đè database nguồn bằng snapshot cũ.
- Copy/cutover local → VPS đã hoàn thành ngày 05/10 theo bằng chứng đầu tài liệu. Nơi dự phòng độc lập vẫn chờ người dùng chốt; volume cùng VPS không được gọi là backup độc lập.

## Giới hạn PC cần giữ rõ

Bộ nhập PC chạy trên Windows local có Zalo PC; `supported()` vẫn kiểm tra Windows/local. PC controls đi tới local backend, kho/thẻ đi tới VPS. `ZaloTeamPcRemote` và private `ZaloTeamPcBridgeController` kiểm tra service key, CRM identity còn hoạt động và owner/account trước prepare/upload/commit. Bundle truyền streaming, hash và kích thước, resume theo từng file đã xác minh; chỉ dọn staging sau biên nhận import đã commit. Không mount DB/profile PC lên VPS. HTTP bridge 9 MiB đã thử thật qua SSH, catalog thật chuẩn bị thành công; 12 kiểm tra bridge gồm quyền, traversal, hash sai, resume và replay không nhân đôi đạt. **Chưa chạy lại lượt xuất/nhập native PC hoàn chỉnh sau cutover**.

## Kiểm tra local đã có

- `tooling/tests/zalo-team-service.php crm|combined|zalo`: ranh giới route, CLI, migration riêng, quyền, owner, CRM lỗi/thu hồi.
- `tooling/tests/zalo-team-backup-memory.php`: 6.000 tin giả lập ~105,5 MiB, PHP heap tạo/verify tăng 4 MiB; chạy với memory_limit 96M, restore đủ số tin. Không đại diện cho RSS PostgreSQL, libzip hay tải nhiều account thật.
- Bộ archive 172 kiểm tra, PC session 47, PC import 32; voice connector boundary và voice giả lập 3 tests.
- `compose.vps-local.yml` và Web compose đã build/chạy thật trên VPS; hai account kết nối, API/Nginx/DB healthy. Compose production Next/edge/voice vẫn chưa triển khai.
- Sau cutover: TypeScript đạt, routing Node 3, worker priority 4, bridge 12, service zalo 21 và cold HTTP zalo 4 đạt. Chrome mở được chat 18/03/2025 và ảnh kho; thao tác Sao lưu ngay tạo bản verified trên VPS.

## Giữ dung lượng gọn sau triển khai

Ngày 05/10 đã xóa gói migration trên VPS sau đối soát, chạy docker builder prune --all --force và apt-get clean; tổng đĩa còn ~19,22 GiB. Bộ collector đo thêm Docker/containerd, trừ database/profile để không tính lặp, gói tạm và phần hệ thống còn lại. Backup encrypted blobs (~5,43 GiB) là bản sao có chủ đích, dùng chung giữa các manifest; không tạo lại từng bản toàn bộ blob. Không tự xóa backup hợp lệ hoặc volume. Sau lần build/deploy tiếp theo, dọn gói upload/cache đã dùng xong khi kiểm chứng thành công. Các gói migration tại tooling local còn giữ; không dùng chúng làm số liệu dung lượng VPS.
