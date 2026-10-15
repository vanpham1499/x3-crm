# Server X3Sales — 14.225.198.183

## Hiện tại — release team-20261010, 10/10/2026

- Đã triển khai commit chức năng `1b2f18c` từ `codex/zalo-team-crm-integration` lên **https://crm.x3sales.com** và **https://crm.x3sales.com/zalo-team**. Menu CRM đã hiển thị Zalo Team. Các mốc 08/10 bên dưới là lịch sử.
- CRM 45.252.251.120 dùng frontend/backend `team-20261010`, bao gồm scheduler/queue/reverb; overlay bắt buộc `compose.crm-release.yml` sau base + `compose.crm-zalo.yml`, image tags trong `crm.release.env`. Chỉ migrate campaign permission và bốn migration CRM 000230–000260. Backend startup không tự migrate toàn kho Zalo.
- Zalo 14.225.198.183 dùng frontend/API/connector `team-20261010`. API/sync/backup/8 Drive workers và một campaigns worker production dùng identity 9342/origin HTTPS. API local + campaigns-local giữ nguyên 9341/origin local. Call gateway, metrics collector, database, Tiny House và tunnel không thay image.
- Backup database/config trước triển khai ở `releases/team-20261010` trên từng VPS; đã kiểm tra manifest, chưa diễn tập restore. Image cũ được giữ tag rollback riêng. Hướng dẫn vận hành, image IDs, cấu hình volume và rollback: [RELEASE-2026-10-10.md](tooling/deployment/production/RELEASE-2026-10-10.md).
- Kiểm tra Chrome production: menu, inbox 294 hội thoại/4 tài khoản, Chiến dịch (0 theo origin production), Tài khoản (4), Công việc và Đồng bộ tải được; preview PDF báo phí 0,50 MB tạo được. Backend/FE/connector/worker restart 0, OOM false tại thời điểm kiểm tra. Scheduler có gửi tài liệu và nhắc hạn mỗi phút. Chưa gửi/gọi thật hoặc chạy chiến dịch; chưa nghiệm thu nhiều nhân sự/soak/restore.
- Đồng bộ vẫn báo 136 nguồn lịch sử lỗi và 27 tệp cần kiểm tra nguồn trong mẫu kiểm tra; đây là phần chất lượng dữ liệu nguồn chưa được xử lý trong lượt deploy. Không suy ra health dịch vụ đạt đồng nghĩa toàn bộ lịch sử đã lưu đủ.

## 08/10 — Chiến dịch gửi hàng loạt cho giao diện local

- Sau người dùng xác nhận, connector dùng image `x3-zalo-team-web-connector:campaigns-20261008` (Compose web + `compose.campaigns.yml`); protocol 1 hỗ trợ đối soát không gửi lại và kiểm tra đúng native account. Đã restart một lần, giữ volume; cuối lượt 4/4 account connected/health healthy.
- API riêng local và worker mới dùng `x3-zalo-team-api:campaigns-20261008`. Compose service: `compose.dev-client.yml` + `compose.campaigns-dev.yml`, worker cần profile `campaigns-local`. Container worker `x3-zalo-team-dev-client-campaigns-local-1`, giới hạn 256 MiB/0,5 CPU; mẫu idle 30,03 MiB/0,01%. Tệp chiến dịch `/data/campaigns`; migration chỉ thêm các bảng `zt_campaign*` trên kho.
- Worker này dùng identity CRM **local** qua 9341; mất backend/tunnel local sẽ không gửi tiếp. Chiến dịch tách theo `identity_origin`; worker production dùng 9342/origin HTTPS khi triển khai sau. Không khởi động đồng thời worker Windows hoặc đổi origin dữ liệu để chuyển chiến dịch.
- API/FE production, sync, backup và Drive không đổi. Migration quyền `zalo_team.campaigns.send` mới chỉ áp dụng CRM local. Lúc bàn giao không có chiến dịch đang chạy; một bản kiểm tra đã hủy, `dispatched_at` khác null = 0. Chưa nghiệm thu gửi/nhận thật.
- Gói ở `/opt/x3-zalo-team/releases/campaigns-20261008`; image rollback API/Web lần lượt `x3-zalo-team-api:before-campaigns-20261008`, `x3-zalo-team-web-connector:before-campaigns-20261008`. Dừng worker trước rollback; giữ bảng/volume. Chi tiết chức năng và kiểm thử trong README.ZALO-TEAM.md.

## 08/10 — Sửa tunnel Windows giữ cổng khi mất kết nối

- Phiên Windows cũ giữ reverse 9341 dù local không còn ssh.exe; tunnel mới thất bại, inbox local không tới được kho/connector. Đã đối chiếu PID/cổng và kết thúc duy nhất phiên treo. Không restart ứng dụng hoặc database.
- Đã cài `tooling/zalo-team/service/ssh-keepalive.conf` thành `/etc/ssh/sshd_config.d/40-x3-tunnel-keepalive.conf`, quyền root:root 644. `sshd -t` đạt rồi `systemctl reload ssh`; effective `ClientAliveInterval 30`, `ClientAliveCountMax 3` (trước đó đều 0). Áp dụng cho phiên SSH mới, không mở thêm quyền hoặc cổng. Rollback: gỡ đúng file này, kiểm tra `sshd -t` rồi reload ssh.
- Watcher Windows đã khởi động lại; health 9345/9250 HTTP 200, lệnh dev frontend nhận kết nối sẵn sàng, Chrome inbox/Lưu trữ hết lỗi. Script giữ stderr và exit code SSH trong log. Chưa diễn tập sleep/mất mạng 90 giây.

