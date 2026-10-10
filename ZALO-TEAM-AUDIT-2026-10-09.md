# Zalo Team — Rà soát chuyên sâu và lộ trình nâng cấp cho X3Sales

**CRM → Zalo — 09/10:** đợt 1 local đã có cấu hình một nhóm nhận chính theo dự án/khách hàng, gửi PDF/ảnh báo phí và báo cáo đã duyệt, lịch sử từng phần và kiểm tra biên nhận. 33 checks cô lập + regression chiến dịch + TypeScript đạt. Chi tiết tại README.ZALO-CRM.md. Không gửi thử vào nhóm thật, không deploy VPS; thông báo thanh toán/tự động báo cáo vẫn ở đợt sau.

**Checkpoint UI/logic D — 09/10:** đã tinh gọn local panel hội thoại, board, tạo/sửa việc, ghi chú; dùng chung trạng thái/menu/nhân sự. Kiểm tra quyền chọn người nhận, nút sửa sau thu hồi quyền và bộ đếm vượt 50 việc. 125 checks + hai cổng query đạt, kiểm tra trình duyệt desktop và màn hình nhỏ. Hướng dẫn/chi tiết kiểm chứng tại README.ZALO-TEAM.md. Chưa deploy D lên VPS/nghiệm thu đa nhân sự.

**Ngày rà soát:** 09/10/2026 · **Cập nhật:** đã thực hiện A và triển khai source B trên local; xem hai mục kết quả dưới đây. B còn cổng đo tải/canary; C–E là đề xuất. Các phần audit 1–13 giữ căn cứ tại thời điểm trước sửa, không thay thế kết quả mới.

**Mục tiêu:** dọn đúng phần không còn dùng → làm ổn định, nhẹ và nhanh → bổ sung nghiệp vụ cộng tác thực sự phục vụ X3Sales.

## 0. Kết quả đợt A — 09/10/2026

**Đã làm trên local:**

- Lưu snapshot nguồn và SHA-256 trước sửa trong `.local/cleanup-recovery/phase-a-2026-10-09T06-49-14-385Z/`; có manifest đối chiếu, không sao chép dữ liệu khách hàng/secret/runtime state.
- Gỡ 6 module frontend CLN-01 đến CLN-06; không có consumer static/dynamic theo kiểm tra tham chiếu. Gỡ 21 nhánh selector CSS thuộc 8 class chỉ còn dùng bởi các module này.
- Gỡ `tooling/zalo-team/pc/ensure-worker.cjs`, `worker-status.php`, `tooling/development/dev-zalo-pc.cmd` và npm `dev:zalo-pc`: đây là launcher/probe của worker đã nghỉ. Tổng 9 file nguồn cũ được gỡ, khoảng 1.290 dòng kể cả dòng trống.
- Giữ Artisan `zalo-team:pc-worker` thông báo đã nghỉ và route PC trả 410; giữ `zalo:pc` phục vụ xuất/đối chiếu quản trị, nhánh call Windows còn được cấu hình tham chiếu, service nhập file/recovery và test trọng yếu.
- Chuyển collector và test metrics về `apps/backend/integrations/zalo/metrics/`; cập nhật đường dẫn unit systemd và kiểm thử cấu trúc. Logic collector và đường dẫn snapshot giữ nguyên.
- Tách `TeamManagementLayout` dùng chung cho Tài khoản, Chiến dịch, Đồng bộ & sao lưu. Giữ cấu trúc DOM, CSS theo màn, quyền hiển thị và handler nghiệp vụ.
- README Team có bảng hiện trạng local/production/capability; hướng dẫn cũ đưa vào phần lịch sử thu gọn, sửa “Bước tiếp theo” đã lỗi thời. Cập nhật command map và runbook metrics.

**Kiểm chứng sau sửa:**

| Kiểm tra | Kết quả |
|---|---|
| TypeScript frontend | Đạt |
| Offline Zalo suite | 322 đạt, 0 lỗi, 1 skip; chạy ngoài giới hạn sandbox Windows để hỗ trợ hard-link/UDP fixture |
| Metrics Python | 7/7 đạt |
| Build production Docker | Đạt từ 465 file đầu vào sạch; `npm ci --ignore-scripts`, không copy `.env`, `.next`, node_modules hoặc dữ liệu local |
| Khởi động standalone | Đạt health trong container `--network none`, không mở cổng host; container tự xóa sau kiểm tra |
| UI local Chrome | Tài khoản, danh sách/tạo chiến dịch, Đồng bộ & sao lưu hiển thị đúng khung sau refactor; không tạo/chạy chiến dịch, đổi tài khoản hay dữ liệu |

Image kiểm tra có manifest digest `sha256:31882add4d97f314449d64fd9629e9f95f55eb7216bf65900345a4cbc798e32f`; đã gỡ đúng image thử sau smoke test, không prune cache/volume dùng chung. Log: `.local/phase-a-build.log`, `.local/phase-a-tests.log`; manifest thay đổi: `.local/phase-a-changes.json`. Snapshot build là nguồn sạch được xuất từ working tree, **không phải bằng chứng Git clone sạch đã chứa đủ file**; nhiều file Zalo vẫn untracked như trước, chưa tự tạo commit/gộp thay đổi CRM.

First Load JS từ build này để làm mốc cho B: inbox 406 kB, accounts 216 kB, archive 351 kB, campaigns 348 kB, contacts 238 kB. Đây là số build báo, không phải thời gian tải đo trên mạng. Build có khuyến nghị `sharp` cho tối ưu ảnh production; chưa thêm dependency trong cleanup A.

**Ranh giới:** chưa deploy/restart VPS, chưa đổi runtime đang chạy, dữ liệu/khóa/profile/quyền giữ nguyên. Khi deploy metrics lần sau cần đưa file backend mới lên trước khi cài unit mới. Chưa làm tối ưu query/render hoặc nâng cấp nghiệp vụ của B–E. Cổng commit/release có thể tái tạo bằng Git và nghiệm thu production vẫn phải hoàn thành trước phát hành.

## 0B. Kết quả đợt B — 09/10/2026

**Trạng thái:** đã triển khai và kiểm chứng mã nguồn local. Chưa deploy/restart API, connector, worker hoặc frontend VPS. Local tiếp tục đọc kho thật qua API dev 9345, vì vậy kiểm tra UI hiện tại còn dùng backend phiên bản cũ; frontend có tương thích ngược. Không chạy/gửi lại chiến dịch, gọi điện, tải lại kho Drive hoặc xóa dữ liệu thật.

### Thay đổi

