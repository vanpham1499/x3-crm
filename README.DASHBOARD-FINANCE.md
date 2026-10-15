# Dashboard: tiền thu và lợi nhuận dự án

## Trạng thái

Đã triển khai production ngày 15/10/2026. Dùng sổ ghi nhận từ migration `2026_10_13_000400`; không tự sửa dữ liệu lịch sử. [Biên bản triển khai](tooling/deployment/production/RELEASE-2026-10-15.md).

## Tiền thu từ khách

- Dùng cùng bộ lọc tháng/quý/năm/khoảng tháng ở đầu Dashboard.
- Đã thu = tổng khoản thu đã phân bổ vào báo phí trong phạm vi dự án được xem. Gồm ngân sách và VAT. Không bao gồm tiền chưa phân bổ; không phải số dư ngân hàng hay dòng tiền toàn công ty.
- Thu ròng = đã thu trừ hoàn tiền hoàn tất. Chưa trừ chi phí. Ngày thu lấy từ ngày/giờ giao dịch thực nhận; không dùng ngày nhập lại vào CRM nếu có ngày giao dịch.
- Mặc định hai đường lũy kế thu ròng: kỳ này và kỳ trước. Có thể bật Báo phí để đối chiếu; báo phí không được cộng vào tiền thu.
- Kỳ đang diễn ra cắt tại thời điểm truy vấn, múi giờ ứng dụng. Ví dụ 13/10 lúc 10h so với 13/09 lúc 10h; quý IV đến 13/11 so với quý III đến 13/08. Kỳ đã kết thúc so toàn kỳ.
- Ngày 29–31 được giới hạn theo tháng đối chiếu; tháng đã đóng ngắn hơn vẫn gồm đủ kỳ trước. Không vẽ kéo dài đường kỳ này vào ngày tương lai. Kỳ trước bằng 0 không hiện tỷ lệ tăng vô hạn.
- Bấm số tiền/Đối soát để xem giao dịch cấu thành; kỳ trước có danh sách riêng.

## Lợi nhuận dự án

Đây là **sổ quản trị lợi nhuận dự án**, không phải KPI nhân sự hoặc lợi nhuận ròng sau mọi chi phí vận hành/thuế của công ty.

**Lợi nhuận đã ghi nhận = doanh thu dịch vụ trước VAT đã xác nhận kỳ − chi phí trực tiếp đã xác nhận cùng kỳ.**

- Doanh thu dùng chung phân loại dòng dịch vụ của sổ Công nợ & lợi nhuận. Loại ngân sách, cọc và MKM; xử lý hoàn phí theo nguồn của sổ. Không cộng hai nhánh KPI Sale/triển khai.
- Chi phí trực tiếp hiện là các khoản đối tác/FL (`partner_cost`), theo giá trị đã xác nhận trong sổ. Giữ cách lưu chi phí hiện tại, không tự khấu trừ VAT đầu vào hoặc suy diễn chi phí vận hành chưa có trong CRM.
- Không trừ thêm nạp quảng cáo/MKM: ngân sách đã được loại khỏi doanh thu.
- Chỉ dùng kỳ công việc đã xác nhận. Tiền chuyển cho đối tác tháng 10 không chuyển chi phí công việc tháng 9 sang tháng 10 và không trừ hai lần.
- Không tự lấy ngày thu/ngày chi để gán tháng cho nguồn chưa xác nhận. Dự án không có chi phí đối tác cũng có thể xác nhận doanh thu tại **Chi phí → Công nợ & lợi nhuận**.
- Nguồn chưa xác nhận kỳ, không phân loại được ngân sách/phí, hoặc số tiền nguồn thay đổi so với bản chụp xuất hiện trong **Cần đối soát**. Bản chụp sai số tiền được loại khỏi tổng đã xác nhận cho đến khi đối soát lại; toàn biểu đồ vẫn ghi tạm tính.
- Khoản chưa có kỳ được liệt kê trong phạm vi dự án để người dùng xử lý, có thể thuộc các tháng khác; không tự cho rằng chúng thuộc tháng đang chọn. Vì chưa biết kỳ nên không công bố tỷ lệ tăng/giảm là hoàn chỉnh.
- Biểu đồ theo tháng và lũy kế trong kỳ; một tháng dùng điểm dữ liệu, không dựng các ngày giả.

### Giới hạn so sánh kỳ đang mở

Sổ hiện chỉ có **tháng ghi nhận**, chưa có ngày hiệu lực cho từng phần doanh thu/chi phí. Vì vậy:

- Kỳ đã kết thúc, không còn nguồn cần đối soát: so sánh lợi nhuận và tỷ lệ với kỳ liền trước cùng số tháng, dùng cùng công thức cho cả trước/sau tháng 10 (không đọc công thức KPI cũ).
- Kỳ đang mở: hiển thị số đã ghi nhận cho các tháng đã bắt đầu, đối chiếu với các tháng tương ứng của kỳ trước, ghi rõ **Kỳ trước (đủ tháng)**. Không hiện phần trăm cùng ngày; số hiện tại là tạm tính.
- Muốn so sánh lợi nhuận chính xác đến từng ngày cần bổ sung nghiệp vụ ngày hiệu lực/ghi nhận theo tiến độ, hoặc chốt kỳ nhỏ hơn tháng. Không tự chia đều lợi nhuận tháng theo số ngày.

## Đối soát và quyền

- Dashboard toàn hệ thống hiển thị biểu đồ lợi nhuận dự án; Dashboard nhân sự/phòng ban giữ biểu đồ KPI hiện có, không thay bằng lợi nhuận công ty.
- Các khoản thu tuân theo phạm vi dự án của Dashboard. Popup lợi nhuận có danh sách doanh thu/chi phí kỳ này, kỳ trước và nguồn cần xử lý riêng.
- Chọn **Mở sổ ghi nhận**, tìm dự án, xác nhận/phân bổ kỳ; dùng quyền duyệt/chi phí hiện có. Đọc Dashboard không tạo bản ghi, không chuyển tiền và không gửi Zalo.
- Sửa sổ ghi nhận làm mới Dashboard cùng tab; mã phiên bản theo dõi cả sổ và audit để các phiên Dashboard đang mở nhận cập nhật theo cơ chế kiểm tra phiên bản sẵn có.

## Báo cáo theo team: Dự án mới (14/10/2026, local)

- Vào Dashboard → Báo cáo theo team → Dự án → **Dự án mới**.
- **Dự án mới theo nhân sự**: đếm theo người phụ trách triển khai hiện tại; dự án chưa phân công có nhóm riêng. Nhân sự chỉ có KPI nhưng không có dự án mới không xuất hiện trong biểu đồ này. Số nhân sự không tính nhóm chưa phân công.
- **Dự án mới theo tháng** nằm phía dưới, dùng cùng kỳ tháng/quý/năm ở đầu Dashboard; đếm riêng từng tháng, không lũy kế. Tổng các tháng khớp tổng theo nhân sự.
- Mỗi dự án được ghi nhận một lần theo `created_at`, không dùng ngày bắt đầu dịch vụ. Sửa ngày bắt đầu, gia hạn báo phí hoặc chuyển trạng thái không tạo thêm dự án mới. Sửa người phụ trách chuyển dự án sang nhân sự hiện tại, không tạo lượt mới.
- Số lịch sử có thể khác báo cáo team trước đây vì trước đây ưu tiên `start_date`. Không sửa ngày/dữ liệu dự án và không cần migration.
- Giữ phạm vi quyền hiện tại: báo cáo team theo người triển khai/phòng ban triển khai; thẻ tổng Dashboard có thể bao gồm cả dự án phụ trách Sale. Hai nơi khớp khi có cùng phạm vi (ví dụ ADMIN toàn hệ thống). Không mở rộng quyền để ép số liệu khớp.
- Tab KPI tiếp tục dùng KPI triển khai; tab trạng thái thể hiện trạng thái hiện tại của những dự án mới trong kỳ, không phải ảnh chụp trạng thái lịch sử.
- Kiểm tra dữ liệu local bằng `tooling/tests/dashboard-new-projects-local.php`: 11 tình huống đạt, dữ liệu tạm rollback. TypeScript đạt. Frontend biên dịch và trả HTTP 200; phiên trình duyệt kiểm tra yêu cầu đăng nhập nên chưa nghiệm thu trực quan desktop/mobile của thay đổi ngày 14/10. Chưa deploy VPS.

## Kiểm tra

```powershell
& 'D:/laragon/bin/php/php-8.4.4/php.exe' tooling/tests/dashboard-finance.php
# Từ chối DB ngoài 127.0.0.1:5433; fixtures luôn rollback:
& 'D:/laragon/bin/php/php-8.4.4/php.exe' -d extension=pdo_pgsql -d extension=pgsql tooling/tests/dashboard-finance-local.php
node node_modules/typescript/bin/tsc --noEmit --incremental false -p apps/frontend/tsconfig.json
```

