# Đối soát khoản thu và PayPal

## Hiện trạng — 13/10/2026

Đã triển khai production ngày 15/10/2026, migration `2026_10_13_000600_add_payment_receipt_origin` đã chạy. Không sửa ngày, số tiền, phân bổ hoặc nhân sự của giao dịch thật. [Biên bản triển khai](tooling/deployment/production/RELEASE-2026-10-15.md).

## Cách sử dụng

1. **Thanh toán → Ghi nhận khoản tiền**: chọn Khách thanh toán, kênh nhận, ngày thực nhận và số khách đã trả bằng VND. Với PayPal, nhập tài khoản nhận và mã giao dịch; tách phí PayPal để thấy số ròng. Ngày không tự điền hôm nay, tránh nhập muộn làm sai kỳ KPI.
2. Lưu xong mở **Phân bổ** để chia vào các báo phí theo chứng từ. Số khách đã trả là nguồn trả nợ báo phí; phí PayPal không trở thành khoản khách còn nợ. Kênh PayPal không tự thay đổi cách tính phí quản lý.
3. Mở **chi tiết giao dịch → Đối soát KPI**: từng phân bổ hiển thị ngày/tháng ghi nhận, phí quản lý trước VAT, triển khai và Sale theo bản chụp KPI đã chốt. Không đoán người hưởng theo người nhập giao dịch. Chưa có dòng phí, thiếu bản chụp, kỳ cũ hoặc phần thu không tạo thêm phí có thông báo riêng. Số là tác động của lần thu, chưa bù các lần hoàn riêng sau đó; xem KPI của kỳ để đối chiếu tổng thu/hoàn.
4. Nếu sai thông tin: **Đối soát khoản tiền**, sửa theo chứng từ, nhập lý do. Ngày thay đổi được dùng lại khi tính kỳ KPI; không thay bản chụp người hưởng. Lịch sử ghi trước/sau và người thao tác. Chỉ sửa nội dung hoặc kênh sẽ giữ nguyên ngày. Webhook gửi lại không ghi đè ngày đã đối soát.
5. Khi rút PayPal về ngân hàng: nếu ngân hàng đã có giao dịch trên CRM, mở chính giao dịch đó và chọn **Chuyển nội bộ → Khoản PayPal gốc**. Nếu chưa có giao dịch thì ghi nhận mới loại Chuyển nội bộ. Không tạo thêm bản ghi nếu webhook ngân hàng đã ghi nhận rồi. Liên kết thủ công theo chứng từ; hệ thống không tự đoán một giao dịch ngân hàng là tiền PayPal.
6. Lần chuyển nội bộ không phân bổ vào báo phí, không tạo thêm KPI và không được đổi trực tiếp thành tiền khách thanh toán khi đang có liên kết gốc. Tổng các lần chuyển liên kết không vượt số ròng khoản gốc. Giao dịch đã phân bổ/hoàn tiền phải đối soát liên kết trước khi đổi loại. Khoản PayPal gốc đang có lần chuyển liên kết không được xóa.

## Phạm vi và dữ liệu

