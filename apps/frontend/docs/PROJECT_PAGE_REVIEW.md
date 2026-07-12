# Project Page Review

Cập nhật: 12/07/2026

File này tách riêng các hạng mục đã có nhưng còn cần người dùng duyệt hướng nâng cấp. Không tự triển
khai các mục bên dưới khi chưa được chốt.

## Đã Sửa Trong Đợt Này

- Trang chi tiết Project được chia thành ba tab: Thông tin dự án, Tài chính, Khách hàng.
- KPI nằm cố định trên đầu: Tổng báo phí, Đã thu, Còn phải thu, Chi phí đã chi, Lợi nhuận thực nhận.
- Bỏ các câu mô tả lặp dưới tiêu đề/label và bỏ sơ đồ chip Lead → Customer → Project khỏi màn hình.
- Nhóm 2.1 có sổ nạp quảng cáo với CID, ngày nạp/hủy, tài khoản nạp, ngân sách + VAT, tình trạng.
- Nhóm 2.2 có sổ chi phí đối tác với giảm trừ, VAT, nghiệm thu và hóa đơn đầu vào.
- Lợi nhuận lấy từ tiền thực nhận trừ khoản chi đã hoàn thành; Revenue theo kỳ không bị xóa nhưng
  tiếp tục ẩn khỏi hồ sơ Project.
- Hợp đồng được gỡ khỏi màn thêm Project và chuyển thành tab riêng trong hồ sơ Project.
- Chủ thể nhận hóa đơn mặc định snapshot từ Customer; có nút đổi sang chủ thể khác và lưu pháp nhân
  riêng trên từng hợp đồng.

## Đã Có Nhưng Cần Duyệt Trước Khi Nâng Cấp

1. **Phân bổ một giao dịch cho nhiều báo phí**
   - Hiện một Payment chỉ có một `quotation_id`.
   - Nếu một lần chuyển khoản thanh toán cho nhiều báo phí, cần thêm bảng phân bổ Payment.

2. **Hồ sơ đối tác**
   - Hiện đối tác được lưu bằng option với mã, tên, STK, ngân hàng, dịch vụ.
   - Chưa có pháp nhân, mã số thuế, người liên hệ, hợp đồng và lịch sử công nợ riêng.

3. **Tài khoản nhận tiền và tài khoản dùng để chi/nạp QC**
   - Hiện cùng dùng danh mục tài khoản công ty tại `/settings/bank-accounts`.
   - Cần xác nhận có tách hai vai trò hoặc hai danh mục ngân hàng riêng hay không.

4. **Nghiệm thu và hóa đơn đầu vào**
   - Hiện đã có trạng thái để theo dõi.
   - Chưa có số chứng từ, ngày chứng từ, file nghiệm thu và file hóa đơn đính kèm.

5. **Công thức lợi nhuận**
   - Hiện tính theo tiền mặt: tổng Payment đã vào trừ tổng chi phí `completed`, đều theo số sau VAT.
   - Cần xác nhận sau này có cần thêm lợi nhuận trước VAT, chi phí nhân sự, thuế khác hoặc lợi nhuận
     dự kiến theo báo phí hay không.

6. **Phụ lục và gia hạn hợp đồng**
   - Tab Hợp đồng hiện đã hỗ trợ nhiều Contract trong một Project.
   - Chưa tách loại chứng từ Hợp đồng/Phụ lục/Gia hạn và chưa có chuỗi liên kết giữa các phiên bản.

7. **Dữ liệu báo cáo 2.1/2.2**
   - Báo phí đã snapshot nhóm và cách tính trong metadata; ProjectCost đã tách tiền chi.
   - Chưa làm màn báo cáo/tổng hợp xuất ra cấu trúc giống từng tab Google Sheet.

8. **Thay đổi cấu hình nhóm dịch vụ sau khi đã phát sinh dữ liệu**
   - Báo phí cũ giữ snapshot nhóm, KPI vẫn cộng toàn bộ khoản chi đã hoàn thành.
   - Cần chốt cách hiển thị lịch sử nếu Project đang từ 2.1 bị đổi cấu hình sang 2.2 hoặc ngược lại.
