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

### Chuyển Lead Thành Customer

- Frontend dùng `POST /api/customers` với `leadId`; không gọi tiếp một API cập nhật Lead riêng.
- Backend khóa bản ghi Lead trong transaction, kiểm tra `converted_customer_id` và Customer đã có
  cùng `lead_id` để không tạo trùng khi người dùng gửi lặp hoặc hai request chạy đồng thời.
- Trong cùng transaction, backend tạo Customer, cập nhật `leads.converted_customer_id` và
  `closed_date`, ghi timeline chuyển đổi, rồi gắn `customer_id` cho các Báo phí/Payment cũ của Lead
  nếu các bản ghi đó chưa có Customer.
- API `POST /api/leads/:id/convert` cũ vẫn giữ cho tương thích luồng tạo đồng thời
  Customer/Project/Contract, nhưng giao diện CRM hiện tại không dùng luồng nhảy cóc này.

### Chi Phí Dự Án

- `GET /api/project-costs?project_id=<id>`: lấy toàn bộ khoản chi của một Project.
- Trang `/costs` là sổ đối soát chi phí, dùng
  `GET /api/project-costs?page=&per_page=&group_by_project=1` để hiển thị chung `ad_spend` và
  `partner_cost`. Màn này không hiển thị Báo phí. API hỗ trợ `keyword`, `entry_type`, `status`,
  `reconciled_status=matched|unmatched`, `date_from`, `date_to`; phân trang theo nhóm Project để
  toàn bộ khoản chi cùng Project luôn nằm cạnh nhau và không bị cắt qua hai trang.
- `POST /api/project-costs`: tạo khoản chi; `PUT/PATCH /api/project-costs/:id`: cập nhật;
  `DELETE /api/project-costs/:id`: xóa mềm.
- `POST /api/project-costs/:id/reconcile`: xác nhận khoản chi đã khớp sau bước hỏi lại người dùng.
  Backend lưu `reconciledAt`, `reconciledBy`; sau khi đã khớp, mọi yêu cầu cập nhật hoặc xóa khoản
  chi đều bị từ chối. Tab Tài chính của Project thay nút sửa/xóa bằng trạng thái khóa `Đã khớp`.
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
- Base URL: `NEXT_PUBLIC_API_URL`, fallback `http://localhost:4000/api`.
- Trước khi login, frontend gọi `GET /sanctum/csrf-cookie` để khởi tạo CSRF protection.
- Payload:
  - `email`: email đăng nhập.
  - `password`: mật khẩu.
- Response login trả user hiện tại; token không còn được trả cho JavaScript.
- Nơi gọi: `src/app/(auth)/login/page.tsx`.
- Trạng thái tích hợp: Laravel Sanctum lưu phiên bằng cookie `x3_crm_session` dạng HttpOnly;
  frontend không lưu token hoặc user auth trong localStorage.
- API client luôn gửi cookie bằng `withCredentials` và gửi `X-XSRF-TOKEN` cho các request thay đổi
  dữ liệu.
- Xử lý lỗi auth: response `401` redirect về `/login`; lỗi kết nối backend được phân biệt và hiển
  thị màn `503` có nút thử lại, không cho render dashboard từ cache.

## Logic

### Login Và Auth Guard

- Màn `/login` validate `email` và `password` bằng React Hook Form + Zod.
- Submit login gọi CSRF cookie trước, sau đó `POST /auth/login` với `{ email, password }`.
- Nếu login thành công, `auth-store` chỉ giữ user trong memory và redirect bằng
  `router.replace('/users')`.
- Khi refresh trang, `src/app/providers.tsx` gọi `auth-store.init()` để xác minh cookie session qua
  `GET /auth/me` trước khi cho render app.
- Các route trong `src/app/(app)` yêu cầu trạng thái `authenticated`. Trạng thái `unauthenticated`
  redirect về `/login`; trạng thái `unavailable` hiển thị màn mất kết nối máy chủ.