Kiểm tra hồi quy gồm tháng/quý/năm, cắt cùng thời điểm, tháng dài/ngắn/năm nhuận, kỳ tương lai, kỳ trước bằng 0, âm lợi nhuận, phần chưa xác nhận, thay đổi nguồn, thu tháng trước trả FL tháng sau, loại nạp ngân sách/MKM và nguồn không có chi phí đối tác.

Kết quả local ngày 13/10/2026: 27 kiểm tra công thức + 9 kiểm tra DB rollback đạt; TypeScript đạt. Đã mở Dashboard và popup tiền thu trên Chrome, kiểm tra hai khối tài chính không tràn ngang ở viewport 390px. Thẻ tổng “Đã thu” dùng cùng nguồn với biểu đồ tiền thu. Dữ liệu local có 366 nguồn cần đối soát và chưa có nguồn được xác nhận cho kỳ đang xem, nên biểu đồ lợi nhuận hiện trạng thái chờ xác nhận. Chưa triển khai lên VPS.


## KPI lũy kế cá nhân/phòng ban (14/10/2026, local)

- Biểu đồ cá nhân/phòng ban đổi từ KPI phát sinh từng ngày sang **KPI lũy kế**. Một tháng hiển thị theo ngày; nhiều tháng hiển thị theo tháng, cộng dồn từ đầu khoảng đã chọn.
- Nguồn vẫn là các khoản ghi nhận KPI và hoàn tiền theo quyền hưởng hiện hành: triển khai hưởng các báo phí; Sale hưởng báo phí đầu; giữ cách tính người kiêm hai vai trò. Không dùng dòng tiền tổng hoặc sổ lợi nhuận doanh nghiệp.
- Mốc xem hiện tại dùng giờ Việt Nam, so với cùng ngày và giờ của kỳ liền trước có cùng số tháng. Kỳ đã kết thúc so sánh toàn kỳ. Ngày 31 kẹp về ngày cuối tháng trước; tháng đã kết thúc ngắn hơn tháng trước vẫn tính đủ tháng trước.
- Thẻ KPI phía trên, tỷ lệ đóng góp kế hoạch, số lũy kế và điểm cuối biểu đồ dùng chung `profitTrend.currentAmount`. Tỷ lệ tăng/giảm lấy cùng mốc so sánh, không lấy cả tháng trước đối chiếu tháng hiện tại chưa kết thúc.
- Ba số dưới tiêu đề: lũy kế kỳ này, cùng kỳ trước, còn thiếu/vượt cùng kỳ. Đây không phải phần thiếu so với chỉ tiêu kế hoạch.
- Ngày chưa tới để trống; ngày không phát sinh đi ngang. Hoàn tiền/điều chỉnh giảm thực tế có thể làm lũy kế giảm. Hai đường dùng nét liền/nét đứt; tooltip ghi mốc hai kỳ và chênh lệch. Có bảng số liệu thu gọn dùng được bằng bàn phím.
- Khi các tháng tương ứng khác chính sách KPI (đặc biệt 10/2026 so với 09/2026), giữ số lịch sử và hai đường, hiện **Khác công thức KPI**, không hiện chênh lệch hoặc tỷ lệ tăng giảm. Kỳ tương lai hiện chưa bắt đầu; mẫu số bằng 0 không tính phần trăm.
- `DashboardKpiTrend` chỉ chiếu các sự kiện đã được tính phí bởi luồng KPI hiện hành; không sửa cách phân bổ phí, kỳ nguồn hay dữ liệu cũ. Ngày sự kiện được quy về giờ Việt Nam khi dựng biểu đồ.

### Kiểm chứng

- `tooling/tests/dashboard-kpi-trend.php`: 40 kiểm tra lũy kế, cutoff, hoàn tiền, tháng ngắn/dài, năm nhuận, quý, chính sách KPI, quyền hưởng cá nhân/phòng ban và người kiêm vai trò. Không cần DB.
- `tooling/tests/dashboard-kpi-trend-local.php`: 12 kiểm tra report thực tế NV009 trên DB local 127.0.0.1:5433, PostgreSQL transaction **READ ONLY** rồi rollback. Đối chiếu thẻ tổng với điểm cuối hai đường trong tháng 10, tháng 9 và quý 3.
- TypeScript và PHP lint đạt. Đã xem component thực tế với dữ liệu mẫu trên desktop và 390px, kiểm tra đường nét đứt, bảng chi tiết, không tràn trang. Trang preview tạm đã xóa; chưa đăng nhập tài khoản nhân sự để nghiệm thu toàn trang với dữ liệu thật trên trình duyệt.
- Không migration, không thay dữ liệu, chưa deploy VPS.