## Hiện tại — production mở ngày 08/10/2026

- URL: **https://crm.x3sales.com/zalo-team**. Menu Team ẩn trong source sidebar; frontend CRM đang chạy vốn chưa có mục Team, giữ image nghiệp vụ hiện hành. Nginx CRM đã route riêng Team/API/assets qua `zalo-tunnel:9300`; API identity nội bộ bị chặn public (404). Cấu hình khớp `tooling/deployment/production/nginx.conf`.
- Frontend VPS Zalo: `x3-zalo-team-frontend:live-20261008`, manifest `sha256:76e2ad868817614ec3b7300c9a1aca2933f6bca7baf3b5769900189edb2bb4ed`. Compose frontend/release env vẫn ở thư mục service, bind loopback 9300. Gói/source/log: `/opt/x3-zalo-team/releases/live-20261008`. Health healthy, restart 0/OOM false; mẫu RAM 60,7 MiB. Giữ image `stage3-20261008-r2` để rollback frontend.
- CRM backend: `x3crm-backend:zalo-stage3-20261008`, áp dụng `compose.yml` + `compose.crm-zalo.yml`; migration ACL đã chạy. Giữ 4 account assignments và 2 grants sau kiểm tra 27 người dùng và phòng ban khớp local-production. Không thay dữ liệu nghiệp vụ/user. Backup mới `/opt/x3crm/releases/live-20261008/crm.before.dump` và manifest đã kiểm tra; chưa diễn tập restore DB CRM thật.
- Hai secret nội bộ đã được người dùng duyệt, chép vào `/opt/x3crm/secrets/{service-key,connector-token}`, chmod 600, directory 700; hash đối chiếu đúng và bản trung chuyển local đã xóa. `zalo-team.env` chỉ chứa storage owner hiện hữu và origin production. Không ghi nội dung secret vào source/image/tài liệu.
- `service.env` Zalo hiện dùng `ZALO_TEAM_CRM_API_URL=http://127.0.0.1:9342/api`, `ZALO_TEAM_PUBLIC_ORIGIN=https://crm.x3sales.com`. Recreate riêng api/sync/backup với overlay Drive, giữ image API `inbox-archive-20261008`; không có backup/import pending/running khi chuyển. Frontend cũng xác thực qua 9342. Production không phụ thuộc reverse Windows 9341. Drive workers chạy hiện hành không gọi identity CRM; lần recreate tiếp theo nhận service.env mới.
- Kiểm tra browser bằng phiên CRM production thật: inbox/Đã lưu trữ và Đồng bộ & sao lưu hiển thị dữ liệu; API/frontend health 200, internal identity public 404, sync tiếp tục. Gửi/gọi thật và nghiệm thu nhân sự vẫn dành cho người dùng. File import Windows chưa hỗ trợ upload production. Không dùng các kết quả local để kết luận production.
- Vận hành: CRM dùng `docker compose -f compose.yml -f compose.crm-zalo.yml ... backend`; tunnel riêng `docker compose -f compose.edge-tunnel.yml ...`; frontend Zalo dùng `docker compose --env-file frontend.release.env -f compose.frontend.yml ... frontend`; API/worker dùng `docker compose -f compose.vps-local.yml -f compose.drive.yml ...`. Không chạy script full deploy CRM cũ hoặc compose.yml đơn lẻ để ghi đè phần backend/identity/secret đang triển khai; lần full deploy sau phải hợp nhất overlay với image CRM mới.
- Rollback frontend bằng `frontend.release.before.env` trong release Zalo rồi up frontend. Rollback toàn cutover: trả nginx từ `releases/live-20261008/nginx.before.conf`, nginx -t/reload; CRM dùng image `before-zalo-stage3-20261008`; trả service.env từ `releases/live-20261008/service.before.env` và recreate api/sync/backup nếu cần quay lại luồng local. Giữ nguyên DB/ACL/kho/Drive; không down migration hoặc restore DB cũ lên dữ liệu mới chỉ để rollback code.

## Các mốc chuẩn bị trước khi mở production

> **08/10 — lưu trữ hội thoại cá nhân:** API dùng `x3-zalo-team-api:inbox-archive-20261008`/local, migration riêng tạo `zt_inbox_archived` đã chạy; health 200. Chỉ recreate API, không đổi worker/connector/database hiện có. Source ba file PHP đã cập nhật trong `/opt/x3-zalo-team/apps/backend`. Gói ở `releases/inbox-archive-20261008`, rollback `x3-zalo-team-api:before-inbox-archive-20261008`; giữ bảng mới khi rollback. UI chạy local và đã kiểm tra archive/reload/restore; frontend production chưa có tính năng này.

> **08/10 — đợt 3, staging production (mới nhất):** frontend standalone `x3-zalo-team-frontend:stage3-20261008-r2` (manifest `sha256:6c6fe5a7581e33b8438f43aef2566d3f729316a9308fae7e08e0a5a77ac4b5e1`) đã chạy tại 127.0.0.1:9300 trên VPS Zalo, healthy. Chưa chuyển domain hoặc backend CRM. Tunnel riêng hai VPS đã được duyệt và chạy; việc chép service-key/connector-token sang CRM còn chờ xác nhận riêng. Không dùng bộ compose.yml cũ để thay stack hiện có vì có thể tạo database/profile volumes khác.

### Đợt 3 — checkpoint trước cutover (đã hoàn tất các gate triển khai ở mục hiện tại)

