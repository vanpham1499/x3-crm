# Logic And API Notes

File này dùng để ghi chú dần mọi thứ liên quan đến logic nghiệp vụ và API của dự án.

Nguyên tắc cập nhật:

- Chỉ note khi người dùng hỏi hoặc yêu cầu làm rõ một phần cụ thể.
- Không tự suy đoán hoặc ghi trước các logic/API chưa được xác nhận.
- Khi note API, ưu tiên ghi rõ route, method, payload, response, nơi gọi trong frontend, và trạng
  thái tích hợp.
- Khi note logic, ưu tiên ghi rõ màn hình/tính năng, luồng xử lý, dữ liệu đầu vào/đầu ra, và các
  ràng buộc nghiệp vụ.

## API

### Chi Phí Dự Án

- `GET /api/project-costs?project_id=<id>`: lấy toàn bộ khoản chi của một Project.
- `POST /api/project-costs`: tạo khoản chi; `PUT/PATCH /api/project-costs/:id`: cập nhật;
  `DELETE /api/project-costs/:id`: xóa mềm.
- `entryType=ad_spend` dùng cho nhóm 2.1; `entryType=partner_cost` dùng cho nhóm 2.2.
- Số tiền được backend tính lại, không tin tổng tiền do frontend gửi:
  - 2.1: `totalAmount = amountBeforeVat + vatAmount`.
  - 2.2: `totalAmount = amountBeforeVat + vatAmount - discountAmount`, không nhỏ hơn 0.
- Một khoản chi có thể gắn `quotationId` để đối chiếu theo lần báo phí, nhưng không bắt buộc.
- Chỉ khoản chi `status=completed` được tính vào `Chi phí đã chi` và lợi nhuận thực nhận.

### Hợp Đồng Và Chủ Thể Nhận Hóa Đơn

- `GET /api/contracts?project_id=<id>` lấy danh sách hợp đồng của Project; tạo/sửa/xóa dùng các
  route CRUD `/api/contracts` hiện có.
- Hợp đồng lưu snapshot chủ thể nhận hóa đơn qua các trường `invoiceRecipientType`,
  `invoiceRecipientName`, `invoiceRepresentativeName`, `invoiceTaxCode`, `invoiceAddress`,
  `invoiceEmail`, `invoicePhone`.
- `invoiceRecipientType=customer`: backend lấy và lưu snapshot pháp lý hiện tại của Customer.
- `invoiceRecipientType=other`: dùng pháp nhân/chủ thể được nhập riêng trên hợp đồng.
- Khi hợp đồng gắn với một Báo phí, backend đồng bộ `contract_id` sang Báo phí và các Payment của
  Báo phí đó.

### Auth Login

- Route backend: `POST /api/auth/login`.
- Route gọi từ frontend: `POST /auth/login` qua `src/services/api/client.ts`.
- Base URL: `NEXT_PUBLIC_API_URL`, fallback `http://127.0.0.1:4000/api`.
- Payload:
  - `email`: email đăng nhập.
  - `password`: mật khẩu.
- Response frontend đang hỗ trợ:
  - Token: `access_token` hoặc `token`, có thể nằm ở root response hoặc trong `data`.
  - User: `user`, có thể nằm ở root response hoặc trong `data`.
- Nơi gọi: `src/app/(auth)/login/page.tsx`.
- Trạng thái tích hợp: đã nối với form login, lưu token vào localStorage key `access_token`, lưu
  user nếu backend trả về.
- Header xác thực: các request sau login tự gắn `Authorization: Bearer <token>` trong API client.
- Xử lý lỗi auth: response `401` sẽ xóa `access_token` và `user`, sau đó redirect về `/login`.

## Logic

### Login Và Auth Guard

- Màn `/login` validate `email` và `password` bằng React Hook Form + Zod.
- Submit login gọi `POST /auth/login` với `{ email, password }`.
- Nếu response không có token, frontend xem như login thất bại.
- Nếu login thành công, `auth-store` lưu token và user optional, sau đó redirect bằng
  `router.replace('/users')`.
- Khi refresh trang, `src/app/providers.tsx` gọi `auth-store.init()` để khôi phục auth từ
  localStorage.
- Các route trong `src/app/(app)` yêu cầu token. Nếu auth đã init xong mà không có token, layout
  redirect về `/login`.
- Màn `/login` không render form cho tới khi auth init xong. Nếu người dùng đã có token và mở
  `/login`, màn login hiển thị `AppSplashScreen` trong lúc redirect về `/users` để tránh nháy form
  login.
