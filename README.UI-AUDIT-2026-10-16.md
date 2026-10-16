# Rà soát giao diện CRM — 16/10/2026

## Phạm vi và chuẩn đối chiếu

Đối chiếu thay đổi giao diện từ các commit ngày 10–16/10/2026 (sau `8a1ce30`) với trang Dự án. Rà mã nguồn các màn hình đã thay đổi, sau đó kiểm tra trình duyệt tại các điểm vừa sửa. Không coi rà mã nguồn là đã nghiệm thu mọi trạng thái và mọi tài khoản.

Chuẩn dùng lại: `PageHeader`, `ListFilterBar`, `CompactSearchField`, `CompactSelectField`, `AppDataTable`, `TablePaginationBar`, `AppFormDialog`, `AppDetailDialog`, `DialogActionButton`.

## Kết quả

| Nhóm màn hình | Kết quả và xử lý |
| --- | --- |
| Công nợ & lợi nhuận | Đưa danh sách chờ xác nhận/cần kiểm tra/chờ đủ điều kiện và chi tiết dự án vào popup. Dùng bảng, nút và phân trang chung; chọn 10/20/50/100 dòng; đổi bộ lọc hoặc số dòng về trang đầu. |
| Xác nhận hàng loạt | Phân trang chung cho danh sách nguồn và bản xem trước xác nhận. Giữ lựa chọn qua các trang, giữ giới hạn 500 nguồn. |
| Dashboard dòng tiền/lợi nhuận | Các popup đã dùng bảng/dialog chung; bổ sung chọn số dòng, cùng kiểu phân trang Dự án. |
| Dashboard KPI/team và trang KPI | Đã dùng khung/bộ lọc/bảng CRM. Bảng ẩn dành cho đọc biểu đồ và bảng số liệu dưới biểu đồ là phần phụ trợ, không đổi thành danh sách dự án. |
| Báo cáo tuần | Danh sách đã dùng bảng, bộ lọc, phân trang CRM; giữ bố cục biểu mẫu và bản ảnh gửi khách. |
| Mẫu báo cáo tuần / Gợi ý | Popup Gợi ý chuyển sang dialog và bộ lọc chung; phân trang chung và chọn số dòng ở cả quản trị mẫu lẫn Gợi ý. API kiểm tra số dòng thuộc 10/20/50/100. |
| Nhóm | Thay bộ lọc phòng ban, field biểu mẫu và popup lịch sử bằng component chung. Bổ sung phân trang/số dòng cho bảng nhóm. |
| Thẻ nạp quảng cáo | Đã dùng bảng/form chuẩn; bổ sung chọn số dòng. |
| Chi phí / chi phí dự án | Đã dùng bộ lọc, nút, dialog, phân trang CRM. Bảng con đối chiếu chi phí và biểu mẫu số tiền giữ đúng ngữ cảnh. |
| Thanh toán / báo phí | Các màn hình danh sách và form dùng component CRM. Bảng bản gửi khách/PDF giữ bố cục chứng từ. |
| Thông báo / trao đổi nội bộ | Drawer và popup xác nhận hàng loạt đã dùng component chung; tiếp tục tải thêm thông báo phù hợp danh sách liên tục. |
| Liên kết / gửi tài liệu Zalo trong CRM | Chuyển hai popup sang AppFormDialog, nút đóng/lưu/gửi và field theo chuẩn CRM. Giữ các callback/quyền và yêu cầu bấm gửi rõ ràng. |
| Các danh sách Zalo Team | Thay footer phân trang dùng chung tại tài khoản/chiến dịch/lưu trữ qua ListPagination; danh sách người nhận chiến dịch dùng cùng footer. Luồng việc và tìm hồ sơ CRM chỉ có hasMore dùng nút số trang/mũi tên cùng kiểu, không dựng tổng số giả. |
| Chat, đồng bộ, media Zalo | Rà cấu trúc và component chung riêng của Zalo. Giữ mẫu chat, trình xem ảnh, hộp chọn file và điều khiển đồng bộ đúng chức năng; không biến chúng thành bảng CRM. |

## Kiểm tra

- Kiểm tra TypeScript, PHP syntax và diff whitespace sau chỉnh sửa.
- Trình duyệt: đổi trang, đổi số dòng từ trang 2 về trang 1, mở/đóng popup tài chính; chọn nhiều khoản và hủy xác nhận; kiểm tra màn hình 390px.
- Mẫu báo cáo: kiểm tra dữ liệu phân trang API với bộ chọn số dòng.
- Nhóm: mở form, kiểm tra trường và nút rồi hủy. Dữ liệu local chưa có nhóm, nên chưa nghiệm thu lịch sử với dữ liệu thật.
- Không gửi tài liệu Zalo, không xác nhận tài chính thật, không tạo/sửa nhóm trong quá trình kiểm tra giao diện.
- Kết quả build/deploy ghi riêng trong biên bản phát hành.
