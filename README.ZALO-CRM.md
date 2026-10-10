# CRM → Zalo: gửi tài liệu khách hàng

## Hiện trạng 09/10/2026

Đợt 1 đã triển khai **local**: cấu hình nhóm nhận trên dự án/khách hàng, gửi báo phí và báo cáo tuần đã duyệt, xem trước PDF/ảnh và lịch sử. Migration `2026_10_09_000260_create_zalo_crm_deliveries` đã chạy trên PostgreSQL local. Chưa deploy VPS và chưa gửi tài liệu thật để nghiệm thu.

Mỗi dự án/khách hàng chọn **một nhóm nhận chính và một tài khoản gửi cố định**. Chưa có gửi tự động theo thanh toán, gửi báo cáo theo lịch, hay nhiều nhóm nhận theo từng loại thông báo.

## Cách dùng

### 1. Chọn nhóm nhận

1. Mở hồ sơ **Dự án** hoặc **Khách hàng** → **Nhóm Zalo nhận tài liệu**.
2. Chọn **Chọn nhóm riêng** → tài khoản gửi → tìm đúng nhóm → **Lưu liên kết**.
3. Với dự án, có thể chọn **Dùng nhóm của khách hàng** nếu muốn kế thừa. Dự án chưa cấu hình sẽ không tự kế thừa.

Cũng có thể mở cấu hình ngay trong hộp **Gửi Zalo**. Nhóm được lấy từ tài khoản đã chọn; các nhóm chưa có định danh chung được xác minh không được dùng làm nơi nhận. Mở hội thoại trong Zalo Team rồi tải lại nếu nhóm chưa xuất hiện.

**Chưa bật gửi tài liệu** ngăn các lượt chưa gửi sử dụng cấu hình đó. Cấu hình này không tự gán người phụ trách hoặc sửa các liên kết CRM trong hồ sơ hội thoại.

### 2. Gửi báo phí

1. Lưu báo phí → mở **Bản gửi khách**. Kiểm tra số tiền, ngân hàng và QR như thường lệ.
2. Bấm **Gửi Zalo** → chọn **PDF** (mặc định) hoặc **Ảnh**.
3. Kiểm tra bản tài liệu trong khung xem trước, tên nhóm và tài khoản gửi. Có thể thêm lời nhắn.
4. Bấm **Xác nhận gửi** một lần. Không cần tải tệp về máy.

Báo phí chỉ gắn lead cần gắn với dự án/khách hàng trước. Báo phí đã hủy không được gửi. Nếu báo phí hoặc nơi nhận thay đổi trong lúc chuẩn bị, hệ thống yêu cầu mở lại bản gửi khách.

### 3. Gửi báo cáo tuần

1. Báo cáo phải có trạng thái **Đã duyệt**.
2. Mở **Bản gửi khách** → **Gửi Zalo**.
3. Mặc định là **Ảnh**, có thể chuyển sang PDF.
4. Kiểm tra nhóm nhận, bản xem trước và xác nhận.

Chỉ vùng bản gửi khách được xuất; hộp trao đổi nội bộ và các nút quản trị không nằm trong tài liệu. Lưu/sửa/duyệt báo cáo không tự gửi Zalo.

### 4. Xem kết quả

Lịch sử nằm trong hộp **Gửi Zalo**, hiển thị 15 lượt gần nhất mà người dùng còn có quyền truy cập.

| Trạng thái | Ý nghĩa / thao tác |
| --- | --- |
| Chờ gửi | Đã lưu yêu cầu; worker sẽ xử lý. Có thể hủy phần chưa gửi. |
| Đang gửi | Worker đang chuẩn bị hoặc gửi. |
| Đã gửi | Connector xác nhận tất cả phần tin. Không có nghĩa người nhận đã đọc. |
| Cần xử lý | Kiểm tra nguyên nhân rồi bấm **Tiếp tục phần chưa gửi**. |
| Chưa xác nhận | Có thể đã tới Zalo nhưng mất phản hồi. Bấm **Kiểm tra kết quả**; không tự gửi lại. |
| Đã hủy | Dừng phần còn lại; các phần đã gửi vẫn giữ nguyên. |

Lời nhắn và tài liệu là hai phần riêng; nếu lời nhắn đã gửi thì tiếp tục chỉ xử lý tài liệu. Kiểm tra kết quả dùng biên nhận của lượt cũ, không tạo tin mới. Nếu vẫn chưa xác nhận, đối chiếu hội thoại; không tạo nhiều lượt mới để thử.

**Bản đã lưu** tải lại đúng tệp đã xác nhận gửi từ CRM. Tệp của lượt đã gửi/đã hủy được giữ 30 ngày, sau đó scheduler dọn tệp nhưng giữ lịch sử. Tệp đang chờ, lỗi hoặc chưa xác nhận được giữ để xử lý tiếp. Giới hạn 25 MiB/tệp, PDF/PNG/JPG. Bản sao nằm trong vùng private của CRM; đây không phải kho sao lưu Drive dài hạn.

## Phân quyền