- Màn `/login` không render form cho tới khi auth init xong. Nếu người dùng đã có session và mở
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
- Luồng giao diện đi tuần tự, không nhảy cóc:
  - Lead chưa chuyển đổi có một CTA chính `Chuyển thành khách hàng`.
  - Tạo Customer thành công dừng tại hồ sơ Customer, không tự mở form tạo Project.
  - Từ hồ sơ Customer dùng CTA `Tạo dự án`; tạo Project thành công mới mở hồ sơ Project.
- Lead đã chuyển đổi hiển thị `Mở khách hàng` thay vì cho tạo Customer lần nữa. Nếu người dùng mở
  trực tiếp lại URL tạo Customer của Lead cũ, frontend chuyển về đúng hồ sơ Customer đã có.
- Thanh luồng `Lead → Customer → Dự án` xuất hiện trên hồ sơ Lead, Customer và màn tạo Project để
  người dùng biết đang ở bước nào và có thể quay lại chủ thể trước đó.
- `Customer` lưu hồ sơ dùng chung của khách hàng/pháp nhân. Một Customer có thể có nhiều Project.
- Mỗi `Project` tương đương một dòng dịch vụ của khách hàng trong tab `1. CRM` của Google Sheet.
- Project giữ dịch vụ, trạng thái chạy, người quản lý, Sales, link kế hoạch, thời gian triển khai và
  ghi chú vận hành.
- Một Project tồn tại qua nhiều tháng và có thể có nhiều lần báo phí, nhiều lần thanh toán.
- `Quotation` trong ngữ cảnh nghiệp vụ được hiển thị là `Báo phí`: số tiền đã báo khách cần thanh
  toán cho một kỳ/lần, không phải tiền ngân hàng đã thực nhận.
- Trạng thái nghiệp vụ của Báo phí chỉ có hai giá trị: `draft` hiển thị là `Báo phí` và `won` hiển
  thị là `Đã thanh toán`. Form không cho chọn trạng thái. Báo phí mới luôn là `draft`; backend chỉ
  chuyển sang `won` khi tổng Payment đã nhận đủ tổng thanh toán, và chuyển lại `draft` nếu đối soát
  thay đổi làm số tiền nhận không còn đủ.
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
- Báo phí mới lưu thêm snapshot `revenueGroup` (`2.1` hoặc `2.2`), `pricingMode`, `serviceRootId`,
  `serviceRootCode` trong `quotations.metadata`. Khi sửa báo phí cũ đã có snapshot, không tự đổi
  nhóm theo cấu hình hiện tại.
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
- Khi mở từ Customer bằng `/projects/new?customerId=<id>`, danh sách Báo phí khởi tạo chỉ lấy Báo
  phí của Customer đó (hoặc Báo phí của Lead nguồn chưa kịp có `customer_id` với dữ liệu cũ); nút
  Hủy quay lại hồ sơ Customer.
- Chỉ báo phí chưa gắn Project mới xuất hiện trong danh sách. Báo phí chưa có Customer được hiển thị
  là không thể chọn.
- Khi chọn báo phí, form tự điền `customerId`, `serviceId`, tên dự án từ metadata/tên dịch vụ và số
  tiền cọc. Customer và dịch vụ bị khóa để tránh Project lệch với báo phí nguồn.
- Backend kiểm tra lại các ràng buộc trên, không chỉ dựa vào frontend: không cho lấy báo phí của dự
  án khác, sai Customer hoặc sai dịch vụ.
- Khi tạo Project thành công, báo phí nguồn được gắn `project_id` nhưng không tự đổi trạng thái;
  trạng thái chỉ phụ thuộc việc đã thu đủ tiền. Các Payment đã gắn báo phí cũng được cập nhật
  Customer/Project. Luồng này hoạt động cả khi Project chưa có hợp đồng; `contract_id` có thể bổ
  sung sau.
- Form thêm Project không hiển thị và không tự tạo Hợp đồng. Hợp đồng chỉ phát sinh sau khi Project
  đã tồn tại, tại tab `Hợp đồng` trong hồ sơ Project.

### Hồ Sơ Trung Tâm Của Dự Án