- Zalo frontend: `/opt/x3-zalo-team/tooling/zalo-team/service/{compose.frontend.yml,frontend.env,frontend.release.env}`. `frontend.env` trỏ identity tới `http://127.0.0.1:9342/api`. Biến public origin cố định `https://crm.x3sales.com`; không lấy từ header khách. Build release/source/log ở `/opt/x3-zalo-team/releases/frontend-stage3-20261008`.
- CRM: `/opt/x3crm/compose.edge-tunnel.yml` chạy `x3-zalo-edge-tunnel-1` trong mạng `x3crm_default`, alias `zalo-tunnel`. Key riêng ở secrets/zalo-edge (UID 1000, mode 0400), known_hosts được đối chiếu khóa host đã tin cậy. Zalo user `x3-edge` không có shell; authorized_keys chỉ chuyển tiếp tới 127.0.0.1:9300/9250 và nghe 127.0.0.1:9342. Không mở cổng HTTP dịch vụ ra Internet.
- CRM release `/opt/x3crm/releases/zalo-stage3-20261008`: backup DB/config, image `x3crm-backend:zalo-stage3-20261008`, rollback `x3crm-backend:before-zalo-stage3-20261008`, bản Nginx đã kiểm tra. Chưa apply overlay `compose.crm-zalo.yml`, chưa migrate. Backend hiện hành vẫn `x3crm-backend:deploy`.
- Gate còn thiếu: (1) người dùng duyệt chép hai khóa, đối chiếu hash với VPS và giữ ngoài image/source; (2) tạo zalo-team.env với shared storage owner hiện hữu, đối chiếu danh tính/assignments CRM local-production, không tự sao chép user/grants khi chưa khớp; (3) chạy riêng migration ACL, áp dụng backend overlay, kiểm tra auth/CSRF/cấp-thu hồi quyền; (4) đổi identity/API VPS từ Windows reverse tunnel 9341 sang private CRM 9342 với public origin production, chỉ recreate api/sync/backup khi không có lượt ghi đang chạy, luôn giữ compose.drive.yml; (5) kiểm tra authenticated inbox/kho/gọi capability, rồi mới thay Nginx và reload; (6) nghiệm thu nhân sự/đọc tin thật, không tự gửi thử cho khách.
- Local dev hiện hành chưa đổi endpoint. Sau cutover phải cấu hình dev rõ ràng, không trộn cookie local với identity production. File import Windows vẫn là helper local, chưa có upload file xuất qua trình duyệt production.
- Rollback trước cutover: frontend riêng/tunnel không nhận người dùng, có thể dừng bằng đúng compose của chúng; stack CRM/Zalo cũ tiếp tục. Sau cutover: khôi phục nginx.before.conf và kiểm tra nginx -t trước reload; dùng image backend rollback và env/config snapshot; giữ nguyên database, không down migration/drop ACL. Trả identity VPS về snapshot nếu cần. Không restore toàn DB lên dữ liệu mới chỉ để rollback code.
- Kiểm tra đã đạt: 313 JS test/1 skip, 42 PHP ACL, backup/restore giả lập 6.000 tin. Backup CRM mới đã kiểm tra danh mục, chưa diễn tập restore DB CRM thật. Chưa có kết quả nghiệm thu đồng thời nhân viên/production login/cuộc gọi/Drive restore. Mẫu 20 GET khung trang p95 452 ms không đại diện latency inbox.


> **08/10 — đợt 2 tối ưu inbox:** connector dùng `x3-zalo-team-web-connector:inbox-stage2-20261008`/latest, manifest `sha256:58df3cf97e14e4ab9f5443ec517c1bad33e7d4a1625cce113a5da7078e7ac6e9`. Native events được lọc/gom, đẩy delta và stream từng tài khoản; snapshot diff tuân theo khóa vòng đời. Health healthy, restart=0/OOM=false, 4/4 tài khoản/183 hội thoại Web tại lần kiểm tra. Giữ profile/kho/dịch vụ khác; rollback image `before-inbox-stage2-20261008` (đợt 1). Source/gói patch ở `.local/deploy-inbox-stage2-20261008`, source runtime cũng đã cập nhật. Frontend/BFF còn local, CRM 45.252.251.120 chưa triển khai. 56 kiểm tra tập trung và TypeScript đạt; số liệu và giới hạn nghiệm thu trong README.ZALO-TEAM.md.

> **08/10 — đợt 1 ổn định inbox:** Web connector dùng `x3-zalo-team-web-connector:inbox-stage1-20261008`/latest, manifest `sha256:92b1bd776aa1c7fb8667fe06b2768735ee50db333e0f76647d29744322159cf8`. Chỉ recreate connector khi gateway rảnh; giữ volume profile, kho, database và các dịch vụ khác. Đọc giới hạn theo tài khoản, retry/cache theo phiên, tự reload riêng phiên kẹt khi rảnh tối đa hai lần/đợt lỗi. Health đạt, restart count 0/OOM false; API và Chrome local xác nhận 4/4 tài khoản, 148 hội thoại, Hoà Nguyễn 23. Rollback image `x3-zalo-team-web-connector:before-inbox-stage1-20261008`; gói triển khai ở `releases/inbox-stage1-20261008`. 34 kiểm tra và TypeScript đạt; chưa nghiệm thu dài ngày/gọi thật. Frontend còn local, CRM production 45.252.251.120 chưa thay đổi. Chi tiết và giới hạn trong README.ZALO-TEAM.md.

> **08/10 — tên người gọi CRM:** Web `x3-zalo-team-web-connector:call-sender-20261008`/latest và gateway `x3-zalo-team-call:call-sender-20261008`/local đã cập nhật. Ánh xạ native call ID → CRM actor lưu cùng index senders trên volume Web, trước tín hiệu bắt đầu. Restart lúc gateway rảnh, giữ profile và các dịch vụ khác. Rollback Web `sender-20261008`, call `access-20261008`. Đã đối chiếu call ID của bản tin thật bằng read-only; chưa gọi thật nghiệm thu sau cập nhật.