- `request.ts`: log dev bổ sung queue/total duration, status, bytes, aborted; không ghi nội dung hoặc thông tin đăng nhập. Giữ điều phối request, retry, identity và hidden/offline policy hiện có.
- Archive status nhận `view=sync/storage/backup`; bỏ tính các phần không dùng trên tab. Chi tiết tệp lỗi chỉ tải khi mở (`includeIssues`), có hủy yêu cầu cũ khi đổi tab/đóng chi tiết. Đường `full` cũ còn tương thích.
- Summary dùng aggregate SQL và `EXISTS` quan sát có quyền, tránh chuyển toàn bộ hash/message ID sang PHP. Phạm vi owner/account/deleted giữ nguyên; collation `C` trên PostgreSQL chỉ áp dụng ID/hash bất biến, không áp dụng tên tiếng Việt.
- Ngày lưu trữ phân trang 14 mục, lọc tài khoản/ngày trên server; chỉ truy vấn media trong khoảng ngày của trang, không tải danh sách hội thoại chi tiết trước khi mở. Backend cũ vẫn dùng fallback phân trang frontend.
- Tìm hội thoại lưu trữ gom tin mới nhất/avatar theo batch, giữ tìm có/không dấu. Vẫn quét tên theo cursor ở PHP để giữ ngữ nghĩa chuẩn hóa hiện hành; chưa bổ sung index tên chuẩn hóa.
- Metadata media gom kiểm tra file local và bản Drive đã xác minh theo batch tối đa 500 ID/query; kiểm tra hash/bytes/state/owner. Không hydrate/download file trong lượt đọc metadata, không dùng cache toàn cục có nguy cơ lẫn quyền.
- Chiến dịch phân trang/tìm/lọc trên server, 25 mục/trang, thứ tự `created_at DESC, id DESC`; đếm đúng sau lọc ACL/origin/người tạo hoặc quản lý. API cũ giữ giới hạn cũ cho caller chưa opt-in. Không sửa retry/gửi/receipt của worker.
- Inbox và danh bạ dùng [TanStack Virtual](https://tanstack.com/virtual/latest/docs/api/virtualizer) 3.14.13 khi trên 80 mục: dựng vùng nhìn thấy + 6 hàng đệm, đo chiều cao thật, giữ hàng có menu/focus, Home/End/lên/xuống/Tab. Timeline tin nhắn chưa đổi. Payload directory chưa phân trang; lợi ích ở DOM/render.

### Số đo trước/sau trên cùng dữ liệu

PHP 8.4.4 CLI, SQLite trong RAM, 100 hội thoại/1.200 tin/1.200 asset/120 ngày. Mỗi đường gọi warm-up một lần rồi 7 mẫu; p95 trong bảng là mẫu lớn nhất của 7 lượt, chỉ là chỉ báo kỹ thuật, chưa phải phân vị tải thực. Cả hai lượt dùng cùng fixture/ANALYZE/runtime; baseline nạp đúng ba service archive từ snapshot trước B.

| Đường đọc | Query trước → sau | Trung vị trước → sau | p95 mẫu trước → sau |
|---|---:|---:|---:|
| Status đầy đủ, tương thích cũ | 54 → 14 | 33,31 → 8,25 ms | 37,35 → 8,46 ms |
| Toàn bộ ngày, tương thích cũ | 6 → 6 | 11,05 → 9,59 ms | 11,23 → 9,88 ms |
| Tìm 50 hội thoại | 101 → 3 | 10,46 → 5,48 ms | 10,89 → 5,68 ms |
| Metadata 12 tin có tệp | 19 → 4 | 3,26 → 1,26 ms | 3,45 → 1,34 ms |

Đường mới: sync 4 query/3,01 ms trung vị; backup 3/0,49 ms; storage 6/5,97 ms. Trang 14 ngày trả 2.965 byte thay 24.853 byte cho 120 ngày, trung vị 4,87 ms; có thêm query đếm tổng để phân trang đúng. Status sync trả 17.308 byte thay 54.560 byte đầy đủ. Không diễn giải các thời gian này thành độ trễ HTTP thực hoặc tải Drive.

### PostgreSQL và giới hạn ngân sách

PostgreSQL 17 trong Docker local, loopback riêng, dữ liệu tmpfs giả lập 1.000 hội thoại/100.000 tin/100.000 asset/120 ngày; cùng cách warm-up + 7 mẫu. Chưa có sync/Drive/người dùng đồng thời và chưa gồm xác thực, connector, HTTP hay mạng VPS.

| Đường mới | Query | Trung vị | p95 mẫu |
|---|---:|---:|---:|
| Đồng bộ | 4 | 96,73 ms | 131,40 ms |
| Sao lưu | 3 | 69,57 ms | 79,07 ms |
| Lưu trữ/dung lượng | 6 | 474,00 ms | 513,46 ms |
| Trang 14 ngày | 7 | 349,67 ms | 426,73 ms |
| Tìm 50 hội thoại | 3 | 102,42 ms | 141,50 ms |
| Metadata 50 tin | 4 | 22,83 ms | 34,46 ms |

**Chưa đạt toàn bộ ngân sách B:** thống kê dung lượng còn vượt mục tiêu 300 ms ở lượt đo 100.000 asset. Lượt trace riêng dao động khoảng 248 ms nhưng không dùng lượt nhanh này thay kết quả 7 mẫu. Phần tốn chính là tổng dung lượng theo hash có quyền và đếm tin distinct. Khi triển khai canary cần đo với cache/tải thật trước khi quyết định bảng aggregate tăng dần hoặc cache theo scope có invalidation; không cache quyền bừa để đạt số đẹp. Baseline SQLite lớn bị dừng vì quá lâu, không có kết quả đối chứng hoàn chỉnh nên không công bố tỷ lệ tăng tốc trên dataset 100.000.

### Kiểm chứng và đầu ra

- TypeScript đạt; suite offline Node **322 đạt, 0 lỗi, 1 skip**. PHP campaigns **61 kiểm tra đạt**, có 121 chiến dịch mới, phân trang ổn định, tìm literal `%/_`, user chỉ xem, creator/leader/admin và origin cách ly.
- Read regression **40 kiểm tra đạt trên SQLite và 40 trên PostgreSQL**: phạm vi owner/account, không quyền, source không khớp, tiếng Việt, đủ ngày/không trùng trang, summary không đổi, lỗi tệp tải khi cần, blob trùng, checksum/size/state Drive và query budget.
- Chrome local: bạn bè 260 → 16 hàng DOM; nhóm 578 → 17; inbox 235 → 17 trong viewport đã đo. Kiểm tra Home/End, menu/Escape, tìm nhóm, chuyển Tất cả/Lưu trữ; kho 607 ngày hiển thị 14/trang và chuyển trang đúng. Đây là giảm DOM, chưa phải số INP/heap/FPS.
- Có cảnh báo MUI DatePicker về props cũ và Fast Refresh khi chỉnh source trong mẫu console; không ghi nhận lỗi JS trong các thao tác đọc đã thử. Chưa gọi đây là nghiệm thu toàn bộ UI hoặc Zalo PC.
- Build Docker production từ 1.166 file đầu vào sạch đạt, `npm ci --ignore-scripts`, không đưa `.env`/node_modules/`.next` local hoặc dữ liệu khách vào image. Standalone health đạt trong container không mạng/không mở cổng host; image manifest `sha256:3af7bc91beec973e1425b894a2f37d75df5b7cd5fe83116be0e23533100b139f`. Đã dừng/xóa container PostgreSQL tmpfs và gỡ đúng image kiểm thử; không prune volume/cache chung.
- First Load JS: inbox **415 kB** (A: 406), contacts **247 kB** (A: 238), archive **352 kB** (A: 351), campaigns **348 kB**, accounts **216 kB**. Đổi khoảng 9 kB bundle cho virtualizer trên hai màn danh sách dài; không gọi giảm DOM là giảm bundle. Cảnh báo `sharp` của Next.js vẫn như đợt A.
- Màn 390 px: virtual list vẫn dựng 14/260 hàng, nhưng bố cục Danh bạ cũ giữ sidebar cạnh nội dung nên cột danh sách bị ép rất hẹp; chưa đạt nghiệm thu mobile. Không mở rộng sang đại tu responsive trong B. Đã trả viewport về kích thước ban đầu; tab Sao lưu tải đủ danh sách, không thao tác backup/restore thật.

Đối chiếu/log local: `.local/phase-b-before/manifest.json`, `phase-b-comparison-before.json`, `phase-b-comparison-after.json`, `phase-b-pg-release.json`, `phase-b-read-final.log`, `phase-b-pg-check-final.log`, `phase-b-campaigns.log`, `phase-b-tests.log`, `phase-b-build.log`. Prefix `.local/` áp dụng cho toàn bộ tên log. Không đưa log runtime/private vào source release.

Chạy lại fixture từ root (PHP có extension tương ứng):

```powershell
php -d extension=pdo_sqlite -d extension=sqlite3 tooling/tests/zalo-team-read-performance.php --optimized --check
php -d extension=pdo_sqlite -d extension=sqlite3 tooling/tests/zalo-team-campaigns.php
npm run test:zalo
```

`--baseline` chỉ dùng nếu snapshot `.local/phase-b-before/` còn đủ file; `--large` dùng 100.000 tin; PostgreSQL chỉ opt-in qua `ZT_READ_TEST_PG_PORT` tới database fixture cố định ở `127.0.0.1`, không dùng DB app/VPS. Không chạy harness trên database nghiệp vụ.

**Cổng còn lại:** gói Git/release đủ file untracked, canary backend mới, đo 1 triệu tin/nhiều người đồng thời, INP/heap và soak 4–8 giờ, quyền/revoke trên UI thực. B được ghi nhận hoàn tất phần triển khai source, chưa đóng cổng hiệu năng lớn/production. Tiếp theo là release/canary và đợt C theo quyết định người dùng.

## 1. Kết luận để quyết định

Zalo Team đã có nền tảng đáng giữ: phân quyền theo CRM, đọc/gửi hội thoại, gom nhóm bằng định danh, ghi nhận nhân viên gửi, danh bạ, thẻ chung, chiến dịch, lưu trữ và Drive. Không cần viết lại toàn bộ hoặc thay thư viện API lần nữa.

Những việc cần ưu tiên:

1. **Dọn có danh mục:** tìm thấy 6 module frontend không có nơi import trong đồ thị nguồn. Tuy nhiên, nhiều service tên `Pc*` vẫn phục vụ nhập file và khôi phục tệp; xóa cả cụm sẽ làm hỏng chức năng đang dùng.
2. **Giảm công việc mỗi lần đọc:** API trạng thái kho gom quá nhiều dữ liệu; báo cáo theo ngày quét phạm vi lịch sử rộng; tìm hội thoại lưu trữ có truy vấn lặp theo từng kết quả.
3. **Giảm số phần tử giao diện phải dựng:** inbox, danh bạ và lịch sử tin nhắn còn render danh sách bằng `.map`; chưa có cơ chế chỉ render vùng đang nhìn thấy.
4. **Hoàn thiện vận hành nhiều người:** phân trang chiến dịch, trạng thái dịch vụ theo tài khoản, đo hàng đợi, kiểm chứng thu hồi quyền và chuẩn hóa các phiên bản local/production.
5. **Bổ sung khôi phục toàn hệ thống:** backup kho hiện tại không đồng nghĩa backup đầy đủ tài khoản, phân quyền, chiến dịch và biên nhận gửi.
6. **Gọi điện có giới hạn rõ ràng:** audio gateway hiện dùng một biến phiên hoạt động toàn cục; không đáp ứng nhiều cuộc gọi đồng thời chỉ bằng cách tăng RAM.
7. **Đầu tư tiếp vào nghiệp vụ X3Sales:** người phụ trách hội thoại, bàn giao, ghi chú nội bộ, liên kết khách hàng/dự án và danh sách khách đang chờ phản hồi.

**Đề xuất thứ tự:** chốt bản nguồn có thể tái tạo → cleanup an toàn → đo và tối ưu đọc/render → diễn tập production/khôi phục → nâng cấp nghiệp vụ. Chưa nên mở rộng AI hoặc tự động hóa phức tạp trước các bước này.

## 2. Phạm vi và độ chắc chắn của kết luận

### Đã làm trong lần rà soát này

- Đối chiếu `README.md`, `README.ZALO-TEAM.md`, `README.SERVER.md` với mã nguồn hiện tại.
- Lập đồ thị import frontend; kiểm tra route, shell, API client, realtime, connector, Laravel services, worker, cấu hình Docker và backup/Drive.
- Đi qua giao diện local: inbox, danh bạ, lời mời kết bạn, lời mời nhóm, danh sách/tạo chiến dịch, liên kết tài khoản, modal phân quyền và thẻ chung. Chỉ xem, không lưu thay đổi nghiệp vụ.
- Kết hợp kiểm chứng giao diện Đồng bộ & sao lưu và chi tiết chiến dịch đã ghi ở các mốc 09/10 trong README; không coi những ghi nhận đó là kiểm thử lại mọi thao tác trong lần này.
- Áp dụng UI/UX Pro Max để rà soát mật độ, phân cấp thông tin, trạng thái, thao tác và khả năng dùng bàn phím; giữ nhận diện Zalo/X3Sales đang có.
- Chạy TypeScript và bộ kiểm thử Zalo offline; xử lý riêng các trường hợp bị sandbox Windows hạn chế. Chi tiết tại mục 12.

### Nhãn bằng chứng

| Nhãn | Ý nghĩa |
|---|---|
| **Code** | Có vị trí/hàm cụ thể trong nguồn hiện tại làm căn cứ |
| **UI local** | Đã quan sát qua trình duyệt local trong lượt audit |
| **Kiểm thử** | Có kết quả tự động trong lượt audit, thường là fixture/offline |
| **Tài liệu** | Thông tin triển khai trước đó; cần kiểm tra live trước thao tác VPS |
| **Đề xuất** | Chưa triển khai hoặc chưa đo; không phải tính năng đang có |

**Giới hạn:** chưa SSH kiểm tra tải/phiên bản hiệu lực trên hai VPS; chưa chạy production build benchmark, thử tải nhiều nhân sự, thử gửi/call thật hoặc phục hồi backup vào môi trường mới. Audit bao phủ các tuyến chức năng và thành phần chính; không phải chứng nhận từng nhánh code, mọi tài khoản, thiết bị và mạng đều hoạt động.

**Không thực hiện:** xóa file/dữ liệu, sửa mã ứng dụng, thay quyền, tạo/chạy chiến dịch, gửi tin/gọi điện, khởi động lại connector hoặc deploy VPS.

### Quy mô nguồn đã thống kê

| Phạm vi | Số lượng |
|---|---:|
| `apps/frontend/src/features/zalo-team` | 118 file TS/TSX, 23.368 dòng vật lý |
| `apps/frontend/src/app/zalo-team` | 8 file TS/TSX, 1.648 dòng vật lý |
| `apps/frontend/src/app/api/zalo-team` | 19 file TS/TSX, 1.164 dòng vật lý |
| CSS chính `zalo-team.module.css` | Khoảng 140 KB; 7.084 dòng không rỗng |
| Bộ kiểm thử Zalo offline | 322 test trong 68 file |

Số file/dòng chỉ phản ánh phạm vi bảo trì, không tự chứng minh chậm. Cần dùng dependency graph, bundle và profile runtime để quyết định tách/xóa.

## 3. Kiến trúc và ranh giới cần giữ

### 3.1. Vai trò hệ thống

| Thành phần | Trách nhiệm | Điều cần giữ |
|---|---|---|
| CRM VPS `45.252.251.120` | Đăng nhập, user/phòng ban, quyền CRM; điểm truy cập production | CRM là nguồn quyết định danh tính/quyền |
| Zalo VPS `14.225.198.183` | Frontend Team riêng, API kho, PostgreSQL, connector, worker, Drive, gateway gọi | Không phụ thuộc máy dev để production hoạt động |
| Frontend `apps/frontend` | UI, cache theo phiên, điều phối đọc và proxy cùng origin | Giữ một nguồn frontend; không tạo thêm app trùng |
| Laravel `apps/backend` | ACL, lưu trữ, thẻ, chiến dịch, báo cáo, nhập/backup | Kiểm tra quyền ở backend, không dựa vào ẩn nút |
| `apps/backend/integrations/zalo` | Adapter Zalo Web, gọi điện, nhập file và phần dùng chung | Tách giao thức/vendor khỏi nghiệp vụ CRM |
| Drive | Tệp dài hạn và các bản sao lưu đã đưa lên | Metadata/quyền/biên nhận vẫn cần DB và kho khóa |
| `tooling/zalo-team` | Deploy, dev, kiểm thử, chẩn đoán | Phân biệt tooling với chương trình runtime còn nằm trong đây |

Luồng đọc điển hình: trình duyệt → Next API/proxy → kiểm tra danh tính/phạm vi → connector hoặc Laravel → Zalo native / PostgreSQL / cache VPS / Drive.

Luồng gửi chiến dịch: xác nhận trên UI → bản ghi chiến dịch → worker đúng môi trường → kiểm tra lại người gửi và người nhận → connector → biên nhận → cập nhật kết quả. Timeout không đồng nghĩa chưa gửi.

### 3.2. Local và production

- Local được cấu hình dùng chung dữ liệu/connector VPS theo lựa chọn trước đó của người dùng. **Local không phải sandbox dữ liệu riêng.**
- Tài liệu mô tả API local và production xác thực với các origin CRM khác nhau; chiến dịch có `identity_origin` để worker không lấy nhầm công việc.
- Các cải tiến UI/chiến dịch ngày 09/10 nhiều mục mới chỉ ở local; tài liệu production có mốc `live-20261008`. Không suy ra production đã có toàn bộ tính năng từ ảnh local.
- Cần một bảng phiên bản thực tế: frontend, API, connector, call, sync, campaign worker, Drive worker, schema; kèm commit/image digest và môi trường.
- Trước khi bật cho nhân sự: chứng minh CRM production + worker production chạy khi **máy local tắt**, không dùng identity/port của máy dev.

### 3.3. Những bảo vệ đã có, cần giữ khi tối ưu

- Cache và yêu cầu đọc có phạm vi danh tính; đổi user phải hủy/clear dữ liệu cũ.
- Backend lọc tài khoản theo quyền; worker kiểm tra lại quyền khi xử lý.
- ID native là căn cứ gom nhóm và ghi người gửi; không suy ra từ tên giống nhau hoặc thời gian gần nhau.
- Gửi chưa rõ kết quả được kiểm tra biên nhận, không tự phát lại.
- Tệp Drive được tải về tạm, kiểm tra hash rồi mới đưa vào cache dùng được.
- Khóa/lease hiện có bảo vệ job và tài khoản; không bỏ khóa để đổi lấy tốc độ.

## 4. Bản đồ chức năng và các điểm cần hoàn thiện

| Khu vực | Đã có trong code/UI | Điểm cần care tiếp | Ưu tiên |
|---|---|---|---|
| Shell/điều hướng | Tin nhắn, Danh bạ, Thẻ, Chiến dịch, Tài khoản, Đồng bộ & sao lưu | Tách layout quản trị dùng chung; trạng thái tab/bộ lọc có thể quay lại | P2 |
| Liên kết tài khoản | QR, trạng thái phiên, thao tác tài khoản, phân quyền | QR hết hạn rõ; phân biệt xác thực/đang tải danh sách/lỗi; giới hạn chờ và khôi phục riêng tài khoản | P1 |
| Phân quyền | Admin, phòng ban/leader, user được chia tài khoản; quyền chiến dịch | Ma trận thử role thật, thay phòng ban, thu hồi khi đang mở chat/job | P1 |
| Inbox | Tất cả/Chưa đọc/Lưu trữ, tìm kiếm, lọc thẻ, ghim, gom nhóm | Virtual list; giữ vị trí cuộn; một thông báo lỗi theo nguyên nhân chính | P1 |
| Gom nhóm | Dựa global ID; chọn tài khoản nguồn khi cần | Luôn thấy đang gửi bằng tài khoản nào; không gộp chỉ vì tên/ảnh giống | P1 |
| Tin nhắn | Văn bản, emoji, mention, media, reply và thao tác tin | Tối ưu render; ổn định neo cuộn khi ảnh về; trạng thái gửi thống nhất | P1 |
| Nhân viên gửi/gọi | Attribution theo biên nhận/native ID | Kiểm thử xuyên restart và nhiều người cùng tài khoản; không gán nhầm tin gửi từ app/mobile | P1 |
| Thông tin hội thoại | Thành viên, thư viện ảnh/tệp, tìm tin, cài đặt/quyền riêng tư | Tab nặng tải khi mở; mỗi vùng có lỗi/rỗng riêng; giữ ACL media | P1–P2 |
| Nhóm | Tạo/thêm thành viên, quản lý nhóm, poll, note/reminder/topic qua adapter | Kiểm thử quyền chủ nhóm/thành viên, hạn giờ và lỗi capability sau Zalo cập nhật | P2 |
| Danh bạ | Bạn bè/nhóm, lời mời đã nhận/đã gửi, tìm/sắp xếp/thẻ | Virtual list; đổi tài khoản không lóe dữ liệu cũ; chưa tự nhận/thu hồi lời mời trong audit | P1–P2 |
| Thẻ chung | Màu, thứ tự, cấp quản lý, áp dụng hội thoại | Tối ưu danh sách và context; phân biệt lưu trữ thẻ với lưu trữ hội thoại | P2 |
| Tạo chiến dịch | Người nhận có avatar, lọc thẻ, editor chung, biến, media, preview | Giữ luồng đã được người dùng chấp nhận; bảo vệ bản nháp khi chuyển trang | P2 |
| Vòng đời chiến dịch | Nháp, sửa, sao chép, lịch, chạy/dừng/tiếp tục/hủy/xóa, biên nhận | Phân trang >100; lời giải thích bỏ qua/lỗi; ETA; quyền duyệt cho team | P1 |
| Gọi điện | Gateway VPS, trạng thái cuộc gọi, attribution | Một phiên gateway; kiểm tra mạng; đa cuộc gọi cần thiết kế riêng | P1 trước mở rộng |
| Đồng bộ Web | Tiến độ lịch sử/tệp, thử lại, nguồn lỗi | Ưu tiên chat đang dùng; đo độ trễ đồng bộ thay vì chỉ số lượng | P1 |
| Nhập file | Chọn nguồn local, chạy/dừng/tiếp tục, kiểm tra nguồn | Capability production chưa tương đương local; hỗ trợ bộ giải mã cần được xác minh | P1 về UX |
| Lưu trữ | Theo ngày, tài khoản, tệp chưa lấy được, tìm/đọc lịch sử, dọn | Tổng hợp SQL, phân trang ngày, tải chi tiết lỗi khi cần | P1 |
| Sao lưu/Drive | Snapshot kho, blob/hash, đẩy Drive, đọc lại/cache | Backup toàn dịch vụ, restore drill, số lượng object/quota, xóa có kiểm soát | P1 |
| Server | CPU/RAM/đĩa và trạng thái các thành phần | Giải thích số liệu đo/ước tính; queue lag, disk breakdown, lịch sử xu hướng | P2 |

**Quan sát local:** 4 tài khoản hiển thị kết nối; 3 chưa có phòng ban quản lý trong bảng đã xem. Đây chưa phải lỗi ACL: tài khoản chưa phân bổ có thể chỉ admin thấy. Cần chủ hệ thống chọn người/phòng ban trước pilot, không tự gán trong cleanup.

## 5. Đợt đầu — Clean đúng và đủ

### 5.1. Danh mục cleanup từ nguồn

Các đường dẫn rút gọn trong bảng này bắt đầu từ `apps/frontend/src/features/zalo-team/`.

| ID | Đối tượng | Bằng chứng / quyết định đề xuất | Điều kiện trước khi xóa |
|---|---|---|---|
| CLN-01 | `components/archive-pc-sync.tsx` | Không có import/re-export vào app hiện tại; màn PC cũ | Kiểm tra script/build động; xóa kèm CSS chỉ riêng màn này |
| CLN-02 | `components/archive-pc-imports.tsx` | Không có nơi dùng trong đồ thị frontend | Giữ `archive-file-import.tsx` đang dùng |
| CLN-03 | `components/archive-phone-sync.tsx` | UI không có nơi dùng | Không tự xóa PhoneSync backend còn được gọi |
| CLN-04 | `components/archive-checkpoints.tsx` | UI checkpoint không được mount | Chốt giữ API checkpoint/backup hay mở lại UI; không xóa dữ liệu/checkpoint |
| CLN-05 | `components/page-header.tsx` | Header Team cũ không có import | Không đụng `src/components/shell/page-header.tsx` của CRM |
| CLN-06 | `fixtures.ts` | Dữ liệu giả, không có import vào app | Xác minh script/browser fixture không đọc bằng path; giữ fixtures thật của test |
| CLN-07 | CSS của 6 module trên | Có thể còn selector mồ côi | Lập map selector→consumer sau xóa; không chỉ grep literal vì có class động |
| CLN-08 | Script PC/local call cũ | Root còn `zalo:pc`, `dev:zalo-pc`; nhánh Windows audio còn được import | Xác định ma trận runtime còn hỗ trợ; gỡ command/documentation đồng bộ |
| CLN-09 | `server-metrics.py` ở tooling | Là chương trình runtime chạy phục vụ sản phẩm | Chuyển implementation về backend integration; tooling giữ install/service template |
| CLN-10 | Tài liệu lịch sử và research | README dài, phần hiện trạng/“Bước tiếp theo” chứa các mốc đã vượt qua | Giữ một trang hiện trạng chuẩn, link lịch sử; không xóa bằng chứng triển khai |

Đồ thị đã kiểm tra static import/re-export toàn `apps/frontend/src`, đồng thời tìm chuỗi tên module trong source/tooling. Đây là danh mục ứng viên có bằng chứng, chưa phải lệnh xóa hàng loạt.

### 5.2. Những thứ trông cũ nhưng còn hoạt động

- `ZaloTeamFileImport` dùng `ZaloTeamPcRemote`; `PcImport` dùng `PcIndex` cho fingerprint/media.
- `ZaloTeamPcBridgeController` còn là đầu nối nhập/index/recovery.
- `ZaloTeamArchiveCleanup`, `ZaloTeamArchiveRetry`, `ZaloTeamArchive` còn dùng `PcRecovery`.
- `ZaloTeamArchiveSync` còn gọi `PhoneSync::tick`; controller còn route phone/checkpoint dù UI cũ không còn mount.
- `audio-worker.mjs` vẫn có nhánh Windows/native bên cạnh runtime gọi hiện hành; xóa file theo tên có thể phá import hoặc fallback.
- `/api/zalo-team/pc` trả **410 `PC_PROVIDER_RETIRED`**. Có thể giữ route rất nhỏ này làm thông báo đúng cho client/bookmark cũ, thay vì xóa thành 404 khó hiểu.

**Cách xử lý:** tách phần dùng chung nhập file/khôi phục media sang tên đúng trách nhiệm; giữ compatibility adapter trong một mốc chuyển đổi; sau khi test và manifest không còn tham chiếu mới gỡ runtime cũ.

### 5.3. Cấu trúc đích đề xuất

```text
apps/frontend/src/features/zalo-team/
  components/                  # shell, control và component dùng chung
  inbox/  contacts/  accounts/  campaigns/  archive/  calls/
  api/                         # policy, query keys, transport
apps/backend/app/Services/     # nghiệp vụ Laravel; tách theo domain khi cần
apps/backend/integrations/zalo/
  web/  call/  file-import/  shared/  metrics/
tooling/zalo-team/
  development/  deployment/  diagnostics/  tests/
docs/zalo-team/                # chỉ đưa tài liệu vào đây theo đợt, sửa mọi link
```

Đây là hướng tổ chức, không yêu cầu di chuyển tất cả file trong một lần. Ưu tiên bỏ module không dùng; sau đó tách file lớn theo ranh giới trách nhiệm đã ổn định. Không tạo lớp trừu tượng chỉ để làm cây thư mục đẹp.

### 5.4. Dữ liệu, build và Git

- `git status` hiện có nhiều nguồn Zalo **untracked**, cạnh các thay đổi CRM khác. Trước release phải có commit/manifest bao gồm đủ nguồn cần thiết; build từ working tree không chứng minh clone sạch sẽ build được.
- Không commit profile, khóa, token, database dump, nội dung chat, export Zalo hoặc `.local` chứa dữ liệu kiểm tra.
- Test bảo vệ ACL, gửi một lần, receipt, recovery, cuộn và media cần giữ. Nhiều test không phải rác; ưu tiên gom command và fixture để dễ chạy.
- Dọn đĩa là công việc riêng: thống kê cache build, image không dùng, log, bundle deploy, temp nhập, tệp active, backup. Có manifest và tuổi dữ liệu trước khi xóa.
- Không dùng `docker system prune --volumes`, không xóa profile hay file xuất gốc, không xóa thư mục `pc`/`archive` chỉ dựa vào tên.

**Hoàn tất cleanup khi:** import/typecheck và test trọng yếu đạt; build từ checkout sạch đạt; không mất chức năng đang dùng; manifest triển khai không còn path đã gỡ; diff không chứa dữ liệu/secret và không lẫn thay đổi CRM.

## 6. Tối ưu tốc độ: các điểm cụ thể

### PERF-01 — Tách API trạng thái kho thành dữ liệu nhẹ theo màn hình · P1

**Code:** [ZaloTeamArchive.php](apps/backend/app/Services/ZaloTeamArchive.php), `status()`; [archive-page.tsx](apps/frontend/src/features/zalo-team/components/archive-page.tsx); [archive-days.tsx](apps/frontend/src/features/zalo-team/components/archive-days.tsx).

`status()` lấy sources, tập assets đã lưu rồi unique/sum trong PHP; kèm progress, issues, checkpoint, imports và backups. Với issues còn có truy vấn bổ sung theo từng mục. Một số trường chỉ admin dùng bị loại khỏi response sau khi đã tính. Trang archive làm mới trạng thái khoảng 30 giây; phần theo ngày có lượt đọc riêng.

**Đề xuất:** summary chỉ có bộ đếm/cờ trạng thái; progress cho tab Đồng bộ; jobs/backups/issues phân trang và tải khi mở. Tổng bytes/hash aggregate ở SQL hoặc bảng thống kê, không hydrate toàn bộ tập assets. Kiểm tra quyền trước khi chạy truy vấn admin. Cache ngắn theo owner/account scope và invalidation rõ.

**Nghiệm thu:** số query/tài nguyên không tăng tuyến tính theo số asset cho lượt summary; tab không mở không gọi endpoint chi tiết; dữ liệu các role vẫn đúng; p95 đạt ngân sách mục 9 trên dataset chuẩn.

### PERF-02 — Tổng hợp theo ngày có thể tăng chi phí theo toàn kho · P1

**Code:** [ZaloTeamArchiveReport.php](apps/backend/app/Services/ZaloTeamArchiveReport.php), `days()`.

Khi chưa lọc ngày, báo cáo aggregate lịch sử theo ngày, lấy nhóm ngày/hash rồi gom trong PHP; chưa có phân trang ngày. Khi kho tăng, một bảng nhìn ngắn vẫn có thể làm nhiều công việc DB.

**Đề xuất:** daily summary theo owner/account/date, cập nhật từ job sau commit; backfill theo lô và có đối soát. Truy vấn theo khoảng ngày/cursor. Phân biệt `distinct asset toàn kho` với `asset xuất hiện trong ngày`, tránh cộng các ngày rồi gọi đó là dung lượng vật lý.

**Nghiệm thu:** số tin/tệp/bytes khớp truy vấn đối soát; không lệch khi import, retry, soft-delete và hai tài khoản cùng thấy một nhóm; có đường rebuild summary.

### PERF-03 — Tìm kho có scan và N+1 · P1

**Code:** [ZaloTeamArchiveSearch.php](apps/backend/app/Services/ZaloTeamArchiveSearch.php), `conversations()`; [ZaloTeamArchive.php](apps/backend/app/Services/ZaloTeamArchive.php), phần tìm nội dung.

Tìm tên hội thoại chuẩn hóa tiếng Việt rồi so khớp trong vòng lặp PHP. Mỗi kết quả lại truy vấn tin cuối và avatar; một trang có thể tới 50 hội thoại. Tìm nội dung có nhánh `LOWER(CAST(m.content AS TEXT)) LIKE ...`.

**Đề xuất:** projection tên đã chuẩn hóa/tin cuối/avatar; truy vấn theo lô hoặc join/lateral phù hợp. Dùng `EXPLAIN (ANALYZE, BUFFERS)` trên bản dữ liệu thử để chọn index. Với nội dung, đánh giá PostgreSQL full-text/trigram sau khi tách trường văn bản; chưa cần thêm Elasticsearch.

**Nghiệm thu:** đúng dấu/không dấu, paging ổn định, scope ACL đúng; query count không tăng theo từng hàng; index không làm worker ghi chậm quá ngân sách.

### PERF-04 — Virtual list cho inbox và danh bạ trước, timeline sau · P1

**Code:** [messages-layout.tsx](apps/frontend/src/app/zalo-team/messages-layout.tsx), danh sách `visible.map`; [contacts-layout.tsx](apps/frontend/src/app/zalo-team/contacts/contacts-layout.tsx); [conversation-detail.tsx](apps/frontend/src/features/zalo-team/components/conversation-detail.tsx), `visibleMessages.map`.

Hiện danh sách còn render toàn bộ tập đang có. UI local đã có danh bạ hàng trăm mục; code chưa có virtualizer. Timeline còn sort/map dữ liệu khi render, cần profile trước khi thêm memo.

**Đề xuất:** dùng TanStack Virtual cho danh sách dài, giữ DOM gần số dòng trong viewport. Timeline có chiều cao biến đổi phải xử lý ảnh tải muộn, ngày, reply, tìm kiếm nhảy tới tin và neo cuộn. Triển khai inbox/danh bạ trước để ít rủi ro hơn. [Tài liệu TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction).

**Nghiệm thu:** cuộn 1.000–5.000 dòng không giật; chọn/keyboard/search vẫn đúng; ảnh về không kéo người dùng khỏi tin đang đọc; chọn nhanh nhiều hội thoại không hiển thị nhầm response cũ.

### PERF-05 — Tối ưu trên bộ API hiện có, không lắp thêm lớp cạnh tranh · P1

**Code:** [request.ts](apps/frontend/src/features/zalo-team/request.ts), [data-provider.tsx](apps/frontend/src/features/zalo-team/components/data-provider.tsx), [live.ts](apps/frontend/src/features/zalo-team/live.ts).

Đã có giới hạn 4 read đồng thời, tối đa 2 read nền; deadline đọc 20 giây; gom request trùng; cache/coalescing cho một số dữ liệu; poll hoàn tất rồi mới chờ lượt sau; pause poll khi hidden/offline. TanStack Query mặc định stale 60 giây, retry tắt, không refetch chỉ vì focus. Đây là nền tốt.

**Phần còn cần làm:** lập registry operation→cache key→TTL→invalidation→timeout→quyền; gộp snapshot lặp giữa các màn; thay refresh toàn danh sách bằng cập nhật row khi event đủ dữ liệu. Realtime là một stream mỗi tab, chưa phải một stream cho mọi tab trình duyệt; retry nên có jitter. Chỉ thêm leader giữa tab nếu đo cho thấy nhiều tab gây tải đáng kể.

**Giữ nguyên nguyên tắc:** stream/command không bị nhét vào read queue; lệnh gửi không tự retry; đọc phải hủy được cả lúc nhận body; khóa cache gồm danh tính và tài khoản. Đổi user/thu hồi quyền phải vô hiệu cache và stream liên quan.

### PERF-06 — Media lạnh trên Drive có thể chiếm worker API · P1

**Code:** [ZaloTeamDriveStore.php](apps/backend/app/Services/ZaloTeamDriveStore.php), `read()/hydrate()`; [ZaloTeamArchiveFiles.php](apps/backend/app/Services/ZaloTeamArchiveFiles.php), `available()`; `storedAttachments()` trong Archive.

Đọc file chưa có local tải toàn bộ về temp, xác minh hash rồi mới sẵn sàng. File lớn có thể giữ một PHP worker lâu. Trạng thái main/preview hiện được kiểm tra nhiều lần khi tạo attachment; khi file không còn local có thể lặp truy vấn metadata Drive.

**Đề xuất:** batch availability theo hash; gộp hydrate trùng; hàng đợi lấy file + trạng thái chờ rõ; thumbnail nhỏ có cache độc lập. Giữ pin cho tệp đang dùng/chưa đẩy xong. Nếu làm streaming/range từ Drive, phải thiết kế lại kiểm tra tính toàn vẹn theo đoạn hoặc mô hình tin cậy rõ, không bỏ hash kiểm tra hiện có một cách tùy tiện.

**Nghiệm thu:** 10 người mở cùng file chỉ tạo một lượt hydrate; timeout không để temp mồ côi; revoke quyền chặn lượt tải mới; video seek/range đúng; preview báo đang lấy file thay vì quay vô hạn.

### PERF-07 — Định cỡ CPU/DB/worker dựa trên đo đạc · P1

**Cấu hình repo, chưa phải tài nguyên hiệu lực trên VPS:**

| Thành phần | Cấu hình thấy trong repo | Cần đo |
|---|---|---|
| Web connector | Không còn memory cap trong compose Web; `cpus: 2.0`, shm 256 MB | CPU throttling, RAM mỗi profile, thời gian native action |
| API tại compose VPS-local | 3 GiB / 4 CPU, FPM `max_children=6` | Worker bận/chờ, RSS/request, thời gian auth/DB/Drive |
| PostgreSQL tại compose VPS-local | 512 MiB / 1 CPU; shared buffers 128 MB; max connections 30 | Cache hit, disk latency, temp spill, pool/connection |
| Frontend riêng | 1,5 GiB / 2 CPU | Heap, event loop, proxy latency, request timeout |
| Sync/backup/Drive/campaigns | Các container có ngân sách riêng, thường 256–384 MiB | Queue age, retry, lease, IO và tranh chấp |

Dockerfile API mặc định còn cấu hình FPM khác; compose mount có thể override. Bắt buộc kiểm tra compose đã merge và cấu hình process thực tế trước khi đổi.

**Đề xuất:** baseline rồi chỉnh một biến/lượt; ưu tiên DB và hàng đợi nếu chúng là nút thắt. Giữ phần RAM cho OS/page cache/DB; không cấp toàn bộ RAM khả dụng cho connector. Theo dõi P95 và throttling cùng lúc với CPU/RAM, không chỉ nhìn số trống.

### PERF-08 — Job nặng và khóa đồng bộ · P1–P2

**Code:** `ZaloTeamArchive::withLock()`, [ZaloTeamArchiveSync.php](apps/backend/app/Services/ZaloTeamArchiveSync.php), file import lease, archive proxy.

Có khóa theo owner cho thao tác archive; sync nhường khi file import đang giữ lease. Một số thao tác verify/restore có timeout proxy dài, trong khi client đọc có deadline ngắn hơn.

**Đề xuất:** job có ID, trạng thái, heartbeat, chunk, checkpoint; web request chỉ tạo/theo dõi job. Ưu tiên tương tác thật trước lịch sử cũ; phân chia công việc theo account/batch khi chứng minh được không phá tính nhất quán. Chỉ số quan trọng là tuổi job lâu nhất và tốc độ xử lý, không phải số thread.

**Nghiệm thu:** restart worker không tạo bản ghi/gửi trùng; job bị kẹt được nhận diện; cancel dừng ở checkpoint an toàn; đồng bộ một tài khoản lỗi không chặn tất cả tài khoản khỏe.

### PERF-09 — Chi phí kiểm tra quyền và render provider · P2

**Code:** [access.ts](apps/frontend/src/app/api/zalo-team/access.ts), [ZaloTeamAccess.php](apps/backend/app/Services/ZaloTeamAccess.php), [ZaloTeamIdentity.php](apps/backend/app/Services/ZaloTeamIdentity.php), `shared-tags.tsx`.

Luồng proxy/identity có roundtrip CRM khi đọc, tùy route; frontend access coalesces request đang chạy nhưng không phải cache quyền dài hạn. Context thẻ và các phép nhóm/sort có thể làm nhiều consumer render lại.

**Đề xuất:** instrument từng chặng trước. Nếu auth là bottleneck, dùng phiên bản quyền/signed identity thời hạn ngắn với cơ chế revoke rõ; không cache quyền tùy tiện vài phút. Memo hóa dữ liệu dẫn xuất/provider sau khi profiler chỉ ra chi phí; không rải `useMemo` toàn bộ code.

## 7. Hoàn thiện chức năng và vận hành

### FUN-01 — Danh sách chiến dịch chỉ lấy 100 mục · P1

**Code:** [ZaloTeamCampaigns.php](apps/backend/app/Services/ZaloTeamCampaigns.php), `listing()` dùng `limit(100)` và trả danh sách; UI lọc trên tập đã tải.

Khi vượt 100, chiến dịch cũ không còn tìm được bằng bộ lọc hiện tại dù dữ liệu vẫn tồn tại. Cần search/filter/pagination phía server, total theo quyền, cursor ổn định; thao tác row giữ đúng ID khi refresh.

### FUN-02 — Chuẩn hóa ý nghĩa gửi, bỏ qua, lỗi và gửi tiếp · P1

- `% đã gửi` = số phần xác nhận gửi / tổng phần của lần chạy; hiển thị riêng `đã xử lý`, `bỏ qua`, `lỗi`, `chưa xác nhận`.
- Không dùng màu thành công cho “kết thúc nhưng chưa gửi gì”. Mỗi lý do có hướng xử lý cụ thể và người chịu trách nhiệm.
- “Gửi tiếp” chỉ phần đủ điều kiện chưa gửi; “Sao chép” là chiến dịch mới, có preview/xác nhận mới. Không đổi hai ý nghĩa này dưới một nút “Chạy lại”.
- `unknown` phải tra receipt/trạng thái native; không dựa vào HTTP timeout để gửi lần nữa.
- Các bảo vệ đã có: lease theo owner/account, kiểm tra actor, thứ tự phần của người nhận, chặn suppression/thẻ loại trừ và phân biệt origin. Giữ toàn bộ khi refactor.
- Mặc định 10 giây/phần hiện là cấu hình sản phẩm, không phải cam kết giới hạn chính thức của Zalo. Khi bị hạn chế từ nguồn cần pause/backoff và hiển thị lý do; không tăng tốc bằng cách né giới hạn.

### FUN-03 — Gọi điện nhiều nhân sự · P1 trước khi mở rộng

**Code:** [audio-worker.mjs](apps/backend/integrations/zalo/call/audio-worker.mjs) có `let active`; offer mới gặp active/draining trả `CALL_WORKER_BUSY`. [call-media.ts](apps/frontend/src/features/zalo-team/call-media.ts) dùng `iceServers: []`.

1. Trước mắt: preflight gateway/microphone/network; thông báo bận đúng; timeout có thể hồi phục; log theo call ID không lộ nội dung.
2. Giai đoạn mở rộng: session registry theo call/account, isolation tài nguyên và port; quota theo tài khoản, cleanup khi disconnect; capacity test codec/audio.
3. Thử các mạng văn phòng/4G/5G/VPN; đánh giá TURN khi đường kết nối hiện tại không đủ. Chưa kết luận mọi mạng đều lỗi vì chưa có TURN.
4. Không nhân bản container cùng port/profile rồi coi là hỗ trợ đa cuộc gọi. Không tự thêm ghi âm mặc định.

### FUN-04 — Nhập file phải thể hiện đúng khả năng môi trường · P1

Controller và proxy đang giới hạn file import cho admin/local/loopback. Luồng đọc export có phụ thuộc helper/bộ giải mã nguồn Windows; không thể cam kết tải ZIP lên VPS là tự nhập được.

**Ngắn hạn:** production chỉ hiện hành động thật sự dùng được, giải thích một câu khi cần máy nhập; giữ hiển thị tiến độ từ job. Không để nhân sự gặp đường dẫn kỹ thuật hoặc nút chắc chắn bị chặn.

**Dài hạn:** thử tính khả thi của reader trên server trước; nếu hỗ trợ thì upload tiếp tục được theo chunk/hash. Nếu phải dùng helper thì helper chỉ làm bước đọc/giải mã, tạo job có phạm vi/biên nhận rõ. Nhập từ link Drive chỉ triển khai sau khi định dạng và quyền truy cập được kiểm chứng.

### OPS-01 — Backup toàn dịch vụ và diễn tập phục hồi · P1

**Code:** [ZaloTeamArchiveBackup.php](apps/backend/app/Services/ZaloTeamArchiveBackup.php), `TABLES` gồm sources/messages/observations/assets/checkpoints/imports/versions, thêm xử lý tags; restore dùng merge/`insertOrIgnore`.

Backup này phục vụ kho lịch sử, chưa bao trùm toàn bộ chiến dịch/deliveries, cấu hình quyền, preference, connector profile và biên nhận gửi. Không dùng nó làm bằng chứng có thể khôi phục nguyên trạng cả sản phẩm.

**Bộ khôi phục đích:**

| Dữ liệu | Cách bảo vệ đề xuất |
|---|---|
| DB dịch vụ | Backup PostgreSQL đầy đủ, mã hóa; đánh giá WAL/PITR khi cần RPO ngắn |
| Danh tính/phân quyền CRM | Backup CRM riêng, lưu mapping/origin và mốc đồng bộ |
| Profile connector, sender receipt | Snapshot nhất quán theo quy trình; giới hạn truy cập và mã hóa |
| Media + campaign assets + Drive catalog | Kiểm tra hash, manifest, object ID; khả năng phục hồi khi cache VPS trống |
| Khóa mã hóa/cấu hình | Lưu tách backup dữ liệu, có quy trình khôi phục/rotation; không vào Git/image |
| Release/schema | Image digest, migration version, manifest và runbook rollback |

Restore drill trên môi trường cô lập, tắt khả năng gửi/call: kiểm tra danh sách, số bản ghi, media mẫu, mapping quyền và receipts. Job cũ không được tự chạy lại sau restore. RPO/RTO cần chủ hệ thống chốt; đề xuất khởi đầu metadata ≤1 giờ, khôi phục dịch vụ ≤4 giờ, sau đó đo thực tế.

### OPS-02 — Drive 22 TB vẫn cần quản lý số tệp và quota · P1–P2

Dung lượng Drive lớn không loại bỏ giới hạn số object hoặc tốc độ API. Google hiện ghi Shared Drive tối đa **500.000 item**, kể cả folder và trash. Với kho nhiều tệp nhỏ cần theo dõi số object/hash, không chỉ GB. [Google Shared drives overview](https://developers.google.com/workspace/drive/api/guides/about-shareddrives).

API có quota và có thể trả 403/429; dùng backoff có jitter, giới hạn đồng thời và resumable transfer. Quota hiệu lực phụ thuộc project; chưa đọc quota project X3Sales live trong audit này. [Google Drive API limits](https://developers.google.com/workspace/drive/api/guides/limits).

**Đề xuất:** dashboard queue age/bytes pending/object count/retry; đối soát DB↔Drive định kỳ theo lô; kiểm tra hash/sample download; retention temp/log/cache; dự báo tăng trưởng. Chỉ chia nhiều Shared Drive khi forecast cần, và lưu shard trong catalog. Chưa gom mọi media vào ZIP lớn vì sẽ làm truy cập ngẫu nhiên và khôi phục khó hơn.

### OPS-03 — “Xóa phải xác thực” là quy trình ứng dụng, không phải khóa bất biến của Drive · P1

Quyền Contributor/writer giới hạn một số thao tác quản lý/xóa so với organizer, nhưng vẫn có khả năng ghi/sửa theo quyền; không được gọi kho là bất biến chỉ vì worker không có API xóa. Quản trị Drive có quyền cao hơn. [Google Drive roles](https://developers.google.com/workspace/drive/api/guides/ref-roles).

**Đề xuất:** worker thường ngày không được cấp quyền quản trị; tác vụ xóa có role riêng, xác thực lại, bản xem trước phạm vi/dung lượng, thời gian chờ hoặc duyệt hai người cho xóa lớn, nhật ký bất biến ở mức ứng dụng, cơ chế khôi phục. Bản sao dự phòng quan trọng phải có ranh giới quyền độc lập. Không hứa folder Google Drive tự hỏi mật khẩu mỗi lần bị xóa ở mọi client.

### OPS-04 — Theo dõi sự cố và khả năng sẵn sàng · P1

`/api/zalo-team/health` frontend hiện kiểm tra process; không chứng minh CRM auth, DB, connector, Drive hay worker khỏe. Giữ endpoint public đơn giản; thêm readiness/capability chi tiết cho admin ở tuyến xác thực.

Cần đo: request ID xuyên FE→API→connector, p50/p95/error theo operation, tuổi hàng đợi, tài khoản cần QR lại, sự kiện cuối, nguồn sync lỗi, file pending, dung lượng/temp, lease hết hạn, backup gần nhất và lần restore drill. Log có cấu trúc, che token/nội dung/PII; không đưa cả payload chat vào monitoring.

UI phân biệt: tài khoản hết phiên → liên kết lại; nguồn tạm chậm → giữ danh sách; dịch vụ mất kết nối → thử lại có backoff; quyền bị thu hồi → đóng phạm vi và xóa cache. Không xếp chồng nhiều banner giống nhau hoặc yêu cầu chạy lại frontend như cách khắc phục mặc định.

### OPS-05 — Sự phụ thuộc adapter/native cần có cổng kiểm tra · P1

Connector đọc/gọi qua native contract có thể thay đổi khi upstream cập nhật. Duy trì capability probe theo version, test contract fixture và canary account thử trước release. Không fallback im lặng sang đọc DB/raw source thiếu quyền khi native contract đổi. Cần mốc rollback image/profile tương thích, không chỉ rollback frontend.

## 8. Giao diện: chuẩn hóa để thao tác nhanh và dễ hiểu

### 8.1. Quyết định thiết kế

Giữ màu, font, icon, avatar và cách tổ chức theo Zalo mà người dùng đã chốt. Không thêm dashboard nhiều màu, card KPI khổng lồ hoặc một thư viện UI cạnh tranh với các primitive đang có. UI/UX Pro Max được dùng làm checklist đánh giá, không thay nhận diện.

**Nên chuẩn hóa thành component:**

| Component/chuẩn | Nội dung |
|---|---|
| `TeamManagementLayout` | Sidebar trái, tiêu đề phải, content full width; hiện đang chia sẻ CSS là chính |
| `TeamListToolbar` | Tìm kiếm, filter, count theo format `Chiến dịch (n)`/`Tài khoản (n)` |
| `TeamEmptyState` / `TeamLoadState` | Chưa có dữ liệu, lọc không thấy, đang tải, lỗi có dữ liệu cũ: bốn trạng thái khác nhau |
| `TeamStatusBadge` | Connected/đang xử lý/tạm dừng/lỗi; icon hoặc chữ đi cùng màu |
| Menu hành động | Nút ba chấm cùng hit area; đóng bằng Escape; focus quay về nút mở; hành động nguy hiểm rõ |
| `TeamSelect` / `TeamDatePicker` | Giữ component hiện có; label, chiều cao, clear, lỗi và keyboard đồng nhất |
| Dialog/xác nhận | Một primary action; đúng tên đối tượng/phạm vi; pending chặn double-click; lỗi ngay cạnh hành động |

### 8.2. Việc cụ thể theo màn

- **Inbox:** giữ ba tab một hàng; virtual list; vị trí cuộn ổn định; nhóm gộp vẫn hiển thị avatar/tài khoản nguồn; một status chính, chi tiết lỗi mở theo yêu cầu.
- **Chat:** giữ `giờ — nhân viên CRM`; chữ dài/emoji/media không làm chiều rộng rung; upload hiển thị tiến độ/cancel; khi gửi chưa xác nhận có hành động kiểm tra rõ. Không dùng cùng trạng thái cho “đang nhận dữ liệu” và “đang gửi”.
- **Danh bạ:** tiêu đề/count và toolbar thống nhất; giữ account selector; tìm kiếm debounce/cancel; danh sách dài không render hết; màn lời mời có trạng thái rỗng dễ hiểu.
- **Thẻ:** giữ màu trước tên; bảng edit/up/down/archive hiện nhiều thao tác, nên gọn bằng menu thứ cấp và drag/reorder có phương án bàn phím. Phân biệt “lưu trữ thẻ” với tab hội thoại Lưu trữ.
- **Tài khoản:** thông tin quản lý/quyền xem phải dễ nhận; tài khoản chưa phân công có nhãn rõ; QR có đồng hồ hết hạn và nút cấp mới; không đổi toàn trang thành skeleton khi chỉ một account reconnect.
- **Chiến dịch:** giữ list gọn và menu ba chấm; filter server; detail có progress + lý do dừng + thao tác tiếp theo; preview dùng đúng emoji/media component. Cảnh báo rời form có bản nháp chưa lưu, giữ người nhận đã chọn theo quy tắc đã chốt.
- **Đồng bộ:** tiến độ chia lịch sử/tệp; nói rõ chờ, đang chạy, tạm dừng hay lỗi; tác vụ nền không chặn xem chat. Không đưa các tham số kỹ thuật worker vào luồng người dùng thường.
- **Lưu trữ:** ngày và account filter cùng chiều cao; lỗi tệp bấm được để biết tệp/cuộc trò chuyện/tài khoản; tải chi tiết khi mở, không tính mọi thứ mỗi lần refresh.
- **Sao lưu:** lần thành công gần nhất, phạm vi bản sao và khả năng khôi phục; thông tin admin có cấp độ, không ghi “an toàn” chỉ vì upload thành công.
- **Server:** card số liệu ngắn, đơn vị nhất quán GiB/GB, timestamp đo và nhãn ước tính; thêm xu hướng và nguyên nhân tăng đĩa; CPU container có thể trên 100% theo số core nên phải giải thích đúng.

### 8.3. Checklist nghiệm thu UI

- Desktop 1440/1920, laptop 1024, chiều rộng 390: không tràn ngang vô nghĩa; mobile ưu tiên từng cột và nút quay lại, không ép desktop ba cột vào màn nhỏ.
- Control desktop cùng nhịp 32–36 px; vùng chạm ở thiết bị cảm ứng nên đủ rộng, khoảng 44 px; icon có nhãn trợ năng và vùng bấm lớn hơn glyph.
- Tab/Shift+Tab/Enter/Escape dùng được; focus nhìn rõ; menu/dialog không nhốt hoặc làm mất focus.
- Tương phản chữ phụ vẫn đọc được; không chỉ dùng màu để báo lỗi/thành công; honor reduced motion.
- Không nháy trắng cả trang khi refetch; giữ dữ liệu cũ kèm trạng thái cập nhật; không giữ dữ liệu sau logout/thu hồi quyền.
- Các phần nặng tải khi mở. `file-preview.tsx` đã lazy-load PDF/editor: giữ cách này, đo bundle trước khi tách thêm. [Next.js 14 lazy loading](https://nextjs.org/docs/14/app/building-your-application/optimizing/lazy-loading).

## 9. Chuẩn tốc độ và kế hoạch đo

Các con số dưới đây là **mục tiêu đề xuất**, chưa phải kết quả đo hay SLA đã cam kết.

| Chỉ số | Mục tiêu ban đầu | Cách đo |
|---|---|---|
| Mở lại inbox có cache | P95 ≤1 giây tới danh sách dùng được | Production build, warm session, dữ liệu chuẩn |
| Chuyển hội thoại đã có lịch sử | P95 ≤1 giây tới nội dung đầu tiên | Tách cold/warm, không chờ toàn media |
| Event đã đến connector → UI | P95 ≤2 giây | Correlation timestamp; tách độ trễ upstream |
| API summary local DB/cache | P95 ≤300 ms sau tối ưu | Không gộp đường cold Drive/native vào chỉ số này |
| Tương tác UI | INP mục tiêu ≤200 ms | Đo thao tác tìm/chọn/scroll trên máy phổ thông |
| Read trùng đồng thời cùng key | 1 upstream request trong một phiên điều phối | Network + log request ID |
| Tab nền | Không tiếp tục poll danh sách; stream theo policy | Chạy 10 phút hidden rồi foreground |
| Gửi | Không gửi trùng do retry/restart; pending có giải thích | Fixture lỗi trước/sau dispatch và receipt |
| Media | Warm/cold có số đo riêng, có tiến độ | File mẫu 1/10/100 MB và video seek |

### Kịch bản baseline

1. Cố định commit/image, thiết bị/mạng, dataset và cache state. Không benchmark `next dev` rồi gọi đó là tốc độ production.
2. Dùng dữ liệu giả hoặc bản sao được kiểm soát: 4→10→20 tài khoản, 10→30 người dùng đọc, 1.000→5.000 hội thoại, lịch sử 100 nghìn→1 triệu tin. Đây là profile thử, không cam kết connector hỗ trợ số lượng này.
3. Chạy đọc inbox/danh bạ/tìm kho đồng thời với sync/Drive; đo thời gian chờ read queue, auth, connector, DB và hydrate riêng.
4. Kiểm thử campaign/call bằng fixture trước; bài thử upstream thật chỉ trên tài khoản/người nhận thử đã được xác định, không dùng khách hàng làm tải.
5. Ghi browser heap/DOM/render, server RSS/CPU throttling, IO, connection DB, queue age, error rate. Lấy baseline rồi so diff từng thay đổi.
6. Bài soak 4–8 giờ trên staging; kiểm tra heap/queue/temp tăng đều hay hồi phục. Thử mất tunnel/CRM/Drive/connector và khởi động lại có kiểm soát.

Không thêm Redis, Kafka, Elasticsearch, microservice hoặc nhiều worker chỉ vì “siêu mạnh”. Chỉ thêm thành phần khi có nút thắt được đo và người chịu vận hành rõ.

## 10. Nâng cấp phù hợp X3Sales

### Checkpoint D1–D4 local — 09/10/2026, lượt triển khai toàn đợt D

**Cập nhật tối ưu tiếp theo:** hướng dẫn đào tạo đã chuyển vào README.ZALO-TEAM.md, bỏ khỏi UI. Board query fixture 44 → 14, presence 20 tab 158 → 17; mutation dùng ngay kết quả trả về, form sửa chặn revision thay đổi, dialog tải khi mở. Nhắc hạn có receipt/index/lượt nhắc, sửa chữ không báo giao việc lại hoặc đặt lại lịch tuần; bàn giao/mở lại và alias còn quyền được kiểm chứng. Migration `000250` và worker mới chạy local. 56 + 46 + 15 kiểm tra nghiệp vụ, hai cổng query, TypeScript/Pint/source layout đạt; SQL PostgreSQL presence/board/reminder đã kiểm tra trong rollback. Chưa đo HTTP/đa người dùng hoặc deploy VPS. Xem hướng dẫn và bằng chứng chi tiết trong mục Đợt D của README Zalo Team.

**Cập nhật tối ưu tiếp theo:** hướng dẫn đào tạo đã chuyển vào README.ZALO-TEAM.md, bỏ khỏi UI. Board query fixture 44 → 14, presence 20 tab 158 → 17; mutation dùng ngay kết quả trả về, form sửa chặn revision thay đổi, dialog tải khi mở. Nhắc hạn có receipt/index/lượt nhắc, sửa chữ không báo giao việc lại hoặc đặt lại lịch tuần; bàn giao/mở lại và alias còn quyền được kiểm chứng. Migration `000250` và worker mới chạy local. 56 + 46 + 15 kiểm tra nghiệp vụ, hai cổng query, TypeScript/Pint/source layout đạt; SQL PostgreSQL presence/board/reminder đã kiểm tra trong rollback. Chưa đo HTTP/đa người dùng hoặc deploy VPS. Xem hướng dẫn và bằng chứng chi tiết trong mục Đợt D của README Zalo Team.

- **D2:** ghi chú nội bộ có phân trang, @nhân sự đủ quyền và thông báo CRM; presence đang xem/soạn có lease, giới hạn nhịp, dừng tab ẩn/offline và tăng thời gian chờ khi lỗi. Dùng identity nhóm đã xác minh của D1.
- **D3:** tạo việc ngay từ tin nhắn (xác minh nguồn trên server) hoặc panel; người nhận, hạn Việt Nam, sửa, hoàn thành/hủy/mở lại, link nguồn; nhắc báo cáo tuần và gia hạn qua dự án đã liên kết. Scheduler kiểm tra quyền hiện tại, dedupe thông báo, không gửi Zalo. Worker riêng local đã chạy; toàn bộ bảng mới nằm CRM local.
- **D4:** `/zalo-team/work` theo layout chung, Việc của tôi/Điều hành đội; tổng việc mở/quá hạn/cần xử lý/chờ khách, tải việc từng người, lọc drill-down, phân trang và mở hội thoại. Scope trước aggregation; không đếm đôi global group. Trạng thái chờ vẫn **thủ công**, chỉ tính hồ sơ đã theo dõi; chưa tính SLA tự động vì chưa có nguồn phân loại khách/nhân sự/tin hệ thống đã được nghiệm thu.
- **Bằng chứng:** 56 D1 + 46 D2–D4 fixture checks, 19 HTTP runtime checks, 325 Node checks đạt/1 skip, TypeScript đạt. Chrome đã kiểm tra các màn đọc, note tab, form tạo từ menu tin nhắn, datepicker và nút lưu đủ điều kiện; chưa ghi thử vào hội thoại khách thật. Migration mới đã chạy PostgreSQL local, worker lần đầu tạo 0 thông báo.
- **Gate còn lại:** nghiệm thu ghi với người/khách do người dùng chọn, nhiều phiên cùng thao tác và khóa PostgreSQL, soak, backup/restore dữ liệu CRM cùng metadata công việc, phát hành canary lên hai VPS. Chưa deploy/restart VPS trong lượt D này. Đây là đầu việc tiếp theo của **C**, không phải khẳng định production đã nhận bản D.

Cách sử dụng và lệnh vận hành: [README Zalo Team — Đợt D](README.ZALO-TEAM.md#đợt-d--cộng-tác-công-việc-và-điều-hành-local-09102026). Các checkpoint D1/đề xuất dưới đây giữ làm lịch sử.

**Bổ sung kiểm chứng PostgreSQL:** chuỗi claim/note/task có nguồn/alias nhóm/board/hoàn thành đã chạy trong transaction fixture riêng trên local và rollback; không giữ dữ liệu thử hoặc phát sự kiện thông báo. Kiểm thử ghi đồng thời nhiều kết nối vẫn là gate C.

### Checkpoint triển khai D1 — 09/10/2026

**Lượt hoàn thiện tiếp theo:** đã tách tab Công việc/Thông tin Zalo, dẫn thao tác theo ba bước, thêm hướng dẫn tại chỗ, nút chuyển trạng thái và phản hồi sau lưu; dự án lọc theo khách hàng, nút lọc phân công hiện ngay trên inbox. 56 kiểm tra D1 đạt và đã kiểm tra Chrome các luồng đọc/chọn/đóng modal/lọc/tab; không lưu thử vào dữ liệu khách thật. D1 vẫn local, chưa deploy/đánh giá đa nhân sự. Phần bằng chứng 53 kiểm tra và “chưa UI” dưới đây là mốc lượt triển khai ban đầu.

Người dùng đã cho phép bắt đầu D1. Source local và migration CRM local đã hoàn thành: panel liên kết lead/khách hàng/nhiều dự án, nhận việc/bàn giao, 4 trạng thái thủ công, lọc công việc và lịch sử. Tên bảng riêng `zt_crm_*`, giữ nguyên workspace thẻ; chưa deploy VPS. Chi tiết hợp đồng, quyền và cách dùng ở [README.ZALO-TEAM.md](README.ZALO-TEAM.md#d1--hồ-sơ-và-phân-công-hội-thoại-local-09102026).

Kiểm chứng: 53 kiểm tra D1 fixture, 19 HTTP boundary, 325 Node tests đạt/1 skip, TypeScript đạt. Đọc connector thật bằng local thấy 394 nguồn/333 nguồn nhóm xác minh ID, panel đọc được; không tạo liên kết hay phân công thật. Chưa gọi đây là nghiệm thu UI hoặc production; còn thử đa người dùng/ghi đồng thời PostgreSQL, backup/restore CRM và phát hành có kiểm soát. D2 ghi chú/@/presence, D3 công việc/nhắc hẹn, D4 dashboard vẫn là bước sau.

### Quyết định thứ tự và đề xuất phạm vi — 09/10/2026

Người dùng chọn **bước 4 trước bước 3**, tương ứng **D — Cộng tác CRM trước C — Vững khi dùng thật** trong lộ trình A–E này. Thứ tự phát triển mới: **A → B → D → C → E**. Đây là quyết định ưu tiên; chưa tự triển khai tính năng D hoặc deploy trong lượt thảo luận. Các cổng quyền/thu hồi quyền, migration/khôi phục và cách ly local–production vẫn phải được kiểm tra cho từng tính năng trước khi mở cho nhân sự thật.

Đối chiếu source CRM: `Customer`/`Lead` đã có nhân viên phụ trách và timeline; `Project` có customer, service, manager/sales, `zalo_group`, lịch dự án và báo cáo tuần. Trường `zalo_group` hiện có chưa đủ để khẳng định đã có mapping hội thoại bằng ID hoặc đồng bộ nghiệp vụ; cần bổ sung liên kết có xác nhận.

**Đề xuất chia D để làm gọn từng lượt:**

1. **D1 — Hồ sơ và trách nhiệm:** liên kết hội thoại/nhóm với lead, khách hàng và một hoặc nhiều dự án; panel hồ sơ bên phải; phụ trách chính, nhận việc/bàn giao, trạng thái xử lý và danh sách “Của tôi/Chưa phân công/Chờ xử lý”. Gợi ý manager/sales từ CRM nhưng người có quyền xác nhận, không tự cấp quyền Zalo hoặc CRM.
2. **D2 — Làm việc nội bộ:** ghi chú không gửi Zalo, @nhân sự có quyền, lịch sử bàn giao/thay trạng thái, dấu đang xem/đang soạn để hạn chế trả lời trùng. Chỉ thống nhất trạng thái giữa các bản nhóm khi global/canonical identity đã xác minh; không gộp theo tên/avatar.
3. **D3 — Yêu cầu và lịch chăm khách:** chuyển tin nhắn thành việc cần xử lý có người nhận, hạn, trạng thái, link nguồn và thông báo CRM; nhắc báo cáo tuần/gia hạn theo dự án; nhắc nội bộ trước, gửi khách cần người dùng xác nhận. Chưa thấy model Task trong phạm vi đã kiểm tra, nên không coi đây là module có sẵn để tái dùng ngay.
4. **D4 — Màn điều hành leader:** việc quá hạn, hội thoại chờ phản hồi, phân công và tải công việc, drill-down theo quyền. Định nghĩa tin khách/tin nhân sự/thông báo hệ thống trước khi tính SLA; nhóm chưa xác định vai trò thành viên cần đánh dấu thủ công, không lấy mọi tin đến làm tin khách.

Sau D: C kiểm chứng vận hành/restore/canary và các điểm hiệu năng B còn thiếu; E mới mở rộng chiến dịch theo dịch vụ/vòng đời khách, thư viện mẫu, gửi báo cáo có duyệt và AI tóm tắt có dẫn nguồn. Không dùng số lượng tin nhắn làm KPI hiệu quả mặc định.

Kiến trúc đề xuất: thông tin lead/customer/project và quyền nghiệp vụ do CRM làm nguồn chuẩn; phiên Zalo, lịch sử/media/Drive do VPS Zalo phụ trách. Lớp liên kết dùng ID ổn định, kiểm tra cả hai phía; không sao chép toàn bộ dữ liệu chat sang CRM để dựng panel. Nội dung ghi chú/việc làm và phạm vi xem phải được chốt trước migration. Phần này là đề xuất nghiệp vụ, chưa phải thiết kế dữ liệu được nghiệm thu.

### Lớp 1 — Cộng tác và trách nhiệm, nên làm đầu tiên

| Nâng cấp | Giá trị | Thiết kế tối thiểu |
|---|---|---|
| Người phụ trách hội thoại | Biết ai đang chăm khách, giảm bỏ sót | Assignee, team, trạng thái mở/chờ/đã xử lý; quyền xem vẫn từ ACL tài khoản |
| Nhận việc và bàn giao | Leader điều phối, người nghỉ có người tiếp quản | Claim bằng optimistic version; ghi lịch sử bàn giao; không mở rộng quyền tài khoản ngầm |
| Ghi chú nội bộ/@đồng nghiệp | Trao đổi nghiệp vụ không gửi nhầm cho khách | Editor/màu/nhãn khác rõ với gửi Zalo; quyền CRM, audit riêng |
| Chống hai người trả lời cùng lúc | Giảm câu trả lời trùng/lệch | Presence/đang soạn, lease ngắn hoặc cảnh báo; không khóa chat vĩnh viễn |
| Chờ phản hồi/SLA | Leader thấy khách đang bị bỏ quên | Dựa vào tin khách/tin trả lời, giờ làm việc; loại thông báo hệ thống và nhóm nội bộ theo cấu hình |

**Phân biệt:** “user được chia tài khoản Zalo” là quyền truy cập; “nhân viên phụ trách hội thoại” là trách nhiệm xử lý. Hai bảng/quy tắc khác nhau, không dùng assignee để lách quyền.

### Lớp 2 — Nối với CRM hiện có

- Side panel hồ sơ: liên kết customer/lead/project của X3Sales; xem người phụ trách, trạng thái, lịch hẹn và tác vụ liên quan.
- Mapping có ID, người xác nhận và lịch sử; không tự gộp khách chỉ vì trùng tên Zalo/số điện thoại chưa xác minh.
- Tạo tác vụ/nhắc hẹn từ tin nhắn, lưu link về đúng account/conversation/message; kiểm tra quyền CRM lẫn Zalo khi mở.
- Bàn giao theo phòng ban/dự án với phạm vi dữ liệu rõ; thông tin tài chính/quotation chỉ hiện nếu user có quyền CRM tương ứng.
- Tìm kiếm chung khách/hội thoại/tệp có lọc quyền trước khi trả kết quả và count, không chỉ che UI sau tìm kiếm.

### Lớp 3 — Chiến dịch chuyên nghiệp

- Thư viện mẫu theo phòng ban, phiên bản nội dung, người duyệt; preview biến thiếu và attachment chưa sẵn sàng.
- Tệp khách có snapshot lúc xác nhận, nguồn lọc/thẻ rõ; kiểm tra suppression/quyền lại trước gửi.
- Quyền tạo/duyệt/chạy/tạm dừng riêng khi cần; leader quản lý chiến dịch của team, admin quản lý toàn bộ theo phạm vi sản phẩm.
- Báo cáo gửi thành công/bỏ qua/lỗi theo reason; không gọi số gửi là số khách đã đọc hoặc chuyển đổi nếu nguồn không cung cấp bằng chứng.
- Lịch chăm sóc với tần suất phù hợp và cơ chế ngừng nhận. Không thiết kế tăng khối lượng bằng né giới hạn tài khoản.

### Lớp 4 — Báo cáo và trợ lý

- Dashboard leader: hội thoại chưa phân công, chờ phản hồi, thời gian phản hồi, tải công việc và lỗi vận hành; có drill-down tới dữ liệu được phép xem.
- AI gợi ý trả lời, tóm tắt/bàn giao hoặc trích tác vụ chỉ sau khi dữ liệu và ACL ổn định; người dùng duyệt trước gửi.
- Có nguồn tin cho tóm tắt, xử lý chỉ trong phạm vi được cấp, kiểm soát nơi gửi dữ liệu và retention; không mặc định dùng lịch sử chat để chấm điểm nhân sự.
- Đo hiệu quả bằng thời gian xử lý/bỏ sót giảm, không bằng số tính năng hoặc số tin phát ra.

## 11. Lộ trình triển khai có thể nghiệm thu

Các đợt dưới đây là lộ trình mới sau audit, không đánh đồng với các “đợt 1/2/3” đã triển khai trước đây. Ước lượng là ngày công tập trung, chưa gồm chờ upstream, pilot và xử lý dữ liệu phát sinh.

**Thứ tự cập nhật theo yêu cầu:** A → B → **D → C** → E. Giữ ký hiệu C/D để không làm sai các tham chiếu cũ; bảng bên dưới mô tả phạm vi mỗi đợt.

| Đợt | Nội dung | Ước lượng | Điều kiện ra khỏi đợt |
|---|---|---:|---|
| A — Nguồn sạch | Manifest phiên bản, 6 orphan, CSS liên quan, command/doc cũ, runtime metrics; chốt legacy dependency | 2–4 ngày | Build từ checkout sạch, kiểm thử trọng yếu, không thay dữ liệu/chức năng |
| B — Nhanh và nhẹ | Instrument baseline, archive summary/days/search, chiến dịch paging, inbox/contact virtual list, batch media metadata | 5–8 ngày | Có số đo trước/sau và đạt ngân sách trên cùng dataset |
| C — Vững khi dùng thật | Readiness, timeout/jobs, role/revoke, DR/restore, local-production isolation, release/canary | 4–7 ngày | Tắt máy dev vẫn chạy; restore drill; pilot nhân sự đạt |
| D — Cộng tác CRM | Assignee, handoff, note, customer/project link, danh sách chờ phản hồi | 6–10 ngày | Leader/user dùng được quy trình thực, không rò scope |
| E — Mở rộng có đo | Đa call/TURN nếu cần, chiến dịch duyệt/mẫu, báo cáo, AI hỗ trợ | Tách đề bài | Mỗi nhánh có case kinh doanh, capacity và nghiệm thu riêng |

### Phạm vi nên bắt đầu ngay khi triển khai A

1. Chụp manifest nguồn và phiên bản; phân loại file tracked/untracked cần release.
2. Xóa 6 module frontend ứng viên sau kiểm tra cuối; gỡ đúng CSS không dùng.
3. Rà script entrypoint PC/call; chỉ gỡ nhánh đã được chứng minh không cần; tách tên sai trách nhiệm mà chưa đổi hành vi.
4. Chuẩn hóa layout/state component, tránh đại tu editor hoặc worker cùng đợt cleanup.
5. Gọn README hiện trạng, dẫn sang lịch sử; ghi rõ local/production/capability.
6. Chạy typecheck, test trọng yếu và build sạch; diff review rồi mới xác định gói deploy.

### Cổng phát hành

- Image bất biến theo commit/digest, migration có kế hoạch rollback/forward-fix; secret ngoài source/image.
- Backup và điểm khôi phục hợp lệ trước thay schema/runtime; không restore đè dữ liệu production để “thử”.
- Canary một nhóm nhân sự/tài khoản được xác định; theo dõi error/p95/queue; ngưỡng dừng rollback được ghi trước.
- Smoke test admin/leader/user, tài khoản không quyền, search/media, logout/revoke và trường hợp local tắt.
- Gửi/call thật chỉ trong bài nghiệm thu có người nhận thử; không chạy lại chiến dịch cũ sau deploy.
- Mỗi release ghi rõ phần code, phần deploy, phần tự động kiểm tra và phần người dùng nghiệm thu.

## 12. Kết quả kiểm tra và các cổng còn thiếu

### Kết quả trong lượt audit

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `npx tsc --noEmit --pretty false -p apps/frontend/tsconfig.json` | Đạt, exit 0 | Không thay cho production build/UI |
| `npm run test:zalo` lần đầu trong sandbox | 298 đạt, 23 lỗi, 1 skip | Nhiều lỗi quyền filesystem/UDP trên Windows |
| Full offline suite với TEMP/TMP trong workspace | 316 đạt, 5 lỗi, 1 skip / 322 | 4 lỗi hard-link EPERM attribution; 1 UDP timeout portable call |
| Chạy lại riêng attribution + portable call ngoài giới hạn sandbox | 7/7 đạt | Bao gồm cả 5 ca lỗi trên; không phải gọi thật qua Zalo |
| UI local: inbox/danh bạ/lời mời/tài khoản/thẻ/chiến dịch | Đọc được các màn đã nêu; không ghi nhận warn/error trong mẫu log ngắn đã xem | Không là bằng chứng “không bao giờ lỗi” hoặc mọi thao tác đã đạt |
| Đồ thị frontend import và tra tên module | 6 module không có consumer static | Cần kiểm tra build/dynamic trước khi xóa |

Tổng hợp: **321 test có bằng chứng đạt qua full run và lượt chạy lại có phạm vi; 1 test bị skip.** Không ghi “toàn bộ 322 test đạt trong một lần”.

Log máy local: `.local/zalo-audit-20261009-tests.log`, `.local/zalo-audit-20261009-tests-workspace.log`. Đây là artifact chẩn đoán cục bộ, không đưa nguyên log lên kho công khai.

### Checklist chưa thực hiện trong lượt này

- [ ] Build production từ checkout sạch và kiểm tra bundle/route size.
- [ ] Kiểm tra image/config/tài nguyên thực tế trên hai VPS, không suy từ compose riêng lẻ.
- [ ] Laravel integration tests trên PostgreSQL gần production; query plan và số query archive.
- [ ] E2E role admin/leader/user và revoke quyền giữa phiên/giữa job.
- [ ] Soak/load test với dataset và concurrency chuẩn; thu p50/p95/heap/IO/queue.
- [ ] Gửi media, timeout sau dispatch, restart worker và đối soát receipt trong môi trường thử.
- [ ] Call end-to-end nhiều mạng; capacity nhiều cuộc gọi sau khi có thiết kế hỗ trợ.
- [ ] Khôi phục toàn dịch vụ vào môi trường cô lập, kiểm tra khi VPS cache trống.
- [ ] Nghiệm thu UI bàn phím/responsive cho toàn bộ modal và trạng thái lỗi, không chỉ màn mặc định.
- [ ] Pilot nhân sự thực và xác nhận ma trận tài khoản/phòng ban.

## 13. Chỉ mục nguồn để triển khai tiếp

Các đường dẫn tương đối bên dưới tính từ thư mục gốc dự án; các hàm/đặc điểm là căn cứ đọc code ngày 09/10, không thay thế đối chiếu khi nguồn tiếp tục thay đổi.

| Nhóm | Điểm bắt đầu |
|---|---|
| Hiện trạng/phát hành | [README.ZALO-TEAM.md](README.ZALO-TEAM.md), [README.SERVER.md](README.SERVER.md) |
| Client/query/realtime | [request.ts](apps/frontend/src/features/zalo-team/request.ts), [data-provider.tsx](apps/frontend/src/features/zalo-team/components/data-provider.tsx), [live.ts](apps/frontend/src/features/zalo-team/live.ts) |
| UI inbox/detail | [messages-layout.tsx](apps/frontend/src/app/zalo-team/messages-layout.tsx), [conversation-detail.tsx](apps/frontend/src/features/zalo-team/components/conversation-detail.tsx), [workspace-shell.tsx](apps/frontend/src/features/zalo-team/components/workspace-shell.tsx) |
| UI quản trị | [campaign-list.tsx](apps/frontend/src/features/zalo-team/components/campaign-list.tsx), [campaign-review.tsx](apps/frontend/src/features/zalo-team/components/campaign-review.tsx), [accounts-page.tsx](apps/frontend/src/features/zalo-team/components/accounts-page.tsx), [archive-page.tsx](apps/frontend/src/features/zalo-team/components/archive-page.tsx) |
| Quyền | [ZaloTeamAccess.php](apps/backend/app/Services/ZaloTeamAccess.php), [ZaloTeamIdentity.php](apps/backend/app/Services/ZaloTeamIdentity.php), [access.ts](apps/frontend/src/app/api/zalo-team/access.ts) |
| Campaign | [ZaloTeamCampaigns.php](apps/backend/app/Services/ZaloTeamCampaigns.php), [ZaloTeamCampaignWorker.php](apps/backend/app/Services/ZaloTeamCampaignWorker.php), [RunZaloTeamCampaigns.php](apps/backend/app/Console/Commands/RunZaloTeamCampaigns.php) |
| Archive | [ZaloTeamArchive.php](apps/backend/app/Services/ZaloTeamArchive.php), [ZaloTeamArchiveReport.php](apps/backend/app/Services/ZaloTeamArchiveReport.php), [ZaloTeamArchiveSearch.php](apps/backend/app/Services/ZaloTeamArchiveSearch.php) |
| Import/backup/Drive | [ZaloTeamFileImport.php](apps/backend/app/Services/ZaloTeamFileImport.php), [ZaloTeamArchiveBackup.php](apps/backend/app/Services/ZaloTeamArchiveBackup.php), [ZaloTeamDriveStore.php](apps/backend/app/Services/ZaloTeamDriveStore.php), [DRIVE.md](tooling/zalo-team/service/DRIVE.md) |
| Connector và call | [server.mjs](apps/backend/integrations/zalo/web/server.mjs), [sender-attribution.mjs](apps/backend/integrations/zalo/web/sender-attribution.mjs), [audio-worker.mjs](apps/backend/integrations/zalo/call/audio-worker.mjs) |
| Tài nguyên repo | [Web compose](tooling/zalo-team/web/compose.yml), [VPS-local compose](tooling/zalo-team/service/compose.vps-local.yml), [Frontend compose](tooling/zalo-team/service/compose.frontend.yml), [FPM override](tooling/zalo-team/service/fpm.local.conf) |

**Thứ tự đã chọn:** A → B → D → C → E. D1–D4 đã triển khai local theo checkpoint đầu mục 10; còn nghiệm thu nhiều nhân sự và các gate C trước production. SLA tự động cần phân loại nguồn tin và lịch làm việc được chốt riêng. Điều kiện quyền, dữ liệu và phát hành áp dụng xuyên suốt.
