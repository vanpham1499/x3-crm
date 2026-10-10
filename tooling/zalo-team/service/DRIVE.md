# Kho Google Drive của Zalo Team

## Ranh giới dữ liệu

- Chỉ VPS Zalo 14.225.198.183 chạy worker Drive; giữ `/zalo-team` trong CRM. Không chạy worker trên CRM 45.252.251.120.
- PostgreSQL, tìm kiếm và ảnh xem nhanh vẫn trên VPS. Bản gốc và ZIP backup đã mã hóa được upload bất biến lên Shared Drive. Tệp trùng SHA-256 trong cùng owner chỉ lưu một lần; không chia sẻ locator giữa các owner.
- Mọi lượt đọc đi qua xác thực Team hiện có. Không phát link Drive công khai. Cache tải lạnh được kiểm tra kích thước + SHA-256 trước khi đưa vào sử dụng; phản hồi ảnh/video giữ MIME, Range và quyền truy cập hiện có.
- Key Google nằm ngoài source và `/data`; không đưa key vào image, DB, log hoặc backup. Khóa mã hóa backup cần giữ riêng để phục hồi.

## Google đã chuẩn bị ngày 07/10/2026

- Project: `x3sales-zalo-storage-20261007`, Google Drive API.
- Shared Drive `X3Sales - Zalo Team`: `0ALrS-q5WANyhUk9PVA`.
- Thư mục `Kho dữ liệu`: `120YB-3_XyDDR7Euo-xDXpz8Tjhkid4Ut`.
- Principal: `zalo-drive-worker@x3sales-zalo-storage-20261007.iam.gserviceaccount.com`.
- Cấp Contributor trên **kho riêng này**, không cấp quyền IAM vào project hoặc domain-wide delegation. Chỉ một key phục vụ VPS; key không được ghi trong tài liệu.

## Cấu hình và chạy

Trong `service.env` của VPS (không commit):

```dotenv
ZALO_TEAM_DRIVE_ENABLED=true
ZALO_TEAM_DRIVE_CREDENTIALS_FILE=/run/secrets/drive_credentials
ZALO_TEAM_DRIVE_SHARED_ID=0ALrS-q5WANyhUk9PVA
ZALO_TEAM_DRIVE_FOLDER_ID=120YB-3_XyDDR7Euo-xDXpz8Tjhkid4Ut
ZALO_TEAM_DRIVE_CACHE_BYTES=5368709120
ZALO_TEAM_DRIVE_EVICT=false
# Có thể loại account test bằng external ID (cấu hình riêng, không ghi ID thật vào source):
ZALO_TEAM_DRIVE_EXCLUDED_ACCOUNTS=
ZALO_TEAM_DRIVE_BACKUPS_AFTER=
```

Host key: `tooling/zalo-team/service/secrets/drive-credentials.json`, owner UID/GID 82, mode 0600, parent riêng tư. Compose mount file read-only vào API và worker cần đọc tệp. Bổ sung migration `2026_10_07_000210_create_zalo_archive_drive_objects.php` bằng `zalo-team:migrate` trên DB riêng trước khi bật.

```sh
docker compose -f compose.vps-local.yml -f compose.drive.yml run --rm drive php artisan zalo-team:drive --check
docker compose -f compose.vps-local.yml -f compose.drive.yml up -d api sync backup drive
```

8 worker, mỗi worker 256 MiB/1 CPU, PHP 192 MiB; idle 15 giây, log tối đa 4 MB/worker. Tệp ≤ 8 MiB dùng multipart, tệp lớn resumable chunk 8 MiB; file ID ghi DB trước upload. Mất phản hồi thì tra ID hoặc offset từ Google, không tự coi byte đã gửi là đã lưu. Lỗi tự thử lại có backoff tối đa 1 giờ. Tab Server có thống kê riêng và nút yêu cầu thử lại. Khóa upload độc lập với cache/read nên tải nền không giữ khóa mở file.

`EVICT=false` là giai đoạn an toàn ban đầu. Chỉ bật sau PoC thật upload/download/SHA-256, đọc cold cache và restore encrypted backup. Khi bật, chỉ bỏ **bản cache VPS** của object đã verified, kiểm tra lại remote hash/quyền ngay trước khi bỏ. Giữ ảnh xem nhanh, manifest nhỏ và tệp vừa dùng trong 1 giờ. Giới hạn cache là mục tiêu cho tệp có thể dọn, cộng thêm ảnh xem nhanh, dữ liệu chưa upload và tệp đang dùng. Không tuyên bố đây là trần tổng dung lượng ổ đĩa.

### Cấu hình sau dọn test 07/10/2026

- Hai tài khoản test đã gỡ, kho VPS/backup/hàng đợi về 0. Folder cũ vào thùng rác theo yêu cầu, chưa purge; folder mới trống như cấu hình trên.
- EXCLUDED_ACCOUNTS và BACKUPS_AFTER để trống; tài khoản mới dùng luồng Drive bình thường. Image/secret/8 worker/EVICT=true/cache 5 GiB giữ nguyên. Lệnh --check đạt sau đổi folder.