- Xem/gửi: xem được báo phí/báo cáo, hồ sơ dự án/khách hàng liên quan và có quyền **Sử dụng** tài khoản Zalo đã cấu hình.
- Đổi nhóm nhận: sửa được hồ sơ dự án/khách hàng và có quyền Sử dụng tài khoản gửi.
- Người tạo lượt gửi hoặc admin mới được tiếp tục/hủy/kiểm tra lượt gửi.
- Worker đọc lại người dùng, quyền, phiên bản tài liệu và cấu hình nhóm. Nhân sự bị khóa/thu hồi quyền không được tiếp tục gửi bằng quyền cũ.
- Mất kết nối không tự thay tài khoản gửi. Tài khoản bị thay danh tính làm liên kết cũ không còn dùng được.
- Nhóm cùng global ID qua nhiều tài khoản được xem là cùng nơi nhận khi chống lặp nội dung.
- Tên người gửi CRM được chuyển cho connector để ghi nhận như tin nhắn từ Zalo Team.

## Chạy local

```powershell
npm run dev:frontend
npm run dev:backend
```

Worker tài liệu, chạy terminal riêng nếu cần:

```powershell
npm run dev:zalo-documents
```

Nếu đã chạy `npm run dev` với scheduler, tác vụ được kiểm tra mỗi phút; không cần thêm worker. `--watch` kiểm tra hàng đợi mỗi 3 giây. Hai cách dùng chung khóa để không xử lý đồng thời các lượt tài liệu trong cùng CRM. Worker chỉ nhận lượt đã bấm xác nhận, không tự tạo thông báo thanh toán/báo cáo.

Trong phiên triển khai này frontend và worker tài liệu đã được khởi động ẩn. Log: `.local/document-ui-frontend*.log`, `.local/zalo-document-worker*.log`. Không khởi động thêm frontend khi cổng 3000 đã chạy.

## Kiến trúc và deploy

- CRM sở hữu `zt_crm_delivery_routes`, `zt_crm_deliveries`; migration không thuộc tập schema VPS Zalo.
- API `/api/zalo-team/documents/*`: Sanctum + tài khoản hoạt động + quyền nghiệp vụ.
- `ZaloCrmDocuments` quản lý cấu hình/nguồn/ý định gửi; `ZaloCrmDocumentWorker` dùng connector hiện có. Không cần thay connector đợt này.
- Tệp dựng trong trình duyệt từ bản gửi khách, người dùng xem trước và xác nhận. Server lưu hash, nguồn, phiên bản và người thực hiện. Đây chưa phải dịch vụ kết xuất tài liệu có chữ ký phía server.
- Mỗi phần tin có UUID, trạng thái lưu trước dispatch. Timeout/crash chuyển sang chưa xác nhận; đối soát bằng `checkOnly`.
- Khóa worker tài liệu độc lập với lịch chiến dịch. Điều tiết hạn mức chung giữa chiến dịch, tài liệu và thông báo tự động cần hoàn thiện trước khi bật tự động số lượng lớn.
- Worker chỉ chạy tại CRM sở hữu dữ liệu; runtime `zalo` từ chối lệnh này.
- Deploy gồm CRM API, frontend CRM, migration, volume private bền vững và worker/scheduler cùng bản code. PHP/nginx phải cho phép multipart 25 MiB cộng overhead. Secrets dùng cấu hình connector hiện có.
- Scheduler chạy `zalo-team:deliver-documents --prune` mỗi ngày 02:20 theo timezone ứng dụng. Nếu chỉ chạy `--watch`, cần scheduler hoặc lịch tương đương để dọn.
- Local và production là hai nguồn độc lập. Đợt 1 gửi thủ công; không bật tự động thanh toán ở cả hai môi trường.

## Kiểm chứng

- 33 checks SQLite in-memory, native transport giả lập, chặn HTTP ngoài: ACL, kế thừa, phiên bản cũ, idempotency, global ID, gửi từng phần, unknown/checkOnly, thu hồi quyền giữa upload, crash, khóa worker và retention.
- Regression chiến dịch đạt sau khi dùng chung hàm upload.
- TypeScript toàn frontend đạt; Pint các file PHP mới đạt.
- Kiểm tra cùng schema PostgreSQL local: cấu hình, phiên bản, tệp và hai phần gửi dùng transport giả; transaction rollback, xác nhận không còn account/route fixture.
- Trình duyệt local: PDF/ảnh báo phí, danh sách tài khoản/nhóm từ connector, layout desktop/375px. Không lưu nhóm thật, không tạo lượt gửi, không gửi tin thật.
- Một báo cáo cũ có ảnh `/uploads/media/2026/10/clipboard-1791187176740-q2h7wkupbo.png` không tồn tại trong bản local. Bản gửi bị chặn đúng lúc vì ảnh chưa tải được; cần khôi phục ảnh nguồn đó trước khi nghiệm thu báo cáo này. Không bỏ qua ảnh lỗi để gửi một báo cáo thiếu dữ liệu.
- Chưa nghiệm thu gửi thật tới nhóm do quản trị chọn; chưa deploy production. Kiểm thử giả lập không thay thế gate này.

## Tiếp theo

1. Nghiệm thu một báo phí và một báo cáo đã duyệt vào nhóm thử do quản trị chọn: tên người gửi CRM, tệp nhận và đối soát timeout.
2. Thanh toán tự động: sự kiện sau commit đối soát/phân bổ thành công; chống lặp theo giao dịch + dự án + loại thông báo. Không gửi giao dịch chưa xác định khách hàng hoặc chỉ mới nhận webhook.
3. Báo cáo tự động sau duyệt/lịch đã chốt; kết xuất phía server; nhiều đích theo loại thông báo; giới hạn gửi chung và giám sát vận hành.