> **08/10 — tên người gửi CRM:** Web dùng `x3-zalo-team-web-connector:sender-20261008`/latest; API/sync/backup dùng `x3-zalo-team-api:sender-20261008`/local. Index người gửi nằm trong volume Web tại `/data/send-receipts/senders`, được đưa vào observation/version khi đồng bộ kho; cần giữ volume và backup metadata kho. Không đổi schema/profile/tài khoản/phân công. Health Web/API đạt, sync tiếp tục chạy; 3 tài khoản vẫn kết nối trên UI. Rollback Web `before-sender-20261008`, API `access-20261008`. Frontend và identity CRM còn local; chưa deploy CRM 45.252.251.120, chưa gửi tin thật để nghiệm thu.

> **08/10 — ACL Zalo Team:** API/sync/backup dùng `x3-zalo-team-api:access-20261008` (`local`), gateway dùng `x3-zalo-team-call:access-20261008` (`local`). Thêm `ZALO_TEAM_STORAGE_OWNER` đúng kho hiện có vào service.env; không đổi data/profile/DB. Chỉ migration CRM local, không migration trên VPS archive hay CRM 45.252.251.120. Phiên gọi ràng buộc actor; health và sync đạt, chưa gọi thật. Image `before-access-20261008` giữ cho rollback; nếu rollback phải phối hợp frontend/CRM và chặn người dùng đã được chia tài khoản để tránh bỏ qua ACL.

> **07/10 — source local đã tổ chức lại, chưa deploy:** mã worker web/call/file-import/pc/shared nằm trong `apps/backend/integrations/zalo/`; Dockerfile/Compose vẫn trong `tooling/zalo-team`. Build context web/call bây giờ là root repository, COPY source backend. Khi triển khai lần tới phải truyền cả `apps/backend/integrations/zalo` và tooling cấu hình mới; không chỉ truyền tooling như trước. VPS hiện vẫn chạy image/code trước refactor; lượt này không restart/deploy hay thay secret/profile. Scheduled Task tunnel và cổng không đổi.

> **07/10 — gọi thoại chuyển VPS:** `x3-zalo-team-call-call-1`, image `x3-zalo-team-call:local`, chạy độc lập trên 14.225.198.183 bằng `compose.call-vps.yml`/`call.vps.env`, restart unless-stopped, healthcheck, giới hạn 384 MiB/1 CPU. API chỉ publish loopback 9260; UDP WebRTC 41000–41031 public. Gateway dùng mạng riêng `x3-zalo-team-web_default` tới connector. Dev tunnel thêm 9262 → VPS 9260; `.env.local` tắt autostart, gateway Windows đã dừng. Chrome WAN synthetic Opus roundtrip đạt; chưa gọi thật/nghiệm thu 5G hoặc mạng chặn UDP. Không thay đổi CRM production/Tiny House.

Vận hành gateway hiện tại từ `/opt/x3-zalo-team/tooling/zalo-team/service`:

```sh
docker compose --env-file call.vps.env -f compose.call-vps.yml up -d --build call
docker compose --env-file call.vps.env -f compose.call-vps.yml logs --tail 50 call
curl -fsS http://127.0.0.1:9260/health
```

Khi deploy toàn bộ frontend Zalo trên VPS, dùng `compose.yml` + `compose.call.yml` (gateway cùng mạng, `http://call:9260`) và dừng gateway standalone sau khi kiểm tra không có cuộc gọi (`busy=false`), tránh tranh UDP ports. Browser production cần HTTPS để xin quyền micro. Hiện một gateway nhận một cuộc gọi tại một thời điểm; chưa có TURN dự phòng cho mạng chặn UDP. Khóa gọi nằm trong `secrets/call-token`, không đưa vào frontend/browser/image.

> **07/10 — cập nhật Web connector:** đã liên kết 1 tài khoản mới sau dọn. Bổ sung mã lỗi/log an toàn cho danh sách, rebuild riêng x3-zalo-team-web-connector; API trả connected/3 hội thoại/error=null và UI tải lại được. Profile, kho, Drive, CRM và Tiny House giữ nguyên. Tag rollback before-inbox-20261007. Mốc 0 tài khoản phía dưới là trước khi người dùng liên kết mới.

> **07/10 — hiện trạng sau dọn test:** hai liên kết Zalo cũ và toàn bộ kho/backup/profile Team của chúng đã xóa theo yêu cầu; archive DB/tệp về 0. VPS giải phóng 17,9 GiB, còn dùng khoảng 13 GiB. Drive chuyển dữ liệu test vào thùng rác; kho mới trống `120YB-3_XyDDR7Euo-xDXpz8Tjhkid4Ut`, kết nối Contributor đã kiểm tra. Giữ image Drive hiện hành, schema, secrets, CRM, Tiny House và file xuất gốc. Các mốc dưới là lịch sử trước khi dọn.

> **07/10 — hiện tại, Drive:** API/sync/backup + 8 worker Drive dùng `x3-zalo-team-api:drive-storage-20261007` (`local`), manifest `sha256:5107761bd95220cf3b77af1aba2db15dbefa19a7111b3fa403d59ba1f5bce300`. Compose phải ghép `compose.vps-local.yml` và `compose.drive.yml` để giữ secret mount. Đã xác minh upload/cold download/backup mã hóa với Drive thật. Theo yêu cầu không chuyển toàn bộ test: hai account test được bỏ qua, 521 object đã verified, 2.005 lượt deferred. Kho/backup test giữ trên VPS, chưa giải phóng toàn bộ. Tài khoản mới và backup mới tự chuyển; cache mục tiêu 5 GiB, chỉ dọn bản local đã verified. Tiny House/CRM giữ nguyên. Runbook: `tooling/zalo-team/service/DRIVE.md`; nhật ký chi tiết README.ZALO-TEAM.md. Các mốc bên dưới là lịch sử.

