# Đề xuất kỳ ghi nhận và xác nhận hàng loạt

## Cách dùng

1. Với DV3, nhân sự vào **Dự án → Tài chính → Báo phí → Tháng hoàn thành**, chọn tháng hoàn thành thực tế và lưu. Lần đầu không cần nhập lý do; chỉ cần lý do khi sửa/gỡ tháng đã lưu. Mỗi báo phí là một đợt công việc; dự án có nhiều đợt nhập riêng từng báo phí. Kế toán cũng có thể mở nút này trong popup chi tiết Công nợ & lợi nhuận nếu có quyền. Khi tạo **Chi phí đối tác**, chọn **Kỳ công việc** tương ứng; không lấy ngày trả tiền làm kỳ công việc.
2. Kế toán vào **Chi phí → Công nợ & lợi nhuận**, chọn tháng và tìm dự án nếu cần.
3. Bấm nút xanh **Xác nhận hàng loạt** trên thanh **Kỳ ghi nhận**. Bấm **Chọn tất cả đủ điều kiện** để chọn xuyên các trang theo tháng/từ khóa hiện tại; tối đa 500 khoản mỗi lượt. Với 1.000 khoản đủ điều kiện, xác nhận 500 khoản rồi chọn lượt tiếp theo. Vẫn có thể tích từng khoản hoặc **Chọn trang này**, bỏ chọn các khoản cần kiểm tra. Đổi tháng/từ khóa sẽ xóa lựa chọn cũ.
4. Bấm **Xác nhận đã chọn**, xem tháng và số tiền trong popup rồi xác nhận, không cần gõ lý do. Xác nhận lần đầu từng khoản cũng không cần lý do. Server kiểm tra lại điều kiện trước khi ghi nhận, tự lưu nội dung, người và thời điểm xác nhận trong lịch sử. Điều chỉnh/gỡ kỳ đã xác nhận vẫn cần lý do.
5. **Cần kiểm tra** dành cho khoản thiếu thông tin, nguồn thay đổi, cơ cấu chưa rõ hoặc kỳ đã chốt. Bấm mã dự án để mở popup chi tiết và xác nhận/điều chỉnh riêng. **Chờ đủ điều kiện** dành cho khoản chưa nạp/thu đủ hoặc chưa đến kỳ.

Trang chính chỉ giữ bộ lọc, số tổng hợp và bảng dự án. Các danh sách chờ xác nhận/kiểm tra và chi tiết dự án mở trong popup; đóng popup giữ bộ lọc và vị trí danh sách.

## Quy tắc đề xuất

| Nguồn | Kỳ đề xuất |
| --- | --- |
| DV1/báo phí có ngân sách quảng cáo (không thuộc DV3) | Toàn bộ phí dịch vụ thuộc tháng của lần nạp khiến tổng nạp tiền thật hoàn tất đạt đủ ngân sách báo phí. Ví dụ nạp 6 triệu tháng 9 và 4 triệu ngày 1/10 cho ngân sách 10 triệu: ghi nhận toàn bộ phí tháng 10. Không chia phí ngược về tháng 9. |
| DV3 và các dịch vụ con DV3.* | Tháng hoàn thành do nhân sự xác nhận trên báo phí, kể cả khách chưa trả tiền hoặc đã trả đối tác trước. Chưa nhập tháng thì vào Cần kiểm tra, không tự lấy ngày thanh toán. |
| Báo phí khác không có ngân sách, gồm DV1 loại K | Tháng thực nhận đủ tổng thanh toán báo phí. Dùng ngày giao dịch gốc, không dùng ngày nhập/phân bổ lại trên CRM. |
| Chi phí đối tác/FL | Kỳ công việc đã nhập, kể cả chưa thanh toán. Trả tiền sau không chuyển kỳ chi phí hoặc trừ hai lần. |

- Giá trị doanh thu vẫn dùng cơ cấu dịch vụ trước VAT hiện hành; ngân sách, cọc và MKM không trở thành doanh thu dịch vụ.
- MKM nền tảng tặng không được cộng vào tiền nạp thật để thỏa điều kiện đủ ngân sách.
- Ưu tiên liên kết lần nạp với báo phí. Chỉ dùng lần nạp chưa liên kết khi dự án có duy nhất một báo phí ngân sách còn hiệu lực. Nhiều báo phí hoặc tổng nạp vượt ngân sách phải kiểm tra riêng.
- Khoản có hoàn tiền/sự cố CID, thiếu ngày thực nhận/ngày nạp không được tự đề xuất sẵn sàng.
- Khoản cũ thiếu kỳ công việc được giữ riêng; không âm thầm gán ngày chi cũ thành tháng công việc.
- Đề xuất chỉ hỗ trợ kế toán quyết định; không tự chốt dữ liệu khi mở trang hoặc deploy. Các kỳ đã xác nhận không bị ghi đè.
- Không sửa công thức KPI nhân sự, dòng tiền ngân hàng hoặc dữ liệu thanh toán.