- Ghi nhận/sửa nguồn tiền dùng quyền `payment.manage`; xem toàn bộ nhánh nhân sự trong đối soát cần `payment.view` và `kpi.view_all` hoặc `kpi.manage_all`, đồng thời giữ phạm vi xem giao dịch. Các quyền phân bổ/hoàn tiền hiện có không thay đổi.
- PayPal chống trùng theo tài khoản nhận + mã giao dịch, không phân biệt hoa/thường và bỏ khoảng trắng đầu/cuối. Kiểm tra trong transaction tài chính và unique index DB. Không dùng ghi chú để suy ra nguồn tiền. Giao dịch cũ vẫn chưa phân loại cho đến khi người có quyền xác nhận.
- Chỉ hỗ trợ giá trị đã đối soát bằng VND trong đợt này; chưa có sổ ngoại tệ/tự quy đổi tỷ giá hoặc tích hợp API PayPal.
- Phí PayPal được lưu để đối soát số khách trả/số ròng và hạn mức lần chuyển về ngân hàng. **Chưa tự tạo chi phí dự án từ trường phí này**; kế toán dùng luồng Chi phí hiện có khi cần ghi phí vào báo cáo chi phí. KPI phí quản lý giữ quy tắc đã chốt, không tự trừ phí PayPal.
- Liên kết hiện là một khoản PayPal gốc cho mỗi lần chuyển. Lần rút gộp nhiều giao dịch cần tách/đối soát nguồn ngoài luồng này, không gán toàn bộ vào một khoản để vượt hạn mức.
- Tiền báo phí K không tạo hạn mức nạp quảng cáo, theo `QuotationFinancialBasis`. Tổng công ty không cộng hai nhánh triển khai/Sale thành doanh thu hai lần.
- Kỳ trước 10/2026 giữ công thức KPI cũ. Popup không mô phỏng công thức cũ bằng công thức mới; xem trang KPI kỳ tương ứng.

## Đối soát khách 761 trên production

Đã đọc trực tiếp VPS CRM `45.252.251.120` ngày 13/10/2026 bằng transaction `READ ONLY`. Image backend/frontend đang chạy `team-20261010`; bản tài chính K và KPI mới local chưa deploy.

- Dự án `761.DV1.K.GONURI`, ID 916; người triển khai và Sale hiện đều là Dương NĐ (NV024, ID 31).
- Giao dịch 470: khách trả 2.509.170đ; ngày giao dịch đang lưu 08/10/2026.
- Q001 (462): phân bổ 544.503đ, phí trước VAT 504.169đ, VAT 40.334đ.
- Q002 (463): phân bổ 1.964.667đ, phí trước VAT 1.819.136đ, VAT 145.531đ.
- Gọi trực tiếp nguồn chi tiết KPI production tháng 10/2026: nhánh triển khai của dự án đã ghi **2.323.305đ**, nhánh Sale **504.169đ**. Vì cùng người kiêm hai vai trò, tổng hai nhánh nhân sự **2.827.474đ**; phí dịch vụ công ty chỉ **2.323.305đ**.
- Do đó hiện tại không có bằng chứng thiếu khoản này trong KPI backend. Ô tiền có thể nạp trên ảnh thuộc cách tính cũ. Không sửa dữ liệu gốc để bù một khoản KPI đã có.
- Chưa có chứng từ PayPal để xác nhận ngày thực nhận sớm hơn 08/10 hoặc phí PayPal. Không suy ra ngày thực nhận từ nội dung “thanh toán t7 t8”. Cần chứng từ trước khi điều chỉnh hồi tố.

## Kiểm tra và triển khai

`tooling/tests/payment-receipt-origin.php` chỉ chấp nhận DB local `127.0.0.1:5433`. Mọi dữ liệu thử nằm trong transaction rollback. 32 kiểm tra đã đạt: thu/phí/số ròng, chống trùng, ngày/nhật ký, phân bổ/KPI/K, chuyển nội bộ, giới hạn nguồn và webhook gửi lại. TypeScript kiểm tra đạt; đã mở màn đối soát và form PayPal trên desktop/mobile, chưa lưu giao dịch thật qua trình duyệt.

```powershell
& 'D:/laragon/bin/php/php-8.4.4/php.exe' -d extension=pdo_pgsql -d extension=pgsql tooling/tests/payment-receipt-origin.php
```

Khi deploy: sao lưu DB, áp dụng các migration local liên quan theo runbook từng đợt, chạy migration 000600 trước backend mới; triển khai frontend/backend cùng phiên bản. Giữ dữ liệu audit và cột mới khi rollback mã. Không lấy DB local đè production, không tự sửa giao dịch 470 hoặc tự phân loại dữ liệu cũ.