- `/projects/:id` có bốn tab: `Thông tin dự án`, `Hợp đồng`, `Tài chính`, `Khách hàng`.
- Phần đầu hồ sơ giữ mã/tên/trạng thái, dịch vụ, nhãn nhóm 2.1/2.2 và năm số chính: tổng báo phí, đã
  thu, còn phải thu, chi phí đã chi, lợi nhuận thực nhận.
- `Lợi nhuận thực nhận = Payment đã vào - ProjectCost đã hoàn thành`. Đây là cách tính theo dòng
  tiền thực tế, không lấy Revenue nhập tay.
- Tab `Thông tin dự án` chứa form Project, trạng thái và người phụ trách. Các mô tả phụ dưới tiêu
  đề/label được bỏ để giảm nhiễu. Hợp đồng không còn nằm trong form này.
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

- Tab Tài chính dùng lưới 12 cột trên desktop: `Báo phí & tiền thu` và `Tiền vào` xếp dọc trong cột
  trái rộng 5/12; sổ chi phí nằm ở cột phải rộng 7/12. Bảng Báo phí chỉ thể hiện công nợ tổng hợp,
  còn bảng Tiền vào chỉ thể hiện từng giao dịch và kết quả đối soát để tránh lặp dữ liệu.
- Project nhóm 2.1 hiển thị sổ `Chi phí nạp quảng cáo`: ngày nạp/hủy, báo phí liên quan, mã CID, tài
  khoản quảng cáo, tài khoản ngân hàng nạp QC, một cột `Ngân sách + VAT` và tình trạng. Số tiền nhập
  cho lần nạp là số cuối cùng đã gồm VAT, không tách lại thành hai cột ngân sách và VAT.
- Với Project loại M,
  `Số tiền có thể nạp = Σ (Ngân sách báo phí + Ngân sách báo phí × VAT%) - Σ số tiền nạp đã sử dụng`.
  Không chặn kết quả ở 0; nếu đã nạp vượt hạn mức thì metric và thông báo trong popup phải hiển thị
  số âm để nhận biết phần vượt.
- Project nhóm 2.2 hiển thị sổ `Chi phí đối tác`: ngày chi/hủy, báo phí liên quan, đối tác, tài
  khoản công ty chi, chi phí đối tác, voucher/khuyến mại/chiết khấu, VAT, thực chi, nghiệm thu, hóa
  đơn đầu vào và tình trạng.
- `pending` chưa tính vào chi phí thực nhận; `completed` được tính; `cancelled` bị loại khỏi KPI.
- Một Project có nhiều khoản chi qua nhiều tháng, tương tự việc Project có nhiều Báo phí và nhiều
  Payment.

### Lịch Báo Cáo Tuần Của Dự Án

- Form thêm/sửa Project bắt buộc chọn Ngày bắt đầu, Trạng thái, Người quản lý, Sales phụ trách và
  Thứ báo cáo ở frontend. Backend Project vẫn giữ các trường phụ trách ở dạng nullable để không ảnh
  hưởng các luồng API khác.
- Select `Thứ báo cáo` lưu trực tiếp ISO weekday (Thứ 2 = 1 đến Chủ nhật = 7) trong
  `project_weekly_settings.report_weekday`. Sales phụ trách đồng thời là `report_owner_user_id` của
  cấu hình báo cáo tuần.
- `GET /api/project-weekly-settings/assignment-summary?report_owner_user_id=&report_weekday=&exclude_project_id=`
  trả số Project đang được phân công cho Sales vào cùng ngày. Form sửa truyền `exclude_project_id`
  để không tính chính Project hiện tại.
- Tạo/cập nhật Project đồng bộ cấu hình báo cáo tuần trong cùng transaction; không tạo thêm cột ngày
  báo cáo trùng lặp ở bảng `projects`.
- `/weekly-reports` có hai tab: `Theo dõi tuần` là bảng điều phối từ toàn bộ cấu hình Project đang
  áp dụng; `Lịch sử báo cáo` chỉ hiển thị các báo cáo đã được tạo.