### Phạm vi KPI

Đã kiểm tra: `KpiFeeEvents` vẫn tính KPI từ phí quản lý theo tiền thu, là chính sách đã chốt từ tháng 10/2026. Sổ `partner_finance_recognitions` phục vụ Công nợ & lợi nhuận và biểu đồ Lợi nhuận dự án; chưa thay kỳ của KPI nhân sự. Vì vậy hai chỉ tiêu có thể khác kỳ. Đợt này không tự chuyển các khoản KPI cũ sang tháng nạp đủ/hoàn thành, không cộng doanh thu sổ mới vào KPI lần nữa.

### Tháng hoàn thành và dữ liệu đã ghi nhận

- Quyền nhập dựa trên quyền xem báo phí và quyền cập nhật báo phí/quản lý chi phí/phê duyệt/cấp tiền của đúng dự án.
- Lưu người sửa, ghi chú và tháng trước/sau trong Lịch sử; chặn ghi đè khi người khác vừa sửa.
- Không xác nhận hoàn thành cho tháng tương lai hoặc sửa kỳ đã chốt. Báo phí đã ghi nhận phải gỡ ghi nhận có lý do rồi mới đổi tháng hoàn thành; sau đó kế toán xác nhận lại.
- Dữ liệu đã ghi nhận trước thay đổi này được giữ nguyên, không tự tính lại hay backfill.

## Phân trang và tải dữ liệu

- API bảng dự án nhận `period`, `keyword`, `page`, `per_page` (10/20/50/100), phân trang bằng SQL. Trả tổng số dự án và tóm tắt đúng trang, không kèm báo phí/chi phí/lịch sử thanh toán.
- Mở popup dự án mới gọi API chi tiết theo ID; vẫn kiểm tra quyền trên server.
- Số tổng hợp và số khoản chờ có API riêng trên toàn bộ phạm vi lọc, không cộng từ trang đang mở.
- Popup chờ xác nhận/cần kiểm tra/chờ đủ điều kiện gọi API theo trang riêng. Điều kiện đề xuất được tính từ các nguồn liên quan, quét theo lô tối đa 100 dự án trên server; chỉ trả các khoản của trang yêu cầu. Đây chưa phải bảng chỉ mục đề xuất lưu sẵn.
- Xác nhận hàng loạt tính lại các dự án chứa khoản được chọn, không tải lại toàn bộ danh sách dự án.
- Đo local 1.247 dự án: trang 10 dòng khoảng 2,7 KB / 0,11 giây ở tầng service. Tổng hợp và hàng chờ khoảng 3 giây; thời gian này không phải SLA production.

## Kiểm soát

- Kiểm tra quyền từng nguồn trên server, không tin phạm vi do trình duyệt gửi.
- Trước khi ghi nhận, tính lại đề xuất và so với bản người dùng đã xem. Nguồn thay đổi hoặc kỳ bị chốt sẽ hủy toàn bộ lần xác nhận, không ghi một phần.
- Mã yêu cầu chống ghi trùng khi bấm lại hoặc mạng gián đoạn; lưu người xác nhận, thời điểm, nội dung và lịch sử từng khoản.
- Có thể điều chỉnh/gỡ khi kỳ còn mở và có quyền. Migration chỉ thêm cột tháng hoàn thành nullable; không tự ghi nhận hoặc backfill dữ liệu cũ.

## Kiểm tra local

- 43 kiểm tra hồi quy sổ đối tác và 62 kiểm tra đề xuất/xác nhận hàng loạt/DV3/phân trang đạt; fixtures rollback. Bao gồm 1.005 dự án giả, trang cuối/rỗng/tìm kiếm, tổng độc lập trang, quyền truy cập, chọn xuyên trang, giới hạn 500/501 khoản và xác nhận lần đầu không lý do.
- TypeScript, PHP syntax và `git diff --check` đạt. Kiểm tra giao diện local: chuyển trang dự án, chuyển trang hàng chờ giữ 10 lựa chọn, popup DV3, nút ở tài chính dự án; popup nhập tháng nằm trong chiều rộng 390px. Không lưu/xác nhận dữ liệu kinh doanh thật trong kiểm tra UI.
- Migration mới: `2026_10_16_000500_add_quotation_work_completion.php`, thêm cột nullable; đã chạy local, chưa chạy VPS.
- Bản trước vẫn chạy trên VPS theo yêu cầu giữ phiên bản. Đợt sửa này chưa deploy.