- Các giai đoạn auth init, auth redirect, và Next route loading dùng
  `src/components/shell/app-splash-screen.tsx` làm loading toàn trang: nền trắng, logo X3Sales ở
  giữa, và thanh progress shimmer mảnh bên dưới.
- Sau khi đã vào authenticated app shell, route/data loading dùng
  `src/components/shell/content-loading.tsx` để giữ nguyên header/sidebar và chỉ loading vùng main
  content bằng thanh progress mảnh ở giữa.

### Lead, Customer Và Dự Án Theo Google Sheet

- Phạm vi nghiệp vụ hiện tại tập trung vào `Lead → Customer → Project` và các dữ liệu phát sinh
  quanh Project; chưa ưu tiên phân quyền.
- `Customer` lưu hồ sơ dùng chung của khách hàng/pháp nhân. Một Customer có thể có nhiều Project.
- Mỗi `Project` tương đương một dòng dịch vụ của khách hàng trong tab `1. CRM` của Google Sheet.
- Project giữ dịch vụ, trạng thái chạy, người quản lý, Sales, link kế hoạch, thời gian triển khai và
  ghi chú vận hành.
- Một Project tồn tại qua nhiều tháng và có thể có nhiều lần báo phí, nhiều lần thanh toán.
- `Quotation` trong ngữ cảnh nghiệp vụ được hiển thị là `Báo phí`: số tiền đã báo khách cần thanh
  toán cho một kỳ/lần, không phải tiền ngân hàng đã thực nhận.
- `Payment` là tiền thực tế đã vào tài khoản, tương ứng tab `2.0 Tiền vào Cty`.
- Một báo phí có thể được thanh toán nhiều lần. Cần giữ riêng số phải thu, số đã nhận, số còn
  thiếu/thừa.
- Schema hiện tại cho phép một `Payment` gắn tối đa một `quotation_id`. Khoản tiền chưa biết thuộc
  báo phí nào vẫn có thể gắn với Project để chờ đối soát. Nếu sau này cần chia một giao dịch ngân
  hàng cho nhiều báo phí thì phải bổ sung bảng phân bổ riêng, không ghi đè `payment.quotation_id`.

### Phân Nhóm Doanh Thu 2.1 Và 2.2

- Không phân nhóm cứng bằng mã `DV1`, `DV2`, `DV3`, `DV4`.
- Project chọn dịch vụ từ `/projects/services`. Dịch vụ con kế thừa `Cấu hình báo giá dịch vụ` của
  dịch vụ gốc.
- Nếu cấu hình `Áp dụng tự động trong báo giá` được bật, Project thuộc nhóm `2.1 DT DV1,DV2` và tính
  phí quản lý theo ngân sách quảng cáo.
- Nếu cấu hình trên không bật hoặc không có cấu hình bật, Project thuộc nhóm `2.2 DT DV3,DV4` và
  tính theo số lượng, đơn giá, chi phí thực hiện.
- Cấu hình hiện tại quyết định nhóm cho các lần báo phí mới. Khi tạo báo phí/doanh thu cần lưu
  snapshot `pricingMode` (`management_fee` hoặc `quantity_price`) để việc đổi cấu hình dịch vụ sau
  này không làm thay đổi dữ liệu lịch sử.
- Báo phí mới lưu thêm snapshot `revenueGroup` (`2.1` hoặc `2.2`), `pricingMode`,
  `serviceRootId`, `serviceRootCode` trong `quotations.metadata`. Khi sửa báo phí cũ đã có snapshot,
  không tự đổi nhóm theo cấu hình hiện tại.
- Trang danh sách và form Dự án phải hiển thị rõ Project đang thuộc nhóm 2.1 hay 2.2, kèm cách tính
  tương ứng.
- Trang chi tiết Project là trung tâm của luồng. Từ đây người dùng tạo nhiều Báo phí theo kỳ, xem
  Revenue và các Payment đã liên kết.
- API dùng các quan hệ `quotations.project_id`, `revenues.project_id`, `payments.project_id`; một
  Project có nhiều bản ghi ở cả ba nhóm.
- Nút `Tạo báo phí` trên Project mở `/quotations/new?projectId=<id>` và tự chọn Customer, Project,
  Lead cùng dịch vụ tương ứng.

### Tạo Dự Án Từ Báo Phí Có Sẵn

- Form `/projects/new` có trường `Báo phí khởi tạo` không bắt buộc.
- Chỉ báo phí chưa gắn Project mới xuất hiện trong danh sách. Báo phí đã hủy hoặc chưa có Customer
  được hiển thị là không thể chọn.