> **07/10 — hiện tại, sửa gián đoạn nhập file:** API/sync dùng `x3-zalo-team-api:file-native-priority-20261007`/`local`. API tối đa 4 CPU/3 GiB, FPM 6 children; libjxl native xử lý ảnh trên VPS (2 slot, mỗi decoder 2 thread/512 MiB/30 giây). Sync nhường lượt nhập bằng lease owner 120 giây. Client tự chờ 409/lỗi tạm, giữ cursor/batch. DB, backup, Web profile, CRM và Tiny House giữ nguyên. Mốc kiểm tra 11.075 tin, 1.446 blob/1.017.875.968 byte, 0 sai SHA-256; sau đó 691 preview native/0 lỗi. Hàng đợi đang nhập, chưa hoàn tất 29,69 GB. Những đoạn dưới là mốc lịch sử; xem nhật ký mới nhất README.ZALO-TEAM.md.

> **07/10 — cập nhật truyền theo nhóm:** API đang dùng `x3-zalo-team-api:file-pack-20261007` (tag local), đã bổ sung file-plan/upload-pack với stream và SHA-256, không đổi DB/worker/CRM/Tiny House. UI local bỏ trần thử 9,5 GB mặc định; giữ lựa chọn giới hạn tự đặt. Mốc đối soát sau thử Dừng: 2.120 tin, 276 blob duy nhất, 183.076.440 byte, 0 sai checksum. Hàng đợi 517 hội thoại còn đang nhập; chưa xác minh toàn bộ file 29,69 GB. Các số liệu ở đoạn sau là mốc thử ban đầu, không phải số liệu hiện tại. Xem nhật ký mới nhất README.ZALO-TEAM.md.

> **07/10 — cập nhật sau reset kho:** đã xóa kho/backup Team cũ và dữ liệu nhập PC tạm theo xác nhận của người dùng; giữ Web profile, CRM và Tiny House. Luồng mới Nhập từ file đọc .zl.zip tại Windows và truyền từng đợt lên VPS. Đã thử 620 tin/72 blob, nhập lại không trùng, tổng truyền khoảng 4,3 MB. File gốc 29,69 GB giữ nguyên; chưa nhập toàn bộ. Những số liệu cutover/backup trước ngày này bên dưới chỉ là lịch sử và không còn là bản dữ liệu hiện có. Hiện kho thử khoảng 4,1 MB; toàn ổ VPS dùng khoảng 13 GiB, còn 84 GiB (gồm OS/Docker/profile). API image x3-zalo-team-api:file-import-20261007 (tag local), Web connector đã build lại; sync/backup đã khởi động, enabled=false và daily_backup=false. Xem nhật ký mới nhất trong README.ZALO-TEAM.md.

> 07/10/2026: **Zalo Team Web, database kho, API, worker đồng bộ và sao lưu** tiếp tục chạy tại `/opt/x3-zalo-team`. `/zalo-team` mở trong CRM local qua SSH tunnel. Kiểm tra hiện tại thấy Tiny House đã được triển khai lại và đang chạy; không áp dụng biên bản dọn cũ cho các dịch vụ đang hoạt động.

Tài liệu riêng để làm việc với VPS mới. Cập nhật sau mỗi thay đổi vận hành đã thực hiện.
Luồng và chức năng Zalo tiếp tục được quản lý trong [README.ZALO.md](README.ZALO.md).

## Hiện trạng triển khai Zalo Team — cập nhật 07/10/2026

- 07/10 (chi tiết tệp theo ngày): triển khai API chỉ đọc `day-file-issues`, bổ sung `ZaloTeamArchiveReport.php` và `ZaloTeamArchiveController.php` vào image hiện hành; image mới `x3-zalo-team-api:day-files-20261007` đồng thời gắn tag `local`. Chỉ recreate `api`, health đạt và Chrome local đọc đúng hai tệp của ngày 07/10. Không migration hay restart sync/backup/database/Web/Tiny House. Image trước vẫn dùng bởi worker và có tag `before-day-files-20261007` để quay lại khi cần; không chứa bản sao dữ liệu kho.

- Bổ sung 07/10: task tunnel lại kết thúc với `0xC000013A` sau lượt kiểm tra đầu; đã phục hồi và thêm trigger `X3ZaloRecovery` mỗi phút, `StartWhenAvailable`, giữ `IgnoreNew` và trigger đăng nhập. Khi watcher còn chạy không mở thêm SSH; khi toàn bộ watcher bị ngắt thì không phải chờ lần đăng nhập tiếp theo. Chưa xác định nguồn tín hiệu ngắt và chưa thử khởi động lại Windows. Backend dev cũng tự bật bộ nhập PC local (không chuyển bộ đọc PC lên VPS).

