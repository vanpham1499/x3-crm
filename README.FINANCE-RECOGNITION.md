# Đề xuất kỳ ghi nhận và xác nhận hàng loạt

## Cách dùng

1. Nhân sự tạo **Chi phí đối tác** tại tài chính dự án và chọn **Kỳ công việc**. Trường này bắt buộc cho khoản mới; không lấy ngày trả tiền làm kỳ công việc.
2. Kế toán vào **Chi phí → Công nợ & lợi nhuận**, chọn tháng và tìm dự án nếu cần.
3. Tab **Chờ xác nhận** hiển thị đề xuất đủ dữ liệu của tháng đang chọn. Tích từng khoản hoặc chọn tất cả theo bộ lọc, kể cả các trang chưa mở (tối đa 500 khoản mỗi lần).
4. Bấm **Xác nhận đã chọn**, xem tháng và số tiền trong popup rồi xác nhận. Khoản có nhiều tháng sẽ ghi nhận toàn bộ các phần đang hiển thị, không chỉ tháng lọc.
5. **Cần kiểm tra** dành cho khoản thiếu thông tin, nguồn thay đổi, cơ cấu chưa rõ hoặc kỳ đã chốt. Bấm mã dự án để mở chi tiết và xác nhận/điều chỉnh riêng. **Chờ đủ điều kiện** dành cho khoản chưa nạp/thu đủ hoặc chưa đến kỳ.

## Quy tắc đề xuất

| Nguồn | Kỳ đề xuất |
| --- | --- |
| Báo phí có ngân sách quảng cáo | Theo ngày của các lần nạp tiền thật đã hoàn tất và đủ ngân sách báo phí. Nếu nạp nhiều tháng, phí dịch vụ phân bổ theo tỷ trọng giá trị nạp; tổng phân bổ giữ đúng số tiền. |
| Báo phí không có ngân sách, gồm loại K | Tháng thực nhận đủ tổng thanh toán báo phí. Dùng ngày giao dịch gốc, không dùng ngày nhập/phân bổ lại trên CRM. |
| Chi phí đối tác/FL | Kỳ công việc đã nhập, kể cả chưa thanh toán. Trả tiền sau không chuyển kỳ chi phí hoặc trừ hai lần. |

- Giá trị doanh thu vẫn dùng cơ cấu dịch vụ trước VAT hiện hành; ngân sách, cọc và MKM không trở thành doanh thu dịch vụ.
- MKM nền tảng tặng không được cộng vào tiền nạp thật để thỏa điều kiện đủ ngân sách.
- Ưu tiên liên kết lần nạp với báo phí. Chỉ dùng lần nạp chưa liên kết khi dự án có duy nhất một báo phí ngân sách còn hiệu lực. Nhiều báo phí hoặc tổng nạp vượt ngân sách phải kiểm tra riêng.
- Khoản có hoàn tiền/sự cố CID, thiếu ngày thực nhận/ngày nạp không được tự đề xuất sẵn sàng.
- Khoản cũ thiếu kỳ công việc được giữ riêng; không âm thầm gán ngày chi cũ thành tháng công việc.
- Đề xuất chỉ hỗ trợ kế toán quyết định; không tự chốt dữ liệu khi mở trang hoặc deploy. Các kỳ đã xác nhận không bị ghi đè.
- Không sửa công thức KPI nhân sự, dòng tiền ngân hàng hoặc dữ liệu thanh toán.

## Kiểm soát

- Kiểm tra quyền từng nguồn trên server, không tin phạm vi do trình duyệt gửi.
- Trước khi ghi nhận, tính lại đề xuất và so với bản người dùng đã xem. Nguồn thay đổi hoặc kỳ bị chốt sẽ hủy toàn bộ lần xác nhận, không ghi một phần.
- Mã yêu cầu chống ghi trùng khi bấm lại hoặc mạng gián đoạn; lưu người xác nhận, thời điểm, nội dung và lịch sử từng khoản.
- Có thể điều chỉnh/gỡ theo luồng cũ khi kỳ còn mở và có quyền. Không chạy migration hoặc backfill cho đợt này.

## Kiểm tra local

- 43 kiểm tra hồi quy sổ đối tác đạt; 23 kiểm tra đề xuất/xác nhận hàng loạt đạt, fixtures rollback.
- Kiểm tra TypeScript đạt. Giao diện desktop và 390px đã kiểm tra; mở popup 28 khoản rồi hủy, không xác nhận dữ liệu thật.
- Build và kiểm tra production được ghi trong biên bản phát hành tương ứng sau khi deploy.
