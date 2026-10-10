# Zalo cũ — đã ngừng dùng

Luồng hiện hành: [Zalo Team](README.ZALO-TEAM.md). Cài đặt và kiểm tra: [tooling/COMMANDS.md](tooling/COMMANDS.md).

Ngày 07/10/2026, đã gỡ source/test Wine và bridge cũ sau khi xác nhận runtime Team không còn import chúng. Helper vẫn dùng đã chuyển về `apps/backend/integrations/zalo/shared/`.

- Không khởi động lại viewer/runtime PC cũ để chạy Team.
- `tooling/archive/zalo-legacy-2026-10-03/` chứa cả dữ liệu đính kèm và manifest lịch sử, được giữ nguyên; không đưa vào gói triển khai.
- Trạng thái riêng tư cũ trong các thư mục `.local`, profile, khóa và backup được giữ nguyên.
- Source đã gỡ có bản phục hồi local tại `.local/cleanup-recovery/zalo-retired-source-20261007.zip`, kèm manifest SHA-256; tài liệu cũ ở cùng thư mục. Đây là bản phục hồi source local, không phải backup dữ liệu hay thành phần deploy.
- Không thay đổi database/CRM hoặc triển khai VPS trong lượt dọn source này.