- 07/10: backend 4000/frontend 3000 hoạt động nhưng tunnel 9250/9340 vắng; task `X3 Zalo VPS Tunnel` ở Ready, lần trước kết thúc `0xC000013A`. API/Web/DB trên VPS vẫn hoạt động. Đã sửa action task sang đường dẫn PowerShell tuyệt đối, `-NonInteractive`, working directory repo; script xử lý abandoned mutex. Chưa xác định nguyên nhân tác vụ cũ bị ngắt.
- Dev frontend (`predev`) và backend (`dev-backend.cmd`) gọi `service/ensure-tunnel.cjs`: chỉ Windows và cấu hình local VPS 9340; kiểm tra hai cổng cùng health API, khởi động task hoặc watcher ẩn nếu cần. Có giới hạn thời gian, không cản CRM nếu VPS chưa tới được, không khởi động Docker Web local. Đã kiểm thử ngắt đúng tunnel local 40 giây rồi phục hồi bằng helper: task Running, 9250/9340 cùng một PID SSH, reverse 9341 lắng nghe trên VPS, API health ok và giao diện tải lại được. Chưa kiểm thử đăng xuất/đăng nhập Windows thực tế.

- Đã dọn các gói migration đã dùng xong tại root triển khai (storage.tar, profiles.tar, database.jsonl, code.tar, metrics-code.tar), Docker build cache và apt download cache theo yêu cầu tiết kiệm dung lượng. Giảm khoảng 33,1 → 19,2 GiB. Không xóa Docker volume/image đang chạy hoặc backup hợp lệ. Tab Server đã tách cả Docker/cache, gói tạm và hệ điều hành. Sau mỗi lần triển khai, kiểm chứng rồi dọn gói chuyển và cache không dùng; không tự xóa kho hoặc backup.

- Giám sát tài nguyên đã bật: systemd `x3-zalo-metrics.service`; bản đang ghi nhận trên VPS dùng script `tooling/zalo-team/service/server-metrics.py`, snapshot/lịch sử tại `/opt/x3-zalo-team/metrics/server.json`. CPU/RAM/disk/Docker mỗi 30 giây, du kho mỗi 5 phút; giữ tối đa 24 giờ. API chỉ mount snapshot read-only; xem tại Đồng bộ & sao lưu → Server bằng tài khoản quản trị. Collector tự khởi động theo OS, giới hạn 128 MiB RAM/20% CPU. Kiểm tra: `systemctl status x3-zalo-metrics`, `journalctl -u x3-zalo-metrics --since -10min`. Không thay đổi worker backup khi cập nhật API.
- **09/10 — source local, chưa deploy:** đợt A chuyển collector/test sang `apps/backend/integrations/zalo/metrics/`; unit trong tooling trỏ đường dẫn mới. Lần cập nhật metrics sau phải chuyển runtime mới lên VPS trước khi cài/reload unit; không xóa snapshot hoặc restart các dịch vụ khác. VPS hiện hành không bị thay đổi trong cleanup local.

- Docker Web `x3-zalo-team-web-connector-1` chạy trên VPS; hai account ID 1 và 3 kết nối thành công với profile cũ. Container Web local đã dừng để tránh chạy trùng phiên.
- Stack `tooling/zalo-team/service/compose.vps-local.yml`: PostgreSQL riêng, PHP API, Nginx, worker sync và backup. Frontend và xác thực CRM vẫn chạy local; chưa chuyển CRM production hoặc DNS.
- Kho tệp: `/opt/x3-zalo-team/data/archive`. Backup mã hóa: `/opt/x3-zalo-team/data/backups`. PostgreSQL: volume `x3-zalo-team-service_database`; profile Web: `x3-zalo-team-web_web_profiles`.
- Chuyển 17 bảng `zt_*` và tham chiếu identity tối thiểu; không chuyển dữ liệu nghiệp vụ CRM. Snapshot có 38.623 nội dung, 38.683 quan sát, 9.632 asset, 176 nguồn. Đã so sánh từng dòng sau nhập, trước mở ghi.
- **12.520 tệp / 10.161.920.905 byte** đã đối soát SHA-256 đầy đủ. Bảy backup cũ giải mã/verify thành công. Hai backup mới trên VPS đã `ready` và có `verified_at`; bản tạo bằng nút giao diện lúc 10:24:29 được xác minh lúc **10:31:15, 05/10/2026**. Nguồn hết hạn/chưa lưu từ trước vẫn được giữ đúng trạng thái, không biến thành tệp đã lưu do chuyển máy.
- API 512 MiB, sync 256 MiB, backup 384 MiB, database 512 MiB, Nginx 64 MiB, connector 2 GiB. Backup giới hạn PHP 256 MiB / CPU 1; đo khoảng 170–206 MiB khi kiểm tra kho thật. Sau dọn gói chuyển dữ liệu/build cache ngày 05/10: đĩa dùng ~19,22 GiB, còn ~77,49 GiB; kho và backup đang chạy giữ nguyên.
- Chỉ SSH 22 lắng nghe public. Cổng 9250, 9340, 9341, 9343, 5544 chỉ bind `127.0.0.1`. Quản trị dùng khóa riêng tại `tooling/deployment/.work/zalo-vps/id_ed25519`, kiểm tra host key nghiêm ngặt; không ghi khóa/token vào tài liệu.
- Người dùng đã xác nhận cho phép tunnel tự nối khi đăng nhập Windows. Task **X3 Zalo VPS Tunnel** gọi `tooling/zalo-team/service/tunnel.ps1 -Watch`; có mutex chống chạy trùng, keepalive và tự nối lại. Chạy thủ công: `npm run dev:zalo-vps`. Log trong `tooling/deployment/.work/zalo-vps/tunnel.log`.
- Tunnel local 9250 → Web, 9340 → API kho; reverse VPS 9341 → CRM local 4000. **Worker hiện cần CRM local và tunnel hoạt động để xác minh quyền**. Khi máy local tắt, Web trên VPS vẫn chạy nhưng worker không được bỏ qua bước xác thực; chưa phải cấu hình độc lập 24/7. Cần chuyển địa chỉ xác thực sang CRM production trong lần triển khai production được cho phép tiếp theo.
- Nhập Zalo PC vẫn đọc từ Windows. Bridge mới chuyển bundle theo luồng lên VPS, kiểm tra hash/kích thước, resume và nhập chống trùng. Đã thử HTTP truyền 9 MiB, xác thực/quyền và catalog thật; chưa chạy lại một lượt xuất/nhập Zalo PC thật hoàn chỉnh sau cutover. Gọi thoại trên VPS chưa nghiệm thu trong lượt này.
- Sau yêu cầu dọn local ngày 05/10, đã xóa hai kho archive/backups và ba bundle PC (11.067.942.965 byte), sau khi đối soát hash. Theo xác nhận tiếp theo của người dùng rằng đây là dữ liệu test, đã xóa vĩnh viễn cả ba bundle PC và bản tar tại `/opt/x3-zalo-team/recovery/local-pc-20261005` (khoảng 1,7 GiB); không còn giữ bản phục hồi này. Local chỉ giữ 10 KB trạng thái PC cùng lock/heartbeat; snapshot DB và gói migration ở tooling vẫn còn. Chưa có bản dự phòng độc lập ngoài VPS; không gọi volume hoặc gói tar cùng VPS là dự phòng độc lập. Rollback phải dừng ghi và đối soát phần mới phát sinh trước khi bật lại nguồn cũ.

