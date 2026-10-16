# CRM finance release — 16/10/2026

Kích hoạt lúc khoảng 17:29 giờ Việt Nam tại https://crm.x3sales.com.

## Phiên bản và phạm vi

- Source: `34f1526`, nhánh `codex/finance-recognition-20261016`.
- Images: `x3crm-backend:finance-20261016-34f1526` và `x3crm-frontend:finance-20261016-34f1526`.
- DV1 đề xuất toàn bộ phí theo tháng nạp đủ tiền thật; DV3 nhập tháng hoàn thành độc lập ngày thu/chi.
- Xác nhận lần đầu không cần lý do; điều chỉnh/gỡ vẫn cần lý do. Nút hàng loạt hiển thị trực tiếp, chọn xuyên trang tối đa 500 khoản/lượt.
- Danh sách dự án phân trang SQL, chi tiết tải riêng. Tổng hợp/hàng chờ quét server theo lô 100 dự án; trình duyệt không tải toàn bộ nguồn của hơn 1.000 dự án.
- Gồm các sửa UI chưa triển khai trước đó: popup và phân trang CRM dùng chung.

## Build và dữ liệu

- Build từ git archive, backend dùng `tooling/deployment/production/backend-release.Dockerfile`, kiểm tra composer.lock với image nền.
- Frontend dùng **`tooling/zalo-team/service/frontend.Dockerfile` với `ZALO_TEAM_RUNTIME=crm`**: Node 22, root package-lock, cấu hình PDF của repo. Dockerfile production cũ dùng Next config thay thế bị lỗi PDF worker; không dùng artifact của lần build lỗi.
- Hai archive được kiểm tra SHA256 trên VPS trước khi nạp image.
- Sao lưu PostgreSQL và cấu hình trước chuyển; giữ image `crm-20261016-8d36032` để rollback code. Không khôi phục DB local hoặc ghi đè uploads.
- Chạy duy nhất migration `2026_10_16_000500_add_quotation_work_completion.php` (nullable date), batch 46. Không seed/backfill.
- Đối chiếu trước/sau trong lúc dừng ghi: số bản ghi, tổng tiền nghiệp vụ và KPI tháng 9 không đổi. Rollback code giữ cột nullable và dữ liệu phát sinh.

## Bằng chứng

- 62 kiểm tra đề xuất/hàng loạt/DV3/phân trang + 43 kiểm tra sổ đối tác đạt trên local, toàn bộ fixtures rollback.
- TypeScript, PHP syntax, production build 55 trang đạt.
- Production đọc được 1.258 dự án; API trả 10 dòng/trang và không có nguồn chi tiết trong danh sách. Hai trang không trùng.
- Hàng chờ tại thời điểm kiểm tra: 43 sẵn sàng, 210 cần kiểm tra, 35 chờ điều kiện. Chọn xuyên trang trả đúng 43 nguồn đủ điều kiện.
- Cả 5 dịch vụ backend/frontend/scheduler/queue-worker/reverb đúng image, running, restart 0, không OOM.
- `/login`, `/api/`, `/zalo-team` HTTP 200; bulk API chưa đăng nhập trả 401; WebSocket 101.
- Kiểm tra UI production bằng phiên đăng nhập: chức năng hàng loạt xuất hiện và danh sách phân trang mới hoạt động. Không ghi nhận các khoản tài chính thật để thử; nghiệm thu chứng từ cụ thể do người dùng thực hiện.

Backup, cấu hình và script rollback được giữ riêng trong thư mục release trên VPS; không chứa thông tin đăng nhập trong tài liệu này.
