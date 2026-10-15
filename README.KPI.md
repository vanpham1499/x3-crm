# KPI phí quản lý — áp dụng từ tháng 10/2026

## Trạng thái

Đã triển khai và khởi tạo dữ liệu **local** ngày 13/10/2026. Chưa đưa bản này lên GitHub/VPS.

Lợi nhuận dịch vụ thuê đối tác/FL theo tháng công việc được xem riêng tại **Chi phí → Công nợ & lợi nhuận**. Ngày chi đối tác chỉ cập nhật sổ thanh toán; không thay đổi chính sách KPI phí quản lý dưới đây. Hướng dẫn xác nhận kỳ, phân bổ và đối soát lịch sử nằm trong [README](README.md#công-nợ-đối-tác-và-lợi-nhuận-theo-kỳ).

## Quy tắc đã chốt

| Nội dung | Quy tắc |
| --- | --- |
| Trước tháng 10/2026 | Giữ công thức cũ |
| Từ tháng 10/2026 | Chỉ ghi nhận phí quản lý trước VAT theo tiền thực thu đã phân bổ vào báo phí |
| Người triển khai | Hưởng nhánh triển khai của tất cả báo phí thuộc dự án |
| Sale phụ trách khách hàng | Hưởng nhánh Sale của báo phí đầu tiên trong dự án; ghi nhận dần, không đợi thu đủ |
| Một người kiêm hai vai trò | Có cả hai nhánh KPI, hiển thị riêng để đối soát |
| Tổng dịch vụ/công ty | Mỗi phần phí chỉ tính một lần; không cộng hai nhánh nhân sự thành doanh thu công ty |
| Gia hạn | Ghi nhận cho triển khai; không phát sinh nhánh Sale |

“KPI phí quản lý” là chỉ tiêu nội bộ. Đây không phải lợi nhuận kế toán sau khi trừ mọi chi phí.

### Công thức

Với khoản thu thông thường không chỉ định riêng phần phí:

```text
Tiền tính tỷ lệ = giới hạn(Tổng thu phân bổ − Cọc, 0, Tổng trước VAT + VAT)
Phí lũy kế = Phí quản lý trước VAT × Tiền tính tỷ lệ / (Tổng trước VAT + VAT)
KPI tăng của lần thu = Phí lũy kế sau thu − Phí lũy kế trước thu
KPI tháng = Phí ghi nhận từ khoản thu trong tháng − Phí quản lý đã hoàn trong tháng
```

- Ngân sách quảng cáo, VAT, phí setup, cọc, tiền dư và chi phí triển khai không cộng vào KPI mới.
- Các khoản chưa phân bổ cho báo phí chưa tạo KPI.
- Phần phí tối đa được ghi nhận không vượt phí quản lý trong báo phí, sau điều chỉnh hoàn phí.
- Số được làm tròn đến hai chữ số thập phân. Giao diện VND hiển thị theo định dạng tiền hiện tại.
- Ngày ghi nhận khoản thu theo thời gian giao dịch thanh toán; nếu thiếu thì dùng ngày giao dịch, ngày phân bổ hoặc ngày tạo.
- Hoàn phí chỉ trừ khi hoàn tiền đã hoàn tất, tại ngày hoàn tất. Phần phí hoàn có VAT được quy về trước VAT theo tỷ lệ VAT của dòng phí quản lý.
- Hoàn ngân sách, cọc, tiền dư và khoản bù thêm không trừ KPI phí quản lý.
- Thu lại sau hoàn vẫn là khoản phân bổ thông thường và dùng tỷ lệ phí trên báo phí; chưa có nghiệp vụ gắn khoản thu riêng cho một dòng phí.

**Ví dụ:** ngân sách 30 triệu, phí quản lý 6 triệu, VAT 3,6 triệu, tổng thu 39,6 triệu. Thu 19,8 triệu thì KPI phí là 3 triệu; thu nốt 19,8 triệu ghi nhận thêm 3 triệu. Hoàn 1,1 triệu phí gồm VAT 10% thì giảm KPI 1 triệu. Hoàn 5 triệu ngân sách không giảm KPI.

Nếu báo phí đầu tiên: triển khai được 3 triệu và Sale được 3 triệu ở lần thu đầu; tổng công ty vẫn là 3 triệu. Nếu hai vai trò cùng một người thì KPI nhân sự là 6 triệu ở hai nhánh.

### Nguồn phí và người hưởng

- Phí lấy từ dòng tự động có `item_code = -2`, bỏ dòng `excludedFromTotal`. Không đoán theo tên dịch vụ hoặc tên dòng do người dùng nhập.
- Báo phí theo số lượng/đơn giá hoặc phí quản lý bằng 0 có KPI phí bằng 0. Muốn đưa phí của dịch vụ khác vào KPI cần chốt phân loại phí riêng, tránh vô tình đưa ngân sách trở lại.
- Người triển khai lấy từ người quản lý dự án; Sale lấy từ Sale phụ trách **khách hàng**.
- Khi có phân bổ đầu tiên, lưu bản chụp phí, tổng thanh toán, cọc, dịch vụ gốc, người hưởng, phòng ban và việc đây có phải báo phí đầu tiên không.
- Báo phí đầu tiên được xác định theo ngày tạo rồi ID trong các báo phí còn hiệu lực của dự án tại lúc chụp.
- Đổi nhân sự hoặc chỉnh giá sau đó không tự thay bản chụp. Điều chỉnh hồi tố cần quy trình đối soát riêng; chưa có nút sửa bản chụp trên UI.
- Khởi tạo dữ liệu cũ dùng thông tin đang có tại lúc chạy lệnh, **không phục dựng lịch sử phân công đã bị thay đổi trước đó**.
- Phạm vi dữ liệu giữ theo báo cáo cũ: dự án chưa bị xóa, báo phí còn hiệu lực, phân bổ còn hiệu lực. Hủy/chuyển phân bổ vẫn làm thay đổi nguồn KPI tương ứng.
- Dữ liệu trước tháng 10 được đọc để biết phần đã thu, tránh tính lại phần đó vào tháng 10; công thức báo cáo các tháng trước giữ nguyên.

## Cách sử dụng

1. Vào **KPI**, chọn tháng từ 10/2026.
2. Xem **Kế hoạch**, **Phí quản lý ghi nhận**, **Hoàn thành**, **Còn thiếu**.
3. Chọn dịch vụ, phòng ban hoặc nhân sự. Nhánh triển khai và Sale hiển thị riêng.
4. Bấm biểu tượng đối soát ở dòng cần kiểm tra: xem báo phí, khoản thu/hoàn và phần KPI trước VAT.
5. Xuất Excel ở tab nhân sự để đối chiếu. File có cột **Công thức KPI** để phân biệt kỳ cũ/mới.

Kế hoạch đã lưu được giữ nguyên; cần rà lại chỉ tiêu nếu trước đây lập theo doanh thu/ngân sách. Chưa có kế hoạch thì không hiện phần trăm hoàn thành giả.

KPI, chi tiết, Excel và phần KPI của Dashboard dùng cùng nguồn tính. Không hiển thị tỷ lệ tăng/giảm khi hai kỳ so sánh nằm ở hai công thức khác nhau.

Sau thao tác thu/hoàn/phân bổ trong trình duyệt, cache KPI và Dashboard được cập nhật lại. Các tab cùng trình duyệt được báo thay đổi; phiên khác kiểm tra mã phiên bản mỗi 30 giây khi đang mở KPI/Dashboard. Không tải lại toàn bộ báo cáo nếu phiên bản không đổi; không polling nền khi tab bị ẩn. Đây là cập nhật gần thời gian thực, không phải thông báo đẩy tức thì giữa các máy.

## Kiểm tra local

- Migration đã chạy; đã khởi tạo 317 báo phí có phân bổ: 254 có phí, 63 không có phí quản lý (46 theo số lượng/đơn giá, 17 phí bằng 0).
- 25 kiểm tra nghiệp vụ thu từng phần, VAT, cọc, tiền dư, hoàn tiền, mốc tháng 10, mã dòng phí và phân chia hai vai trò đạt.
- 35 dòng báo cáo tháng 9–10 khớp tổng chi tiết; biểu đồ Dashboard nhân sự và phòng ban khớp báo cáo KPI.
- TypeScript kiểm tra đạt. Đã mở tab dịch vụ, nhân sự và popup đối soát trên trình duyệt local; kiểm tra điện thoại viewport 390px không tràn ngang toàn trang (bảng có cuộn riêng). Chưa nghiệm thu giao dịch thu/hoàn mới trên production.

```powershell
& 'D:/laragon/bin/php/php-8.4.4/php.exe' tooling/tests/kpi-fee-policy.php
# Chỉ đọc DB local 127.0.0.1:5433; tự từ chối endpoint khác:
& 'D:/laragon/bin/php/php-8.4.4/php.exe' -d extension=pdo_pgsql -d extension=pgsql tooling/tests/kpi-fee-local-audit.php
node node_modules/typescript/bin/tsc --noEmit -p apps/frontend/tsconfig.json
```

## Khi triển khai server

Chưa thực hiện ở đợt này. Cần sao lưu DB và kiểm tra đúng môi trường trước khi chạy.

1. Trong cửa sổ triển khai, tạm ngưng ghi tài chính và các worker liên quan để khởi tạo nhất quán.
2. Chạy migration `2026_10_13_000100_add_kpi_fee_basis_to_quotations.php`.
3. Với backend mới, chạy `php artisan kpi:freeze-fee-basis`. Lệnh chạy lại được, chỉ bổ sung bản chụp còn thiếu.
4. Đối soát số báo phí có/không có phí và tổng tháng 9, tháng 10 tại chính server. Không dùng số local làm số nghiệm thu production.
5. Mở backend/frontend mới cùng nhau, khởi động lại worker cần thiết, kiểm tra quyền xem và báo cáo rồi mở ghi tài chính.

Rollback về mã trước đợt này nếu cần; giữ cột và dữ liệu bản chụp để có thể triển khai lại. Không chạy migration down hay phục hồi toàn bộ DB đè lên các khoản thu mới.