- Báo cáo được tạo từ đúng dòng Project/kỳ trên bảng điều phối; trường Project trong form luôn chỉ
  đọc và hiển thị chung mã, tên, loại, trạng thái Project. Form chia hai cột: thông tin báo cáo ở
  trái, tệp đính kèm và repeater vấn đề/hành động ở phải. Phí quản lý lấy từ cấu hình Project nên
  không nhập lại trên báo cáo. Mỗi dòng repeater chỉ giữ `Loại`, `Nội dung`, `Trạng thái`; không
  nhập lại người phụ trách, ưu tiên hoặc hạn xử lý.
- `GET /api/weekly-reports/board?week_start=&keyword=&report_owner_user_id=&report_weekday=&due_status=&progress_status=&weekly_condition=&page=&per_page=`
  trả danh sách điều phối, metric và phân trang từ backend. Frontend không tải toàn bộ cấu hình và
  báo cáo để tự tính quá hạn.
- `Thứ báo cáo` là hạn nộp. Hạn đầu tiên phải sau Ngày bắt đầu Project; nếu ngày báo cáo của tuần
  bắt đầu đã qua thì chuyển sang đúng thứ đó ở tuần kế tiếp. Kỳ đầu cắt từ Ngày bắt đầu Project đến
  một ngày trước hạn; các kỳ sau gồm đủ 7 ngày. Ví dụ Project bắt đầu Thứ 3 nhưng báo cáo Thứ 2 thì
  hạn đầu là Thứ 2 tuần sau và dữ liệu kỳ đầu tính từ Thứ 3 đến Chủ nhật. Form chỉ chọn tuần chứa
  hạn; backend tự tính `week_start_date` và `week_end_date`, không nhận khoảng ngày tùy ý từ giao
  diện.
- Chỉ được tạo báo cáo cho tuần hiện tại hoặc tuần trong quá khứ. Bộ chọn tuần khóa chiều đi tới khi
  đang ở tuần hiện tại; frontend ép query tuần tương lai về tuần hiện tại và backend tiếp tục từ
  chối mọi request tuần tương lai để không thể tạo trước báo cáo cho cả năm.
- Trong đúng ngày đến hạn, trạng thái hạn là `Đến hạn hôm nay`; từ ngày kế tiếp mới là `Quá hạn`.
  Tiến độ báo cáo được tách riêng thành `Chưa tạo`, `Nháp`, `Chờ duyệt`, `Đã duyệt`.
- Mỗi Project chỉ được có một báo cáo cho một kỳ. Báo cáo `draft` được sửa, xóa, đổi tệp và gửi
  duyệt; `submitted` bị khóa nội dung, có thể được duyệt hoặc trả về nháp; `approved` chỉ được xem.
- Form tạo và chỉnh sửa báo cáo chỉ dùng `Hình ảnh`; không còn uploader tài liệu. Ảnh dùng thư viện
  media chung nên hỗ trợ tìm kiếm, phân trang, tải ảnh mới và dán ảnh bằng Ctrl+V có bước xem trước.
  Khi gắn ảnh thư viện, backend xác minh ảnh thuộc người đang thao tác và chỉ sao chép metadata/URL,
  không lưu thêm một bản file trùng lặp. Báo cáo đã gửi hoặc đã duyệt chỉ được xem ảnh.
- Sales phụ trách và Thứ báo cáo chỉ cấu hình từ form Project. `/weekly-reports` không còn popup sửa
  hai giá trị này để tránh hai nguồn dữ liệu.

### Ràng Buộc Phạm Vi Hiện Tại

- Trang `/projects/services` đã được người dùng xác nhận là chuẩn. Không chỉnh sửa trang hoặc form
  dịch vụ nếu không có yêu cầu trực tiếp mới.

### Quy tắc mã Lead và Customer

- `lead_code` chỉ dùng để nhận diện Lead trước khi chuyển đổi; không dùng để cấp mã Customer.
- `customer_code` do backend cấp theo dạng `001`, `002`, `003`, ... bằng khóa transaction và
  `MAX(customer_code) + 1`. Frontend không gửi và không cho sửa trường này. Nếu API rollback thì mã
  chưa được sử dụng, lần tạo tiếp theo dùng lại số đó nên không nhảy số vì request lỗi.