- Khi chọn báo phí, form tự điền `customerId`, `serviceId`, tên dự án từ metadata/tên dịch vụ và số
  tiền cọc. Customer và dịch vụ bị khóa để tránh Project lệch với báo phí nguồn.
- Backend kiểm tra lại các ràng buộc trên, không chỉ dựa vào frontend: không cho lấy báo phí của dự
  án khác, báo phí đã hủy, sai Customer hoặc sai dịch vụ.
- Khi tạo Project thành công, báo phí nguồn được gắn `project_id`, chuyển sang `won`; các Payment đã
  gắn báo phí cũng được cập nhật Customer/Project. Luồng này hoạt động cả khi Project chưa có hợp
  đồng; `contract_id` có thể bổ sung sau.
- Form thêm Project không hiển thị và không tự tạo Hợp đồng. Hợp đồng chỉ phát sinh sau khi Project
  đã tồn tại, tại tab `Hợp đồng` trong hồ sơ Project.

### Hồ Sơ Trung Tâm Của Dự Án

- `/projects/:id` có bốn tab: `Thông tin dự án`, `Hợp đồng`, `Tài chính`, `Khách hàng`.
- Phần đầu hồ sơ giữ mã/tên/trạng thái, dịch vụ, nhãn nhóm 2.1/2.2 và năm số chính: tổng báo phí,
  đã thu, còn phải thu, chi phí đã chi, lợi nhuận thực nhận.
- `Lợi nhuận thực nhận = Payment đã vào - ProjectCost đã hoàn thành`. Đây là cách tính theo dòng
  tiền thực tế, không lấy Revenue nhập tay.
- Tab `Thông tin dự án` chứa form Project, trạng thái và người phụ trách. Các mô tả phụ
  dưới tiêu đề/label được bỏ để giảm nhiễu. Hợp đồng không còn nằm trong form này.
- Tab `Hợp đồng` quản lý nhiều hợp đồng theo Project/Báo phí và hiển thị rõ chủ thể nhận hóa đơn.
  Mặc định lấy Customer; nút `Xuất cho chủ thể khác` mở các trường pháp nhân riêng.
- Tab `Tài chính` hiển thị theo thứ tự: báo phí và tiến độ thu, chi phí đặc thù 2.1/2.2, lịch sử
  tiền vào.
- Tab `Khách hàng` gom liên hệ, pháp lý/hóa đơn và thông tin CRM; liên kết về Lead/Customer nằm tại
  đây thay vì rải ở đầu trang.
- Bảng đối soát tính riêng từng báo phí: tổng báo, tổng các Payment gắn báo phí, số còn lại, số lần
  thanh toán và trạng thái chưa thu/thu một phần/đủ/thừa.
- Payment chỉ gắn Project nhưng chưa có `quotation_id` vẫn xuất hiện trong lịch sử tiền vào và có
  cảnh báo số tiền cần đối soát; khoản này chưa tự động làm giảm công nợ của một báo phí cụ thể.
- Logic Revenue theo kỳ vẫn được giữ trong hệ thống nhưng tạm thời không hiển thị ở hồ sơ Project.
- Với dữ liệu cũ, trang chi tiết lấy thêm `projects.quotation_id` và Payment của báo phí nguồn để
  không làm mất quan hệ hiển thị nếu các cột `quotations.project_id`/`payments.project_id` chưa được
  đồng bộ trước đây.

### Chi Phí Theo Nhóm 2.1 Và 2.2

- Project nhóm 2.1 hiển thị sổ `Chi phí nạp quảng cáo`: ngày nạp/hủy, báo phí liên quan, mã CID,
  tài khoản quảng cáo, tài khoản ngân hàng nạp QC, ngân sách, VAT, ngân sách + VAT và tình trạng.
- Project nhóm 2.2 hiển thị sổ `Chi phí đối tác`: ngày chi/hủy, báo phí liên quan, đối tác, tài
  khoản công ty chi, chi phí đối tác, voucher/khuyến mại/chiết khấu, VAT, thực chi, nghiệm thu,
  hóa đơn đầu vào và tình trạng.
- `pending` chưa tính vào chi phí thực nhận; `completed` được tính; `cancelled` bị loại khỏi KPI.
- Một Project có nhiều khoản chi qua nhiều tháng, tương tự việc Project có nhiều Báo phí và nhiều
  Payment.

### Ràng Buộc Phạm Vi Hiện Tại

- Trang `/projects/services` đã được người dùng xác nhận là chuẩn. Không chỉnh sửa trang hoặc form
  dịch vụ nếu không có yêu cầu trực tiếp mới.