Vận hành và lệnh kiểm tra: `tooling/zalo-team/service/README.md`. Các mục bên dưới ghi lại lịch sử, không thay thế hiện trạng này.

## Biên bản dọn VPS trước triển khai — 05/10/2026

- Người dùng xác nhận xóa toàn bộ ứng dụng/database/Docker/file/bản sao lưu dự án, giữ hệ điều hành, SSH và tài khoản quản trị. Sau khi kiểm kê phát hiện Tiny House đang chạy, đã hỏi riêng và người dùng xác nhận **xóa cả Tiny House và Zalo**.
- Đã dừng/xóa 4 container: tinyhouse-tunnel-1, tinyhouse-app-1, tinyhouse-db-1 và x3crm-zalo-local-desktop; dừng/vô hiệu hóa rồi xóa x3-zalo-gateway, x3-zalo-backend-relay, tinyhouse-backup.service/timer.
- Đã xóa /opt/tinyhouse và /opt/x3crm-zalo, gồm PostgreSQL, uploads, releases, profile Zalo, secrets ứng dụng và toàn bộ backup trong hai cây thư mục. Tiny House trên VPS này đã ngừng hoạt động.
- Đã purge 6 gói Docker/containerd/Compose/Buildx và xóa dữ liệu image/container/build cache, cấu hình Docker/containerd và nguồn apt/key Docker. Không chạy autoremove các gói hệ điều hành khác.
- Đối soát sau xóa bằng **phiên SSH mới**: root đăng nhập được, ssh.service active; không còn các đường dẫn dữ liệu/dịch vụ nêu trên hoặc binary docker; /opt, /srv, /home rỗng. Chỉ cổng TCP 22 lắng nghe tại thời điểm kiểm tra.
- Đĩa root 97G: dùng khoảng **25G → 2.9G**, còn **94G**. RAM tổng 15Gi, dùng 399Mi, available 14Gi tại thời điểm kiểm tra.
- Không cài lại OS, không thay mật khẩu/khóa SSH/tài khoản quản trị; không sửa DNS hoặc tài khoản Cloudflare bên ngoài VPS. Không xóa dữ liệu/bản sao lưu trên máy local hay server CRM 45.252.251.120.
- Mật khẩu người dùng cung cấp chỉ dùng tạm để xác thực SSH; không ghi vào tài liệu, Git hay file credential local. Dữ liệu đã xóa theo thao tác filesystem thông thường, không phải cam kết xóa an toàn mọi block của ổ đĩa.

Các mục bên dưới là **biên bản lịch sử trước lần dọn này**, không mô tả runtime đang chạy.

## 1. Phạm vi lần chuẩn bị 30/09/2026 (lịch sử)

- Người dùng đã cho phép chuẩn bị môi trường và chuyển Zalo khỏi Docker trên máy tính ngày 30/09/2026.
- Phạm vi chuyển: Zalo PC/Wine và gateway lên VPS; giữ kiến trúc R62, dùng Docker Engine trên Ubuntu server.
- CRM frontend, API và PostgreSQL vẫn chạy local trong giai đoạn này; chưa chuyển production CRM hay DNS.
- Trạng thái nghiệm thu chuyển máy được ghi ở mục 7; không suy từ việc sao chép file thành ứng dụng hoạt động.
- Server thực tế đang chạy Ubuntu, không phải Windows. Chưa có thao tác cài lại hệ điều hành.

## 2. Thông tin truy cập

| Mục | Giá trị |
|---|---|
| Nhà cung cấp | Vietnix |
| IPv4 | `14.225.198.183` |
| Hostname | `x3sales-ftwn` |
| Giao thức | SSH |
| Cổng | `22` |
| Tài khoản hiện tại | `root` |
| Xác thực hiện tại | Mật khẩu do chủ server cung cấp, không lưu trong tài liệu/Git |

Đăng nhập thủ công:

```powershell
ssh -p 22 root@14.225.198.183
```

Nhập mật khẩu tại lời nhắc SSH; không đưa mật khẩu vào tham số lệnh, script hay log.

Khóa máy chủ ED25519 ghi nhận ở lần kết nối đầu:

```text
SHA256:Rcl+Nr9TNjnruKb4P94TpwWgRlMdd61Nbs0+pX0zuio
```

Lần đầu dùng cơ chế trust-on-first-use, chưa đối chiếu fingerprint qua console Vietnix.
File known_hosts riêng của lần kiểm tra nằm tại
`tooling/deployment/.work/server/known_hosts` (được Git bỏ qua).
Nếu khóa máy chủ thay đổi, xác minh nguyên nhân trước khi cập nhật; không tắt kiểm tra khóa.

## 3. Hiện trạng đã kiểm tra trực tiếp

Thời điểm: **30/09/2026, khoảng 19:55, Asia/Ho_Chi_Minh**. Số liệu RAM/đĩa là ảnh chụp tại thời điểm kiểm tra.

| Thành phần | Kết quả |
|---|---|
| Hệ điều hành | Ubuntu 22.04.5 LTS, x86_64 |
| Kernel | `5.15.0-168-generic` |
| Ảo hóa | KVM |
| CPU | 10 vCPU, Intel Xeon E5-2690 v4 @ 2.60 GHz |
| RAM | `free -h`: tổng khoảng 15 GiB, dùng 288 MiB, available khoảng 15 GiB |
| Swap | Chưa có, 0 B |
| Ổ root | `/dev/vda1`, ext4, khoảng 97 GiB; dùng 2.5 GiB, còn khoảng 95 GiB |
| Múi giờ | `Asia/Ho_Chi_Minh` |
| Đồng bộ giờ | NTP active, system clock synchronized |
| SSH | Dịch vụ active; TCP 22 lắng nghe trên IPv4/IPv6 |
| Docker, Node, PHP, Nginx | Chưa tìm thấy bằng `command -v`; dịch vụ Docker/Nginx không active |
| UFW | Dịch vụ không active; chưa kiểm tra toàn bộ ruleset hoặc firewall nhà cung cấp |
| Cổng TCP lắng nghe | Lần kiểm tra chỉ thấy 22 |
| CRM/Zalo trên VPS | Chưa triển khai trong phiên làm việc này |

Đây chưa phải kết quả benchmark CPU, mạng hoặc khả năng chạy nhiều tài khoản Zalo.

## 4. Tránh nhầm với production cũ

`tooling/deployment/deploy-production.ps1` hiện mặc định dùng server **45.252.251.120**,
thư mục `/opt/x3crm`, URL `https://crm.x3sales.com`.

Không chạy script đó với giả định nó đã trỏ sang VPS mới. Chưa thay mặc định production,
chưa xác minh server cũ trong phiên này và chưa có lệnh chuyển production sang IP mới.

## 5. Trình tự chuyển production (chưa thực hiện)

1. Chốt VPS chạy riêng Zalo hay cả CRM, hệ điều hành và domain truy cập.
2. Chuẩn bị cấu hình riêng cho IP mới; xác định phiên bản, đường dẫn dữ liệu và bản rollback.
3. Thiết lập truy cập quản trị, HTTPS và phạm vi cổng theo kiến trúc được chốt.
4. Sao lưu dữ liệu local trước khi chuyển; không đồng thời khởi chạy cùng profile Zalo ở hai nơi.
5. Khi có lệnh triển khai: dựng bản thử, kiểm tra đăng nhập, nhiều tài khoản, lưu file và hành vi khi mất kết nối.
6. Đo hiệu năng thực tế trước khi tăng số tài khoản hoặc chuyển sử dụng chính thức.

## 6. Nhật ký

- **30/09/2026 19:55 +07:** kết nối SSH thành công; ghi nhận hệ điều hành, CPU, RAM,
  ổ đĩa, múi giờ, dịch vụ và fingerprint. Không thay cấu hình server hay dữ liệu ứng dụng.

## 7. Runtime Zalo cũ — đã ngừng dùng

Bộ Wine/bridge ngày 30/09 đã ngừng dùng. Ngày 07/10 đã gỡ source/test cũ khỏi workspace; không chạy lại lệnh viewer/systemd của luồng đó. Nhật ký cũ được giữ local tại `.local/cleanup-recovery/README.SERVER.legacy-runtime.md`.

Triển khai hiện hành dùng `tooling/zalo-team/service/` và source `apps/backend/integrations/zalo/`. Docker loại unit test khỏi image. Lượt dọn này chỉ thay đổi local, chưa deploy/restart VPS; giữ CRM, Tiny House và toàn bộ dữ liệu/khóa dịch vụ.

## Local dùng chung kho Zalo sau cutover (08/10/2026)

- Production: API kho 9340 → CRM identity 9342. Không đổi tuyến này khi phát triển local.
- Local: tunnel 127.0.0.1:9345 → VPS 127.0.0.1:9345; `compose.dev-client.yml` chạy riêng API, cùng database/volume, identity cố định 9341 → Windows 4000. Chỉ dùng được khi backend local và tunnel đang chạy. Không có thêm sync/backup/Drive worker.
- FE `ZALO_TEAM_API_URL` và BE `ZALO_TEAM_REMOTE_API_URL` local dùng `http://127.0.0.1:9345/api`. `npm run dev:frontend` phát hiện đúng dev server đang chạy và không mở thêm tiến trình chiếm cổng 3000.
- Triển khai API local riêng: tại `/opt/x3-zalo-team/tooling/zalo-team/service`, chạy `docker compose -f compose.dev-client.yml up -d --no-build`. Image dùng `x3-zalo-team-api:local`; khi nâng API image cần chủ động cập nhật cả API local riêng. Không chạy lệnh này để thay API production/connector.