### Mốc nghiệm thu trước khi dọn (lịch sử)

- `EVICT=true`, 5 GiB, đã kiểm chứng bằng Drive thật. Image `drive-storage-20261007`, manifest `sha256:5107761bd95220cf3b77af1aba2db15dbefa19a7111b3fa403d59ba1f5bce300`.
- Theo yêu cầu mới không chuyển hết kho test: loại hai external account test hiện có trong `ZALO_TEAM_DRIVE_EXCLUDED_ACCOUNTS`; backup tạo trước `ZALO_TEAM_DRIVE_BACKUPS_AFTER` không tự backfill. Tệp dùng chung được phép xếp hàng nếu có observation từ account không bị loại, vẫn đối chiếu owner. Không lọc theo ngày tin nhắn cũ/mới.
- 2.005 object test chưa hoàn tất có state `deferred`; giữ nguồn local, Drive ID và upload session. Worker/retry lỗi không tự bật lại deferred. Nếu một account mới thật sự có cùng hash, scanner đưa object về pending và tiếp tục cùng ID. Không xóa tệp test để đánh dấu hoàn thành.
- 521 object / 319.301.302 byte đã verified (519 archive, 1 backup manifest, 1 encrypted backup blob). Phần còn lại của snapshot test vẫn ở VPS; **chưa có bản backup đầy đủ ngoài VPS của kho test**. Backup mới sau mốc cấu hình tự chuyển nguyên snapshot và encrypted blob; bản snapshot mới vẫn bao gồm dữ liệu owner theo chức năng backup hiện tại.
- Đo lúc nhàn: 8 worker ~244,5 MiB tổng. CRM/Tiny House không đổi; local frontend + tunnel vẫn như trước. Backup metadata/khóa cần được giữ riêng nếu phục hồi sau mất VPS.

## Khôi phục khi mất DB locator

Giữ cùng project/service account hoặc ứng dụng có thể đọc `appProperties`, folder và key backup. Worker không xóa/ghi đè file Drive. Mỗi file chứa owner, kind, object key, SHA-256 trong appProperties; không chứa tên/người gửi/nội dung chat.

```sh
php artisan zalo-team:drive --recover-owner=<owner-hash>
php artisan zalo-team:archive-restore <original-user-id> <backup-uuid>
# Thêm --apply sau khi xác minh để chỉ bổ sung dữ liệu còn thiếu.
```

`--recover-owner` chỉ thêm locator còn thiếu, không ghi đè locator đang có. Sau đó dùng luồng discover/verify/restore backup hiện tại; manifest và encrypted blobs tự tải từ Drive khi cache trống. Không khôi phục đè nội dung hiện tại hoặc gửi dữ liệu về Zalo.

## Bảo vệ xóa và giới hạn

Shared Drive Contributor đọc/thêm/sửa được, không chuyển tệp vào Trash hay xóa vĩnh viễn. Code không có API delete/trash/overwrite/sharing và từ chối cấu hình có quyền xóa thư mục đích. Kiểm tra thêm quyền xóa/trash trên từng tệp trước khi xác nhận bản remote hoặc dọn cache.

Google Drive không cung cấp khóa mật khẩu/OTP riêng cho từng lần xóa thư mục trong luồng tiêu chuẩn được khảo sát. Manager/Workspace admin vẫn có quyền quản trị; xác thực 2 bước bảo vệ đăng nhập, không bảo đảm hỏi lại khi xóa. Muốn người dùng thường không xóa được, dùng tài khoản quản trị riêng làm Manager và chỉ cấp Contributor/Viewer cho tài khoản hằng ngày. Chưa thay vai trò quản trị hoặc bật chính sách toàn domain.

Contributor vẫn sửa nội dung được: đây là hạn chế quyền xóa, **không phải kho bất biến/WORM**. Cần lớp retention độc lập nếu yêu cầu chống cả tài khoản quản trị bị chiếm. Vault chỉ cân nhắc khi gói hiện có hỗ trợ và đã chốt chính sách; không tự bật retention trả phí.

Nguồn: https://support.google.com/a/users/answer/12380484 và https://developers.google.com/workspace/drive/api/guides/manage-uploads.

## Kiểm thử

`tooling/tests/zalo-team-drive.php`: SQLite/tệp tạm, transport giả, kiểm tra resume, lost acknowledgement, không trùng, hash sai, quyền owner, quyền xóa, cache pin, giữ preview, cache eviction và backup mã hóa/khôi phục locator. Kết quả tự động không thay thế PoC Drive thật; nhật ký nghiệm thu thực tế nằm README.ZALO-TEAM.md.

Kết quả: storage 41, archive/restore 15, metrics collector 7 đạt; PoC thật upload/cold download/SHA-256/giải mã backup mẫu đạt. Không chạy restore ghi đè DB thật hoặc chuyển hết 9.611 blob test. Tab Server đã đối chiếu trên Chrome; tài khoản thật mới do người dùng thêm là bước nghiệm thu sử dụng tiếp theo.