- Khi đã có Customer, mã Dự án và Báo phí mới phải ưu tiên `customer_code`. Báo phí thực sự được tạo
  trước Customer được phép giữ tiền tố Lead đến hết vòng đời.
- Không đổi mã Báo phí đã phát hành vì mã này đang được dùng trong nội dung chuyển khoản và webhook
  đối soát. Khi Lead đã chuyển đổi, backend tự bổ sung `customer_id` cho Báo phí còn thiếu liên kết.

### Sổ giao dịch, phân bổ và hoàn tiền

- `payments` là giao dịch ngân hàng gốc. Số tiền, nội dung, thời gian, tài khoản nhận và mã tham
  chiếu của webhook không được tách thành nhiều giao dịch giả khi khách chuyển gộp.
- Quan hệ tiền thu với Báo phí là nhiều-nhiều qua `payment_allocations`: một giao dịch có thể trả
  nhiều Báo phí và một Báo phí có thể nhận nhiều giao dịch.
- Tiền hoàn được ghi riêng tại `payment_refunds`; thao tác trên CRM chỉ ghi nhận khoản đã hoàn,
  không tự thực hiện lệnh chuyển tiền tại ngân hàng.
- Công thức bắt buộc: `Số dư chưa xử lý = Tiền nhận - Tổng phân bổ - Tổng đã hoàn`.
- Chỉ số `Đã thu` của Báo phí/Dự án chỉ cộng `payment_allocations.amount`, không cộng toàn bộ
  `payments.amount`. Vì vậy một giao dịch gộp không bị tính lặp cho hai Dự án.
- Khi webhook nhận diện được mã Báo phí, hệ thống tự phân bổ tối đa bằng số còn phải thu. Phần vượt
  quá vẫn là số dư chưa xử lý để phân bổ tiếp, giữ làm số dư khách hoặc hoàn lại.
- `Đã gắn báo phí` chỉ mô tả quan hệ nhận diện. Nếu Báo phí đã thu đủ mà giao dịch đến sau vẫn còn
  toàn bộ số dư chưa xử lý thì trạng thái tiền phải là `Chuyển thừa`; nếu giao dịch đã phân bổ một
  phần và vẫn còn dư thì hiển thị `Đã phân bổ + chuyển thừa`. Mã Báo phí vẫn được giữ để truy vết.
- `Đã phân bổ giao dịch` là trạng thái kỹ thuật của số tiền vào, không đồng nghĩa Báo phí đã thu đủ.
  Trên tab Tài chính của Dự án và `/payments`, nếu giao dịch chỉ gắn với một Báo phí thì UI ưu tiên
  trạng thái công nợ của Báo phí: `Đang thiếu` kèm số còn thiếu, `Đã thu đủ`, hoặc `Chuyển thừa`.
- Danh sách `/payments` gửi `group_by_quotation=1`: backend xếp toàn bộ giao dịch cùng Báo phí liền
  nhau và xếp nhóm có giao dịch mới nhất lên trước. Trên bảng, Báo phí, Dự án, Chênh lệch và trạng
  thái công nợ được gộp ô theo nhóm, chỉ hiển thị một lần. Phân trang theo nhóm Báo phí (giao dịch
  chưa xác định hoặc chia cho nhiều Báo phí là một nhóm độc lập) để không cắt đôi một nhóm giữa hai
  trang.
- `Chênh lệch = Tổng tiền thực nhận của nhóm - Tổng báo phí - Tổng đã hoàn`. Số âm là còn thiếu, số
  dương là chuyển thừa, `0` là đã khớp. Giao dịch được phân bổ cho nhiều Báo phí chỉ tính phần phân
  bổ của từng Báo phí, không lấy toàn bộ tiền giao dịch để tránh tính trùng.
