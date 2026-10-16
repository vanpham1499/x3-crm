# Rà soát phản hồi CRM — 15/10/2026

## Trạng thái

Đã sửa và kiểm tra tại workspace/local. Đợt này chưa push GitHub hoặc deploy lên CRM production. Không sửa dữ liệu tài chính thật; các fixture kiểm thử được rollback.

## 1. KPI và Dashboard

- Từ tháng 10/2026: chỉ tiêu KPI chính của nhân sự, phòng và nhóm lấy **KPI triển khai**. **KPI Sale** giữ riêng để đối soát, không cộng lần nữa vào tỷ lệ hoàn thành.
- Bảng, chi tiết, Excel, tổng hợp phòng ban và biểu đồ Dashboard dùng cùng nguyên tắc. Công thức trước tháng 10 được giữ nguyên.
- Biểu đồ dùng ngày lịch đã ghi trong sổ KPI. Sửa lỗi diễn giải thời gian không có múi giờ thành UTC rồi cộng thêm 7 giờ, khiến giao dịch cuối tháng xuất hiện ở đầu tháng sau.
- Dashboard phạm vi phòng/nhóm hiển thị **Dòng tiền thu lũy kế**, gồm tiền ngân sách và VAT đã phân bổ vào báo phí, so sánh cùng kỳ. Dữ liệu dùng phạm vi dự án đã được backend cấp quyền.
- Lợi nhuận dự án hiển thị rõ nguồn chưa xác nhận kỳ ghi nhận và có lối mở sổ đối soát theo dự án. Tổng hiện tại là phần **đã ghi nhận**, chưa gồm nguồn còn chờ xác nhận.
- Trường hợp thu tháng 9, trả đối tác tháng 10: chi phí theo kỳ ghi nhận đã chốt, thanh toán không trừ chi phí lần thứ hai. Không tự gán kỳ cho dữ liệu còn thiếu xác nhận.

## 2. Trao đổi nội bộ

- Có danh mục **Trao đổi nội bộ** trong bộ lọc thông báo, kể cả khi số lượng bằng 0.
- Thông báo trao đổi báo cáo tuần cũ được phân loại theo event khi đọc, không cần sửa lịch sử DB.
- Tin nhắn mới gửi tới người liên quan có quyền xem báo cáo: người lập, nhân sự dự án/khách hàng, người duyệt; phản hồi bổ sung người tham gia cùng chuỗi. Loại người gửi và người không có quyền xem.
- Nội dung xem trước gồm mã dự án, kỳ báo cáo và đoạn tin nhắn. Mở thông báo dẫn đến đúng tin nhắn và làm nổi bật vị trí đó.
- Sự kiện realtime mang ID báo cáo để làm mới cuộc trao đổi đang mở. Đọc thông báo không tự đánh dấu đã xử lý.

## 3. MKM

- Vào **Cài đặt → Thẻ nạp quảng cáo → Xem MKM** để mở danh sách Chi phí với bộ lọc **MKM nền tảng tặng**.
- Bộ lọc, phân trang theo dự án và Excel đều dùng nguồn `promotion`; không lẫn tiền nạp qua thẻ.
- Tạo MKM thực cấp vẫn tại **Dự án → Tài chính → Thêm lần nạp → Mã khuyến mãi nền tảng tặng**.
- Không tạo thẻ tiền thật giả để đại diện MKM. Quy tắc 3 triệu tiền thật + 3 triệu nền tảng tặng giữ nguyên.

## 4. Giao diện dự án

- Chuyển **Nhóm Zalo nhận tài liệu** vào vùng hành động của PageHeader, góc trên bên phải cạnh tiêu đề.
- Dùng component nút và layout CRM hiện có. Ở màn hình hẹp, nút xuống dưới tiêu đề để không chèn ép chữ.

## Kiểm tra đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Notification inbox | 60 kiểm tra đạt |
| Trao đổi nội bộ, người nhận và phân quyền | 11 kiểm tra đạt, rollback |
| KPI lũy kế và ranh giới ngày/tháng | 43 kiểm tra đạt |
| Đối chiếu KPI local | 34 chi tiết và 2 biểu đồ khớp |
| Dashboard summary/endpoint | 12 kiểm tra đạt |
| Phân quyền và KPI nhóm | 54 kiểm tra đạt, rollback |
| Dòng tiền và lợi nhuận | 27 kiểm tra đạt |
| Chi phí đối tác, kỳ ghi nhận và thanh toán | 43 kiểm tra đạt, rollback |
| MKM và lọc nguồn tiền | 31 kiểm tra đạt, rollback |
| TypeScript, PHP syntax, git diff whitespace | Đạt |
| Production build frontend | Đạt, tạo đủ 55 trang tĩnh; còn cảnh báo tùy chọn cài `sharp` của môi trường local |
| Trình duyệt local | Đã xem KPI nhân sự, danh mục thông báo, lối vào MKM và header dự án trên desktop; header dự án ở 390px không chồng nút/title |

## Kiểm tra khi đưa lên production

1. Đối chiếu một nhân sự/phòng thực tế trên KPI và Dashboard với cùng kỳ, phạm vi và thời điểm chốt; tách cột Sale khi so sánh.
2. Dùng hai tài khoản được phép xem cùng báo cáo để xác nhận thông báo qua queue/realtime thực tế. Kiểm thử local đã xác nhận việc tạo thông báo và phân quyền, chưa thay thế kiểm tra websocket hai trình duyệt trên server.
3. Đối soát một hồ sơ thu tháng 9/trả đối tác tháng 10 bằng chứng từ thực tế; không suy diễn kỳ từ ngày chuyển tiền cho đối tác.
4. Xác nhận các nguồn lợi nhuận đang chờ đối soát rồi kiểm tra biểu đồ. Trạng thái thiếu kỳ ghi nhận không đồng nghĩa hệ thống không có doanh thu.

Không cần migration mới cho đợt này. Backend và frontend cần phát hành cùng nhau; worker queue cần nạp lại code mới khi deploy.

## Bổ sung ngày 16/10/2026 — Xử lý tất cả thông báo

- Trong tab **Tất cả**, nút **Xử lý tất cả** đặt bên phải **Chỉ chưa đọc**, dùng nút và popup chung của CRM.
- Áp dụng bộ lọc Phân hệ và Chỉ chưa đọc hiện tại trên toàn bộ kết quả, kể cả các trang chưa tải.
- Server trả số lượng và chốt danh sách khi mở popup. Xác nhận chỉ xử lý những mục còn chờ trong danh sách đó; thông báo mới đến sau không bị cuốn theo. Xác nhận hết hạn sau 5 phút, người dùng mở lại popup để lấy danh sách mới.
- Chỉ đổi trạng thái thông báo của tài khoản hiện tại, giữ nguyên phê duyệt báo cáo, chi phí và thanh toán. Số thông báo trên chuông được làm mới sau khi hoàn tất.
- Có thể vào **Đã xử lý** và đưa từng mục về **Chưa xử lý**. Hủy popup không cập nhật trạng thái.
- API mới: `POST /notifications/handle-all/preview` và `POST /notifications/handle-all`, cùng yêu cầu đăng nhập. Không cần migration.
- Kiểm tra: 78 bài kiểm tra inbox đạt trên SQLite memory; TypeScript và PHP syntax đạt. Đã mở popup local với 503 thông báo, kiểm tra desktop/390px và hủy mà số lượng vẫn giữ nguyên. Không bấm xử lý thông báo thật để kiểm thử.
- Đợt bổ sung này chưa deploy production.