- Không cho tổng phân bổ và hoàn tiền vượt số tiền giao dịch; không cho phân bổ vượt số còn phải thu
  của Báo phí. Muốn hoàn phần đã phân bổ phải hủy phân bổ trước.
- Hủy phân bổ dùng soft delete để giữ lịch sử, đồng thời tính lại trạng thái Báo phí và trả tiền về
  số dư chưa xử lý của giao dịch.
- Giao dịch chưa xác định có thể phân bổ thẳng vào Báo phí hoặc chỉ gắn Dự án. Gắn Dự án không làm
  giảm công nợ Báo phí. Có thể đánh dấu `internal`/`other` để loại khỏi khoản thu khách hàng.
- Báo phí chuyển sang `won`/`Đã thanh toán` khi tổng phân bổ đạt tổng phải thu; nếu hủy phân bổ làm
  số thu xuống dưới tổng phải thu thì tự quay về `draft`/`Báo phí`.
- Báo phí đã có phân bổ không được đổi tổng tiền hoặc xóa. Giao dịch đã có phân bổ/hoàn tiền cũng
  không được xóa trực tiếp.
- Khi tổng `payment_allocations.amount` của Báo phí đạt tổng phải thu (sai số tối đa `0,01`), Báo
  phí được khóa toàn bộ dữ liệu nghiệp vụ; màn chỉnh sửa chỉ mở trường `Ghi chú`. Backend áp dụng
  cùng quy tắc và từ chối mọi payload có trường khác ngoài `note`. Nếu hủy phân bổ làm số thu xuống
  dưới tổng phải thu, Báo phí tự mở khóa cùng lúc với việc quay về trạng thái `draft`.
- API thao tác chính: `POST /payments/{id}/allocations`,
  `DELETE /payments/{paymentId}/allocations/{allocationId}`, `POST /payments/{id}/refunds`,
  `POST /payments/{id}/link`.
- Migration `2026_07_15_000100_create_payment_allocation_ledger.php` tạo hai sổ mới và chuyển phần
  tiền đã áp dụng của dữ liệu cũ sang `payment_allocations` mà không thay đổi giao dịch webhook gốc.
- Migration `2026_07_15_000200_reclassify_excess_payments.php` phân loại lại giao dịch đã gắn vào
  Báo phí thu đủ thành `Chuyển thừa` mà không làm mất liên kết đối soát.

### Xem nhanh chi tiết Báo phí

- Danh sách `/quotations` và bảng `Báo phí & tiền thu` trong tab Tài chính của Dự án đều có nút con
  mắt mở popup chi tiết, không điều hướng khỏi màn hiện tại.
- Popup và màn thêm/sửa Báo phí dùng chung bảng hạng mục: STT, hạng mục, đơn vị tính, số lượng, đơn
  giá, thành tiền, tổng trước thuế, VAT và tổng thanh toán. Dòng giảm giá âm và cờ
  `Không tính vào tổng` phải hiển thị giống nhau ở cả hai nơi.

### Upload và thư viện ảnh dùng chung

- `ImageUpload` là component dùng chung cho avatar, ảnh CCCD và ảnh đối soát Báo phí. Ngoài chọn
  file, người dùng có thể bấm `Dán ảnh (Ctrl+V)` hoặc nhấn trực tiếp `Ctrl+V` khi popup thư viện đang
  mở. Ảnh trong clipboard luôn được hiển thị để xem trước; chỉ upload sau khi người dùng bấm
  `Chọn ảnh`, còn `Hủy ảnh` sẽ loại bỏ bản xem trước.
- Ảnh dán dùng chung API `POST /media/upload`, cùng giới hạn định dạng JPG/PNG/GIF/WEBP và dung
  lượng tối đa 3 MB như ảnh chọn từ máy.
- Thư viện gọi `GET /media` với `page`, `per_page` và `keyword`; tìm kiếm được debounce 300 ms và
  request cũ được hủy khi đổi từ khóa/trang. Mặc định hiển thị 12 ảnh, có thể chọn 12/24/48 ảnh mỗi
  trang. API không truyền tham số phân trang vẫn trả mảng cũ để giữ tương thích.
