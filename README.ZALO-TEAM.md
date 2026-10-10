# Zalo Team

Tài liệu theo dõi riêng cho luồng Zalo Team mới trong frontend CRM.

**CRM → Zalo, đợt 1 — 09/10:** local có nhóm nhận theo dự án/khách hàng, gửi báo phí và báo cáo đã duyệt bằng PDF/ảnh, lịch sử và tiếp tục phần chưa gửi. Xem [cách dùng, vận hành và giới hạn](README.ZALO-CRM.md). 33 kiểm tra nghiệp vụ cô lập và regression chiến dịch đạt; chưa gửi tài liệu thật, chưa deploy VPS. Thanh toán tự động thuộc đợt tiếp theo.

## Quy tắc cập nhật

- Từ ngày 30/09/2026, mỗi lần thay đổi Zalo Team phải cập nhật README này trong cùng lần làm việc.
- Đọc tài liệu này trước khi tiếp tục triển khai để bám đúng quyết định đã chốt.
- Nhật ký ghi: ngày, nội dung thay đổi, file/thành phần liên quan, kiểm tra đã thực hiện và phần còn chưa xác minh.
- Phân biệt rõ code đã viết, bản đang chạy local, kết quả người dùng nghiệm thu và bản triển khai server. Không ghi hoàn thành nếu mới chỉ viết code.
- Ý tưởng đang thảo luận phải ghi là đề xuất; chỉ chuyển thành quyết định khi người dùng chốt.
- Ghi mục mới nhất lên đầu nhật ký, đồng thời sửa phần hiện trạng để tài liệu không bị mâu thuẫn.
- Không ghi mật khẩu, token, QR đăng nhập hoặc nội dung trò chuyện riêng tư vào tài liệu.
- Trước khi chốt mỗi chức năng, đối chiếu cả giao diện và hành vi với Zalo Web và Zalo PC, rồi kiểm tra lại trên `/zalo-team`. Không coi API trả thành công là đủ nghiệm thu. Web/Team kiểm tra trực tiếp bằng Chrome; PC đối chiếu core/source và ảnh người dùng cung cấp. Từ 03/10/2026, người dùng cho phép Computer Use trên PC để kiểm chứng Đồng bộ và Sao lưu. Nếu hành vi PC chưa kiểm chứng được, phải ghi rõ giới hạn, không báo đã kiểm tra đầy đủ.

## Phạm vi đã chốt

- Dùng lại frontend hiện có tại `apps/frontend`, không dựng một ứng dụng frontend riêng trong thư mục `zalo/`.
- Điểm truy cập: **http://localhost:3000/zalo-team**.
- Route: `apps/frontend/src/app/zalo-team/page.tsx`.
- Phát triển local, triển khai từng phần theo hướng dẫn của người dùng.
- Giữ nguyên nghiệp vụ CRM. Từ 03/10/2026, `/zalo` chuyển sang `/zalo-team`; bộ ứng dụng/API cũ đã chuyển vào kho lưu trữ. Team không đọc dữ liệu Laravel Zalo cũ. Helper cần thiết thuộc backend; bộ Wine/bridge cũ và test của luồng đã ngừng được gỡ ngày 07/10, dữ liệu lịch sử vẫn giữ.
- Không tự khởi động Docker Zalo cũ. Ngày 05/10/2026 người dùng đã cho phép chuyển backup và Docker `x3-zalo-team-web` lên VPS 14.225.198.183, giữ `/zalo-team` trong CRM; cho phép tunnel SSH tự kết nối khi đăng nhập Windows.
- Được dùng Computer Use trên Chrome để xem giao diện, HTML/CSS và kiểm tra Zalo Web lẫn `/zalo-team`. Giới hạn chỉ đối chiếu source/core của Zalo PC ngày 01/10/2026 đã được người dùng mở rộng ngày 03/10/2026: cho phép Computer Use để kiểm chứng chức năng Đồng bộ và Sao lưu trên PC.
- Bước giao diện đầu tiên chỉ dựng **tab Tin nhắn**, tham chiếu trực tiếp Zalo Web: font, cỡ chữ, màu sắc, icon và kích thước bố cục.
- Tab Tin nhắn đọc danh sách/chi tiết và gửi văn bản thật bằng tài khoản Zalo Web của hội thoại đã chọn. Trang Liên kết tài khoản dùng Docker riêng, mỗi tài khoản có profile độc lập.
- Trang Tin nhắn hiện tại là mẫu thiết kế chuẩn cho các trang custom tiếp theo trong Zalo Team. Dùng lại component và style chung, không dựng mỗi trang một bộ font/icon/khoảng cách riêng.

## Hiện trạng — nguồn chuẩn sau audit 09/10/2026

| Phần | Hiện trạng | Giới hạn |
|---|---|---|
| Frontend local | Inbox, Danh bạ, Thẻ, Chiến dịch, Tài khoản, Đồng bộ & sao lưu; các chỉnh UI ngày 09/10 | Không suy ra đã deploy production |
| Production | Mốc triển khai đã ghi nhận: frontend `live-20261008` trên VPS Zalo, xác thực CRM production | Xem README.SERVER.md; chưa kiểm tra lại live trong đợt cleanup A |
| Local ↔ VPS | Local dùng chung kho/connector VPS, API local 9345 theo identity CRM local | Không phải dữ liệu thử riêng; không tự chạy thêm connector/worker local |
| Quyền | Admin toàn bộ; leader/phòng ban và user được chia tài khoản; tài khoản chưa phân công chỉ admin | Phân công do quản trị chọn; cache không thay quyền backend |
| Chiến dịch | UI/lifecycle mới ở local; API/worker local trên VPS có origin riêng | Không tự chạy chiến dịch hoặc coi worker local là worker production |
| Gọi điện | Gateway trên VPS; micro/loa tại trình duyệt; giữ adapter tương thích trong source | Gateway hiện một phiên hoạt động; chưa mở rộng đa cuộc gọi |
| Nhập file | UI Nhập từ file + helper đọc export trên Windows; hỗ trợ tiếp tục | Nhập PC trực tiếp đã nghỉ; chưa có upload/import production tương đương |
| Drive/backup | Media dài hạn và backup kho; backend kiểm tra hash/quyền | Backup kho chưa phải backup toàn dịch vụ; xem audit OPS-01 |
| Đợt A | Đã clean local: 6 module UI + 3 launcher/probe, CSS thừa; metrics runtime về backend; layout dùng chung và tài liệu | TypeScript/test/build Docker/health đạt; không đổi dữ liệu/secret/phiên Zalo, không deploy VPS |
| Đợt B | Source local có summary theo tab, phân trang ngày/chiến dịch, batch search/media và virtual list inbox/danh bạ | Đã kiểm thử fixture/UI local; chưa deploy API VPS. Thống kê dung lượng 100.000 tệp chưa đạt đều mục tiêu 300 ms; cần canary/load test |
| D1–D4 — Cộng tác và công việc | Hồ sơ/phân công, ghi chú/@, presence, việc/nhắc hạn, màn Việc của tôi/Điều hành đội; migration CRM local và worker nhắc hạn local đã chạy | Chưa deploy VPS/nghiệm thu đa người dùng; chỉ số chờ dựa trên trạng thái thủ công, chưa tính SLA tự động |

- Chạy local: `npm run dev:backend`, `npm run dev:frontend`. Frontend dùng launcher chống trùng cổng; tunnel đã cấu hình sẽ được kiểm tra tự động.
- Kiểm thử offline: `npm run test:zalo`. Metrics: `python -B apps/backend/integrations/zalo/metrics/server-metrics-test.py` (dùng `python3` trên Linux).
- [Audit và lộ trình A–E](ZALO-TEAM-AUDIT-2026-10-09.md) · [Lệnh và vai trò thư mục](tooling/COMMANDS.md) · [Runbook VPS](README.SERVER.md).
- Nhật ký dưới đây là bằng chứng theo thời điểm; các đoạn “chưa triển khai”, giới hạn cũ và lệnh cũ không thay thế bảng hiện trạng này.

## Đợt D — Cộng tác, công việc và điều hành (local, 09/10/2026)

### Hướng dẫn sử dụng đợt D — dành cho quản lý đào tạo nhân sự

Hướng dẫn nằm trong tài liệu này; giao diện chỉ giữ tên chức năng, trạng thái, dữ liệu và phản hồi cần thiết. Đợt D theo dõi trách nhiệm chăm khách trong CRM. Tài khoản Zalo, hội thoại, người phụ trách và người nhận từng việc là bốn khái niệm riêng.

| Khái niệm | Ý nghĩa | Ví dụ |
|---|---|---|
| Tài khoản Zalo | Tài khoản dùng để trò chuyện; có thể chia cho nhiều nhân sự | Zalo của nhân sự phụ trách kinh doanh |
| Hội thoại | Cuộc chat với một người hoặc nhóm | Nhóm chăm sóc khách hàng A |
| Người phụ trách hội thoại | Người chịu trách nhiệm chính theo dõi khách và điều phối các việc | Sale phụ trách khách A |
| Người thực hiện công việc | Người xử lý một yêu cầu cụ thể; có thể khác người phụ trách hội thoại | Nhân sự Ads gửi báo cáo tuần |

#### 1. Quyền của từng vai trò

| Vai trò | Thao tác |
|---|---|
| Chỉ xem tài khoản | Xem dữ liệu hội thoại và thông tin cộng tác theo quyền; không tạo ghi chú, nhận phụ trách hoặc sửa việc |
| Có quyền sử dụng tài khoản | Nhận hội thoại chưa có người phụ trách; viết ghi chú, @người có quyền; cập nhật việc được giao |
| Người phụ trách hội thoại | Liên kết hồ sơ CRM, đổi trạng thái hội thoại, tạo/sửa việc và giao cho người đủ quyền |
| Leader | Quản lý các tài khoản thuộc phòng ban mình quản lý, phân công/bàn giao trong đội và xem Điều hành đội |
| Admin | Quản lý toàn bộ tài khoản/hội thoại thuộc phạm vi kho CRM |

Quyền xem khách hàng/lead/dự án vẫn theo phân quyền CRM. Được chia tài khoản Zalo không tự mở quyền xem mọi hồ sơ CRM. Bàn giao việc không tự cấp quyền tài khoản. Nếu người cần giao không xuất hiện, quản trị kiểm tra quyền Sử dụng tài khoản, trạng thái nhân sự và phòng ban trước.

#### 2. Tiếp nhận một hội thoại

Mở cuộc chat → mở phần thông tin bên phải → tab **Công việc**. Nhấn **Nhận phụ trách** khi chưa có người nhận, hoặc leader dùng **Phân công**. Mở **Hồ sơ CRM** → **Liên kết hồ sơ** nếu đã có khách hàng/lead/dự án trong CRM; chưa có hồ sơ vẫn có thể nhận việc.

- Một hội thoại liên kết một khách hàng **hoặc** một lead. Khi liên kết dự án, các dự án phải thuộc cùng khách hàng; không gắn dự án cùng một lead.
- Gỡ liên kết chỉ bỏ quan hệ với hội thoại, không xóa khách hàng/dự án.
- Nhóm xuất hiện qua nhiều tài khoản dùng chung dữ liệu công việc khi connector xác minh cùng định danh nhóm. Trùng tên/ảnh không đủ để gộp. Hội thoại cá nhân được tách theo tài khoản Zalo.
- Mở dấu **ba chấm** cạnh Phân loại trong inbox để dùng bộ lọc **Của tôi / Chưa phân công / Trạng thái & nhân sự**. Khi đang lọc, dấu ba chấm có chấm xanh; **Bỏ lọc** trả về toàn bộ. Bộ lọc này giúp tìm phần việc hội thoại. Đây không phải bộ lọc người nhận từng nhiệm vụ.

#### 3. Trạng thái hội thoại và trạng thái công việc

| Hội thoại | Khi nào chọn |
|---|---|
| Cần xử lý | Có yêu cầu đang cần tiếp nhận hoặc mở lại |
| Đang xử lý | Nhân sự đang giải quyết |
| Chờ khách | Đã phản hồi và chờ khách cung cấp thông tin/xác nhận |
| Đã xử lý | Không còn yêu cầu đang chờ trong hội thoại |

Mỗi việc riêng có **Cần làm / Đang làm / Hoàn thành / Đã hủy**. Hoàn thành một việc không tự đánh dấu cả hội thoại đã xử lý. Tin nhắn mới không tự mở lại trạng thái hội thoại. Nhân sự chủ động đổi trạng thái theo tình hình thực tế.

#### 4. Ghi chú, nhắc đồng nghiệp và phối hợp

Tab **Ghi chú nội bộ** lưu thông tin bàn giao. Nhập nội dung → chọn **@ Nhắc đồng nghiệp** nếu cần → **Lưu ghi chú**. Người được nhắc nhận thông báo CRM. Nội dung không được gửi vào cuộc chat Zalo; những người được phép xem hội thoại có thể đọc lịch sử ghi chú. Ghi chú lưu nối tiếp, chưa có sửa/xóa ghi chú.

Dòng **đang xem / đang soạn** chỉ là tín hiệu phối hợp giữa người đang mở Team. Nó không theo dõi Zalo mobile/PC và không khóa nút gửi. Trạng thái xem cập nhật định kỳ khi tab hiện; soạn có thời hạn ngắn. Không xem đó là bảo đảm rằng đồng nghiệp chưa trả lời khách.

#### 5. Tạo, sửa và bàn giao công việc

Trong tab **Công việc**, nhấn **Tạo việc**; hoặc mở menu ba chấm trên tin nhắn → **Tạo công việc**. Điền tên, người thực hiện và hạn xử lý; phần chi tiết không bắt buộc. Tạo từ tin nhắn giữ liên kết về tin nguồn đã được máy chủ xác minh. Hạn được hiển thị và nhập theo giờ Việt Nam.

- Mở menu **ba chấm** trên công việc → **Chỉnh sửa** để đổi nội dung, người nhận, hạn, loại việc hoặc trạng thái. Menu cũng có **Bắt đầu làm / Hoàn thành / Hủy công việc / Mở lại**, tùy trạng thái và quyền. Việc đã hoàn thành/hủy nằm trong mục **Đã kết thúc** có thể mở rộng.
- Người nhận việc có thể xử lý việc của mình; chuyển sang người khác cần người phụ trách hội thoại hoặc quản lý.
- Chọn **Hoàn thành** khi xong, **Đã hủy** khi không tiếp tục; chọn lại **Cần làm** để mở lại. Không có thao tác xóa lịch sử công việc trong đợt D.
- Chỉnh tiêu đề/chi tiết không gửi lại thông báo giao việc. Đổi người nhận xử lý thông báo cũ của người trước và thông báo cho người mới.
- Nếu hiện **Công việc đã được cập nhật ở nơi khác**, bản đang nhập được giữ nhưng chưa được ghi đè. Nhấn **Tải bản mới** để lấy dữ liệu mới nhất rồi chỉnh lại; thao tác này thay bản nháp đang nhập.
- Nếu lưu báo lỗi mạng, hệ thống đọc lại dữ liệu và không tự gửi lại lệnh ghi. Kiểm tra kết quả trước khi thao tác thêm.

#### 6. Hạn xử lý và các loại nhắc

Form mặc định hiển thị việc thông thường. Mở **Nhắc theo dự án** khi cần báo cáo tuần hoặc gia hạn; chỉ chọn dự án đã liên kết và đang có quyền xem. Gia hạn dùng ngày hết hạn của dự án, không nhập hạn thủ công.

| Loại | Hoạt động |
|---|---|
| Công việc / nhắc hẹn | Đến hạn, tạo thông báo CRM cho người thực hiện còn quyền |
| Báo cáo tuần theo dự án | Chọn dự án đã liên kết và hạn kỳ đầu; mỗi tuần tạo một việc riêng |
| Nhắc gia hạn dự án | Nhắc lúc 09:00, trước ngày hết hạn dự án 7 ngày; cập nhật theo ngày hết hạn mới |

Nhắc đến hạn chỉ tạo một lần cho mỗi lượt nhắc. Hoàn thành/hủy giải quyết thông báo cũ. Mở lại, đổi hạn hoặc đổi người nhận tạo lượt nhắc mới phù hợp. Đổi tên/chi tiết không làm lùi lịch tuần đã xử lý. Việc không còn quyền thao tác tài khoản/dự án được bỏ qua khi phát thông báo; quản lý cần bàn giao hoặc xử lý quyền.

**Với báo cáo tuần:** việc gốc giữ lịch lặp, các kỳ sinh ra là việc độc lập. Hoàn thành việc gốc không tắt lịch. Muốn ngừng lịch, hủy việc gốc; hủy một kỳ sinh ra chỉ hủy kỳ đó. Mở lại lịch đã hủy bắt đầu từ kỳ tương lai. Nếu dịch vụ nghỉ nhiều tuần, chỉ bù kỳ gần nhất. Loại việc này nhắc nhân sự thực hiện, không tự soạn/gửi báo cáo cho khách.

**Với gia hạn:** dự án phải có ngày hết hạn và còn liên kết. Gia hạn là thông báo nội bộ; không tự nhắn khách, tạo báo phí hay gia hạn hợp đồng. Nếu đã hoàn thành việc gia hạn rồi dự án đổi ngày, tạo việc mới hoặc mở lại việc cũ theo nhu cầu.

#### 7. Việc của tôi và Điều hành đội

Vào **Công việc** ở thanh điều hướng trái (`/zalo-team/work`). **Việc của tôi** hiển thị việc giao cho tài khoản CRM đang đăng nhập. **Điều hành đội** xuất hiện với leader/admin, trong phạm vi tài khoản họ quản lý.

- **Việc đang mở**: nhiệm vụ Cần làm hoặc Đang làm.
- **Quá hạn**: việc đang mở có hạn trước thời điểm hiện tại.
- **Hội thoại cần xử lý / Đang chờ khách**: trạng thái nhân sự đã chọn, chỉ tính hội thoại có hồ sơ công việc.
- Bấm một ô để lọc danh sách; hai nút **Công việc / Hội thoại** đổi loại danh sách. Mở **Phân bổ công việc**, bấm nhân sự để xem việc đang mở của người đó; **Bỏ lọc** để quay về phạm vi chung.
- **Chưa phân công** là hội thoại đã theo dõi nhưng chưa có người phụ trách; không phải toàn bộ cuộc chat chưa mở.
- Nhóm dùng chung nhiều tài khoản chỉ tính một lần. Chỉ số là tổng theo phạm vi tôi/đội; bộ lọc bên dưới điều chỉnh danh sách.
- **Mở hội thoại** quay về cuộc chat; nếu có tin nguồn hợp lệ thì định vị tin đó. Menu **ba chấm → Chỉnh sửa công việc** hoặc tên việc mở hộp chỉnh ngay trên bảng khi có quyền. Đổi giữa Việc của tôi/Điều hành đội đưa bộ lọc về mặc định.

Các chỉ số này chưa phải SLA/thời gian phản hồi tự động. Không dùng chúng để kết luận mọi tin chưa trả lời hoặc hiệu suất nhân sự nếu chưa có quy ước xử lý thống nhất.

#### 8. Ví dụ X3Sales và quy trình hằng ngày

Khách A nhắn “gửi báo cáo quảng cáo tuần”: Sale nhận phụ trách nhóm, gắn khách hàng và dự án Ads; từ tin đó tạo việc “Gửi báo cáo tuần” giao nhân sự Ads, đặt hạn. Nhân sự Ads chuyển **Đang làm**, ghi chú và @Sale khi có điểm cần xác nhận. Gửi báo cáo cho khách bằng luồng tin nhắn bình thường, rồi hoàn thành việc. Sale chuyển hội thoại sang **Chờ khách** hoặc **Đã xử lý** tùy kết quả. Hệ thống không tự gửi báo cáo thay nhân sự.

Đầu ngày: mở Việc của tôi và xử lý phần Quá hạn. Trong ngày: nhận hội thoại, đặt việc có người/hạn rõ ràng, ghi chú bàn giao. Cuối ngày: cập nhật tiến độ, bàn giao phần chưa xong; leader xem phân bổ và hội thoại cần xử lý.

#### 9. Vận hành và những tình huống thường gặp

- Danh sách trống: chưa có việc được giao/hồ sơ được theo dõi, hoặc bộ lọc đang thu hẹp phạm vi; không phải tự động nhập mọi cuộc chat thành việc.
- Không thấy nút sửa/tạo: kiểm tra quyền Sử dụng tài khoản, người phụ trách hoặc người nhận việc.
- Không thấy dự án: kiểm tra liên kết khách/dự án và quyền CRM. Quyền Zalo không thay quyền CRM.
- Nhắc hạn chưa hoạt động: dữ liệu công việc vẫn được lưu; quản trị kiểm tra scheduler/worker. Khi chạy frontend/backend riêng ở local, dùng `npm run dev:zalo-work`. `npm run dev` đã có scheduler.
- Máy local tắt thì phần D local không tiếp tục chạy. Production cần triển khai code, migration và scheduler trên CRM VPS; lượt này chưa deploy.
- Dữ liệu ghi chú/phân công/công việc nằm trong database CRM. Sao lưu file Zalo lên Drive không thay backup database CRM.

### Ghi chú triển khai và kiểm chứng

**Rà UI và logic D — 09/10/2026 (local):**

- Dùng chung trạng thái có màu, tên/viết tắt nhân sự, menu ba chấm và trạng thái rỗng qua panel và board. Giữ font, màu và layout Zalo Team.
- Panel ưu tiên người phụ trách và một ô tiến độ; hồ sơ CRM/lịch sử thu gọn. Công việc đang mở lên trước, việc kết thúc nằm trong mục riêng. Ghi chú có toolbar @/lưu gọn. Thao tác phụ và gỡ liên kết nằm trong menu, gỡ hồ sơ vẫn có xác nhận.
- Form tạo/sửa nhóm người nhận/trạng thái, hạn theo giờ Việt Nam, chi tiết và phần Nhắc theo dự án. Khóa trường khi đang lưu; chặn lưu nếu người nhận hết quyền/dự án gia hạn thiếu ngày. Chuyển về việc thường bỏ projectId không còn dùng.
- `taskCandidates` phản ánh đúng quyền bàn giao: leader trong đội, owner cho người đủ quyền, người nhận việc chỉ giữ chính mình, người chỉ xem không có lựa chọn. Board trả `canEdit` theo tài khoản nguồn hiện hành; không hiện sửa sau khi bị hạ xuống chỉ xem. Bộ đếm việc đang mở dùng tổng thật, không dừng ở 50 mục của panel.
- Board có hai nút Công việc/Hội thoại, chỉ số gọn, phân bổ thu gọn, menu hành động, phân trang chỉ khi cần. Sửa CSS bị reset từ shell và bố cục bộ lọc ở màn hình nhỏ.
- Kiểm chứng: **125 checks** (56 D1 + 46 D2–D4 + 23 tối ưu/UI logic), hai cổng query **board 14 / presence 17** trên fixture; TypeScript và Pint đạt. Chrome local: board/menu, phân công, hồ sơ đã liên kết, form/datepicker, loại nhắc; kiểm tra 375px/768px/desktop. Thẻ có dữ liệu, menu hoàn thành và ghi chú được kiểm tra bằng fixture UI tạm trong bộ nhớ, đã gỡ route kiểm tra. Không lưu việc/phân công/ghi chú thử vào dữ liệu thật. Console cuối lượt không có lỗi mới. Ảnh kiểm tra: `.local/d-ui-board.jpg`, `.local/d-ui-task-form.jpg`.
- Phạm vi: chưa deploy VPS; chưa nghiệm thu ghi dữ liệu nghiệp vụ với nhiều nhân sự. Presence/scheduler giữ luồng hiện có; cổng vận hành, tải lớn, restore và canary vẫn thuộc C.


**Tối ưu chuyên sâu — 09/10/2026:**

- Gỡ `WorkspaceHelp` và CSS chỉ phục vụ hướng dẫn, bỏ các đoạn chỉ cách thao tác ở inbox/panel/công việc. Giữ nhãn trường, quyền, lỗi và trạng thái cần quyết định. Bộ lọc board nằm cùng hàng ở desktop; hộp tạo/sửa việc tải khi mở.
- Mutation trả dữ liệu panel đầy đủ được đưa thẳng vào cache; không gọi đọc lại chính panel ngay sau khi lưu thành công, không đợi tải lại các màn khác mới báo lưu xong. Presence chỉ invalidates panel liên quan. Tải ghi chú cũ có hủy request/kiểm tra phiên để không trộn dữ liệu khi panel thay đổi.
- Form sửa giữ revision của bản đã mở. Khi nơi khác thay đổi, không dùng revision mới với nội dung nháp cũ để ghi đè; người dùng chọn Tải bản mới. Giao diện giữ thông báo xung đột cần thiết.
- Board gộp năm phép đếm thành hai aggregate; tải dự án theo batch, vẫn chạy policy từng dự án. Presence dùng upsert và join/group SQL, xét quyền hiện hành, người chuyển phòng, tài khoản đổi danh tính, nhiều tab và thu hồi quyền soạn.
- Migration CRM `2026_10_09_000250_optimize_zalo_crm_reminders.php` đã chạy **local**, thêm biên nhận/lượt nhắc và index. Scheduler bỏ qua việc đã nhắc thay vì mở transaction từng việc quá hạn mỗi phút. Khi sửa hạn/đổi người/mở lại, tạo lượt nhắc phù hợp; hết quyền ở tài khoản gốc có thể dùng alias nhóm đã xác minh mà người nhận vẫn có quyền. Chỉnh chữ không phát lại thông báo giao việc, không kéo lùi lịch lặp. Worker watch giữ chạy qua lỗi một chu kỳ, ghi lỗi và thử ở chu kỳ sau.

| Phép đo fixture SQLite cùng dữ liệu | Trước | Sau |
|---|---:|---:|
| Board 30 dòng, nhiều việc cùng dự án | 44 query | 14 query |
| Presence: 20 tab của cùng một đồng nghiệp | 158 query | 17 query |
| Chu kỳ nhắc không có việc mới đến hạn | chưa đặt cổng | 2 query trong fixture cache array |

Đây là số query của service trên fixture cô lập, chưa gồm HTTP/connector/xác thực/mạng hay tải đồng thời; không dùng để hứa tốc độ production. Ngân sách kiểm thử nằm trong `tooling/tests/zalo-team-work-performance.php --check`.

**Kiểm chứng lượt tối ưu:** 56 D1 + 46 cộng tác + 15 tình huống tối ưu đạt; thêm hai cổng số query đạt. TypeScript, Pint và bốn kiểm tra source layout đạt. PostgreSQL local đã kiểm tra aggregate, presence/upsert, nhắc hạn/idempotent receipt và hoàn thành trong transaction rollback; không giữ bản ghi thử hoặc phát thông báo thật. Không chạy lại full Node 326 test vì lượt này không đổi connector/media/campaign; kết quả full suite bên dưới thuộc lượt triển khai D trước. Chưa deploy VPS, chưa đo tải nhiều nhân sự hay soak/khôi phục C.

**Tóm tắt thao tác**

**Kiểm tra giao diện lượt tối ưu:** Chrome local đã mở Việc của tôi/Điều hành đội, bấm chỉ số để lọc hội thoại, đi về panel và mở/đóng form tạo việc tải động. Bộ lọc desktop cùng hàng, panel/form không còn nút Cách dùng hay đoạn chỉ dẫn. Chỉ đọc và hủy form thử; không ghi phân công/công việc/ghi chú hay gửi tin vào hội thoại thật. Lượt này chưa đo INP/heap, kiểm tra đa nhân sự hoặc nghiệm thu mobile mới.

1. Mở hội thoại → panel **Công việc** → **Nhận phụ trách** (hoặc leader phân công).
2. **Ghi chú nội bộ**: nhập nội dung, chọn **@ Nhắc đồng nghiệp**, lưu. Người được nhắc nhận thông báo CRM; không gửi vào Zalo. Ghi chú nối tiếp thành lịch sử, có tải các ghi chú trước đó.
3. **Công việc → Tạo việc**, hoặc menu ba chấm của tin nhắn → **Tạo công việc**. Chọn tên, người thực hiện, hạn theo giờ Việt Nam. Tin nguồn phải được connector xác minh; bấm liên kết nguồn để mở và định vị tin nhắn.
4. Việc có **Cần làm / Đang làm / Hoàn thành / Đã hủy**, sửa nội dung/người/hạn và mở lại. Người nhận việc, người phụ trách hội thoại và quản lý được cập nhật trong phạm vi quyền thao tác tài khoản.
5. Vào **Công việc** ở thanh điều hướng trái (`/zalo-team/work`): **Việc của tôi** dành cho nhân sự, **Điều hành đội** dành cho leader/admin. Các ô chỉ số mở danh sách tương ứng; bấm nhân sự để lọc tải công việc; có phân trang và đường về hội thoại.

**Lịch nhắc theo dự án:** cần liên kết dự án trong hồ sơ trước. Chọn **Báo cáo tuần** và ngày/giờ kỳ đầu: việc gốc giữ lịch lặp, mỗi kỳ sinh một việc riêng. Hoàn thành kỳ gốc không tắt lịch; hủy việc gốc sẽ dừng các kỳ sau. Nếu dịch vụ nghỉ nhiều tuần, chỉ bù kỳ gần nhất, không tạo hàng loạt kỳ đã lỡ. **Gia hạn** nhắc trước ngày hết hạn 7 ngày lúc 09:00 Việt Nam, tự cập nhật hạn khi ngày hết hạn dự án thay đổi. Không tự gửi báo cáo hoặc tin gia hạn cho khách.

**Nhắc hạn local:** `npm run dev` đã có scheduler. Nếu chỉ chạy backend/frontend riêng, mở thêm `npm run dev:zalo-work`. Lệnh này chỉ chạy `zalo-team:work-reminders --watch`, không chạy archive/campaign worker. Scheduler CRM production gọi `zalo-team:work-reminders` mỗi phút; không đăng ký lịch này trên runtime `zalo`. Trang Công việc báo khi heartbeat của dịch vụ nhắc hạn quá 150 giây. Worker local đã được khởi động và lần đầu tạo **0 thông báo** vì chưa có việc thật. Dừng cửa sổ/process worker thì phải chạy lại lệnh; không thêm tác vụ Windows tự khởi động.

**Dữ liệu và quyền:** migration `2026_10_09_000240_create_zalo_crm_collaboration.php` đã chạy trên PostgreSQL **local**, thêm `zt_crm_notes`, `zt_crm_tasks`, `zt_crm_presence` và tên hội thoại đã xác minh cho source. Bảng CRM thuộc database CRM, không nằm trong kho/backup tệp Zalo trên Drive. `ZaloTeamCollaboration` dùng chung identity/ACL/revision/transaction D1. Task/ghi chú chia sẻ theo global ID đã xác minh; API không nhận global ID từ browser. Chọn dự án vẫn kiểm tra policy CRM; board giới hạn quyền **trước** tổng hợp/phân trang và đếm mỗi canonical workspace một lần.

**Chống trùng và hiệu năng:** mutation không tự gửi lại; stale workspace/task revision trả 409. Khóa workspace trước task ở cả scheduler và thao tác UI để tránh đảo thứ tự khóa. Thông báo có dedupe key; lịch tuần có unique occurrence key và row lock. Đọc ghi chú 20 mục, công việc hội thoại 50 mục, board 30 mục/trang; sửa việc có đọc riêng theo ID để không phụ thuộc trang đầu. Presence chỉ báo nhân sự còn quyền: lease 55 giây, trạng thái soạn tối đa 12 giây, heartbeat 30 giây khi tab hiện, phát soạn tối đa 1 lần/10 giây, không chồng request; lỗi tăng khoảng chờ tới 120 giây. Đây là dấu hỗ trợ phối hợp, không khóa quyền gửi và không bảo đảm ngăn hai người trả lời đồng thời.

**Định nghĩa D4:** “Cần xử lý” và “Chờ khách” là trạng thái do nhân sự chọn trên **hội thoại đã được theo dõi**. Không đồng nghĩa mọi tin đến là tin khách; không tự tính SLA hay tự mở lại việc khi có tin Zalo mới. Đo thời gian phản hồi tự động cần bước riêng xác minh vai trò thành viên nhóm, sự kiện tin hệ thống và lịch làm việc; không trình bày số đo giả trên dashboard.

**Kiểm chứng:** 56 checks D1 + 46 checks D2–D4 trên SQLite cô lập; 19 cold HTTP bootstrap checks combined/CRM/Zalo; TypeScript đạt. Fixture bao gồm quyền đọc/thao tác/leader, @không có quyền, note paging, nguồn tin giả, sửa/trạng thái/revision xung đột, scope board, nhóm qua hai tài khoản, deadline Việt Nam, dedupe nhắc, sửa ngày hết hạn dự án, hủy lặp và thu hồi quyền. Chrome phiên thật local đã kiểm tra dashboard/điều hành, tab ghi chú, tạo việc trực tiếp và từ menu tin nhắn, lịch trong modal, nút lưu chỉ bật khi đủ trường; hủy form thử, không lưu việc/ghi chú hay gửi tin vào hội thoại thật. Chưa kiểm thử end-to-end ghi với nhân sự thật, chưa có kiểm thử cạnh tranh PostgreSQL/soak/backup-restore và chưa deploy production; các gate đó thuộc đợt C và nghiệm thu.

**File chính:** backend `ZaloTeamWorkspace.php`, trait `ZaloTeamCollaboration.php`, controller workspace, command `DispatchZaloWorkReminders.php`; frontend `workspace.ts`, `work-collaboration`, `work-task-dialog`, `work-presence`, `work-board`; tests `tooling/tests/zalo-team-collaboration.php`. API bổ sung `note`, `notes`, `task_create`, `task_edit`, `task_status`, `presence`, `board`; `read` nhận `taskId` tùy chọn và luôn ràng buộc theo hội thoại được phép xem.

**Hồi quy cuối đợt D:** `npm run test:zalo` đạt 325/326 tests, 1 skip như bộ nền; không có test thất bại.

**Chốt giao diện:** `TeamDatePicker` chuyển cấu hình nhãn sang `slotProps.inputLabel` theo API MUI X đang cài để bỏ cảnh báo prop cũ. TypeScript kiểm tra lại đạt; frontend local và màn Công việc đã mở lại thành công.

**PostgreSQL local:** đã thử claim → note → task từ tin nguồn → alias nhóm → board → hoàn thành trong transaction dùng ID fixture riêng, chặn HTTP/event rồi rollback. Bốn bảng workspace/note/task/notification có số dòng giữ nguyên sau kiểm tra; không có fixture hay thông báo được giữ lại. Đây là kiểm chứng SQL/transaction thực tế, chưa phải kiểm thử cạnh tranh nhiều kết nối PostgreSQL.

## D1 — Hồ sơ và phân công hội thoại (local, 09/10/2026)

**Cách dùng:** vào Tin nhắn, mở hội thoại → panel bên phải → tab **Công việc**. Màn hình chia rõ **1. Người phụ trách → 2. Hồ sơ CRM → 3. Tiến độ xử lý**. Nhân viên có quyền thao tác bấm **Nhận phụ trách** khi chưa có người nhận. Leader/admin dùng **Phân công** hoặc **Bàn giao**. Người phụ trách hoặc quản lý chọn **Liên kết hồ sơ** để tìm hồ sơ CRM theo tên/mã, xem lựa chọn rồi xác nhận. Có nút **Cách dùng** với ví dụ minh họa ngay trong panel và bộ lọc.

**Hoàn thiện trải nghiệm — 09/10:** tách Công việc/Thông tin Zalo; chỉ tải overview và kho Zalo khi mở tab Thông tin Zalo. Có phản hồi sau khi lưu, nút Bắt đầu xử lý/Đánh dấu đã xử lý/Mở lại công việc, giải thích trạng thái hiện tại. Bộ lọc nhanh Của tôi/Chưa phân công hiện ngay trên inbox; danh sách rỗng chỉ rõ cách bỏ lọc. Hộp phân công giải thích nhân sự phải được cấp quyền thao tác tài khoản trước. Chọn dự án tự lọc theo khách hàng đã liên kết (API vẫn lọc quyền dự án); hồ sơ đã gắn không chọn lặp. Khóa React của hồ sơ và bảo mật tách riêng để tránh cảnh báo trùng key.

**Kiểm tra lượt hoàn thiện:** 56 kiểm tra backend D1 đạt, TypeScript đạt, kiểm tra offline workspace đạt. Chrome phiên CRM sẵn có đã kiểm tra tab Công việc, hướng dẫn/đóng modal, danh sách người đủ quyền, tìm hồ sơ CRM, nút xác nhận chưa chọn bị vô hiệu, lọc Của tôi rỗng/bỏ lọc, chuyển Thông tin Zalo và quay lại; không phát sinh lỗi React mới trong lượt chuyển tab cuối. Không lưu phân công/liên kết ngẫu nhiên vào hội thoại thật hoặc gửi tin để test; thao tác ghi dùng fixture. Còn nghiệm thu ghi dữ liệu nghiệp vụ đúng người/khách và đa nhân sự trước production.

- Một lead **hoặc** khách hàng, kèm tối đa 20 dự án cùng khách hàng; lead không đi cùng dự án. Gỡ liên kết giữ nguyên bản ghi CRM. Quyền xem hồ sơ vẫn theo policy CRM, không suy ra từ quyền dùng tài khoản Zalo.
- Bốn trạng thái thủ công: **Cần xử lý / Đang xử lý / Chờ khách / Đã xử lý**. Không thay số chưa đọc hoặc quyền gửi tin Zalo.
- Mục **Phân công** dưới bộ lọc inbox: nút Của tôi/Chưa phân công, mở **Trạng thái & nhân sự** để lọc thêm; quản lý có thêm người phụ trách cụ thể. Bộ lọc áp dụng trên các nguồn hội thoại đang được phép xem và giao với bộ lọc sẵn có.
- Nhân viên chỉ nhận phần chưa phân công; leader giao người trong phòng ban quản lý, admin giao người có quyền thao tác phù hợp. Người đã bị thu hồi quyền/ngừng hoạt động không giữ trách nhiệm hiệu lực; người khác được nhận lại. Bàn giao không cấp thêm quyền tài khoản.
- Các bản nhóm dùng chung hồ sơ qua `globalGroupId` đã xác minh từ connector, kể cả chưa mở bản nhóm ở tài khoản thứ hai. ID là chuỗi opaque theo format connector (không chỉ số). Trùng tên/avatar/gom thủ công không đủ căn cứ gộp. Thiếu ID hoặc trùng ID trong cùng tài khoản sẽ chặn cập nhật, không tự tạo hai hồ sơ. Hội thoại cá nhân tách theo tài khoản Zalo.
- Có lịch sử 20 thay đổi gần nhất với người thao tác/thời gian. Khóa phiên bản và transaction ngăn ghi đè; lỗi ghi đọc lại trạng thái, không tự phát lại thao tác.

**Kiến trúc và API:** `POST /api/zalo-team/workspace` trên frontend chuyển về CRM API bằng cookie/CSRF. Lệnh `read`, `summaries`, `lookup`, `claim`, `assign`, `state`, `link`, `unlink`; mutation bắt buộc `revision`; `assign` bắt buộc `assigneeId` (null để bỏ phân công). Lookup lọc quyền trước phân trang 20 mục. Dữ liệu trả về `private, no-store`. Module nằm tại `ZaloTeamWorkspace.php`, `workspace.ts`, `workspace-panel.tsx`, `workspace-filters.tsx` và `workspace-filter.ts`.

**Tốc độ:** cache React Query theo phiên CRM, gộp request đọc đang chạy, tải summary khi mở/bật lọc; không polling mới. Mỗi lần tải summary dùng một lượt danh sách + một status nhỏ từ connector, không một request cho mỗi hội thoại. Identity lấy từ status vì inbox không trả `externalId`. Frontend lập Map một lần để lọc 10.000 nguồn; quyền CRM/ACL vẫn kiểm tra lại trên backend. Sau thay đổi tự cập nhật các query đang mở; thay đổi từ người khác thấy khi tải lại/chuyển focus, chưa có realtime cộng tác D2.

**Database:** migration `2026_10_09_000230_create_zalo_crm_workspaces.php`, bốn bảng `zt_crm_workspaces`, `zt_crm_workspace_sources`, `zt_crm_workspace_links`, `zt_crm_workspace_events`. Tiền tố riêng để không đụng `zt_workspaces` của Thẻ. Migration chỉ thuộc CRM/combined, không vào tập migration VPS Zalo. Đã áp dụng đúng DB local `127.0.0.1:5433/x3crm`; không sửa bảng thẻ hay dữ liệu CRM cũ. Backup D1 phải theo database CRM; backup kho chat/Drive không thay thế backup này.

**Bằng chứng:** 53 kiểm tra D1 trên SQLite cô lập đạt; 19 cold HTTP checks đạt (combined/crm có auth+CSRF, runtime Zalo không expose route D1). Suite Node: 325 đạt, 1 skip; TypeScript đạt. Kiểm tra chỉ đọc local qua connector thật: 394 nguồn, 333 nguồn nhóm có ID hợp lệ, đọc panel nhóm thành công; sau probe vẫn 0 hồ sơ D1 (không tự gán dữ liệu thật). Backend 4000 và frontend 3000 trả HTTP 200. Chưa nghiệm thu trình duyệt/responsive, chưa thử bàn giao đồng thời trên PostgreSQL/đa nhân sự và chưa build/deploy production D1.

**Để triển khai production sau nghiệm thu:** backup DB CRM, cập nhật code/migrate tại CRM, cập nhật frontend Zalo cùng endpoint proxy. Không cần đổi connector cho D1. Kiểm tra role/admin/leader/nhân viên, thu hồi quyền giữa phiên, identity nhóm và khôi phục DB trước khi mở rộng nhân sự. Hiện chỉ dùng thử local; không chạy lại hoặc gửi tin/chiến dịch thật trong lượt triển khai D1.

<details>
<summary>Các mốc hiện trạng trước đợt A — giữ để đối chiếu lịch sử</summary>

- **09/10 — rà soát chuyên sâu, chưa triển khai thay đổi:** báo cáo mới [ZALO-TEAM-AUDIT-2026-10-09.md](ZALO-TEAM-AUDIT-2026-10-09.md) bao phủ chức năng/UI, cleanup có bằng chứng, API/DB/render/media, chiến dịch/call, backup/Drive và lộ trình cộng tác CRM. Đề xuất A nguồn sạch → B tốc độ → C vận hành/khôi phục → D nghiệp vụ X3Sales → E mở rộng. Chưa xóa code/dữ liệu, chưa sửa runtime hoặc deploy VPS; các đợt mới vẫn là đề xuất.

- **09/10 — thứ tự menu Zalo Team (local):** Tin nhắn → Danh bạ → Thẻ → Gửi hàng loạt → Tài khoản → Đồng bộ & sao lưu; chuyển Thẻ lên trên Chiến dịch trong shell chung.

- **09/10 — cân kích thước icon Đồng bộ (local):** glyph Đồng bộ hiển thị 20px trong ô 24px để cân với các icon khác; áp dụng cả sidebar và header, giữ thẳng hàng chữ.

- **09/10 — tối ưu toàn bộ tab Đồng bộ & sao lưu theo UI/UX Pro Max (local):** nội dung dùng toàn bộ chiều rộng cột phải; thống nhất card, khoảng cách, thống kê, hàng thao tác sao lưu và lưới tài khoản đồng bộ. Bộ lọc tài khoản/ngày cùng viền cao 32px, nhãn ở trên; `TeamDatePicker` thêm tùy chọn compact/labelPlacement, giữ mặc định của các màn khác. Responsive theo độ rộng nội dung, bảng cuộn riêng. TypeScript đạt; Chrome kiểm tra bốn tab và Nhập từ file, lọc ngày rồi trả về tất cả, màn 390/1024px. Chỉ sửa UI local, chưa deploy; không nhập/sao lưu/khôi phục hoặc sửa dữ liệu thật.

- **09/10 — Đồng bộ & sao lưu dùng tab bên trái (local):** Đồng bộ/Lưu trữ/Sao lưu/Server chuyển sang sidebar 345px theo Danh bạ/Tài khoản, header bên phải theo tab đang chọn và nút Tải lại. Dùng chung `management-layout.module.css` với Tài khoản; màn hẹp đổi thành hàng tab cuộn ngang. Giữ điều kiện quyền cho Sao lưu/Server, nguồn Zalo Web mặc định, logic dữ liệu và các hộp thoại. TypeScript đạt; Chrome chuyển các tab, nội dung Đồng bộ/Lưu trữ/Sao lưu và màn 390px đã kiểm tra; không chạy thao tác ghi, chưa deploy production.

- **09/10 — đồng bộ đầu danh sách chiến dịch với Tài khoản (local):** bỏ heading trong card, đưa `Chiến dịch (n)` ra nền ngoài; dùng `SearchInput` chung, bộ lọc cao 32px/rộng 185px, padding 16px và khoảng cách 8px. TypeScript và Chrome đã kiểm tra; chưa deploy production.

- **09/10 — layout Liên kết tài khoản giống Danh bạ (frontend local):** thanh trái 345px dùng `inbox`/`directoryTab`, gồm Danh sách tài khoản và Thêm liên kết; bên phải dùng header/body của Danh bạ, nút tải lại, tìm kiếm và lọc trạng thái. Gỡ nhãn kỹ thuật Zalo Web · Docker và nút thêm trùng trong toolbar. Màn hẹp chuyển nav ngang, bảng cuộn riêng. TypeScript đạt; Chrome desktop/390px và tìm kiếm đã kiểm tra. Không thay đổi API/QR/phân quyền hoặc triển khai production.

- **09/10 — bỏ nút tạo trùng ở danh sách chiến dịch (frontend local):** gỡ nút xanh góc phải và prop `onCreate` không còn dùng; tạo chiến dịch qua mục bên trái.

- **09/10 — sửa chiến dịch dừng ở phần ảnh:** worker gửi kèm `text: ''` trong `send-media`, trái hợp đồng connector nên nhận `INVALID_REQUEST` trước dispatch Zalo. Đã bỏ trường này ở cả gửi ảnh và check-only, thêm log mã lỗi không chứa nội dung/token. API + worker local trên VPS dùng `campaigns-20261009-media-fix`, healthy; không đổi connector/production. Validator đang chạy xác nhận payload cũ sai, payload mới/check-only hợp lệ, không có biên nhận ảnh lỗi. Khôi phục đúng phần đó về queued và ghi audit; chiến dịch vẫn paused, giữ 1 sent + 7 queued. Regression PHP và 6 kiểm tra guard đạt; chưa gửi ảnh thật sau bản vá.

- **09/10 — chỉnh UI chiến dịch theo UI/UX Pro Max (frontend local):** danh sách dùng hàng gọn, tên không viền nút, số người/ngày tạo làm thông tin phụ, avatar tài khoản, tiến độ ngắn và badge màu theo kết quả. `CampaignMenu` dùng chung list/chi tiết: xem, sửa nháp, sao chép, gửi/tạm dừng/tiếp tục/hủy/xóa theo trạng thái; thao tác từ list gắn đúng ID và giữ xác nhận gửi/xóa. Chuẩn hóa tìm kiếm, trạng thái rỗng, border/radius/focus, footer hộp thoại và nút xóa đỏ; màn hẹp chuyển list thành thẻ. TypeScript đạt; Chrome kiểm tra menu, hộp xác nhận đúng chiến dịch, Escape, tìm kiếm rỗng, màn tạo/chi tiết, 375px và màn ngang. Chỉ frontend local; không thao tác ghi chiến dịch, không gửi tin, không deploy server.

- **09/10 — quản lý chiến dịch sau khi tạo (local):** bỏ quy tắc tự loại người đã nhận chiến dịch khác trong 24 giờ; vẫn kiểm tra ngừng nhận/thẻ loại trừ. Có sửa bản nháp của người tạo (khóa phiên bản chống ghi đè), sao chép vào form, chuẩn bị gửi tiếp phần chưa phát rồi xác nhận riêng, xóa khỏi danh sách nhưng giữ biên nhận/audit. Không phát lại phần đã gửi hoặc chưa rõ kết quả. Danh sách có tìm/lọc và % đã gửi; kết thúc toàn bộ bị bỏ qua ghi “Kết thúc · chưa gửi”. Preview dùng MessageText/emoji native, avatar, ảnh/GIF qua route xác thực. FE local + API/worker local trên VPS dùng `campaigns-20261009-lifecycle`; production/connector giữ nguyên. TypeScript và regression PHP đạt; Chrome đã thấy GIF/emoji/avatar, 0%/100%, hộp xác nhận xóa/gửi tiếp, sao chép giữ 4 người và tệp. Không chạy/gửi lại, không xóa hoặc sửa chiến dịch thật; thao tác ghi được kiểm tra bằng DB giả lập.

- **09/10 — gọn màn xem trước chiến dịch và DatePicker chung (local):** tách `CampaignReview`: thông tin/lịch/nút thao tác ở đầu, danh sách người nhận bên trái, chỉ hiện nội dung và kết quả của người đang chọn bên phải. Hẹn giờ và tùy chọn ngừng nhận thu gọn; ghi rõ số phần tin, giữ cá nhân hóa/retry/tạm dừng/hủy/phân trang. `TeamDatePicker` dùng MUI đã có, áp dụng đủ 5 ô ngày/giờ trong Team: chiến dịch, lưu trữ theo ngày, checkpoint, hạn bình chọn, nhắc hẹn. Tiếng Việt, ngày DD/MM/YYYY, giờ 24h, chọn đến từng phút, giao diện xanh Team; popup trong native dialog tự đặt tránh bị cắt. TypeScript đạt; Chrome kiểm tra chuyển người nhận, chọn/xóa lịch chiến dịch, lọc đúng 07/10 và trả về tất cả ngày, mở/đóng lịch nhắc hẹn. Chiến dịch test vẫn Bản nháp; không gửi/chạy/hủy chiến dịch, không tạo nhắc hẹn, không deploy VPS.

- **09/10 — bộ soạn chiến dịch dùng chung với chat:** dùng `MessageEditor`/`ExpressionPicker`, có emoji native, chọn hoặc dán ảnh, đính kèm tệp và ảnh xem trước. Nút Chèn trường gồm tên người nhận/nhóm và tên nhân viên CRM gửi; Enter xuống dòng, giữ bước Xem trước/xác nhận. Mặc định và giới hạn tối thiểu mới là **10 giây/tin**, thay mặc định 60 giây trước đây; chiến dịch cũ giữ cấu hình đã lưu. Frontend local đã kiểm tra Chrome; API local trên VPS dùng image `campaigns-20261009-10s`, sửa quyền ghi thư mục campaigns trong entrypoint. TypeScript + 31 kiểm tra PHP đạt; dán ảnh lên API thật thành công, không gửi tin. Chưa deploy giao diện/API production; chọn file tự động qua tiện ích Chrome còn bị chặn quyền file URL.

- **09/10 — tinh gọn từng phần form chiến dịch (local):** Bạn bè/Nhóm thành hai nút có icon và nền chọn theo Team; thẻ có marker đúng màu từ SharedTagsProvider, kể cả phần loại trừ/tóm tắt. Tài khoản gửi dùng Avatar trong TeamSelect; người/nhóm trong kết quả và Đã chọn dùng Avatar của danh sách chat, lấy danh bạ theo đúng tài khoản/loại với cache chung inbox 5 phút, không gọi từng liên hệ. Bỏ hướng dẫn đổi bộ lọc, box người nhận bên khung soạn và toàn bộ mục Gửi thử cùng state/style không còn dùng. TypeScript đạt; Chrome desktop xác nhận nút, marker màu và ảnh tài khoản/liên hệ. Chỉ frontend local, chưa deploy VPS; không tạo nháp/gửi tin.

- **09/10 — làm rõ người nhận chiến dịch (local):** chọn tài khoản/loại hội thoại/thẻ tự tải danh sách, bỏ nút Tìm người nhận. Có Kết quả lọc/Đã chọn, tên thẻ đang áp dụng, chọn tất cả kết quả tìm kiếm, và khung Sẽ gửi đến hiển thị tên từng mục (5 tên đầu, mở danh sách đầy đủ), bỏ riêng từng mục. Chỉ mục tích chọn được tạo nháp; đổi tài khoản/loại/thẻ bỏ lựa chọn cũ, tìm theo tên giữ lựa chọn. Query riêng theo bộ lọc, debounce 300 ms, cache 60 giây, hủy request cũ, không polling hay tự refetch khi focus. Chrome kiểm tra 577 liên hệ/1.052 nhóm, lọc thẻ rỗng, chọn/bỏ cá nhân, tìm Toyota và chọn đúng 24 nhóm; TypeScript đạt. Đã bỏ các lựa chọn thử, không tạo nháp/gửi thật, chưa deploy VPS.

- **09/10 — bố cục Gửi hàng loạt theo Danh bạ (local):** chuyển Chiến dịch/Tạo chiến dịch sang cột điều hướng trái, dùng chung style hàng chọn và header của Danh bạ; thay thanh tab ngang của mốc 08/10 bên dưới. Nội dung bên phải mở rộng theo màn hình, bỏ giới hạn chiều rộng card cũ. Khung soạn tự xếp lại theo chiều rộng vùng nội dung. Chrome desktop đã kiểm tra chuyển hai mục, tiêu đề, danh sách và footer Xem trước; TypeScript đạt. Chưa nghiệm thu màn hình nhỏ; không gửi tin hoặc triển khai VPS.

- **08/10 — gọn màn tạo chiến dịch (local):** đổi form ba khối dọc thành hai vùng theo bố cục Team: danh sách người nhận bên trái, khung soạn bên phải. Điều hướng Chiến dịch/Tạo chiến dịch dạng tab; bộ lọc thẻ, loại trừ, cài đặt gửi và gửi thử mở khi cần. Nút đính kèm/mẫu tin nằm trong thanh công cụ, chèn tên tại vị trí con trỏ, footer Xem trước cố định trong khung. Đã kiểm tra Chrome desktop chọn tài khoản, tải/lọc danh bạ, chọn liên hệ, chèn biến và mở/đóng cài đặt; TypeScript đạt. Chỉ sửa frontend local, không gửi tin, không đổi backend/worker hoặc triển khai production.

- **08/10 — gửi hàng loạt giai đoạn 1 đã chạy cho local:** `/zalo-team/campaigns`, chọn một tài khoản, bạn bè/nhóm từ danh bạ native, lọc thẻ chung/loại trừ, chọn người nhận, mẫu văn bản và biến tên, tối đa 3 ảnh/tệp, bản nháp xem trước, gửi thử cho liên hệ chọn rõ, hẹn giờ/khung giờ Việt Nam, tạm dừng/tiếp tục/hủy và kết quả từng phần. Worker chạy trên VPS Zalo, dùng identity CRM local (9341), phân biệt chiến dịch bằng origin để worker production không nhận nhầm. Sau xác nhận riêng, đã cập nhật/restart connector một lần; 4/4 tài khoản connected, worker ~30 MiB, số lượt thực gửi **0**. API/FE production giữ bản hiện hành; chức năng mới chưa mở trên domain production. 28 kiểm tra PHP + 23 Node đạt, TypeScript đạt; Chrome đọc 260 liên hệ, tạo nháp cá nhân hóa rồi hủy. Luồng tải tệp dịch vụ đã đạt; tự chọn tệp qua tiện ích Chrome bị chặn quyền file URL, chưa nghiệm thu UI upload/gửi thật.

- **08/10 — khôi phục tunnel local bị kẹt:** frontend 3000 và backend 4000 vẫn chạy, nhưng phiên SSH Windows đã mất còn giữ reverse 9341 trên VPS; watcher không thể mở lại forwarding. Đã giải phóng đúng phiên cũ, bật SSH server keepalive 30 giây × 3 cho phiên mới và khởi động lại watcher local. Sửa log PowerShell để giữ lỗi SSH thật. `npm run dev:frontend` xác nhận kết nối sẵn sàng/nhận diện FE đã chạy; Chrome local tải được inbox và Lưu trữ, hết cảnh báo. Không restart connector/API/DB hoặc deploy frontend production.

- **08/10 — tab Lưu trữ trên local:** ba tab **Tất cả · Chưa đọc · Lưu trữ** cùng hàng, không có số đếm; bỏ hàng/tiêu đề lưu trữ riêng và mục trùng trong menu. Chữ 13 px, khoảng cách 8 px. Chrome đã kiểm tra chuyển cả ba tab, Lưu trữ hiển thị 5 hội thoại hiện có; dữ liệu lưu trữ không đổi. Chưa deploy frontend production.

- **08/10 — ĐÃ kích hoạt gom nhóm tự động trên local:** sau xác nhận triển khai của người dùng, áp dụng adapter `globalId` và tái tạo riêng connector VPS, giữ volume/4 tài khoản. 210/210 nguồn nhóm trả ID chung; đối chiếu Mazda Long Biên, Spahem, Tinh dầu Lavender và SEODAO trùng ID giữa các tài khoản. Chrome local mỗi nhóm còn một dòng; danh sách từ 243 nguồn còn 160 dòng, 5 mục đã lưu trữ giữ nguyên. Bấm nhóm mở picker đúng hai tài khoản nguồn và nhãn tự động gom. Frontend production vẫn bản cũ; chỉ adapter connector dùng chung đã được cập nhật. Các mục “chưa kích hoạt” bên dưới là lịch sử trước xác nhận này.

- **08/10 — sửa local sau cutover production:** local dùng chung kho VPS theo lựa chọn người dùng, nhưng xác thực qua CRM local bằng API riêng `x3-zalo-team-dev-client-api-1` (loopback VPS 9345). `compose.dev-client.yml` chỉ chạy HTTP API, không có sync/backup/Drive worker; dùng nguyên database, kho và secret hiện hành. API production 9340 vẫn xác thực CRM production 9342; connector giữ nguyên, chưa triển khai gom nhóm tự động. Tunnel Windows bổ sung forward 9345, tiếp tục reverse identity 9341 → local 4000. FE/BE local đổi URL kho sang 9345. Chrome đã hiện 243 cuộc trò chuyện, 4/4 tài khoản, 5 mục đã lưu trữ, hết cảnh báo phân loại/lưu trữ.

- **08/10 — gom nhóm tự động (code local, CHƯA kích hoạt connector):** đọc `globalId` qua `getGlobalIdsFromGroupIds()` từ cache nhóm native trong một batch; ánh xạ giữ 5 phút theo frame/tài khoản, mục chưa có ID chờ tối thiểu 30 giây trước lần đọc lại, timeout 500 ms không chặn inbox. Frontend tự gom các nguồn có cùng ID chung, giữ ID nguồn để đọc/gửi và lọc quyền/lưu trữ trước khi gom. Liên kết thủ công ưu tiên; không gom theo tên/avatar hoặc khi ánh xạ mâu thuẫn. Chọn tài khoản mặc định của nhóm tự động lưu riêng theo user CRM trên trình duyệt này. Người dùng yêu cầu **chỉ hoàn thiện code local, chưa đụng connector** sau khi bộ duyệt chặn restart dịch vụ dùng chung; không áp dụng image mới hoặc restart, không deploy frontend production. Vì connector hiện hành chưa trả `globalGroupId`, tính năng chưa thể nghiệm thu với dữ liệu thật.

- **08/10 — ĐÃ mở production cho người dùng test:** https://crm.x3sales.com/zalo-team, menu Team ẩn trong sidebar CRM. Frontend `x3-zalo-team-frontend:live-20261008` và API/kho chạy VPS Zalo; CRM production đã chạy migration ACL và image backend `zalo-stage3-20261008`. Sau xác nhận riêng của người dùng, hai khóa dịch vụ đã chép ngoài source/image sang CRM, đối chiếu SHA-256, quyền 600, xóa bản trung chuyển local. Giữ 4 tài khoản/2 grants sau đối chiếu 27 người dùng và phòng ban khớp. API/sync/backup dùng identity CRM qua private 9342 và origin HTTPS production; không cần tunnel Windows cho bản production. Chrome phiên CRM thật đã mở inbox, Đã lưu trữ và Đồng bộ & sao lưu. Build/typecheck đạt, health 200, internal identity public 404. Chưa gửi/gọi thật hoặc nghiệm thu nhân sự; nhập file Windows hiện chỉ hỗ trợ localhost. Các mục CHƯA cutover bên dưới là mốc trước lần triển khai này.

- **08/10 — lưu trữ hội thoại cá nhân:** menu cuộc chat có **Lưu trữ hội thoại / Đưa lại danh sách chính**; menu danh sách có **Đã lưu trữ**. Trạng thái lưu trên VPS theo workspace, người dùng CRM và nguồn tài khoản/hội thoại; không xóa tin, không đổi Zalo app hay danh sách của đồng nghiệp. Tin mới vẫn ở danh sách đã lưu trữ. API và migration đã triển khai VPS Zalo; giao diện chạy local, chưa đưa tính năng này vào frontend production. Chrome đã kiểm tra lưu trữ → tải lại → khôi phục, dữ liệu thử đã hoàn tác; TypeScript và kiểm tra PHP về quyền/cách ly đạt.

- **08/10 — đợt 3 đang triển khai, CHƯA cutover domain:** frontend production riêng đã chạy healthy tại loopback 9300 VPS Zalo, image `x3-zalo-team-frontend:stage3-20261008-r2`; CRM và luồng local hiện hành chưa đổi. Tunnel SSH giới hạn ba cổng giữa hai VPS đã chạy sau xác nhận người dùng; kiểm tra CRM qua 9342 trả 200. Bản vá CRM đã build riêng, chưa migrate/recreate backend. Đang chờ xác nhận riêng để chép `service-key`/`connector-token` sang VPS CRM; bộ duyệt tự động yêu cầu bổ sung quyền này. 313 test đạt/1 skip, 42 kiểm tra PHP phân quyền đạt, backup/restore giả lập 6.000 tin đạt. Xem nhật ký và README.SERVER.md về phần còn lại.

- **08/10 — đợt 2 giảm tải và hiển thị sớm:** Web connector VPS đã dùng `inbox-stage2-20261008`; frontend/BFF chạy local. Lọc thông báo native, so sánh snapshot một lần/tài khoản và đẩy các hàng thay đổi; UI áp dụng trực tiếp, chỉ cập nhật khung liên quan. Tài khoản trả xong hiển thị trước; tin trang đầu hiện khi một nguồn đã trả, cursor chờ ghép đủ. Mẫu idle 71,8 giây: 6 JSON nền, 0 lần đọc lại inbox Web; mẫu trước 76 giây: 19 JSON gồm 13 inbox. 56 kiểm tra tập trung và TypeScript đạt. Xem nhật ký về số liệu, frontend dev và các giới hạn nghiệm thu.

- **08/10 — chuẩn hóa API phía trình duyệt:** dùng TanStack Query v5 đã có trong frontend, client riêng cho Team và từng phiên CRM. Quyền/kho kiểm tra mỗi 60 giây, cache danh bạ ảnh đại diện 5 phút; bỏ gọi CSRF vô điều kiện mỗi 5 giây. Request JSON đọc gộp trùng và xếp hàng tối đa 4 lượt, nền tối đa 2, deadline 20 giây gồm cả chờ hàng; thao tác ghi và stream tách riêng, không tự phát lại. Event handshake cùng revision không tải lại danh sách; gom thông báo trong 1 giây, tạm hoãn cập nhật nền khi ẩn tab. Chỉ thay frontend local; không restart/deploy backend VPS. Xem nhật ký bên dưới về kiểm chứng và giới hạn.

- **08/10 — đợt 1 ổn định danh sách:** frontend local và Web connector VPS đã cập nhật. Đọc danh sách giới hạn 8 giây/tài khoản, gộp lượt đọc trùng, giữ danh sách đã tải khi lỗi tạm và thử lại riêng tài khoản. Phiên kẹt quá 90 giây được tải lại riêng khi rảnh, tối đa hai lần/đợt lỗi; không tự phát lại lệnh gửi/gọi. Có bước lỗi, lịch thử lại và mã kiểm tra. Sau triển khai: 4/4 tài khoản, 148 hội thoại, Hoà Nguyễn 23; Chrome không còn cảnh báo khởi tạo. 34 kiểm tra hồi quy và TypeScript đạt. Chưa nghiệm thu chạy dài ngày; chưa triển khai frontend/CRM production. Đợt 2 đã triển khai ở mốc mới hơn bên trên.

- **08/10 — phân quyền tài khoản Zalo:** CRM quản lý phòng ban, người phụ trách và danh sách người dùng; một Zalo dùng chung một phiên/kho. Trang `/zalo-team/accounts` có **Phân quyền**. Các tài khoản cũ được đăng ký ở trạng thái chưa phân công, chỉ admin; không tự gán nhân viên. Trong lúc kiểm tra, người dùng đã tự chọn phòng ban cho một tài khoản; giữ nguyên lựa chọn đó. Migration và giao diện chạy CRM local; API/sync/backup/call đã cập nhật trên VPS Zalo 14.225.198.183. **Chưa triển khai migration/code CRM lên 45.252.251.120.**

- 08/10 (RAM Zalo Web): theo yêu cầu, bỏ mem_limit 2 GiB trong Compose local và VPS. Tái tạo riêng connector bằng image hiện có, giữ volume profile. Đã kiểm tra Docker Memory=0, cgroup memory.max=max, stats dùng tổng RAM VPS 15,64 GiB và health OK. Giới hạn CPU 2 core và PID 1024 giữ nguyên.

- 08/10 (sửa thêm tài khoản): connector VPS đã chạm giới hạn 256 PID/luồng, Chromium báo `pthread_create: Resource temporarily unavailable` khi tạo phiên QR mới. Nâng giới hạn lên 1024 bằng `docker update` và lưu Compose VPS/local, không restart connector hay xóa profile; Ở bước này RAM còn giới hạn 2 GiB (đã bỏ ở cập nhật tiếp theo bên trên). Chrome đã hiển thị lại QR khi hai tài khoản cũ vẫn kết nối. Next.js local nâng 14.1.4 → 14.2.35 để sửa `NextRequestAdapter` chuyển body của request đã hủy vào undici. Đã tái hiện lỗi trước sửa, chạy lại chuỗi POST hủy không còn TypeError, 3 regression trong `tooling/tests/next-request-abort.test.cjs` và TypeScript đạt. Frontend mới chỉ chạy local; bước quét/xác nhận tài khoản mới trên điện thoại cần người dùng thực hiện.

- 07/10 (giao diện đồng bộ): mặc định chọn Zalo Web; Nhập từ file dùng TeamSelect và nút Chọn file từ máy tính, hiển thị tên/dung lượng rồi mới Đọc file. Backend Windows local mở picker GUI không console, trả selection ID theo owner thay vì đường dẫn trên giao diện; không sao chép/upload cả file. Server bỏ mô tả cache 5 GiB và box khuyến nghị tài nguyên, rút gọn câu chữ. Chrome đã nhận file xuất 29,69 GB, chưa bấm Đọc file/nhập. Đây là luồng Windows localhost hiện hành; chưa có nhập bằng link Drive hoặc upload trình duyệt khi frontend triển khai từ xa.

- 07/10 (tổng dọn source, local): gỡ 178 file Wine/bridge, thử nghiệm gọi cũ, test hệ thống cũ và script chẩn đoán một lần; 3 test shared còn cần chuyển về backend. Giữ runtime Team, dữ liệu, khóa, profile và backup. `npm run test:zalo` gom 62 file kiểm tra: 280 đạt, 1 bài cần bản cài riêng bỏ qua. Docker loại test khỏi image. Không deploy/restart VPS; không coi đây là nghiệm thu lại cuộc gọi hay nhập dữ liệu thật.

- 07/10 (cấu trúc source, local): theo yêu cầu người dùng, mã Node chạy thật thuộc `apps/backend/integrations/zalo/` (web/call/file-import/pc/shared), PHP thuộc `apps/backend/app`, giao diện/API trung gian thuộc frontend. Tooling giữ Docker/dev/deploy/chẩn đoán; bỏ đề xuất services ngoài apps. Đã cập nhật subprocess/import/build context, di chuyển dependencies local; giữ secret/profile/tác vụ Windows tại vị trí cũ. 185 unit test đạt, 1 SQLCipher skip; 14 routing và 3 layout test đạt; TypeScript/PHP lint đạt; đóng gói COPY Docker với context mới đạt. Chưa deploy/restart VPS sau refactor.

- 07/10 (gọi thoại, mốc mới nhất): gateway ZRTC đã chuyển sang Docker trên VPS 14.225.198.183, gateway Windows tắt và local autostart=false. Dev API qua tunnel 9262 → VPS 9260, âm thanh Chrome đi trực tiếp VPS UDP 41000–41031; production frontend cấu hình `http://call:9260`. Chrome WAN synthetic tone → Opus → Chrome đã đạt, 5 kiểm tra Linux đạt, Docker healthy/restart unless-stopped, idle khoảng 17 MiB. Chưa gọi người nhận thật sau cutover; chưa nghiệm thu mạng chặn UDP/5G, chưa có TURN, hiện một cuộc gọi đồng thời.

- 07/10 (tài khoản mới): đã liên kết 1 tài khoản thật sau lần dọn test. API connected, đọc được 3 hội thoại nguồn Zalo Web; Chrome hiển thị và hết cảnh báo. Connector giữ riêng mã lỗi đọc; frontend phân biệt lỗi đọc với lỗi đăng nhập và tự thử tối đa 5 lượt khi danh sách chưa sẵn sàng/lỗi tạm. QR có đếm ngược, ẩn ảnh hết hạn và nút Lấy mã mới. Mốc 0 tài khoản bên dưới là trước khi người dùng thêm tài khoản mới.

- 07/10 (dọn tài khoản test theo yêu cầu): đã gỡ hai liên kết Duy/Nguyễn Thị Ánh và hai slot QR chưa dùng; kho VPS còn 0 tài khoản, 0 tin, 0 tệp, 0 backup. Xóa profile Team trên VPS và bản Docker local đã dừng, cache nhập file/PC local và gói migration test. Giải phóng 19.220.176.896 byte trên VPS, riêng gói migration local 10.695.475.203 byte. Drive: kho test cũ đã vào thùng rác (khôi phục được trong 30 ngày), tạo Kho dữ liệu trống mới và cập nhật dịch vụ; quyền Contributor/khóa giữ nguyên, --check đạt. File xuất gốc D:\backup_zalo_07_10_2026.zl.zip, CRM, Tiny House, định nghĩa thẻ chung và cấu hình dịch vụ được giữ. Tài khoản mới có thể liên kết và tự vào luồng Drive; chưa nghiệm thu với tài khoản thật. Các số liệu thử nghiệm bên dưới là lịch sử.

- 07/10 (khảo sát trước triển khai): đã xác nhận hai VPS và Drive công ty; người dùng xác nhận dung lượng 22 TB. Mốc khảo sát đã được thay thế bởi trạng thái Drive bên trên, giữ nhật ký cũ để truy vết.

- 07/10 (sửa gián đoạn và nút thắt ảnh): API/sync `file-native-priority-20261007` đã chạy trên VPS. Lượt nhập tự chờ HTTP 409/lỗi mạng tạm, giữ batch đã dựng; sync nền nhường lượt nhập theo owner. JXL → JPEG chuyển sang codec native VPS; batch tối đa 1.000 tin/~128 MiB, ghi version DB theo nhóm. API tối đa 4 CPU/3 GiB, FPM 6 tiến trình. Đã tái hiện 409 thật và xác nhận tự tiếp tục; batch 135 MB mất 21,2 giây. Mốc kiểm tra giữa lượt: 11.075 tin, 1.446 blob/1.017.875.968 byte, 0 sai SHA-256; mốc sau có 691 preview native, 0 lỗi chuyển đổi. Hàng đợi tiếp tục chạy, chưa nghiệm thu toàn bộ file 29,69 GB. Chi tiết nhật ký mới nhất.

- 07/10 (tối ưu nhập file): bỏ trần thử nghiệm 9,5 GB; mặc định **Không giới hạn**, có lựa chọn 10/20/50 GB. Worker chạy trong console ẩn và tách khỏi request. Truyền tệp theo nhóm bằng stream, kiểm tra tệp đã có theo nhóm và tra cứu đường dẫn qua chỉ mục; giữ SHA-256, quyền chủ kho, dừng/tiếp tục. API mới đã triển khai VPS (`file-pack-20261007`, tag `local`). Mốc đối soát sau thử dừng: 2.120 tin, 276 blob/183.076.440 byte, 0 sai checksum; riêng lượt 517 hội thoại đã xử lý 1.500 tin. Đây là mốc kiểm thử giữa lượt, chưa hoàn tất toàn bộ file. Xem nhật ký mới nhất.

- 07/10 (nhập file xuất, thay luồng PC trực tiếp): đã bỏ tab/điểm chạy nhập lịch sử PC cũ và autostart worker. Tab **Nhập từ file** đọc file .zl.zip trên Windows, lập chỉ mục theo khối, chọn hội thoại/tất cả, dừng/tiếp tục và lưu lên VPS. Đã dọn kho/backup Team trên VPS và tạm PC local theo xác nhận riêng; giữ file xuất gốc, liên kết tài khoản, CRM và Tiny House. File mẫu có 357.235 tin duy nhất/517 hội thoại; mới nhập thử 620 tin trong 2 hội thoại, 72 tệp (gồm bản gốc JXL và JPEG xem trước). Nhập lại giữ 620 tin, 0 tin mới; tổng truyền thử khoảng 4,3 MB, dưới giới hạn 10 GB. Có 2 ảnh và 8 nhãn dán chưa tìm thấy trong file xuất. File mã hóa vẫn cần đúng khóa tài khoản lấy từ Zalo PC một lần; sau đó đóng cổng chẩn đoán, không cần giữ app kết nối. Giao diện dừng/tiếp tục đã kiểm tra Chrome; chưa nhập/nghiệm thu toàn bộ 29,69 GB. Chi tiết và giới hạn ở nhật ký mới nhất.

- 07/10 (Lưu trữ theo ngày): bấm **N tệp chưa lấy được** mở chi tiết tệp gốc đúng ngày Việt Nam và tài khoản đang lọc, gồm tên tệp, hội thoại, người gửi, tài khoản Zalo, giờ gửi và lý do chưa lưu. Có nút mở lịch sử hội thoại trong ngày. API chỉ đọc, phân trang 50 mục, dùng cùng đơn vị đếm với bảng ngày; tệp chung nhiều tài khoản hiện một mục với các nguồn liên quan. API đã cập nhật trên VPS; frontend local đã kiểm tra Chrome với hai tệp ngày 07/10 và mở đúng lịch sử. 18 kiểm tra dữ liệu cô lập và TypeScript đạt; không chạy nhập PC hoặc sửa dữ liệu kho.

- 07/10 (khởi động và sidebar): đã phục hồi tunnel VPS bị dừng trong khi frontend/backend local vẫn chạy. Dev frontend/backend tự kiểm tra/mở lại tunnel khi dùng cấu hình VPS local. Sidebar gom lỗi danh sách, cập nhật trực tiếp, thẻ, kho và tìm kiếm thành một thông báo; chi tiết thu gọn, một nút Thử lại đọc lại các nguồn và nối lại stream, giữ danh sách đã tải. Kiểm chứng Chrome với tunnel tạm ngắt rồi phục hồi: một cảnh báo khi lỗi, 172 hàng hội thoại và bộ thẻ tải lại được, không còn cảnh báo. Chưa thử đăng xuất/đăng nhập Windows.

- 05/10 (Server): tab Server đã chạy với số liệu VPS thật, cập nhật 30 giây, lịch sử tối đa 24 giờ kể từ lúc bật; xem RAM/CPU/ổ đĩa toàn VPS và từng dịch vụ Zalo. Chỉ quản trị viên CRM có quyền xem; collector systemd và API read-only đã triển khai.

- 05/10 (VPS đang chạy): Web connector với hai account, database Zalo riêng, API kho/thẻ, worker sync/backup đã chuyển lên 14.225.198.183. Frontend `/zalo-team` và xác thực CRM còn local, nối qua SSH tunnel tự mở khi đăng nhập Windows theo xác nhận người dùng. Đã đối soát từng dòng DB và 12.520 tệp (10.161.920.905 byte), verify 7 backup cũ và 2 backup mới. Hai kho local đã dọn theo yêu cầu tiếp theo ngày 05/10 sau đối soát hash; ngăn worker/API local ghi nhầm kho sau cutover. Nhập PC có bridge Windows → VPS; đã kiểm tra truyền HTTP/quyền nhưng chưa chạy lại lượt xuất/nhập native PC hoàn chỉnh. Chưa có dự phòng độc lập; worker còn phụ thuộc CRM local/tunnel để kiểm tra quyền, chưa phải vận hành độc lập 24/7. Chi tiết README.SERVER.md và `tooling/zalo-team/service/README.md`.
- 05/10: đã sửa hồi quy khởi tạo HTTP do đọc config trong callback middleware quá sớm; backend local cổng 4000 trả 200 trở lại. Middleware quyết định stateful sau bootstrap, có 14 kiểm tra cold HTTP bảo vệ cả ba runtime. Không sửa quyền P2.
- 04/10 (nền tảng tách VPS, đã triển khai một phần ngày 05/10): runtime `combined/crm/zalo`, API/database riêng, xác thực quyền qua CRM và worker sync/backup giới hạn RAM. Backup đọc từng lô và manifest đĩa; mẫu 6.000 tin ~105,5 MiB tăng 4 MiB PHP heap. Bản đang chạy dùng frontend local → VPS qua tunnel; phương án Next riêng/edge cho CRM production chưa cutover. Xem hiện trạng 05/10 và `tooling/zalo-team/service/README.md`.

- 04/10 (nguồn ảnh): ảnh trong 15 ngày có URL HTTPS từ bản tin Zalo Web ưu tiên tải trực tiếp CDN ở timeline, album, thư viện và trình xem ảnh. Giữ URL kho làm dự phòng, chuyển khi các URL Web lỗi; ảnh cũ hoặc chỉ có trong kho tiếp tục dùng bản lưu. Trạng thái sao lưu và worker thu thập không đổi. Đã xác nhận ảnh gần đây trong chat và ảnh lớn tải từ `zdn.vn` trên Chrome local; chưa triển khai VPS.
- 04/10 (mở chat cũ): hội thoại chỉ có trong kho được chọn và tải tin ngay, không chờ `directory.open` từ Zalo Web. Chuẩn bị thao tác native chạy nền có giới hạn 12 giây và hủy khi đổi nguồn; cài đặt/bảo mật đọc sau bước chuẩn bị. Đã mở lịch sử 18/03/2025 của hội thoại người dùng báo trên Chrome local; chưa triển khai VPS.
- 04/10 (dọn dẹp và giao diện): có nút **Dọn dẹp** ở Đồng bộ/Lưu trữ, xem trước và chọn từng mục, đưa ra khỏi hàng đợi bằng trạng thái `dismissed`, có **Đã dọn → Đưa về hàng đợi**. Chỉ nhận URL 404/410 hoặc thiếu URL đã có bằng chứng native `missing` ở tất cả nguồn tài khoản liên quan; lỗi mạng, tệp có hash, chưa kiểm tra hoặc tìm thấy nguồn nhưng đọc lỗi đều bị loại. Giữ tin nhắn và blob, không báo các mục đã dọn là đã lưu. Đã áp dụng migration bằng chứng nguồn và kiểm tra UI local, chưa dọn thật/VPS. Đồng bộ rút gọn thống kê và mô tả; kết quả PC/thiết lập Web thu gọn; Lưu trữ theo ngày có số đã dọn; Sao lưu hiện ba bản gần nhất và nút xem thêm.
- 04/10 (thử lại tệp): lệnh thử lại không đặt lại hàng tải HTTP đối với URL rỗng hoặc đã trả 404/410; giữ nguyên lỗi nguồn và yêu cầu kiểm tra PC bền vững. Nguồn mới từ PC vẫn được nhập/tải qua luồng hiện có. “Tất cả mục chưa lưu” bao gồm cả pending, không bỏ sót yêu cầu tìm lại nguồn cho các mục đó. Kiểm tra trực tiếp PDF người dùng nêu và hai tin DBMain: native Message/Media, cache tệp và download-store không trả bản cục bộ đọc được; chưa chứng minh tệp mất ở mọi vị trí/thiết bị. Chưa phục hồi được các tệp này.
- 04/10 (tự phục hồi tệp PC): `retry-files` ghi cả yêu cầu tải URL và hàng đợi kiểm tra nguồn PC. Khi phiên PC đúng owner/account/external ID đang kết nối, worker tự gom hội thoại có tệp thiếu, dùng lại phiên hiện tại; không cần bấm từng tệp. Hàng đợi chỉ phục hồi các tin có tệp thiếu, không nhập thêm lịch sử ngoài phạm vi. Kết quả kiểm tra được lưu bền vững; không quét vòng lặp nếu nguồn vẫn thiếu, có thể thử lại sau khi tải tệp về PC. UI phân biệt tệp gốc/ảnh xem trước, hiện bản gốc đã lưu và thời điểm kiểm tra PC. Đã áp dụng migration và chạy local; chưa triển khai VPS.
- 04/10 (chi tiết chat cũ): mở nguồn ngoài inbox qua `directory.open` trước khi dựng chi tiết để hồ sơ/cài đặt/gửi tin dùng đúng phiên native; khi nguồn không kết nối vẫn giữ khả năng đọc kho. Sidebar ảnh/file/link và tìm kiếm ghép dữ liệu kho với Web, đúng owner/account và bỏ tin đã ẩn. Tin chỉ còn trong kho có menu sao chép; không gửi phản ứng/thu hồi/ghim/trích dẫn bằng ID mà Web không còn xác minh được. Đã kiểm tra hồ sơ, hộp cài đặt, menu copy và tìm kiếm tin năm 2024 trên Chrome local; chưa triển khai VPS.
- 04/10 (danh sách chat): inbox ghép danh sách Zalo Web với các hội thoại có tin đã đồng bộ trong kho, không giới hạn ngày 19/09 và không cần nhập từ khóa. Kho tải đủ các trang, tự làm mới sau 15 giây khi thành công, giữ danh sách cũ nếu lỗi và có nút thử lại. Hiển thị tin cuối còn hiển thị và thời gian thực của tin đó, thay nhãn “Lịch sử đã lưu”; avatar bổ sung từ danh bạ đúng account và người gửi đã lưu. Hội thoại chỉ có trong kho mở trực tiếp kho, không báo lỗi Web giả. Gộp theo account/conversation, áp dụng bộ lọc và thứ tự ghim/thời gian chung. Chưa triển khai VPS.
- 04/10 (giao diện tin nhắn): dấu lưu trữ trên tệp/ảnh thu về 16 × 16 px, icon trắng 12 px, nền đen mờ, bo góc 4 px và absolute cách góc dưới trái 4 px. Giữ tooltip và trạng thái lưu trữ hiện có.
- 03/10 (tệp PC): đã sửa bộ nhập bỏ sót cache `fileNoise`. Nhập lại hai hội thoại thật bổ sung 210 slot tệp/preview, 0 tin mới; tổng chưa lưu giảm 565 → 355 tại thời điểm kiểm tra. DOCX và hai ZIP người dùng chỉ ra cùng bản PDF liên quan đều `ready`, đối soát SHA-256 khớp bản native đã giải mã. Lịch sử Team hiển thị liên kết DOCX/ZIP từ kho riêng. Chưa kiểm tra hết mọi hội thoại/kiểu nguồn; không khẳng định toàn bộ 355 mục còn lại phục hồi được.
- 03/10 (ưu tiên mới nhất): tạm ẩn tab Điện thoại, Tra cứu toàn kho, vị trí lưu dữ liệu và Mốc kiểm chứng khỏi UI; các dữ liệu/API cũ được giữ. Tập trung nguồn PC qua máy. Hàng đợi PC được lưu theo ID, có ưu tiên hội thoại tiếp theo, giữ phần còn lại và kết quả khi dừng/mất phiên/kết nối lại đúng account; không tự chuyển hàng đợi sang account khác. Đã kiểm tra thật hai hội thoại: ưu tiên đúng, cùng PID/session PC, 0 tin mới trùng và 0 xung đột. Thống kê tệp tách xếp hàng / lịch thử lại / cần kiểm tra nguồn; yêu cầu thử lại được lưu bền vững và xử lý dưới khóa kho. Đây là cải thiện điều phối và thông báo, không khẳng định khôi phục được mọi nguồn hết hạn.
- Hướng API lịch sử không cần Zalo.exe: đã chạy native SQLite/SQLCipher bằng Node32 và kiểm tra kho mã hóa tổng hợp, nhưng **chưa mở/đối soát kho thật, chưa tích hợp thành nguồn sản phẩm**. Hướng này đã tạm dừng theo yêu cầu mới; tập trung nhập qua phiên Zalo PC đang đăng nhập. Bộ đọc cục bộ không chứng minh có API server trả toàn bộ lịch sử; xem nhật ký “Tách bộ đọc database khỏi Zalo.exe”.
- Nhánh **Điện thoại** đã ẩn theo yêu cầu mới; mã thử nghiệm còn giữ: nhận qua sync controller/worker của phiên Web, không điều khiển PC. Kiểm tra thật tài khoản Duy với `Zalo.exe` tắt: native trả `NO_NEED_SYNC`, 0 batch, UI hiện không có dữ liệu mới; không coi là bằng chứng đã nhận tin/tệp từ điện thoại. Cấu hình phiên hiện bắt đầu 19/09/2026 cho cả danh sách, tin gần đây và tin còn lại. **Chưa giải quyết nhập lịch sử trước giới hạn Web mà không dùng PC**, chưa kiểm chứng lượt cần xác nhận điện thoại/nhận batch thật. API có hàng đợi bền vững, chống lặp request, đúng owner/account/external ID, dừng và khôi phục trạng thái sau mất phản hồi. Kết thúc nhận được tách khỏi lưu kho; không thay thế backup và không báo đủ 100%.

- Giao diện tách kết quả nhập lịch sử PC và tình trạng tệp đính kèm. Lượt `ready` có coverage hoàn chỉnh, không bỏ qua bản ghi mới hiện “Đã nhập xong lịch sử đọc được trên PC”; lỗi/gián đoạn/xung đột vẫn giữ trạng thái riêng. Khối tệp thiếu giải thích dữ liệu đã lưu vẫn được giữ, tệp có thể còn ở thiết bị khác nhưng Team chưa kiểm tra, kèm số gốc/preview và nguyên nhân trong mục mở rộng.

- 03/10: đã phục hồi thực tế 1.658/2.003 slot media lỗi của snapshot trước sửa; còn 345 slot (308 gốc, 37 preview). Đã sửa nguồn sticker PC, bổ sung cache video/ghi âm, tái dùng đúng ảnh gốc đã kiểm chứng cho preview và chặn việc gộp tệp theo URL rỗng. 105 preview video được tạo từ video gốc đã lưu trong một lượt bảo trì offline. Còn 247 HTTP 404, 97 mạng/máy chủ, 1 sticker thiếu category trong nguồn cũ; chưa có bằng chứng đủ để phục hồi các mục này từ nguồn đã kiểm tra. Chưa khẳng định lưu đủ 100% lịch sử/tệp, chưa triển khai VPS.

- Ô tìm kiếm inbox tìm theo tên có/không dấu trong danh sách Web, danh bạ bạn bè/nhóm đã tham gia qua API connector và catalog hội thoại có lịch sử đã lưu của CRM owner. Bao gồm liên hệ chưa có trong inbox và hội thoại chỉ nhập PC. Kết quả theo account/hội thoại, gộp nguồn trùng, phân trang danh bạ/kho và giữ chat đang mở khi xóa từ khóa. Liên hệ ngoài inbox được mở qua native `directory.open` trước khi tải chat; tra số điện thoại vẫn dùng luồng riêng, không tìm tên người lạ toàn Zalo.

- 03/10: đã triển khai đợt đầu củng cố kho local theo phương án được duyệt. D0 có snapshot mã hóa 66 bảng + 5.641 blob (2.144.699.168 byte), phục hồi vào DB cô lập và đối soát hash từng bảng/tệp. Bảng `zt_archive_versions` được diễn tập rồi áp dụng local, bổ sung 34.963 phiên bản hiện trạng, giữ nguyên hash sáu bảng kho cũ. Web ghi trang + checkpoint cùng giao dịch; nhập PC quét đối chiếu nhưng bỏ qua tin không đổi/tệp đã xác minh, có lưu xung đột để đối chiếu. Chưa hoàn tất toàn bộ D1–D6, chưa cấu hình dự phòng ngoài máy theo lựa chọn của người dùng; chưa nghiệm thu 72 giờ hoặc VPS.

- Đã có luồng sử dụng trên **Đồng bộ & sao lưu → Đồng bộ → Zalo PC**: chọn account Team, xác nhận khởi động lại PC, đọc catalog đúng account, chọn riêng/kết quả tìm kiếm/tất cả hội thoại và nhập nền. Bỏ giới hạn cũ 50; “Nhập tất cả” lấy catalog đã xác minh ở server. Nhập xong hoặc dừng lượt nhập giữ phiên ready để nhập tiếp; chỉ ngắt khi yêu cầu, lỗi phiên hoặc 15 phút chờ. Có tiếp tục danh sách còn lại, tiến độ từng hội thoại và kết quả. Nút **Sao lưu kho Team** ở kết quả dùng worker sao lưu hiện có. Chạy `npm run dev:zalo-pc` trên Windows local; chưa dành cho VPS/browser từ xa và chưa đồng bộ điện thoại trực tiếp.

- Bộ nhập PC giai đoạn 1 đã chạy với dữ liệu thật local: tài khoản Duy, nhóm BAN TRUYỀN THÔNG HƯNG NGHĨA, bổ sung 25.152 tin và 4.294 bản tệp/ảnh xem trước. Lịch sử về tới 28/02/2026 (trước đó Web chỉ có từ 19/09). Đã kiểm tra ảnh/tin tháng 4 trên giao diện Team và nhập lại không tạo dữ liệu trùng. Cổng chẩn đoán tạm đã đóng, Zalo PC mở lại bình thường. Chưa nhập toàn bộ hội thoại/tài khoản, chưa thu thập PC liên tục hoặc nguồn điện thoại trực tiếp; chưa triển khai VPS.

- Chat thường đã ghép lịch sử Web với kho theo đúng account/hội thoại; kéo lên nối các trang đã lưu, ưu tiên trạng thái live; ảnh Web gần đây dùng CDN với bản kho dự phòng, các tệp khác ưu tiên bản gốc trong kho; tin chỉ còn trong kho là chỉ đọc. Khi đã xác định hết lịch sử Web, trang cũ hơn đọc trực tiếp kho; khi Web chậm/lỗi có cảnh báo dùng bản lưu. Nguồn PC đã có luồng kết nối/chọn hội thoại/nhập qua giao diện Đồng bộ; chưa thu thập trực tiếp điện thoại.

- Đồng bộ & sao lưu đã có **bảng theo ngày Việt Nam**, lọc account/ngày, hội thoại và tin chống trùng, tệp gốc đã lưu/chờ/lỗi, dung lượng và số blob (gồm preview); bấm ngày mở hội thoại theo account và chỉ đọc lịch sử trong ngày. Thử lại tệp lỗi có phạm vi ngày/account. Tab Đồng bộ hiển thị pha đang chạy, nguồn/tệp đang xử lý, số trang và tiến độ nguồn/tệp; nhịp quá 3 phút báo chưa hoạt động. Khối đường dẫn kho đã tạm ẩn theo yêu cầu mới; dữ liệu không được chuyển chỗ.
- Mốc kiểm chứng **19/09/2026** đã chốt local ngày 03/10 lúc 16:20:45: **448 tin/nội dung, 77 blob vật lý (28.685.320 byte), 24 hội thoại theo account**, không còn tệp chờ hoặc nguồn chưa quét tới ngày này trong catalog đã ghi nhận. Khối mốc kiểm chứng đã tạm ẩn theo yêu cầu mới, dữ liệu mốc và API vẫn được giữ. Mốc so sánh hash nội dung/tệp trong kho, không tải lại lịch sử từ Zalo; đã tạo backup mã hóa chứa mốc. Chỉ khẳng định dữ liệu thu thập được, không khẳng định toàn bộ lịch sử từng có trên Zalo.
- Tệp trong chat và lịch sử có icon trạng thái lưu: **Đã lưu trên server**, Mới lưu ảnh xem trước, Đang chờ lưu, Chưa lưu được. Tooltip dùng nội dung Zalo Team; bản gốc/thumbnail phân biệt riêng, file mất trên ổ không báo ready. Ảnh Web trong 15 ngày ưu tiên CDN và dùng URL riêng tư của Team khi nguồn Web lỗi; các tệp khác ưu tiên bản gốc trong kho. Kiểm tra trạng thái theo lô mỗi 15 giây, đúng account/hội thoại, không gọi một request cho mỗi tin.

- Có trang **Đồng bộ và sao lưu** tại `/zalo-team/archive`, chạy local từ 03/10: chọn tài khoản, thu thập lịch sử đọc được qua connector, tải tệp riêng tư, xem/tìm lịch sử đã lưu, sao lưu mã hóa và khôi phục phần thiếu. Nhóm dùng liên kết đã xác nhận để chống trùng nội dung; mỗi tài khoản vẫn có phạm vi lịch sử riêng. Đã bật thu thập cho hai tài khoản local; đang tải dần, chưa tuyên bố đầy đủ lịch sử. Chi tiết vận hành và giới hạn bên dưới.

- Có **bộ thẻ chung trong database CRM**: icon thẻ trên thanh điều hướng, Phân loại ở inbox/menu, gắn nhiều thẻ trong chat; Danh bạ và hộp chọn thành viên dùng chung danh mục. Thẻ theo workspace, quyền quản lý riêng `zalo_team.tags.manage`; quyền hội thoại vẫn do phiên Zalo xác minh. Đã nhập 13 thẻ nguồn Duy/Ánh thành 7 thẻ chung, 18 lượt gắn; 5 tham chiếu Khách hàng chưa có trong catalog được giữ trong snapshot chờ đối chiếu. Xem nhật ký 03/10 về kiểm chứng và giới hạn.

- Avatar ở header chat cá nhân và cạnh tin nhắn mở hộp **Thông tin tài khoản** dùng chung với Danh bạ. Trong nhóm, avatar mở hồ sơ đúng người gửi, nút Nhắn tin chuyển sang chat riêng bằng tài khoản đang chọn; avatar header nhóm/My Documents mở sidebar thông tin hội thoại. Kiểm chứng Chrome local ngày 03/10, chi tiết bên dưới.

- Có trang **Danh bạ** tại `/zalo-team/contacts`: select tài khoản ngay dưới ô tìm kiếm, mặc định tài khoản đầu tiên; bốn mục Bạn bè, Nhóm và cộng đồng, Lời mời kết bạn, Lời mời vào nhóm. Danh sách đọc catalog native theo từng tài khoản, không giới hạn ở inbox gần đây. Hỗ trợ tìm tên không dấu, sắp xếp, lọc/phân loại, mở chat, hồ sơ, đổi tên gợi nhớ, chặn/bỏ chặn, xóa bạn, xử lý lời mời và rời nhóm. Thêm bạn/Tạo nhóm dùng lại hộp hiện có với tài khoản đã chọn. Kiểm chứng Chrome local và giới hạn thao tác thật ghi tại nhật ký 03/10 bên dưới.

- Nhóm chung nhiều tài khoản có thể liên kết thành một dòng inbox. Bấm dòng để chọn tài khoản bằng popover; header có “Đang dùng” để đổi tài khoản và tùy chọn ghi nhớ theo nhóm. Dòng nhóm chỉ hiện một avatar 16px và số tài khoản còn lại trong hình tròn 20×20px; hover thay số `+N` bằng nút `…` tròn cùng kích thước/vị trí, avatar luôn giữ nguyên. Lịch sử, bản nháp và mọi thao tác vẫn theo tài khoản nguồn. Đã liên kết và kiểm tra hai nhóm Tráp ăn hỏi DUY ÁNH và Kiểm thử tạo nhóm từ Team 01-10 của Duy/Nguyễn Thị Ánh trên Chrome local. Connector đã trả `globalId`; frontend local tự gom theo ID chung. Liên kết thủ công vẫn ưu tiên; không dùng tên/avatar để xác nhận cùng nhóm. Frontend production cần triển khai bản mới để có giao diện tự gom.

- Ô tìm kiếm chính hỗ trợ tìm người qua số điện thoại với select gọn “Tìm bằng”. Phải chọn account trước khi tra cứu; mở chat/menu `…` và thêm vào nhóm đều giữ account đó. Chat người lạ có thanh Gửi yêu cầu kết bạn, đọc trạng thái native thật. Tìm chính mình hiển thị `(Bạn)`, mở My Documents và không cho kết bạn với chính mình. Hộp lời mời dùng bố cục hồ sơ Zalo (ảnh bìa, avatar, tên, lời chào) với dòng tài khoản gửi.

- Hai nút đầu danh sách Thêm bạn/Tạo nhóm đã hoạt động. Thêm bạn có select tài khoản, tra số điện thoại, kiểm tra tên/avatar và lời chào trước khi gửi lời mời qua native Web; đổi tài khoản xóa kết quả cũ. Tạo nhóm chọn tài khoản rồi dùng lại `GroupDialog`, không cần mở sẵn chat cá nhân.

- Hover một dòng hội thoại thay avatar tài khoản bằng nút `…` tại cùng vị trí. Menu có ghim/bỏ ghim, Phân loại bằng thẻ chung CRM, đánh dấu đã/chưa đọc, tắt/bật thông báo kèm thời hạn, ẩn, xóa hội thoại và báo xấu. Các thao tác Zalo tiếp tục theo tài khoản của dòng và không tự chọn chat đó.

- Danh sách hội thoại hiển thị avatar tài khoản 16 × 16 px ngay sau thời gian, cách 4 px; hover hiện tên tài khoản. Đã bỏ dòng tên tài khoản dưới preview, dùng ảnh từ danh sách tài khoản hiện có, không thêm API.

- Đã dọn tích hợp `/zalo` cũ khỏi frontend/backend ngày 03/10: menu CRM mở Team, bỏ API legacy và cờ `zaloTestAccess`. Quyền vào Team tiếp tục theo người dùng CRM đăng nhập/đang hoạt động. Kho lưu trữ local giữ mã cũ và 543 tệp đính kèm; các migration/bảng lịch sử, profile và test PC được bảo toàn. Không dọn dữ liệu Web hoặc thay đổi VPS.

- Sidebar có Thiết lập bảo mật, tin nhắn tự xóa, ẩn bằng PIN, báo xấu và xóa lịch sử. Đã bỏ lối tắt “Trò chuyện đã ẩn” khỏi sidebar ngày 03/10; adapter danh sách/bỏ ẩn sau xác minh PIN vẫn giữ. Dùng API native theo đúng tài khoản; tự xóa và xóa lịch sử đã thử thật trong nhóm kiểm thử ngày 02/10. Ẩn/bỏ ẩn đã kiểm tra logic và UI, còn chờ người dùng nhập PIN để kiểm chứng thật; báo xấu chỉ kiểm tra form/adapter, chưa gửi báo cáo thật. Xem nhật ký mới nhất cho giới hạn.

- Thành viên nhóm có thêm/xóa phó nhóm, xóa khỏi nhóm và rời nhóm qua API native. Chỉ hiện thao tác theo vai trò; trưởng nhóm có bước chọn người kế nhiệm trước khi rời. Đã thử thật bốn thao tác trong nhóm kiểm thử riêng Duy/Ánh, thêm lại thành viên sau thử và đối chiếu kết quả trên Chrome Zalo Web. Nhánh chuyển trưởng nhóm trước khi rời đã kiểm tra logic và UI, chưa chuyển quyền thật. Không triển khai VPS.

- Lịch sử gọi thoại từ Chrome đã ghi bằng signaling native `406/sendLogEndCall`, ngoài bước kết thúc `409`. Đã kiểm thử Duy → Hoà Ads: Zalo tạo bản ghi đi 15 giây, cập nhật preview và giữ sau tải lại trang. Thẻ gọi có icon SVG PC gốc, hướng gọi/trạng thái/thời lượng, Gọi lại qua voice controller hiện có và giờ ngoài thẻ. Không khôi phục giả các cuộc gọi cũ vốn chưa gửi log.
- Sửa gọi thoại ngày 02/10: đã ẩn icon video, thêm bộ đệm RTP 60 ms/sắp thứ tự theo timestamp và Opus PLC cho gói mất, đệm PCM trước khi phát. Người dùng báo gọi lại đã mượt hơn. Lỗi kết nối tái hiện có metadata PCM đầu tiên không hợp lệ làm đóng WebRTC; bản mới bỏ khung lỗi đơn lẻ, kiểm tra Int16/duration thực, chỉ dừng khi lỗi kéo dài. Regression WebRTC sau khi tiêm metadata lỗi vẫn kết nối/phát liên tục; cuộc gọi thật Hoà Ads 15 giây trong lượt sửa lịch sử tiếp tục kết nối với một khung lỗi đầu vào được bỏ qua.
- **Gọi thoại cá nhân đã chạy thật trên Chrome local ngày 02/10**: Duy gọi Hoà Ads từ nút gọi trong /zalo-team, kết nối khoảng 39 giây. Người dùng xác nhận “Hai bên nghe được”. Gateway gửi 1.898 gói âm thanh tới Zalo, nhận/xác thực 1.862 gói, không có lỗi xác thực. Micro/loa nằm trong Chrome; gateway Node xử lý WebRTC ↔ Opus/SRTP/ZRTC và signaling của tài khoản đang chọn. Nhánh này không chạy Zalo PC, Wine hoặc driver âm thanh ảo.
- Nút gọi cá nhân, hộp thoại gọi, thời gian, tắt/bật micro, kết thúc và giải phóng tài nguyên đã nối API nội bộ có scope owner/account/peer. Nút gọi cá nhân kiểm tra worker mỗi lần bấm; nhóm/My Documents chưa hỗ trợ. Gateway hiện chạy trên VPS bằng `service/compose.call-vps.yml`; production full stack dùng `compose.call.yml`. Helper Windows giữ cho chẩn đoán/chạy local khi cần nhưng đã tắt bằng `ZALO_TEAM_CALL_AUTOSTART=false`; không tự replay offer/start/end.
- Sau cuộc gọi thật, đã sửa nhịp phát PCM trên Windows bằng audio clock riêng; tiếp tục bổ sung jitter buffer/PLC theo phản hồi nghe giật. Người dùng xác nhận lần gọi lại đã mượt; xem nhật ký mới nhất để phân biệt với kiểm chứng tự động. Cuộc gọi đến, video/nhóm, chuyển mạng, phiên dài và triển khai Linux/VPS chưa kiểm chứng hoặc triển khai. Giao thức hiện hỗ trợ cấu hình Opus 16 kHz mono, SRTP mode 1, packetMode 2; không tự hạ mã hóa nếu profile khác.

- Menu `...` có Tạo nhắc hẹn và Tạo ghi chú nhóm qua API native, có biên nhận chống tạo trùng. Đã tạo thật từ Duy, xác nhận trên Zalo Web, kiểm tra ghi chú nhiều dòng/ghim và thẻ nhắc hẹn. Phiên Docker hiện hỗ trợ nhắc chung, không lặp/hằng ngày/hằng tuần/hằng tháng; nhắc riêng, nhiều ngày hằng tuần và hằng năm bị khóa theo khả năng phiên. Chi tiết giới hạn tại nhật ký 02/10 bên dưới.

- Nhóm có `... → Tạo bình chọn`: chủ đề, thêm/xóa lựa chọn, thời hạn, ghim, chọn nhiều, cho phép thêm phương án, ẩn kết quả/ẩn người bình chọn. Dùng API native của đúng phiên Web, có biên nhận chống tạo trùng. Hiển thị thẻ bình chọn, gửi/đổi phiếu cho các phương án hiện có và nhảy từ thanh ghim tới thẻ đã tải. Đã kiểm chứng local với Web ngày 02/10; chi tiết và giới hạn bên dưới.

- Sidebar có đổi tên gợi nhớ cho chat cá nhân, đổi tên nhóm qua quyền native, tắt/bật thông báo (1 giờ, 4 giờ, đến 8 giờ sáng, đến khi bật lại), ghim/bỏ ghim hội thoại. Tên, biểu tượng tắt thông báo và vị trí ghim cập nhật qua dữ liệu native của đúng tài khoản. Đổi tên My Documents chưa nối luồng riêng nên nút đổi tên ở đó bị vô hiệu hóa.

- Ctrl+V ảnh chụp clipboard mở khay ảnh chờ gửi dưới ô nhập: thumbnail 72px, thêm/xóa từng ảnh, Xóa tất cả, Enter/Gửi để gửi. Ảnh nháp tách theo tài khoản/hội thoại trong bộ nhớ của trang; chọn ảnh/file bằng hai nút toolbar vẫn gửi ngay. Text cùng khay được gửi thành tin văn bản riêng qua hàng đợi hiện có, chưa phải caption ghép vào ảnh.

- Ô soạn tin đã có `@` nhắc thành viên và `@All`: lấy catalog từ native theo đúng tài khoản/nhóm, lọc tên không dấu tại trình duyệt, chọn bằng chuột hoặc ↑/↓/Enter, Escape đóng. Metadata mention giữ qua bản nháp, undo/redo, định dạng, outbox và lịch sử. Đã gửi/nhận thật trong nhóm được người dùng chỉ định, chi tiết nhật ký bên dưới. Các lệnh `@GIF`/`@STICKER` chưa nối vào popup này.

- Tin nhắn có Trả lời, Copy, Ghim, Đánh dấu/bỏ đánh dấu, Thu hồi tin của mình và Xóa chỉ ở phía tôi; Chia sẻ chỉ có icon. Hover Like mở sáu cảm xúc gốc. Trích dẫn, trạng thái đánh dấu và cảm xúc đọc từ đúng phiên native; thanh ghim hiển thị các mục native đã tải. Chi tiết kiểm chứng/giới hạn tại nhật ký 01/10 bên dưới.
- Đã có trang `/zalo-team`, tiêu đề trình duyệt **Zalo Team**.
- Người dùng đã chấp nhận giao diện cơ bản của tab Tin nhắn ngày 30/09/2026.
- Sidebar thông tin hội thoại bên phải mặc định mở mỗi khi chọn chat. Nút trên header đóng/mở sidebar; ảnh/video, file, link lấy từ kho native của đúng tài khoản/hội thoại. Có xem tất cả, mở ảnh lớn và phân trang thành viên thật. Tạo nhóm từ chat cá nhân và thêm thành viên đã nối API native; quản lý nhóm vẫn disabled. Đổi tên, thông báo, ghim hội thoại đã nối native như nhật ký bên dưới.
- Trang `/zalo-team/accounts` đã chuyển sang API Web: QR thật, tìm kiếm/lọc trạng thái, kiểm tra kết nối, tạm dừng và kết nối lại. Không còn đọc tài khoản từ profile PC. Bốn icon dưới cùng đã bỏ; icon Liên kết tài khoản ở cụm phía trên.
- Đã dựng layout Tin nhắn: thanh điều hướng xanh, tìm kiếm/bộ lọc, danh sách hội thoại, khung chat, thanh công cụ/ô nhập và panel thông tin hội thoại.
- Thanh soạn tin đã nối gửi văn bản/emoji, sticker thường, ảnh và file thật: Enter hoặc nút Gửi, Shift+Enter xuống dòng; hiện rõ tài khoản gửi. `ExpressionPicker` dùng chung cho hai nút Sticker/Emoji. Hai nút ảnh/file chọn xong là gửi ngay qua hàng đợi, không có khay chọn hay bước Gửi N tệp; ảnh qua bộ xử lý native, file qua uploader native. Sticker gửi trực tiếp, emoji chèn tại con trỏ; bản nháp tách theo accountId/conversationId. Đã có định dạng văn bản, dán giữ chữ đậm và Like nhanh; danh thiếp chưa nối API.
- Dùng font Segoe và icon font gốc lấy từ tài nguyên công khai của Zalo Web, lưu local tại `apps/frontend/public/zalo-team/fonts`. Nguồn tài nguyên ghi trong `apps/frontend/public/zalo-team/ASSETS.md`.
- Kích thước desktop: thanh xanh 64px, danh sách 344px + border 1px, header 68px; icon điều hướng 28px, toolbar 24px, header 20px. Tên hội thoại 16px/24px, preview 14px/21px, nội dung bubble 15px/22px, thời gian 12px. Khoảng cách chữ 0.2px; tiêu đề dùng weight 500 theo trang gốc.
- Danh sách thật có tìm theo tên, lọc chưa đọc và lọc tài khoản, tên tài khoản nguồn trên từng dòng. Chọn hội thoại tải chi tiết đúng tài khoản bằng API, không điều khiển màn hình native hay gửi trạng thái đã đọc. Cuộn gần đầu khung chat tự tải tin cũ hơn, không cần bấm nút; giữ vị trí theo ID tin đang đọc kể cả khi ảnh tải muộn. Có ảnh lớn và liên kết file.
- Định dạng chi tiết đã tách thành `MessageItem`, `MessageText`, `MessageAttachmentView` theo source Zalo Web/PC: cụm người gửi bằng ID, avatar 40px, bubble 6px, giờ cuối cụm, ảnh/sticker ngoài bubble, chú thích dưới ảnh, card file/link và quote. Emoji dùng parser/sprite native; icon tệp dùng component FileIcon chung và SVG Zalo Web. Đã đối chiếu DOM 10 tin mỗi bên Team/Web và ảnh hiển thị; hai phiên khác tài khoản nên đây là đối chiếu format, chưa xác nhận nội dung trùng từng tin với PC. Bằng chứng và giới hạn tại `tooling/zalo-team/MESSAGE-UI-REFERENCE.md`; chưa có người dùng nghiệm thu bản sửa này.
- Lọc tài khoản bằng avatar đầu thanh xanh: logo mini X3Sales là tất cả tài khoản, bấm mở popup ảnh tài khoản bên cạnh. Chọn tài khoản đổi avatar và lọc ngay; chọn logo trong popup để về danh sách chung. Không còn dropdown tài khoản ở hàng Tất cả/Chưa đọc.
- Tên, avatar, preview, thời gian, số chưa đọc và ghim lấy từ client Web của đúng tài khoản. Avatar nhóm dùng ảnh nhóm hoặc thành viên thật; fallback chữ khi thiếu ảnh. Fixture và component chi tiết cũ chỉ còn là tài liệu mẫu thiết kế, không hiển thị nội dung mẫu dưới danh tính thật.
- Sidebar thông tin mở mặc định; chỉ header chat có nút đóng/mở. Xem tất cả và Thành viên là trang con bên phải, đều có nút quay lại overview giữ vị trí cuộn. Kho chia tab và nhóm ngày, cuộn tải thêm; trình xem ảnh dùng chung có zoom/xoay/chuyển ảnh. Bộ lọc hiện chỉ áp dụng trên phần đã tải. Xem `tooling/zalo-team/SIDEBAR-UI-REFERENCE.md` cho đối chiếu source và giới hạn chức năng.
- Trang nằm ngoài route group `(app)`, sử dụng root layout/providers chung của frontend.
- CSS và tên font được giới hạn trong Zalo Team, không sửa layout CRM hoặc trang `/zalo` cũ.
- Kiểm chứng ngày 01/10 sau khi sửa nguồn danh sách: hai tài khoản cùng kết nối, API trả 119 hội thoại thuộc danh sách hiển thị native (67 Duy, 52 Ánh). Đã loại 18 bản ghi metadata nằm ngoài inbox; dòng cuối của Duy khớp mẫu Trần Huyền ngày 17/09. Các preview mới trước đó bị thiếu đã trở lại, vẫn giữ sau khởi động lại connector. Đã sửa lỗi truyền sai trạng thái đồng bộ vào formatter. **Chưa đạt độ đầy đủ toàn bộ preview**: Duy còn 3 mục `sync_pending`; một nhóm trong mẫu hiển thị tin văn bản thay vì sự kiện bình chọn như phiên Chrome trước đó. Ở checkpoint 01/10 chỉ có lịch sử trong phạm vi Zalo Web; kho lưu dài hạn được bổ sung ngày 03/10 như mục hiện trạng.

</details>

## Bộ giao diện dùng chung

Nằm tại `apps/frontend/src/features/zalo-team/`. Route `/zalo-team` chỉ ghép các component và quản lý trạng thái của trang Tin nhắn.

| Thành phần | File | Quy tắc sử dụng |
| --- | --- | --- |
| Khung trang và thanh điều hướng | `components/workspace-shell.tsx` | Bọc trang mới bằng `ZaloTeamShell` để dùng cùng font, màu và reset CSS. |
| Chọn tài khoản bằng avatar | `components/account-switcher.tsx` | Nhận danh sách tài khoản, ID đang lọc và callback; dùng ảnh thật, logo mini CRM, đóng bằng Escape/bấm ngoài. |
| Icon, nút icon | `components/icon.tsx` | Dùng `Icon`/`IconButton`; ánh xạ glyph gốc tập trung một nơi. |
| Avatar đơn/nhóm | `components/avatar.tsx` | Dùng `Avatar`, nhận dữ liệu hiển thị; artwork My Documents nằm trong fixture, không kiểm tra ID cố định trong component. |
| Ô tìm kiếm, vùng cuộn | `components/primitives.tsx` | `SearchInput` cao 32px; `ScrollArea` hỗ trợ `compact` cho danh sách, giữ nguyên chiều rộng nội dung khi xuất hiện thanh cuộn. |
| Mục thu gọn, dòng thao tác, trạng thái rỗng | `components/primitives.tsx` | `PanelSection`, `PanelAction`, `PanelEmptyState`; **chỉ section chứa separator 8px**, nội dung lồng bên trong không thêm border/margin phân cách. |
| Dòng hội thoại | `components/conversation-row.tsx` | `ConversationRow` thống nhất avatar, tên, preview, thời gian, unread và ghim. |
| Chi tiết hội thoại thật | `components/conversation-detail.tsx`, `message-scroll.ts` | Cuộn lên tự tải API theo accountId/conversationId, một request lịch sử mỗi lúc; hủy request khi đổi chat, ghép theo ID, giữ mốc đọc qua prepend và ảnh tải muộn. |
| Tin nhắn và nội dung | `components/message-item.tsx`, `components/message-content.tsx`, `message-presentation.ts` | Dùng chung cách nhóm tin, avatar/tên/giờ, văn bản/emoji, ảnh/sticker, file, link và quote; không sao chép renderer theo từng trang. |
| Thao tác và cảm xúc tin nhắn | `components/message-actions.tsx` | Toolbar, menu, xác nhận thu hồi/xóa và sáu cảm xúc dùng chung; callback gắn đúng tài khoản/hội thoại/tin. Chia sẻ chỉ có icon. |
| Thanh ghim và danh sách ghim | `components/pinned-messages.tsx` | Dùng cùng hàng preview/danh sách 50px, icon nét và overlay giới hạn trong vùng lịch sử; nhận dữ liệu native và callback nhảy đến tin. |
| Thanh công cụ và ô nhập | `components/message-composer.tsx`, `send-state.ts` | Gửi văn bản, bản nháp riêng từng tài khoản/hội thoại, trạng thái gửi và kiểm tra kết quả chưa rõ; chỉ báo thành công khi Zalo xác nhận. |
| Chọn Sticker / Emoji | `components/expression-picker.tsx` | Một popup dùng chung cho cả hai nút; đọc catalog native theo tài khoản/hội thoại, sticker 4 cột, emoji 8 cột, gửi sticker qua cùng outbox; không sao chép popup theo từng tab. |
| Chọn ảnh / file | `components/message-composer.tsx`, `send-state.ts` | Chọn xong gửi ngay, hủy chọn không gửi; ảnh giữ loại ảnh, chọn qua File giữ dạng file. Giới hạn hiện tại 25 MB/tệp, 10 tệp/lượt, tổng 100 MB; giữ riêng bản nháp văn bản. |
| Panel thông tin hội thoại/nhóm | `components/conversation-info.tsx`, `components/info-library.tsx`, `components/info-media.tsx` | API riêng theo accountId/conversationId; overview và trang con kho/thành viên, tìm/lọc phần đã tải, cuộn phân trang, hủy request khi đóng/đổi chat. |
| Trình xem ảnh/video | `components/media-viewer.tsx` | Dùng chung sidebar và lịch sử; dialog toàn khung, zoom/kéo/xoay, phím trái-phải/Escape, thumbnail, nguồn lỗi có fallback. |
| Liên kết tài khoản | `components/accounts-page.tsx`, `account-types.ts` | Trang dùng chung shell, Avatar, Icon, SearchInput và token; đọc trạng thái thật từ API riêng của Zalo Team. |
| Hộp thoại | `components/dialog.tsx` | `TeamDialog` dùng dialog native để giữ focus, đóng bằng Escape/nút đóng và trả focus về nút mở. |
| Token và style chuẩn | `zalo-team.module.css` | Một nguồn font, màu, kích thước và CSS component; các biến `--zt-*` quy định header 68px, input 32px, section 40px/48px, separator 8px. |
| Dữ liệu mẫu và kiểu dữ liệu | `fixtures.ts`, `types.ts` | Fixture tách khỏi UI; chỉ phục vụ kiểm tra bố cục. |

Khi thêm trang custom: tái sử dụng component trên trước; thay đổi quy tắc chung tại stylesheet này và kiểm tra lại trang Tin nhắn. Không sao chép nguyên layout/style sang route mới.

## Luồng hiện tại: Zalo Web trong Docker

**Chrome `/zalo-team/accounts` → Next.js `/api/zalo-team/web` → worker Chromium → `https://chat.zalo.me/` → trang QR chính thức của Zalo.** Không mở Zalo.exe, không dùng Wine/VNC. Web worker hoạt động độc lập với Chrome cá nhân; dữ liệu phiên ở Docker volume riêng.

### Chạy local hiện tại

Dùng connector/kho VPS đã cấu hình; không khởi động một Docker Web local chung profile.

```powershell
npm run dev:backend
npm run dev:frontend
```

- Runtime Web: `apps/backend/integrations/zalo/web/`; cấu hình build/deploy: `tooling/zalo-team/web/`.
- Cần chẩn đoán tunnel mới dùng `npm run dev:zalo-vps`; không đổi port/identity origin tùy ý.
- Nhập dữ liệu qua Đồng bộ & sao lưu → Nhập từ file. Đã gỡ npm launcher `dev:zalo-pc`; lệnh Artisan cũ vẫn trả thông báo đã nghỉ cho caller cũ.
- `zalo:pc` chỉ giữ cho quản trị xuất/đối chiếu nguồn PC cũ, không phải lệnh khởi động ứng dụng và không chạy mặc định.

<details>
<summary>Cấu hình thử nghiệm Web local trước khi chuyển VPS — lịch sử, không chạy theo mặc định</summary>

```powershell
node tooling/zalo-team/web/prepare.mjs
docker compose -f tooling/zalo-team/web/compose.yml up -d --build
```

- Mã worker: `tooling/zalo-team/web/`. Playwright 1.63.0 và image có digest cố định.
- Cổng local: `127.0.0.1:9250`; service chỉ nhận lệnh có bearer token nội bộ. Token ở `tooling/zalo-team/.local/web-token`, không gửi xuống Chrome/Git.
- Profile và metadata: volume `x3-zalo-team-web_web_profiles`, mount `/data`; không dùng profile/cookie Chrome cá nhân hay profile PC. Không dùng `docker compose down -v` khi cần giữ phiên.
- API kiểm tra phiên CRM và Origin; chủ phiên suy ra từ user CRM ở server, không nhận owner từ client. Worker quản lý nhiều tài khoản cho một chủ phiên CRM, chưa triển khai phân quyền chia sẻ giữa các nhân viên.
- Metadata phiên ở `/data/accounts.json` phiên bản 2. Tự chuyển dữ liệu từ `account.json` cũ khi chưa có file mới; giữ nguyên profile Duy tại `/data/profile` và giữ file metadata cũ. Tài khoản thêm mới có `/data/profiles/<uuid>` riêng, mỗi profile chạy một Chromium persistent context. RAM tăng theo số phiên; chưa kiểm chứng quy mô lớn với giới hạn container hiện tại 2 GiB.
- Thêm liên kết tạo QR riêng; mỗi lần chỉ có một yêu cầu đăng nhập chờ xử lý. Tạm dừng/Kết nối lại/Kiểm tra gửi `accountId` và chỉ tác động tài khoản đó. Hủy QR đóng đúng phiên đang thêm, không đóng các tài khoản đang hoạt động.
- Chặn ghi đè danh tính khi kết nối lại và chặn thêm trùng ID Zalo. Quét nhầm tài khoản đã liên kết vẫn có thể khiến Zalo thu hồi phiên Web trước đó trước khi worker nhận diện trùng; hãy dùng một tài khoản khác khi thêm mới.
- QR gốc hiện là SVG trong `.qr-container`; adapter chuyển riêng phần QR thành PNG trong bộ nhớ. Không lưu QR ra file. Hủy hoặc hết thời gian yêu cầu đóng context chưa đăng nhập; xác nhận trên điện thoại do người dùng thực hiện.
- Tạm dừng giữ profile; Kết nối lại mở profile. Worker khôi phục tài khoản enabled khi restart; đã kiểm chứng với Duy sau khi tạo lại container và giữ volume. Đây chưa phải đăng xuất khỏi Zalo; phục hồi vẫn phụ thuộc phiên chưa bị Zalo thu hồi/hết hạn.
- API cũ `/api/zalo-team/pc` trả 410, không thể tự mở Zalo.exe. Profile PC cũ được giữ lại, không chuyển cookie/khóa PC sang Web.
- Server sau này cấu hình `ZALO_TEAM_WEB_URL`, `ZALO_TEAM_WEB_TOKEN_FILE` ở frontend server; giữ worker trong mạng riêng và bảo vệ volume. Hiện chỉ chạy local, chưa deploy VPS.
- Lưu phiên trình duyệt không đồng nghĩa đã lưu trữ dài hạn tin nhắn/media. Kho lưu riêng chưa triển khai.

</details>

### API chi tiết hội thoại

- `POST /api/zalo-team/messages` nhận `{ accountId, conversationId, before?: { id, time }, refresh?: boolean }`; `refresh` chỉ dùng khi không có `before`. Giữ xác thực CRM, kiểm tra Origin và owner; không nhận URL, cookie hoặc mã JavaScript từ client.
- Worker xác minh danh tính và inbox của profile. Dùng class loader native `ZCU6.d`: mở chat qua `getLastMessagesForConversation`, cuộn qua `loadTopMessagesForConversation`, cập nhật sự kiện qua `loadLastMessageLocalFrom`. Chỉ thay output sink/getState trên instance của request để thu kết quả, không thay method/store toàn cục và không chọn chat native. Cache, DB, cloud, ghép nhóm ảnh và kiểm tra cursor do Zalo xử lý. Output native đã parse không bị parse lần hai; refresh cache được parse một lần. Module ID phụ thuộc phiên bản Web.
- Số tin mỗi đợt do loader native quyết định; refresh đọc 50 bản ghi từ cache/local. Cursor giữ thời gian và ID chuỗi, không làm tròn ID lớn. Ranh giới lịch sử là dữ liệu Zalo Web cung cấp, không phải cam kết lịch sử đầy đủ/vĩnh viễn.
- Hiển thị văn bản, quote, ảnh, sticker, liên kết, file và nhãn cuộc gọi. Có renderer video/audio khi nguồn trả đúng loại và URL; chưa kiểm chứng hết biến thể/E2EE/poll/OA. Loại chưa ánh xạ có thông báo riêng, không làm lỗi cả hội thoại. Link media còn phụ thuộc hạn sử dụng của Zalo; chưa có tải nền/lưu trữ riêng.
- Ảnh JXL không mã hóa dùng converter JPEG native `Q8nW`; sticker lấy URL từ manager native. Tên/ảnh tác giả nhóm thiếu cache được bổ sung bằng API profile của chính phiên, chỉ trả tên và avatar xuống frontend.
- Client dùng `Accept: application/x-ndjson` để nhận từng đợt: cache/local hiển thị trước, kết quả sau ghép theo ID. Sidebar trả metadata và từng section độc lập. Client không yêu cầu streaming vẫn nhận JSON cuối như trước.
- `POST /api/zalo-team/web` với `{ action: 'events' }` mở luồng sự kiện có xác thực, scope owner/account. Worker theo dõi store native `emRR`/`CzFt`, gộp thông báo trong 100 ms, chỉ đẩy account/revision. Frontend dùng chung một kết nối, tải lại cache chat đang mở/list khi có thay đổi; bỏ poll lịch sử/list 10 giây. Kết nối đổi sau 25 giây, reconnect có resync; lỗi reconnect có backoff tối đa 10 giây. Worker vẫn kiểm tra trạng thái tài khoản 5 giây. Chưa có chức năng thu hồi/reaction/gọi điện; API đọc không chủ động chọn chat native hoặc gửi đã đọc.
- Hàng đợi tách theo account/action/conversation; gửi tin và chat khác không chờ lịch sử/sidebar chậm. Thao tác vòng đời tài khoản dùng barrier; ghi accounts.json tuần tự và gộp probe trạng thái đồng thời. Không tạo thêm kho lịch sử lâu dài trong CRM. Xem [NATIVE-LOADING.md](tooling/zalo-team/NATIVE-LOADING.md).

### Gửi văn bản

- `POST /api/zalo-team/send` nhận `{ accountId, conversationId, requestId, text }`; tối đa 2.000 ký tự, không nhận HTML/URL thực thi hoặc chủ tài khoản từ client. Dùng chung xác thực CRM, Origin và owner; worker kiểm tra profile đang online, đúng danh tính và hội thoại thuộc inbox.
- Dùng MessageObject và client ID của Zalo Web (`4HQc`, `NMlV`), gửi qua `dThN.sendMsgObject`; giữ wrapper E2EE native (`GpwQ`), không fallback bỏ mã hóa. Module thay đổi thì trả lỗi adapter.
- Enter/nút Gửi thêm bubble cục bộ ngay, xóa ô nhập đồng bộ và cho nhập/gửi tin tiếp theo. Mỗi tin có UUID và trạng thái queued/sending/sent/failed/unknown; hàng gửi tuần tự trong từng account/conversation. Chỉ xác nhận “Đã gửi” sau phản hồi native. Tin chờ được đặt sau lịch sử xác nhận để timestamp server không đảo thứ tự khi gửi liên tiếp.
- Worker stream `prepared` sau khi đã lưu receipt bền vững, trước khi chờ gửi hoàn tất. Client nhận client ID để ghép bubble đang gửi với sự kiện/lịch sử native; xác nhận dùng message ID/client ID, không ghép theo nội dung (hai tin giống nhau vẫn là hai thao tác riêng).
- Ghi receipt ở `/data/send-receipts` **trước khi gửi**, gắn owner/account/recipient/nội dung bằng hash và UUID. Receipt chỉ chứa hash/ID/trạng thái, không lưu nội dung tin. Cùng request ID không gửi lần hai kể cả restart worker. Chưa có chính sách dọn receipt tự động.
- Khi timeout/mất phản hồi, bubble giữ nội dung, tạm dừng các tin còn chờ và chặn gửi thêm; **Kiểm tra kết quả** tra cùng receipt/client ID, không tự gửi lại. Khi xác nhận thành công mới tiếp tục các tin đã xếp hàng. Lỗi xác định giữ bubble “Chưa gửi được” với **Soạn lại** (chỉ đưa về ô nhập trống, không tự gửi). Bản nháp/hàng chờ chỉ tồn tại trong trang, chưa lưu qua reload hoặc đăng xuất; receipt không thay thế kho lịch sử dài hạn.
- Đã kiểm chứng gửi thật tiếng Việt, emoji và xuống dòng vào **My Documents của Duy**, rồi reload frontend để đọc lại từ lịch sử. Chưa kiểm chứng gửi thật vào nhóm, tài khoản khác hoặc hội thoại E2EE; không gửi thử tới người khác.

## Lưu trữ ghi nhận cũ: thử nghiệm Zalo PC (đã ngừng dùng)

### Định hướng PC/Docker trước đây — đã được thay bằng Web

- Người dùng yêu cầu chuyển môi trường Zalo Team sang Docker để có thể chạy độc lập trên server, không phụ thuộc Zalo PC trên máy cá nhân. Bản Windows bên dưới chỉ là bước kiểm chứng đăng nhập hiện có.
- Kiến trúc đích: giao diện React trên Chrome → API có xác thực → dịch vụ quản lý tài khoản → Zalo PC qua Wine trong Docker Linux, với màn hình ảo nội bộ nếu ứng dụng cần. Không dùng VNC/noVNC để cung cấp giao diện cho người dùng.
- Profile, database và file mỗi tài khoản phải nằm ở volume bền vững; quản lý vòng đời tiến trình và phục hồi sau khi restart. Một container/dịch vụ quản lý không đồng nghĩa một tiến trình Zalo dùng được nhiều tài khoản.
- Cần thay phần API đang `spawn Zalo.exe` và giới hạn `LOCAL_WINDOWS_ONLY` bằng giao tiếp tới dịch vụ riêng, giữ kiểm tra xác thực và Origin. Adapter đăng nhập phải được kiểm chứng lại dưới Wine; không mặc định profile Windows di chuyển sang Linux sẽ giữ được auth.
- Ở thời điểm đề xuất PC, chưa chuyển sang Docker. Đề xuất này đã ngừng; luồng hiện tại dùng Web/Docker ở phần trên. Không khởi động lại container Zalo cũ, không sửa `/zalo` và chưa triển khai VPS.

Luồng: **Chrome → API Next.js `/api/zalo-team/pc` → connector loopback → Zalo PC riêng trên Windows**. Zalo PC xử lý đăng nhập và giữ phiên; frontend chỉ hiển thị QR và trạng thái. Không dùng auth của Zalo Web, Docker hoặc VNC.

- Chuẩn bị: `node tooling/zalo-team/prepare.mjs`. Script sao chép bản Zalo PC **26.9.10** đã cài trên máy sang `tooling/zalo-team/.local/pc-26.9.10`, kiểm tra hash bundle trước khi dùng adapter.
- Mở `/zalo-team/accounts` khi đã đăng nhập CRM, chọn **Thêm liên kết**, quét QR và xác nhận trên điện thoại. API khởi động ứng dụng riêng khi cần; cửa sổ PC chạy ẩn.
- Profile riêng: `tooling/zalo-team/.local/profiles/account-1`. Auth/cookie/database do ứng dụng PC lưu bên trong profile; `account.json` chỉ giữ metadata tài khoản. Chưa lưu tài khoản mới vào database CRM.
- **Tạm dừng** đóng ứng dụng riêng và giữ dữ liệu/phiên; **Kết nối lại** mở lại bằng profile đó. Đây chưa phải chức năng đăng xuất/xóa liên kết.
- Connector ở `127.0.0.1:9248`, token riêng trong `.local/connector.json`; API yêu cầu phiên CRM và Origin cùng trang. Không cung cấp endpoint thực thi JS tùy ý hoặc cổng debug. Cả thư mục `.local` đã bị loại khỏi Git.
- Bản Zalo cài cá nhân không bị sửa file/profile. Đăng nhập cùng một tài khoản trong ứng dụng riêng vẫn có thể khiến phiên PC kia bị Zalo đăng xuất theo cơ chế của Zalo.
- Wrapper nằm ngoài bundle gốc: `pc-bootstrap.cjs`, `guards.cjs`. Bundle của bản sao được giữ nguyên ở `vendor.asar`; adapter bắt registry trong bộ nhớ. Bản Zalo mới cần kiểm tra adapter/hash trước khi dùng, không mặc định tương thích.
- Hiện chỉ hỗ trợ **một tài khoản** để kiểm chứng login và lưu phiên. Chưa kiểm chứng đa tài khoản, tự chạy sau khởi động Windows, xử lý cập nhật/relaunch của vendor hoặc triển khai server. Giữ bản hiện tại local.

## Nhật ký thay đổi

### 09/10 — ưu tiên cộng tác CRM trước đợt vận hành

- Người dùng chọn bước 4 trước bước 3; đối chiếu lộ trình A–E là **D trước C**. Thứ tự mới A → B → D → C → E, giữ các điều kiện quyền/dữ liệu/phát hành cho mỗi tính năng trước khi đưa vào sử dụng thật.
- Đã đối chiếu model Customer/Lead/Project/WeeklyReport để đề xuất D1 hồ sơ và phân công, D2 ghi chú/cộng tác nội bộ, D3 việc cần xử lý/nhắc lịch, D4 màn điều hành leader. Nội dung chi tiết tại mục 10 của audit; phạm vi chức năng còn là đề xuất, chưa code/migrate/deploy trong lượt này.

### 09/10 — triển khai đợt B: tối ưu đường đọc và danh sách dài trên local

- Archive: tổng quan theo tab; chi tiết lỗi chỉ tải khi mở; ngày phân trang 14 mục và chỉ tính media của khoảng ngày đang xem. Gom thống kê bằng SQL, kiểm tra quyền qua `EXISTS`, tìm hội thoại lấy tin/avatar theo batch; kiểm tra metadata Drive theo batch, giữ xác minh hash/kích thước và quyền từng tài khoản. Không thêm cache quyền dùng chung hoặc tải file Drive khi đọc metadata.
- Chiến dịch: API phân trang 25 mục, tìm/lọc trước khi phân trang và đếm; giữ phạm vi người tạo/leader/admin/origin, hỗ trợ API cũ khi frontend đi trước backend. Kiểm thử thêm 121 chiến dịch có cùng thời gian tạo, không lặp/mất mục giữa trang. Luồng gửi/worker/biên nhận không đổi.
- Inbox/danh bạ: dùng `@tanstack/react-virtual` 3.14.13 cho danh sách trên 80 mục, đo chiều cao thực, giữ hàng mở menu/focus và hỗ trợ bàn phím. Chrome local: 260 bạn bè chỉ dựng 16 hàng, 578 nhóm dựng 17 hàng, inbox 235 dựng 17 hàng; đã kiểm tra tìm kiếm, Home/End, menu và đổi tab. Tab Lưu trữ phân trang được 607 ngày với API VPS hiện hành.
- Request dev log bổ sung thời gian chờ, tổng thời gian, HTTP status, số byte và trạng thái hủy; không ghi nội dung tin/token. Số đo SQLite cùng 1.200 tin/tệp: summary 54→14 query, search 50 hội thoại 101→3, metadata 12 tin 19→4. PostgreSQL 100.000 tin/tệp: tổng quan đồng bộ khoảng 97 ms trung vị; thống kê dung lượng khoảng 474 ms, còn cần giảm/đo lại dưới tải trước nghiệm thu ngân sách lớn. Chi tiết phương pháp và giới hạn trong mục kết quả B của audit.
- Kiểm tra: TypeScript đạt; Node offline 322 đạt/0 lỗi/1 skip; chiến dịch PHP 61 kiểm tra đạt; đọc/ACL 40 kiểm tra đạt trên cả SQLite và PostgreSQL 17 giả lập. Build/health cuối được ghi trong audit. UI đọc dữ liệu VPS hiện hành chỉ xác minh tương thích frontend, không chứng minh backend mới đã chạy trên VPS.
- Source trước sửa và log nằm trong `.local/phase-b-before/`, `.local/phase-b-*.log/json`; không đưa dữ liệu khách/secret vào fixture. Không gửi/chạy chiến dịch, sửa dữ liệu thật, restart connector hay deploy VPS trong đợt này.

### 09/10 — hoàn thành cleanup đợt A trên local

- Có snapshot nguồn trước sửa kèm SHA-256 trong `.local/cleanup-recovery/phase-a-2026-10-09T06-49-14-385Z/`. Gỡ 6 module UI không dùng, 21 nhánh CSS thuộc 8 class riêng; gỡ launcher/probe PC worker đã nghỉ và npm `dev:zalo-pc`. Giữ service nhập file/recovery, lệnh quản trị export PC, call Windows còn consumer, route 410 và Artisan tombstone.
- Chuyển `server-metrics.py` và test về `apps/backend/integrations/zalo/metrics/`; unit systemd trỏ source mới, chưa deploy. Tách `TeamManagementLayout` cho accounts/campaign/archive với CSS/handler hiện có. Gọn README hiện trạng, giữ hướng dẫn cũ trong lịch sử; cập nhật command map/runbook.
- TypeScript đạt; suite offline **322 đạt, 0 lỗi, 1 skip**; metrics **7/7**. Docker production build từ snapshot nguồn sạch (npm ci, không env/cache/deps local) đạt; standalone health trong container không mạng đạt. Chrome kiểm tra Tài khoản, danh sách/tạo chiến dịch, Đồng bộ & sao lưu; không ghi dữ liệu nghiệp vụ. Chi tiết và số bundle tại [kết quả A](ZALO-TEAM-AUDIT-2026-10-09.md#0-kết-quả-đợt-a--09102026).
- Chưa commit các file Zalo untracked có sẵn; chưa deploy/restart VPS hoặc sửa query/worker/khả năng gửi. Image build không thay cho nghiệm thu production. Đợt B chưa triển khai.

### 09/10 — audit toàn luồng và lập lộ trình tối ưu/nâng cấp

- Tạo [ZALO-TEAM-AUDIT-2026-10-09.md](ZALO-TEAM-AUDIT-2026-10-09.md) theo yêu cầu một file Markdown mới; đối chiếu tài liệu, đồ thị import, frontend/API, Laravel services, connector, worker và cấu hình triển khai. Áp dụng UI/UX Pro Max; xem UI local bằng Chrome, không ghi thay đổi nghiệp vụ.
- Có 6 module frontend không có consumer static; chỉ lập danh mục ứng viên, chưa xóa. Ghi rõ các service PC vẫn được luồng nhập file/recovery dùng, tránh cleanup nhầm; tách mã cũ, test cần giữ và dữ liệu runtime.
- Các điểm ưu tiên: summary/day/search của archive; virtual list; phân trang chiến dịch đang giới hạn 100; cold media Drive; readiness/phiên bản môi trường; backup toàn dịch vụ; gateway gọi hiện một phiên. Mỗi nhóm có căn cứ, phương án và tiêu chí nghiệm thu; mở rộng theo assignee/handoff/CRM/SLA sau ổn định.
- TypeScript đạt. Full suite offline với temp trong workspace: 316 đạt, 5 lỗi sandbox, 1 skip; chạy riêng attribution + portable call ngoài sandbox đạt 7/7, bao gồm 5 ca lỗi trên. Không coi fixture là gửi/call thật hoặc production acceptance. Chưa benchmark production, chưa integration PostgreSQL/restore drill; checklist còn lại nằm trong báo cáo.
- Chỉ bổ sung tài liệu; không sửa mã runtime, xóa dữ liệu, đổi quyền, gửi tin/gọi điện, restart connector hay deploy server.

### 09/10 — chuyển Thẻ lên trước Chiến dịch

- Đổi thứ tự hai mục trong `workspace-shell.tsx`, áp dụng mọi trang Zalo Team; giữ nguyên liên kết và thao tác. Chỉ frontend local, chưa deploy VPS.
- Đã đối chiếu thứ tự icon trực tiếp trên Chrome: Thẻ đứng ngay trước Gửi hàng loạt.

### 09/10 — cân icon Đồng bộ với các mục bên cạnh

- `archive-page.tsx` và `archive.module.css`: giữ ô icon 24px, giảm riêng glyph rotate xuống 20px do nét vẽ chiếm diện tích lớn hơn các glyph khác. Áp dụng cả sidebar và tiêu đề; chỉ thay giao diện local.
- Chrome đã đối chiếu trực tiếp icon sidebar/header sau sửa; Prettier đạt. Chưa deploy VPS.

### 09/10 — full width và đồng bộ giao diện các tab lưu trữ

- Dùng skill UI/UX Pro Max để rà soát độ rộng, mật độ, nhãn nhập liệu, khoảng cách và responsive; giữ font, icon và màu Zalo Team hiện có.
- `archive.module.css` bỏ giới hạn chiều rộng các card/metrics/thanh công cụ; `archive-page.tsx` gom tài khoản thành lưới và thao tác sao lưu thành hàng; màn Nhập từ file dùng control 32px, tự xếp cột trên màn hẹp.
- `archive-days.tsx` dùng `TeamDatePicker` compact với nhãn phía trên. Đo Chrome xác nhận select và viền date cùng cao 32px/cùng tọa độ trên-dưới; đã chọn 08/10/2026 và trả về tất cả ngày thành công.
- `server.module.css` full width, thống nhất card/panel, biểu đồ/dịch vụ/dung lượng tự xếp theo độ rộng nội dung; giữ khoảng cách card Google Drive trên màn hẹp.
- Kiểm tra: TypeScript không lỗi; Chrome desktop, 1024px, 390px; xem Đồng bộ, Nhập từ file, Lưu trữ, Sao lưu, Server. Không kích hoạt nhập, backup, khôi phục, dọn dẹp hoặc lưu thiết lập. Các luồng ghi và bản production chưa được kiểm chứng lại trong lần chỉnh UI này.

### 09/10 — chuyển tab Đồng bộ & sao lưu sang sidebar

- `archive-page.tsx`: navigation trái dùng icon/tab chung, nội dung phải dùng header Danh bạ. Bỏ CSS tab ngang cũ; đồng bộ nền, padding và vùng cuộn. Promoted `accounts.module.css` thành `management-layout.module.css`, Tài khoản dùng lại cùng import mới.
- Giữ logic quyền admin/monitor, mặc định Đồng bộ → Zalo Web, callback tải lại từng tab và reset vị trí cuộn. Không thêm API/polling hoặc thay đổi worker.
- TypeScript đạt; Chrome xác nhận chuyển tab active/header, xem Đồng bộ/Lưu trữ/Sao lưu, Server mở màn lấy số liệu, màn hẹp 390px cuộn tab và nội dung riêng. Không tạo backup, chạy import, đổi thiết lập hoặc dọn dữ liệu. Frontend local, chưa deploy VPS.

### 09/10 — thống nhất tiêu đề, tìm kiếm và lọc danh sách chiến dịch

- `campaign-list.tsx` dùng SearchInput chung và tiêu đề đếm bên ngoài card; gỡ `listHeading`/`listSearch` riêng không còn dùng trong CSS. Chỉnh kích thước, khoảng cách control theo trang Tài khoản, giữ tìm/lọc và menu hành động.
- TypeScript đạt; Chrome local xác nhận Chiến dịch (4), ô tìm kiếm và bộ lọc đồng bộ ảnh tham chiếu. Không thay dữ liệu hay triển khai VPS.

### 09/10 — bố cục hai cột cho Liên kết tài khoản

- `accounts-page.tsx` dùng điều hướng trái và khung nội dung phải theo Danh bạ; `accounts.module.css` chỉ chứa layout riêng/responsive, tái sử dụng style control/header/nav chung.
- Giữ logic liên kết, QR, phòng ban, phân quyền, tạm dừng/kết nối lại; chuyển điểm mở Thêm liên kết sang thanh trái, thêm Tải lại ở header. Không thực hiện thao tác thay tài khoản khi kiểm tra.
- Kiểm chứng: TypeScript đạt, Chrome đã tải đủ 4 tài khoản, tìm tên trả đúng 1/4 rồi xóa lọc về 4/4; desktop và màn 390px hiển thị đúng. Chỉ frontend local, chưa deploy VPS.

### 09/10 — bỏ nút Tạo chiến dịch màu xanh

- Gỡ nút tạo ở header `CampaignList` và prop truyền từ `CampaignPage`; giữ mục tạo ở thanh điều hướng trái. Chrome local đã xác nhận nút xanh biến mất, bố cục danh sách bình thường. Chưa deploy frontend production.

### 09/10 — sửa hợp đồng gửi ảnh chiến dịch bị INVALID_REQUEST

- `ZaloTeamCampaignWorker`: `send-media` và đối soát ảnh không còn trường `text`; ghi mã lỗi cùng campaign/delivery ID, không log tin nhắn/khóa. Bổ sung regression ở fake transport và validator thật để không bỏ lọt trường rỗng bị cấm.
- Triển khai riêng API/worker local trên VPS bằng image `campaigns-20261009-media-fix`; connector, frontend production và CRM giữ phiên đang chạy.
- Đối chiếu lượt lỗi: văn bản đã có biên nhận sent; ảnh bị validator từ chối ngay, chưa tạo biên nhận. Check-only hợp lệ không phát tin. Sửa riêng delivery đó về hàng chờ trong transaction, giữ campaign paused, ghi audit; 1 sent, 7 queued. Người dùng tự bấm Tiếp tục để gửi phần còn lại.
- Kiểm tra: PHP campaign regression đạt, 6 Node guard tests đạt, validator connector live nhận đúng payload mới. Chrome sau Tải lại đã hết cảnh báo, nút Tiếp tục bật, người nhận lỗi giữ 1/2 phần đã gửi. Chưa chạy lại chiến dịch/gửi tin thật sau sửa.

### 09/10/2026 — Danh sách gọn, menu ba chấm và đồng bộ UI chiến dịch

- Áp dụng skill UI/UX Pro Max theo yêu cầu: chạy design-system và UX lookup về loading/accessibility/z-index, chọn flat/ít trang trí, giữ font Segoe và màu xanh Zalo đang dùng. Không đưa font/palette marketing khác vào Team.
- Tách `CampaignList` và `CampaignMenu`; tên chiến dịch là text button, dòng phụ người nhận/ngày tạo, avatar tài khoản, thanh tiến độ compact, trạng thái không chỉ dùng màu. Mỗi dòng có ⋯ hiển thị rõ thường trực, MUI Menu portal hỗ trợ Escape, bàn phím, outside click; tải quyền/trạng thái khi mở qua query cache, không thêm polling nền. Chi tiết dùng chung menu; thao tác gửi chính vẫn dễ thấy.
- Tách target của hộp xác nhận khỏi active detail để Xóa/Hủy/Gửi tiếp từ list luôn dùng đúng chiến dịch. Sao chép/sửa mở form theo ID dòng; xác nhận gửi dùng ID được hiển thị trong modal. Giữ nguyên backend, kiểm tra quyền và cơ chế tránh gửi trùng.
- Đồng bộ `CampaignStatus`, bỏ badge xanh cho trường hợp chưa gửi, tìm kiếm rỗng có hướng dẫn/xóa lọc, tăng tương phản/focus và chuẩn hóa khoảng cách. Search/filter cùng chiều cao; list responsive thành thẻ dưới 600px vùng nội dung, điều hướng ngang dưới viewport 900px, nút ⋯ 44px trên màn hẹp; hạn chế animation theo reduced-motion.
- Kiểm tra TypeScript đạt. Chrome: danh sách 3 chiến dịch, menu đúng state, chọn Xóa hiện đúng “Chiến dịch test” rồi Quay lại, Escape đóng menu chi tiết, tìm kiếm rỗng/xóa bộ lọc, màn tạo; xem responsive 375×812 và 812×375 (sửa thanh điều hướng ngang). Không xác nhận xóa/gửi/hủy, không tạo nháp mới hoặc deploy VPS. Nghiệm thu thị giác cuối cùng thuộc người dùng; không tuyên bố kiểm tra Zalo PC/dark mode/toàn bộ accessibility hệ điều hành.

### 09/10/2026 — Bỏ chặn 24 giờ, hoàn thiện quản lý và preview chiến dịch

- Nguyên nhân `Chiến dịch test` có 8 phần skipped: worker có điều kiện recipient từng nhận chiến dịch khác trong 24 giờ. Gỡ điều kiện này theo phản hồi người dùng; trạng thái cũ được giữ để đối chiếu, có hướng dẫn chuẩn bị gửi tiếp. Không tự đưa chiến dịch cũ vào hàng gửi.
- `ZaloTeamCampaigns`/controller: edit payload có đầy đủ thẻ/match, người nhận và tệp; cập nhật chỉ bản nháp của người tạo trong transaction, kiểm tra revision, dựng lại snapshot cá nhân hóa. `requeue` giữ ID/biên nhận đã phát, chỉ đưa failed/skipped/cancelled chưa dispatch về queued và trạng thái paused; tiếp tục là xác nhận riêng. `delete` yêu cầu dừng, không còn preparing/sending/unknown, đánh dấu deleted và giữ lịch sử. Không cần migration mới.
- Preview ảnh kiểm tra quyền chiến dịch, workspace và liên kết asset; đường dẫn file không do client cung cấp, response private/no-store/nosniff; BFF truyền stream có cookie identity. `CampaignPreview` dùng renderer chat + catalog emoji theo tài khoản, cache 30 phút. Avatar dùng cache danh bạ hiện hành; ảnh lỗi có Tải lại ảnh.
- `campaign-page`/`CampaignReview`/`CampaignProgress`: tìm/lọc chiến dịch, phân biệt phần đã xử lý với % thực gửi, nhãn hoàn thành phản ánh gửi một phần/chưa gửi. Thêm sửa nháp, sao chép, xóa/hủy có xác nhận, gửi tiếp phần chưa gửi; detail chỉ polling 10 giây khi đang chạy/đang hoàn tất phần phát, không polling idle. Thu gọn header, khung preview cuộn riêng, giảm thông báo lặp.
- Kiểm tra: TypeScript đạt. PHP regression dùng SQLite bộ nhớ + connector giả, kiểm tra sửa/revision/quyền, requeue không phát lại sent, chặn unknown/inflight, soft-delete giữ receipts/audit, route asset theo quyền và bỏ cooldown 24 giờ. Chrome local kiểm tra 3 chiến dịch hiện có, avatar/emoji/GIF thật, nút gửi tiếp/xóa mở hộp xác nhận rồi quay lại, Sao chép nạp đúng 4 người, thẻ test, nội dung biến và GIF; không lưu bản sao. Sửa/xóa/gửi tiếp có thay đổi dữ liệu được kiểm tra bằng test giả lập, chưa nghiệm thu gửi thật.
- Triển khai chỉ API/worker local trên VPS 14.225.198.183 với image `x3-zalo-team-api:campaigns-20261009-lifecycle`; trước/sau đều 2 completed + 1 cancelled, inflight=0. API healthy, worker running; không deploy production FE/API hoặc restart connector. Dọn sáu file build tạm trên VPS. Cập nhật `compose.campaigns-dev.yml` để khởi động lại giữ đúng phiên bản.

### 09/10/2026 — Gọn chi tiết chiến dịch và chuẩn hóa chọn ngày trong Team

- `campaign-review.tsx`, `campaign-page.tsx`, `campaigns.module.css`: thay bảng lặp toàn bộ nội dung cho mỗi người bằng danh sách chọn người + nội dung cá nhân hóa; nhãn Bản nháp/trạng thái, tài khoản, khung giờ, số phần tin và hành động gom ở phần đầu. Kết quả lỗi vẫn nằm cạnh từng phần, retry/check-only giữ callback cũ; người có lỗi được đánh dấu trong danh sách. Tùy chọn ngừng nhận thu gọn, không đổi phạm vi suppression. Khi mở chiến dịch khác xóa lịch đang nhập của màn trước để tránh mang nhầm lịch.
- `team-date-picker.tsx`: wrapper ngày/ngày giờ trên MUI X đã cài, dùng Dayjs/locale Việt; giữ chuỗi YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm ở biên component. Campaign tiếp tục đổi giờ Việt Nam bằng +07:00 ở bước xác nhận cũ; nhắc hẹn/bình chọn giữ chuyển timestamp của luồng hiện hành. Không thêm thư viện, không thay contract API. Có xóa ngày (trừ nhắc hẹn bắt buộc), trạng thái disabled/validation; nhập ngày lỗi chặn xác nhận chiến dịch và tạo poll/reminder/checkpoint.
- Thay cả 5 input date/datetime-local tại `archive-days`, `archive-checkpoints`, `campaign-review`, `poll-create`, `topic-create`; scan source không còn input ngày/giờ native trong feature/route Zalo Team. Gỡ CSS riêng cho date input/deadline cũ. Popup portal vào native dialog nếu có, fixed position + flip/overflow boundary theo dialog; đã tái hiện và sửa lỗi popup nhắc hẹn bị cắt.
- Kiểm tra: TypeScript đạt. Chrome desktop: Chiến dịch test 4 người/8 phần vẫn Bản nháp, đổi An Phạm → Duy hiện đúng tên đã cá nhân hóa; chọn lịch 10/10/2026 10:30 rồi xóa, không bấm xác nhận gửi. Lưu trữ chọn 07/10/2026 ra đúng một ngày, trả lại tất cả ngày. My Documents mở/đóng nhắc hẹn và popup date/time đầy đủ trong dialog, không nhập nội dung/tạo nhắc hẹn. Checkpoint đang ẩn và hạn poll chưa nghiệm thu trực tiếp; kiểm tra source/type đã qua. Chưa nghiệm thu mobile; chỉ frontend local, không deploy/restart dịch vụ.

### 09/10/2026 — Soạn chiến dịch bằng editor chung, emoji/ảnh và mặc định 10 giây

- Thêm `CampaignMessageComposer`, tái sử dụng editor/emoji của chat. `MessageEditor` có tùy chọn Enter xuống dòng và plain-text cho chiến dịch; chat giữ mặc định gửi bằng Enter/định dạng cũ. Toolbar có Biểu cảm, Chèn ảnh, Đính kèm tệp, Chèn trường; ảnh đính kèm xem trước bằng object URL và thu hồi khi bỏ/unmount. Giữ giới hạn 3 tệp, 25 MB/tệp, 2.000 ký tự và bước xác nhận gửi.
- Chèn `{ten_khach}` và `{ten_nhan_vien}` tại con trỏ, sau khi menu select nhả focus. Backend thay tên người/nhóm và nhân viên CRM thực sự tạo chiến dịch theo từng người nhận. Không đồng nhất tên nhân viên CRM với tên tài khoản Zalo.
- Emoji đọc catalog native theo hội thoại hiện hữu của đúng tài khoản; ưu tiên cache inbox, nếu thiếu mới đọc inbox tài khoản khi mở picker, cache 5 phút, không polling. Không dùng một liên hệ bất kỳ từ danh bạ vì liên hệ đó có thể chưa có hội thoại, không tự mở chat của khách để lấy emoji. Chiến dịch chỉ mở tab emoji, không đưa thao tác gửi sticker trực tiếp vào form.
- `campaign-page.tsx` mặc định/min 10 giây; `ZaloTeamCampaignController` validation min 10. Worker hiện hành đã đọc interval từ từng chiến dịch nên không đổi worker hay lịch chiến dịch cũ. Regression thêm kiểm tra controller nhận 10, từ chối 9, cá nhân hóa giữ emoji/hai biến tên: tổng **31 PASS**, SQLite trong RAM/fake transport, không gửi ra ngoài; TypeScript đạt.
- Triển khai hẹp API dùng CRM local trên VPS 14.225.198.183: image `x3-zalo-team-api:campaigns-20261009-10s`, chỉ service api trong compose dev-client. Khi dán ảnh tái hiện lỗi thư mục `/data/campaigns` thuộc root/0700; entrypoint nay tạo/chown đúng www-data (82) trước khi hạ quyền. Health 9345 OK, hash controller khớp source. API production, connector và worker chiến dịch không tái tạo; frontend production chưa cập nhật.
- Chrome local xác nhận hai trường tên, Enter xuống dòng, emoji native chèn đúng artwork, dán favicon công khai lên API và hiện thumbnail `clipboard.png`. Đã bỏ ảnh/nội dung khỏi form sau kiểm tra; không chọn người nhận, tạo chiến dịch hay gửi tin. File chooser tự động bị tiện ích Chrome chặn quyền file URL, chưa kiểm chứng chọn tệp qua hộp thoại hệ điều hành. Bằng chứng `.local/evidence/zalo-campaign-shared-composer-20261009.jpg`.

### 09/10/2026 — Nút chọn loại, thẻ màu và avatar trong tạo chiến dịch

- `campaign-page.tsx`, `campaigns.module.css`: nút Bạn bè/Nhóm dạng button Team; bỏ hướng dẫn dư, khung người nhận bên phải và Gửi thử. Quyền tạo chiến dịch, danh sách tích chọn và Xem trước giữ nguyên.
- Tận dụng `TeamSelect` option icon và `Avatar` hiện hành. Query ảnh dùng cùng key `directory-avatars` với inbox, chỉ đọc một loại danh bạ của tài khoản đang chọn, cache 5 phút/AbortSignal/không polling. Ảnh nhóm hỗ trợ avatarMembers và memberCount; ảnh thiếu/lỗi dùng fallback của Avatar chung.
- Export `TagMarker` từ `shared-tags.tsx`; dùng màu theo ID thẻ đã có ở provider, không thêm lượt tải thẻ riêng. Màu áp dụng cả thẻ có/loại trừ/tóm tắt khi thu gọn.
- Kiểm tra: TypeScript và diff whitespace đạt; Chrome local đã thấy ảnh tài khoản Hoà Nguyễn, ảnh liên hệ và 7 màu thẻ, các box được yêu cầu bỏ không còn. Chưa nghiệm thu mobile hoặc gửi thật; không deploy/restart VPS.

### 09/10/2026 — Danh sách người nhận tự cập nhật và kiểm soát trước khi soạn

- `campaign-page.tsx`: audience dùng TanStack Query theo tài khoản/loại/thẻ với debounce và AbortSignal; kết quả đang tải/lỗi không được dùng để tạo nháp. Payload chỉ lấy ID từ danh sách đã chọn còn hợp lệ trong kết quả hiện tại; backend vẫn kiểm tra lại trước tạo nháp.
- Tách Kết quả lọc và Đã chọn; tìm trong từng danh sách, chọn tất cả chỉ áp dụng kết quả tìm kiếm (gồm các trang), checkbox có trạng thái chọn một phần. Hiển thị Sẽ gửi đến, tài khoản gửi, tên và nút bỏ từng người/nhóm; mở toàn bộ danh sách đã chọn, phân trang tự điều chỉnh sau khi bỏ mục. Bộ lọc đã chọn vẫn hiện tên khi thu gọn.
- `campaigns.module.css`: thêm thanh chuyển danh sách, tóm tắt thẻ và tên người nhận theo màu/style Team, giữ footer xem trước.
- Kiểm tra Chrome desktop local: chọn Hoà Nguyễn tự tải 577 liên hệ; chọn hai/bỏ một, tìm kiếm rồi Xem danh sách giữ đúng lựa chọn; đổi thẻ Khách hàng xóa lựa chọn cũ và tự trả 0 kết quả; chuyển Nhóm tự tải 1.052 nhóm, tìm Toyota rồi Chọn tất cả chỉ chọn 24 nhóm, tên/số lượng khớp. Đã bỏ lựa chọn thử. TypeScript đạt. Không tạo nháp/gửi tin hoặc deploy/restart VPS; chưa nghiệm thu mobile hay luồng gửi thật trong lượt này.

### 09/10/2026 — Gửi hàng loạt dùng bố cục Danh bạ

- `campaign-page.tsx`: cột trái có Chiến dịch/Tạo chiến dịch, icon và trạng thái chọn dùng component/style Team; header bên phải hiển thị mục hiện tại và Tải lại. Giữ nguyên handler và quyền tạo/gửi.
- `campaigns.module.css`: bỏ thanh tab ngang, card danh sách trải theo vùng nội dung, nền/khoảng cách theo Danh bạ; dùng container query để khung soạn thích ứng với phần diện tích còn lại sau sidebar, màn hình hẹp chuyển điều hướng lên trên.
- Kiểm tra: `npx tsc --noEmit --pretty false -p apps/frontend/tsconfig.json` đạt; Chrome local desktop chuyển hai mục, danh sách tải được, form/footer đầy đủ. Đối chiếu ảnh Danh bạ người dùng cung cấp; chưa kiểm tra trực tiếp mobile/Zalo PC. Không tạo chiến dịch, không gửi tin; không deploy hoặc restart VPS.

### 08/10/2026 — Sắp xếp lại giao diện tạo chiến dịch theo Zalo Team

- `campaign-page.tsx`, `campaigns.module.css`: bỏ form ba thẻ rộng nối dọc; dùng khung hai cột, cột danh bạ 360 px, cột soạn linh hoạt, font/icon/TeamSelect có sẵn. Danh sách checkbox + avatar chữ viết tắt, tìm kiếm và phân trang riêng; chọn toàn bộ kết quả vẫn giữ các liên hệ đã chọn ngoài từ khóa hiện tại.
- Thu gọn thẻ và điều kiện loại trừ vào disclosure; cài đặt giãn cách/giờ gửi và gửi thử cũng đóng mặc định. Đính kèm bằng nút trong composer; giữ giới hạn và luồng upload cũ. Nút chèn Người nhận/Nhân viên đặt biến ở vị trí con trỏ. Footer hiển thị số người/phần tin và một hành động chính Xem trước. Layout dưới 800 px chuyển một cột theo CSS; chưa nghiệm thu trên điện thoại thật.
- Kiểm tra: TypeScript đạt; Chrome desktop hiển thị form không phải cuộn trang dài; đọc danh bạ, tìm Qa, chọn/bỏ chọn, tên chiến dịch và chèn `{ten_khach}` hoạt động, mở bộ lọc/cài đặt không che nút Xem trước. Không lưu bản nháp mới, không bấm gửi hoặc sửa dữ liệu/tài khoản. CSS HMR của Next từng báo `removeChild` trong lúc thay stylesheet; tải trang sạch đã hết overlay, không restart frontend. Ảnh bàn giao `.local/evidence/zalo-campaigns-compact-20261008.jpg`.
- Phạm vi chỉ frontend local. API, connector, worker và frontend production giữ nguyên; các kiểm chứng gửi thật của giai đoạn 1 vẫn chưa thực hiện.

### 08/10/2026 — Gửi chiến dịch từ tài khoản và thẻ chung, giai đoạn 1

- **Phạm vi:** một Zalo/chiến dịch, bạn bè hoặc nhóm, khớp một/tất cả thẻ, loại trừ thẻ, tìm kiếm trên toàn bộ danh bạ trả về; không lấy tập người nhận từ những hàng inbox đang hiển thị. Không mặc định chọn tất cả. Xem trước lưu danh sách/nội dung đã cá nhân hóa cố định; thay đổi thẻ loại trừ và trạng thái không nhận chiến dịch vẫn được kiểm tra sát lúc gửi. Cho phép bỏ trạng thái không nhận cho chiến dịch mới, không tự phát lại phần đã bỏ qua.
- **Quyền:** thêm `zalo_team.campaigns.send` vào CRM local, không tự cấp cho nhân viên. Admin hoặc người có quyền này vẫn cần quyền viết tài khoản. Creator/admin/người quản lý tài khoản xem chi tiết; người tạo xác nhận khởi chạy. Worker lấy lại identity CRM thật trước và sau chuẩn bị, không dùng principal admin của backup. CRM chỉ thêm permission; bảng chiến dịch nằm ở database Zalo VPS. Mẫu tin/tệp riêng theo actor trong workspace.
- **Chống trùng:** UUID chiến dịch gắn fingerprint nội dung; recipient unique trong chiến dịch; UUID cố định từng phần gửi nối với native SendReceipts. Lease theo workspace/tài khoản dùng chung giữa các worker; một phần chưa rõ kết quả chặn chiến dịch. `checkOnly` chỉ đối soát, kể cả mất receipt cũng không tạo lượt gửi mới. `expectedExternalId` chặn đổi danh tính tài khoản; worker yêu cầu connector protocol 1. Chỉ trạng thái lỗi trước dispatch được đưa về hàng chờ; tin đã gửi không phát lại. Đây là cơ chế giảm gửi trùng, không tuyên bố exactly-once từ phía Zalo.
- **Lịch và tải:** mặc định 60 giây/phần, chọn 30–3.600 giây, giờ Việt Nam 08–20, hẹn trước tối đa 30 ngày, 2.000 người/lượt, bỏ qua người đã nhận chiến dịch khác từ cùng nguồn tài khoản trong 24 giờ. Các giới hạn này do Team đặt, không phải hạn mức được Zalo đảm bảo. Tối đa 3 tệp × 25 MiB, stream tệp lên connector, dữ liệu trong `/data/campaigns`; bản gốc dùng lại cho các recipient, staging connector hết hạn sau 24 giờ. Chưa có tự dọn tệp bản nháp bỏ dở. Chưa có giới hạn chiến dịch cộng dồn theo ngày hoặc ưu tiên ngắt job đang chạy để gửi tay.
- **UI/API:** dùng TeamSelect/TeamDialog/shell hiện có. TanStack Query + teamFetch, không retry mutation tự động; list/detail chỉ polling 20 giây khi có chiến dịch chạy, không polling tab nền. List 100 chiến dịch dùng 3 truy vấn tổng hợp; danh sách người nhận phân trang 50. Header/sidebar thêm Gửi hàng loạt. Kết quả “Đã gửi” là xác nhận native gửi, chưa đồng nghĩa đã nhận/đã đọc.
- **Triển khai đã thực hiện:** migration `2026_10_08_000220` thêm schema VPS và quyền CRM local. API local `x3-zalo-team-dev-client-api-1` + worker `x3-zalo-team-dev-client-campaigns-local-1` dùng `x3-zalo-team-api:campaigns-20261008`. Sau người dùng xác nhận, connector dùng `x3-zalo-team-web-connector:campaigns-20261008`, giữ nguyên volume; chỉ restart connector một lần. Worker 256 MiB/0,5 CPU, PHP memory 192M. API production vẫn image `0caf753cf2f3...`, FE production không đổi.
- **Vận hành local:** trên VPS, thư mục `tooling/zalo-team/service`, chạy `docker compose -f compose.dev-client.yml -f compose.campaigns-dev.yml --profile campaigns-local up -d --no-deps api campaigns-local`. Worker chạy tại VPS nhưng quyền local vẫn cần reverse identity 9341; tắt backend/tunnel local sẽ dừng lượt gửi vì không xác minh được quyền. Muốn độc lập máy local cần triển khai API/permission/FE production và dùng `compose.campaigns.yml` với identity 9342/origin HTTPS. Không chạy worker Windows hoặc đổi origin của chiến dịch đã có.
- **Rollback:** dừng `campaigns-local`; dùng image API `x3-zalo-team-api:before-campaigns-20261008` cho API local. Connector có image `x3-zalo-team-web-connector:before-campaigns-20261008`; chỉ đổi/restart nếu cần rollback connector, giữ volume. Không rollback/drop bảng dữ liệu khi đã có chiến dịch. Giữ overlay image khi chạy Compose để không quay lại alias cũ.
- **Kiểm chứng:** 28 kiểm tra PHP SQLite cô lập (không HTTP thật), 23 Node fake adapter/receipt đạt; `npx tsc --noEmit --pretty false -p apps/frontend/tsconfig.json` đạt. Chrome thật: danh bạ 260 liên hệ, lưu một nháp `[Kiểm tra giao diện] Không gửi`, tên khách/CRM thay đúng, hủy phần chờ thành công; không khởi chạy chiến dịch. Controller nhận tệp thử 55 byte và upload vào staging connector thành công; tệp/row thử ở kho campaign đã dọn, staging native tự hết TTL. Extension Chrome chưa cho phép file URL nên không xác nhận UI picker→upload. Cuối lượt protocol=1, 4 connected, workerReady=true, dispatched=0; worker 30,03 MiB, CPU 0,01% tại thời điểm đọc. Ảnh `.local/evidence/zalo-campaigns-ready-20261008.jpg`.
- **Cổng nghiệm thu còn lại:** người dùng chọn một liên hệ nhận tin thử và xác nhận nội dung; kiểm tra gửi/nhận văn bản + tệp thật, mất kết nối thật và vận hành kéo dài. Chưa nghiệm thu đa tiến trình trên PostgreSQL khi dispatch thật. Chưa triển khai nhiều tài khoản/chống trùng globalId, CRM trigger hoặc OA (giai đoạn sau).

### 08/10/2026 — Tunnel SSH mất kết nối nhưng giữ cổng xác thực local

- Chẩn đoán: local 3000 trả dev status 200, backend 4000 còn listen; 9250/9345/9262 không còn listener. VPS dev API và connector healthy nhưng sshd cũ giữ 9341, gọi qua reverse timeout. Server trước sửa đặt `ClientAliveInterval=0`, `ClientAliveCountMax=0`.
- Áp dụng `tooling/zalo-team/service/ssh-keepalive.conf` tại `/etc/ssh/sshd_config.d/40-x3-tunnel-keepalive.conf` trên VPS Zalo: 30 giây × 3. `sshd -t` đạt trước reload `ssh` (không restart); chỉ kết thúc PID sshd đã đối chiếu giữ cổng local 9341. Không đổi credential/quyền/port hoặc dịch vụ ứng dụng. Phiên SSH mới tự giải phóng khi mất phản hồi; các phiên đã mở trước reload không nhận cấu hình mới.
- `tunnel.ps1` không để PowerShell `ErrorAction Stop` nuốt stderr native; giữ diagnostic và ghi exit code/thời gian để tìm lỗi lần sau. Watcher local đã khởi động lại với script mới, mutex giữ chống trùng.
- Kiểm tra: API 9345 và connector 9250 health 200; hai test launcher đạt, PowerShell parse đạt; chạy thực `npm run dev:frontend` thành công và không tạo FE thứ hai. Chrome Tất cả/Lưu trữ hiển thị danh sách và hết hai lỗi kết nối. Ảnh `.local/evidence/zalo-tunnel-recovered-20261008.jpg`. Chưa mô phỏng sleep/mất mạng 90 giây; không gửi/gọi hoặc sửa dữ liệu thật.

### 08/10/2026 — Gọn tab lưu trữ inbox (local)

- `messages-layout.tsx`: đưa Lưu trữ cạnh Tất cả/Chưa đọc, chọn độc lập; chuyển tab đặt lại bộ lọc chưa đọc phù hợp, đóng menu/picker và bỏ lựa chọn hội thoại khi đổi giữa danh sách chính/lưu trữ. Gỡ số đếm, hàng lưu trữ riêng và mục trùng trong menu dấu ba chấm.
- `zalo-team.module.css`: chữ tab 13 px, gap 8 px, không xuống dòng; xóa style lưu trữ cũ không còn dùng.
- Kiểm tra Chrome local: ba tab cùng y=64, cao 32 px; chuyển Lưu trữ → Chưa đọc → Tất cả đúng trạng thái, danh sách lưu trữ hiện đủ 5 mục. Ảnh `.local/evidence/zalo-inbox-archive-tabs-20261008.jpg`. Không ghi/xóa trạng thái lưu trữ, không deploy VPS.

### 08/10 — áp dụng connector và nghiệm thu gom nhóm local bằng dữ liệu thật

- Người dùng xác nhận “triển khai nhé” sau khi được thông báo cần cập nhật/restart connector dùng chung. Build lại adapter cuối (gồm cache/backoff), áp dụng image `x3-zalo-team-web-connector:auto-groups-20261008` và tag mặc định; chỉ recreate connector, giữ volume profile. Image manifest `sha256:79263ac6efec1298df6735946ce55d8681b2c978b3116eec763e61f152cef426`; image rollback `before-auto-groups-20261008` giữ nguyên. Source triển khai và `/app/conversations.mjs` được đối chiếu SHA-256.
- Sau khi native tải xong: 4/4 tài khoản connected/error null; 210/210 nguồn nhóm có globalGroupId. Các cặp Mazda Long Biên, Spahem, Tinh dầu Lavender, SEODAO có cùng global ID dù conversationId khác nhau. Không lưu ID hoặc nội dung tin thật vào tài liệu.
- Chrome local: các nhóm trên chỉ còn một dòng; tổng 160 dòng sau gom, vẫn 5 hội thoại lưu trữ. Bấm Mazda mở popover hai tài khoản nguồn, checkbox ghi nhớ và nhãn “Đã tự động gom cùng nhóm Zalo”. Ảnh `.local/evidence/zalo-auto-groups-20261008.jpg`. Không gửi/gọi/ghi liên kết thủ công để thử.
- Giới hạn: frontend production chưa rebuild, nên giao diện tự gom mới chỉ nghiệm thu local. API kho/worker/CRM và hai đường xác thực local/production giữ nguyên.

### 08/10 — khôi phục danh sách local và chống khởi động frontend trùng

- Cổng 3000 vẫn do Next.js đúng workspace giữ, trả HTTP 200; chạy thêm `next dev` gây EADDRINUSE, không phải chứng cứ FE đã chết. Lỗi danh sách riêng do local cookie được gửi sang API kho production đã chuyển identity sang CRM production. Tùy chọn lưu trữ không đọc được nên UI giữ danh sách đóng để tránh hiện các hội thoại đã ẩn.
- Người dùng chốt local tiếp tục dùng chung dữ liệu VPS. Tạo riêng API loopback 9345 với identity cố định local 9341 và origin `http://localhost:3000`; volume/DB/Drive giữ chung. Không nới quyền, không tự cấp user, không thay public origin/identity API production, không restart connector, không thêm worker sao lưu. Cấu hình ở `tooling/zalo-team/service/compose.dev-client.yml`; local env chọn 9345. Nối lại riêng tunnel Windows để áp dụng forward mới.
- `tooling/development/dev-frontend.cjs` kiểm tra cổng trước khi chạy. Khi đúng dev server của workspace đang trả lời `/api/dev/status` thì dùng tiếp, không tạo tiến trình thứ hai. Cổng bị tiến trình khác chiếm/chưa phản hồi thì báo rõ, không kill tự động. Endpoint status chỉ có ở development và loopback hostname, chỉ trả fingerprint project.
- Đã chạy lại `npm run dev:frontend`: exit 0, thông báo dự án đang chạy. Hai kiểm tra preflight/tunnel đạt; TypeScript đạt. Chrome reload: 243 hội thoại/4 tài khoản/5 mục đã lưu trữ; ảnh `.local/evidence/zalo-local-recovered-20261008.jpg`. API local/prod health 200; connector và API production giữ nguyên thời điểm khởi động. Chưa thực hiện thao tác gửi/gọi/ghi dữ liệu để kiểm thử.

### 08/10 — gom nhóm theo định danh toàn cục, hoàn thiện local

- Source Zalo Web có `getGlobalIdsFromGroupIds()` đọc `globalId` từ cache group worker; ID hội thoại theo tài khoản không dùng làm ID chung. Chưa kiểm chứng `globalId` thực tế giữa các tài khoản vì người dùng chưa cho cập nhật connector dùng chung.
- Sửa `apps/backend/integrations/zalo/web/conversations.mjs`: ánh xạ một batch, cache riêng frame/identity, bảo toàn chuỗi số lớn, bỏ giá trị thiếu/không hợp lệ/number vượt safe integer; lỗi/timeout enrichment vẫn trả danh sách. Không thêm polling, không gọi API từng nhóm, không mở chat/đánh dấu đã đọc.
- Sửa frontend `group-links.ts`, `types.ts`, `messages-layout.tsx`, `group-account-picker.tsx`; thêm `use-group-preferences.ts`. Gom tự động sau khi lọc account/quyền/lưu trữ; picker lấy đúng nguồn đang hiển thị. Nguồn chat/lịch sử/bản nháp/quyền gửi giữ độc lập. Nhóm tự động có nhãn xác nhận, ghi nhớ tài khoản theo user và origin trong localStorage, không dùng API admin của liên kết thủ công.
- Kiểm tra: 20 test tập trung về native projection, cache/backoff/timeout, gom khác ID cùng globalId, không gom cùng tên/ID cục bộ, ánh xạ mâu thuẫn, liên kết thủ công, nguồn bị ẩn và phân quyền; TypeScript đạt. Chrome local không ghi nhận JavaScript error trong lần kiểm tra; chưa nghiệm thu UI gom nhóm thật.
- Vận hành: đã build một image nháp trước bước cache cuối tại `/opt/x3-zalo-team/releases/auto-groups-20261008` và giữ tag rollback `before-auto-groups-20261008`; **chưa áp dụng image hoặc restart connector**. Image nháp này chưa chứa bản code local cuối, phải build lại từ source khi có yêu cầu triển khai. Không thay frontend production, tài khoản, database hoặc volume.

### 08/10/2026 — Mở /zalo-team production và ẩn menu CRM

- Người dùng yêu cầu ẩn menu và deploy để test server; xác nhận bổ sung cho phép lưu hai khóa nội bộ trên VPS CRM. Xóa mục Team/import icon trong sidebar source, giữ đường dẫn truy cập trực tiếp. CRM production đã không có mục Team, nên không thay image frontend nghiệp vụ chỉ để ẩn menu.
- Build frontend production trên VPS Zalo từ source hiện tại (gồm lưu trữ hội thoại), không build trên VPS CRM RAM thấp. Image `x3-zalo-team-frontend:live-20261008`, manifest `sha256:76e2ad868817614ec3b7300c9a1aca2933f6bca7baf3b5769900189edb2bb4ed`. Nginx CRM chuyển `/zalo-team`, các trang con, `/api/zalo-team/` và `/zalo-team-assets/` qua tunnel; chặn public `/api/internal/zalo-team/`. Cấu hình proxy đã lưu vào `tooling/deployment/production/nginx.conf`.
- Tạo backup DB CRM mới, kiểm tra pg_restore --list trước migration. Chỉ migrate ACL Zalo. Đối chiếu ID/email hash/phòng ban/trạng thái 27 người dùng; giữ 4 tài khoản và 2 grants trong transaction, không ghi đè user, phòng ban hoặc dữ liệu nghiệp vụ. Thông tin nguồn/rollback ở README.SERVER.md.
- API Zalo/sync/backup chuyển xác thực từ 9341 local sang 9342 CRM production; origin cố định HTTPS CRM. Không có lượt backup/import pending/running lúc chuyển. Giữ schema/kho/profile/Drive/Tiny House; không chuyển lại dữ liệu hay chạy thêm worker local. Drive worker hiện hành không gọi CRM identity; cấu hình tái tạo sau này lấy service.env production.
- Kiểm tra: build thành công (bao gồm TypeScript); identity nội bộ admin và shared owner khớp, 4 tài khoản; frontend/API health 200, route identity public 404; Chrome production tải danh sách hội thoại và trạng thái Đã lưu trữ hiện hữu, trang Đồng bộ & sao lưu đọc được 237 nguồn/1.897 tệp đã lưu tại thời điểm kiểm tra, sync tiếp tục ghi trang mới. Frontend healthy/restart 0/OOM false, mẫu RAM 60,7 MiB; API 51,49 MiB. Không coi số liệu này là benchmark hoặc nghiệm thu lâu dài.
- Phần còn lại cho người dùng: nghiệm thu gửi/gọi thật và luồng nhân viên theo quyền. Nhập file xuất trên Windows chưa hỗ trợ upload trong production; bản local hiện có cấu hình identity khác production, không dùng cookie/phiên local làm bằng chứng production. Không tự gửi thử cho khách hàng.

### 08/10/2026 — Lưu trữ hội thoại khỏi danh sách chính

- Thêm `ZaloTeamInboxPreferences` và bảng `zt_inbox_archived`; API đọc/ghi nằm trong archive endpoint hiện có. Kiểm tra quyền đọc mọi tài khoản trước transaction, khóa duy nhất chống ghi trùng, phạm vi gồm owner/user/account/conversation. Người chỉ có quyền xem vẫn được tổ chức danh sách riêng. Khôi phục chỉ gỡ trạng thái cá nhân.
- Frontend dùng QueryClient theo phiên CRM, đọc gộp trùng và không polling. Chỉ cập nhật danh sách sau khi API lưu thành công; lỗi giữ nguyên trạng thái để thử lại. Lọc nguồn trước khi ghép nhóm và giữ bộ lọc tài khoản/tìm kiếm hiện có. Menu cá nhân mở ngay khi phần chuẩn bị thao tác Zalo còn chạy.
- Cách dùng: menu `…` của hội thoại → **Lưu trữ hội thoại**; vào **Đã lưu trữ** qua menu trên danh sách hoặc hàng truy cập nhanh; menu hội thoại → **Đưa lại danh sách chính**. Áp dụng riêng từng người dùng, tin mới không tự đưa hội thoại trở lại. Với nhóm ghép nhiều tài khoản, chọn nguồn tài khoản cần thao tác.
- Kiểm tra: TypeScript đạt; `tooling/tests/zalo-team-inbox-preferences.php` đạt archive/restore, lặp yêu cầu, cách ly người dùng/tài khoản/workspace, từ chối ghi nhiều nguồn có nguồn ngoài quyền và thu hồi quyền. Chrome local xác nhận ẩn đúng nguồn, tồn tại sau reload, xuất hiện trong Đã lưu trữ và khôi phục về danh sách chính; đã hoàn tác mẫu thử, không gửi tin/gọi thử.
- Triển khai: chỉ recreate API VPS Zalo với image `x3-zalo-team-api:inbox-archive-20261008`, migrate riêng `2026_10_08_000211_create_zalo_team_inbox_preferences.php`; health sau khởi động trả 200. Worker/connector và CRM production không đổi. Rollback API `x3-zalo-team-api:before-inbox-archive-20261008`; giữ bảng bổ sung nếu rollback. Frontend tính năng còn local; chưa nghiệm thu người dùng hay chạy dài ngày.

### 08/10/2026 — Đợt 3: bản production riêng và cổng kiểm thử trước cutover

- Frontend standalone Node 22 (phù hợp engine PDF.js), chỉ route Team/API Team; đóng gói không có dotenv, public uploads hay dữ liệu khách hàng. `compose.frontend.yml` bổ sung frontend, không khởi tạo lại database/profile/Drive. Docker restart unless-stopped, healthcheck, read-only filesystem, log tối đa 15 MiB, heap 1 GiB/container 1,5 GiB.
- Sửa lỗi build PDF worker ES module: giữ asset đã minify, không chạy lại bộ script minifier của Next 14. Không tắt tối ưu toàn bundle. Production build/TypeScript đạt.
- Sửa kiểm tra Origin phía BFF sau TLS proxy: dùng `ZALO_TEAM_PUBLIC_ORIGIN` cố định từ server; local vẫn dùng origin request. Không tin X-Forwarded-Host do người gọi gửi. R2 origin lạ trả 403; origin CRM đi đến bước xác thực và hiện 503 vì CRM chưa triển khai route mới. Đây là trạng thái staging dự kiến, chưa chuyển người dùng sang bản này.
- VPS CRM có 709 MiB RAM tổng, khoảng 189 MiB khả dụng tại khảo sát. Build frontend trên VPS Zalo. Snapshot CRM database trước thay đổi: 1.426.613 byte, pg_restore --list đọc được 603 dòng; giữ image rollback và nginx/compose cũ trong `/opt/x3crm/releases/zalo-stage3-20261008`.
- Chuẩn bị bản vá CRM đúng 12 file; lấy route/model production làm nền, giữ toàn bộ route nghiệp vụ và bootstrap/broadcasting đang chạy. Image `x3crm-backend:zalo-stage3-20261008` đã build; route:list có ba route identity/access mới. **Chưa chạy migration hoặc đổi backend đang phục vụ**. Không sao chép dữ liệu CRM local vào production.
- Người dùng cho phép SSH lâu dài giữa hai VPS: `x3-edge`, cấm shell, chỉ permitopen 9300/9250 và permitlisten 9342. Sidecar CRM `x3-zalo-edge-tunnel-1`, không publish cổng host, chỉ mạng Docker CRM. Health đường hầm trả 200; không phụ thuộc Windows. Quyền chép hai khóa dịch vụ sang CRM là yêu cầu riêng còn chờ trả lời; chưa chép.
- Kiểm tra: frontend R2 healthy/restart=0/OOM=false, idle 27,73 MiB; mẫu R1 20 lượt GET khung trang đồng thời đều 200, p95 452 ms/max 581 ms; 28 asset JS/CSS trả 200. Các số này chưa đo inbox xác thực/nhiều nhân viên. Nginx đề xuất đã kiểm tra `nginx -t` trong container tạm, chưa reload production.
- Hồi quy: `npm run test:zalo` 313 đạt/1 skip SQLCipher; sửa bốn fixture/loader cũ theo module/API quyền hiện tại, không bỏ test lỗi. PHP ACL 42 trường hợp; 11 test Origin/quyền BFF đạt. Backup/restore SQLite giả lập 6.000 tin (~105,5 MiB) tăng 4 MiB heap và khôi phục đủ số dòng. Sandbox Windows chặn rename ZIP; chạy lại ngoài sandbox trong thư mục tạm đạt. Sửa catch dọn ZIP để không che lỗi gốc, bản sửa PHP này mới ở source local.
- Chưa nghiệm thu: domain `/zalo-team`, quyền/assignments production, đọc dữ liệu xác thực, nhiều nhân viên, cuộc gọi thật/5G, phục hồi bộ dữ liệu thật/Drive. Chưa xác định nguyên nhân chính xác của lần FE dev tự thoát trước đó; không coi production build là bằng chứng đã chữa được lỗi dev.

### 08/10/2026 — Đợt 2: cập nhật theo thay đổi, tải độc lập và hiển thị sớm

- `transport.mjs` theo dõi tham chiếu dữ liệu tin của native thay vì mọi dispatch trạng thái/UI; event bus thu hồi/xóa/bình chọn/cài đặt và reaction vẫn được giữ. Chỉ gắn conversation ID khi nguồn xác định được; sự kiện không rõ phạm vi cập nhật rộng trong đúng tài khoản để tránh bỏ sót. Không sửa dispatch native, không mở chat/đánh dấu đã đọc để lấy danh sách.
- `inbox-updates.mjs` gom burst, đọc/so sánh danh sách chuẩn hóa một lần/tài khoản trên connector, độc lập số trình duyệt. Không đổi thì không phát inbox; thay đổi gửi upserts/removals/account state. Lỗi nguồn tạm không được hiểu thành xóa hội thoại; identity mismatch được xử lý riêng. Lượt kiểm tra tuân theo scheduler vòng đời, không chạy xuyên thao tác dừng/thay phiên; bỏ kết quả trễ của account đã forget. Health chỉ có số lượng hints/reads/unchanged/published, không nội dung hay ID hội thoại.
- `changes.ts` gom delta nhiều tài khoản, bảo toàn thứ tự xóa/cập nhật và giới hạn danh sách scope. Inbox áp dụng delta trực tiếp; chỉ fetch khi mất nhịp/phục hồi, event cũ hoặc cần đối soát sau read đang chạy. Detail/info/privacy/danh bạ chỉ đọc khi đúng area/account/conversation. Event không xác định vẫn dùng fallback. Avatar invalidation giới hạn account bị ảnh hưởng.
- `accounts.mjs` phát từng tài khoản qua NDJSON ngay khi hoàn tất; kết quả cuối vẫn gồm toàn bộ snapshot/group links. Inbox giữ bản trong QueryClient của phiên CRM khi chuyển trang; client được hủy khi đổi phiên/quyền. `timeline.ts` cho trang đầu hiển thị sớm từ Web hoặc kho; pagination vẫn chờ cả hai nguồn để tính cursor an toàn, không dùng cursor tạm. Callback bỏ qua khi request bị hủy/đổi chat; không cache toàn bộ lịch sử vào trình duyệt.
- `access.ts` gộp các lần xác thực CRM đang chạy với cùng credential/origin/API bằng khóa băm; không cache quyền đã hoàn tất, không chia credential khác nhau, kết quả clone độc lập. BFF kiểm quyền mới cho từng chunk stream, lọc cả delta lồng nhau và chặn chunk tiếp theo sau thu hồi quyền. Không thay xác thực/CSRF/ACL bằng cache giao diện; lệnh gửi/gọi không tự phát lại.
- Kiểm tra: 56 bài tập trung ở native observer/scheduler/accounts/inbox updates, event router, transport/poll/stream, timeline/pagination, quyền gửi/gọi/upload/NDJSON và thu hồi quyền trong stream đều đạt; TypeScript đạt. Harness route cũ bổ sung Web Crypto chuẩn Node cho trace ID. Bằng chứng tổng hợp local: `.local/evidence/zalo-stage2-tests.txt`.
- Chrome local: sau cập nhật 4/4 tài khoản, 185 cuộc trò chuyện gồm kho; không cảnh báo danh sách/runtime khi mở hai chat. Mẫu idle 71,8 giây: 1 scope + 1 tags + 4 trang archive = 6 JSON, **0** lượt inbox Web; trước đó 76 giây có 19 JSON/13 inbox. Hai mẫu không đồng nhất lưu lượng tin bên ngoài, không phải benchmark tải nhân sự. Warm API mở inbox đo first packet 2.252 ms, hoàn tất 5.740 ms; mẫu mở chat khác first page 1.294 ms, hoàn tất ghép 2.143 ms. Đây là mẫu đơn lẻ, chưa phải p95/SLA. Log dev chỉ event/thời gian/số lượng, không nội dung.
- VPS 14.225.198.183: image `x3-zalo-team-web-connector:inbox-stage2-20261008`/latest, manifest `sha256:58df3cf97e14e4ab9f5443ec517c1bad33e7d4a1625cce113a5da7078e7ac6e9`; rollback `before-inbox-stage2-20261008` (đợt 1). Chỉ recreate connector khi gateway báo busy=false, giữ volume/profile/dữ liệu và dịch vụ khác. Health healthy, restart=0/OOM=false. Read-only bản chốt: 183 hội thoại Web, 4/4 tài khoản; stream 25 giây nhận 12 events, 5 delta/10 upsert/1 removal, khoảng 18,3 KB. Không tự gửi tin/gọi để tạo traffic. Số lượng thay đổi theo nguồn đang dùng thật.
- Tài nguyên tức thời sau chốt: 1,961 GiB và CPU 17,86%; trước cập nhật có mẫu 2,027 GiB/2,44% và 2,068 GiB/78,89%. CPU dao động theo hoạt động native, chưa có cơ sở kết luận mức giảm RAM/CPU hoặc nâng số user đồng thời.
- Trong kiểm tra điều hướng, Chrome gặp connection refused tới frontend local. Đã mở lại Next dev chạy ẩn, log ở `.local/evidence/stage2-frontend.*.log`; log mới không có lỗi runtime nhưng compile lạnh trang accounts tốn 12,4 giây. Không có log thoát của tiến trình cũ nên chưa kết luận nguyên nhân dừng; không ghi đã giải quyết triệt để độ ổn định dev. Production phải dùng build/start và process supervisor, không `next dev`.
- Chưa triển khai frontend/BFF/CRM production 45.252.251.120; chưa đo tải nhiều nhân sự, chạy dài ngày hoặc nghiệm thu các biến thể tin/thu hồi/phản ứng/cuộc gọi trên tài khoản thật. Các kiểm tra fixture bảo vệ luồng; cần nghiệm thu sử dụng thật sau đợt này. Không xóa dữ liệu, profile hoặc thay quyền người dùng.

### 08/10/2026 — TanStack Query và chính sách gọi API riêng cho Team

- Nguyên nhân tìm được trong source, đối chiếu các initiator ở ảnh Network người dùng: access scope + CSRF lặp mỗi 5 giây; archive inbox tải toàn bộ các trang mỗi 15 giây; avatar gọi friends/groups đồng thời cho từng tài khoản; events nối lại mỗi khoảng 26 giây gửi resync dù revision không đổi. Mở sidebar thông tin còn có các request theo mục, nên không thể coi mọi request pending là lỗi.
- Dùng dependency `@tanstack/react-query` đã có; `components/data-provider.tsx` tạo QueryClient riêng, hủy/xóa cache khi đổi phiên, không persist chat ra localStorage, không đổi QueryClient CRM. `use-account-access.ts`, `archive-inbox.ts`, `inbox-avatars.ts` dùng query keys riêng: quyền/kho stale và refetch 60 giây; ảnh đại diện stale 5 phút, chỉ cần hydrate tài khoản có ảnh thiếu; gc cache không hoạt động sau 2 phút. Query không retry ngầm, không refetch theo focus trừ kiểm tra quyền. Backend vẫn xác thực quyền cho từng request; khoảng kiểm tra UI quyền không thay thế việc này.
- `request.ts` là transport chung tại các điểm gọi JSON web/archive/access/tags: coalesce request đọc đang chạy, tối đa 4 read và 2 background read, ưu tiên read người dùng, deadline 20 giây kể cả hàng đợi/body. Hủy một subscriber không hủy subscriber khác; hết subscriber thì hủy request. Đổi identity CRM hủy read cũ và đổi namespace. Không cache Response đã hoàn thành tại transport. Lệnh ghi, mở hội thoại có tác động native, upload/gọi và NDJSON đi luồng riêng, không tự retry hoặc gộp lệnh. CSRF chỉ lấy khi thiếu cookie hoặc nhận 419 trước thực thi; không bỏ kiểm tra CSRF.
- `live.ts`: giữ một stream chung mỗi trang; handshake đầu và nối lại cùng revision không kích hoạt fetch. Gap revision hoặc phục hồi sau lỗi vẫn yêu cầu cập nhật. Gom event nhiều tài khoản thành một lượt trong 1 giây; khi tab ẩn giữ dấu thay đổi và flush một lần khi hiện. Event của một tài khoản chỉ đọc lại tài khoản đó, giữ các hàng khác.
- Chính sách nền: quyền/kho inbox/thẻ/tệp đính kèm 60 giây; thống kê kho/ngày và tài khoản 30 giây; QR 2 giây khi mở liên kết; nhập file 5 giây lúc đang chạy, 60 giây khi rảnh; số liệu server giữ 30 giây. Poll completion-based tránh chồng lượt ở các trang kho/thẻ; tab ẩn/offline tạm dừng. Stream tin mới vẫn kết nối, không dùng timer tải lịch sử toàn bộ. Cuộc gọi đang hoạt động giữ giao thức và nhịp riêng.
- Kiểm tra local: 26 bài ở `api-policy`, `live-policy`, `inbox-recovery`, `archive-detail`, `archive-inbox-timeline`, `open-conversation` đạt; TypeScript đạt. Bao gồm coalescing/hủy độc lập, giới hạn nền, deadline body, command không replay, revision không đổi, gom burst và tab ẩn. Chrome tải đủ 154 cuộc trò chuyện/4 tài khoản, không notice sau bản sửa. Có log dev `[zalo-api]` chỉ operation/thời gian/số lượt, không body/token/ID hội thoại, phục vụ đo request.
- Mẫu đo Chrome sau khi ổn định, 76 giây không thao tác: 19 request JSON hoàn tất gồm scope 1, thẻ 1, danh sách kho 4 trang và conversations 13 lần theo event connector; không có friends/groups lặp lại trong cửa sổ này, cuối lượt hàng đợi 0. Con số này không bao gồm stream đang chờ, ảnh/tệp và auth/me của CRM. Chưa xác định mọi event connector có thay đổi nội dung hay chỉ biến động native store; không tuyên bố không còn request dư ở lớp native hoặc đã đạt hiệu năng production.
- Giới hạn: chưa có đối chiếu HAR trước/sau; ảnh Network cũ và source là bằng chứng nguyên nhân, log trình duyệt mới dùng đo kết quả. Chưa load test nhiều nhân sự hoặc nghiệm thu gọi/gửi thật trong lượt này. Chưa chuyển toàn bộ timeline/NDJSON sang Query; giữ stream và ranh giới chống gửi trùng hiện hành. Thay đổi chỉ ở frontend local, không cập nhật runtime connector/API/CRM trên VPS.

### 08/10/2026 — Đợt 1: giới hạn chờ và phục hồi danh sách theo tài khoản

- Phạm vi được duyệt: xử lý danh sách khởi tạo kéo dài, đọc trùng, thử lại và chẩn đoán; giữ nguyên profile, tài khoản, quyền, dữ liệu kho và nghiệp vụ CRM.
- Backend `integrations/zalo/web/inbox-reader.mjs` gom lượt đọc đồng thời theo tài khoản/phiên. Deadline 8 giây không tạo thêm native read khi lượt cũ còn treo. Cache gắn với handle/generation; kết quả phiên cũ không được ghi lại sau khi thay phiên. Lỗi tạm giữ kết quả tốt gần nhất, lỗi định danh/phiên không hợp lệ không dùng cache đó.
- `accounts.mjs`, `conversations.mjs`, `server.mjs`: tách lượt đọc theo tài khoản, ghi bước native frame/module/privacy/database/preview đang vướng. Sau ít nhất 5 lần lỗi và 90 giây, phiên rảnh ít nhất 45 giây mới được tải lại riêng, tối đa hai lần cho một đợt lỗi. Có bộ đếm thao tác đang chạy để tránh tải lại giữa lệnh kéo dài; các lần đọc sau vẫn tiếp tục phát hiện phục hồi. Không tự gửi lại tin nhắn hoặc lệnh gọi.
- Frontend `messages-layout.tsx`, `inbox-notice.ts`, `inbox-status.tsx`, types/CSS: deadline 20 giây, đọc lại có backoff tối đa 30 giây, nút thử riêng tài khoản, giữ các tài khoản còn tốt. API trung gian giới hạn đọc connector 12 giây, chuyển abort signal, thêm request ID và thông báo khi stream gián đoạn. Log chỉ ghi giai đoạn/mã lỗi/thời gian/ID, không ghi token hoặc nội dung chat.
- Kiểm tra: 34 bài trong `inbox-reader.test.mjs`, `accounts.test.mjs`, `conversations.test.mjs`, `transport.test.mjs`, `tooling/zalo-team/inbox-recovery.test.cjs` đạt; `tsc --noEmit --incremental false` đạt. Fixture kiểm tra timeout không chồng read, cache theo phiên, giới hạn phục hồi và thao tác đang chạy chặn reload.
- Triển khai riêng Web connector VPS 14.225.198.183: image `x3-zalo-team-web-connector:inbox-stage1-20261008`; rollback `before-inbox-stage1-20261008`. Kiểm tra gateway rảnh trước recreate, giữ volume profile. Container healthy, restart count 0, OOM false. Sau triển khai API đọc 172 ms, 4/4 tài khoản connected/ready, tổng 148 hội thoại; Hoà Nguyễn 23. Chrome `/zalo-team` hiển thị 148 cuộc trò chuyện · 4/4 tài khoản, không còn notice khởi tạo.
- Giới hạn bằng chứng: Hoà Nguyễn phục hồi sau lượt khởi động connector khi triển khai; chưa xác định sâu nguyên nhân native gate kẹt trước đó. Cơ chế tự reload đã kiểm thử cô lập, chưa cố tình gây lỗi trên tài khoản thật; chưa kiểm tra chạy 48–72 giờ hoặc gọi/gửi thật sau thay đổi. Lượt đọc toàn bộ vẫn có thể chờ tài khoản chậm tới deadline; trả danh sách từng phần và tối ưu startup/stream thuộc đợt tiếp theo. Frontend còn local, không thay CRM production 45.252.251.120.

### 08/10/2026 — Ghi nhận người gọi CRM

- Sửa thiếu tên người thực hiện cuộc gọi qua Team. Next lấy actor và tên từ CRM, gateway giữ snapshot của người mở phiên, CallConnector chuyển metadata riêng tới Web. Trước tín hiệu 401, connector lưu ánh xạ theo owner/Zalo account/hội thoại/**native call ID**, tách namespace với client ID tin nhắn. Không gửi tên CRM trong native signaling/logdata và không ghép theo giờ hoặc thời lượng.
- Chuẩn hóa call ID từ bản tin native; chỉ cuộc gọi outgoing có ánh xạ chính xác mới nhận `crmSender`, không dùng `mine` để suy ra chiều gọi. UI dùng dòng giờ/tên hiện có, ví dụ **11:33 - Admin X3**. View/version của kho giữ người gọi như tin nhắn; cuộc gọi trực tiếp từ app hoặc lịch sử chưa ghi actor không tự gán tên.
- Đã đọc lại đúng bản tin cuộc gọi 6 giây người dùng báo: native có call ID đối chiếu được, nhưng cuộc gọi trước bản vá chưa lưu actor theo call ID nên không backfill bằng suy đoán. Chưa thực hiện cuộc gọi thật trong kiểm thử của agent.
- Kiểm chứng: route chống giả danh, luồng CallConnector, call ID/chiều gọi, index tách biệt và render cuộc gọi cùng dòng tên; TypeScript noEmit đạt. Fixture SQLite kiểm tra lưu call ID/người gọi, không sửa dữ liệu thật.
- VPS Web/gateway đã cập nhật tag `call-sender-20261008`, chỉ restart khi health busy=false; giữ profile/kho và rollback Web `sender-20261008`, gateway `access-20261008`. API/kho không cần đổi. Frontend route mới chạy local; chưa cập nhật CRM production. Còn nghiệm thu một cuộc gọi mới từ Team sau bản vá.

### 08/10/2026 — Hiển thị người gửi CRM dưới tin nhắn

- Tinh chỉnh tiếp theo theo ảnh người dùng: gộp tên vào dòng thời gian **11:30 - Admin X3**, bỏ dòng “Gửi bởi” bên ngoài bubble. Tin Team vẫn có tên ở mỗi tin; tin app giữ giờ như cũ. Tên dài rút gọn bằng dấu ba chấm, tooltip có tên đầy đủ. Chỉ sửa frontend local; kiểm tra render component cho text/file/sticker và lịch sử.

- Tin văn bản, ảnh/tệp và sticker gửi từ Team có dòng nhỏ **Gửi bởi [tên CRM]** bên dưới bubble. Cả chủ tài khoản Zalo gửi từ Team cũng được ghi nhận theo người đăng nhập CRM. Tin gửi trực tiếp từ app/PC/mobile và tin cũ chưa có bằng chứng không gán tên; không suy luận từ người phụ trách tài khoản hoặc nội dung/giờ gửi.
- Next lấy user ID/tên từ projection CRM đã xác thực, không nhận tên/người gửi do browser tự truyền. Metadata chỉ đi tới connector nội bộ, không chèn vào nội dung gửi Zalo. Lưu snapshot tên lúc gửi để lịch sử không đổi người khi nhân viên đổi tên/chuyển phòng ban.
- `send.mjs` lưu actor trong receipt và index `send-receipts/senders` trên volume profile VPS trước native submission. Khóa theo workspace + Zalo sender ID + conversation ID + client ID; ghi nguyên tử, không quét toàn bộ receipt khi đọc trang. Retry giữ nguyên người gửi, chặn request ID dùng lại bởi actor khác. Mất phản hồi không gửi lại tự động.
- Connector bổ sung metadata vào trang tin JSON và từng gói NDJSON; tài khoản khác cùng nhóm có thể đối chiếu đúng Zalo sender/client ID. Kho lưu trong observation view/version (không đưa vào hash nội dung), vì vậy không nhân đôi nội dung/tệp; giữ bằng chứng khi native refresh thiếu index. Timeline giữ nhãn khi response kho/Web tới khác thứ tự; không gộp block/album khác người CRM.
- Kiểm thử: 16 Node cases (send/attribution, route chống giả mạo, render component và ghép timeline), fixture SQLite ingest/replay/version/dedup/native refresh, 42 ACL checks đạt. Mẫu component/CSS đã xem trên Chrome bằng fixture local, không gửi tin thật. Trang tài khoản thật sau restart hiển thị 3 tài khoản đang kết nối.
- Kiểm tra cuối: TypeScript noEmit/PHP lint đạt; hash source của connector và archive khớp bản chạy VPS, health Web/API đạt, worker tiếp tục quét; console tab tài khoản không có lỗi.
- Triển khai: Web `x3-zalo-team-web-connector:sender-20261008` (tag latest), API/sync/backup `x3-zalo-team-api:sender-20261008` (tag local) tại 14.225.198.183. Giữ rollback Web `before-sender-20261008`, API `access-20261008`; không đổi schema, tài khoản/phân công, profile, Drive hoặc CRM production. Frontend và projection CRM mới chạy local; còn nghiệm thu gửi thật từ hai user CRM và đối chiếu một tin từ mobile.

### 08/10/2026 — Phân quyền dùng chung Zalo theo phòng ban

**Quy tắc đã triển khai**

| Vai trò / quyền | Phạm vi |
| --- | --- |
| Admin | Toàn bộ tài khoản, phân công/chuyển phòng ban, chia sẻ khác phòng ban; nhập file, sao lưu, khôi phục, dọn dẹp, Server và thao tác xóa/thu hồi |
| Trưởng phòng thực tế (`departments.leader_user_id`) | Các Zalo do phòng ban mình quản lý; có thể quản lý nhiều phòng ban; liên kết mới cho phòng ban đó và đồng bộ Web |
| Người được cấp “Chỉ xem” | Xem/tìm tin và tệp đã được cấp; không gửi, gọi, tải tệp lên hoặc sửa thẻ hội thoại |
| Người được cấp “Sử dụng” | Đọc, gửi, tải lên, gọi và thao tác thông thường; có lựa chọn bổ sung Đồng bộ/Kết nối lại |
| Chia sẻ khác phòng ban | Chỉ admin cấp; không kéo theo quyền cho trưởng phòng của người được chia sẻ |

- Mỗi tài khoản có một phòng ban quản lý, một người phụ trách tùy chọn và nhiều người được sử dụng. Trưởng phòng không có quyền chia sang phòng ban khác, kể cả khi quản lý cả hai phòng ban. Grant khác phòng ban do admin tạo được giữ khi trưởng phòng chỉnh danh sách trong phòng ban mình.
- Đổi phòng ban, vô hiệu hóa hoặc xóa nhân viên thu hồi grant và xóa người phụ trách tương ứng; dữ liệu/tài khoản vẫn thuộc phòng ban cũ. Tăng revision của mọi tài khoản bị ảnh hưởng để form cũ không cấp lại quyền. Đổi trưởng phòng có hiệu lực theo dữ liệu CRM ở lần kiểm tra tiếp theo.
- `zt_access_*` chỉ nằm trong CRM; VPS nhận projection quyền qua kênh xác thực hiện có. `ZALO_TEAM_STORAGE_OWNER` trên CRM và VPS phải trùng owner của kho đang có. Không đổi hash/tái nhập/nhân bản profile hoặc dữ liệu theo từng người dùng.
- API chặn thao tác theo account trước khi gọi connector/gateway; lọc cả NDJSON, kết quả tìm kiếm, danh sách hội thoại, nguồn lịch sử và tệp tải xuống. QR chỉ trả cho người khởi tạo lượt liên kết. Phiên gọi còn ràng buộc với CRM actor để người cùng dùng một Zalo không điều khiển cuộc gọi của nhau.
- Tab đang mở kiểm tra lại quyền mỗi 5 giây; thay đổi phạm vi tải lại trang để bỏ cache giao diện. HTTP và từng gói stream kiểm tra quyền ở server. Khi mất kết nối CRM, truy cập dừng để xác nhận lại; không tiếp tục dùng quyền cũ.
- Nhập file local và cầu nhập riêng hiện dành cho admin. Worker đồng bộ nền dùng danh tính dịch vụ nội bộ, không phụ thuộc việc người bật đồng bộ còn là nhân viên. Người được quyền Đồng bộ chỉ thay đổi lựa chọn tài khoản của mình; không đổi lịch backup hoặc cấu hình tải tệp toàn kho.
- Nhật ký phân công/thu hồi trong `zt_access_audit`. Yêu cầu gửi/gọi ghi actor, account, loại thao tác/request ID trước khi thực thi; đây là nhật ký yêu cầu, không phải bằng chứng Zalo đã gửi thành công. Thao tác kho/thẻ trên VPS ghi log dịch vụ, không ghi nội dung tin hoặc thông tin đăng nhập.

**Kiểm chứng và triển khai**

- 42 kiểm tra PHP SQLite cô lập đạt: ma trận admin/trưởng phòng/nhân viên, nhiều phòng ban, chia sẻ khác phòng, form cũ, rollback, đổi phòng, khóa/mở lại, nguồn lịch sử và tải tệp trái quyền.
- 7 Node policy/route tests đạt: đọc/gửi, gọi, upload, thao tác nguy hiểm, lọc danh sách và QR qua NDJSON. Thêm 3 regression request hủy của Next đạt. TypeScript `--noEmit` và PHP lint đạt.
- Chrome kiểm tra danh sách 3 tài khoản, popup dùng TeamSelect/TeamDialog, mặc định chưa phân công và trang Đồng bộ đọc dữ liệu VPS. Không lưu lựa chọn phân quyền thật, không gửi tin hoặc thực hiện cuộc gọi thật trong kiểm thử của agent. Ảnh kiểm tra local: `.local/screenshots/zalo-permissions-20261008.png`.
- VPS dùng image overlay `x3-zalo-team-api:access-20261008` và `x3-zalo-team-call:access-20261008`, cùng tag `local`; giữ image `before-access-20261008` để rollback. Recreate API/sync/backup/call, giữ Web connector/profile, database, Drive workers và Tiny House. Health API/gateway đạt; sync tiếp tục quét trang. Không thay đổi schema kho trên VPS.
- Còn nghiệm thu: đăng nhập bằng nhân viên/trưởng phòng thật sau khi người dùng tự phân công, gửi/gọi thật với người nhận đồng ý, và triển khai CRM production. Không coi fixture/health là nghiệm thu các bước này.

### 07/10/2026 — Form nhập file dễ thao tác và Server gọn hơn

- `archive-page` mở mặc định Zalo Web. `archive-file-import` dùng TeamSelect cho tài khoản/giới hạn tải; thay đường dẫn bằng nút chọn file, tên và dung lượng; Đọc file vẫn là bước riêng. Không đổi queue/chống trùng/mở khóa.
- `file-pick` đi qua API local giống các lệnh nhập, xác thực CRM/loopback/account và chặn khi worker chạy. Picker GUI Windows dựng từ `FilePicker.cs` bằng thư viện .NET sẵn có, executable cache theo SHA-256 trong storage riêng từng owner; source thuộc backend, không commit binary. Hộp thoại tối đa 3 phút; selection ID hết hạn 30 phút, không trả đường dẫn tuyệt đối/khóa qua status. Hủy không làm thay đổi lượt nhập.
- Tab Server bỏ câu cache mục tiêu và box Tài nguyên hiện còn dư địa; giữ số liệu, cảnh báo cũ/lỗi và thử lại Drive; mô tả ngắn hơn.
- Kiểm tra: 24 PHP fixture bảo vệ owner/account/selection/hủy/hết hạn/worker đang chạy đạt (ngoài sandbox do sandbox chặn rename); 3 routing test đạt, TypeScript noEmit và PHP lint đạt. Chrome xác nhận mặc định Web, select chung, tab Server gọn và nhận tên/dung lượng file 29,69 GB; không bấm Đọc file, không nhập dữ liệu thật. Chưa deploy VPS; chưa thêm nguồn link Drive.

### 07/10/2026 — Tổng dọn mã cũ và đường kiểm thử

- Gỡ source/test không còn dùng của `tooling/zalo-bridge`, `tooling/zalo-runtime`; script Wine/audio thử nghiệm, browser thử một lần, PHP rehearsal đã xong và probe SQLCipher chưa bật. Tổng 178 file rời cây cũ; 3 test catalog/version/conversation-source chuyển về backend vì helper vẫn dùng.
- Giữ code PC/Windows còn được PHP/API tham chiếu, không sửa chức năng đang hoạt động. Giữ kho `tooling/archive` vì có tệp đính kèm; không dọn data/secret/profile/backup hoặc thay đổi dịch vụ VPS.
- Source gỡ được nén local 499.810 byte và kiểm tra SHA-256 từng file trước xóa; manifest ở `.local/cleanup-recovery/`. Bản phục hồi này không được commit/deploy.
- Một lệnh `npm run test:zalo` chạy fixture offline. Bộ kiểm tra PHP database và WAN/browser thủ công giữ riêng, không gọi tự động vào tài khoản thật.
- Docker ignore của Web/Call/API/Frontend loại `*.test.*` và thư mục tests. COMMANDS bỏ các lệnh Wine đã nghỉ, sửa đường cài file-import và thông tin giới hạn nhập.
- Kiểm tra: 280 đạt, 1 bỏ qua do chưa chọn bản cài Zalo riêng. Sandbox chặn rename fixture (EPERM), chạy lại ngoài sandbox đạt. TypeScript noEmit đạt. Docker scratch COPY dùng ignore thực tế đóng gói 59 file Web/Call, không có test, đủ entrypoint; đã xóa thư mục kiểm tra sinh ra. Không build lại dependency/image đầy đủ và không chạy container/VPS. Không còn tham chiếu runtime từ apps/tooling hiện hành tới Wine/bridge đã gỡ.



### 07/10/2026 — Đưa mã dịch vụ về backend, giữ công cụ ở tooling

- Người dùng chốt source chạy trong ứng dụng phải thuộc backend/frontend. Di chuyển web/call/file-import/pc và 9 module shared ASAR/CDP/catalog/registry từ tooling vào `apps/backend/integrations/zalo`; không nhân đôi source. Unit test và package-lock đi cùng module; node_modules local được chuyển cùng worker để tránh cài lại không cần thiết. Manifest 127 mục ở `.local/zalo-layout-moves.json` (gồm source/test/package và thư mục dependencies), không chứa credentials.
- Cập nhật PHP subprocess paths về `base_path('integrations/zalo/...')`, lệnh npm PC, import của tool/test, script gọi local và bootstrap PC tương thích. Source runtime chỉ import module tương đối bên trong backend; secret/profile/legacy state giữ vị trí cũ để không mất liên kết. Task tunnel và URL gateway VPS không thay đổi.
- Dockerfile/Compose tiếp tục ở tooling, build context về repo root và COPY source backend. Dockerfile-specific ignore chỉ cho mã cần thiết vào context; backend Docker ignore loại node_modules/.local/.work lồng nhau. Công cụ chẩn đoán dùng dependencies của worker backend; cập nhật probe WAN/module path nhưng không chạy cuộc gọi/probe WAN trong lượt này.
- Kiểm chứng: test Windows sandbox gặp EPERM rename/UDP timeout; chạy lại ngoài sandbox với dữ liệu giả đạt 185/185, 1 test SQLCipher cần runtime 32-bit bị skip. 14 API/routing/recovery + 3 layout/dependency/Compose/PHP-entrypoint tests đạt. TypeScript no-emit và lint hai PHP service đạt. Hai image scratch chỉ kiểm tra Docker COPY/.dockerignore cho call/web build thành công và đã xóa đúng tag test. Chưa build lại toàn bộ Linux image hoặc deploy VPS; các container server đang chạy giữ nguyên image/code cũ.
- Tạm dừng tính năng theo yêu cầu; không xóa backup/khóa/profile/tin nhắn. Cập nhật README chính, COMMANDS và runbook server về vị trí source mới và ranh giới local/deployed.

### 07/10/2026 — Tạm dừng tính năng, dọn project local

- Theo yêu cầu người dùng, không phát triển thêm/deploy/restart trong lượt này. Rà soát cho thấy tooling chứa runtime web/call/file-import, script vận hành, test và bản lưu cũ; PHP/frontend/npm/Docker/tác vụ Windows đang tham chiếu trực tiếp. `file-import/unlock.mjs` và PC còn dùng helper từ `zalo-bridge`, nên không xóa theo tên thư mục.
- Xóa đúng 10 gói transfer/image export local đã dùng xong, 784,54 MiB; manifest `.local/project-cleanup-20261007.json`. Giữ backup dữ liệu/image cũ, source, tests, node_modules cần chạy, credentials, profile, file xuất gốc và toàn bộ VPS. Không đổi đường dẫn runtime.
- Bỏ quy tắc `.gitignore` chặn cả tooling; thêm quy tắc cụ thể cho .local/.work/secrets/env/key/cache/archive. Kiểm tra runtime web/call/file-import không còn bị ignore, SSH key/web token/call token/env vẫn bị ignore. Source mới hiện untracked, chưa stage/commit. Bản đồ vai trò và refactor dịch vụ sang services (chưa thực hiện) ghi trong tooling/COMMANDS.md.

### 07/10/2026 — Chuyển gateway gọi thoại sang VPS Zalo

- Người dùng yêu cầu bỏ phụ thuộc máy local khi deploy. Kiểm tra xác nhận Docker call chưa chạy trên VPS, compose/Dockerfile Linux có sẵn nhưng chưa được kiểm chứng. Dùng đúng VPS đã cấu hình 14.225.198.183; địa chỉ .18 trong tin nhắn được hiểu là thiếu số cuối và đã thông báo.
- Sửa image sang Node 22/Trixie, bổ sung libpulse0 và runtime C++ phù hợp GLIBCXX_3.4.32 mà audify cần; kiểm tra tạo OpusDecoder ngay trong build. Dockerfile-specific ignore chỉ gửi mã gọi/package lock và module validation, không gửi profiles/secrets. Thêm compose standalone nối mạng Web hiện hành, API loopback, media UDP 41000–41031, read-only/cap-drop/memory 384 MiB/1 CPU/log rotation/healthcheck/restart unless-stopped. Khóa gọi truyền qua SSH, UID 1000/mode 0400 ngoài image, không đưa ra browser.
- Linux: 5 kiểm tra codec, scope connector, lifecycle Opus/SRTP với fake peer và terminal history đạt. Test UDP local trong sandbox Windows timeout; cùng test đạt trong container Linux. Chrome headless riêng dùng CallMedia thật với tone tổng hợp, không xin micro thật/không đăng nhập/không tạo signaling Zalo: ICE connected tới 14.225.198.183:41000 UDP, nhận 445 Hz cho tone 440 Hz, nhận/gửi RTP và PCM hai chiều, không drop/underflow trong lượt thử ngắn. Bằng chứng `.local/zalo-call-assets/wan-proof.json`; probe được đóng sau test. Không coi đây là nghiệm thu cuộc gọi thật/độ ổn định dài hạn.
- Bật `x3-zalo-team-call-call-1`; health zrtc/callReady=true, API thiếu token trả 403, nội bộ connector health HTTP 200. Idle đo 17,34 MiB RAM; image manifest sha256:fa517753d2e143b1ad8e49a045b60f56f8348f38bb18fb55c09900dbc2eed2e1. Zalo API/connector và Tiny House vẫn healthy, không thay đổi CRM production.
- Dev frontend `.env.local` dùng 9262 qua tunnel và autostart=false; thêm forward 9262 → VPS 9260, nạp lại task tunnel được cấp quyền từ trước, xác nhận 9250/9340/9262 cùng PID SSH. Chỉ dừng worker Windows sau khi health busy=false và gateway VPS sẵn sàng. Production compose frontend trỏ `http://call:9260`; không cần gateway Windows. 3 nhóm regression recovery và TypeScript đạt. Frontend hiện vẫn dev local, chưa deploy frontend CRM/Zalo trong lượt này.
- Giới hạn: một cuộc gọi đồng thời; chưa có TURN fallback cho mạng chặn UDP, chưa kiểm chứng cuộc gọi thật sau chuyển VPS/5G hoặc reboot toàn VPS. Browser production cần HTTPS. Xem README.SERVER.md để chạy compose, xem health và chuyển từ standalone sang full stack mà không tranh cổng.

### 07/10/2026 — Phục hồi dịch vụ gọi điện sau khi chạy lại dự án

- Tái hiện lỗi: loopback 9260 không có listener/process gateway, health connection refused; tunnel 9250/9340 và connector VPS vẫn chạy. Gateway từng mở thủ công, chưa gắn vòng đời vào lệnh dev, nên mất process là nút gọi báo chưa sẵn sàng.
- Thêm `call/ensure-local.ps1`, `ensure-local.cjs` và API `call/gateway.ts`: chạy PowerShell ẩn, kiểm tra health trước/sau, mutex chống mở trùng, đồng nhất các request startup, giới hạn thời gian. Cổng có dịch vụ trả health không đúng ZRTC bị từ chối, không tự dừng dịch vụ. Frontend dành tối đa 32 giây cho capabilities; offer/start/status/end giữ timeout cũ. Health thêm busy để kiểm tra worker rảnh an toàn.
- Chỉ phục hồi worker ở bước capabilities sau xác thực/origin check, cố định localhost:9260 trên Windows. Không tự gọi lại khi request start lỗi, không tự gửi tin, không thao tác Zalo PC. Frontend predev/backend dev cùng dùng helper; không thay đổi runtime VPS hoặc CRM production.
- Kiểm thử: 3 nhóm regression đạt (phạm vi khởi động, chống chạy trùng, auth và không replay mutation), TypeScript no-emit đạt. Runtime local: health provider=zrtc/callReady=true/busy=false; helper chạy lại giữ PID, dừng đúng process vừa tạo khi rảnh rồi helper phục hồi sang PID mới, health đạt, stderr trống. Chưa kiểm chứng gọi thật/âm thanh hai chiều hoặc đăng nhập Windows lại; không coi health là nghiệm thu cuộc gọi.

### 07/10/2026 — Khôi phục danh sách tài khoản mới và làm mới QR

- QR: người dùng báo iPhone dùng 5G quét được, người khác quét ảnh gửi qua Zalo bị từ chối. VPS thấy lượt đang kiểm tra đã expired; code giới hạn 180 giây/lượt. Chưa đủ căn cứ kết luận khác mạng hoặc Zalo chặn ảnh chuyển tiếp. AccountsPage bổ sung đếm ngược, ẩn QR khi hết hạn/đang lấy lại và nút Lấy mã mới. Chrome kiểm chứng expired không hiện ảnh; lấy mã mới có timer 2:46. Sau đó người dùng liên kết tài khoản thật thành công.
- Tài khoản mới connected nhưng API danh sách trả 0/WEB_CONVERSATIONS_UNAVAILABLE. Code cũ gom mọi ngoại lệ và UI gán lỗi đọc thành tài khoản cần kiểm tra. Lần đọc lỗi chủ yếu đợi sự kiện mới, không có retry khởi tạo riêng.
- accounts.mjs giữ mã NOT_READY/ADAPTER_CHANGED/IDENTITY_MISMATCH và log giới hạn mã/vị trí/kiểu lỗi, không in nội dung chat, không lặp cùng lỗi. Đã build/recreate riêng connector VPS, giữ profile/phiên và image rollback before-inbox-20261007. Sau khởi tạo lại API trả 3 hội thoại/error=null; Chrome hiển thị và hết cảnh báo. Không tái hiện được ngoại lệ gốc sau restart, chưa kết luận nguyên nhân sâu hơn trong Zalo Web.
- Frontend tách đang khởi tạo/lỗi đọc/lỗi tài khoản; tự thử đọc sau 2/4/8/15/30 giây, dừng khi hết lượt hoặc thành công. Không tự đăng xuất, không replay thao tác ghi. 26 kiểm tra có trọng tâm và TypeScript đạt. Không sửa dữ liệu kho/Drive/CRM/Tiny House. Chưa thử tài khoản thứ hai sau bản sửa.

### 07/10/2026 — Drive hoạt động trên VPS; không chuyển toàn bộ kho test

- Đã được người dùng cho phép tạo service account/khóa riêng, Contributor đúng Shared Drive. Tạo project `x3sales-zalo-storage-20261007`, bật Drive API và kho riêng; không bật billing/trial/domain-wide delegation. Key VPS mode 0600, UID/GID 82, mount read-only; bản tải tạm trong Downloads đã xóa sau PoC. Không đổi CRM 45.252.251.120, Tiny House, tài khoản, profile Web hoặc file xuất gốc.
- Thêm `ZaloTeamDriveClient`, `ZaloTeamDriveStore`, command/migration/compose Drive. Tệp nhỏ multipart, tệp lớn resumable 8 MiB; ID ghi trước upload, offset do Google xác nhận, session mã hóa. Kiểm tra SHA-256/kích thước/owner/folder/quyền xóa trước verified. Tích hợp đọc lạnh vào asset/history/PC plan/index/import/checkpoint/backup verify/discover/restore. Tách khóa upload/read; eviction toàn cục chỉ bỏ cache đã đối soát, giữ preview và tệp truy cập trong 1 giờ. Không có API delete/trash/overwrite/sharing Drive.
- 8 worker × tối đa 256 MiB/1 CPU; đo idle tổng 244,5 MiB. Log giới hạn 2 × 2 MB/worker, idle 15 giây. Tab Server bổ sung thống kê Drive và collector gộp RAM/CPU worker. Cache 5 GiB là mục tiêu cho tệp có thể dọn, cộng preview/tệp đang dùng/tệp chưa chuyển; không phải trần tổng ổ đĩa.
- PoC thật: hai tệp 1.165.741 và 1.149.829 byte upload → tải cold → SHA-256 khớp; replay giữ ID; canDelete/canTrash=false. Snapshot test trên VPS gồm 9.611 blob, manifest 27.079.713 byte đã giải mã/verify hoàn tất lúc 14:40:21 UTC. Chỉ manifest và một encrypted blob được đưa lên Drive để kiểm chứng tải lạnh/giải mã/hash gốc. Không restore ghi đè DB thật; restore mất DB/locator được thử trong môi trường cô lập.
- Chỉ đạo mới: không chuyển hết dữ liệu test. Đã dừng 8 worker, đưa 2.005 lượt chưa xong sang `deferred` và giữ ID/session/file local. Giữ 519 archive + 1 manifest + 1 encrypted blob đã verified. Loại hai external account test xác nhận từ trang Liên kết tài khoản khỏi scan tự động; bản backup test cũ không tự chuyển toàn bộ. Dữ liệu của tài khoản mới vẫn xếp hàng; nếu trùng hash đã deferred thì khôi phục cùng ID. Backup tạo sau mốc cấu hình vẫn vào luồng Drive. Không xóa kho/backup test local hoặc VPS.
- Kiểm thử: Drive storage 41, Drive archive/restore 15 (gồm loại trừ test/chống trùng với account mới), PC import 32, metrics PHP 9, collector Python 7 đạt; archive 172 và PC bridge 32 đã đạt trước đó. TypeScript đạt. Python local không có runtime, collector được thử trên VPS. Image là overlay trên runtime hiện hành; migration chỉ DB Zalo riêng. Health và Chrome tab Server đã kiểm chứng 0 chờ/0 lỗi, đúng số Drive/cache/worker.
- Contributor vẫn có thể sửa nội dung bằng công cụ Google khác; đây không phải WORM. Manager/Workspace admin vẫn có quyền xóa; không có OTP riêng cho từng lần xóa folder trong cấu hình này. Không đổi quyền manager hay chính sách toàn domain. Chưa kiểm chứng với tài khoản thật mới hoặc tải quy mô lớn; số liệu trên là mốc nghiệm thu chức năng bằng dữ liệu test.

### 07/10/2026 — Khảo sát dùng Google Drive để giảm dung lượng VPS

- Bổ sung từ người dùng: Drive có 22 TB, đủ cơ sở lên phương án lưu file/backup. Đây là hạn mức do người dùng xác nhận; UI lần kiểm tra chỉ hiện mức đã dùng. Chrome x3sales đã kết nối sau khi người dùng cài tiện ích; trang Bộ nhớ dùng chung chưa liệt kê drive nào. Source/config dự án chưa có tích hợp Google Drive/OAuth để VPS sử dụng, nên quyền trình duyệt không được coi là quyền backend. Chưa tạo OAuth client, token hoặc thay đổi quyền/chia sẻ trên Drive.

- Phân chia theo người dùng: 45.252.251.120 phục vụ backend CRM, 14.225.198.183 phục vụ Zalo Team. Luồng local đang kiểm thử vẫn qua tunnel như checkpoint trước; chưa đổi endpoint xác thực sang CRM production.
- Snapshot VPS 20:48:52: 10 CPU, RAM 16.011 MiB/khả dụng 13.374 MiB; ổ root dùng 17.099.194.368 byte, khả dụng 86.749.331.456 byte; archive 3.330.527.232 byte, backup 4 KiB. API đang nhập ~565 MiB, Web connector ~980 MiB, DB ~172 MiB. Tiny House vẫn có 3 container hoạt động (~223 MiB), nên thực tế host còn chia sẻ; đã báo người dùng, không dừng/xóa. Không tăng giới hạn chỉ để chiếm hết RAM.
- Đã truy cập Drive bằng đúng Chrome x3sales và xác minh danh tính hiển thị của tài khoản công ty. UI báo tổng dùng 371,91 GB, Drive 371,77 GB, Gmail 1,7 MB, Photos 143,2 MB; chưa xác định quota còn lại. Kiểm tra mạng từ VPS tới `https://www.googleapis.com/drive/v3/about` nhận 401: đường HTTPS hoạt động, chưa chứng minh quyền API. Phiên đăng nhập Chrome không phải credential của dịch vụ VPS.
- Hướng đề xuất, chưa chốt triển khai: DB/nội dung tin/chỉ mục ở VPS; file gốc, video, tài liệu và backup mã hóa ở Drive; giữ preview và cache tệp thường dùng có trần dung lượng trên VPS. Upload nền có tiếp tục, kiểm tra kích thước/checksum, giữ mapping owner+SHA-256→Drive fileId, cùng nội dung dùng một blob trong phạm vi được phép. Chỉ giải phóng bản VPS sau xác minh bản Drive và thử đọc lại; migration từng phần, giữ trạng thái chưa chuyển rõ ràng. File phục vụ qua kiểm tra quyền Team, không dùng link công khai. Drive lỗi/hết quota thì giữ bản local và báo nguyên nhân.
- Google Drive có quota API và phụ thuộc mạng; không coi Drive là ổ đĩa local hoặc cam kết mở ảnh/video lạnh nhanh hơn SSD. Chuyển tệp giảm ổ đĩa, không trực tiếp giảm RAM của Web connector. OAuth quyền `drive.file` cho tệp ứng dụng tạo/chọn là hướng ưu tiên; cần quota và thư mục đích trước khi nhập dữ liệu thật. Kiểm thử dự kiến: upload/download/checksum, gián đoạn/tiếp tục/chống trùng, phân quyền, hết quota, mở ảnh/video khi cache trống và khôi phục backup. Chưa chạy các bài Drive này, chưa thay storage provider hoặc chuyển dữ liệu.
- Tài liệu chính thức: https://developers.google.com/workspace/drive/api/guides/api-specific-auth ; https://developers.google.com/workspace/drive/api/guides/manage-uploads ; https://developers.google.com/workspace/drive/api/guides/manage-downloads ; https://developers.google.com/workspace/drive/api/guides/limits .

### 07/10/2026 — Tự tiếp tục khi kho bận, ưu tiên lượt nhập và chuyển codec ảnh lên VPS

- Nguyên nhân xác minh: commit HTTP 409 do mutex cùng owner bị sync nền giữ. Sync xử lý tệp trước khi đọc cờ `enabled`, nên nguồn tải chậm gây tranh khóa dù đồng bộ Web tắt. Client cũ biến HTTP thành thông báo gián đoạn chung. VPS không thiếu RAM. Đầu lượt cursor ở 3.000 tin; giữ source, selection 517 hội thoại và kết quả đã lưu.
- `ZaloTeamImportTransportException`/`ZaloTeamFileImportRetry` phân biệt kho bận, mạng, quyền, checksum và hết đĩa. Lỗi tạm thử tối đa 12 lần, chờ 1–30 giây; heartbeat/nút Dừng vẫn hoạt động. UI hiển thị nguyên nhân chờ, lần thử và tốc độ trung bình. Sai quyền/hash không thử mù. Hết giới hạn chờ, thông báo giữ đúng nguyên nhân và cho Tiếp tục.
- Cache batch local theo nguồn/kích thước/mtime/cursor/chế độ preview, kiểm tra hash manifest trước dùng lại. Tệp đã truyền được file-plan xác minh/reuse; cursor chỉ tăng sau commit. Cleanup staging lưu hàng đợi riêng, lỗi cleanup không làm lại batch đã commit. Giữ checksum, quyền owner, bản gốc, dữ liệu Web mới/thu hồi/xóa và import idempotent.
- `ZaloTeamFileImportLease` đánh dấu ưu tiên theo owner ở prepare/file-plan/upload/commit, hết hạn 120 giây sau hoạt động cuối. Sync kiểm tra trước và trong mutex, nhường lượt nhập; không đổi thiết lập của người dùng, tự chạy lại khi lease hết hạn. API/sync đã recreate để bỏ khóa nền đang giữ; không đổi DB/profile/CRM/Tiny House/backup.
- Đo trước sửa: batch 250 tin/18 ảnh JXL mất 13,64 giây local: đọc tệp 0,054 giây, decode 7,53 giây, encode 5,91 giây. Cùng 18 ảnh dùng libjxl native VPS mất 1,21 giây (nhanh hơn khoảng 11 lần riêng bước ảnh). Bộ đọc gửi JXL gốc, VPS tạo JPEG xem trước; giữ nguyên JXL. Decoder giới hạn 2 slot toàn dịch vụ, mỗi tiến trình 2 thread/512 MiB địa chỉ/20 giây CPU/30 giây thực; JPEG tối đa 16 MiB/40 triệu pixel. Lỗi ảnh được báo riêng, không báo đã lưu preview giả.
- Batch production tăng 250 → tối đa 1.000 tin và ~128 MiB media; tệp riêng vẫn tối đa 250 MiB. `ArchiveVersions::recordMany` ghi theo nhóm 100, giữ identity/payload. Windows đọc/giải mã nguồn theo khối, không nạp file 29,69 GB vào RAM. API VPS trần 4 CPU/3 GiB, FPM 6 children; sync 256 MiB/backup 384 MiB không đổi. Snapshot lúc nhập: API 114,9 MiB, CPU 131,62% (100% = một core), không phải RAM đỉnh.
- Kiểm chứng thật: giữ mutex có kiểm soát 20 giây, UI chờ 409 rồi tự chạy 3.000 → 4.000 tin. Sau ưu tiên sync, tiếp tục vượt 13.000 tin; batch 477 tin/134.605.194 byte mất 21.249 ms; 1.000 tin/119.558.690 byte mất 24.746 ms. Đối soát giữa lượt: 1.446 blob/1.017.875.968 byte, 0 sai hash, DB 11.075 tin. Mốc sau: 31 batch ready, 691 preview native, 0 lỗi chuyển đổi, 13.075 tin. Đây là các mốc khác thời điểm, không cam kết tốc độ toàn file.
- Kiểm tra cô lập: 8 retry checks, 32 PC import checks, 32 bridge checks (gồm ưu tiên owner/hết hạn), 13 control checks, 7 Node reader tests (gồm batch 1.000 và server preview); TypeScript noEmit đạt. Node fileNoise test bị sandbox Windows chặn atomic rename, chạy lại ngoài sandbox trong fixture riêng đạt. Chrome xác nhận tự chờ/tự tiếp tục và tiến độ; chưa nghiệm thu hết 357.235 tin/517 hội thoại hoặc xác nhận trực quan desktop không nháy CMD.
- Bản chạy: `x3-zalo-team-api:file-native-priority-20261007`, tag `local`, manifest `sha256:97efe2b91aa8e84b51cb44c191f3102718c42e8a6652f5a27f0b3fcf7a904909`. Source VPS/Dockerfile cập nhật `libjxl-tools`; không chạy migration/reset kho. File nguồn giữ nguyên. Lượt nhập tiếp tục chạy sau kiểm tra.
- Chrome sau sửa: đã hiển thị 16.289/357.235 tin, truyền 2,16 GB, trung bình lượt 27,4 tin/giây và 3,66 MB/giây (gồm thời gian xử lý/chờ, không phải băng thông thuần). Mở lịch sử ngày 04/10: 2 ảnh tải được, kích thước 720×1280 và 1276×956. Bằng chứng `tooling/zalo-team/.work/native-export-20261007/file-import-native.png`. Không hứa thời gian hoàn thành toàn file; tốc độ tùy loại tệp và đường truyền. Nguồn vẫn 29.690.562.576 byte, mtime 07/10 18:29:29.

### 07/10/2026 — Chạy nhập ẩn, truyền tệp theo nhóm và bỏ giới hạn thử nghiệm mặc định

- Lỗi cửa sổ: PHP CLI gọi Symfony Process qua CMD cho từng batch; launcher mới dùng `Start-Process -WindowStyle Hidden` để con kế thừa console ẩn. Launcher Node dùng stdio ignore để không giữ pipe của worker, tránh request chờ hết lượt nhập hoặc giết worker theo timeout. Không chạy lịch sử trực tiếp từ Zalo PC.
- Tốc độ: `file-plan` kiểm tra nhiều tệp trong một request, tái dùng blob thuộc đúng owner đã xác minh. `upload-pack` ghép header và file bằng AppendStream, không nén lại hoặc nạp toàn gói vào RAM. Tối đa 128 tệp/gói, gom khoảng 128 MiB (tệp đơn tối đa 250 MiB), đọc/ghi 1 MiB. File hoàn chỉnh giữ lại khi request bị ngắt; file dở bị xóa; commit vẫn kiểm tra manifest, hash, quyền và chống trùng. Luôn chừa 512 MiB trống.
- `prepare(fileImport=true)` bỏ dựng toàn bộ lịch sử/index cũ; chuẩn bị một lần cho mỗi hội thoại trong lượt chạy. Tra cứu media trong SQLite dùng khoảng tiền tố trên khóa tên thay vì LIKE quét lại danh mục. Giữ batch 250 tin để giới hạn RAM và mốc tiếp tục.
- Gỡ trần 9,5 GB đã đặt theo yêu cầu thử tối đa 10 GB trước đó. Trần tải lên giờ là lựa chọn rõ ràng, mặc định null/không giới hạn, có thể thay đổi khi tiếp tục. Số byte truyền tăng theo byte HTTP đã gửi, gồm dữ liệu giao thức/thử lại, không coi là dung lượng lưu duy nhất. UI bổ sung số tin/hội thoại đã đối chiếu và trạng thái Đang dừng; dừng chủ động dùng thông báo trung tính.
- Giữ nguyên file gốc 29.690.562.576 byte và hàng đợi 517 hội thoại/cursor trước sửa. Đã tiếp tục từ 1.000 tới 1.500 tin rồi thử Dừng trên Chrome: FILE_STOPPED, cursor bền vững. Đã truyền tăng từ 81.705.130 tới 185.968.330 byte. Đọc lại toàn kho trên VPS: 2.120 tin, 276 blob duy nhất/183.076.440 byte, 0 sai SHA-256. Một batch 250 tin/37 slot tệp được dựng local trong 21,7 giây; chưa có số đo toàn lượt để hứa thời gian nhập 29,69 GB. Snapshot RAM sau dừng: API 39 MiB, DB 166 MiB, không phải số RAM đỉnh.
- Kiểm tra: 29 bridge checks (bao gồm pack thiếu/gián đoạn/sai hash/traversal/owner/duplicate/resume), 32 import checks, 13 control checks, 7 Node reader tests; TypeScript noEmit đạt. Sandbox Windows chặn atomic rename nên các bài file chạy lại trong thư mục tạm riêng ngoài sandbox và đạt. UI Nhập/Dừng/Tiếp tục kiểm tra Chrome; native desktop đối chiếu bằng launcher và cây tiến trình, chưa có xác nhận trực quan từ người dùng về hết nháy CMD.
- VPS chỉ rebuild/recreate API, image `x3-zalo-team-api:file-pack-20261007` (manifest `sha256:afa1ef066d3324f4b8dac947ec86dde0bdb3bf4547d7129fc0c611f23687d522`). Không đổi DB, profile, Tiny House hay lịch sync/backup. Các giới hạn tệp riêng/album/JXL ở bản trước vẫn áp dụng; không tuyên bố đã nhập đủ toàn bộ file.

### 07/10/2026 — Dọn kho thử và thay nhập PC bằng file xuất

- Phạm vi được xác nhận: xóa kho Zalo Team/backup Team trên VPS và dữ liệu nhập PC tạm local; giữ file xuất gốc, tài khoản đã liên kết và CRM. Đã dừng worker, xóa các bảng nội dung/asset/import/retry/backup/checkpoint/phone job của kho riêng, dọn đúng archive/backups, VACUUM DB riêng. Không xóa Web profile, 7 thẻ, identity hoặc Tiny House. File gốc vẫn 29.690.562.576 byte, thời gian sửa giữ nguyên. Sau dọn, kho/backup về 0; sau thử có 620 tin mới nhập.
- Thay giao diện bằng tài khoản + đường dẫn file + Đọc file + danh sách lựa chọn/tìm kiếm. Không upload nguyên file 29,69 GB. Windows chỉ đọc, giải mã theo đoạn và truyền bundle 250 tin kèm media; VPS giữ toàn bộ kho lâu dài. Chỉ mục SQLite lưu offset/hash, không nhân bản 600 MB metadata thành JSON trong RAM. Cache chỉ mục/trạng thái mới local khoảng 83 MB (không phải bản sao toàn bộ kho); thư mục bundle xóa sau commit. Worker một lượt PHP 192 MiB/Node heap 256 MiB, không resident, không quét PC theo từng hội thoại.
- Native export 26.9.10 cần khóa tài khoản; account ID và khóa Web không mở được gói này (probe đã gỡ). Nút Mở khóa bằng Zalo PC xin xác nhận rõ việc restart một lần; khóa dẫn xuất được mã hóa bằng APP_KEY local trong thư mục riêng owner, không gửi lên VPS/log/git. Tắt chẩn đoán ngay sau lấy khóa. Cổng/lease PC đã kiểm tra đóng. Import và tiếp tục sau đó chỉ đọc file.
- Giữ native conversation/message/client ID, thời gian, nội dung và nguồn; bỏ 36.029 dòng trùng hệt, dừng khi cùng ID khác payload. Bộ ghi kho sẵn có bảo vệ tin Web mới/thu hồi/xóa, phát hiện xung đột. FileNoise kiểm tra signature, kích thước/MD5; mọi blob truyền kiểm tra SHA-256. JXL giữ nguyên bản gốc và tạo JPEG xem trước cho trình duyệt. Tệp đã có của đúng owner được kiểm tra hash và hardlink staging, không upload lại.
- Khóa command/worker chống đổi file/chạy song song. Cursor chỉ tiến sau commit. Dừng, mất mạng hoặc worker chết giữ phần đã lưu; tiếp tục lặp batch an toàn. Nút từ HTTP đã sửa môi trường SystemRoot bị Symfony lọc trên Windows; không chỉ kiểm thử bằng CLI. Endpoint file chỉ localhost + CRM auth; kiểm tra đúng tài khoản, file nguồn thay đổi, đường dẫn TAR, checksum và giới hạn truyền.
- Giới hạn bản thử: tổng truyền 9,5 GB (chừa 0,5 GB dưới mức người dùng cho phép), tệp riêng tối đa 250 MiB; JXL preview tối đa input 16 MiB/40 triệu pixel. Album chưa xác định được ánh xạ từng tệp và tệp thiếu/corrupt/vượt giới hạn được ghi rõ, không báo đã lưu đầy đủ. Danh sách lỗi có tên, loại, giờ và mã tin trong hội thoại; không suy ra tệp đã mất ở thiết bị khác.
- Kiểm chứng: toàn metadata file thật đọc được; nhập 586 + 34 = 620 tin, 72 blob/3.709.589 byte, SHA-256 toàn bộ khớp; ảnh mẫu trong hộp lịch sử Chrome tải được từ URL kho Team; 2 ảnh + 8 nhãn dán chưa tìm được bản trong export. Lượt nhập lại và dừng/tiếp tục từ Chrome giữ 620 tin, 72 blob, 0 tin mới. Tổng dữ liệu truyền thử khoảng 4,3 MB; không chạy nhập toàn bộ. 7 test Node reader, 6 projection, 12 Web guards/accounts, 12 PHP điều khiển file, 17 bridge và 32 importer đạt; TypeScript đạt.
- API và Web connector cập nhật trên VPS, frontend và bộ đọc vẫn local. Sau reset giữ đồng bộ Web tự động và backup ngày tắt trong lúc kiểm thử; worker được khởi động để người dùng có thể chủ động bật lại. Chưa cấu hình bản dự phòng ở nơi độc lập ngoài VPS. Không coi lần thử hai hội thoại là nghiệm thu toàn bộ media của gói.
- Thành phần: tooling/zalo-team/file-import; ZaloTeamFileImport/RunZaloTeamFileImport; bridge tái dùng blob; ArchiveController chặn pc-* trả 410; archive-file-import.tsx, archive-page.tsx, proxy/CSS; dev-backend không tự bật bộ PC cũ. Core PC/codec gọi thoại giữ lại.


### 07/10/2026 — Kiểm chứng gói xuất `.zl.zip` do người dùng cung cấp

- Phạm vi: nghiên cứu/đọc file local, chưa sửa luồng nhập sản phẩm. Giới hạn upload thử nghiệm người dùng cho phép: không quá 10 GB; thực tế lượt này **0 byte upload**. Không ghi database Team, không gọi nhập/khôi phục của Zalo, không thay đổi VPS. File nguồn giữ nguyên kích thước và thời gian sửa.
- Đối chiếu source `main-dist/preload-render.js` và bundle renderer của Zalo PC 26.9.10: xuất V2 đóng TAR rồi mã hóa AES-256-CBC với khóa từ UIN của đúng tài khoản. ID hội thoại/tài khoản không thay thế khóa này. Dùng quyền khởi động lại/cổng chẩn đoán tạm đã được cấp; đọc khóa của đúng account vào bộ nhớ để mở file, không ghi khóa ra file/log hoặc gửi VPS. Sau kiểm tra đã đóng cổng 9333 (ECONNREFUSED), xóa lease tạm qua helper hiện có, mở Zalo bình thường và xác nhận không còn process có tham số debug.
- Bộ đọc thử nghiệm đọc random access từng đoạn CBC/khối TAR, kiểm tra padding, header và đường dẫn. Đọc danh mục cả gói bằng khoảng 12,2 MB thay vì giải nén 29,7 GB; không có thành viên thoát đường dẫn/symlink trong gói đã kiểm tra. `zconversation.zdb` 286.905 byte và `zmessage.zdb` 600.870.195 byte là JSON theo dòng; đọc toàn bộ theo luồng, không có dòng JSON lỗi.
- Metadata: 752 dòng hội thoại, 393.264 dòng tin nhắn trong 517 hội thoại có tin. Có 36.029 dòng lặp trùng nội dung theo cùng `(toUid,msgId)`, không thấy phiên bản khác nhau trong các khóa trùng của gói này; 357.235 khóa duy nhất. Khoảng thời gian Việt Nam 21/08/2020 21:40:14 đến 07/10/2026 18:17:11. Không dùng số dòng xuất làm số tin mới sẽ nhập.
- Media: 21.275 tệp gồm 2 metadata, 17.370 mục picture, 629 video, 497 file, 2.777 fileNoise. Trong đó 16.344 đuôi JXL, 836 đuôi JPG; tên đuôi chưa đủ xác định MIME (mẫu `.jpg` thực tế là PNG). Tám mẫu fileNoise đã bỏ lớp noise theo source gốc, đối soát MD5 với checksum tên cache: 8/8 khớp, gồm PDF/ZIP; một ảnh giải mã/mở được, một JXL có signature hợp lệ nhưng chưa chuyển đổi/render JXL. Tổng payload mẫu 6.638.637 byte, chưa kiểm tra mọi tệp hay ghép mọi attachment với tin tương ứng.
- Hai ZIP ở ngày 07/10 người dùng vừa xem có metadata với kích thước khoảng 495,2 MB và 500,7 MB, nhưng không thấy mục tệp khớp client ID/kích thước gốc hoặc gốc + lớp noise trong danh mục xuất. Không báo các tệp này đã được sao lưu chỉ vì tin nhắn có trong gói.
- Metadata hội thoại không có tên/ảnh đại diện trong các dòng đã đọc; bộ nhập cần ghép catalog hiện có/nguồn được xác minh. Đề xuất tiếp theo: mở gói tại máy người dùng → chọn hội thoại/mẫu đầy đủ → loại trùng → giải lớp fileNoise/chuyển JXL và xác minh nội dung → gửi những bản còn thiếu vào staging trên VPS, tổng upload thử ≤10 GB → đối soát rồi mới nhập kho. Bước lấy khóa vẫn là phụ thuộc đã xác minh; chưa chứng minh mở file chỉ bằng account ID hoặc hoàn toàn không cần phiên Zalo.
- Bằng chứng local trong `tooling/zalo-team/.work/native-export-20261007/`: `native-inventory.json`, `native-members.jsonl`, `metadata-report.json`, `media-report.json` và script đọc thử; chỉ là công cụ nghiên cứu, chưa phải importer sản phẩm. Chưa nghiệm thu UI hay thực hiện một lượt nhập qua file trên Team.

### 07/10/2026 — Xem cụ thể tệp chưa lấy được theo ngày

- Phạm vi theo yêu cầu: **Lưu trữ → Lưu trữ theo ngày**. Nhãn số tệp lỗi trở thành nút mở hộp chi tiết; dùng lại `TeamDialog`/`ArchiveButton`, header cố định và nội dung cuộn riêng. Hiện tên tệp, giờ gửi, hội thoại, người gửi, tài khoản, lý do lỗi và lịch thử lại nếu có. Nút **Xem hội thoại trong ngày** mở lịch sử chỉ đọc theo đúng nguồn/ngày.
- API `day-file-issues`: bắt buộc ngày hợp lệ, lọc owner/tài khoản/ngày Việt Nam và quan sát còn hiển thị, chỉ lấy slot gốc `%.url` trạng thái `error`. Không trộn ảnh xem trước, mục đã dọn hoặc ngày khác; một asset chung nhiều tài khoản có một dòng với các nguồn tương ứng. Phân trang 50 mục, không trả URL nguồn/path hoặc toàn bộ nội dung tin; không ghi kho hay gọi Zalo.
- Thành phần: `ZaloTeamArchiveReport.php`, `ZaloTeamArchiveController.php`, `archive-days.tsx`, `archive-day-files.tsx`, `archive.module.css`; kiểm thử `tooling/tests/zalo-team-day-files.php`.
- Kiểm tra: 18 kiểm tra SQLite cô lập đạt (ranh giới ngày, owner, tài khoản, trạng thái, trùng nguồn, người gửi, phân trang và ngày không hợp lệ); PHP syntax và TypeScript đạt. Chrome local nối API VPS: số đếm 2 khớp 2 mục thật ngày 07/10, hiển thị đúng người gửi/tài khoản, mở đúng lịch sử và đóng trở về danh sách. Ảnh đối chiếu lưu tại `tooling/zalo-team/.work/day-files/dialog.png`; chưa có nghiệm thu của người dùng.
- Triển khai: image API bổ sung hai file PHP từ image đang chạy; chỉ recreate `api`, giữ nguyên sync/backup/database/Web/Tiny House. Không migration, không nhập dữ liệu PC. Hướng nhập từ file xuất Zalo PC tiếp tục chờ file người dùng gửi.

### 07/10/2026 — Tự khởi động bộ nhập PC cùng backend dev

- Người dùng thấy “Bộ kết nối PC chưa chạy”. Kiểm tra không có tiến trình `zalo-team:pc-worker`, heartbeat cuối 22:45:56 ngày 05/10, session disconnected. Lệnh dev trước đó chỉ mở backend HTTP và không bật worker nhập PC.
- Thêm `pc/worker-status.php` probe cấu hình Laravel/khóa worker, không đọc hoặc trả nội dung tài khoản. `pc/ensure-worker.cjs` chạy từ `dev-backend.cmd`, chỉ Windows local/combined, mở PHP worker ẩn, chờ heartbeat tối đa 8 giây; đã chạy thì dùng lại, không khởi động trùng. Log tại `storage/app/private/zalo-pc/worker.log`, giữ một bản trước khi vượt 1 MiB lúc khởi động. Thiếu PHP/lỗi khởi động chỉ cảnh báo, không chặn CRM.
- UI trạng thái disconnected có worker hiện “Sẵn sàng kết nối”; thiếu worker ghi rõ dịch vụ nhập trên máy cần backend dev. Luồng xác nhận kết nối, tài khoản, hàng đợi và xử lý dữ liệu không đổi.
- Thực tế đã bật worker nền, gọi helper lần hai không tạo thêm: một PID PHP, heartbeat cập nhật; tám PID Zalo giữ nguyên, không mở cổng chẩn đoán/nhập dữ liệu mới. Chrome xác nhận thông báo thiếu worker biến mất. Kiểm tra role production và CRM bị bỏ qua, PHP syntax/TypeScript đạt, 47 kiểm tra phiên PC đạt khi chạy ngoài sandbox (sandbox chặn rename file fixture).
- Phát hiện thêm task tunnel lại dừng với `0xC000013A` sau lượt trước; đã nối lại và bổ sung trigger tự phục hồi mỗi phút cho cùng task, `IgnoreNew` chống chạy trùng, giữ trigger khi đăng nhập. Chưa kết luận tác nhân nào gửi tín hiệu ngắt; chưa nghiệm thu qua đăng xuất/khởi động lại Windows. Không restart dịch vụ VPS.

### 07/10/2026 — Khôi phục kết nối khi chạy lại dự án, gom cảnh báo sidebar

- Chẩn đoán: local 3000/4000 có listener nhưng 9250/9340 không có; task tunnel Ready, mã kết thúc cũ `0xC000013A`. VPS Web/API/DB vẫn hoạt động. Ba thông báo người dùng thấy là các yêu cầu khác nhau cùng mất kết nối tới VPS; chưa xác định vì sao tiến trình task trước đó bị ngắt.
- `service/ensure-tunnel.cjs` + `ensure-tunnel.ps1` được gọi ở frontend predev và `dev-backend.cmd`, chỉ khi Windows dùng cấu hình loopback VPS 9340. Kiểm tra cổng và API health, mở lại task/watcher ẩn, giới hạn chờ để CRM vẫn chạy. Sửa action task hiện có sang PowerShell tuyệt đối/working directory repo và xử lý abandoned mutex trong `tunnel.ps1`. Giữ bind loopback, kiểm tra host key và mutex chống chạy trùng.
- `inbox-notice.ts`, `components/inbox-status.tsx`, `messages-layout.tsx`: một thông báo có Chi tiết thu gọn, lỗi phiên CRM có ưu tiên riêng, chỉ đưa liên kết tài khoản khi phù hợp; danh sách cũ không bị xóa khi tải lỗi. Nút Thử lại đọc lại danh sách, thẻ, kho, tìm kiếm và nối lại luồng cập nhật. `live.ts` bỏ qua phản hồi muộn của kết nối cũ, giữ cùng bộ subscriber. Không phát lại thao tác ghi.
- Proxy thẻ tách lỗi đọc không kết nối được khỏi kết quả ghi chưa xác định; thao tác ghi vẫn yêu cầu đọc lại trước khi làm tiếp. Không dùng thông báo mơ hồ “Chưa xác nhận được kết quả” cho việc chỉ tải thẻ.
- Kiểm thử: TypeScript không lỗi; 9 test inbox recovery/service routing đạt. Chrome local: chủ động ngắt đúng tunnel 40 giây (dịch vụ VPS vẫn chạy), thấy một khối cảnh báo và đủ bốn nguyên nhân trong Chi tiết; helper phục hồi task/cổng, bấm Thử lại tải được 172 hàng chat và danh mục thẻ, không còn thông báo. Ảnh trong `tooling/zalo-team/.work/sidebar-recovery/`. Không gửi tin hoặc sửa dữ liệu chat; không restart container. Chưa thử đăng xuất/đăng nhập Windows thực tế hoặc nghiệm thu lâu dài. Bản sửa UI chạy frontend local; không thay CRM production.

### 05/10/2026 — Dọn gói chuyển dữ liệu và cache VPS, giải thích dung lượng

- Người dùng yêu cầu giảm phần dư trên VPS sau khi thấy tổng 33,12 GiB so với kho 5,37 GB. Kiểm kê: archive ~5,39 GiB, backup ~5,43 GiB, gói migration ~9,86 GiB, Docker/build cache và OS. Backup blobs mã hóa dùng chung giữa các bản; 9 ZIP manifest chỉ tổng 87.635.181 byte.
- Đã xóa đúng các gói root `/opt/x3-zalo-team/{storage.tar,profiles.tar,database.jsonl,code.tar,metrics-code.tar}` đã dùng xong, dọn Docker builder cache (5,217 GB theo CLI) và apt download cache. Không prune volume/container hoặc xóa backup đang dùng. Sau dọn `df`: dùng 20.640.055.296 byte (~19,22 GiB), còn 83.208.470.528 byte (~77,49 GiB); số liệu tiếp tục thay đổi theo đồng bộ.
- Tab Server bổ sung Docker & cache build, Gói chuyển dữ liệu tạm, Hệ điều hành & phần còn lại. Docker trừ volume database/profile đã liệt kê để tránh tính hai lần; phần hệ thống là phần dư ước tính, scan lỗi hiển thị chưa có số liệu. Collector được triển khai lại; dịch vụ API/Web/DB vẫn healthy.
- Gói migration local trong tooling còn giữ, bản đang chạy/backup trên VPS còn nguyên. Khi triển khai tiếp, dọn gói upload và build cache sau khi kiểm chứng; không dùng `docker system prune --volumes`. Chưa đặt lịch tự xóa backup hoặc xóa dữ liệu người dùng.

### 05/10/2026 — Tab Server: số liệu VPS thật và lịch sử tài nguyên

- Thêm tab **Server** trong Đồng bộ & sao lưu cho quản trị viên CRM. Hiển thị CPU toàn VPS, RAM đã dùng/khả dụng, ổ đĩa đã dùng/còn trống, swap, sáu dịch vụ Zalo với RAM/giới hạn và CPU. CPU container 100% = 1 vCPU; RAM host dùng MemTotal trừ MemAvailable. Dung lượng dành riêng của filesystem được ghi riêng.
- Bộ thu thập host `service/server-metrics.py` chạy bằng systemd `x3-zalo-metrics`, lấy mẫu mỗi 30 giây, giữ tối đa 24 giờ/2.880 mẫu qua restart; dung lượng kho/backup/database/profile quét tối đa mỗi 5 phút. Lịch sử chỉ bắt đầu khi triển khai, không tạo số liệu quá khứ. Ngưỡng giao diện 80% theo dõi, 90% cao; không khẳng định cần nâng cấp chỉ từ một mẫu.
- Collector chỉ xuất snapshot numeric vào `/opt/x3-zalo-team/metrics/server.json`; API mount thư mục read-only, không mount Docker socket hoặc chạy SSH/lệnh từ request. Collector có trần RAM 128 MiB/CPU 20%, timeout subprocess. Identity CRM truyền quyền `can_monitor_server`, endpoint `server-status` kiểm tra lại quyền; không chấp nhận quyền từ body trình duyệt.
- UI tải khi mở tab, tự làm mới 30 giây khi trang đang hiển thị, có Tải lại/Thử lại; quá 90 giây hoặc lỗi kết nối đánh dấu số liệu cũ. Chuyển tab đưa nội dung về đầu trang. Thiếu số liệu hiển thị chưa có/—, không coi là 0.
- Đã triển khai collector và API trên VPS 14.225.198.183, kiểm tra Chrome local thấy 10 vCPU, 15,64 GiB RAM, 96,73 GiB ổ đĩa và sáu dịch vụ thực. Kiểm tra PHP metrics 9, Python collector 4, service boundary 21 và routing 3 đạt; TypeScript đạt. Chưa có đủ lịch sử 24 giờ tại thời điểm triển khai.

### 05/10/2026 — Xóa bản phục hồi PC thử nghiệm theo xác nhận

- Người dùng xác nhận dữ liệu đang test không cần giữ dự phòng. Đã xóa vĩnh viễn toàn bộ thư mục /opt/x3-zalo-team/recovery/local-pc-20261005 gồm ba bundle, bundles.tar và manifest kiểm tra (khoảng 1,7 GiB). Xác minh đường dẫn không còn; API VPS vẫn healthy. Kho archive/backups đang hoạt động không thuộc phạm vi lần xóa này.



### 05/10/2026 — Dọn dữ liệu kho local sau cutover VPS

- Theo yêu cầu dọn ba thư mục `storage/app/private/zalo-archive`, `zalo-backups`, `zalo-pc`: kiểm tra lại 12.520 tệp ở local và VPS khớp SHA-256 manifest chuyển dữ liệu. API VPS healthy, 9 backup ready.
- Ba bundle PC còn lại có lượt chưa có biên nhận hoặc bị interrupted, nên đã chuyển nguyên vẹn sang `/opt/x3-zalo-team/recovery/local-pc-20261005` và đối soát đủ 3.936 tệp trước khi dọn. Đây là gói phục hồi chưa nhập xong, không phải dữ liệu đã hoàn tất import.
- Đã xóa hai kho local và ba thư mục bundle PC: **16.456 tệp / 11.067.942.965 byte (~11,07 GB)**. Giữ `zalo-pc/session.json` 10.215 byte cùng heartbeat/state.lock/worker.lock để tiếp tục vận hành bridge; session disconnected. Gói tar tạm tạo cho thao tác này cũng đã xóa local.
- Không xóa database CRM, dữ liệu Zalo PC gốc, khóa/tunnel, volume Web hoặc các gói migration ở `tooling/deployment/.work/zalo-vps`. Biên bản `cleanup-result.json` tại thư mục migration. Bản hoạt động vẫn trên VPS; chưa có bản dự phòng độc lập ngoài VPS.

### 05/10/2026 — Chuyển Web, kho và backup lên VPS riêng

- Triển khai Docker Web và stack `compose.vps-local.yml` tại `/opt/x3-zalo-team`; chỉ SSH public. Giữ token/profile và owner/account ID; hai tài khoản Web kết nối lại thành công. Dừng Web local, giữ nguyên nguồn dữ liệu.
- Export/import snapshot nhất quán qua `service/migrate-data.php`, chỉ 17 bảng Zalo + identity tối thiểu. So sánh từng dòng và SHA-256 đủ 12.520 tệp; cả 7 backup cũ đọc được với khóa mã hóa cũ. Backup tự động và thao tác **Sao lưu ngay** đều tạo/verify thành công trên VPS; bản mới nhất xác minh lúc 10:31:15.
- Local `.env` chuyển kho/thẻ sang VPS; guard chặn ghi/CLI kho local. PC controls vẫn local; `ZaloTeamPcRemote` và `ZaloTeamPcBridgeController` chuyển file streaming, hash/size, quyền owner/account, resume, commit chống trùng và dọn staging sau biên nhận. Không gửi service key tới PC proxy. Bridge thử truyền 9 MiB thành công, dữ liệu thử đã dọn; chưa thử lại lượt native PC hoàn chỉnh.
- Backup nhường ưu tiên trong hàng đợi: sync không bắt đầu lượt mới khi có backup pending/running. PHP/cgroup giới hạn riêng, không dồn backup lên backend CRM. FPM chạy root master với pool www-data; CLI chạy www-data. Verify/restore cho phép tối đa 900 giây tại proxy/PHP/Nginx.
- Task **X3 Zalo VPS Tunnel** đã đăng ký sau xác nhận riêng của người dùng; script chống chạy trùng và tự nối lại. Worker vẫn xác thực qua CRM local nên cần máy/tunnel/backend local hoạt động. Chưa đổi CRM production/DNS, chưa nghiệm thu thoại VPS hoặc dự phòng ngoài máy.
- UI báo **Lưu trên VPS Zalo · Chưa có bản dự phòng độc lập**. Chrome kiểm tra được chat tháng 03/2025, ảnh kho tải thành công và backup mới. Frontend dev local được khởi động lại sau khi tiến trình dừng trong lúc kiểm tra.
- Kiểm tra: archive 172, PC session 47, PC import 32, bridge 12, service zalo 21, cold HTTP zalo 4, worker priority 4, routing Node 3 đều đạt; TypeScript đạt. Dữ liệu mới phát sinh sau cutover được giữ trên VPS; rollback phải đối soát phần chênh, không bật ghi lại snapshot cũ trực tiếp.

### 05/10/2026 — Dọn VPS 14.225.198.183 theo xác nhận người dùng

- Kiểm kê thấy cả Zalo cũ và Tiny House đang chạy; người dùng xác nhận rõ xóa cả hai sau khi được báo Tiny House có database và website hoạt động. Đã xóa ứng dụng, profile, database, backup, container/image/cache, gỡ Docker và dịch vụ/lịch chạy dự án. Giữ OS, SSH, tài khoản root.
- Đĩa dùng từ khoảng 25G còn 2.9G; phiên SSH mới hoạt động, các đường dẫn và unit dự án không còn, chỉ TCP 22 lắng nghe. Không đụng dữ liệu local hoặc production CRM khác. Chưa deploy Team mới. Xem README.SERVER.md.

### 05/10/2026 — Sửa lỗi HTTP 500 khi khởi động backend

- Xác nhận lỗi thật trên backend local: GET /api trả HTTP 500 rỗng. Nguyên nhân do callback withMiddleware gọi ZaloTeamRuntime::role() trước khi Laravel nạp config, gây Target class [config] does not exist. Đây là lỗi từ thay đổi tách runtime ngày 04/10; test trước đã bootstrap console nên không bắt được đường khởi động HTTP mới.
- Thêm EnsureCrmFrontendRequestsAreStateful: đăng ký middleware không đọc config; chỉ xét role lúc request pipeline chạy sau bootstrap. Giữ Sanctum cookie/CSRF ở combined/crm, bỏ stateful ở API dịch vụ zalo theo cơ chế service key hiện có. Không thay đổi policy P2, quyền hay dữ liệu.
- Xác minh: 14 kiểm tra cold HTTP trên combined/crm/zalo, gồm API root, auth, CSRF và chặn service key. HTTP thật cổng 4000: /api 200, /api/auth/me 401 khi chưa có phiên, /sanctum/csrf-cookie 204; CORS đúng localhost:3000. Chưa kiểm thử thao tác P2 bằng phiên người dùng, chưa deploy VPS.

### 04/10/2026 — Tách ranh giới dịch vụ Zalo, giữ đường dẫn CRM

- Người dùng chọn giữ /zalo-team. Thêm role runtime trên Laravel và Next: CRM ngừng route/worker/lịch Zalo; Zalo chỉ mở route chuyên dụng, không mở CRM/broadcasting. Local mặc định combined để giữ dữ liệu và các luồng hiện tại.
- Thêm endpoint danh tính hẹp ở CRM và middleware service key ở Zalo. Phiên trình duyệt được CRM xác nhận, worker xác nhận lại active/scope từ endpoint nội bộ; không lưu cookie, mật khẩu hoặc bảng nghiệp vụ CRM vào Zalo. Owner hash/permission thẻ giữ cùng cách tính; đổi tenant hoặc CRM không phản hồi thì từ chối lượt xử lý. Migration riêng tạo FK identity tối thiểu và bảng zt_*, chặn seed/migration CRM trên role Zalo.
- Proxy archive/tags dùng ZALO_TEAM_API_URL riêng, key chỉ ở server. Next phía CRM từ chối chạy API Zalo ở role crm. Connector và voice có địa chỉ cấu hình riêng; origin call connector chỉ cho loopback hoặc đúng địa chỉ server cấu hình. Asset prefix riêng tránh dùng lẫn build Next giữa hai VPS; sidebar không prefetch trang Zalo.
- Worker archive có mode sync/backup độc lập và vòng đời hữu hạn cho supervisor tái khởi động. Backup thay cursor có thể buffer bằng lazyById 100 dòng trong snapshot DB; không giữ toàn bộ object tệp, đọc manifest đĩa. Kiểm tra đầy đủ số byte ghi/flush manifest trước tạo ZIP. Format 2, hash, khóa mã hóa và logic khôi phục dữ liệu thiếu giữ nguyên.
- Thêm compose, Dockerfile riêng (không auto-seed), giới hạn RAM/CPU, PostgreSQL/volume riêng, mẫu Nginx giữ /zalo-team, hướng dẫn cutover/rollback. Không dùng ZIP ứng dụng thay cho migration toàn bộ metadata/profile. Trần tài nguyên là cấu hình khởi đầu, chưa sizing tải thật.
- Kiểm tra: service 29 checks (crm 5, combined 3, zalo 21, gồm HTTP middleware); archive 172; PC session 47; PC import 32; frontend service routing 2 tests; voice boundary/giả lập 3 tests; TypeScript đạt. Test dữ liệu giả lập 6.000 tin ~105,5 MiB với PHP memory_limit 96M: heap create/verify tăng 4 MiB, restore đủ tin. Compose config hợp lệ với env mẫu.
- Giới hạn: không đổi .env/kho local, không tự restart worker đang chạy, không truy cập/deploy VPS; chưa build/run stack container mới hoặc nghiệm thu UI trên topology mới. Bộ PC hiện chỉ Windows local; bridge Windows → VPS chưa triển khai trong thay đổi này. HTTP verify/restore vẫn chạy trong pool PHP riêng có giới hạn; hash index/metadata thẻ vẫn dùng RAM. Tài liệu chi tiết: tooling/zalo-team/service/README.md.

### 04/10/2026 — Ưu tiên CDN Zalo cho ảnh gần đây

- Thêm `media-source.ts`, dùng chung trong timeline merge, hook trạng thái attachment và thư viện ảnh. Chỉ ghép bản dự phòng khi đúng phiên bản/slot theo kiểm tra hiện có; giữ URL gốc/thumbnail HTTPS Web cho ảnh tối đa 15 ngày. Bản gốc/preview đã xác minh ở kho được giữ riêng trong metadata, không tải trước hai nguồn. Không suy luận rằng mọi URL dưới 15 ngày đều còn hoạt động.
- Timeline, album, thumbnail thư viện và trình xem ảnh lớn chuyển lần lượt sang nguồn còn lại khi ảnh lỗi; danh sách nguồn loại trùng và ghi nhận URL lỗi để tránh lặp. Bản lưu độc lập và badge giữ nguyên. File/video/sticker giữ chính sách cũ; bản chỉ có trong kho không lấy URL cũ đã lưu làm nguồn Web mới.
- Kiểm chứng: 11 Node checks về ưu tiên, biên 15 ngày, URL lỗi/dự phòng thiếu, ảnh cũ, bản chỉ có trong kho, sai phiên bản và phân trang; TypeScript đạt. Chrome local đã quan sát ảnh ngày 01/10 tải thành công trực tiếp từ `f2001-zpcloud.zdn.vn` trong chat và ảnh lớn. Nhánh URL lỗi kiểm tra bằng unit test; chưa cố tình làm hỏng URL thật hoặc triển khai VPS.

### 04/10/2026 — Bỏ chờ Zalo Web trước khi mở lịch sử đã lưu

- Nguyên nhân: `messages-layout.prepareSource` đợi `directory.open` rồi mới chọn hội thoại, nên tin đã nhập PC vẫn bị giữ ở “Đang mở…” nếu native chậm hoặc không còn liên hệ. Thêm `openConversationSource`: chọn chat kho ngay, giữ việc xác minh native chạy nền; liên hệ chỉ có trong danh bạ vẫn phải mở native thành công trước khi chọn.
- Bước chuẩn bị có timeout 12 giây, hủy theo đổi nguồn/account/unmount. Kết quả nền không chọn lại chat cũ. Cài đặt và bảo mật chờ kết quả chuẩn bị trước khi đọc; phản hồi đã hủy không cập nhật trạng thái. Lịch sử kho giữ phân trang và kiểm tra account/conversation hiện có, không ghi hoặc nhập lại dữ liệu.
- Kiểm tra local: 10 kiểm tra Node cho mở chat, đổi chat khi phản hồi đến muộn, account sai, lỗi kho/Web, phân trang và thư viện; TypeScript đạt. Chrome đã mở đúng hội thoại báo lỗi, thấy lịch sử 18/03/2025, chuyển qua chat khác rồi quay lại và cuộn; không còn dòng chờ “Đang mở…”. Các thao tác/cài đặt native của hội thoại này vẫn có lỗi nguồn, tách khỏi việc đọc tin trong kho. Chưa kiểm chứng VPS hoặc mọi hội thoại.

### 04/10/2026 — Sửa header popup dọn dẹp bị co

- `archive.module.css`: chặn header co trong bố cục flex của popup dọn/hoàn tác, giữ chiều cao 56px; giới hạn phần cuộn ở nội dung, giữ thanh nút phía dưới cố định.
- Kiểm tra Chrome local với danh sách 55 mục: trước sửa header chỉ còn 33px; sau sửa 56px, không đổi vị trí khi cuộn danh sách. Đã mở cả Dọn mục không còn nguồn và Các mục đã dọn, kiểm tra vị trí tiêu đề/nút đóng. Không thực hiện dọn hoặc khôi phục dữ liệu trong lượt kiểm tra này. Chưa triển khai VPS.

### 04/10/2026 — Dọn mục hết nguồn có thể hoàn tác, thu gọn các tab

- Thêm `ZaloTeamArchiveCleanup`: preview tối đa 500 mục có token mã hóa ràng buộc owner/phạm vi, hết hạn sau 10 phút. API `cleanup-apply` yêu cầu danh sách đã xem và xác nhận, kiểm tra lại dưới khóa kho + transaction; mục vừa được lưu hoặc không còn đủ điều kiện được bỏ qua. Chuyển `error ↔ dismissed`, không xóa tin/attachment metadata/tệp Zalo/blob Team. Thao tác được ghi log nội bộ; khôi phục mở lại kiểm tra PC. Không dọn tự động khi mở trang.
- Migration `000209` thêm `source_state` vào receipt PC. `pcMediaPaths` kiểm tra thêm download-store và đường dẫn gửi đi đã tồn tại; nguồn tìm thấy nhưng ngoài thư mục cho phép/giải mã hoặc đọc lỗi không được gọi là mất. Export chuyển bằng chứng từng slot vào worker sau khi nhập đủ coverage; receipt cũ không có bằng chứng không đủ điều kiện dọn. Hiện chỉ chứng nhận `missing` cho tệp tài liệu có đủ chuỗi locator đã đối chiếu; kiểu khác/locator chưa tải là unverified. Kết quả không khẳng định tệp mất trên mọi vị trí hoặc thiết bị.
- Hàng đợi tải, retry-all và auto PC bỏ qua dismissed; nguồn mới hoặc bytes đã xác minh vẫn có thể phục hồi qua importer. Bộ đếm đã dọn tách riêng, bảng ngày không chuyển giả thành hoàn tất. Tooltip tệp trong chat có trạng thái đã dọn và chỉ dẫn đưa về hàng đợi. Proof chi tiết được bỏ khỏi response UI thống kê để tránh tải payload không dùng.
- UI dùng `ArchiveCleanup`/TeamDialog và nút chung: checkbox chọn từng mục, loại gốc/preview, nguồn, ngày tin, lỗi ngay trong hộp thoại. `ArchiveFileSummary` còn ba nhóm số và nhóm nút, chi tiết lỗi thu gọn; bỏ thống kê tệp lặp trong Web progress; thiết lập Web, kết quả và lịch sử nhập PC thu gọn. Tab Lưu trữ gọn nhãn và toolbar, tab Sao lưu hiện ba bản gần nhất và Xem thêm. Không mở lại các phần đã yêu cầu ẩn.
- Kiểm chứng: 172 kiểm tra kho cô lập, 47 PC session, 32 PC import, 7 Node reader/local-file và TypeScript đạt; bao gồm owner sai, token sai/hết hạn, thiếu xác nhận, chỉ một tài khoản đã kiểm tra, chưa có bằng chứng/nguồn còn nhưng không đọc được, lỗi mạng, hash đã lưu, thành công xảy ra sau preview, replay, hoàn tác và bộ đếm ngày. Chrome local đã mở cả Đồng bộ (PC/Web), Lưu trữ, Sao lưu và hộp xem trước; không thực hiện dọn trên dữ liệu thật.
- Đã chạy kiểm tra lại nguồn đúng account PC hiện tại, kết thúc ready/hàng đợi rỗng; preview có **55 mục đủ điều kiện (40 gốc, 15 preview)** tại snapshot kiểm tra, 0 mục dismissed. Các mục khác chưa đủ điều kiện được giữ. Migration/worker chạy local; chưa triển khai VPS. Ảnh kiểm chứng riêng tư trong `.local/zalo-sync-research/cleanup-*.png`.

### 04/10/2026 — Phân biệt thử tải lại và kiểm tra nguồn hết hạn

- Truy nguyên lượt thử lại: request cũ đặt mọi mục lỗi về pending, kể cả cùng URL 404/410 và URL trống, nên số lỗi giảm tạm rồi tăng lại sau tải. Bộ lọc “all” trước đó chỉ lấy error, bỏ pending khỏi yêu cầu kiểm tra PC. Sửa `ZaloTeamArchiveRetry`: all gồm pending/error; apply chỉ đặt lại lỗi có URL và không phải 404/410, giữ nguyên bằng chứng nguồn hết hạn; receipt PC vẫn được mở lại đúng phạm vi và request chống lặp.
- `ArchiveFileSummary` đổi tên nút “Kiểm tra lại tất cả mục chưa lưu”, giải thích hai hướng xử lý và số chờ/đã kiểm tra PC là cùng tập mục thiếu, không cộng thêm vào số lỗi. Phần nguyên nhân ghi rõ chỉ gồm các mục đã tải thất bại. Không đổi mục chưa tìm thấy nguồn sang ready.
- Kiểm tra native read-only đúng tài khoản hiện tại: “Thiệp mời chung 5.pdf” và hai tin “DBMain.db” còn bản ghi; cả Core.Message/Core.Media và các locator file/fileNoise, download-store localPath/autoDownloadPath, outgoing localPath không trả bản cục bộ tồn tại. Đây là giới hạn của nguồn đã kiểm tra, không kết luận mất tệp trên mọi ổ/thiết bị, chưa xác minh được bấm tải trong ứng dụng có tạo nguồn mới hay không.
- Đã qua 148 kiểm tra kho cô lập (bổ sung 404/410, thiếu URL, pending, giữ ready và chống lặp), TypeScript và Pint. Nạp worker local dưới khóa kho tại lúc không có thao tác ghi; không khởi động lại Zalo PC. Chrome local đã thấy nút/thông báo mới. Chưa triển khai VPS; chưa giải quyết hết các tệp thiếu nguồn.
- Kiểm chứng request thật riêng bản gốc PDF: worker tự nhận hội thoại, quét và chỉ nhập lại 1 tin mục tiêu; kết thúc ready, hàng đợi rỗng, 0 tệp bổ sung. URL 404 giữ nguyên attempts=5 và không bị tải lại. Snapshot cuối: 9.474 slot đã lưu, 158 chưa lưu (74 lỗi tạm thời, 84 cần nguồn/kiểm tra); PC 105 mục đã kiểm tra chưa lưu được, 53 chờ đúng tài khoản Nguyễn Thị Ánh. Ảnh UI riêng tư: `.local/zalo-sync-research/retry-source-result.png`. Không báo đã phục hồi PDF.

### 04/10/2026 — Tự kiểm tra nguồn PC khi phục hồi tệp thiếu

- Nguyên nhân: `retry-files` trước đây chỉ đưa URL cũ vào bộ tải; `pc-prioritize` là thao tác riêng. Thêm migration `000208` và `ZaloTeamPcRecovery`: biên nhận theo owner/asset/source, ghi cùng transaction với yêu cầu thử lại. Request lặp không quét lại; receipt đã kiểm tra chỉ được mở lại bởi yêu cầu thử mới. Loại observation đã ẩn và tệp đã ready, xác minh account/external ID/catalog trước khi xếp hàng. Biên nhận vận hành không thuộc nội dung backup/restore.
- `ZaloTeamPcSession` tự nối các nguồn còn thiếu vào cuối hàng đợi, giữ ưu tiên người dùng và phiên PC hiện tại. Dừng thắng tự chạy; tiếp tục/kết nối lại giữ danh sách đúng tài khoản. Mất kết nối vẫn giữ receipt chưa kiểm tra. Không tự đổi tài khoản, không tự mở lại ứng dụng liên tục. Worker chỉ đánh dấu đã kiểm tra sau khi export đủ coverage và import kết thúc; xung đột nội dung vẫn giữ riêng, không ghi đè tin đã lưu.
- Lượt tự phục hồi dùng `recoveryIds` trong index, exporter chỉ phát các tin đang có mục tệp cần phục hồi; nhập thủ công lịch sử vẫn giữ luồng đầy đủ. Bỏ qua tin ngoài phạm vi không cộng giả vào số tin đã có. Export ghi thống kê lỗi đọc cache theo mã, không ghi đường dẫn riêng tư hay URL chứa chữ ký.
- Đối soát dữ liệu thật phát hiện bốn phiên bản của tin có tệp thiếu khác trường hồ sơ người gửi. `mediaFingerprint` bỏ biến động cảm xúc/tên/avatar khi đối chiếu tệp, vẫn giữ sender ID, định danh/thời gian, nội dung và metadata attachment. Tin khác nội dung tiếp tục lưu conflict; chỉ bổ sung bytes/liên kết khi định danh media khớp. Không thay tệp ready khác hash, không hồi sinh tin đã ẩn/thu hồi.
- UI `ArchiveFileSummary` có số chờ PC theo tài khoản, thời điểm đã kiểm tra và nút Ưu tiên hội thoại. Tách nhãn Tệp gốc/Ảnh xem trước; nếu file gốc đã lưu và còn trên ổ, nói rõ chỉ thiếu preview. Chrome local xác nhận DOCX người dùng chỉ ra thuộc trường hợp này, không phải mất bản gốc.
- Kiểm tra: 139 archive checks, 47 PC session checks, 32 PC import checks, 12 Node checks và TypeScript/Pint đạt. Bộ test bao gồm owner/account/catalog sai, request chống lặp, không quét lại receipt đã xử lý, dừng/tiếp tục, hash bytes, biến động profile/cảm xúc và không mở rộng lịch sử khi chỉ phục hồi tệp. Node/PHP contract cần chạy ngoài sandbox vì sandbox chặn PHP con.
- Lượt thật local kết thúc ở trạng thái `ready`, hàng đợi rỗng: tự xử lý 13 hội thoại, bổ sung **198 slot tệp/preview**, **0 tin mới**, đối soát đường dẫn/kích thước/SHA-256 **198/198**. Snapshot chưa lưu giảm **356 → 158**: 105 mục đã kiểm tra PC của tài khoản hiện tại nhưng chưa lưu được, 53 mục chờ PC của tài khoản khác. Các mục thiếu không bị chuyển giả sang ready. Chrome xác nhận bộ đếm 9.474 đã lưu, 53 chờ PC/105 đã kiểm tra; ảnh kiểm chứng riêng tư tại `.local/zalo-sync-research/auto-pc-recovery-result.png`.
- Đã cập nhật worker local ở điểm dừng an toàn, giữ nguyên phiên Zalo. Hai thư mục xuất trung gian bị ngắt trong lúc cập nhật được giữ lại vì kiểm tra an toàn tự động từ chối dọn, không xóa dữ liệu nguồn hoặc blob kho. Không coi tệp không tìm được trong cache là đã mất trên mọi thiết bị; chưa kiểm tra nguồn tài khoản PC khác, chưa triển khai VPS.

### 04/10/2026 — Sửa các thao tác trong chi tiết hội thoại nhập từ PC

- Nguyên nhân hồi quy: `prepareSource` bỏ qua mọi nguồn đã lưu nên chỉ timeline đọc được kho; các API hồ sơ/settings/privacy/info vẫn kiểm tra hội thoại có trong phiên Web. Bổ sung native `directory.open` cho nguồn đã lưu ngoài catalog trước khi mở chi tiết/menu, giữ kiểm tra danh bạ và account hiện hành; không nới guard native. Nếu bước mở thất bại vẫn cho đọc lịch sử đã lưu.
- `ChatProfileDialog` đọc hồ sơ từ header/tin nhắn qua phiên đã mở. Với tin nhóm đã mất khỏi Web, thử danh bạ hiện tại (vẫn kiểm tra quan hệ native); nếu không lấy được hồ sơ, hiển thị tên/avatar từ bản tin đã lưu kèm trạng thái rõ ràng và nút thử lại, không dựng giả thông tin cá nhân hoặc quyền sửa.
- `ZaloTeamArchiveDetail` và archive API thêm `search-messages`/`media-library`: nguồn được xác minh theo CRM owner + account + conversation, loại observation đã ẩn, tìm không dấu, lọc sender/ngày, cursor theo time/native ID. Kho file giữ nguyên ranh giới cả tin/album giữa các trang và URL riêng tư chỉ khi tệp đã xác minh. Không thay đổi nội dung hay trạng thái sao lưu.
- `info-api.ts` ghép kho với nguồn Web bằng cursor riêng từng nguồn; sidebar giới hạn sáu mục mỗi loại, Xem tất cả tải tiếp. Tin trùng ưu tiên tệp kho đã lưu, giữ URL live nếu bản kho chưa có tệp. `ConversationSearch` ghép theo message ID với biên phân trang chung để không bỏ sót tin giữa hai nguồn, kể cả khi chat cũ đã xuất hiện lại trong catalog Web.
- `MessageItem`/`MessageActions` mở lại menu Copy cho tin lưu trữ và giữ hiển thị cảm xúc đã lưu. Không bật thao tác thay đổi tin gốc khi chỉ có bản lưu. Sửa bộ nạp test CommonJS để đọc `import.meta.url` của file-preview và cập nhật assertion icon XLSX theo component hiện tại.
- Kiểm tra: 130 archive checks, 17 Node checks (directory, timeline, ghép search/media, trình bày tin) và TypeScript đạt; OpenAPI được tạo lại. Probe read-only trên PostgreSQL cho hội thoại mẫu: tìm từ khóa trong tin cũ trả hai kết quả, thư viện trả hai mục ảnh. Chrome local: hồ sơ có Thông tin cá nhân; sidebar không còn ba lỗi cài đặt/thông tin/bảo mật, mở được hộp Tắt thông báo và đóng mà không đổi thiết lập; tìm kiếm trả hai tin cũ; chuột phải tin lưu trữ có Copy. Không gửi tin/gọi, không sửa cài đặt thật, không tuyên bố mọi tệp nguồn cũ đã tải được hoặc mọi thao tác trên tin gốc cũ đều được Zalo hỗ trợ.

### 04/10/2026 — Hiển thị hội thoại đã đồng bộ trong danh sách chat mặc định

- Nguyên nhân: inbox chỉ lấy `conversations` từ Web; kho chỉ được tìm khi có query. Thêm API `list-conversations` dùng `ZaloTeamArchiveSearch::listing`, phân trang 50 + 1, đúng CRM owner/account và chỉ trả nguồn có observation chưa ẩn. Không lọc theo mốc thời gian Web hoặc `accessible`, nên nguồn chỉ nhập từ PC vẫn có trong danh sách.
- Hook `archive-inbox.ts` tải đầy đủ các trang, chống phản hồi cũ sau đổi account/unmount, giữ snapshot khi tải lại, tự làm mới mỗi 15 giây sau thành công để nhận hội thoại vừa nhập. Lỗi có nút thử lại. `messages-layout.tsx` ghép nguồn trước khi lọc/sắp xếp/gộp nhóm, ưu tiên thông tin live khi trùng, không tạo hai dòng cùng account/conversation. Hội thoại đã có trong kho mở qua timeline hiện có, không phụ thuộc việc mở danh bạ Web thành công.
- Bổ sung theo phản hồi: API trả preview của tin cuối chưa ẩn, tiền tố Bạn/người gửi nhóm, tên tệp hoặc loại nội dung khi không có text; timestamp dùng tin cuối thay cho thời gian catalog cũ. Avatar cá nhân lấy đúng người đối thoại, không lấy avatar người gửi tin cuối nếu đó là chính mình; nhóm có mosaic dự phòng. Danh bạ friends/groups hydrate riêng mỗi lần kết nối/tải lại, không chặn đọc kho. Dòng live thiếu preview hoặc cũ hơn kho dùng preview kho, metadata live vẫn ưu tiên.
- `archiveOnly` áp dụng cho nguồn không nằm trong catalog live: timeline đọc kho trực tiếp và phân trang bình thường; lỗi kho/identity vẫn báo lỗi, lỗi Web thật của chat live vẫn giữ cảnh báo fallback. Callback tải chat cập nhật theo nguồn live/kho khi catalog thay đổi.
- Kiểm tra: 119 archive checks pass, gồm listing không query, nguồn PC trước mốc Web, phân trang hơn 50, owner/account scope, preview tin cuối/tin bị ẩn/tệp và avatar đúng người. 5 timeline/group-link tests pass (không gọi Web cho archive-only, phân trang, lỗi kho và sai account, cảnh báo lỗi Web thật); TypeScript, PHP lint và OpenAPI pass. Dữ liệu local có 152 nguồn đã lưu, trong đó 24 nguồn trước 19/09 không nằm trong danh sách Web. Chrome với ô tìm kiếm trống đã hiển thị hội thoại cũ và tổng 154 dòng sau gộp nhóm; mở nguồn cũ có 34 tin, avatar tải thành công, preview thực và không còn cảnh báo ARCHIVE_FALLBACK.

### 04/10/2026 — Thu gọn dấu đã lưu trên ảnh/tệp

- Sửa `.archiveBadge` trong `zalo-team.module.css` theo ảnh người dùng: 16 × 16 px, icon 12 px, nền đen 50%, bo góc nhỏ, absolute góc dưới trái cách mép 4 px. Bỏ nền xanh của trạng thái ready. Giữ tooltip khi hover/focus và màu cảnh báo cho trạng thái lỗi.
- Thay đổi CSS trình bày, không thay đổi trạng thái dữ liệu hoặc tiến trình sao lưu. Đã kiểm tra hai dấu ready trong DOM Chrome ở màn tin nhắn: kích thước thực 16 × 16 px, SVG 12 px, position absolute, left/bottom 4 px, nền rgba(0,0,0,0.5). Không chạy lại bộ test đồng bộ cho thay đổi CSS này.

### 03/10/2026 — Đọc bản tệp PC còn trên máy khi liên kết cũ trả 404

- Đối chiếu build PC 26.9.10 và tệp người dùng chỉ ra: native locator trả `fileNoise`, trong khi bộ nhập cũ chỉ chọn `file` nên bỏ sót bản cache còn dùng được. 404 chỉ phản ánh liên kết tải cũ, không chứng minh tệp không còn trên PC.
- `pc/archive-reader.mjs` bổ sung candidate `fileNoise` gắn đúng account/conversation/message và checksum; dùng hàm `denoiseFile` của phiên PC đã đăng nhập để xuất vào staging riêng. `local-assets.mjs` giữ ranh giới đường dẫn dưới PC media root, kiểm tra kích thước gốc, giới hạn dung lượng, SHA-256, dọn staging kể cả khi lỗi. Không lưu envelope thô thành DOCX/ZIP, không đổi hoặc xóa cache gốc, không gọi upload/download từ Zalo.
- Giữ cơ chế đối chiếu tăng dần và blob theo hash; các slot đã xác minh vẫn được tái dùng. Thông báo 404/410 mới và UI cho dữ liệu lỗi cũ chỉ rõ liên kết hết hiệu lực, có nút kiểm tra nguồn trên PC. Các kiểu cache/đường dẫn chưa được xác minh vẫn giữ trạng thái chưa lưu.
- Kiểm thử local: 11 Node checks (native account boundary, locator, envelope staging/cleanup, size/path rejection, incremental và hợp đồng fingerprint PHP), 29 PC import, 44 PC session, 108 archive; TypeScript và OpenAPI pass. Tệp DOCX thử nghiệm đọc được toàn bộ 20 entry, có `word/document.xml`; hai ZIP đọc được toàn bộ 1.780 và 3 entry.
- Lượt thật hai hội thoại hoàn tất, bổ sung 3 + 207 = 210 slot, không thêm tin mới. Bốn tệp đối chiếu (DOCX, PDF, hai ZIP) đã lưu với hash trùng bản native, DOCX 40.828 byte. Snapshot tổng kho: ready 9.262, chưa lưu 355; riêng nhóm HTTP 404/410 còn 181. Có 958 phiên bản khác nội dung/định danh được giữ để đối chiếu theo cơ chế hiện có, không ghi đè tin đã lưu. Chrome xác nhận kết quả và liên kết tệp dùng `/api/zalo-team/archive/assets/...`; thao tác tải bằng công cụ browser bị timeout nên không ghi nhận kiểm thử tải trình duyệt thành công. Chưa triển khai VPS hoặc kiểm chứng mất kết nối PC thật giữa lượt.

### 03/10/2026 — Làm rõ đồng bộ PC, giữ hàng đợi, ưu tiên và thử lại tệp

- Theo yêu cầu mới, dừng hướng nhận điện thoại/đọc độc lập để tập trung PC qua ứng dụng trên máy. Ẩn tab Điện thoại, khối Tra cứu toàn kho, Dữ liệu được lưu ở đâu và Mốc kiểm chứng; không xóa lịch sử, tệp, mốc hoặc API. Mặc định trang Đồng bộ mở nguồn PC.
- `ZaloTeamPcSession`: thay vòng lặp danh sách chụp ban đầu bằng hàng đợi durable `remaining/current`; nhận `pc-prioritize`, đọc thứ tự mới khi xong hội thoại hiện tại, loại mục hoàn tất theo ID để không mất mục được thêm trong lúc chạy. `resume=true` giữ kết quả; reconnect cùng owner/account/external ID giữ hàng đợi, account khác không kế thừa. Dừng giữ phiên, lỗi giữ tiến độ và tên hội thoại; worker gián đoạn yêu cầu kết nối lại rõ ràng. Chờ khóa kho có pha riêng. Không tự hủy hội thoại đang ghi để nhảy ưu tiên.
- UI PC có hàng đợi/tìm kiếm/ưu tiên tiếp theo, thông báo dừng tại bước nào, nhịp worker và nút tiếp tục. Lượt nhập gián đoạn trước đây có nút Tiếp tục hội thoại này; các tệp lỗi có nguồn hội thoại và nút kiểm tra nguồn PC. Thao tác kiểm tra lại đối chiếu dữ liệu đã có, không xóa hoặc nhập đè.
- `ZaloTeamArchiveReport` trả retryDue/nextRetryAt/needsAttention. UI dùng ba nhóm không trùng: pending / retrying / failed-minus-retrying, tổng chưa lưu là pending+failed. Hiển thị tối đa 5 lần tự thử (cách 5–20 phút), lịch cụ thể, nút thử ngay/thử tất cả/từng tệp và cách xử lý theo nguyên nhân. File gốc và preview được phân biệt. Tăng số lỗi khi hàng đợi chuyển trạng thái không đồng nghĩa tổng thiếu tăng hoặc dữ liệu đã lưu bị mất.
- Thêm migration `000207` và `ZaloTeamArchiveRetry`: yêu cầu retry có ID, owner, phạm vi và biên nhận bền vững; không bị từ chối chỉ vì kho đang nhập. Worker áp dụng dưới owner lock, cùng giao dịch cập nhật yêu cầu và xếp lại tệp, không reset mục đã ready. Replay request không tạo lượt mới. Scope theo account/ngày/tệp vẫn giữ. File queue có lượt xử lý trước catalog Web và vẫn chạy khi tắt thu lịch sử Web nếu `media=true`; mất kết nối Web không chặn URL đã có.
- Chuẩn hóa heartbeat/retryAt thành ISO có múi giờ; định dạng PostgreSQL có/không offset hiển thị đúng giờ Việt Nam, không còn suy sai worker offline hoặc hiện Invalid Date.
- Kiểm tra: 44 checks PC session và 108 checks archive trong môi trường thử riêng; TypeScript đạt. Có ca ưu tiên khi đang claim, thêm mục mới lúc đang nhập, worker gián đoạn, heartbeat lúc đang export, dừng/tiếp tục, tài khoản khác, retry khi owner lock bận, idempotency, thành công đồng thời, lịch backoff, file vẫn chạy khi catalog lỗi/thu Web tắt. Chrome local kiểm tra cả ba tab, thử lại thật 27 mục; worker đã nhận. Nhập thật hai hội thoại nhỏ hoàn tất đúng ưu tiên, cùng native PID/session, 0 added/0 conflicts; bằng chứng riêng `.local/zalo-sync-research/queue-native-proof.json`.
- Đã áp dụng riêng migration mới local và nạp worker tại điểm rảnh. Không triển khai VPS; chưa diễn tập tắt ứng dụng PC hoặc mất điện thật trong lượt này (đã kiểm tra trạng thái gián đoạn tự động). Những nguồn 404/410/chưa có tệp vẫn giữ chẩn đoán đúng, không đánh dấu đã lưu hoặc hứa phục hồi 100%.

### 03/10/2026 — Tách bộ đọc database khỏi Zalo.exe: nền tảng đã kiểm chứng, chưa mở kho thật

- Người dùng yêu cầu API Team nhận account ID và chạy độc lập, không phải giao diện gọi lại Zalo PC. Luồng Web `NO_NEED_SYNC` trước đó không đáp ứng việc lấy lịch sử cũ; chưa nghiệm thu làm phương án thay PC.
- Lần theo source build PC 26.9.10: importer hiện đọc `Core.Message.getAll` qua DAL SQLite cục bộ. `fsN4`/`teaq` lấy khóa theo tài khoản (`UIN`), `X4fA` nhận khóa từ `getLoginInfo().data.dkey`; `X34b` mở database với `PRAGMA key`. Đây không phải bằng chứng có HTTP API trả toàn bộ lịch sử bằng ID.
- Đã nạp được native `sqlite3` N-API v6 của bản cài đặt bằng Node **22.14.0 win-x86** độc lập: SQLite 3.40.1 / SQLCipher 4.5.3. Node tải từ nodejs.org, đối chiếu SHA-256 với manifest phát hành. Probe không gọi Zalo.exe/CDP và không chạy controller UI. Đây là bằng chứng nạp engine, chưa phải bằng chứng đọc tin thật.
- Thêm `tooling/zalo-team/pc/standalone-store.cjs`: kiểm tra hash thư viện/build, ràng buộc account và đường dẫn snapshot, mở READONLY + query_only, báo lỗi cố định, kiểm tra toàn vẹn và thống kê schema message. Chỉ là bộ đọc thử nghiệm được gọi nội bộ; **chưa có endpoint sản phẩm hoặc bật nguồn lưu trữ mới**. Không lấy khóa, không tự đăng nhập, không migrate database.
- Kiểm tra bằng database SQLCipher tổng hợp thật có WAL chưa checkpoint: 2 tests đạt, không skip; mở đúng khóa, thống kê đúng 3 tin/2 hội thoại, lặp kết quả ổn định, SHA-256 DB/WAL nguồn và bản sao không đổi, từ chối ghi, khóa sai, account sai, traversal và file thiếu. Test runner subprocess bị sandbox EPERM; chạy file test trực tiếp bằng Node32 đạt. Không dùng nội dung người dùng làm fixture.
- Bước kiểm chứng khóa của phiên Team với kho thật **bị bộ duyệt an toàn tự động chặn** do trích khóa phiên vào tệp tạm. Chưa chạy bước đó, đã bỏ script ghi khóa tạm. Đang chờ người dùng xác nhận rõ phương án kiểm chứng chỉ trong bộ nhớ; không thử đường vòng. Chưa biết khóa phiên Web có mở được database PC không; chưa xác minh schema/tin thật, media/hidden-chat, đối soát hoặc Linux/VPS.
- Hướng tích hợp phải giữ rõ ba nguồn: Web thu tin mới với phiên Team, kho lịch sử cục bộ được mở bằng bộ đọc độc lập nếu kiểm chứng thành công, và giao thức đồng bộ điện thoại/server (chưa có bằng chứng lấy được lịch sử cũ độc lập). API bên ngoài chỉ nhận account ID nhưng host phải tra owner, account binding, phiên/khóa và nguồn hợp lệ. Không coi ID là khóa xác thực; thiếu nguồn phải báo đúng, không trả thành công rỗng.

### 03/10/2026 — Nhánh nhận từ điện thoại qua Web, có giới hạn phạm vi

- Thêm `history-sync.mjs` vào connector với `status/start/cancel`; dùng DI `Qx9e.SyncController` của đúng phiên Web đã xác thực, không export khóa/connection context. Không sửa cờ bật tính năng hoặc range do native cung cấp. Chỉ hủy native session do đúng receipt tạo; thay session/reload báo gián đoạn, `NO_NEED_SYNC` tách riêng; receipt hạn chế 20 kết quả trong browser.
- Thêm migration `000206`, service `ZaloTeamPhoneSync`, API `phone-status/start/cancel`, tab Điện thoại dùng Select/Button chung. Yêu cầu ghi DB trước khi gọi nguồn; mất phản hồi chỉ tìm lại receipt, không tự gọi start lần hai. Mutex theo owner ngăn cạnh tranh start/cancel. Worker archive xử lý dù đóng tab; nhận xong hoặc gián đoạn có thể có dữ liệu thì quét đối chiếu lại metadata theo đúng account/external ID, giữ phiên bản/tệp đã xác minh. `no_changes` không reset các trang lịch sử. Journal điều khiển phone không nhập vào backup để tránh phát lại lệnh sau restore.
- Chạy local: áp dụng migration riêng (chỉ tạo bảng job), rebuild connector giữ profile, đổi archive worker khi đã lấy khóa kho. Không di chuyển/xóa dữ liệu, không bật backup độc lập hoặc triển khai VPS. Luồng PC nhập cũ vẫn giữ.
- Kiểm chứng tự động: adapter identity/replay/cancel/không lộ khóa/no-change; 12 checks connector guards/accounts; 19 checks PHP journal/scope/mất phản hồi/đổi account/restart/no-op/sai receipt; 96 checks archive chống trùng/backup; TypeScript/Pint đạt. Gửi lại request đã hoàn tất sau restart connector giữ nguyên ID/thời điểm/kết quả, không tạo lượt thứ hai. Đổi tài khoản trên UI không giữ nhầm kết quả của tài khoản trước.
- Kiểm chứng thật: capability Duy ready; range từ 19/09/2026. Đã tắt đúng 8 tiến trình Zalo.exe, kiểm tra còn 0; yêu cầu Team trả `no_changes` trong khoảng 263 ms xử lý native, 0 batch. UI Chrome hiển thị đúng range và kết quả. Đã ngắt phiên PC chẩn đoán cũ và mở lại app bình thường. Bằng chứng metadata/screenshot trong `.local/zalo-sync-research/phone-*`, không ghi nội dung chat vào README.
- Giới hạn nghiệm thu: mới chứng minh gọi controller Web độc lập với PC và phân loại no-op thật; **chưa chứng minh nhận lịch sử/tệp cũ từ điện thoại**, không kết luận range cấu hình là giới hạn tuyệt đối của server hoặc nhận đủ mọi dữ liệu. Mục tiêu thay toàn bộ importer PC vẫn chưa hoàn tất; không đổi tên luồng thu thập Web hiện có thành “đồng bộ toàn bộ điện thoại”.

### 03/10/2026 — Giữ kết nối PC qua nhiều lượt nhập, chọn/nhập tất cả

- Nguyên nhân chính việc phải kết nối lại: worker gọi native Close ngay khi xong mỗi batch, khôi phục Zalo thường rồi bỏ catalog. Đã đổi sang ready, giữ catalog/kết quả và gia hạn 15 phút chờ; nhập tiếp tái dùng phiên, không gọi Open/Close. Kết nối lần đầu và ngắt/timeout vẫn cần chuyển giữa Zalo thường và phiên tạm. Đổi danh tính/lỗi phiên vẫn dừng an toàn, không tự kết nối lặp.
- `pc-import` hỗ trợ `all=true` lấy toàn bộ catalog đúng owner/account/session trên server; chọn riêng tối đa 20.000 ID theo giới hạn catalog, không còn trần 50. Kiểm tra lại sessionId sau khi xác minh tài khoản để tránh request cũ chạy trên phiên mới. API proxy giới hạn body 1 MiB cho danh sách chọn lớn, Swagger đã tái sinh. Không bỏ kiểm tra scope hoặc chống trùng.
- Thêm `pc-stop`: dừng batch nhưng giữ kết nối; lưu danh sách còn lại sau các hội thoại đã hoàn tất, tiếp tục bằng cùng luồng nhập chống trùng. `pc-disconnect` riêng cho ngắt hoàn toàn. Thông báo dừng là trạng thái trung tính, không báo lỗi. Gói xuất bị dừng giữ để đối chiếu như trước, không xóa phần đã commit.
- Guard native có sessionId và mutex Open/Close: guard cũ không đóng phiên mới, hai lần close không mở lại Zalo hai lần. Lease gia hạn bằng ghi tệp tạm/rename mỗi 5 giây thay vì ghi lại liên tục mỗi vòng tiến trình. Kết thúc batch gia hạn lease để nhập tiếp; không mở cổng ra ngoài loopback.
- UI: chọn tất cả/chọn kết quả tìm kiếm/nhập tất cả, hiển thị danh sách theo 100 dòng với Xem thêm nhưng lựa chọn vẫn áp dụng toàn catalog; thanh tiến độ số hội thoại, nút dừng và tiếp tục phần còn lại. Bỏ nháy form “Chưa kết nối” lúc tải trạng thái ban đầu; bỏ qua response polling cũ khi lệnh mới đang chạy.
- Kiểm chứng: **29 PC session checks, 29 PC import checks, 3 native guard checks với tiến trình giả lập**, TypeScript/Pint/syntax PowerShell đạt. Test all dùng catalog 65 hội thoại để xác minh vượt trần 50 và bỏ ID không thuộc catalog do client gửi kèm all. Test scope owner, hết hạn, stop/continue và close không lặp đạt.
- Local thật: giữ tiến trình Zalo sẵn có khi thay worker/guard; hai batch liên tiếp trên hai nguồn đã nhập giữ nguyên PID/sessionId, số observation không đổi. Sau đó dừng một batch và tiếp tục thành công, vẫn cùng PID/sessionId. Chrome chọn được 752/752, nút Nhập tất cả hoạt động, phiên vẫn ready sau lượt nhập. **Chưa chạy nhập hết 752 hội thoại**; kiểm chứng thực tế dùng phạm vi nhỏ đã có trong kho, không tuyên bố toàn bộ catalog đã đồng bộ. Bằng chứng `.local/zalo-sync-research/pc-batch-session-verification.json`, `pc-stop-resume-verification.json`, `pc-batch-ready.png`. Chưa triển khai VPS.

### 03/10/2026 — Làm rõ thông báo lịch sử PC và tệp chưa lấy được

- `ArchiveFileSummary` dùng thông báo xanh nhạt luôn hiển thị, tách lỗi tệp khỏi tiến độ đọc tin; giữ nguyên số lượng và nguyên nhân ở phần mở rộng. Không khẳng định tệp chắc chắn còn trên thiết bị khác. Đổi nhãn “tệp lỗi” sang “tệp chưa lấy được” ở bảng ngày/tra cứu; hành động tải lại và lịch retry giữ nguyên.
- `ArchivePcImports` và kết quả trong `ArchivePcSync` chỉ báo đã nhập xong lịch sử đọc được trên PC khi state ready, coverage complete và không skipped; ghi rõ phạm vi từng lượt nhập. Các lượt còn xung đột, gián đoạn hoặc bản ghi chưa đọc được không nhận nhãn hoàn tất này.
- Kiểm tra local: TypeScript đạt; Chrome đã thấy thông báo mặc định thu gọn chi tiết, bố cục không chồng chữ và nhãn PC đầy đủ ở các lượt ready. Các lượt conflicts vẫn “Cần đối chiếu”. Không thay đổi dữ liệu hoặc cơ chế đồng bộ/tải tệp; chưa triển khai VPS. Ảnh kiểm tra tại `.local/zalo-sync-research/archive-status-notice.png`.

### 03/10/2026 — Phục hồi media lỗi và sửa bộ nhập PC

- Đối chiếu 2.003 mục lỗi người dùng báo: 981 thiếu nguồn PC đều là sticker bị thiếu URL trong phép chiếu; các adapter cache trước đó chưa đọc video/voice/videoThumb. Bổ sung `pc/sticker-sources.mjs` vào exporter bằng manager sticker native đã đăng nhập, xác minh account, dùng catId/id từ chính tin nhắn, cache kết quả và giới hạn thời gian. Thiếu adapter sticker không làm mất lượt nhập văn bản; đổi danh tính vẫn dừng. `archive-reader.mjs` đọc thêm video/voice và phân biệt gốc/thumbnail.
- `ZaloTeamArchiveFiles` từ chối URL rỗng trước bước tái dùng blob theo URL; lỗi thiếu nguồn PC không giả thành lỗi mạng có thể tự thử. Preview ảnh chỉ dùng lại gốc của đúng owner/tin/attachment, kiểm tra MIME/kích thước/SHA-256; không dùng preview thay tệp gốc. Lỗi nguồn không còn hứa “Sẽ thử lại sau” khi đã hết lượt thử; lịch retry hiển thị theo trạng thái thực tế.
- Trước sửa dữ liệu: snapshot AES-256 chứa metadata 2.003 asset và 1.840 observation/content trong `.local/zalo-sync-research/media-recovery-20261003-133428/before.zip`. Bảo trì giữ khóa owner, xác minh native ID/time/client ID/account trước ghép nguồn, chỉ chấp nhận cache trong media root đã cấu hình. Đã quét nguồn PC tương ứng, tải có giới hạn, tận dụng blob/ảnh gốc đã lưu. 105 thumbnail video được tạo offline bằng FFmpeg trong container không mạng, mount kho blob chỉ đọc; đây là preview dẫn xuất, không thay video gốc và chưa phải worker tạo thumbnail tự động cho mọi lần nhập.
- Kết quả đối soát riêng snapshot: **1.658 slot đã phục hồi**, SHA-256/kích thước **746 blob** được xác minh, **1.840 nội dung tin/observation không đổi**. Còn **345 slot = 308 gốc + 37 preview**; 247 nguồn HTTP 404, 97 DNS/timeout/HTTP 5xx, 1 sticker legacy có ID nhưng thiếu category nên không tự đoán ghép. Những slot này chưa có nội dung đọc được từ URL/cache PC đã kiểm tra; không xóa lỗi, không đánh dấu ready để đạt 100%. Tổng ready có thể tiếp tục tăng do worker nhận tin mới, không dùng tổng đó làm số phục hồi của snapshot.
- Dấu vết bảo trì: `targets.json`, `resolved.json`, `video-preview-jobs.json`, `video-preview-results.json`, `verified.json`, `final-state.json` ở thư mục recovery local trên; chứa tham chiếu riêng tư, không đưa vào repo/public. Kho tệp vẫn theo `zalo_team.archive_path`, không chuyển vị trí.
- Kiểm tra: **96 archive checks, 29 PC import checks, 12 Node tests** đạt; Pint đạt. Có kiểm tra URL rỗng không ghép nhầm blob, hash gốc hỏng không tái dùng, video/voice đúng vai trò và account, nhập lặp/slot thiếu, sticker optional adapter và account đổi. Đã nạp bản sửa bằng thay worker archive dưới khóa owner, khôi phục thiết lập enabled cũ; PC đã disconnected và cổng chẩn đoán 9333 đóng. Đã kiểm chứng DB/tệp thật local; chưa nghiệm thu lại toàn bộ preview trên Chrome và chưa triển khai VPS. Muốn phục hồi phần còn thiếu cần nguồn còn đọc được hoặc bản từ điện thoại/máy khác; chưa kết luận tất cả 345 mục mất vĩnh viễn.

### 03/10/2026 — API tìm kiếm danh bạ ngoài inbox

- Bổ sung command `directory: {kind: 'search', query, offset}` qua API Web hiện có và connector; allowlist/validation đồng bộ hai phía. Tìm toàn bộ danh bạ bạn bè và nhóm đã tham gia trong phiên native, không lấy tập người từ inbox; khớp tên hiển thị/tên Zalo có hoặc không dấu. Loại nguồn ẩn, giữ kiểm tra CRM owner/tài khoản/danh tính phiên; phân trang 50 kết quả/tài khoản, trả `nextOffset`/`total`, tìm kiếm không mở hoặc gửi tin.
- `directory-search.ts` gọi theo tài khoản đang lọc (hoặc tất cả), debounce/hủy request cũ, giữ kết quả thành công khi một tài khoản lỗi, thử lại riêng nguồn lỗi và Xem thêm. `messages-layout.tsx` gộp Web/danh bạ/kho theo account+conversation, giữ nhóm liên kết/bộ lọc; mở liên hệ ngoài inbox qua `directory.open` có kiểm tra danh tính rồi mới chọn chat/menu.
- Đã build/recreate riêng connector Web local, giữ volume/profile; API thực tế hai tài khoản hoạt động. Từ khóa `nguyen`: Duy 61 kết quả, trang đầu có 44 ngoài inbox; Ánh 42 kết quả, có 35 ngoài inbox. Chrome: liên hệ bạn bè ngoài inbox hiện đúng tài khoản Duy và mở được khung chat qua native, chưa có tin trong nguồn/kho thì hiển thị trạng thái rỗng đúng. Bộ lọc Ánh không lẫn kết quả Duy; Xem thêm tải được trang danh bạ kế tiếp và hết trang thì ẩn nút. Không gửi tin thử.
- Kiểm tra: TypeScript đạt; 10 test connector/directory/account đạt, gồm tìm bạn ngoài inbox, bỏ dấu, loại nguồn ẩn, scope danh tính, phân trang không lặp và mở liên hệ qua native. Chưa triển khai VPS hoặc thay đổi luồng nhập PC/sao lưu.

### 03/10/2026 — Sửa tìm kiếm inbox bỏ sót hội thoại nhập PC

- Nguyên nhân: `messages-layout.tsx` chỉ lọc mảng hội thoại Web đã tải, nên nguồn chỉ có trong kho không thể xuất hiện dù nhập PC thành công.
- Thêm lệnh chỉ đọc `search-conversations` và `ZaloTeamArchiveSearch`: tìm metadata nguồn có tin còn hiển thị, scope theo CRM owner/account, tên có/không dấu; 50 kết quả/trang với `nextOffset`. Không tải nội dung/tệp và không gọi đồng bộ lại.
- Frontend debounce 250 ms, hủy kết quả cũ khi đổi từ khóa/account, phân trang có nút Xem thêm, giữ kết quả Web khi kho lỗi và cho thử lại. Ưu tiên dòng Web khi trùng ID, giữ bộ lọc thẻ/chưa đọc và liên kết nhóm; lưu lựa chọn để xóa từ khóa vẫn mở được chat. Dùng timeline Web + kho sẵn có.
- Kiểm tra local: 92 archive checks đạt (có tìm có/không dấu, scope owner/account, literal wildcard, 52 kết quả qua hai trang, nguồn chỉ còn tin bị ẩn); TypeScript đạt, Swagger tái sinh. Chrome: tìm tên không dấu ra đúng nguồn PC theo account, bấm mở hiển thị lịch sử tháng 4–6/2026; xóa từ khóa vẫn giữ chat và lịch sử. Không gửi tin thử, không thay đổi kho/worker, chưa triển khai VPS. Hành vi tìm toàn bộ nguồn là mở rộng của Team, chưa tuyên bố tìm toàn bộ danh bạ Zalo.

### 03/10/2026 — Làm rõ bộ đếm 1.987 mục lỗi

- Đối chiếu snapshot read-only lúc 19:37:05 giờ Việt Nam: 1.986 error, 1 pending, 7.115 ready. 1.986 lỗi cũ gồm 965 sticker thiếu nguồn PC, 914 HTTP 404 và 107 DNS/timeout/5xx; 1.405 slot gốc, 581 preview. Không có lỗi thuộc phiên bản đã nghỉ trong snapshot này. So bản D0 chỉ có thêm một video (gốc pending, preview ready) của BAN TRUYỀN THÔNG HƯNG NGHĨA; chưa có bằng chứng lịch sử đủ để gán chắc lần đếm 1.987 người dùng thấy cho một lần chuyển trạng thái cụ thể.
- Đợt D0/D1/D2 trước giữ an toàn/chống trùng, chưa khôi phục nhóm media thiếu này. Không diễn giải 1.986 slot là 1.986 tin mất hoặc toàn bộ tệp vật lý độc lập. 49 mục error vẫn còn lượt tự retry, trước đây UI chỉ đếm state=pending nên dòng “0 đang chờ” dễ hiểu nhầm.
- Snapshot tiếp theo 19:38:28 đã quan sát trực tiếp 1.987 error: video mới chuyển pending → error với lỗi xử lý chung, preview vẫn ready. Tổng 1.406 gốc + 581 preview; 50 mục error còn lượt retry. Video gốc 45.398.606 byte, dưới giới hạn 250 MiB. Bổ sung chẩn đoán chỉ ghi lớp exception/mã lỗi/cURL, không log exception text hoặc signed URL.
- Đã tải lại đúng video mới dưới khóa owner: thành công, state=ready, 45.398.606 byte. Lượt thành công không tái hiện exception trước đó nên chưa khẳng định nguyên nhân lỗi đầu tiên. Không retry toàn bộ 1.986 mục cũ hoặc xóa trạng thái để làm giảm số đếm.
- Lúc 19:40:28, kho đồng thời nhận thêm dữ liệu hội thoại Nguyễn Duy Anh: thêm 16 slot thiếu nguồn PC và 1 HTTP 404. Tổng lúc này 2.003 error = 981 thiếu nguồn PC + 915 HTTP 404 + 107 mạng/máy chủ; 1.422 gốc + 581 preview, còn 11 error có lượt tự retry, 0 pending. Video 45 MB đã ready. Số tổng có thể tăng khi nhập thêm phạm vi mới; báo cáo so với mốc D0 nằm tại `.local/zalo-sync-research/current-errors-report.json`.
- Thêm `fileSummary` cùng một truy vấn aggregate theo owner: ready/pending/error, retry còn lịch, lỗi slot gốc/preview và nhóm nguyên nhân. Giao diện Đồng bộ/Lưu trữ dùng “mục chưa lưu”, có chi tiết nguồn PC chưa có/HTTP 404–410/mạng/mới liên kết/khác; không xóa lỗi hoặc giả báo đã lưu. Đây là sửa hiển thị và phân loại, chưa phải phục hồi tệp.
- Kiểm tra: bộ archive 81 checks (thêm chia gốc/preview, retry và phạm vi owner), TypeScript; đối chiếu snapshot dữ liệu thật. Không đổi dữ liệu kho, retry hàng loạt hoặc khởi động lại Zalo PC.

### 03/10/2026 — D0 và đợt đầu D1/D2: bảo toàn, phiên bản và nhập phần thiếu

- Người dùng duyệt phương án và yêu cầu bắt đầu triển khai; chọn **chốt nơi dự phòng sau, triển khai local trước**. Không bật trạng thái bảo vệ ngoài máy và không triển khai VPS.
- D0: `tooling/zalo-team/archive-inventory.php`, `archive-baseline.php` xuất full PostgreSQL 17.10 theo snapshot REPEATABLE READ được chia sẻ với `pg_dump`, mã hóa database/manifest/blob. `.local/zalo-preservation-20261003-d0/baseline.zip`: 2.144.699.168 byte, 66 bảng, 5.641 blob duy nhất. Đã giải mã/đối chiếu hash toàn bộ và phục hồi database mới `zt_drill_6616887c86a63f8f`; mọi bảng khớp hash và mọi tham chiếu ready có bytes trong snapshot. Không dùng dữ liệu từ máy nguồn để thay thế phần thiếu khi kiểm tra. Đây là bản local cùng máy; chưa phải offsite, chưa kiểm tra đầy đủ UI trên máy trống.
- D1 đợt đầu: migration `000205_create_zalo_archive_versions` chỉ thêm bảng; `ZaloTeamArchiveVersions` giữ payload bất biến theo nguồn/native ID, giữ xung đột và phiên bản trước khi đổi quan sát. Diễn tập trên DB phục hồi: 65 bảng dữ liệu cũ không đổi; backfill 34.963 dòng, lặp lại thêm 0. Áp dụng local dưới khóa owner: sáu bảng sources/messages/observations/assets/checkpoints/imports giữ nguyên hash. Không sửa lại ID hàng loạt. Nội dung/tệp cũ khi relink hoặc sửa projection được giữ để phục hồi; chat và số tin logic dựa trên observations hiện hành. Còn cần chính sách thứ tự phiên bản, hợp nhất danh tính Web/PC và đối chiếu xung đột đầy đủ trước khi công nhận D1 hoàn tất.
- D2 đợt đầu: `ZaloTeamPcIndex` + `pc/incremental.mjs` tạo chỉ mục riêng account/hội thoại, so fingerprint nội dung/trạng thái; kiểm tra SHA-256 các tệp đã lưu trước khi bỏ qua. `export-history.mjs` vẫn đọc metadata toàn phạm vi để không bỏ lịch sử cũ vừa xuất hiện; chỉ xuất các tin mới/khác/còn thiếu tệp và không sao chép lại slot đã xác minh. Không tuyên bố có native seek/cursor tăng dần; chưa tiếp tục được giữa các trang của một export bị ngắt. Importer tiếp tục theo batch đã commit, kiểm tra lại bytes khi chạy lại job cũ, không đè blob nguyên vẹn khác hash, giữ phiên bản PC khác nội dung ở trạng thái cần đối chiếu.
- Web: chỉ nhận trang hợp lệ; ghi trang/phiên bản/checkpoint cùng transaction. Tiêm lỗi ngay lúc ghi checkpoint xác nhận tin, observation và version cùng rollback; chạy lại không trùng. Chưa có journal/ack bền vững từ giao thức live hoặc khóa nhiều máy; vẫn phải nghiệm thu các gate còn lại trong D2.
- Tệp/backup: kiểm tra hash khi tái dùng blob; có thể thay blob hỏng bằng nội dung đúng hash. Backup lấy danh sách blob từ chính snapshot metadata, thêm bảng versions; restore kiểm tra bytes/hash trước khi đổi tên tệp. Bản sao lưu ứng dụng vẫn chưa đủ thay thế kế hoạch full CRM DR/quyền/thẻ/key rotation.
- Giao diện: nút PC đổi thành “Đồng bộ phần còn thiếu”; kết quả tách số tin không đổi đã bỏ qua và tệp bổ sung; hiển thị rõ “Quét đối chiếu”. Tab sao lưu ghi rõ chưa cấu hình nơi dự phòng độc lập. Chưa nghiệm thu giao diện và lượt PC live sau sửa; không khởi động lại Zalo PC trong đợt này.
- Kiểm tra: 77 archive checks, 29 PC importer checks, 8 Node projection/incremental checks; TypeScript và Node syntax đạt. Có fixture 500 → lặp 500 → thêm 10 tin có ngày cũ thành 510; tệp bị sửa bytes cùng kích thước phải được phát hiện/phục hồi, không tăng tin; xung đột được giữ. Các test chỉ dùng SQLite RAM/thư mục tạm, không tiêm lỗi vào kho thật.
- Worker local đã nạp lại sau khi tạm ngừng nhận lượt mới và giữ khóa kho; khôi phục thiết lập enabled ban đầu. Không dừng lượt sao lưu đang chạy, không khởi động lại database hoặc ứng dụng Zalo PC. Mốc 19/09 kiểm tra sau nâng cấp: 448 tin, 77 tệp, 28.685.320 byte, không thiếu/đổi tin hoặc tệp.
- Bằng chứng riêng tư: `verification.json`, `restore-check.json`, `migration-rehearsal.json`, `local-upgrade.json` trong `.local/zalo-preservation-20261003-d0/`. Không đưa ZIP/payload/khóa vào Git. Các script bảo toàn local cần PHP pgsql/zip và Docker local; chỉ nhận DB local, restore luôn tạo DB tên ngẫu nhiên, không tự trỏ ứng dụng vào bản phục hồi.
- Tiếp theo: hoàn thiện D1/D2 còn thiếu (thứ tự sự kiện/recall, đối chiếu nguồn và xung đột, checkpoint/export PC, phân loại tệp và số liệu chính xác), rồi full backup/restore ứng dụng và quan sát D3/D4. D5 72 giờ chưa bắt đầu; không coi test tự động là nghiệm thu nguồn live/production.

### Phương án củng cố dữ liệu — đã duyệt ngày 03/10/2026, đang triển khai theo giai đoạn

#### 1. Phạm vi và định nghĩa nghiệm thu

- **Thu thập:** lấy những gì phiên Zalo được cấp quyền còn trả về; Web thu thập mới/bù lịch sử, PC bổ sung lịch sử cũ. Chưa cam kết đọc trực tiếp điện thoại hoặc nhập ngược kho Team vào ứng dụng Zalo.
- **Kho Team:** giữ nội dung, lịch sử phiên bản và tệp để mở chat khi Zalo không còn cung cấp chúng. Không phụ thuộc URL CDN còn hạn.
- **Sao lưu dự phòng:** bản độc lập của database, tệp và thông tin cần phục hồi. Có file ZIP hoặc hash khớp chưa đủ để công nhận đã phục hồi được toàn hệ thống.
- **Đối chiếu:** chứng minh phạm vi account/hội thoại/thời gian đã kiểm tra và phần thiếu. Không dùng hết phân trang hoặc số tin bằng nhau làm bằng chứng đã có toàn bộ lịch sử Zalo.
- Cam kết đề xuất: không mất dữ liệu đã xác nhận bảo vệ khi một máy/ổ lưu trữ hỏng, trong phạm vi đã kiểm thử. Không thể bảo đảm thu thập dữ liệu Zalo đã xóa trước khi Team đọc được hoặc tệp không còn nguồn nào trả về.

#### 2. Các khoảng trống đã thấy trong bản hiện tại

- Thu thập mới hiện dựa trên polling/cursor; chưa có hàng đợi sự kiện bền vững và bằng chứng độ trễ/không bỏ sót dưới tải.
- Đã có chống nhập trùng theo nguồn/native ID và dùng chung blob theo hash; bộ kiểm thử PC cô lập đã qua 19 kiểm tra, gồm nhập lại và tiếp tục job. Tuy nhiên PC hiện vẫn xuất/quét lại lịch sử rồi lọc khi nhập, chưa có cơ chế đọc tăng dần bền vững giữa các lượt. Web có cursor/bù lịch sử và đọc chồng một khoảng gần nhất. Không đồng nhất “không lưu trùng” với “không đọc/tải lại”.
- Snapshot kiểm tra lúc 19:00:37 ngày 03/10 có 965 sticker PC thiếu tài nguyên; 914 mục nguồn trả 404; các lỗi còn lại chủ yếu DNS/timeout/5xx. Đây là snapshot, không phải thống kê hiện thời.
- Số lỗi UI trộn tệp gốc và preview; trạng thái nguồn lỗi, chưa hỗ trợ loại dữ liệu và tiến trình nhập thành công chưa được tách đủ rõ.
- Khóa định danh kho hiện bao gồm nội dung/clientId/thời gian; khác biệt projection Web/PC cần được quản lý như phiên bản có nguồn gốc, không kết luận là hai tin độc lập hoặc âm thầm bỏ qua.
- Backup có JSONL mã hóa, blob theo hash và verify. Restore hiện chỉ nhập các bảng archive trong TABLES; tags/assignments được export nhưng chưa có nhánh khôi phục tương ứng. User/tenant, mapping nhóm và quyền CRM phải có kế hoạch khôi phục đầy đủ.
- Chưa có diễn tập máy trống, offsite đã xác minh, xoay khóa backup, hoặc kiểm chứng snapshot nhất quán khi nhiều đường ghi đồng thời. Khóa file local không phải cơ chế phối hợp nhiều máy.

#### 3. Hợp đồng dữ liệu bắt buộc

- Mỗi lần đọc lưu source, account, conversation, native message ID, client ID nếu có, giờ nguồn/giờ nhận, phiên bản adapter, batch/cursor và payload cần thiết để tái chuẩn hóa. Không đưa cookie, khóa đăng nhập hoặc token vào log/backup nội dung. Payload riêng tư có quyền đọc và thời hạn lưu được xác định.
- Tách định danh ổn định, phiên bản nội dung và quan sát theo account. Không suy ra cùng tin chỉ từ text, tên nhóm hoặc timestamp; không ghép nhóm chỉ theo tên. ID khác giữa Web/PC phải có bằng chứng liên kết hoặc đưa vào danh sách cần đối chiếu.
- Cùng nhóm trên 5 account: dùng chung nội dung đã xác minh và blob theo SHA-256 trong cùng phạm vi dữ liệu được phép; vẫn giữ 5 quan sát/quyền truy cập độc lập. Account tham gia muộn không tự nhận quyền xem lịch sử account khác.
- Ghi nhận trang/sự kiện và checkpoint trong giao dịch có thể phát lại; chỉ tiến cursor sau commit. Retry nhiều lần không tăng số tin logic. Sự kiện đến sai thứ tự không ghi đè phiên bản mới bằng dữ liệu cũ.
- Tệp: tải vào vùng tạm → kiểm tra bytes/kích thước/MIME → hash → ghi bền vững/đổi tên nguyên tử trên cùng volume → xác nhận metadata ready. Có đối soát tệp mồ côi và metadata trỏ tệp thiếu sau crash. Preview không được coi là bản gốc.
- Lưu sticker ID/category/version và tài nguyên có thể render; album giữ thứ tự và mọi attachment. Chuyển JXL sang preview phải giữ bản gốc và đánh dấu file dẫn xuất. URL mới cập nhật nguồn tải, không đổi danh tính tin.
- Giới hạn, mã hóa, cache thiếu, nguồn hết hạn và lỗi tạm thời là các trạng thái khác nhau. Tải thử lại có backoff, giới hạn lượt/đồng thời, timeout và kiểm tra URL/redirect/DNS/IP; không lặp vô hạn với nguồn chắc chắn không còn.
- Không xóa kho do nguồn trả trang rỗng, tài khoản offline hoặc tin vắng trong một lần quét. Thu hồi/xóa được ghi như trạng thái có nguồn gốc; restore không làm tin đã ẩn/xóa xuất hiện trở lại. Chính sách giữ/xóa nội dung cũ cần chốt trước production; chưa tự purge trong quá trình củng cố.

#### 4. Đồng bộ tăng dần — chỉ bổ sung phần mới, thiếu hoặc thay đổi

- **Lần đầu:** lập phạm vi account/hội thoại/nguồn, nhập lịch sử còn đọc được, lưu tập ID và vùng thời gian đã kiểm tra. Checkpoint riêng cho Web và PC; không lấy ngày mới nhất trong kho làm mốc duy nhất vì PC có thể bổ sung tin cũ hơn Web.
- **Các lần sau:** ưu tiên đọc từ checkpoint nguồn và một khoảng chồng có giới hạn để nhận tin đến muộn. Tin đã lưu và không đổi được bỏ qua khi ghi; tin mới được thêm; nội dung/trạng thái thay đổi được ghi phiên bản theo quy tắc đối chiếu; không nhân đôi tin logic.
- **Tệp thiếu chạy riêng:** tin đã lưu nhưng attachment chưa đủ vẫn được xử lý lại khi có nguồn mới hoặc đến lịch retry. Tệp đã lưu và xác minh còn nguyên được tái sử dụng; URL đổi không tạo bản mới. Nếu chưa biết hash/định danh đáng tin cậy, có thể phải tải để xác định trùng; không hứa loại bỏ mọi lượt tải mạng. Blob trùng chỉ giữ một bản lâu dài trong phạm vi được phép.
- **Checkpoint an toàn:** lưu theo account/hội thoại/nguồn/phiên bản adapter, chỉ cập nhật cùng hoặc sau giao dịch dữ liệu thành công. Tách tiến độ đọc tin, bù lịch sử và hàng đợi tệp; tin đã ghi nhưng tệp chưa tải phải hiện còn thiếu. Dừng giữa chừng tiếp tục từ phần đã commit; bấm nhiều lần được gộp/khóa job, không chạy chồng tự do.
- **Không bỏ sót lịch sử cũ:** thay đổi/thu hồi/cảm xúc ở tin cũ, lịch sử vừa được PC đồng bộ từ điện thoại, hoặc quyền truy cập nguồn mở rộng không thể chỉ phát hiện bằng timestamp mới nhất. Dùng nguồn thay đổi nếu có, đối soát định kỳ và quét bù các khoảng chưa kiểm chứng. Nếu nguồn không cung cấp dấu thay đổi đủ tin cậy, công khai giới hạn và có lượt quét đối chiếu đầy đủ; không báo mọi thay đổi cũ đã được thu thập.
- **Khả năng đọc PC phải được kiểm chứng:** nếu native hỗ trợ seek/cursor ổn định thì dùng để giảm trang đọc và dữ liệu xuất. Nếu không hỗ trợ, vẫn quét đối chiếu và bỏ qua phần đã lưu, báo đúng chế độ; không đặt nhãn “chỉ đọc tin mới”. Thay account/nguồn/schema hoặc cursor hết hiệu lực phải xác minh lại và quét bù an toàn, không nhảy qua dữ liệu.
- **Hai thao tác:** “Đồng bộ phần còn thiếu” là mặc định; “Quét đối chiếu toàn bộ” dùng khi cần kiểm tra lại phạm vi, sửa khoảng thiếu hoặc nguồn thay đổi. Cả hai đều không xóa bản lưu vì nguồn trả thiếu và không tạo thêm tin chỉ do quét lại.
- **Kết quả mỗi lượt:** số đã đọc, tin mới, tin cập nhật, tin đã có, tệp bổ sung, tệp còn thiếu và xung đột; kèm phạm vi/ngày nguồn đã kiểm tra, thời điểm và thời lượng. “Không có dữ liệu mới” chỉ áp dụng trong phạm vi đã kiểm tra thành công.
- **Ví dụ nghiệm thu Hoà Ads (fixture):** kho có 500 tin, đồng bộ lại không đổi → 500 tin, thêm 0; nguồn có thêm 10 → 510 tin; tệp thiếu của tin cũ tải được → thêm tệp, số tin vẫn 510; một tin cũ đổi trạng thái → cập nhật đúng tin và lịch sử phiên bản, số tin vẫn 510. Xung đột danh tính được giữ riêng để đối chiếu, không tự ghi đè hoặc gộp bằng nội dung.

#### 5. Bảo vệ và phục hồi

- Lưu kho vận hành ngoài public/Git/build; đường dẫn dự án chỉ là cấu hình local. Có database và media volume riêng với dung lượng/ACL/monitoring rõ ràng.
- Dự phòng độc lập máy chính, mã hóa, giữ phiên bản và chống xóa từ credential máy ứng dụng. Bản trên cùng ổ không được hiển thị là đã bảo vệ khỏi mất máy.
- Snapshot phải có thời điểm/giao dịch nhất quán, phiên bản schema, manifest mọi blob/hash/kích thước, identity/quyền/mapping/thẻ và cấu hình cần phục hồi. Chỉ đánh dấu backup hoàn tất sau khi đủ mọi thành phần trong manifest và verify; thiếu một blob phải báo bản chưa đầy đủ.
- DB production: dùng công cụ backup đã có kiểm chứng với base backup + WAL/PITR theo đúng phiên bản PostgreSQL; blob bất biến được sao chép và giữ ít nhất toàn bộ cửa sổ phục hồi DB. Công cụ ZIP xuất dữ liệu ứng dụng vẫn dùng cho nhập/xuất, không thay thế kế hoạch khôi phục toàn CRM.
- Khóa backup riêng có key ID/version, bản giữ độc lập; thử đọc bản cũ sau xoay khóa. Không thay APP_KEY rồi mặc nhiên coi mọi backup cũ còn đọc được.
- UI phân biệt **Đã lưu tại Team** và **Đã bảo vệ đến thời điểm ...**. Chỉ trạng thái sau mới xác nhận DB/manifest/blob cần thiết đã có ở nơi dự phòng và kiểm tra được. Đứt kết nối dự phòng vẫn thu thập local, nhưng phải hiển thị phần chưa được bảo vệ.
- Mục tiêu đề xuất, chưa phải kết quả đo: độ trễ thu thập p95 ≤ 60 giây trong bộ tải đã chốt; cập nhật bản dự phòng ≤ 5 phút khi nguồn/hạ tầng bình thường; phục hồi kho quy mô hiện tại ≤ 60 phút. Dữ liệu chỉ mới lưu local còn chịu khoảng mất dữ liệu đó nếu mất máy. Nếu cần RPO=0 trước khi báo bảo vệ, phải xác nhận bản ghi và tệp ở nơi độc lập trước khi nâng trạng thái, chấp nhận chờ khi nơi dự phòng lỗi.
- Retention đề xuất: snapshot ngày 30 ngày, tuần 12 tuần, tháng 12 tháng; lịch sử kho không tự hết hạn theo cửa sổ Zalo. Chưa bật xóa tự động; phải kiểm tra quan hệ snapshot/blob, dung lượng và khả năng phục hồi trước khi áp dụng chính sách.
- Restore luôn chạy preflight/dry-run, phục hồi thử vào DB/volume riêng, xác minh rồi mới chuyển sang dùng; worker của môi trường phục hồi mặc định tắt và không kết nối/gửi lệnh tới Zalo. Giữ kho cũ để rollback.

#### 6. Giao diện đề xuất

- **Tổng quan:** tài khoản đang thu thập, khoảng ngày đã đối chiếu, thời điểm bảo vệ gần nhất và mục cần xử lý.
- **Lịch sử đã lưu:** ngày → hội thoại → account, tin/attachment gốc/preview riêng; mở trực tiếp dữ liệu trong kho.
- **Sao lưu & khôi phục:** bản dự phòng, nơi lưu, thời điểm verify/diễn tập, nút kiểm tra và luồng khôi phục có bước xem trước.
- Nhập PC là thao tác bổ sung nguồn. Tiến trình luôn có phạm vi, số đã đọc/đã ghi/chờ/lỗi và lý do. Trạng thái tổng không báo xanh khi còn phần chưa hỗ trợ hoặc chưa bảo vệ.
- Lượt đồng bộ phân biệt tin mới/cập nhật/đã có với tệp mới/thiếu; hiển thị chế độ đọc tăng dần hay quét đối chiếu. Không dùng phần trăm tổng khi chưa biết tổng nguồn; vẫn cho xem phần đã lưu trong lúc xử lý.
- Bỏ câu “N tệp lỗi” chung: tách lỗi tải tạm thời, nguồn không còn, loại chưa hỗ trợ; trong mỗi nhóm phân biệt số attachment gốc và preview. Chỉ hiển thị hướng xử lý thực hiện được.

#### 7. Ma trận kiểm thử và bằng chứng bắt buộc

| Nhóm | Tình huống | Điều kiện đạt |
| --- | --- | --- |
| Nội dung | Text Unicode/định dạng/mention/quote; ảnh/album/file/video/voice/sticker; metadata nhóm/cuộc gọi/bình chọn nếu hỗ trợ | Đúng người gửi, account, thứ tự, thời điểm, nội dung và mọi attachment; loại chưa hỗ trợ phải có trạng thái rõ và giữ bản nguồn cần thiết. |
| Danh tính | Cùng nội dung khác tin; 2 ID cùng timestamp; Web/PC khác client/time; hai nhóm cùng tên | Không gộp nhầm, không ghi đè; xung đột giữ bằng chứng và liệt kê đầy đủ. |
| Nhập lại/tăng dần | Fixture 500 tin; lặp không đổi; thêm 10 tin; bấm lặp hoặc dừng rồi tiếp tục | Tổng lần lượt 500/500/510, đúng tập ID, không tăng blob lâu dài với cùng nội dung; checkpoint không vượt dữ liệu đã commit. |
| Bổ sung tin cũ | Tệp cũ thiếu nay có nguồn; trạng thái/cảm xúc cũ đổi; PC nhận thêm lịch sử cũ từ điện thoại; hai tin trùng giờ | Sửa đúng phần thiếu/phiên bản, giữ quyền và nguồn gốc; không bỏ qua vì ngày cũ hơn checkpoint, không tăng tin logic do cập nhật. |
| Hiệu suất tăng dần | Nguồn có seek/cursor và nguồn không có; cursor mất hiệu lực; adapter đổi | Đo số trang/bytes/thời gian thực tế; nguồn có cursor dùng lượt đọc mới + khoảng chồng hữu hạn; nguồn không có phải báo quét đối chiếu, không tuyên bố chỉ đọc mới. |
| Phân trang | 0/1/15/50/51 tin; trùng timestamp; cursor lặp/rỗng/sai thứ tự; source cảnh báo | Tập ID khớp oracle độc lập, không chỉ so số lượng; dừng an toàn khi không chứng minh được hết nguồn. |
| Thu thập mới | Mất mạng 1 phút/1 giờ/1 ngày; QR hết hạn; worker ngừng; backlog > một trang | Bù đủ phần nguồn còn trả, không bỏ khoảng trống; mất khả năng thu thập phải được cảnh báo. |
| Crash | Dừng tiến trình trước/sau commit, trước/sau rename blob, trước/sau cursor, lỗi disk-full/permission | Không mất bản đã commit; tiếp tục không trùng; không có ready giả hoặc cursor vượt phần đã lưu. |
| Đồng thời | 2 worker, Web+PC+backup, bấm lặp, job hết lease, nhiều máy | Khóa/lease/fencing và ràng buộc DB giữ đúng quyền ghi; snapshot tham chiếu đủ blob. |
| 5 account chung nhóm | Cùng tin/file, tham gia/rời khác thời điểm, ngắt 1 account | Một blob nội dung giống nhau, mapping account đúng, không cấp quyền lịch sử chéo. |
| Media | 401/403/404/410/429/5xx/DNS/timeout; URL mới; JXL; rỗng/quá lớn; nhiều attachment | Phân loại đúng, giữ gốc/preview riêng, retry có giới hạn; nguồn mới hợp lệ có thể khôi phục. |
| Quyền | Owner khác, giả account/source/asset ID, URL redirect private, gói PC sai account/hash | Từ chối đúng, không lộ metadata/bytes; không đọc/tải ngoài phạm vi cho phép. |
| Backup | Sai khóa, thiếu blob, byte hỏng, snapshot dở, DB đang ghi, xoay khóa | Không báo hoàn tất giả; xác định phần thiếu; bản cũ còn dùng được theo key version. |
| Restore | Máy/DB/volume trống, chỉ có bản dự phòng và khóa; không dùng file từ máy gốc | Khôi phục đủ tập ID/hash, mapping/quyền/thẻ; mở chat/ảnh/tệp offline; đo thời gian thật. |
| Thu hồi/xóa | Sự kiện cũ đến muộn, restore bản cũ, bỏ liên kết account | Không tự xóa kho hoặc làm sống lại tin đã xóa; tuân thủ chính sách đã chốt. |
| Chuyển phiên bản | Schema/adapter đổi, migrate lỗi, rollback | Kho cũ còn nguyên và đọc được, chuyển đổi lặp an toàn, phát hiện payload không tương thích. |
| UI | Tất cả trạng thái và số liệu API | Số tổng khớp chi tiết; preview không làm tăng số bản gốc; không báo toàn bộ Zalo đã lưu khi chưa có bằng chứng. |

- Mỗi loại nội dung phải có fixture biết trước kết quả; thêm kiểm tra ngẫu nhiên thứ tự/số lần phát lại và đối soát DB/blob. Automated tests chạy kho riêng, không dùng DB thật để tiêm lỗi.
- E2E dùng account/nhóm kiểm thử được chỉ định; thao tác gửi/thu hồi chỉ sau khi được phép cho đúng đối tượng. Không gửi tin vào hội thoại người dùng để tạo test.
- Dataset thật hiện có dùng kiểm tra chỉ đọc và bản sao cô lập: mốc 19/09/2026, nhóm có lịch sử PC tháng 2–9, My Documents, hội thoại cá nhân và nhóm nhiều account. So UI Zalo/Team cho phần có thể quan sát, không lấy phép self-hash kho làm bằng chứng đầy đủ nguồn.
- Báo cáo nghiệm thu ghi commit/schema/adapter, dataset, oracle mong đợi/kết quả, diff ID/hash, lỗi tiêm vào, log đã lọc bí mật, ảnh UI, manifest backup, nguồn môi trường restore và thời gian phục hồi.

#### 8. Thứ tự thực hiện và điều kiện qua bước

1. **D0 — Bảo toàn hiện trạng:** inventory read-only DB/blob/key/version; tạo bản sao cô lập đã verify trước sửa dữ liệu; giữ thu thập hiện tại, chưa chuyển schema hoặc xóa gì. Đích offsite và nơi giữ khóa cần chốt trước bước bảo vệ ngoài máy.
2. **D1 — Hợp đồng dữ liệu/counters:** tách identity/version/observation, gốc/preview, trạng thái thu thập/bảo vệ; migration shadow và đối soát với kho cũ. Qua bước khi không mất ID/blob/quyền và mọi chênh lệch được giải thích.
3. **D2 — Thu thập bền vững và tăng dần:** journal/hàng đợi, checkpoint giao dịch riêng Web/PC, dedup, bù khoảng thiếu, cập nhật tin cũ, hàng đợi tệp độc lập, URL refresh, sticker/album; test crash và tải. Bắt buộc qua fixture 500 → nhập lại 500 → thêm 10 thành 510; bổ sung tệp/cập nhật tin cũ không tăng tin logic, đo lượng đọc thực tế và công khai fallback quét PC nếu native không có seek ổn định. Nguồn live không có giao thức replay/ack phải ghi rõ cửa sổ có thể bỏ sót, không tuyên bố exactly-once từ Zalo.
4. **D3 — Backup/restore đầy đủ:** nhất quán DB/blob/quyền/thẻ, khóa theo phiên bản, offsite, dry-run và restore máy trống. Không đạt bước này nếu chỉ verify ZIP/hash.
5. **D4 — Giao diện/quan sát:** hiển thị chính xác các trạng thái đã được backend chứng minh; cảnh báo worker ngừng, backlog tăng, ổ gần đầy, dự phòng chậm, thiếu tệp/verify lỗi. Các ngưỡng là cấu hình theo số liệu chạy thử.
6. **D5 — Chạy thử và nghiệm thu:** tối thiểu 72 giờ với tải đại diện, fault injection trên môi trường cô lập, đối soát hằng ngày; diễn tập mất máy rồi phục hồi độc lập. Qua bước khi không mất dữ liệu được đánh dấu bảo vệ, không trùng sai/vi phạm quyền, mọi thiếu nguồn đều hiển thị, đạt mục tiêu độ trễ/phục hồi đã chốt.
7. **D6 — Chuyển sang dùng chính thức:** rollout nhỏ từng account, giữ dữ liệu/backup cũ, theo dõi và có rollback. Chỉ triển khai VPS và retention tự xóa khi có yêu cầu triển khai và các gate trên đạt.

- Điều kiện còn cần chốt trước production: nơi dự phòng độc lập và chi phí, quy mô/tải để đo, cửa sổ mất dữ liệu chấp nhận được, thời hạn lưu và chính sách thu hồi/xóa, nơi giữ khóa, account/nhóm thử nghiệm. Có thể hoàn thiện D0–D2 trong môi trường cô lập khi chưa chọn nhà cung cấp offsite.
- Tài liệu tham chiếu: [Zalo Help — sao lưu/khôi phục](https://help.zalo.me/huong-dan/chuyen-muc/quan-ly-tai-khoan-zalo/sao-luu-va-khoi-phuc/sao-luu-khoi-phuc-tin-nhan-khi-doi-may/); [PostgreSQL 16 — Continuous Archiving/PITR](https://www.postgresql.org/docs/16/continuous-archiving.html). Tài liệu Zalo không phải bằng chứng định dạng backup Team tương thích để nhập vào Zalo.
- Phương án đã được duyệt. Trạng thái triển khai, kiểm tra local và các gate còn mở ghi trong nhật ký phía trên; không suy ra toàn bộ D0–D6 hoàn tất từ một lượt kiểm thử.
- Đồng bộ tăng dần là hạng mục bắt buộc của D2. Đợt đầu đã tối ưu phần nhập/sao chép PC; nguồn PC hiện vẫn được quét đối chiếu, chưa có native seek/checkpoint tăng dần giữa các lượt.

### 03/10/2026 — Kiểm tra số mục tệp lỗi trong kho

- Đối chiếu PostgreSQL bằng snapshot chỉ đọc lúc 19:00:37: 7.114 mục ready, 1.986 mục error. 129 là tổng hội thoại theo liên kết; lỗi tệp thuộc 5 nguồn hội thoại. Bộ đếm `failedFiles` hiện tính cả slot gốc và preview (1.405 gốc, 581 preview), không phải số tệp vật lý duy nhất. Số đếm thay đổi khi worker xử lý.
- Nguyên nhân: 965 sticker PC không có URL/bytes (reader PC hiện chỉ lấy cache ảnh/file, chưa lấy tài nguyên sticker); 914 mục HTTP 404; 48 DNS; 22 timeout/kết nối; 37 HTTP 500/502/504. Không có lỗi hết dung lượng hoặc không ghi được ổ đĩa trong snapshot. Phần lớn lỗi thuộc nguồn nhóm đã nhập lịch sử PC cũ; không suy diễn toàn bộ hội thoại/tin nhắn bị mất.
- Sửa bộ kiểm tra nguồn cho họ hostname `bfg` của CDN hiện có, vẫn kiểm tra HTTPS và DNS/IP công cộng. Thử đúng 7 mục bị chặn: 6 DNS, 1 HTTP 404; chưa phục hồi được tệp nào trong nhóm này. 71 archive checks đạt. Chưa sửa luồng tài nguyên sticker hoặc đổi cách phân loại trên UI, chưa nhập lại PC, chưa triển khai VPS.
- Báo cáo chi tiết riêng: `.local/zalo-sync-research/file-errors-report-20261003.json`; công cụ audit chỉ xuất tổng hợp, không in URL tải có token hoặc nội dung trò chuyện.

### 03/10/2026 — Thống nhất giao diện Đồng bộ, Lưu trữ và Sao lưu

- Dùng chung `TeamPageHeader` với trang Liên kết tài khoản: cao 68px, tiêu đề 18px, cùng lề 24px; bỏ dòng mô tả dưới tiêu đề. Rút gọn mô tả chức năng trong các tab, giữ trạng thái dữ liệu/lỗi và hướng dẫn cần thiết khi kết nối PC.
- Thêm `ArchiveButton` cho các nút thao tác, cao 32px, khoảng đệm ngang 14px, nhóm nút cách 8px. CSS có độ ưu tiên rõ ràng để reset của shell không ghi đè khi điều hướng; không áp kiểu nút của kho lên combobox, nút avatar hoặc nội dung tin nhắn trong dialog.
- Căn hàng chọn Web/PC theo cùng mép thẻ nội dung; sửa khoảng cách kết quả nhập, lịch sử nhập, bộ lọc và nút thử lại tệp. Chỉ sửa UI, không chạy thêm thao tác nhập/sao lưu/khôi phục dữ liệu trong lượt này.
- Kiểm chứng Chrome local: Đồng bộ Web/PC, Lưu trữ, Sao lưu; chuyển Tài khoản → Đồng bộ vẫn giữ nút 32px/padding 6px 14px/gap 8px. Header hai trang cùng 68px, tiêu đề cùng x=88 tại viewport desktop. TypeScript noEmit đạt. Ảnh: `.local/send-proof/archive-backup-ui-refined.jpg`. Chưa có người dùng nghiệm thu, chưa triển khai VPS.

### 03/10/2026 — Đưa nhập PC và bước sao lưu vào giao diện Team

- Tab Đồng bộ tách nguồn Web/PC rõ ràng, dùng TeamSelect/SearchInput và style của trang hiện có. PC hiển thị bộ kết nối offline, chọn tài khoản, xác nhận khởi động lại ứng dụng, kiểm tra đúng account, catalog/tìm kiếm/chọn nhiều hội thoại, tiến độ đọc/lưu theo hội thoại, dừng, kết quả và mở bản lưu. Sau nhập có nút sao lưu toàn kho Team, chuyển sang tab Sao lưu để theo dõi.
- `ZaloTeamPcSession` lưu trạng thái phiên riêng tư, `zalo-team:pc-worker --watch` chạy độc lập browser. API chỉ nhận account/conversation ID, không nhận đường dẫn/file/URL/CDP/code. Giữ xác thực CRM/Origin/CSRF hiện có; thêm chặn host/IP ngoài loopback, Windows/local only, đúng owner, đối chiếu lại tài khoản Team trước khi nhập, kiểm tra danh sách hội thoại, một phiên PC toàn máy và một worker. Tiến trình khởi động lại xử lý đúng bản Zalo cài đặt đã cấu hình; không dùng profile PC/Docker cũ.
- Phiên PC được mở tạm qua `tooling/zalo-team/pc/session.ps1`: xác nhận ở UI trước restart, loopback 9333, guard riêng tự đóng khi lease hết 15 phút. Đóng sau hoàn tất/dừng/lỗi hoặc 15 phút chờ chọn; mở lại PC bình thường. Worker gia hạn lease khi nhập, phát hiện trạng thái đang chạy còn lại sau worker restart và báo gián đoạn thay vì tự lặp. Dữ liệu đã commit giữ nguyên, nhập lại chống trùng. Gói xuất trung gian thành công được dọn sau khi nhập vào kho, không lưu hai bản lâu dài; gói gián đoạn nằm trong private/zalo-pc để đối chiếu.
- Kiểm chứng local bằng UI: tài khoản Duy, 752 hội thoại, tìm/chọn Hoà Ads và bấm Nhập; xử lý 539 tin, thêm 39, giữ 332, 168 bản khác identity/time giữ bản đang có, 0 tệp mới thuộc các tin mới (70 bản cache thuộc tin khác không ghi đè). Trạng thái hoàn tất, PC được mở lại bình thường và kết nối tạm tự đóng. Đây là kiểm chứng thao tác thật cho một hội thoại, không phải xác nhận đầy đủ mọi loại tệp/điện thoại/tất cả tài khoản.
- Kiểm tra: 15 kiểm tra phiên cô lập (owner, xác nhận, worker offline, trùng lượt, account bị gỡ, hội thoại giả, cancel), 19 importer, 71 archive/backup đạt; TypeScript/Pint/OpenAPI cập nhật. Lần đầu kết nối chặn nhầm cờ `user-data-dir` của renderer mặc định; đã sửa chỉ kiểm tra cờ phiên tùy chỉnh ở tiến trình chính, sau đó UI kết nối/nhập thành công.
- Nút Sao lưu kho Team từ kết quả nhập đã tạo bản lúc 18:39:57 ngày 03/10/2026, metadata mã hóa 9.1 MB (tệp dùng kho riêng). Kiểm tra trên UI lúc 18:41:34 xác nhận đọc được và mã kiểm tra nội dung khớp. Bằng chứng giao diện: `.local/send-proof/zalo-team-pc-sync-ui.jpg`. Worker local đã nạp bản cuối; chưa triển khai VPS.

### Chạy bộ kết nối PC local

- Chạy `npm run dev:zalo-pc` song song backend/frontend và `npm run dev:zalo-archive`. Worker PC chờ yêu cầu UI; không tự mở Zalo khi vừa khởi động dịch vụ.
- Cấu hình server: `ZALO_TEAM_PC_INSTALL` mặc định bản 26.9.10 đã kiểm chứng; `ZALO_TEAM_PC_MEDIA_ROOT` mặc định `D:/Zalo Data`. Adapter kiểm tra bundle và danh tính, không tự nhận bản PC mới.
- Trạng thái tạm: `apps/backend/storage/app/private/zalo-pc`; kho chính vẫn `private/zalo-archive` và PostgreSQL. UI không truy cập trực tiếp thư mục này. Không đưa session/lease/catalog vào Git hay bản backup dữ liệu người dùng.

### 03/10/2026 — Nhập lịch sử PC thật và đóng phiên chẩn đoán

- Người dùng cho phép rõ việc khởi động lại Zalo PC và bật tạm cổng chẩn đoán. Đã xuất chỉ đọc từ PC 26.9.10, đúng tài khoản Duy và ID nhóm BAN TRUYỀN THÔNG HƯNG NGHĨA; không tạo/ghi đè backup native hoặc yêu cầu đồng bộ điện thoại. Sau xuất đã thoát bằng menu gốc, mở lại Zalo bình thường, xác nhận không còn listener 9333 và mọi tiến trình Zalo không có tham số remote-debugging.
- Xuất 26.621 tin qua 267 trang, 0 bản ghi bị bỏ qua, từ 13:54:52 28/02 tới 17:40:17 03/10/2026. Nhập thêm 25.152 tin; giữ 1.464 tin đã có. Có 5 bản cùng native/client ID nhưng lệch timestamp 196–770 ms: giữ bản Web, báo đối chiếu thay vì ghi đè. Phạm vi lần nhập này chỉ một nhóm; bản Hoà Ads khảo sát không có lịch sử cũ hơn Web nên chưa nhập.
- Sửa lỗi mã MSG_SUBTYPE/MSG_BUBBLE_LAYOUT trùng số với MSG_TEXT/MSG_PHOTO: dùng allowlist loại tin rõ ràng, đánh phiên bản projection 2. Đã sửa lại toàn bộ 25.152 bản ghi do lượt nhập PC đầu tạo ra; kiểm tra toàn bộ cho thấy 0 projection cũ và 0 sai khác text/type/số attachment. Chỉ sửa bản PC có identity khớp, không phục hồi bản đã xóa hoặc sửa bản Web. Xóa nội dung/asset mồ côi do ánh xạ cũ trong transaction; giữ dữ liệu còn được tài khoản khác tham chiếu.
- Đọc cache theo đường dẫn native hiện tại dưới media root được chỉ định. Xuất 4.598 bản tệp/ảnh xem trước, nhập 4.294 thuộc các tin PC mới; phần thuộc tin Web được giữ nguyên. Ảnh gốc PC thường là JPEG XL, giữ nguyên bytes; dùng JPEG preview có sẵn cho trình duyệt, không gọi preview là bản gốc. Video/voice/sticker cache chưa bao phủ đủ; tệp không còn trong cache hoặc URL nguồn hết hạn vẫn có thể thiếu.
- Tối ưu nhập theo lô 100 tin/transaction, cập nhật khoảng ngày mỗi lô; CLI có `--wait=60` đợi khóa kho. Bộ đếm tệp cập nhật mỗi 50 bản, phân biệt đang nhập tin/đang lưu tệp. Chặn gói khác identity hoặc projection cũ thay tệp của tin đã cập nhật. Nhập lại cùng manifest hoàn tất trả `replayed` và không ghi lại.
- Kiểm chứng: 4 bài projection, 19 kiểm tra importer cô lập, 71 kiểm tra kho/backup đạt; TypeScript noEmit và Pint đạt. Hash toàn bộ blob ready của nhóm tại thời điểm kiểm tra đều khớp (4.446 hash riêng, gồm dữ liệu Web sẵn có); history service đọc được 50 tin ngày 28/02 và còn trang tiếp. Chrome mở tin ngày 18/04 và ảnh JPEG preview 1024px từ `/api/zalo-team/archive/assets/...` sau khi đã đóng cổng PC; ảnh gốc JXL vẫn tải riêng qua liên kết bản gốc. Ảnh kiểm chứng `.local/send-proof/zalo-team-pc-import-image.jpg`; báo cáo kỹ thuật riêng `.local/zalo-sync-research/verification-v2.json`.
- Kho sử dụng chính: PostgreSQL `zt_archive_*` và `apps/backend/storage/app/private/zalo-archive/blobs`. Gói xuất tạm phục vụ đối chiếu ở `.local/zalo-sync-research/pc-ban-truyen-thong-v2-20261003`, không phải thư mục phục vụ ảnh. Để kiểm tra: Đồng bộ & sao lưu → Lưu trữ → chọn ngày trước 19/09 → nhóm → Xem bản lưu; hoặc mục Lịch sử nhập từ Zalo PC ở tab Đồng bộ.

### 03/10/2026 — Triển khai bộ nhập PC vào kho Team, chờ kết nối phiên thật

- `tooling/zalo-team/pc/archive-reader.mjs` dùng lại normalizer Team; `export-history.mjs` kiểm tra bundle PC 26.9.10, đọc identity và lịch sử qua `native-conversation-source` hiện có, xuất JSONL/manifest có SHA-256. Không chọn chat, gửi read receipt hoặc gọi đồng bộ điện thoại. Tệp cache chỉ chép khi đường dẫn native nằm trong media root đã chỉ định, kiểm tra realpath/kích thước/hash; không xuất cookie hoặc khóa. `npm run zalo:pc -- list|export` là lệnh quản trị local.
- `ZaloTeamPcImport` và lệnh `zalo-team:import-pc` kiểm tra account ID và conversation ID khớp tuyệt đối nguồn kho, hash và cấu trúc toàn gói trước nhập. Không tự liên kết theo tên. Tin đã có được giữ; cùng ID nhưng khác client ID/thời gian ghi xung đột, không ghi đè. Tin mới giữ provenance PC, đọc bằng lịch sử/timeline hiện có. Metadata thiếu URL có trạng thái tệp chưa lưu rõ ràng.
- Migration `000204` thêm `zt_archive_imports`, đã chạy local. Mỗi tin và bộ đếm tiến độ commit cùng transaction; nhập lại gói hoặc tiếp tục sau gián đoạn không tạo tin trùng. Tệp lưu vào blob chung của owner theo hash; file của tin Web có sẵn không bị bản PC thay thế. Lịch sử nhập đi cùng backup/restore của Team.
- Thêm danh sách lượt nhập PC trong tab Đồng bộ: số tin đã xử lý, mới, đã có, xung đột, tệp nhập từ PC, khoảng ngày và nút Xem lịch sử đã lưu. API status trả `imports`, OpenAPI và type frontend đã cập nhật. Chưa có nút UI để tự mở cổng PC hoặc điều khiển ứng dụng Windows.
- Kiểm tra: 3 bài projection PC, 14 checks importer với DB/tệp cô lập và 71 checks hồi quy kho/backup đều qua; TypeScript noEmit, PHP Pint, kiểm tra cú pháp exporter và diff whitespace qua. Chưa nghiệm thu UI có dữ liệu thật hoặc mốc lịch sử trước 19/09 từ PC.
- Runtime: đã thoát Zalo bằng menu gốc và thử mở lại từ sandbox với cổng loopback; ứng dụng không khởi tạo cửa sổ/cổng. Auto-review chặn lần khởi động ngoài sandbox vì chưa có phê duyệt cụ thể cho cổng chẩn đoán có thể truy cập phiên. Đã hỏi người dùng quyền bật tạm rồi đóng. Auto-review cũng chặn dừng các tiến trình thử mở để khôi phục Zalo bình thường do chưa phê duyệt cụ thể khởi động lại. Không đi vòng qua các chặn này; chưa nhập dữ liệu PC thật, không tạo/ghi đè bản backup Zalo hoặc khôi phục điện thoại.

### 03/10/2026 — Kiểm chứng Đồng bộ và Sao lưu trực tiếp trên Zalo PC

- Người dùng cho phép Computer Use trên Zalo PC cho lần kiểm chứng này. Kiểm tra bản 26.9.10, tài khoản Duy, qua Cài đặt → Đồng bộ và sao lưu.
- Mở Sao lưu tin nhắn: hộp thoại báo bản hiện có **16 MB**, tạo **03/10/2026 15:16** trên **LAPTOP-DUYLV**, hết hạn **06/10/2026 15:16**. Thời hạn quan sát được của bản này là 3 ngày; không suy rộng thành thời hạn cố định cho mọi tài khoản/bản sao lưu.
- Hộp thoại có hai lựa chọn **Dùng bản sao lưu này** và **Tạo mới bản sao lưu**, đồng thời ghi bản mới thay thế bản hiện tại. Không bấm hai lựa chọn này; chưa kiểm chứng khôi phục trên điện thoại hoặc tạo bản mới.
- Bấm Đồng bộ tin nhắn: UI lập tức hiện **Đồng bộ tin nhắn thành công**, không thấy bước xác nhận hoặc tiến trình trung gian trên PC. Người dùng cũng báo không có xác nhận trên điện thoại ở lần thao tác trước.
- Kết quả phù hợp với khả năng nhánh `MESSAGE_READY` → `success_no_need_sync` trong source đã đọc, nhưng chưa có trace xác định nhánh thực tế. Banner thành công không chứng minh đã chuyển thêm tin hoặc đã đủ toàn bộ lịch sử; chưa đo số tin trước/sau.
- Bằng chứng cục bộ: `.local/send-proof/zalo-pc-existing-backup.png`, `.local/send-proof/zalo-pc-sync-success.png`. Giữ nguyên bản sao lưu hiện có; không sửa mã sản phẩm hoặc tích hợp nguồn PC/điện thoại vào Team trong lần kiểm chứng này.

### 03/10/2026 — Chuẩn bị kiểm chứng đồng bộ PC/điện thoại, chưa tích hợp Team

- Người dùng cho phép kiểm chứng thêm hai chức năng native. Xác nhận tiến trình Windows đang chạy Zalo PC 26.9.10. Giữ giới hạn không Computer Use trên PC; chưa tự khởi động Docker PC, sửa app, bật debugger, gửi yêu cầu backup hay khôi phục điện thoại.
- Phiên hiện tại không có cổng chẩn đoán hoạt động ở cổng 9333 ghi trong DevToolsActivePort cũ. Thư mục logs không có bản ghi đọc được; chưa quan sát được runtime feature flag để kết luận nhánh đồng bộ đang bật.
- Thêm probe nghiên cứu chỉ đọc tại `.local/zalo-sync-research/runtime-observe.php`: mở Qos.db với SQLITE_OPEN_READONLY, chỉ xuất tổng lượt lệnh đồng bộ/sao lưu, thời gian và kích thước Sync.db/WAL, số tệp tạm; không xuất nội dung tin nhắn hoặc khóa. Baseline `.local/zalo-sync-research/runtime-baseline.json`: chưa có lệnh mục tiêu trong hàng đợi QoS hiện còn lưu, tệp tạm sync2 = 0. QoS chỉ là hàng đợi hiện tại, không chứng minh chưa từng đồng bộ. Sync.db không có header SQLite thường; không thử giải mã/import.
- Người dùng đã bấm Đồng bộ và báo chỉ thấy thành công, không có bước xác nhận điện thoại. Đối chiếu module native AS+M (`.local/zalo-sync-research/sync-state-machine.js`): `MESSAGE_READY` dẫn tới `success_no_need_sync`, `handleNoNeedSync` gọi cùng `showSuccessBanner` như luồng tải thành công; có nhánh `BypassConfirmed` riêng. Do đó xác nhận trên điện thoại không bắt buộc ở mọi lần bấm. Chưa có trace phiên để phân biệt chính xác nhánh của lần thử này, chưa chứng minh có tin mới được chuyển. Metadata Sync.db/WAL và hàng đợi QoS đọc được không thay đổi giữa hai lần quan sát; đây chỉ là bằng chứng phụ.
- Đã yêu cầu ảnh màn hình đầu của chức năng Sao lưu để đọc bản hiện tại/hạn sử dụng trước khi tạo mới. Chưa tạo backup hoặc khôi phục trên điện thoại vì có thể thay thế bản hiện tại. Chưa đổi chức năng lưu trữ Web của Team.

### 03/10/2026 — Nối kho vào chat thường và tối ưu hàng đợi tải tệp

- Thêm `timeline.ts`/`timeline-merge.ts`, endpoint archive `timeline`: đọc Web và kho song song, chống trùng theo ID, giữ trạng thái live (thu hồi/cảm xúc), dùng URL blob đã lưu cho cùng phiên bản tệp. Giới hạn thời gian đợi Web khi kho đã có dữ liệu; hủy request khi đổi hội thoại. Sau mốc kết thúc Web đã xác minh, chỉ đọc kho cho trang cũ hơn; tải mới vẫn kiểm tra Web.
- Cắt trang theo ranh giới chung của hai nguồn. Probe runtime cho thấy native trả 15 tin trong khi kho trả 50: dùng con trỏ cũ nhất của toàn bộ phép gộp có thể bỏ sót tin chưa lấy từ native. Bộ gộp mới giữ ranh giới nguồn chưa đọc hết, kiểm tra cả ID cùng timestamp. Lịch sử truy vấn tệp theo lô, giảm truy vấn theo từng tin; các tin archive có tệp chưa ready tiếp tục cập nhật trạng thái.
- Xóa tin thành công từ chat đánh dấu ẩn bản lưu theo đúng account, tránh hiện lại khi kéo lên; giữ ẩn trong phiên hiện tại và báo lỗi nếu chưa ghi được trạng thái kho. Không thử xóa tin thật của người dùng trong lượt này.
- Hàng đợi ưu tiên dữ liệu 30 ngày gần đây; cùng URL trong một lô dùng chung kết quả tải. Phân biệt lỗi nguồn hết hạn/không hỗ trợ với lỗi tạm thời; 404 không tự thử lặp, URL mới từ nguồn có thể mở lại lượt tải. Redirect tương đối và các hostname CDN lịch sử đã quan sát được vẫn phải qua kiểm tra HTTPS/DNS/IP công cộng ở từng bước. Ba hostname cũ bổ sung hiện không phân giải DNS, chưa lấy lại được các tệp đó.
- Kiểm tra local: 70 archive checks và 15 timeline tests qua (phân trang 15/50, dữ liệu kho thiếu từng đoạn, timestamp trùng, thu hồi, tài khoản khác, timeout, abort, fallback, cursor native không tiến và ranh giới Web). TypeScript noEmit, PHP Pint và OpenAPI đã kiểm tra/cập nhật. Chrome tải mới chat ADV FILE THIẾT KẾ từ 15 lên 30 tin, sau đó 50 ID riêng biệt/không trùng; 7 ảnh URL kho đã tải thành công. Có một lần tải trang cũ báo lỗi, nút Thử lại đã phục hồi; thêm chặn cursor native không tiến để tiếp tục dùng kho thay vì bị chặn. Con trỏ kho dùng native ID của đúng account quan sát. Ảnh kiểm chứng: `.local/send-proof/zalo-team-unified-history.png`. Chưa xác minh PC/VPS hay toàn bộ lịch sử Zalo.
- Snapshot local khoảng 17:07: 1.997 tham chiếu tệp ready, 730 pending, 63 error (404, 500/502, timeout, DNS); worker tiếp tục chạy nên đây không phải tổng cuối. Mốc 19/09 vẫn 448 tin, 24 hội thoại/account, 59 tệp gốc ready/0 pending/0 failed, 77 blob. Không tuyên bố toàn bộ kho đã tải xong.

### 03/10/2026 — Rà soát giao diện đồng bộ, thống kê theo ngày và tiến trình

- Sidebar thống nhất thứ tự Tin nhắn → Danh bạ → Thẻ → Tài khoản → Đồng bộ; icon kho dùng glyph cloud cùng font Zalo. Chỉnh bảng, bộ lọc, đường dẫn lưu, mốc kiểm chứng, hộp xác nhận; thanh tìm lịch sử có padding 20px, input/nút cách 8px, cùng chiều cao. Tra cứu toàn kho thu gọn để ưu tiên bảng ngày.
- Thêm `ZaloTeamArchiveReport` và API `days`: tổng hợp SQL, không tải nội dung tin để đếm; scope owner/account và observation chưa xóa, nhóm đã liên kết đếm một lần. Ranh giới ngày UTC+7; số tệp gốc tách riêng preview; blob cùng hash đếm một lần mỗi ngày và chỉ lưu một bản vật lý trên ổ. Tổng dung lượng các ngày không dùng để suy ra dung lượng toàn kho vì một blob có thể xuất hiện nhiều ngày.
- Migration `000203` bổ sung progress JSON; worker cập nhật pha catalog/messages/files/waiting/error/paused, nguồn/tệp đang xử lý, heartbeat, số hội thoại/trang của lượt. Tiến độ nguồn và tệp là phạm vi đã ghi nhận, không cam kết toàn bộ Zalo. Hàng đợi tệp chưa thử ưu tiên ngày cũ trước, có backoff giới hạn cho lỗi. Worker local đã khởi động lại sau thay đổi, đang hoạt động; không triển khai VPS.
- Mốc 19/09 trên báo cáo thật: 448 tin, 24 hội thoại, 59/59 nguồn tệp gốc ready, 77 blob gồm preview, 28.685.320 byte. Kiểm tra checkpoint trên Chrome lúc 16:46:47 vẫn nguyên vẹn. Nguồn có khoảng trống đang bù được báo riêng theo ngày giao với cursor, không dùng lỗi của ngày khác để kết luận mốc bị hỏng.
- Kho thực tế vẫn nằm trong dự án: `apps/backend/storage/app/private/zalo-archive` (blob), `apps/backend/storage/app/private/zalo-backups` (backup mã hóa). PostgreSQL chứa nội dung và chỉ mục `zt_archive_*`. Storage bị Git ignore; không nhân bản tệp thành nhiều thư mục ngày.
- Kiểm tra: 63 checks archive trên DB SQLite cô lập, gồm scope API days, ranh giới UTC+7, linked-group/file dedup, retry chỉ đúng ngày/account và progress. TypeScript noEmit, Pint, OpenAPI và diff whitespace đạt. Báo cáo runtime PostgreSQL toàn kho khoảng 150–180ms tại gần 9.000 nội dung/106 ngày; đây là đo local, không phải benchmark tải lớn.
- Chrome: rà cả ba tab, popup lịch sử ngày 19/09, tìm không có kết quả, verify baseline trong khi worker chạy, hộp xác nhận restore (hủy, không restore dữ liệu thật). Máy chủ dev có lần khởi động lại làm fetch gián đoạn; sau khi HTTP 200 đã kiểm tra tìm kiếm thành công, lỗi mạng hiển thị tiếng Việt và xóa kết quả tìm cũ khi bắt đầu tìm mới. Bằng chứng `.local/send-proof/archive-history-spacing.png`, `archive-daily-overview.png`. Các ngày khác vẫn có tệp pending/error; không báo toàn kho đã tải xong. Chưa có người dùng nghiệm thu bản giao diện mới.

### 03/10/2026 — Sửa tải CDN, phân trang lịch sử và mốc kiểm chứng ngày 19/09

- Nguyên nhân các file lỗi được người dùng nêu: bộ tải chưa hỗ trợ host `dlfl.vn`/`dlmd.me` và chuỗi chuyển hướng HTTPS sang `flchat.vn`/`mdchat.me`. Bổ sung các mẫu hostname CDN đã quan sát từ nguồn native (`fgN`, `file-stal-*`, `video-stal-*`), vẫn chặn host giả, IP riêng, credential, port lạ và kiểm tra/pin DNS từng bước. Tải lại các mục lỗi thành công; không còn lỗi ở lượt kiểm chứng sau sửa. Không kết luận sai rằng file hết hạn từ một lỗi chung.
- Thông báo giờ phân biệt HTTP 401/403, 404/410, 429, kết nối, dung lượng, sai định dạng, ghi ổ đĩa và nguồn chưa hỗ trợ. Cùng URL đã tải trong phạm vi owner có thể dùng lại blob, tránh tải lặp thumbnail/ảnh. Hash nội dung tiếp tục chống trùng giữa URL khác nhau.
- Bốn luồng lịch sử dừng vì ID native của cursor chứa dấu chấm bị guard từ chối. Guard cho phép tập ký tự giới hạn `[a-zA-Z0-9_.:-]` tối đa 200 ký tự, giữ validation account/time; connector Web local đã rebuild/recreate với volume profile giữ nguyên. Hai account đã kết nối lại, lượt quét sau không còn lỗi cursor. Không thao tác PC hoặc VPS.
- Thêm migration `000202`, service `ZaloTeamArchiveCheckpoint`, lệnh API tạo/kiểm tra mốc theo ngày Việt Nam, bộ lọc ngày khi mở lịch sử; snapshot lưu hash nội dung và blob, scope account/owner, số lượng nguồn chưa quét/tệp chưa lưu rõ ràng. Verify chỉ dùng DB/ổ đĩa, phát hiện thiếu tin, nội dung đổi, tệp mất/sai hash. Checkpoint được đưa vào backup/restore hiện có. UI hiển thị mốc mới nhất từng ngày, các mốc trước vẫn được giữ trong DB/backup.
- Mốc hoàn chỉnh `73abd4db-afde-4f4a-9343-bac233bc22bf` ngày 19/09: 448 tin, 77 blob (27,4 MiB), 24 nguồn hội thoại; 0 tệp chờ/0 nguồn chưa quét tới ngày này. Backup `570e80bf-e373-4315-a1bd-9d6b1996680a` đã xác minh 20.588 bản ghi và 347 blob của toàn kho tại lúc tạo. Mốc ban đầu trước khi quét hội thoại cuối còn trong lịch sử, không ghi đè baseline cũ. Không xóa dữ liệu thật để thử restore.
- Kiểm tra tự động: 51 checks kho (gồm ranh giới ngày Việt Nam, verify khi sync giữ khóa, restore checkpoint từ backup), 32 checks thẻ, 4 tests guard và 7 tests messages, TypeScript noEmit. Fixture messages đã cập nhật theo NativeLoader/packet binding đang dùng để kiểm thử phân trang thật của adapter, thay fixture cũ không còn tương thích. Node test runner bị sandbox chặn spawn; chạy từng file `node <test.mjs>` thành công.
- Chrome local: mở mốc, bấm Kiểm tra bản lưu trả nguyên vẹn, mở lịch sử đúng ngày, xác nhận link file trỏ API asset riêng tư. Ảnh bằng chứng `.local/send-proof/archive-checkpoint-2026-09-19.png` và `archive-file-status.png`. Icon cloud/tooltip đã kiểm tra bằng focus và ảnh chụp; portal ở dialog top layer để không bị che; phần chữ dùng tên Zalo Team. Verify mốc không phải chờ khóa worker; tải media xử lý tối đa 200 mục/lượt nhưng vẫn giữ giới hạn thời gian, tận dụng tệp cùng URL đã lưu.

### 03/10/2026 — Kho lịch sử, đồng bộ nền và sao lưu mã hóa

- Backend thêm sáu bảng `zt_archive_*` (settings, sources, messages, observations, assets, backups), dịch vụ ingest/sync/files/backup, controller có scope CRM owner và hai lệnh console. Hai migration đã áp dụng PostgreSQL local; OpenAPI có API kho. ID sự kiện hệ thống hỗ trợ chuỗi native thay vì chỉ số.
- Đồng bộ đọc nguồn, duyệt lịch sử và bù khoảng ngắt kết nối bằng cursor bền vững; giữ checkpoint khi lỗi, xử lý công bằng giữa nguồn. Nội dung chung theo linked-group UUID + định danh tin + hash nội dung; góc nhìn sender/mine/reactions giữ theo account. Liên kết hoặc tách nhóm sau khi đã thu thập sẽ ánh xạ lại kho. Không gộp chỉ theo tên hoặc nội dung văn bản.
- Tệp được tải streaming có giới hạn, kiểm tra đích HTTPS/CDN/DNS, redirect, dung lượng trống, MIME và SHA-256. Blob trùng chỉ lưu một lần trong phạm vi owner. URL CDN tạm không thay thế file vật lý; API đọc tệp kiểm tra đăng nhập và quyền, không public thư mục. File lỗi/chưa tải có số lượng và lý do trên UI.
- Giao diện ba tab Đồng bộ/Kho dữ liệu/Sao lưu dùng shell, select, tìm kiếm và trình xem ảnh chung. Nhóm nhiều account có bước chọn tài khoản; header chat mở lịch sử server. Kho là bản lưu chỉ đọc, không gửi lại tin, recall, bỏ phiếu hoặc thực hiện thao tác Zalo từ tin cũ.
- Sao lưu gồm snapshot metadata AES-256 và blob mã hóa dùng chung giữa các snapshot, kiểm tra giải mã/hash trước khi báo xác minh. Khôi phục bổ sung phần thiếu, giữ bản ghi đang có; CLI nhận lại snapshot từ ổ đĩa khi mất danh mục backup. Snapshot thẻ chỉ phục vụ phục hồi có kiểm soát, chưa tự khôi phục thẻ chung.
- Kiểm chứng: 37 kiểm tra kho biệt lập (5 account/1 nhóm, idempotency, phạm vi, tệp, mã hóa, khôi phục, mất kết nối, liên kết lại, ID sự kiện); 32 kiểm tra thẻ hồi quy. Frontend typecheck và kiểm tra cấu hình Compose thực hiện riêng. Chrome local đã mở trang, chọn account đọc kho nhóm và tạo bản sao lưu mã hóa có kiểm tra toàn vẹn. Chưa khôi phục phá dữ liệu thật, chưa triển khai VPS, chưa đối chiếu thao tác PC trực tiếp.
- Kiểm tra cuối: typecheck/Compose/OpenAPI qua; worker local bản mới đang chạy. Bổ sung làm mới CSRF một lần khi nhận 419 (lệnh bị từ chối trước khi chạy), hiển thị yêu cầu đăng nhập khi 401. Tab kiểm thử cũ bị đóng, lần mở lại gặp token hết hạn; kết nối Chrome sau đó timeout nên chưa xác nhận lại bằng UI nhánh làm mới token và chưa lưu được ảnh chụp cuối. Không bỏ bảo vệ CSRF hoặc quyền đăng nhập.

## Vận hành kho lịch sử và sao lưu

### Nhập lịch sử từ PC — giai đoạn 1

- Cần phiên PC 26.9.10 đã đăng nhập và kết nối chẩn đoán loopback **được người dùng cho phép cụ thể**. Exporter không tự bật cổng, không khởi động/dừng ứng dụng. Đây là luồng nhập có chủ đích, chưa là bộ đồng bộ PC thường trực.
- Từ gốc repo: `npm run zalo:pc -- list` liệt kê account/hội thoại; `npm run zalo:pc -- export --account <native-account-id> --conversation <native-conversation-id> --out <thu-muc-moi> --media-root <thu-muc-cache-Zalo>` xuất lịch sử của một hội thoại. Chỉ gói có `manifest.json` mới nhập được; lỗi/ngắt lúc xuất giữ progress để chẩn đoán, xuất lại vào thư mục mới. Bản giai đoạn 1 chưa tiếp tục cursor của lượt xuất dở.
- Từ `apps/backend`: `php -d extension=pdo_pgsql artisan zalo-team:import-pc <crm-user-id> <archive-source-id> <thu-muc-goi>` chỉ kiểm tra; thêm `--apply` để nhập. Nguồn kho phải đã tồn tại và có đúng account/conversation ID; ID khác giữa PC/Web cần phát triển đối chiếu riêng, không ép ghép.
- Tiến độ nhập lưu trong database, tiếp tục bằng cùng lệnh/gói khi bị gián đoạn; giữ gói nguyên vẹn cho tới khi nhập và kiểm tra xong. Gói xuất là dữ liệu riêng tư dạng rõ, để ngoài Git/public webroot. Kho đích và backup Team giữ nguyên đường dẫn bên dưới.
- Thư mục media root giới hạn việc đọc tệp cache; bản hiện tại chỉ ghép một tệp chính cho mỗi tin có một attachment. Tệp không còn trên PC/URL nguồn được báo thiếu; chưa nhập media mã hóa chưa có bản cache đọc được. Chỉ cam kết dữ liệu PC trả về, không cam kết toàn bộ dữ liệu điện thoại.

- Chạy local: migrate backend rồi `npm run dev:zalo-archive`. Worker duy trì độc lập với tab trình duyệt. Scheduler hiện có chạy mỗi phút; khóa file theo owner bảo vệ việc đồng bộ/sao lưu. Dùng process manager/container khi triển khai server, không phụ thuộc terminal phát triển.
- `ZALO_TEAM_ARCHIVE_PATH`: mặc định `apps/backend/storage/app/private/zalo-archive`; `ZALO_TEAM_BACKUP_PATH`: mặc định `apps/backend/storage/app/private/zalo-backups`. Database giữ chỉ mục và nội dung tin, thư mục giữ blob. Các thư mục bị loại khỏi Git/build Docker; Compose có volume riêng dùng chung backend/worker. Đây vẫn là cùng ổ đĩa nếu chưa cấu hình ổ khác/offsite.
- `ZALO_TEAM_ARCHIVE_MAX_FILE_BYTES`: mặc định 262144000 (250 MiB). Tệp quá lớn, hết hạn, loại mã hóa chưa hỗ trợ hoặc nguồn lỗi không được báo đã lưu; có nút thử lại. Dữ liệu blob hoạt động nằm trong thư mục riêng tư, không được mã hóa tại rest bởi tính năng này; bản backup được mã hóa.
- `ZALO_TEAM_BACKUP_PASSWORD`: khóa tối thiểu 24 ký tự, mặc định dùng `APP_KEY`; giữ khóa riêng và giữ khóa cũ nếu xoay khóa. Mất khóa không giải mã được snapshot. Phục hồi sau sự cố cần khôi phục đúng danh tính CRM owner (user/tenant/company), không tự cấp kho của người khác.
- Mỗi snapshot ZIP chứa `archive.jsonl`; tệp đính kèm mã hóa nằm trong `<owner>/blobs/<sha256>.zip`, được dùng lại giữa các snapshot. **Phải sao lưu toàn bộ thư mục owner, không chỉ một ZIP snapshot.** Dung lượng cạnh snapshot trên UI là dữ liệu tin nhắn/metadata, chưa gồm blob chung. Đồng thời sao lưu database CRM để giữ người dùng, liên kết nhóm và các nghiệp vụ/thẻ chung. Không đưa cookie/profile connector vào snapshot này.
- Bật tự động mỗi ngày trên tab Sao lưu hoặc bấm Sao lưu ngay. Mặc định lịch hằng ngày tắt; chưa có chính sách tự xóa snapshot. Worker phải chạy để xử lý yêu cầu. Việc đặt đường dẫn backup cùng máy chưa bảo vệ khỏi mất server; offsite/retention cần cấu hình ở bước triển khai.
- Từ `apps/backend`: `php artisan zalo-team:archive-restore <user-id> <backup-uuid>` chỉ kiểm tra/nhận lại danh mục. Thêm `--apply` mới bổ sung dữ liệu bị thiếu. UI cũng có xác nhận khôi phục. Khôi phục vào Team, không nhập lại lịch sử lên Zalo.
- Kho chỉ thu thập được nguồn mà phiên Web trả về. Không dùng mốc 15 ngày để tự xóa, không hứa lấy lại dữ liệu đã mất ở nguồn; nhập PC/điện thoại chưa triển khai. Đồng bộ hiện là polling + đối chiếu cursor, chưa là event log realtime bền vững: tin bị xóa trước lần quét có thể không thu thập được; thu hồi/thay đổi chỉ phản ánh khi nguồn trả lại bản cập nhật. Không tự xóa bản lưu chỉ vì tin vắng khỏi một trang kết quả.
- Quyền kho theo CRM owner và quan sát của từng account: account mới tham gia nhóm không tự thấy lịch sử của account khác. Bỏ chọn/ngắt liên kết account dừng thu thập nhưng không xóa dữ liệu đã lưu của owner; kho vẫn đọc được khi Zalo offline. Các trạng thái đọc/ẩn/phản ứng là snapshot, không cam kết hiện thời.

## Nhật ký trước khi có kho lịch sử

### 03/10/2026 — Luôn hiện cảm xúc đã chọn của mình

- Reaction picker có data-selected khi currentReaction khác null, kể cả mã Cười 0. CSS giữ nút hiện thường trực khi đã chọn cảm xúc; palette vẫn chỉ mở khi hover/focus, không hiện cả bảng thường trực. Chưa chọn cảm xúc thì giữ quy tắc hover/focus hoặc tin cuối như trước; gỡ cảm xúc trả về quy tắc mặc định.
- TypeScript noEmit đạt. Chrome xác nhận tin mẫu hover=false, focus-within=false, nút opacity=1 và palette visibility=hidden; đã chụp ảnh kiểm chứng trái tim thường trực. Thay đổi frontend local, không gửi/gỡ cảm xúc thật, chưa triển khai VPS.


### 03/10/2026 — Căn mép phải tin nhắn và cảm xúc chọn cuối

- Trừ phần gutter thanh cuộn khỏi padding phải liveMessageList; giữ lề trái. Chrome đo khoảng cách mép phải khung chat tới bong bóng gửi ra giảm từ 26px còn 16px, khớp Web đối chiếu.
- Projection messages giữ currentIcon, lastReactIcon và lastSender của native reaction store, chuẩn hóa thành currentReaction theo tài khoản hiện tại. Ưu tiên sự kiện mới nhất của chính tài khoản khi nhận từ phiên khác; không lấy cảm xúc đầu tiên theo mảng loại cố định. Mã Cười 0 được giữ bằng kiểm tra nullish; cảm xúc của người khác/đã gỡ/thu hồi không thành lựa chọn của mình. Nút bấm nhanh và hình hiển thị cùng dùng currentReaction, cập nhật sau mutation thành công.
- Kiểm tra: TypeScript noEmit đạt; 10 checks gồm 4 reaction-selection và 6 messages-loader đạt. Native tin mẫu có cả Tim/Cười, currentIcon và lastReactIcon đều 5; UI trả Tim đúng trạng thái đã lưu. Đã gỡ log chẩn đoán tạm. Không thả/gỡ cảm xúc thật khi kiểm tra; connector được build lại local, chưa triển khai VPS.


### 03/10/2026 — Sửa giao diện tìm kiếm theo mẫu Web và nút chuyển thẻ tròn

- Sửa lỗi specificity: reset .workspace button đã thắng .searchResult, khiến kết quả bị inline-flex/padding 0. Selector kết quả giờ có độ ưu tiên phù hợp, dùng grid ba cột, avatar người gửi 40px, tên/thời gian ngắn trên một hàng, nội dung tối đa hai dòng ở hàng dưới. Giữ tooltip thời gian đầy đủ, highlight nhẹ, hover/selected riêng và cuộn mảnh.
- Đối chiếu DOM/CSS trực tiếp panel native Zalo Web: header, ô tìm, chữ Xóa, hàng Lọc theo với hai chip Người gửi/Ngày gửi. TeamSelect thêm appearance chip, vẫn dùng chung hành vi và menu; trường mặc định không thay đổi. Avatar tái sử dụng thông tin tài khoản, liên hệ và thành viên đã có.
- Nút Phân loại trước/tiếp theo trong GroupDialog sửa từ 32x38 thành 32x32, radius 50%, căn giữa dọc dải thẻ, giữ kích thước cố định.
- Kiểm tra local: TypeScript noEmit đạt. Chrome đo kết quả display grid, padding 12px 16px, hàng 68px, avatar 40x40 đã tải, nội dung nằm dưới tên. Đã chụp và xem ảnh panel bằng Chrome (captureScreenshot hoạt động lại). Chrome đo cả nút trước và tiếp theo đều 32x32/radius 50%, đã thao tác cuộn hai chiều và Hủy hộp. Lần chụp riêng dải thẻ sau đó bị timeout; ảnh panel tìm kiếm đã lưu thành công. Chỉ thay UI; không tạo nhóm hoặc gửi dữ liệu thật; chưa triển khai VPS.


### 03/10/2026 — Tìm kiếm trong hội thoại và nút nhóm trên header

- Tham khảo panel tìm kiếm của Zalo Web trên Chrome Duy Anh Web. Thêm nút kính lúp mở panel bên phải; dùng TeamSelect chung cho người gửi/ngày gửi. Tìm theo từ khóa không phân biệt dấu/hoa thường, tên file, từng thành viên nhóm, Bạn/người khác và 7/30/90 ngày; bộ lọc cũng dùng được khi không nhập từ khóa. Debounce 350ms, hủy kết quả cũ khi đổi điều kiện/hội thoại, phân trang 50 kết quả, trạng thái rỗng/lỗi/thử lại, đánh dấu từ khóa bằng nội dung React an toàn.
- Connector thêm message-search, kiểm tra owner/account/conversation cả proxy và native frame. Đọc DB lịch sử Zalo Web đúng partition, loại tin đã xóa/đang xóa/thu hồi, giới hạn thời gian đọc 20s. Không quét riêng mảng tin đang render; phạm vi vẫn là lịch sử hiện có của phiên Web, không cam kết toàn bộ lịch sử PC/cloud.
- Bấm kết quả tải đúng đoạn lịch sử, cuộn và tô sáng tin (hỗ trợ album); chế độ xem đoạn cũ tạm dừng refresh mới để không nối hai đoạn lịch sử cách nhau. Có nút Về tin nhắn mới nhất; kết quả được ràng buộc nguồn hội thoại để không mang ID cũ sang tài khoản khác.
- Nút nhóm trên header tái sử dụng GroupDialog: chat cá nhân mở Tạo nhóm và chọn sẵn người đang chat; chat nhóm mở Thêm thành viên. Giữ quyền, tài khoản hiện tại, validation và bước gửi đang có.
- Kiểm tra: TypeScript noEmit đạt; 9 kiểm tra Node tập trung đạt (scope/identity, input, dấu tiếng Việt, file, xóa/thu hồi, sender/date, phân trang cùng timestamp). Connector local build lại; read API trả HTTP 200. Chrome xác nhận tìm Hoà Ads, lọc Bạn, mở tin 28/09 nằm ngoài trang hiện tại và thấy highlight trong viewport, quay về tin mới; nhóm kiểm thử có lựa chọn từng thành viên và kết quả rỗng đúng; đổi hội thoại đặt lại điều kiện. Hộp tạo nhóm chọn sẵn Hoà Ads, hộp thêm thành viên nhóm mở đúng; đã hủy cả hai, không tạo nhóm/thêm người thật.
- Chưa triển khai VPS. Không có ảnh chụp UI mới do captureScreenshot Chrome đã lỗi ở lượt trước; kiểm tra UI bằng DOM và vị trí phần tử.


### 03/10/2026 — Khôi phục gateway gọi bị container audio-test chiếm cổng

- Nguyên nhân runtime: 9260 đang trỏ vào container x3-zalo-team-call-audio-test-audio-1 với health provider webrtc-audio/nativeLinked false; gateway ZRTC hôm trước không chạy trên cổng này. Frontend chỉ kiểm tra capability một lần khi mount, sau đó bỏ onClick nên bấm không phản hồi.
- Đã dừng đúng container audio-test, giữ nguyên bộ test/PC assets; khởi động start-local.ps1 ở nền. Health local trả provider zrtc, callReady true. Đổi cổng host compose.audio-test.yml và probe test-browser-audio.mjs sang 9261; 9260 dành cho gateway thật. start-local kiểm tra sẵn sàng/xung đột cổng và báo nguyên nhân trước khi khởi động.
- VoiceCall kiểm tra capabilities ở mỗi lần bấm trước khi mở micro; người dùng thấy trạng thái kiểm tra và thông báo dịch vụ chưa sẵn sàng nếu thất bại. Khôi phục worker không đòi hỏi remount mới nhận được thao tác. Hủy trong bước kiểm tra không tiếp tục mở micro/gọi.
- Kiểm tra: TypeScript đạt; 6 test browser-media/portable-call đạt. Chrome header Hoà Ads có nút Gọi thoại nhận thao tác (aria-disabled false); connector prepare xác nhận đúng Duy → Hoà Ads, đã đóng phiên prepare, không gửi lời mời gọi. Chưa thực hiện cuộc gọi thật/kiểm tra âm thanh hai chiều trong lượt này. Gateway hiện chạy local; không triển khai VPS hoặc cài dịch vụ tự khởi động Windows.


### 03/10/2026 — Nhận thao tác menu khi đang tải, căn chiều cao select

- Menu hội thoại không vô hiệu hóa Ghim/Tắt thông báo/Ẩn/Xóa/Báo xấu chỉ vì dữ liệu đang tải. Ghim/tắt thông báo chờ promise đọc cài đặt hiện có; thao tác bảo mật chờ dữ liệu rồi mới mở hộp tương ứng. Hiện trạng thái Đang chuẩn bị thao tác, chặn bấm lặp; tải thất bại không gửi lệnh, unmount không chạy tiếp lệnh đang chờ. Quyền đã xác minh không hỗ trợ vẫn bị chặn.
- Hộp xóa/ẩn/báo xấu và bước xác nhận hiện có được giữ nguyên. Không tự gửi lại mutation khi lỗi. Khi tải hoàn tất không ép focus về nút đầu menu.
- TeamSelect mặc định cao 32px, nội dung flex căn giữa theo chiều dọc; bộ chọn tài khoản Danh bạ 38px, form 36px theo input của từng khu vực. Dòng option căn giữa với line-height thống nhất.
- Kiểm tra: TypeScript noEmit đạt; Chrome DOM đo select sắp xếp và input Tìm bạn đều 32px, lệch tâm nội dung 0px. Mở menu Nguyễn Hoài Nam/Nguyễn Thị Ánh lúc chưa có state thấy đủ nút enabled; bấm Báo xấu hiện trạng thái chờ, sau đó tự mở đúng hộp Báo xấu; đã Hủy, không gửi báo cáo hay mutation thật. Chưa có ảnh mới do lỗi captureScreenshot của Chrome từ lượt trước; chưa triển khai VPS.


### 03/10/2026 — Select chung và nút Phân loại

- Tạo TeamSelect dùng MUI Select/MenuItem sẵn có: cùng font Zalo Team, viền nhẹ, menu bo góc, dấu chọn, điều khiển bằng bàn phím, disabled và tùy chọn avatar. AccountSelect trở thành wrapper dữ liệu của TeamSelect.
- Chuyển đủ 15 vị trí trong Zalo Team: tài khoản Danh bạ, sắp xếp/phân loại Danh bạ, trạng thái tài khoản, tìm số điện thoại, thêm bạn/tạo nhóm, thêm người vào nhóm, liên kết nhóm, ba bộ lọc kho nội dung, lặp nhắc hẹn, điều kiện lọc thẻ, đối chiếu/gộp thẻ. Quét nguồn không còn select HTML hoặc LibrarySelect trong feature/route Team.
- Nút Phân loại dùng icon mũi tên riêng, pill trạng thái mở/đang lọc và số thẻ; căn lại menu và khoảng cách hàng. Menu select được đặt trong native dialog khi cần; click chọn không đóng nhầm popup lọc hoặc hộp thoại. TeamDialog chỉ đóng bằng backdrop khi cả pointerdown và click đều ở backdrop. Escape ở menu select chỉ đóng menu.
- Kiểm tra local: TypeScript noEmit đạt. Chrome xác nhận đổi any/all giữ menu Phân loại, chọn Duy/Nguyễn Thị Ánh trong Thêm bạn, menu nằm trong dialog, Escape giữ modal; Danh bạ đổi tài khoản giữ avatar, ArrowDown/Enter đổi sắp xếp Z-A rồi trả A-Z/Duy. Không gửi lời mời hoặc đổi dữ liệu nhóm.
- Giới hạn: Chrome captureScreenshot tiếp tục timeout nên chưa có ảnh mới để nghiệm thu trực quan; các kiểm tra Chrome trên là DOM/tương tác. Chưa mở thử từng luồng phụ trong 15 vị trí, chưa kiểm chứng PC hoặc triển khai VPS.


### 03/10/2026 — Icon thẻ trong danh sách tin nhắn

- Inbox chỉ hiển thị một icon thẻ màu 16px trước nội dung xem trước; bỏ tên thẻ và dòng phụ, trả chiều cao dòng về 70px. Hover hoặc focus icon mở tooltip nền xanh với đầy đủ tên thẻ đã gắn. Header và hộp quản lý vẫn hiển thị icon kèm tên.
- Tooltip nằm ngoài vùng cuộn để không bị cắt; đóng khi rời chuột, mất focus, Escape hoặc cuộn. Bấm icon vẫn mở hội thoại.
- Kiểm tra: TypeScript noEmit đạt; Chrome DOM xác nhận dòng 70px và tooltip Khách hàng khi focus bàn phím. Chụp ảnh Chrome bị timeout hai lần nên chưa lưu được ảnh UI của lượt sửa này; chưa kiểm chứng thao tác rê chuột thực tế. Không đổi dữ liệu thẻ hoặc triển khai VPS.


### 03/10/2026 — Chỉnh giao diện thẻ theo mẫu Zalo Web

- Thẻ dùng biểu tượng màu hình nhãn + tên chữ thường, bỏ viền badge nhỏ; áp dụng cho header, inbox, danh bạ, bộ lọc và hộp chọn thẻ. Header đặt thẻ dưới tên hội thoại, giữ tài khoản đang dùng kế bên, bỏ dải + Thẻ riêng.
- Ô tìm thẻ full width trong hộp phân loại và quản lý. Danh sách quản lý căn lại cột, số lượng dạng badge nhẹ, thao tác sửa/lên/xuống bằng icon có nhãn truy cập; hàng chọn có nền nhạt.
- Thành phần: shared-tags.tsx, conversation-detail.tsx, zalo-team.module.css. Không đổi API hay dữ liệu gắn thẻ.
- Kiểm tra local: TypeScript noEmit đạt; Chrome kiểm tra tìm kiếm hai hộp, mở sửa/hủy, chiều rộng input 420px trên nội dung hộp 420px; header GĐ Nhi hiển thị Gia đình cạnh tài khoản Duy. Ảnh tại .local/send-proof/shared-tags-ui-refined.png, shared-tags-picker.png và shared-tags-header.png. Đối chiếu ảnh Zalo Web người dùng cung cấp; chưa nghiệm thu trên PC hoặc triển khai VPS.


### 03/10/2026 — Triển khai bộ thẻ chung và nhập thẻ cũ

- Người dùng đã chốt phương án thẻ chung ở lượt nghiên cứu bên dưới. Thêm migration `2026_10_03_000100_create_zalo_team_tags.php`, service `ZaloTeamTags`/`ZaloTeamCatalog`, API Laravel `/api/zalo-team/tags` và proxy Next cùng origin/CSRF. Dữ liệu trong các bảng `zt_workspaces`, `zt_tags`, `zt_tag_assignments`, `zt_tag_imports`, `zt_tag_audits`; không dùng lại bảng/API `/zalo` legacy. Workspace mặc định `crm` phù hợp CRM một workspace hiện tại, không gắn danh mục vào ID nhân viên. Connector vẫn kiểm tra owner hiện có, không mở rộng quyền tài khoản Zalo cho nhân viên khác.
- Quyền `zalo_team.tags.manage` được cấp cho role ADMIN và có trong hệ thống phân quyền; người dùng hoạt động có thể gắn/bỏ thẻ trên các nguồn hội thoại được connector xác minh. Catalog dùng chung, số lượng và quan hệ gắn chỉ chiếu lên các hội thoại có quyền truy cập. Khóa giao dịch theo workspace + revision và biên nhận request chống ghi trùng/xung đột; bản sửa tên giữ revision lúc bắt đầu chỉnh sửa. Không tự thử lại thao tác ghi khi kết quả chưa rõ, lỗi cần Tải lại thẻ để đối chiếu.
- `SharedTagsProvider`, picker, chip, filter và manager dùng trong inbox, header chat, menu hội thoại, Danh bạ và chọn thành viên. Hỗ trợ nhiều thẻ, tên/màu, đổi thứ tự lên/xuống, gộp sang thẻ đích, lưu trữ/khôi phục, lọc bất kỳ/tất cả và Chưa gắn thẻ. Nhóm đã liên kết hiển thị hợp các thẻ và sửa trên các nguồn đã xác minh; nhóm thiếu nguồn sẽ chặn sửa để tránh lệch khi tài khoản trở lại. Không tự liên kết khách cá nhân theo tên/avatar.
- Nhập cũ: snapshot phía server gồm account external ID + label ID + tham chiếu hội thoại, bảng xem trước sửa ánh xạ/tên/màu hoặc bỏ qua. Tên trùng được gợi ý gộp; các thẻ gộp mới cần cùng màu. Snapshot hết hạn sau 30 phút, kiểm tra lại nguồn trước nhập. Giữ ánh xạ khi đổi tên thẻ chung; nhập lại giữ cả tombstone của lượt bỏ thẻ. Hoàn tác chỉ bỏ lượt gắn còn nguyên nguồn import, bảo toàn sửa tay và danh mục thẻ. Toàn bộ tham chiếu chưa nhận diện nằm trong snapshot, không chỉ giữ số lượng. Không ghi ngược sang Zalo, không nhập dữ liệu Salework.
- Đã migrate database local và cập nhật connector local image `bae1b04e6260` (thêm trạng thái nhóm đủ nguồn). Đã nhập thật qua UI: 13 thẻ nguồn → 7 thẻ chung, thêm 18 lượt gắn (Khách hàng 15, Gia đình 2, Học tập 1), giữ 5 tham chiếu Khách hàng chưa nằm trong catalog hiển thị/danh bạ. Hội thoại ẩn chưa được nhập. Các lần đọc/nhập sau có thể tiếp tục đối chiếu các nguồn này, không tự suy đoán danh tính.
- Kiểm chứng: 32 kiểm tra PHP trên SQLite memory đạt (permission/workspace/source scope, nhóm, offline, idempotency, stale revision, nhập/rollback, mapping sau đổi tên, pending provenance); 3 kiểm tra group-links Node đạt; TypeScript frontend đạt. Chrome local: nhập và lịch sử; gắn Công việc trên nhóm kiểm thử bằng Duy, mở lại bằng Nguyễn Thị Ánh thấy cùng thẻ; lọc inbox đúng một nhóm; bỏ thẻ thử bằng Ánh, dòng nhóm biến mất khỏi bộ lọc; đã khôi phục nhóm về không có thẻ thử. Danh bạ lọc Gia đình trả GĐ Cậu Thuận/GĐ Nhi; hộp Tạo nhóm dùng cùng bộ thẻ và lọc đúng hai liên hệ này, không tạo nhóm mới.
- Bằng chứng: `.local/send-proof/shared-tags-import.png`, `.local/send-proof/shared-tags-final.png`. Sau reload còn đủ 7 thẻ; lịch sử lần nhập tiếp theo ghi thêm 0, giữ nguyên 18, chờ 5. PC không thao tác UI; chức năng thẻ chung là dữ liệu CRM, đối chiếu thiết kế với Web/Salework ở lượt nghiên cứu. Chưa triển khai VPS; chưa chuyển dữ liệu từ Salework hoặc xác minh đủ dữ liệu hội thoại ẩn/ngoài catalog. Config `zalo_team` và compose local có đường dẫn token read-only cho backend Docker; backend đang chạy PHP local dùng token dự án trên Windows.

### 03/10/2026 — Nghiên cứu thẻ dùng chung (đề xuất, chưa triển khai)

- Yêu cầu: nghiên cứu Zalo Web/Salework và đề xuất bộ thẻ chung giữa các tài khoản, có phương án giữ các lượt gắn thẻ cũ. Chưa có quyết định triển khai trong lượt này.
- Đối chiếu Chrome Duy Anh Web: quản lý phân loại native có tên/màu, kéo sắp xếp, sửa/xóa, form tạo kèm chọn hội thoại. Salework `/v2/setting` có bộ quản lý tập trung, tạo thẻ thường/chỉ định, số hội thoại, sắp xếp và Chuyển thẻ (thẻ chính, tối đa 10 thẻ nguồn; lựa chọn chuyển kèm xóa). Chỉ mở/xem/hủy form, không lưu thay đổi. Nút Đồng bộ tag bị kiểm duyệt tự động chặn vì có thể ghi dữ liệu; không chạy đồng bộ, đối chiếu tài liệu chính thức `https://docs.salework.net/salework-tai-lieu/salework-zalo/quan-ly-the` thay thế.
- Kiểm kê read-only qua directory hiện tại: Duy 7 thẻ, Khách hàng 20/Gia đình 2/Học tập 1 lượt gắn; 4 thẻ khác 0. Nguyễn Thị Ánh 6 thẻ, các danh sách gắn trả về rỗng. Đây là số đọc được ở thời điểm kiểm tra, đã loại hội thoại ẩn, không phải kiểm kê toàn bộ thiết bị/lịch sử. Salework UI ban đầu hiện 15 thẻ thường, 0 chỉ định và tổng 1.370 hội thoại gắn thẻ; chưa xuất hoặc nhập các dữ liệu đó.
- Đề xuất: catalog nhiều thẻ thuộc workspace/company CRM, không thuộc tài khoản Zalo hay từng người đăng nhập. Quan hệ gắn thẻ theo đối tượng hội thoại chuẩn hóa; nhóm đã liên kết dùng cùng đối tượng, khách cá nhân chỉ dùng chung sau xác minh liên kết, không ghép theo tên/avatar. Phân quyền quản lý catalog tách khỏi quyền gắn thẻ và quyền đọc chat; thẻ không tự cấp quyền truy cập. Lưu DB nghiệp vụ CRM, không khôi phục API `/zalo` cũ hoặc dùng JSON owner hiện tại làm bộ thẻ toàn công ty. Scope `authenticatedOwner` hiện có cả user ID, nên phải thiết kế workspace và kiểm tra quyền rõ ràng trước khi chia sẻ đa nhân viên.
- Chuyển dữ liệu đề xuất: snapshot nguồn gồm account/label ID, tên, màu và quan hệ hội thoại; xem trước ánh xạ thẻ nguồn sang thẻ chung, cùng tên chỉ gợi ý; giữ cả hai thẻ khi có khác biệt chưa giải quyết. Nhập có batch/provenance/idempotency, giữ mục chưa nhận diện hoặc nguồn chưa tải ở trạng thái chờ; rollback theo batch không xóa chỉnh sửa thủ công về sau. Thẻ và dữ liệu Zalo gốc giữ nguyên. Team là nguồn quản lý sau chuyển; không tự đồng bộ hai chiều, không nhập lại làm hồi sinh thẻ đã bỏ thủ công. Dữ liệu Salework/legacy nếu chuyển sẽ là nguồn nhập riêng, chưa thuộc dữ liệu đã nhập.
- UI đề xuất: Phân loại ở inbox + Quản lý thẻ, picker nhiều lựa chọn dùng chung ở chat/Danh bạ/menu; không chọn account khi sửa thẻ chung. Hiển thị 1–2 thẻ và +N, lọc có bất kỳ thẻ đã chọn mặc định/có đủ tất cả là tùy chọn, có Chưa gắn thẻ. Nhãn Tin nhắn từ người lạ là bộ lọc trạng thái, không nhập thành thẻ người dùng. Sau chuyển cần thay đồng bộ mọi điểm dùng nhãn native hiện có (Danh bạ, chọn thành viên, inbox) để tránh hai hệ phân loại lẫn nhau.

### 03/10/2026 — Mở hồ sơ từ avatar trong chat

- Tách `ProfileDialog` khỏi `contacts-layout.tsx` để Danh bạ và Tin nhắn dùng chung giao diện, đổi tên và các thao tác hồ sơ. Thêm `ChatProfileDialog`, nối avatar header cá nhân và avatar người gửi trong `MessageItem`; hỗ trợ click/Enter, giữ scope tài khoản, đóng khi đổi hội thoại.
- Directory adapter cho phép đọc/mở hồ sơ người trong chat thông qua hội thoại nguồn đã xác minh. Với nhóm, kiểm tra ID tin nhắn, hội thoại và người gửi từ kho native trước khi tải hồ sơ, kể cả người chưa kết bạn; không cho context này mở rộng phạm vi các thao tác chặn/xóa bạn. Nút Nhắn tin chuyển về đúng hội thoại riêng và tài khoản nguồn.
- Kiểm tra: TypeScript frontend pass; 3 test directory pass, bổ sung các nhánh người chưa kết bạn, source không hợp lệ/đã ẩn, tin nhắn sai/người gửi sai và từ chối context trên thao tác ghi. Đã build/restart connector local (image `b7bc40123743`) và kiểm tra Chrome: avatar header/cạnh tin Hoà Ads đều mở hồ sơ đúng tài khoản Duy; Enter trên avatar Trần Hảo trong nhóm mở đúng hồ sơ, Nhắn tin chuyển sang chat Trần Hảo với dòng Gửi bằng Duy.
- Bằng chứng UI: `.local/send-proof/chat-avatar-profile.png`. Dùng lại format hồ sơ Danh bạ đã đối chiếu Web ở lượt trước; không thao tác UI Zalo PC, không kiểm thử lại các thao tác thay đổi quan hệ thật trong lượt này. Người chưa kết bạn trong nhóm mới kiểm tra bằng test adapter, chưa kiểm chứng UI thật. Không triển khai VPS.

### 03/10/2026 — Chỉnh dropdown tài khoản và nút trong hồ sơ Danh bạ

- Thay select hệ điều hành bằng `AccountSelect` có avatar, tên, dấu chọn và nền hover. Theo chỉnh sửa tiếp của người dùng, bỏ nhãn “Tài khoản” và cho dropdown chiếm toàn bộ hàng dưới tìm kiếm. Giữ mặc định account đầu tiên; hỗ trợ chuột, phím lên/xuống, Enter, Escape và đóng khi click ra ngoài.
- Sửa CSS bị quy tắc button chung ghi đè: Nhắn tin cao 40px, các hàng Chặn/Báo xấu/Xóa bạn căn trái, icon 20px, padding 12×16px, cao 45px, hover và đường phân cách; xóa bạn màu đỏ. Modal rộng 400px, tên hồ sơ một dòng và nút sửa gọn. Đối chiếu hàng `pi-action-item` trên Zalo Web và CSS PC (chỉ đọc source).
- Kiểm tra Chrome local: dropdown rộng bằng hàng chứa 312px, đổi Duy → Ánh bằng bàn phím, hồ sơ Hoà Ads và kích thước các nút. TypeScript đạt. Ảnh `.local/send-proof/directory-account-dropdown.png` và `.local/send-proof/directory-profile-actions.png`. Chỉ chỉnh UI local, không thay đổi quan hệ bạn bè.

### 03/10/2026 — Danh bạ theo từng tài khoản

- Đối chiếu trực tiếp tab Danh bạ của Zalo Web trong Chrome Duy Anh Web: bốn mục, header 64px, dòng liên hệ 72px/avatar 48px, tìm kiếm/sắp xếp/phân loại và menu bạn bè/nhóm. Dùng lại font/icon, shell, Avatar, dialog, Thêm bạn, Tạo nhóm, đổi tên gợi nhớ, báo xấu và rời nhóm của Team. PC chỉ đối chiếu core/source `getRequestedFriends`, `acceptAddFriend`, `rejectRequestAddFriend`, `undoRequestAddFriend`, `getGroupInvitationList`; không thao tác UI PC.
- Thêm route `contacts`, `directory.ts`, adapter `web/directory.mjs` và command có xác thực owner/account. Catalog lấy toàn bộ bạn bè và nhóm native; loại hội thoại ẩn, kiểm tra account identity và đối tượng còn thuộc catalog/lời mời trước thao tác. Các thao tác kết bạn/từ chối/thu hồi/chặn/xóa/phân loại/tham gia nhóm có receipt chống gửi lại sau kết quả không rõ; lời mời hết hạn/chờ duyệt không được xử lý như lời mời mới.
- Select ngay dưới tìm kiếm mặc định account đầu tiên. Đổi account hủy đọc cũ, xóa bộ lọc và đóng hộp thao tác; Thêm bạn/Tạo nhóm giữ account nguồn. Mở chat bằng tài khoản danh bạ, kể cả nhóm chung đã gộp trong inbox; sửa tránh hủy yêu cầu mở chat theo mỗi lần inbox cập nhật và tránh gọi lại native open cho chat đã mở.
- Chrome local: Duy có 450 bạn/98 nhóm/3 lời mời gửi; Nguyễn Thị Ánh có 190 bạn/55 nhóm/27 lời mời gửi. Kiểm tra đổi tài khoản, tìm không dấu Hoà Ads, hồ sơ/đổi tên gợi nhớ, mở chat bằng Duy, nhóm chung bằng Ánh, hộp rời nhóm yêu cầu chọn trưởng nhóm mới, Thêm bạn/Tạo nhóm scoped Ánh, lời mời gửi và trạng thái không có lời mời nhóm. Ảnh giao diện `.local/send-proof/directory-contacts.png`.
- Kiểm tra: TypeScript `tsc --noEmit` đạt; 16 kiểm tra Node về Directory/Accounts/Guards/FriendActions đạt. Windows không cho spawn test worker trong sandbox nên chạy `--test-isolation=none`. Connector đã build/chạy local; không triển khai VPS.
- Giới hạn kiểm chứng: hai account hiện không có lời mời kết bạn đến/lời mời nhóm; các nhánh đồng ý/từ chối/tham gia kiểm tra bằng adapter fixture. Chưa gửi/thay đổi quan hệ bạn bè, phân loại hoặc rời nhóm thật trong lượt này. Hồ sơ Danh bạ có thông tin cá nhân, nhắn tin, đổi tên, chặn, báo xấu và xóa bạn; các phần phụ Hình ảnh/Nhóm chung/Chia sẻ danh thiếp của hồ sơ native chưa được đưa vào hộp này (media vẫn có trong sidebar chat).

### 03/10/2026 — Nút ba chấm thay số tài khoản, hình tròn 20px

- Theo chỉnh sửa mới của người dùng, nhóm nhiều tài khoản giữ avatar 16×16px luôn hiển thị. Badge `+N` là hình tròn 20×20px; hover/focus hoặc mở menu thay badge bằng nút `…` hình tròn đúng cùng tọa độ và kích thước. Bấm nút mở chọn tài khoản thao tác; bấm dòng vẫn chọn tài khoản truy cập. Dòng một tài khoản giữ hành vi hiện có.
- Sửa component `ConversationRow` và CSS dùng chung cho mọi nhóm đã gộp; bỏ callback riêng của badge số. Kiểm tra Chrome trên nhóm Tráp ăn hỏi DUY ÁNH: đo badge và nút cùng 20×20px, border-radius 50%, avatar vẫn visible; menu đúng hai tài khoản. TypeScript đạt. Ảnh `.local/send-proof/group-count-circle.png` và `.local/send-proof/group-more-circle.png`. Chỉ sửa local, không có thay đổi dữ liệu Zalo.

### 03/10/2026 — Bổ sung nhóm kiểm thử và thu gọn cụm tài khoản

- Theo phản hồi người dùng, đã liên kết thêm hai nguồn Duy/Nguyễn Thị Ánh của nhóm Kiểm thử tạo nhóm từ Team 01-10 qua giao diện Team; nhóm này hiện một dòng, liên kết lưu ở connector. Bản trước mới liên kết nhóm Tráp ăn hỏi DUY ÁNH nên nhóm kiểm thử vẫn còn hai dòng.
- Sửa `ConversationRow` dùng chung cho mọi nhóm đã liên kết: chỉ một avatar 16×16px và badge `+N` bằng số tài khoản còn lại. Bỏ vùng riêng dành cho nút `…`; hover/focus thay avatar bằng menu tại cùng vị trí, tránh chiếm thêm chiều ngang. `+N` luôn mở picker để chọn tài khoản kể cả khi có lựa chọn ghi nhớ; tài khoản đơn không hiện số.
- Kiểm tra trực tiếp Chrome local: nhóm kiểm thử còn một dòng; cụm có một avatar, `+1`, cao 16px; bấm số mở đúng Duy/Nguyễn Thị Ánh. TypeScript đạt. Ảnh `.local/send-proof/group-account-count.png`. Không gửi tin, đổi thành viên hoặc triển khai VPS. Đây là UI nhiều tài khoản riêng của Team theo mẫu người dùng, không có luồng tương đương trên Zalo Web/PC một tài khoản.

### 03/10/2026 — Gộp nhóm chung và chọn tài khoản truy cập

- Đã triển khai phương án người dùng chốt: mỗi nhóm đã liên kết chỉ có một dòng; popover chọn tài khoản mặc định, avatar 16px mở nhanh, header “Đang dùng” đổi tài khoản. Có tùy chọn ghi nhớ theo nhóm, chỉ lưu sau khi lịch sử tải thành công; tài khoản đã nhớ không khả dụng thì yêu cầu chọn lại, không tự đổi người gửi.
- Đối chiếu dữ liệu thật: cùng nhóm Tráp ăn hỏi DUY ÁNH trả hai ID khác nhau trong phiên Duy/Ánh. Vì vậy dùng liên kết xác nhận một lần; không suy đoán từ tên/avatar. `GroupLinkDialog` cho chọn nhóm của từng tài khoản, thêm nguồn hoặc tách liên kết. Đây là dữ liệu hiển thị CRM, không đổi thành viên nhóm Zalo.
- `tooling/zalo-team/web/group-links.mjs` lưu liên kết/ưu tiên và nhật ký theo owner trong volume connector; ghi tuần tự, thay file nguyên tử. API kiểm tra nguồn thuộc catalog nhóm đang hiển thị của owner; từ chối chat cá nhân, nguồn khác owner, tài khoản trùng hoặc liên kết xung đột. Response conversations bổ sung `groups`, giữ nguyên các conversation nguồn.
- `group-links.ts`, `GroupAccountPicker`, `GroupLinkDialog`, `messages-layout`, `ConversationRow` và header detail nối UI. Preview lấy nguồn mới nhất, đổi “Bạn” thành tên tài khoản khi cần và giữ emoji; unread dùng dấu chấm, không cộng số trùng. Lọc một tài khoản mở thẳng tài khoản đó. Menu dòng luôn chọn tài khoản trước và hiển thị tên nguồn; dùng lại menu/sidebar hiện có. My Documents/chat cá nhân vẫn riêng.
- Chrome `/zalo-team`: xác nhận nhóm còn một dòng; mở lịch sử bằng cả Duy/Ánh; đổi tài khoản giữ bản nháp riêng (đã xóa nháp kiểm thử); menu chọn Ánh hiển thị đúng Ánh mà không đổi chat đang mở. Bật ghi nhớ Ánh, tải lại trang và mở trực tiếp thành công; đã tắt ghi nhớ sau thử để trả về chế độ hỏi. Avatar mở trực tiếp và bộ lọc Duy đã kiểm tra. Ảnh: `.local/send-proof/group-account-picker.png`.
- Kiểm tra tự động: 23 bài kiểm tra group-links/projection/conversations/guards/accounts đạt; TypeScript frontend đạt. Connector local đã rebuild và frontend local đã khởi động lại sau khi tiến trình dev dừng giữa lượt kiểm tra. Không gửi tin nhắn hoặc đổi thành viên trong lượt này; không triển khai VPS. Luồng nhiều tài khoản là UI riêng của Team, không có mẫu tương đương trên Web/PC một tài khoản; không báo đã nghiệm thu giao diện PC cho luồng này.

### 03/10/2026 — Tìm người lạ trong inbox, tài khoản thao tác và tìm chính mình

- Thêm `PhoneSearch`: chuẩn hóa số, chờ 350 ms trước tra native; chưa chọn account thì không tra cứu. Đổi account/số hủy kết quả cũ; không mở chat từ response đã lỗi thời hoặc sau khi đóng tìm kiếm. Menu kết quả dùng lại `ConversationListMenu` và các hộp cài đặt/bảo mật; bỏ Phân loại, thêm chọn nhóm của cùng account rồi tái sử dụng `GroupDialog` với người nhận được chọn sẵn.
- Native `friend-action` bổ sung `open` và `status`. Mở mới qua `WQAo.fromSearchList`; xác minh phone/userId/account và trạng thái ẩn trước mở. Zalo không đưa chat tìm kiếm tạm vào ConvList trước tin nhắn đầu, nên connector giữ tập peer đã mở thành công trong bộ nhớ của riêng frame/account. Các adapter chỉ nhận thêm những peer đã xác minh này; kiểm tra identity/ẩn vẫn áp dụng. Không thay dữ liệu ConvList native hoặc cho truy cập mọi hồ sơ cache.
- `FriendshipBanner` đọc friend/request status, hiện Gửi kết bạn hoặc trạng thái lời mời đã gửi/đến; không mời trùng. Tái sử dụng `InboxCreateDialog`, gửi theo UID của chat đã mở và tài khoản cố định. Làm lại form lời mời: Thông tin tài khoản, ảnh bìa native, avatar 80 px, tên, dòng Gửi bằng, ô lời chào 150 ký tự. Chưa bổ sung chỉnh quyền nhật ký từ form này.
- Tìm số chính mình dựa trên UID native của account, không hardcode số: đánh dấu `(Bạn)`, ẩn menu người khác, mở `sendToMeId` My Documents. Thêm bạn cũng không có nút Kết bạn với chính mình và có lối mở My Documents; backend từ chối gửi tới self. Cùng số khi tìm bằng account khác được xử lý theo quan hệ của account đó.
- Đối chiếu trực tiếp Chrome Duy Anh Web: tìm số người nhận do người dùng cung cấp, banner người lạ và modal hồ sơ/lời chào; đọc source Web/PC cho luồng tìm/mở hồ sơ. Không thao tác UI Zalo PC. Team local đã tìm đúng người bằng Duy và Nguyễn Thị Ánh, mở chat người lạ/tải lịch sử/sidebar, mở form đúng Duy, menu thêm vào nhóm chọn sẵn đúng người trong nhóm kiểm thử rồi hủy. Đã thử Duy tìm bản thân mở My Documents không có nút kết bạn; Ánh tìm cùng số vẫn hiện Duy là người khác. Không gửi thêm lời mời, tin nhắn hoặc thêm thành viên thật trong lượt này.
- Kiểm tra TypeScript đạt; 49 test tập trung accounts/guards/friend-actions/messages-loader/send/conversation-info/settings/privacy/group-actions/call-capabilities/call-session/message-actions đạt. Có kiểm tra native open thất bại không cấp quyền, peer tạm không lẫn account/ẩn, gửi UID và chặn tự kết bạn. Connector rebuild local; chưa triển khai VPS. Main search vẫn chưa tìm toàn văn tin nhắn như Zalo. Ảnh: `.local/send-proof/phone-search-stranger.png`, `friend-profile-format.png`.

### 03/10/2026 — Thêm bạn bằng số điện thoại và tạo nhóm từ đầu danh sách

- Nối hai nút hiện có vào `InboxCreateDialog`. Select chỉ cho chọn tài khoản đang kết nối; mặc định theo bộ lọc hoặc chat đang chọn, có tên tài khoản rõ ràng. Đổi account xóa người nhận/kết quả cũ; trong lúc tìm/gửi khóa đổi account.
- Thêm bạn: chuẩn hóa số Việt Nam về mã quốc tế, tìm bằng `UiPd.getInfoByPhone` với nguồn SEARCH_PHONE_GLOBAL, đọc trạng thái `Py3H.getStatusFriendRequest` rồi gửi bằng `requestAddFriend`. Hiển thị tên/avatar, lời chào tối đa 150 ký tự, trạng thái đã là bạn/đã gửi/lời mời đến/tài khoản của mình. Không tự chấp nhận lời mời đến hoặc đổi quyền riêng tư.
- `friend-action` giữ kiểm tra CRM owner, tài khoản kết nối và native identity; trước gửi đối chiếu lại số điện thoại với userId. Biên nhận bền vững chặn gửi lặp khi timeout/retry. Kết quả chưa chắc chắn chỉ cho kiểm tra trạng thái, không tự gửi lại.
- `GroupDialog` nhận thêm account cho luồng độc lập. Native catalog/create được phép không có conversationId; add/manage nhóm vẫn yêu cầu hội thoại và giữ kiểm tra quyền. Component chọn thành viên, API tạo nhóm, biên nhận và mở nhóm sau tạo đều dùng lại.
- Đối chiếu Chrome Duy Anh Web: số thử do người dùng cung cấp trả đúng Nguyễn Kim Oanh; đã xem bước lời chào 150 ký tự. Source PC có cùng `getInfoByPhone`/`requestAddFriend`/`sendFriendRequest`; không dùng Computer Use trên PC.
- Kiểm thử local: Duy gửi lời mời thật thành công tới người nhận người dùng chỉ định; đóng/mở và tra lại vẫn hiện Đã gửi lời mời, không có nút gửi lặp. Đổi select sang Nguyễn Thị Ánh xóa kết quả người nhận cũ. Tạo nhóm tải đúng danh bạ riêng của Duy/Ánh, chọn hai thành viên bật nút Tạo nhóm; đã hủy bản nháp, không tạo thêm nhóm thật trong lượt này. Nhánh standalone create đã kiểm tra adapter tự động; luồng tạo nhóm thật dùng lại phần đã thử trước đó.
- TypeScript đạt; 16 test accounts/guards/friend-actions/group-actions đạt, gồm chống gửi trùng, sai owner/account/target và standalone create. Connector Web đã rebuild local; chưa triển khai VPS. Ảnh: `.local/send-proof/add-friend-account-form.png`, `add-friend-sent.png`, `inbox-create-group.png`.

### 03/10/2026 — Bỏ nút thừa trong sidebar bảo mật

- Bỏ nút “Trò chuyện đã ẩn” từng xuất hiện ở cuối sidebar khi tài khoản đã có PIN. Đây là lối tắt thêm ngoài mẫu Zalo; sidebar tiếp tục dùng các mục bảo mật hiện có, không thay đổi dữ liệu hay trạng thái ẩn hội thoại.
- Đã kiểm tra DOM trên Chrome local: sidebar kết thúc bằng Rời nhóm, không còn nút thừa; bỏ luôn CSS chỉ dành cho nút này. Sửa hiển thị nhỏ, không chạy lại kiểm thử API và không thay đổi VPS.

### 03/10/2026 — Menu thao tác hội thoại khi hover

- Thêm `ConversationListMenu`, thay avatar 16 × 16 bằng `…` khi hover/focus/mở menu; giữ nguyên vị trí thời gian và kích thước dòng. Menu dùng font/icon chung, phân cách và submenu thời hạn theo Zalo Web, có Escape/phím điều hướng và đóng khi click ngoài.
- Tái sử dụng `ConversationSettingsProvider` và `ConversationPrivacy`, gồm các hộp thoại xác nhận/PIN/báo xấu hiện có. Không dựng luồng xóa hoặc ẩn riêng. Mỗi menu gắn đúng account/conversation của dòng kể cả khi đang xem chat của tài khoản khác. Không có Phân loại.
- Bổ sung đánh dấu đã/chưa đọc qua module native `PGx3` và `UnreadDataManager`; chờ xác nhận trạng thái sau lời gọi native. Dấu chưa đọc thủ công được tách khỏi số tin mới (`unreadMarked`) và đưa vào bộ lọc Chưa đọc.
- Kiểm tra: TypeScript không lỗi; 20 test adapter settings/privacy/conversations đạt. Đã đối chiếu trực tiếp menu và submenu tắt thông báo ở Chrome Duy Anh Web, core PC chỉ tham khảo trạng thái đánh dấu đọc; không dùng Computer Use trên PC và chưa nghiệm thu UI PC trực tiếp.
- Đã kiểm thử thật trên Team với nhóm “Kiểm thử tạo nhóm từ Team 01-10” của Duy: đánh dấu chưa/đã đọc, ghim/bỏ ghim, tắt/bật thông báo; trả các trạng thái thử về ban đầu. Khi đang mở nhóm của Nguyễn Thị Ánh, mở menu dòng Duy không đổi chat đang chọn. Hộp thoại ẩn/xóa/báo xấu mở đúng component rồi hủy; không nhập PIN, xóa hay gửi báo cáo thật ở lượt này.
- Connector Web local đã rebuild để áp dụng adapter; không triển khai VPS. Bằng chứng giao diện: `.local/send-proof/conversation-list-menu.png`.

### 03/10/2026 — Avatar tài khoản cạnh thời gian hội thoại

- Thay dòng tên Duy/Nguyễn Thị Ánh dưới preview bằng avatar tròn 16 × 16 px ngay sau thời gian, cùng hàng và cách 4 px. Giữ tên trong tooltip/nhãn truy cập; có chữ viết tắt nếu ảnh lỗi. Bỏ hàng thứ ba, dòng hội thoại về chiều cao 70 px và căn giữa avatar hội thoại.
- `messages-layout.tsx` ghép ảnh bằng `accountId` từ `accounts` của response đang có; bổ sung `accountAvatarSrc` vào kiểu Conversation và dùng lại component Avatar trong ConversationRow. Không đổi API hoặc thêm request tải danh sách.
- Kiểm tra TypeScript no-emit đạt. Trên Chrome `/zalo-team`, đo đủ 127 avatar của hai tài khoản: đều 16 × 16, cách thời gian 4 px, tâm cùng hàng, ảnh tải thành công. Đã xem trực tiếp các hàng My Documents/Trang Nguyễn/Hoà Ads và trạng thái ghim/chưa đọc. Ảnh kiểm tra local: `.local/send-proof/account-avatar-time.png`. Đây là bố cục gộp nhiều tài khoản riêng của Team theo yêu cầu người dùng; không có bố cục tương ứng để đối chiếu trên Zalo đơn tài khoản Web/PC. Chưa triển khai VPS.

### 03/10/2026 — Dọn tích hợp `/zalo` cũ, bảo toàn bộ đối chiếu PC

- Chuyển 40 file nguồn legacy và 543 tệp đính kèm (407.321.627 byte) ra khỏi `apps/` vào `tooling/archive/zalo-legacy-2026-10-03/move/`, giữ nguyên đường dẫn tương đối. Lưu thêm 10 snapshot của file tích hợp dùng chung và migration. `manifest.json` ghi đường dẫn, kích thước, SHA-256; đã đối chiếu đủ 593 file sau khi chuyển. Kho nằm trong `tooling/` bị Git ignore, chỉ có local.
- Gỡ controller/service/model/resource/request/config/OpenAPI legacy cùng 26 route Laravel `/api/zalo/*`, ngoại lệ CSRF bridge và cờ `zaloTestAccess`. Sinh lại Swagger, bỏ 22 path Zalo cũ. Nghiệp vụ Lead/Project `zalo_group` không thuộc module cũ và được giữ.
- `/zalo` dùng redirect Next sang `/zalo-team`; menu CRM trỏ thẳng Team. Không còn khởi tạo giao diện PC qua route cũ. Menu dùng điều kiện tài khoản CRM đăng nhập/đang hoạt động, phù hợp luồng Team hiện tại.
- Bảo toàn `tooling/zalo-bridge`, `tooling/zalo-runtime`, PC bootstrap/prepare của Team, `.local/zalo-*`, các bộ test và Docker container/image/volume PC. Giữ helper `zalo-bridge/asar.mjs` vì codec gọi thoại Team còn dùng. Giữ các migration/bảng Zalo lịch sử; không chạy rollback/drop/truncate hoặc xóa dữ liệu phiên Web.
- Kiểm tra: TypeScript no-emit đạt; PHP lint 3 file tích hợp đạt; so sánh route trước/sau xác nhận 166 route còn lại giữ nguyên; Swagger giữ nguyên định nghĩa của 60 path ngoài Zalo. Hai test native codec đạt khi chạy trực tiếp (test runner tạo child process bị sandbox EPERM). HTTP local xác nhận `/zalo` chứa redirect Team, `/zalo-team` và connector `/health` trả 200. Đây là kiểm tra cleanup local; không phát sinh cuộc gọi/tin nhắn test mới và chưa triển khai VPS.


### 02/10/2026 — Các thao tác bảo mật còn lại của sidebar

- Thêm `ConversationPrivacy` vào overview, dùng `PanelSection` và `TeamDialog` chung: tin nhắn tự xóa (336px nội dung), ẩn với PIN, báo xấu, xóa lịch sử (420px nội dung). Rời nhóm dùng lại component đã kiểm thử; sửa specificity màu đỏ. Icon đồng hồ dùng SVG gốc từ DOM Web, không dùng glyph dấu hỏi; các icon khác giữ font Zalo.
- Native adapter `conversation-privacy.mjs` nằm trong lệnh `conversation-settings` sẵn có: `fBUP.updateAutoDeleteConvers`/TTL store, `EFQ6` HiddenChatManager, `dThN.reportUser`, `smi1.deleteConversation`. Kiểm tra owner, account, conversation hiển thị, quyền trưởng nhóm và các mốc thời gian được gói tài khoản cho phép; không tự dựng timer/xóa tin cục bộ. Mốc 1 giờ khóa theo entitlement native.
- Ẩn dùng PIN Zalo hiện có, hoặc màn hình người dùng tự đặt/nhập lại PIN khi chưa có. Không cho ghi đè PIN có sẵn, giới hạn 5 lần sai/1 phút; PIN không đưa vào biên nhận/log của Team. Danh sách trò chuyện ẩn chỉ trả sau kiểm tra PIN; nút bỏ ẩn gọi native và danh sách chính được cập nhật. Chặn API đọc/gửi/thao tác với chat đã ẩn; lọc cả dòng và preview khỏi inbox, kể cả khi metadata native vẫn giữ ID.
- Xóa lịch sử và báo xấu có biên nhận bền theo owner/requestId/fingerprint, chống gửi lặp khi retry hoặc mất phản hồi. Form báo xấu lấy lý do native, kiểm tra lý do khác; không tự kèm chặn người dùng hoặc xóa lịch sử. Không gửi báo cáo giả để kiểm thử.
- Đối chiếu trực tiếp Chrome Duy Anh Web nhóm `hihi haha`: hộp thoại thời gian, ẩn/PIN, lý do báo xấu, xác nhận xóa. PC chỉ đọc source `compact-app-pc`/shared-worker trong bộ core 26.9.10: cùng luồng updateAutoDeleteConvers, updateStateItemHiddenChat và deleteConversation; không điều khiển UI PC.
- Kiểm thử thật được người dùng xác nhận tại bước xóa: trong `Kiểm thử tạo nhóm từ Team 01-10`, Duy bật 1 ngày → Web và Team đều phản ánh → đưa về Không bao giờ; sau đó xóa lịch sử phía Duy. Inbox còn dòng nhóm phía Ánh, Web vẫn có lịch sử và đủ 3 thành viên. Không xóa hay rời nhóm phía các tài khoản khác.
- Kiểm tra: 34 test tập trung (privacy, settings, inbox, account isolation, group management) và TypeScript frontend đạt. Test bao gồm role/subscription guard, PIN sai/rate limit, ẩn/khôi phục, chống lộ dòng inbox/API và biên nhận không lặp thao tác phá hủy. UI Team đã mở/kiểm tra các modal, radio, lý do khác, hủy, trạng thái đang gửi; không suy ra API báo xấu thật từ mock.
- Bằng chứng local: `.local/send-proof/sidebar-ttl-one-day.png`, `sidebar-history-cleared.png`, `sidebar-report-dialog.png`, `sidebar-hide-pin.png`. Chưa kiểm chứng thật tạo PIN, ẩn/bỏ ẩn (chờ người dùng nhập trực tiếp), chưa gửi báo xấu thật; chưa nghiệm thu UI bởi người dùng và chưa triển khai VPS.

### 02/10/2026 — Quản lý phó nhóm, thành viên và rời nhóm

- Thêm menu thành viên theo mẫu Zalo Web: hàng 64px, avatar 40px, badge trưởng/phó nhóm, nút ba chấm khi hover/focus và menu 184px. Có thêm/xóa phó nhóm, xóa thành viên với xác nhận; Rời nhóm ở sidebar và menu của chính mình. Trưởng nhóm chọn người kế nhiệm trước bước xác nhận rời. Đã đo dialog Team cuối: rộng 422px, header 49px, tiêu đề 16px, nút 40px; nút Rời nhóm màu đỏ. Menu không bị đóng khi khung lịch sử khác tự cuộn vì có tin mới.
- Nối các hàm native `Gm1y.addGroupAdmin/removeGroupAdmin`, `dThN.removeMemberFromGroup/leaveGroup/changeGroupOwner` qua `group-action` hiện có. Kiểm tra lại account, hội thoại đang hiển thị, thành viên và quyền bằng hồ sơ nhóm đầy đủ ngay trước mutation; giữ biên nhận chống gửi lặp khi kết quả chưa rõ. Xóa phó nhóm khỏi nhóm theo thứ tự gỡ vai trò rồi kick; chuyển trưởng nhóm rồi leave có trạng thái partial nếu bước sau lỗi.
- Đối chiếu Chrome Duy Anh Web nhóm hihi haha: menu thường/phó nhóm, dialog xóa và chọn trưởng nhóm mới; đọc core/CSS PC 26.9.10, không điều khiển UI PC. Luồng hồ sơ đầy đủ dùng `topMember.isAdmin`; không dùng riêng `adminIds` của hồ sơ gọn để quyết định quyền.
- Sửa tình huống API đã đổi vai trò nhưng UI báo chưa xác nhận: dùng acknowledgement và cập nhật `topMember` của native controller như Web; không ép đọc replica server ngay sau lệnh role rồi ghi đè cache mới bằng dữ liệu cũ. Xóa thành viên/chuyển owner có đọc xác minh giới hạn, không gửi lại mutation. Sự kiện native `MSG_INFO` về quản lý thành viên hiển thị bằng thông báo hệ thống, không thành bubble của một tài khoản giả.
- Kiểm thử thật trong “Kiểm thử tạo nhóm từ Team 01-10” theo xác nhận người dùng: Duy thêm/xóa phó nhóm cho tài khoản Ánh (tên gợi nhớ Anh Nguyen), xóa thành viên rồi thêm lại; Ánh rời nhóm, hội thoại biến mất ở tài khoản Ánh, Web gốc còn 2 thành viên; Duy thêm lại và Web/Team trở về 3 thành viên, Duy vẫn trưởng nhóm. Không thay đổi thành viên của hihi haha. Kiểm duyệt tự động từng chặn cấp quyền do tên gợi nhớ khác tên tài khoản; chỉ thực hiện sau khi người dùng xác nhận rõ mục tiêu và chuỗi test.
- 20 kiểm thử tập trung và TypeScript đạt; cập nhật fixture sidebar theo transport binding hiện tại. Connector và frontend đã cập nhật local. Nhánh chuyển trưởng nhóm đã kiểm tra tự động (kể cả lỗi một phần) và đối chiếu hộp chọn người kế nhiệm; chưa chuyển quyền trưởng nhóm thật. Không kiểm thử giao diện PC bằng CU, không triển khai VPS. Bằng chứng tại `.local/send-proof/group-*.png`.

### 02/10/2026 — Ghi lịch sử gọi native và sửa thẻ cuộc gọi

- Nguyên nhân: `PortableCall.close()` chỉ gửi `409/sendEndCall`; PC còn gửi riêng `406/sendLogEndCall(callId, partnerId, status, logdata, duration, role)`. Probe core con offline với tài khoản giả/UDP localhost xác minh `status=50` sau kết nối (cả local/remote end), `103` khi hủy trước trả lời, `106` với answer status 3; duration là giây, role true là caller. Không dùng Computer Use trên Zalo PC.
- Thêm log đúng một lần trước dispose connector, đóng băng thời lượng tại thời điểm kết thúc, QoS chỉ gồm codec/counter thật; không gửi SDP/session/device dump và không tạo tin nhắn văn bản giả. Không log cuộc gọi chưa mời thành công. Kết quả log lỗi không cản cleanup; worker trả `historyRecorded` và diagnostic không chứa nội dung cuộc gọi. Những answer status khác 0/3 chưa suy đoán mã log; cuộc gọi đến chưa triển khai.
- `messages.mjs` giữ call metadata theo native `qLCR/r6Qt`: ưu tiên params.duration, isCaller, calltype, isEnableCallback, reason. Thẻ dùng SVG từ package PC, tách trạng thái nhỡ/bận/từ chối/hủy, giây/phút/giờ, giờ bên ngoài; không có Like/reply. Gọi lại dùng cùng `VoiceCall` controller, đúng account/conversation; chưa hỗ trợ gọi video.
- Kiểm chứng Chrome local: bản ghi Anh Nguyen hiển thị đúng 0 phút 11 giây/16:27 như ảnh người dùng. Duy gọi Hoà Ads, thực sự kết nối, kết thúc sau 15 giây; worker xác nhận log accepted, tin calltime xuất hiện qua native history/SSE, preview đổi và còn sau reload. Chỉ gọi Hoà Ads; Anh Nguyen chỉ đọc lịch sử. Âm thanh 721 gói nhận/xác thực, 0 lỗi auth; không ghi âm.
- Đối chiếu PC bằng core/source/SVG và ảnh người dùng; source Web có cùng metadata/call renderer. Chrome Duy Anh Web đang được người dùng sử dụng, chuyển sang hội thoại khác trong lúc tìm chat Duy nên không tiếp tục chiếm tab; chưa đối chiếu trực tiếp cùng bản ghi trên UI Web đó. Bằng chứng local: `.local/zalo-call-assets/call-history-card.png` và `call-history-outgoing.png`.
- Kiểm tra: 8 tests call lifecycle/Opus/SRTP, log một lần/cleanup, normalization và relay scope/dedup đạt; TypeScript frontend đạt. Bộ messages.test.mjs cũ chạy thử còn 3 lỗi fixture `page.exposeBinding is not a function` (mock chưa theo transport hiện tại); 4 tests còn lại đạt, không thay đổi fixture ngoài phạm vi. Connector Docker và worker chỉ cập nhật local, chưa triển khai VPS. Các cuộc gọi cũ bị thiếu log không được tự bịa thời điểm/thời lượng để chèn lại.

### 02/10/2026 — Sửa lỗi khởi động và tiếng nhận giật, bỏ gọi video

- Người dùng xác nhận chiều gửi rõ, chiều nghe Hoà Ads giật. Đã bỏ nút Gọi video khỏi header, tập trung gọi thoại.
- Tái hiện đúng thông báo lỗi: worker nhận callback PCM đầu tiên với bitsPerSample không hợp lệ, báo AUDIO_FORMAT_UNSUPPORTED rồi SDP chờ hết hạn AUDIO_ICE_TIMEOUT. Worker vẫn healthy; nguyên nhân lần tái hiện này không phải mất dịch vụ hay phiên đăng nhập.
- Thêm validPcmFrame: xác minh Int16Array, sample rate, channel và đúng 10 ms mẫu. Bỏ qua callback lỗi đơn lẻ, đếm lỗi và dừng nếu 100 frame lỗi liên tiếp; không diễn giải dữ liệu sai như audio hợp lệ. Lỗi UI cụ thể hơn, log chỉ mã lỗi và số liệu, không lưu nội dung âm thanh/credential.
- Bộ đệm RTP 60 ms sắp packet theo timestamp 16 kHz, xử lý wrap, loại packet đến quá hạn; Opus PLC bù gói mất. Giữ đúng độ dài packet 10/20/40/60 ms. PCM có đệm 40 ms để tránh chèn khoảng lặng khi scheduler và packet lệch pha.
- Tăng lease giai đoạn thiết lập lên 45 giây để đủ thời gian ICE/signaling; khi đang gọi vẫn lease 20 giây có poll gia hạn. Không tự gọi lại khi kết quả signaling chưa rõ.
- 22 kiểm thử tập trung + TypeScript đạt. Vòng WebRTC/Opus 5 giây có trễ/sai thứ tự/mất gói và một callback khởi động lỗi: nhận 500 khung, 90 packet đảo thứ tự, 11 lần PLC, droppedFrames=0, underflows=0; callback lỗi được bỏ qua và phiên tiếp tục. File bằng chứng sạch: .local/zalo-call-assets/rtc-opus-jitter-proof.json.
- Người dùng báo “Tôi vừa test gọi lại, tôi thấy mượt mà rồi”. Đây là xác nhận nghe thực tế trong lượt sửa; phần guard PCM cuối cùng được kiểm chứng hồi quy tự động sau đó và đã đưa vào worker local. Không phát sinh cuộc gọi thử tới Ánh trong lượt này.


### 02/10/2026 — Chrome gọi Zalo cá nhân thành công, hai bên nghe được

- Đối chiếu core PC trong child process riêng để xác định SRTP AES-CM/HMAC-SHA1, cách lấy master key từ session, RTP extension và header ZRTC hai chiều. Vector mã hóa Node khớp core và RFC; không dùng Computer Use trên Zalo PC.
- Triển khai PortableCall: 401 → UDP init → 416 → answer/408 → Opus/SRTP → 409. Có timeout, kiểm source UDP, chống phát lại, scope đúng tài khoản/người nhận và cleanup khi kết thúc/lỗi. BrowserAudio nối PCM bằng codec audify, không mở thiết bị âm thanh hệ điều hành.
- Probe thật ban đầu Duy → Ánh đã nhận 310 gói audio xác thực. Sau khi người dùng đổi đích kiểm thử, toàn bộ thử nghiệm UI chuyển sang Duy → Hoà Ads; không tiếp tục gọi Ánh.
- Chrome Team: gọi Hoà Ads, UI đếm thời gian, thử nút mute (trạng thái active xác nhận qua DOM); cuộc gọi kết nối 39.187 ms. Gateway nhận 5.780 khung PCM từ Chrome, gửi 1.898 và nhận 1.862 gói Zalo. Người dùng xác nhận cả hai bên nghe được. Không lưu bản ghi âm, session key hay SDP trong bằng chứng.
- Sửa lỗi gate định dạng PCM lúc bắt đầu WebRTC; hỗ trợ các rate hợp lệ 12/24 kHz bên cạnh các rate có trước. Bổ sung thống kê định dạng không chứa nội dung âm thanh.
- Phát hiện setInterval(10) trên Windows làm chậm nhịp PCM, khiến queue phải bỏ khung. Thay bằng worker clock ngủ Atomics.wait theo deadline, không khóa event loop. Kiểm tra tổng hợp sau sửa: 499 khung nhận/5 giây, droppedFrames=0, có biên độ âm thanh qua vòng WebRTC + Opus. Đây là kiểm tra tự động, chưa nghe lại trực tiếp bản clock mới.
- API Next kiểm CRM owner, origin, scope và chỉ nối worker loopback bằng bearer ở server. Browser không nhận credential connector. UI có xin quyền micro, hủy trong lúc chờ quyền, mute, dừng track/peer khi đóng hoặc đổi chat. Worker có lease dọn phiên khi browser mất liên lạc.
- Kiểm tra cuối: 16 bài tập trung (scope/relay, SRTP, Opus, lifecycle, browser media, audio clock) đều đạt; TypeScript frontend và cú pháp worker đều qua. Nút gọi được kiểm tra enabled trên đúng Hoà Ads sau khi khởi động bản worker mới.
- Bằng chứng sạch: .local/zalo-call-assets/portable-call-proof.json, chrome-call-proof.json, rtc-opus-proof.json. Lệnh chạy local: tooling/zalo-team/call/start-local.ps1. Chưa triển khai VPS/Linux, cuộc gọi đến, video/nhóm, xử lý jitter/RTCP/keepalive cho phiên dài còn cần làm tiếp.


### 02/10/2026 — Giải được SRTP và đóng gói media qua đối chiếu core riêng

- Core thử nghiệm có PID/pipes riêng, tài khoản/session giả, chỉ media localhost; không attach Zalo PC đang dùng. Dùng Frida cài riêng dưới `.local` để quan sát policy và tạo vector mẫu; không đưa Frida vào runtime sản phẩm.
- `srtp.mjs`: derive key theo RFC 3711, xác thực HMAC trước giải mã, chống replay, xử lý rollover/reordering và xóa key khi đóng. Khóa mặc định của nhánh đã quan sát là 30 byte đầu session; profile khác bị từ chối.
- `zrtc-media.mjs`: framing gửi/nhận bất đối xứng theo parser core. `probe-native-offline.mjs --local-audio` giả lập ACK/answer, 135 gói core→Node xác thực thành công và một gói Node→core giải mã `status:0`; không lưu nội dung audio.
- Kiểm tra 5 bài SRTP đã qua, gồm vector RFC và vector thực từ core. Phần UI và gọi thật chưa nghiệm thu; tiếp tục nối media vào WebRTC.

### 02/10/2026 — Tự đọc core PC, xác minh request 401 và handshake UDP bằng Node

- Không yêu cầu người dùng thu thập thêm. Đọc source IPC và binary PC 26.9.10, chạy engine trong child riêng với named pipes riêng, không điều khiển giao diện PC hoặc gắn vào phiên PC đang chạy. Phiên giả không chuyển signaling ra Zalo; fixture media chỉ trỏ localhost, không chứa session thật.
- Core tạo callId số dương 32 bit, codec `[]\n`, type 1. Request thực tế được connector của Duy chấp nhận, trả status 0 và cấu trúc fromId/toId/sessId/servers/zrtc_config. Mã Node tái tạo request này cũng được chấp nhận mà không khởi động native engine. Probe cũ dùng timestamp 13 chữ số và codec null; đã sửa theo capture, chưa tách riêng biến nào gây 114.
- Bắt gói caller-init 183 byte của core tới localhost; viết encoder `zrtc-init.mjs` khớp từng byte với capture. Node gửi đúng gói tới một RTP server do phiên thật cấp, nhận ACK 55–56 byte. Disassemble parser core để xác định LE result/callId/token/string; parser Node xác minh status 0, callId khớp, token có giá trị. Chưa biết ý nghĩa chuỗi cuối ACK; không coi nó là địa chỉ hoặc khóa SRTP.
- ACK giả localhost làm engine xuất lệnh 416: codec opus/16000/1 payload 112, frmPtime 20, session và extendData (packetMode 2, srtpMode 1, serverAddr/p2p...). Lệnh này chỉ được bắt, không chuyển ra mạng. Các lần thử thật chỉ gồm 401 và tối đa một UDP init, không gửi lời mời/audio. Các phiên connector được đóng; bản probe mới bổ sung end 409 có chờ phản hồi trước close thay cho chỉ dựa vào dispose best-effort.
- Thêm `voice-request.mjs`, `zrtc-init.mjs`, các test và probe core/offline/portable. 10 focused tests đạt; syntax check ba probe đạt. Default test runner gặp spawn EPERM; chạy lại cùng test với `--test-isolation=none` đạt. Engine không khởi động trong sandbox; chạy child được kiểm tra hash qua escalation thành công. Thư viện pefile/Capstone từ PyPI chỉ nằm trong thư mục nghiên cứu `.local`, không sửa cài đặt Zalo.
- Checkpoint và địa chỉ hàm core cần đọc tiếp: `tooling/zalo-team/call/PROTOCOL-RESEARCH.md`. Còn SRTP, đóng gói audio, keepalive/lifecycle và nối WebRTC; chưa gọi hoàn chỉnh, chưa nghiệm thu UI, không triển khai VPS hay bật runtime Zalo cũ.

### 02/10/2026 — Phân tích body web-start thực tế do người dùng cung cấp

- Đã có payload và response thực tế của `https://zalo.salework.net/api/call/web-start` do người dùng chép từ DevTools. Phân tích thụ động, không phát lại request hoặc kết nối trực tiếp tới media node của Salework. Không lưu sessId, ICE password hoặc toàn bộ SDP vào tài liệu.
- Payload gồm accountId/calleeId dạng chuỗi, callType 0 và SDP offer audio. Offer có sendrecv, setup actpass, rtcp-mux, ice-options trickle; không có candidate trong body được cung cấp. Danh sách codec gồm Opus, RED, G722, PCMU, PCMA, CN và telephone-event.
- Response gồm error_code 0, status success; data có callId, requestResult, calleeId, answer, mediaNode, callType, sessId. requestResult.status 0 và hai ID số ngắn hơn ID tài khoản ngoài; chưa biết nguồn hoặc cách ánh xạ nên không coi chúng là ID người dùng thay thế. Trường sessId là giá trị opaque; chưa biết là phiên media hay phiên upstream, không đồng nhất với `session` của Zalo PC.
- SDP answer có sendrecv, setup active, fingerprint SHA-256, rtcp-mux và bốn codec Opus/48000/2 (PT111), G722/8000 (PT9), PCMU/8000 (PT0), PCMA/8000 (PT8). Đây là các codec được thương lượng, chưa chứng minh codec đang dùng hoặc codec trên chặng server↔Zalo. setup active chỉ vai trò DTLS chủ động gửi ClientHello, không phải trạng thái người nhận đã nhấc máy.
- Answer quảng bá cùng một IP public với trường mediaNode, ba cổng UDP 40054/40091/40031, mỗi cổng có component 1 và 2, typ host, end-of-candidates. Có sáu candidate lines nhưng ba địa chỉ IP:port, không phải sáu audio streams. Không có typ relay hoặc ice-lite trong answer này. Cần selected-candidate-pair stats mới biết cổng đã dùng; typ host không chứng minh không có gateway/relay xử lý media phía sau.
- `mediaNode` là URL HTTP cổng 8088 nhưng âm thanh phía Chrome được mô tả bằng UDP/TLS/RTP/SAVPF và ICE candidates. Không suy ra truyền âm thanh plaintext HTTP từ trường này. Không suy ra API quản trị hoặc đường dẫn trên cổng 8088.
- Đối chiếu bundle đã tải: không có tên mediaNode, sessId hoặc requestResult; đường outgoing đọc callId/answer để cập nhật state và setRemoteDescription. Các trường bổ sung có thể là thông tin server trả kèm, chưa phải thao tác browser cần thực hiện. Offer chưa có candidate có thể tương thích việc server học peer-reflexive candidate qua ICE checks; chưa có packet trace để khẳng định cơ chế thực tế (RFC 8445 §7.3.1.3).
- Đối chiếu source PC: requestCall đi qua `/api/voicecall/requestcall` với calleeId/callId/codec/typeRequest/imei; sendRequestCall đi qua `/api/voicecall/request` với địa chỉ RTP/RTCP/codec/session/callId. Response Salework không lộ các request upstream này; requestResult tương ứng bước nào vẫn chưa xác minh. Không lấy callType 0 của Salework thay trực tiếp cho typeRequest native.
- Hướng nghiên cứu: dựng media service của Team làm WebRTC peer của Chrome, tái sử dụng connector phiên cá nhân cho signaling; phải chứng minh chặng media/signaling server↔Zalo trước khi báo gọi được. Chưa đủ bằng chứng chọn thư viện server (Pion/aiortc/libwebrtc), hệ điều hành hoặc kết luận có/không engine native. Nhánh Wine/driver tiếp tục tạm dừng; không đổi runtime hiện tại.
- Chuẩn tham chiếu: [RFC 5763 §5](https://www.rfc-editor.org/rfc/rfc5763#section-5), [RFC 8445 §7.3.1.3](https://www.rfc-editor.org/rfc/rfc8445#section-7.3.1.3). Đây là phân tích dữ liệu được cung cấp, không phải một lần gọi kiểm thử mới hoặc bản Team đã triển khai.

### 02/10/2026 — Chuẩn bị đối chiếu payload/response cuộc gọi Salework

- Người dùng yêu cầu đọc payload/response thực tế để tiếp tục triển khai. Kiểm tra lại khả năng trình duyệt: tab chỉ có pageAssets, browser chỉ có viewport, dev chỉ cung cấp console; không có Network response body. Console lọc `/api/call/` và `voip` không có kết quả. Chưa thu được payload/response của cuộc gọi thật và không gọi thêm khi chưa có phương tiện ghi nhận.
- Đã yêu cầu người dùng lấy riêng Payload và Response của `web-start` trong DevTools Network sau khi gọi Duy; không yêu cầu Headers/cookie/token. Cần đọc SDP offer/answer thực tế trước khi suy luận codec, ICE candidates và vai trò DTLS của endpoint phía server.
- Kiểm tra thêm bundle công khai: Axios interceptor trả `response.data`, vì vậy `{status, data:{callId, answer}}` là cấu trúc body mà ứng dụng đọc. Client tạo offer audio rồi gửi ngay; không tìm thấy `onicecandidate`, `addIceCandidate` hoặc `iceGatheringState` trong bundle đã tải. Chưa đủ bằng chứng kết luận cấu hình ICE thực tế của server. Các route call tìm được trong bundle gồm web-start, web-answer, end và history-by-conversation.
- WebSocket dùng STOMP qua SockJS `/websocket`; bộ xử lý nhận `type === "voip"` hoặc `event === "voip"`. Đây là phân tích source, chưa phải bản ghi frame của lần gọi. Không thay đổi code/runtime của Team.

### 02/10/2026 — Gọi thử Duy từ Salework trên Chrome

- Người dùng cho phép gọi thật tới Duy. Xác nhận đúng hội thoại trước khi bấm Gọi thoại; cửa sổ gọi hiển thị tài khoản Hoà Nguyễn. Không điều khiển Zalo PC, không đổi thiết lập tài khoản, không lấy cookie/token, không gọi lại lần hai.
- Lần gọi mới có OFFER lúc 08:39:13.150 UTC và ANSWER lúc 08:39:14.304 UTC: khoảng 1,154 giây giữa hai log, không phải phép đo RTT riêng của HTTP hoặc thời gian tới chuông phía người nhận. Micro `live/en=true/mute=false`, một sender, SDP/transceiver `sendrecv`.
- Log sau answer 2 giây: outbound 93 packet, chưa có inbound stats (`-1`), ICE connected. Sau 4 giây: outbound 193 packet, inbound 1 packet, ICE connected. UI quan sát được bộ đếm `00:02`, nút Tắt mic/Kết thúc. Sau đó cửa sổ gọi đóng và lịch sử hiển thị cuộc gọi đi 6 giây lúc 15:39; agent chưa bấm Kết thúc, chưa xác định bên kết thúc.
- Đối chiếu bundle công khai `index-CwFPJe6J.js`: outgoing POST `/api/call/web-start` với `{accountId, calleeId, callType:0, offer}`; nhận `{status:"success", data:{callId, answer}}`; apply SDP answer. Sự kiện WebSocket `answer`/`answer_ack` status 0 chuyển outgoing sang in-call; `end_call`/`cancel` đóng cuộc gọi. Khi người dùng chủ động kết thúc, client POST `/api/call/end` với `{accountId, uidTo, callId, status, duration}` và dừng media. `/api/call/web-answer` là nhánh nhận cuộc gọi, chưa test trong lần này.
- Người dùng trả lời “Có nghe được” cho câu hỏi phía Duy có nghe âm thanh từ trình duyệt không: đã xác minh chiều Chrome → Duy bằng nghe thực tế. Chưa xác nhận chiều Duy → Chrome bằng nghe thực tế.
- Giới hạn bằng chứng: công cụ trình duyệt phiên này chỉ có console/DOM, không có Network capture. Các endpoint/body/event trên lấy từ source, chưa phải HAR của lần gọi; không ghi nhận callId/SDP thực tế. RTP nhận được chưa chứng minh nghe rõ tiếng hai chiều. Chưa xác định backend Salework nối sang Zalo bằng engine/giao thức nào.
- Chỉ cập nhật kết quả nghiên cứu; không thay code gọi của Team, không bật nút gọi và không triển khai server.

### 02/10/2026 — Đối chiếu Salework v2: có cuộc gọi WebRTC từ trình duyệt

- Người dùng cung cấp URL hội thoại Salework v2 đang mở trong Chrome Duy Anh Web. Chỉ đọc DOM, bundle JavaScript công khai và console log đã có; không bấm gọi mới, không cấp quyền micro, không xuất cookie/token, không thay thiết lập tài khoản.
- Xác nhận UI: tài khoản trong bộ chọn được ghi “Liên kết web”; chat có nút Gọi thoại và lịch sử cuộc gọi thoại đi 3 giây. Console `[CALL-DEBUG]` đã có OFFER/ANSWER sendrecv, ICE connected; ở mốc 4 giây ghi packetsSent=193, packetsReceived=10. Đây là bằng chứng browser đã truyền/nhận gói RTP, không phải kiểm chứng bằng tai chất lượng hai chiều của agent.
- Bundle quan sát trực tiếp từ document.scripts: `https://zalo.salework.net/v2/assets/index-CwFPJe6J.js`. Các hàm: F1 xin getUserMedia(audio=true), tạo RTCPeerConnection với STUN và SDP offer; N9 gửi `/api/call/web-start` với accountId/calleeId/callType/offer, nhận callId/answer; z1 áp SDP answer. k9 gửi `/api/call/web-answer` cho chiều nhận; `_l` gửi `/api/call/end`. Host API cùng origin, WebSocket `/websocket`; trạng thái nhận qua sự kiện voip (request/answer/answer_ack/end_call/cancel). Không có yêu cầu mở Zalo PC bằng deep link trong luồng placeCall đã đọc.
- Điều kiện nút gọi trong code: `user.host === "CALL"` hoặc account.loginType === "PC". Vì vậy nhãn liên kết web vẫn có thể hiện nút gọi khi host hỗ trợ CALL; không được suy ra mọi phiên đăng nhập web đều có cùng khả năng. Quan sát này cũng không cho biết backend chạy Linux, Windows, engine native, gateway RTP hay engine riêng.
- Sửa kết luận trước: chưa làm được trong Team không chứng minh chức năng bất khả thi. Chưa đủ cơ sở bắt buộc dùng Wine, Windows hay driver ảo. Ưu tiên nghiên cứu media/signaling server↔Zalo; giữ transport Chrome đã có để dùng lại. Không gọi API Salework bằng tài khoản người dùng để thay backend Team và không sao chép token/phiên.
- Bản bundle lưu ở `.local/salework-research/` để tra cứu, không đưa mã bên thứ ba vào source sản phẩm. Chỉ cập nhật checkpoint, không thay code/runtime Team trong lượt khảo sát này.

### 02/10/2026 — Relay gọi cá nhân, scope người nhận và engine Windows

- Người dùng xác nhận Zalo cá nhân và yêu cầu bắt đầu hướng Chrome/WebRTC + Windows engine. Không chuyển sang OA/ZCC. Không tiếp tục Wine, không cài driver hoặc thay thiết bị Windows mặc định trong lượt này.
- Xác định đúng peer: trong phiên Duy người nhận hiển thị `Anh Nguyen`; cùng nhóm kiểm thử ở phiên Ánh xác nhận thành viên tương ứng là tài khoản Nguyễn Thị Ánh qua vị trí thành viên và cùng tài nguyên ảnh đại diện. UID peer khác externalId của tài khoản tự đăng nhập, nên không dùng so sánh externalId trực tiếp hay chỉ đoán theo tên. ID/scope kiểm thử chỉ lưu local, không ghi thông tin riêng tư vào tài liệu.
- Thêm `web/call-session.mjs` và tích hợp accounts/guards/server: chuẩn bị session, polling control, relay 8 lệnh signaling cá nhân, đóng session. Kiểm tra owner/account online, identity, inbox, peer, callId; giữ callback native trước đó, khôi phục khi đóng/lease hết, giới hạn hàng đợi, sequence chống gửi lại cùng HTTP mutation. API nằm trong connector nội bộ có bearer; chưa mở qua frontend route.
- `call/native-session.mjs`, `connector-client.mjs`, `windows-call.mjs`: native child + named pipes độc lập, init bằng danh tính từ connector, relay có thứ tự và polling; dọn child/pipe khi lỗi hoặc kết thúc. Chọn virtual devices bằng tên, chuyển nguyên guid/id native, kiểm tra readback không tự chọn hoặc fallback thiết bị vật lý rồi mới cho `makeCall`. `audio-worker.mjs` có nhánh Windows chuẩn bị engine, `/start` chỉ khi WebRTC connected, xử lý một phiên và cleanup. Đây là code tích hợp **chưa kiểm chứng nhánh makeCall trên thiết bị ảo**.
- Kiểm chứng live local: `probe-relay.mjs` khởi tạo đúng Duy, native-ready và listDevice đạt, dọn relay/child thành công. Danh sách chỉ có Realtek input/output (không mở stream micro); mặc dù autoAudioInput/Output=false, default vẫn Realtek. Vì vậy không gửi makeCall để tránh dùng âm thanh vật lý của worker. Đã hỏi người dùng chọn worker Windows riêng hoặc cho phép cài driver máy hiện tại; chưa có trả lời tại checkpoint này.
- `probe-signaling.mjs --negotiate` thử requestCall và endCall cho đúng peer đã được cho phép, dùng callId/codec tối thiểu do probe tạo. Kết quả 114, không có bằng chứng đổ chuông/kết nối. Source Web định nghĩa PARAMS_INVALID=114; không được suy ra tài khoản Web bị cấm gọi từ phép thử này. Dừng thử các tham số tự đặt; bước tiếp theo phải dùng dữ liệu thật do native engine sinh. Script này là probe chẩn đoán, không phải luồng gọi sản phẩm.
- 22 tests codec, quyền micro/cleanup, thiết bị ảo, scope/identity, callback preservation, event filtering và dedup đạt; syntax checks đạt. Connector local đã build bản relay cuối cùng; probe init/listDevice/cleanup chạy lại đạt. Worker âm thanh thí nghiệm build lại; Chrome dùng CallMedia nhận đỉnh 445.3125 Hz từ nguồn 440 Hz, 45 frame vào/35 frame ra, không drop; mute/track ended/peer closed đạt. Worker tổng hợp được dừng sau thử nghiệm. Không mở/điều khiển UI Zalo PC, không sửa ứng dụng Zalo đang chạy, không gửi tin chat. Bằng chứng bỏ qua Git: `.local/zalo-call-assets/signaling-proof.json`, `relay-preflight-proof.json`, `browser-audio-proof.json`.
- Còn thiếu: worker Windows có thiết bị ảo, kiểm thử signaling thực do engine tạo, nhận/chấp nhận/kết thúc và nói/nghe hai chiều, trạng thái cuộc gọi native, giao diện Chrome/API frontend, route media khi chạy máy khác (bản thử hiện bind localhost). `start-windows.ps1` cấu hình rõ 4 endpoint audio cho thử nghiệm local, không phải cài đặt dịch vụ production. Chưa nghiệm thu và chưa triển khai VPS.

### 02/10/2026 — Triển khai transport âm thanh Chrome và adapter Windows cho gọi thoại

- Người dùng yêu cầu mọi thao tác/micro/loa ở Chrome như Meet. Triển khai `apps/frontend/src/features/zalo-team/call-media.ts`: xin quyền micro, SDP/ICE có timeout, phát audio nhận bằng `HTMLAudioElement`, mute, đổi micro bằng replaceTrack, chọn loa bằng setSinkId khi trình duyệt hỗ trợ. Hủy trong lúc chờ quyền sẽ dừng stream ngay khi quyền trả về; lỗi thay micro giữ micro cũ và dừng stream mới. Đây là module transport, **chưa gắn vào giao diện gọi hoặc API signaling**.
- Worker thí nghiệm tại `tooling/zalo-team/call/`: WebRTC audio source/sink, PCM 48 kHz, buffer giới hạn, token nội bộ, scope owner/account/hội thoại, một phiên hoạt động và lease 20 giây. Endpoint chỉ phục vụ âm thanh, luôn báo `nativeLinked:false`; không thay thế xác minh tài khoản của connector và không nhận lệnh Zalo tùy ý. Windows bind loopback mặc định; Docker test publish TCP/UDP trên localhost. Token, PCM, SDP và dữ liệu đăng nhập không ghi vào nhật ký.
- Viết `pipe-host.c` tạo hai named pipe duplex riêng và chạy native child của probe; kiểm chứng trên Windows với bộ engine tối thiểu sao chép từ cài đặt hiện tại cho kết quả native-ready. Không điều khiển giao diện PC, không nối vào pipe của ứng dụng người dùng. Trong container probe độc lập, cùng engine lỗi `EXCEPTION_ACCESS_VIOLATION c0000005` trước IPC kể cả thử prefix 32 bit; đã ngừng thử lại Wine. Không khởi động dịch vụ/profile Zalo cũ; image cũ chỉ dùng làm lớp phụ thuộc cho image thí nghiệm mới.
- `windows-audio.mjs` dùng WASAPI/Audify, chỉ mở đúng cặp virtual input/output được cấu hình, không fallback sang micro/loa vật lý hay thiết bị mặc định. Preflight trên máy trả `VIRTUAL_AUDIO_DEVICES_MISSING`. Đã tải VB-CABLE/Hi-Fi Cable từ nguồn chính thức và kiểm tra chữ ký bộ cài hợp lệ; **chưa cài driver, chưa đổi mặc định, chưa khởi động lại**. Đã hỏi người dùng vì đây là thay đổi driver hệ thống cần Administrator và nhà phát hành yêu cầu reboot; đang chờ trả lời. Chữ ký hợp lệ không chứng minh driver sẽ tương thích máy hiện tại.
- Kiểm chứng: 8 tests codec, chọn thiết bị/đổi định dạng PCM, quyền micro trả muộn, mute qua đổi thiết bị, cleanup khi SDP/replaceTrack lỗi đều đạt; TypeScript riêng module CallMedia đạt. Build image âm thanh thành công, dependency audit trả 0 vulnerabilities. Chrome headless riêng dùng đúng module CallMedia với nguồn 440 Hz tổng hợp, nhận đỉnh FFT 445.3125 Hz; worker nhận/phát 36 frame, không drop, cleanup mute/track ended/peer closed đều đạt. Không mở micro vật lý, không sử dụng profile Chrome cá nhân, không phát cuộc gọi hay gửi tin Zalo trong thử nghiệm này.
- Bằng chứng local bỏ qua Git: `.local/zalo-call-assets/browser-audio-proof.json`, `native-wine-diagnostic.log`. Script tái lập: `node tooling/zalo-team/call/test-browser-audio.mjs` với compose audio-test đang chạy; loopback của compose **chỉ để kiểm thử tổng hợp**, không dùng khi nối cuộc gọi thật.
- Phần còn thiếu: cài và kiểm chứng cặp driver nếu được cho phép, nối đúng thiết bị vào engine, relay signaling theo owner/account, xác định chính xác peer Nguyễn Thị Ánh của Duy, gắn giao diện gọi Chrome và thử nói/nghe hai chiều Duy→Nguyễn Thị Ánh. Chưa nghiệm thu UI/cuộc gọi thật, chưa triển khai VPS. Việc cho phép cài driver không đồng nghĩa các phần này đã hoàn thành.

### 02/10/2026 — Bắt đầu triển khai gọi thoại: kiểm chứng engine và khả năng phiên Web

- Người dùng chốt triển khai và cho phép test Duy gọi Nguyễn Thị Ánh. Chưa phát cuộc gọi nào. Đã hỏi lựa chọn âm thanh browser (dùng từ máy khác) hay micro/loa Windows cho bản đầu; chưa nhận câu trả lời tại checkpoint này.
- Thêm `tooling/zalo-team/call/native-codec.mjs` và `probe-native.mjs`: kiểm tra hash đúng build, đọc riêng hằng số transport từ bundle bằng parser chuỗi, không thực thi bundle/đọc profile. Mỗi probe tạo hai named pipe UUID riêng, chạy child ẩn, tự dừng đúng child. Không gắn vào pipe/process của Zalo PC đang chạy; không ghi/in khóa transport hoặc payload IPC. Codec xử lý frame chia/gộp, giới hạn kích thước và từ chối frame lỗi. Mã hóa này chỉ dành IPC tương thích native, không dùng làm xác thực API mạng.
- Kiểm chứng ngoài sandbox: engine kết nối cả hai pipe, giải mã đúng `update/native-ready`. Probe thiết bị khởi tạo danh tính test không đăng nhập rồi `request/listDevice`; nhận phản hồi có các nhóm thiết bị input/output/video. Không gọi `makeCall`, không gửi tín hiệu Zalo. Lần chạy sandbox ban đầu thoát -2; chạy với quyền cần thiết kết nối được, nên không quy kết lỗi này cho cơ chế single-instance.
- Thêm `web/call-capabilities.mjs`, tích hợp guard/accounts/server. Chỉ trả khả năng method, không gọi API signaling hay thay callback native. Tài khoản/hội thoại phải thuộc owner và phiên online/đúng danh tính. Runtime Duy có đủ 9 hàm signaling được kiểm tra, nhưng `canCall`, `sessionCallingVerified`, `mediaConnected` vẫn false. Tra theo externalId của tài khoản Nguyễn Thị Ánh chưa tìm thấy hội thoại cá nhân tương ứng trong inbox Duy; cần xác định đúng peer trước test, không đoán bằng tên gần giống.
- Build lại worker local; hai account vẫn có trong kết quả danh sách. 11 checks codec/capabilities/guards/accounts đạt bằng `node --test --test-isolation=none ...` (test runner mặc định bị sandbox spawn EPERM). Chưa sửa UI gọi, chưa nghiệm thu cuộc gọi/âm thanh/nhận-hủy-kết thúc, chưa triển khai VPS. Bridge âm thanh từ browser vào engine là phần còn thiếu; interface đã kiểm tra chỉ lộ lựa chọn thiết bị Windows, chưa tìm thấy cổng PCM/browser stream trong IPC.

### 02/10/2026 — Khảo sát khả năng gọi điện từ Zalo Team (chưa triển khai)

- Đọc core PC 26.9.10: controller gọi `OU7N.makeCall`, gửi `{type:request, command:makeCall}` qua `$zcall.sendDataToNative`; khởi tạo bằng `$zcall.initCall`. Native phát tín hiệu để JS gọi `sendRequestCall`, `sendRingRingCall`, `sendAnswerCall`, `sendEndCall` với địa chỉ RTP/RTCP, codec và thông tin phiên. Chưa chứng minh phiên Web đăng nhập hiện tại dùng được các tín hiệu này.
- Cài đặt Windows hiện có `plugins/capture/ZaloCall.exe`, `native/nativelibs/zcall/zcall_ia32.node`. `binding.js` chọn Windows/macOS, nền tảng khác trả not support. Vì vậy không thể coi API gọi PC là tính năng JavaScript có thể đưa thẳng vào Chromium Linux Docker hiện tại. Chưa xác minh engine có thể chạy độc lập khỏi app PC.
- Đề xuất POC, chưa phải quyết định: nghiên cứu tách signaling và engine âm thanh; nếu phải giữ runtime PC, dùng worker Windows phía server + đường âm thanh browser↔worker (ví dụ WebRTC), kiểm chứng chuyển âm thanh hai chiều và phiên đúng account trước khi làm UI production. Docker Linux/Web hiện tại tiếp tục là luồng nhắn tin; hướng gọi thuần trình duyệt chưa xác minh khả thi. Không khởi chạy native engine, không gọi ai trong khảo sát này.

### 02/10/2026 — Giảm giật ô nhập khi gõ nhanh

- Tách `ConversationComposer` tự theo dõi bản nháp khỏi lịch sử. `useSendDraft(..., 'history')` chỉ cập nhật phần lịch sử khi outbox/trạng thái gửi hoặc điều kiện nháp rỗng thay đổi; không render lại toàn bộ tin nhắn mỗi ký tự. Hàm gửi vẫn đọc bản nháp mới nhất đồng bộ, không debounce việc giữ/gửi nội dung.
- Editor giữ DOM và caret do trình duyệt cập nhật khi gõ văn bản thường. Chỉ dựng lại khi cần emoji/mention/định dạng, thao tác chèn/undo hoặc thay đổi từ ngoài; snapshot đã paint ngăn layout effect paint lần hai. Văn bản không định dạng bỏ qua ma trận style theo ký tự; trạng thái toolbar định dạng được so sánh trước setState. Giữ nguyên guard IME và dọn DOM khi xóa hết.
- Đo React Profiler local trong My Documents Duy cùng chuỗi 37 ký tự: 76 commits trước/sau, tổng actualDuration giảm khoảng 495 ms xuống 21,6 ms. Đây là thời gian React render cộng dồn trong bản dev, không phải phép đo độ trễ bàn phím end-to-end hay cam kết cho mọi máy. Bộ đo tạm đã bỏ; số liệu ở `.local/send-proof/typing-render-comparison.json`.
- Kiểm tra Chrome Team: gõ nhanh đủ chữ, tiếng Việt Unicode, sửa giữa câu, Shift+Enter, emoji sau tải catalog, Ctrl+B, undo, gõ tiếp, chuyển hội thoại giữ nháp; xóa hết trả về ô cao 23px/không còn node. Dọn nháp test, không gửi tin. `tsc --noEmit` và 9 tests rich-text/mentions đạt. Chưa kiểm chứng riêng bộ gõ Telex/VNI vật lý hoặc đo hiệu năng PC; không dùng Computer Use trên PC. Local đã cập nhật, chưa deploy VPS.

### 02/10/2026 — Hiện người thả cảm xúc khi hover

- Projection tin nhắn bổ sung người thả cảm xúc từ native reaction map, dùng tên trong user cache và batch bổ sung profile còn thiếu cùng tác giả tin nhắn. Giữ số lượt theo từng cảm xúc; gộp tên trùng khi một người thả nhiều loại. Tài khoản hiện tại hiển thị Bạn; không suy ra tên từ người gửi tin.
- Hover/focus vào cụm biểu tượng + số lượt mở tooltip nền tối có danh sách tên. Giữ nút gửi cảm xúc/palette riêng và quy tắc hover của nút Like. Tên được tải cùng dữ liệu tin, không có request riêng khi hover; thiếu profile hiển thị Người dùng Zalo.
- Đã build lại worker local, kiểm tra trực tiếp đúng tin người dùng chỉ ra trong nhóm: tooltip trả tên từ native và hiển thị được trên Team. Đối chiếu cấu trúc reaction của Web và style user-reacted-container trong core PC. `tsc --noEmit` và 10 tests messages-loader/message-actions đạt, gồm tên, self identity, nhiều loại, profile thiếu, thu hồi. Không thao tác gửi thêm cảm xúc và chưa deploy VPS.

### 02/10/2026 — Thu gọn toolbar và chỉ hiện Like khi cần

- Tạm bỏ bốn nút danh thiếp, chụp màn hình, tin nhắn nhanh và thông tin chuyển khoản khỏi toolbar soạn tin; giữ Sticker, Ảnh, File, Định dạng, Thêm.
- Nút thả cảm xúc ở tin cũ chỉ hiện khi hover/focus trong tin; tin cuối cùng trong danh sách luôn hiện nút. Dùng cờ riêng `latest`, không dùng `last` của cụm tin cùng người gửi. Số lượng/cảm xúc đã nhận vẫn hiển thị; icon nút vẫn 14px.
- Kiểm tra Chrome Team: 48 nút, mặc định 47 ẩn và một nút ở tin cuối hiện; hover tin cũ hiện thêm đúng một nút, rời chuột trở về một nút. Toolbar có đúng năm nút còn lại. `tsc --noEmit` đạt. Đối chiếu DOM các trạng thái `show-react-btn` trên Web và core CSS reaction của PC; không chạy UI PC. Ảnh local `.local/send-proof/composer-like-visibility.png`. Chưa deploy VPS.

### 02/10/2026 — Đổi tên từ header cuộc trò chuyện

- Hover tên trên header hiện icon sửa 16px trong nút 24px, cách tên 8px; rời chuột thì ẩn, focus bàn phím vẫn hiện. Tên giữ một dòng và ellipsis.
- Header và sidebar dùng chung `ConversationSettingsProvider`, cùng state/quyền, API và dialog đổi tên hiện có. Không gọi thêm API settings riêng cho header; nút vẫn mở được khi sidebar đóng. Provider tách theo hội thoại/tài khoản và cập nhật tên hiển thị sau khi lưu.
- Đã kiểm tra trực tiếp trên Team: hover hiện/rời chuột ẩn, mở đúng Đặt tên gợi nhớ khi sidebar đóng; header và sidebar nhóm cùng mở một dialog Đổi tên nhóm; tên nhóm có `nowrap`/`ellipsis`. Không đổi tên dữ liệu thật trong lần kiểm tra này. `tsc --noEmit` đạt.
- Đối chiếu DOM Zalo Web: `main-title-container`, edit icon 24px, margin-left 8px; core CSS PC có quy tắc ẩn edit-icon và hiện khi hover. Không kiểm tra UI PC bằng Computer Use. Ảnh header local: `.local/send-proof/header-rename-hover.png`. Đã chạy local, chưa deploy VPS.

### 02/10/2026 — Tạo nhắc hẹn và ghi chú qua phiên Web native

- Thêm `topics.mjs`, `topics.ts`, `topic-create.tsx`, `topic-event.tsx`; nối command `topic-action` qua route có xác thực, worker scheduler và phiên đúng account/conversation. Kiểm tra identity, hội thoại native, tư cách thành viên, quyền ghim, thời gian tương lai và schema chặt. Receipt theo owner/requestId và fingerprint chống tạo trùng, kể cả sau restart; kết quả không rõ không tự gửi lại.
- Form ghi chú rộng 440px, nội dung nhiều dòng, ghim lên đầu trò chuyện; form nhắc hẹn rộng 500px, chọn nhanh 15/30 phút, 09:00 ngày mai hoặc thời gian tùy chọn, kiểu lặp. Hiển thị sự kiện ghi chú có Xem, nội dung đầy đủ/copy, mở từ thanh ghim; nhắc hẹn có thẻ lịch và Xem chi tiết.
- Native Docker hiện dùng API topic cũ (`createGroupTopicv2`/`createOneOneGroupTopic`), khác bản Chrome mới có ReminderManager. Giữ nhánh native phù hợp phiên, khóa nhắc riêng/lặp nhiều ngày/hằng năm khi thiếu capability. Không dùng timer CRM để thay thế lịch Zalo.
- Kiểm chứng: tạo một nhắc hẹn 09:00 ngày 03/10/2026 và một ghi chú nhiều dòng có ghim từ Duy trong nhóm kiểm thử riêng được cho phép. Cả hai hiện trên Zalo Web Duy Anh Web, ghim và thời gian đúng. Team tải lại vẫn có dữ liệu, mở chi tiết và mở ghi chú từ thanh ghim được. So sánh trực tiếp form, kích thước, chi tiết ghi chú với Chrome; đối chiếu API/layout core PC qua bundle tĩnh, không dùng Computer Use trên PC.
- `tsc --noEmit` đạt; 17 kiểm tra tập trung (topics, polls, guards, messages-loader) đạt, gồm schema, scope, chống trùng sau restart, sai identity/hội thoại, thời gian quá khứ và projection multiline. Ảnh local tại `.local/send-proof/team-reminder-form-final.png` và `team-topics-final.png`.
- Giới hạn: chưa chờ tới giờ để nghiệm thu thông báo nhắc hẹn thực tế; nhắc cá nhân/kiểu lặp chưa gửi test thật. Chưa triển khai sửa/xóa/RSVP/danh sách tham gia và quản lý bảng tin. Link trong ghi chú hiện giữ dạng văn bản, chưa có preview liên kết. Phiên native cũ còn trả thêm dòng sự kiện tạo nhắc hẹn trước thẻ. PC chỉ kiểm chứng source, chưa kiểm chứng UI/hành vi chạy thật. Đã chạy local, chưa nghiệm thu người dùng và chưa deploy VPS.

### 02/10/2026 — Tạo bình chọn nhóm, thẻ bình chọn và gửi phiếu

- Tham chiếu trực tiếp form V3 tại `hihi haha` trên Chrome Duy Anh Web; đọc bundle Web `GroupPollManager`, fetcher, `GroupTopicController` và CSS/core PC `group-poll-message-v3`. Không dùng Computer Use trên PC.
- Frontend: `poll-create.tsx`, `poll-card.tsx`, `polls.ts`; nối toolbar, thẻ tin, thanh ghim và cập nhật sự kiện theo account/conversation. Form 482px, mở thiết lập 754px, ô chủ đề 106px/200 ký tự, lựa chọn 38px/120 ký tự, 2–30 lựa chọn (theo giới hạn native). Bản nháp tách theo tài khoản/nhóm; chặn trùng phương án. Popup menu dùng vị trí fixed để không bị toolbar cuộn cắt mất vùng click.
- Worker/API: thêm `poll-action` catalog/create/vote. Kiểm tra quyền sở hữu tài khoản, danh sách nhóm native, tư cách thành viên, quyền/giới hạn ghim, thời hạn và phương án. Lưu intent/receipt trước mutation; requestId không được dùng lại cho payload/tài khoản khác; kết quả không chắc chắn không tự gửi lại. Gửi phiếu kiểm tra poll từ DB native của nhóm trước khi đọc bản mới từ server, vì endpoint chi tiết không trả `group_id`.
- Ghim dùng bước `pinBoardItem` mà controller native gọi, kiểm tra lại bằng `fetchTopics`. Không gọi wrapper mở modal xác nhận trong phiên nền; `fetchTopicsAndDispatchUpdate` ở bundle hiện tại không resolve Promise nên không dùng để await. Nếu tạo thành công nhưng ghim chưa xác nhận, form báo rõ đã tạo và không cho tạo lại.
- Bổ sung ánh xạ `MSG_POLL` (26), đọc catalog lựa chọn native, ẩn số phiếu trước khi tham gia nếu cấu hình yêu cầu, không trả danh sách người bầu qua API. Các sự kiện cùng poll chỉ có một thẻ ở sự kiện mới nhất trong phần lịch sử đã tải. Hiển thị riêng thông báo tạo/tham gia, thời hạn, ẩn danh và số phiếu.
- Kiểm chứng thật: tạo 3 bình chọn trong nhóm kiểm thử riêng đã được cho phép; kiểm tra bình chọn mặc định, phương án trùng bị chặn, thêm phương án, bình chọn ẩn danh/chọn một/ẩn kết quả/thời hạn 18:00 ngày 03/10, và tạo kèm ghim. Đã gửi một phiếu từ Team, đối chiếu phương án A = 1 ở Web; cả hai bên hiện bình chọn ghim, click ghim Team tới đúng thẻ. Không gửi bình chọn vào `hihi haha` hay nhóm khách hàng. Ảnh local: `.local/send-proof/team-polls-final.png`.
- Kiểm tra code: TypeScript frontend `tsc --noEmit` đạt; 13 bài kiểm tra tập trung đạt (guards, loader, poll validation, receipt/restart/idempotency, sai tài khoản/nhóm, poll đã đóng, phương án không hợp lệ, projection ẩn kết quả); `node --check` các worker thay đổi đạt. Docker connector riêng local đã cập nhật; không triển khai VPS.
- Giới hạn: hộp chọn ngày dùng điều khiển ngày/giờ của trình duyệt, chưa sao chép lịch custom Zalo. Chưa có thêm phương án sau khi đã tạo, danh sách người bỏ phiếu, chia sẻ/khóa/xóa bình chọn hay quản lý bình chọn trong Bảng tin nhóm. Tùy chọn “Có thể thêm phương án” được gửi đúng native, có thể dùng trên Zalo. PC chỉ đối chiếu core/CSS, chưa kiểm chứng thao tác chạy thực tế trên PC; chưa có người dùng nghiệm thu giao diện cuối.

### 01/10/2026 — Tạo nhóm, thêm thành viên và sửa danh sách chọn tài khoản theo mẫu

- Tên sidebar giới hạn một dòng với ellipsis. Đã đo tên dài trên Team: cao 26px bằng line-height, `nowrap`, nội dung rộng 297px trong vùng 247px.
- `GroupDialog` dùng chung cho tạo/thêm nhóm: danh bạ, năm liên hệ gần đây, phân loại thật từ Zalo, tìm tên không dấu, chọn/bỏ chọn, khay đã chọn, giới hạn thành viên và trạng thái đã tham gia. Không dựng tab phân loại giả.
- Sửa hàng liên hệ kế thừa căn giữa và opacity disabled từ button chung: căn trái checkbox/avatar/tên, avatar 40px, hàng 52px, tên 14px/21px, subtitle 12px/18px. Hàng đã tham gia giữ avatar/chữ rõ, chỉ checkbox nhạt và không thể chọn; header dùng X nét mảnh. Đã đối chiếu ảnh người dùng, DOM Zalo Web và CSS core Zalo PC.
- Worker `group-actions.mjs` gọi `createGroupV2`/`addMemberToGroupV2` của phiên native đúng tài khoản; kiểm tra chủ phiên, hội thoại hiện có, danh bạ, quyền và giới hạn trước khi gọi. Receipt lưu bền trước mutation, gắn tài khoản/payload/requestId, không tự gửi lại khi kết quả chưa rõ. Sau add, lấy group info với FORCE_GET để kiểm tra thành viên thay vì chỉ đọc cache cũ.
- Kiểm tra thật trên Web: thêm tài khoản kiểm thử vào nhóm được chỉ định và tạo nhóm riêng. Trên Team: thêm tài khoản liên kết thứ hai vào nhóm kiểm thử, Web hiển thị sự kiện thêm thành viên và số lượng tăng 3→4; mở lại hộp Team thấy đã tham gia/disabled. Tạo nhóm riêng từ Team thành công, tự mở nhóm với 3 thành viên; nhóm và sự kiện xuất hiện trên Web. Các nhóm kiểm thử được giữ lại.
- Kiểm tra giao diện Team sau sửa: opacity hàng đã tham gia bằng 1, avatar 40px, hàng 52px, flex-start; phân loại Gia đình trả đúng danh sách và tìm tên không dấu hoạt động. Bằng chứng `.local/send-proof/team-add-member-final.png`. TypeScript frontend và 4 bài kiểm tra group-actions đều đạt; connector local đã build/restart với profile giữ nguyên.
- Giới hạn: tìm số điện thoại ngoài danh bạ, avatar nhóm và tạo nhóm E2EE chưa triển khai; quản lý nhóm chưa nối. Hành vi PC chỉ đối chiếu source/core, chưa kiểm thử trực tiếp trên PC. Chưa triển khai server và chưa có người dùng nghiệm thu bản sửa.

### 01/10/2026 — Active thông báo/ghim và nhóm ảnh trong hội thoại

- Hai nút sidebar có trạng thái `aria-pressed`, nền icon `#E5F1FF`, màu icon `#005AE0` theo computed style Zalo Web; sửa glyph bỏ ghim thành `U+EDD2`.
- API giữ `group_layout_id`, `id_in_group`, `total_item_in_group` và cờ HD từ ảnh native. `photo-album.ts` gom các ảnh liên tiếp cùng nhóm/người gửi, sắp theo thứ tự ảnh gốc; không gom ảnh đơn, sticker/GIF, ảnh có caption hoặc hai nhóm khác nhau. Gom lại sau khi ghép trang lịch sử.
- Lưới ảnh 450px, khe 2px, chia hàng theo tỷ lệ ảnh, bo góc ngoài và nhãn HD. Đối chiếu thuật toán Web `GzlV`, `P6UB.isGroupPhoto`, quy tắc render native và bundle core PC; không dùng Computer Use trên PC. Các trường hợp ảnh cực dài/ngắn chưa đối chiếu trực quan đầy đủ với native.
- Kiểm tra trực tiếp chat Anh Nguyen của Duy: cụm 9 ảnh và các cụm 2 ảnh đã liền nhau như ảnh PC người dùng gửi; mở ảnh lớn và menu chuột phải trên từng ảnh được. Giữ ID ảnh gốc cho preview/trả lời/thao tác. Không gửi, thu hồi hay xóa tin khi kiểm tra. Bằng chứng `.local/send-proof/photo-albums-anh-nguyen.png`.
- TypeScript frontend đạt; hai kiểm thử tập trung về metadata, thứ tự, ranh giới nhóm và layout đạt. Bộ kiểm thử cũ `message-presentation.test.cjs`/`messages.test.mjs` còn lỗi fixture có sẵn (`import.meta` trong loader CommonJS, thiếu `page.exposeBinding`), chưa coi toàn bộ suite đạt. Chỉ cập nhật local connector.

### 01/10/2026 — Khoảng cách dưới ô nhập tên gợi nhớ

- Bỏ override `padding-bottom: 0` của hộp thoại đổi tên trong `zalo-team.module.css`; dùng padding thân hộp thoại 16px để input không chạm đường phân cách footer.
- Kiểm tra trực tiếp trên Chrome `/zalo-team`: khoảng cách từ đáy input đến footer là 16px, ảnh xác minh `.local/send-proof/rename-spacing.png`. Không thay đổi tên tài khoản khi kiểm tra.

### 01/10/2026 — Đổi tên, tắt thông báo và ghim hội thoại

- Thử trên chat Duy ở Chrome Duy Anh Web trước khi triển khai: đổi tên gợi nhớ, tắt 1 giờ/bật lại, ghim/bỏ ghim; đã trả tên hiển thị và trạng thái về ban đầu. Đọc module `Yxnj`, `UiPd`, `QPNp`, sidebar `VLvn`; giới hạn tên 50 ký tự, dialog 400px, avatar 72px, input 328px. Đọc core PC 26.9.10 từ app.asar đối chiếu alias/mute/pin, không thao tác UI PC.
- `conversation-settings.mjs` dùng native `UiPd.setAliasName`, `dThN.changeGroupName`, `MuteDataManager.onMute/onUnMute`, `PinDataManager.pin/unpin`; kiểm owner tại Accounts, identity và hội thoại trong phiên trước khi gọi. Ghim dùng trạng thái đích, kiểm giới hạn ghim native; không tự bỏ ghim hội thoại khác. Tên nhóm thay đổi với tất cả thành viên và native kiểm quyền. My Documents chưa hỗ trợ đổi tên, không gọi nhầm API đổi tên tài khoản.
- Thêm action `conversation-settings` vào gateway/connector với payload `settings` kiểm whitelist chặt. Đọc trạng thái không phát sự kiện; thay đổi xong phát sự kiện để header/danh sách/sidebar lấy dữ liệu mới. Không dựng dữ liệu tên/ghim/thông báo riêng trong CRM.
- `ConversationSettingsControls` là component chung: dialog tên/gợi nhớ, lựa chọn 4 thời hạn mute, nút Bật thông báo và Bỏ ghim; khóa thao tác khi chờ, lỗi rõ và kiểm tra lại trạng thái một lần khi phản hồi không chắc chắn. Thêm icon muted/unpin gốc và trạng thái muted trong danh sách.
- Kiểm chứng local thật trên chat Duy của tài khoản Nguyễn Thị Ánh: đổi tên cập nhật cả header/list; tắt 1 giờ hiện Bật thông báo và icon muted; ghim lên vùng đầu, mở lại chat vẫn giữ trạng thái. Sau kiểm thử đã bỏ ghim, bật thông báo và bỏ tên gợi nhớ kiểm thử. Không gửi tin nhắn kiểm thử trong lượt này. Đổi tên nhóm đã có fixture và source đối chiếu, chưa thay tên nhóm thật để nghiệm thu.
- TypeScript frontend pass; 10 test settings/guards/accounts pass (gồm identity, scope, giới hạn tên, bốn mode mute, chống ghim trùng, nhóm qua API native). Connector local đã rebuild, giữ profile. Bằng chứng `.local/send-proof/conversation-settings-active.png`, `.local/send-proof/conversation-settings-mute.png`. Chưa triển khai VPS.

### 01/10/2026 — Dán ảnh clipboard và sửa nhận dạng ảnh trong lịch sử

- `MessageEditor` trước đây chỉ đọc text/plain và text/html nên bỏ ảnh chụp. Nay ưu tiên binary image trong clipboard items/files; không chèn HTML ảnh vào editor, giữ luồng paste chữ/định dạng cũ.
- `ClipboardImageTray` dùng thumbnail 72×72px, gap 8px, nút thêm viền nét đứt theo DOM/CSS My Documents Zalo Web. Xóa từng ảnh/tất cả, thêm ảnh vào khay; Enter hoặc Gửi chuyển ảnh vào hàng đợi upload sẵn có. Object URL thumbnail được thu hồi khi bỏ ảnh/unmount.
- `send-state.ts` giữ ảnh nháp theo accountId/conversationId qua chuyển chat; đọc draft mới nhất khi gửi để chống Enter hai lần. Áp dụng giới hạn hiện có 10 ảnh, 25 MB/tệp, 100 MB/lần; không upload trước khi gửi. Nháp chỉ trong bộ nhớ, không tồn tại qua tải lại trang.
- Khi gửi thật phát hiện `MSG_TOPIC=2` là loại topic ghim, trùng `MSG_PHOTO=2` của message. Bỏ MSG_TOPIC khỏi bảng phân loại message trong `web/messages.mjs`; ảnh trước đó bị render thành thông báo `[Hình ảnh]`. Đã áp dụng connector local bằng compose build/recreate, giữ volume phiên đăng nhập.
- Kiểm chứng: clipboard PNG thật hiện thumbnail, dán nhiều lần, xóa từng ảnh/tất cả, chuyển hai tài khoản vẫn giữ đúng nháp; gửi một ảnh gradient kiểm thử vào My Documents Duy, native ACK và mở lại lịch sử thấy ảnh 480×320 (message `8325730779896`). Không thay đổi 9 ảnh nháp đang có ở My Documents Zalo Web tham chiếu.
- Đối chiếu Web trực tiếp DOM/CSS/ảnh; đọc CSS khay preview trong app.asar PC 26.9.10, không dùng Computer Use trên PC và chưa kiểm chứng thao tác paste thực tế trên PC. Ảnh: `.local/send-proof/clipboard-image-preview.png`.
- TypeScript frontend pass; 4 test messages-loader pass (có regression mã ảnh/topic); 12 kịch bản upload/clipboard trong `tooling/zalo-team/upload.browser.mjs` pass bằng container fixture riêng, API giả, không mount profile. Fixture không khởi chạy được trong container connector đang bận nên đã chuyển sang container tạm độc lập. Chưa triển khai server.

### 01/10/2026 — Sửa ô soạn tin tăng chiều cao khi xóa hết

- Tái hiện trực tiếp trên Chrome: mỗi vòng gõ rồi xóa ký tự cuối sinh thêm một dòng rỗng, làm editor tăng 22,5px. Nguyên nhân là serializer tính thẻ `BR` giữ con trỏ do Chromium tạo thành ký tự xuống dòng thật.
- Sửa `components/message-editor.tsx`: bỏ qua `BR` giữ con trỏ ở cuối block; khi thao tác xóa chỉ còn khoảng trắng/xuống dòng thì đưa draft về rỗng và giới hạn lại vị trí con trỏ. Giữ xuống dòng chủ động bằng Shift+Enter.
- Kiểm tra local: 6 vòng gõ/xóa từng ký tự đều trở về editor 23px, vùng nhập 53px, DOM rỗng và placeholder hiện lại; đoạn 3 dòng có dòng trống giữ đúng 67,5px, Ctrl+A/Backspace co về 23px; undo khôi phục chữ, redo xóa sạch. TypeScript frontend pass.
- Đối chiếu trực tiếp Zalo Web: gõ/xóa hết cũng giữ một dòng, cao 22,5px. Lần sửa này không kiểm chứng lại core/hành vi Zalo PC. Không gửi tin kiểm thử; đã xóa draft kiểm thử ở cả Web và Team. Ảnh local: `.local/send-proof/composer-empty-height-fixed.png`. Chưa triển khai server.

### 01/10/2026 — Triển khai nhắc thành viên và @All

- Thêm `mentions.ts` và `components/mention-picker.tsx` dùng chung cho composer. Popup 300px, hàng 48px, avatar 32px, chữ 14px/21px, padding ngang 16px, dùng icon @ và bóng đèn Zalo gốc. Gợi ý lọc local; cache catalog 30 giây tách theo tài khoản/hội thoại, không gọi worker mỗi ký tự.
- Connector có lệnh đọc `mentions`, dùng một instance helper native riêng để giữ đúng thành viên được phép nhắc và quy tắc `@All`, không sửa bản nháp của phiên Zalo nguồn. Luồng gửi vẫn qua model/outbox native; thêm `{pos,len,uid,type}` vào `content.mentions`, kiểm tra nhóm/UID/range và gắn metadata vào fingerprint chống gửi trùng.
- Bản nháp, chèn tên, chỉnh sửa, undo/redo, chữ đậm, emoji và bubble dùng vị trí UTF-16. Khi sửa vào tên, metadata tương ứng bị loại; phần trước/sau tên vẫn cập nhật offset. Đã sửa trường hợp Escape rồi xóa/gõ lại `@` không mở lại gợi ý.
- Kiểm thử thật theo chỉ định người dùng trong nhóm **Trần Hảo, Nguyễn Thị Ánh**: gửi một tin nhắc thành viên từ Duy; gửi một tin `@All` kèm emoji và chữ đậm từ Ánh. Cả hai đã có trong lịch sử của tài khoản còn lại. Không gửi vào nhóm tham chiếu hihi haha trong bước triển khai.
- Phát hiện và sửa lỗi native đổi tên theo danh bạ từng tài khoản: phải rebase cả range mention và rich styles, không áp offset gốc lên `getPlainText` đã đổi tên. Đối chiếu DOM sau khi native xác nhận: chỉ tên mention có màu xanh, `@All` vẫn giữ chữ đậm, nội dung sau tên không bị tô xanh nhầm.
- Kiểm chứng: 15/15 kiểm tra tập trung (guards/mention/outbox/rich text) đạt; TypeScript toàn frontend đạt. Chrome đã kiểm tra chọn bằng Enter/chuột, tìm không dấu, undo/redo, Escape, chuyển tài khoản, gửi/nhận và số đo popup. Bằng chứng `.local/send-proof/mention-team-popup.png`; tài liệu nguồn `tooling/zalo-team/MENTIONS-REFERENCE.md`.
- Hai harness kiểm thử cũ ngoài tập tập trung chưa chạy trọn: `messages.test.mjs` thiếu mock `exposeBinding`; `message-presentation.test.cjs` không xử lý `import.meta` của file preview. Không dùng các kết quả này để ghi cả bộ test đạt. PC chỉ đối chiếu core/source theo giới hạn người dùng, không kiểm thử UI PC hay thông báo đẩy điện thoại. Chưa nối lệnh tìm GIF/Sticker qua `@`, chưa triển khai VPS.

### 01/10/2026 — Khảo sát gợi ý @ trước triển khai

- Đã kiểm tra trên Zalo Web của Chrome Duy Anh Web trong nhóm người dùng chỉ định: gõ `@`, lọc theo tên, chọn một thành viên để chèn tên màu xanh. Đã dọn bản nháp thử, không gửi tin vào nhóm.
- Ghi chuẩn UI và đường gọi tại `tooling/zalo-team/MENTIONS-REFERENCE.md`: danh sách rộng 300px, hàng 48px, avatar 32px, chữ 14px; gợi ý lọc dữ liệu nhóm native trong client sau debounce 70ms, không tìm kiếm HTTP mỗi ký tự.
- Lần source xác định nhánh gửi văn bản mention thông thường là `/api/group/mention`, `mentionInfo` chứa `{pos,len,uid,type}`. E2EE/quote/media có nhánh native riêng; không nên tự gọi một endpoint chung cho mọi loại tin.
- Có đối chiếu source PC; chưa kiểm thử gửi/nhận mention, chưa có chức năng mention trên Team. Bước này chỉ bổ sung tài liệu nghiên cứu theo yêu cầu kiểm tra trước, không đổi runtime/API hay triển khai server.

### 01/10/2026 — Đồng bộ format ghim/menu với Zalo Web; chuột phải mở thao tác

- Đọc HTML/CSS thực tế trên Chrome Duy Anh Web, chat Duy; đối chiếu thêm CSS/core PC. Menu dùng icon nét đúng phiên bản font hiện tại, radius 8px, bóng native, dòng 36px và đường phân nhóm. Màu thao tác xóa/thu hồi `#c31818`; không dùng glyph Undo của bộ soạn thay cho Recall. Toolbar hover vẫn giữ icon đặc đúng chức năng; Like giữ 14px theo yêu cầu riêng.
- Chuột phải trên tin mở cùng component/menu như nút `...`, tại vị trí con trỏ và giới hạn trong viewport; bấm ngoài/Escape/cuộn đóng menu. Tin đã thu hồi chỉ còn Xóa phía tôi trong phần chức năng hiện hỗ trợ, không hiện lại trả lời/cảm xúc; bỏ nội dung quote cũ khỏi bubble thu hồi.
- Tách `PinnedMessages` dùng chung: preview và danh sách đều có icon Message nét xanh 20px, nhãn Tin nhắn và người gửi/nội dung 13px; mỗi hàng 50px. Một ghim bấm vào nhảy đến tin; nhiều ghim có nút `+N ghim`, mở bảng với header 32px, số lượng, Thu gọn và nền tối 55% trong vùng lịch sử. Bấm ngoài/Escape/Thu gọn đóng bảng. Tin cùng ID được ghim nhiều lần vẫn có khóa render riêng.
- Menu thẻ ghim hiện có Copy; chưa triển khai Bỏ ghim. Giới hạn nhảy đến tin ngoài phần lịch sử đã tải giữ nguyên và có thông báo. Không thay đổi API, phiên Zalo hoặc deploy server trong lần sửa giao diện này.
- Kiểm tra trực tiếp Chrome Team: chuột phải và dấu ba chấm trả cùng nội dung menu; tin đã thu hồi chỉ có Xóa phía tôi. Danh sách hai ghim đo được tổng 132px (header 32px, hai hàng 50px), cùng cột icon với mẫu; Thu gọn đóng đúng bảng. TypeScript và bộ hồi quy thao tác 9 nhóm đạt sau chỉnh. Bằng chứng: `.local/send-proof/actions-format-menu.png`, `.local/send-proof/actions-format-pins.png`. Không gửi/thu hồi/xóa tin thật khi đối chiếu lần này; PC chỉ đối chiếu source, chưa thao tác UI PC.

### 01/10/2026 — Icon Like giữ kích thước 14px

- Icon bên trong nút thả cảm xúc là 14×14px ở cả trạng thái chưa nhấn (ảnh Like) và đã nhấn (sprite cảm xúc). Quy tắc CSS áp dụng cho cả wrapper lẫn artwork, tránh sprite trở lại 22px sau khi nhận kết quả. Vùng bấm vẫn 24px.
- Kiểm tra DOM Chrome trên dữ liệu sẵn có: cả ảnh chưa nhấn và sprite đã nhấn đều đo được 14×14px, vùng bấm 24×24px; không gửi tin hoặc thay đổi cảm xúc khi kiểm tra. Ảnh: `.local/send-proof/like-icon-14px.png`.

### 01/10/2026 — Trả lời, thao tác tin nhắn và thả cảm xúc

- Thêm component `MessageActions` dùng chung: ba nút Trả lời/Chia sẻ/Thêm 24px, menu Copy/Ghim/Đánh dấu/Thu hồi/Xóa phía tôi và bảng sáu cảm xúc dùng artwork native. Chia sẻ chưa có logic đúng yêu cầu. Thu hồi/xóa có hộp xác nhận; nút thu hồi chỉ hiện với tin của mình còn trong thời hạn native.
- Trả lời giữ bản nháp theo tài khoản/hội thoại và chụp đích trích dẫn khi đưa tin vào hàng đợi. API chỉ nhận ID tin gốc; connector tự đọc/kiểm tra tin thuộc hội thoại trước khi tạo `QUOTE` qua model và transport native. Không tin nội dung trích dẫn do trình duyệt gửi lên.
- `web/message-actions.mjs` gọi native Web cho star/unstar, pin, undo, delete-only-me và reaction; xác minh owner, tài khoản đang đăng nhập, hội thoại và ID tin trước mỗi thao tác. Receipt bền vững chống thực thi lặp; kết quả chưa rõ không tự gửi lại. Reaction trả trạng thái queued cho đến khi lịch sử/event phản ánh kết quả, không coi queued là ACK máy chủ.
- Lịch sử thêm quote ID, trạng thái đánh dấu, tổng cảm xúc và danh sách ghim; realtime nghe thêm native reaction listener. Nạp pin không chặn gói tin cache đầu tiên. Thu hồi hiển thị bubble mờ ở đúng phía gửi/nhận, bỏ nút cảm xúc; quote được native cập nhật khi tin gốc bị thu hồi. Giải phóng tin outbox đã thấy trong lịch sử để tin thu hồi/xóa không hiện lại từ bản gửi tạm.
- Đối chiếu live đúng **Chrome Duy Anh Web → chat Duy**: gửi, trả lời có trích dẫn, Like, thu hồi và xóa chỉ phía tôi trên hai tin kiểm thử. Hai thao tác cuối đã được người dùng xác nhận tại thời điểm thực hiện. Zalo Team phía tài khoản Duy nhận đúng trích dẫn/trạng thái thu hồi; bản trả lời vẫn còn ở phía nhận sau khi phía gửi xóa riêng. Mỗi lần gửi/thay đổi trên tab tham chiếu phải xác minh lại header và đúng ID tin ngay trước thao tác.
- Chrome Team trên phía tài khoản Duy: menu tin nhận ẩn Thu hồi, thao tác Đánh dấu lưu thành công và xuất hiện ngôi sao; nút Trả lời mở banner đúng tin và đúng tài khoản. Like thật được lịch sử native trả về với số lượng 1; đã gỡ cảm xúc/bỏ đánh dấu thử và hủy banner trả lời. Kiểm tra trực quan sau reload, tin thu hồi đã nằm trong bubble phía nhận; thanh ghim lấy được mục thật trong hội thoại.
- Trước khi người dùng nhắc lại đích kiểm thử, adapter thật đã được kiểm tra gửi/trả lời, star, reaction và pin trong My Documents Duy. Sau nhắc lại chỉ đối chiếu cặp hội thoại Duy–Duy Anh Web. Không ghi nội dung trò chuyện hay thông tin đăng nhập vào tài liệu.
- Kiểm chứng local: TypeScript đạt; 32 worker checks đạt; fixture trình duyệt 9 nhóm đạt (toolbar/share, trích dẫn và bản nháp tách tài khoản, reply ID, star/unstar, hover reaction, pin, xác nhận/hủy thu hồi, ẩn thu hồi tin đến, xóa phía tôi). Bộ hồi quy gửi tin/outbox đạt 17 tình huống. Fixture không dùng phiên người dùng. Connector Docker Zalo Team local đã build lại, giữ profile.
- PC đối chiếu source/core `starAction`, `_recallMessage`, `createPinTopicFromMessage`, `generateReactMsg`; không điều khiển UI PC. Chưa kiểm thử live thu hồi/xóa thông qua adapter Team (đã kiểm tra bằng fixture và native Web); chưa thử quota/quyền ghim nhóm, mọi loại media quote hoặc E2EE. Danh sách ghim nhóm hiện đọc cache native; mở tin ghim chỉ nhảy đến tin trong lịch sử đã tải, ngoài phạm vi có thông báo rõ. Chưa nghiệm thu người dùng, chưa triển khai VPS.
- Bằng chứng local: `.local/send-proof/message-actions-native-duy.png`, `message-actions-native-duy-cleaned.png`, `message-actions-team-duy.png`. Mã kiểm thử: `tooling/zalo-team/message-actions.browser.mjs`, `tooling/zalo-team/web/message-actions.test.mjs`.

### 01/10/2026 — Định dạng tin nhắn, dán chữ đậm và Like

- Nút định dạng mở bộ soạn cùng icon font Zalo: đậm/nghiêng/gạch chân/gạch ngang, cỡ chữ, màu, xóa định dạng, danh sách, thụt dòng, hoàn tác/làm lại và mở rộng. Hỗ trợ Ctrl+Shift+X, Ctrl+B/I/U; Enter gửi, Shift+Enter xuống dòng. Toolbar dùng nút 30px/icon 20px; chữ đậm weight 500 và thụt dòng mỗi bước 10px theo source Web/PC.
- Dán HTML từ clipboard giữ các định dạng văn bản được hỗ trợ; không đưa HTML gốc, script hay ảnh ngoài vào editor. Đã thử đúng đoạn “Liên kết tài khoản” của người dùng: ba vùng đậm khớp Zalo Web. Clipboard HTML không khớp nội dung văn bản sẽ dùng text thuần để tránh mất chữ.
- Bản nháp và tin trong hàng đợi giữ `styles` riêng theo tài khoản/hội thoại; khôi phục định dạng khi soạn lại tin thất bại. Tin nhận và tin đang gửi dùng chung renderer cho RTF v1 `{start,len,st}`. API kiểm tra kiểu, phạm vi và giới hạn số vùng định dạng.
- Connector gọi `updateMessageFormat()` và truyền `getAdditionalParams()` vào tham số thứ sáu của `sendMsgObject()`, đúng luồng native; chỉ tạo `content.rtf` chưa đủ để lưu định dạng phía Zalo. Có kiểm thử chặn hồi quy này, giữ cơ chế receipt/chống gửi trùng và nhánh E2EE hiện hữu.
- Nút Like gửi mã `/-strong` gốc; hiện ngay bằng SVG và dùng cùng hàng đợi gửi văn bản, không phụ thuộc việc mở popup emoji trước đó.
- Kiểm chứng local: TypeScript đạt; 28 bài kiểm thử worker đạt; browser fixture định dạng/dán mẫu đạt; bộ hồi quy gửi tin, emoji, IME, bản nháp và chống gửi trùng đạt. Theo dõi cả chiều cao viewport để mở/thu gọn bộ soạn vẫn giữ tin cuối hoặc vị trí đang đọc; bộ kiểm tra cuộn đạt. Đã gửi thật tại **My Documents — Duy**, đọc lại lịch sử native xác nhận tin màu/danh sách, Like, và ba vùng đậm trong đoạn người dùng cung cấp; kiểm tra lại bằng Chrome sau tải lại trang.
- Đối chiếu Web trực tiếp bằng cùng nội dung dán (không gửi trên tài khoản Web tham chiếu), PC qua core `normalizeFormat`, `genStyle` và quick emoji; không thao tác PC bằng Computer Use. Chưa có người dùng nghiệm thu và chưa triển khai VPS. Mẫu thử đầu tiên trước khi bổ sung tham số native còn là text thường; mẫu sau đã lưu đủ định dạng.
- Bằng chứng local: `.local/send-proof/rich-paste-composer.png`, `.local/send-proof/rich-paste-native-web.png`, `.local/send-proof/rich-format-final.png`. Mã kiểm thử: `tooling/zalo-team/rich-text.browser.mjs`, `tooling/zalo-team/web/rich-text.test.mjs`. Các fixture lịch sử cũ trong `messages.test.mjs` có ba lỗi mock `exposeBinding` từ luồng transport cũ; bộ hiện hành sử dụng `messages-loader.test.mjs` và đã đạt.

### 01/10/2026 — Preview MP4/PDF/MD/TXT và chuẩn hóa toàn bộ thẻ file

- `FileIcon` dùng chung cho mọi định dạng trong chat và kho file: cùng bộ SVG Web không có khoảng trắng nội bộ; 38×48px trong chat, 32×40px trong kho. File MD hiện chữ MD; định dạng chưa có artwork riêng hiện nhãn đuôi file trên nền SVG chung.
- Thẻ file chung rộng 400px gồm padding/border, nội dung 374px, khoảng cách icon–tên 10px. Giữ padding bubble 12px đã đo trên Web; không chỉnh riêng bốn tệp mẫu.
- MP4 gửi dạng `MSG_FILE` vẫn giữ loại tin gốc, có preview/nút phát/duration/controls. Tải trực tiếp CDN không gửi Referer rồi phát object URL có MIME; giải phóng khi ra khỏi vùng xem hoặc chuyển chat.
- PDF có canvas trang đầu, bấm mở trình xem/phân trang. MD/TXT hiện 1024 byte đầu như module native `4VTe`; bấm mở nội dung. Markdown dùng CodeMirror 5 cùng chế độ `markdown`/màu token của core, không thực thi HTML.
- Tải preview khi vào vùng nhìn thấy; PDF/video tối đa 25 MiB, nội dung văn bản đầy đủ tối đa 1 MiB; lỗi có đường tải bản gốc. PDF.js tải động, worker của thumbnail được hủy sau khi render. Không có API proxy mới hoặc dịch vụ chuyển đổi bên ngoài.
- Đối chiếu Web live (DOM/icon/padding) và source/CSS PC (file thumbnail, text preview, video). Kiểm tra bốn tệp thật đã gửi ở My Documents Duy: MP4 chạy hết 5,76 giây; PDF render canvas; MD/TXT đọc được nội dung. Không sử dụng computer use với PC.
- Kiểm tra: TypeScript; fixture `file-preview.browser.mjs` (35 định dạng, PDF/MD/TXT inline+dialog, video tiến thời gian và giải phóng nguồn); 8 nhóm hồi quy chọn/gửi file. Chi tiết và giới hạn: `tooling/zalo-team/MEDIA-FORMAT-CHECKS.md`.

### 01/10/2026 — Chọn ảnh/file gửi ngay; kiểm tra 37 định dạng thật

- Bỏ khay chọn và nút **Gửi N tệp**; cả hai input gọi outbox ngay khi chọn xong. Hủy/đầu vào rỗng không gửi, giữ bản nháp văn bản; kiểm tra đích nếu đổi chat lúc bộ chọn còn mở. Xóa component/CSS khay cũ.
- Controller native Web/PC đặt `isUploaded: true` khi chọn từ toolbar, gửi trực tiếp; preview là nhánh dán/kéo vào ô nhập. Không thêm bước xác nhận vào luồng toolbar.
- Gửi thật **37 định dạng** vào **My Documents Duy**: 37 ACK, 37 tin đọc lại từ lịch sử, 37 URL tải HTTP 200. 33 file tải lại khớp SHA-256; JPG/PNG/WebP được bộ xử lý Zalo chuyển thành ảnh JPEG, GIF giữ GIF động. Ma trận: [MEDIA-FORMAT-CHECKS.md](tooling/zalo-team/MEDIA-FORMAT-CHECKS.md).
- Sửa GIF dùng bản động thay thumbnail JPG; ảnh giữ kích thước trước lazy-load để không bị cao 0. Nguồn ảnh lỗi có fallback hữu hạn. Sửa bảng icon thẻ file theo module `YT5n` Web/PC; tên dài giữ đuôi file.
- Ảnh raster gửi dạng file mở trong viewer chung; SVG/HEIC/TIFF và tài liệu khác giữ liên kết mở/tải bản gốc, chưa có preview Office nội bộ.
- Kiểm tra: TypeScript; 24 worker checks; 8 nhóm browser fixture đạt. Chrome thật: card/icon tải đủ, GIF mở được, zoom 125%, BMP dạng file mở được, composer không còn khay thừa. Gửi bộ mẫu qua worker thật; bộ chọn test bằng fixture do extension Chrome chặn upload file local. PC chỉ đối chiếu core, không điều khiển UI.
- Đã cập nhật Docker local, giữ profile. Chưa nghiệm thu pixel tuyệt đối từng định dạng trên cùng tài khoản Web/PC; chưa test mọi codec, nhóm/E2EE hoặc gửi album. Giữ giới hạn 25 MB/tệp, 10 tệp/lượt, tổng 100 MB.

### 01/10/2026 — Emoji preview theo đúng atlas Web; chọn và gửi ảnh/file

- Đối chiếu DOM Zalo Web: emoji preview 16×16px dùng `emoji-md...png`. Đổi adapter preview từ atlas lớn sang `getEmojiSrc("")` đúng nguồn MD của mẫu, giữ nguồn lớn cho emoji trong chat; tránh thu nhỏ ảnh dành cho emoji lớn vào danh sách.
- Bật hai nút **Gửi hình ảnh** và **Đính kèm file**. Có chọn nhiều tệp, xem ảnh/tên/dung lượng, bỏ từng tệp và bấm **Gửi N tệp**; hủy bộ chọn không gửi gì. Giới hạn 25 MB/tệp, tối đa 10 tệp và tổng 100 MB/lượt; ảnh nhận JPG/PNG/GIF/WebP, định dạng khác gửi bằng File. Các tệp gửi từng tin riêng; văn bản đang soạn được giữ để gửi riêng, chưa có caption/bundle ảnh.
- `/api/zalo-team/upload` dùng cùng xác thực CRM/Origin, chuyển luồng nhị phân có giới hạn sang worker. Tệp tạm gắn owner/account/conversation, ID ngẫu nhiên, hash SHA-256 và TTL 24 giờ; không nhận đường dẫn/URL nguồn tùy ý. Đây là vùng tạm cho gửi, không phải kho lưu lịch sử/media dài hạn.
- `send-media` dùng cùng receipt bền vững/chống gửi trùng của outbox. Native model `4HQc`, `dThN.sendMsgObject`, uploader `sendFileByChunkV2` và `IPhotoMessageProcessorDef` xử lý ảnh/file; giữ E2EE wrapper native. Tệp được gắn tài khoản/đích nhận khi đưa vào hàng đợi; chuyển chat không đổi nơi gửi. Kết quả chưa rõ chỉ tra lại receipt, không tự gửi lần hai. Tệp đã xác nhận có trong lịch sử được giải phóng khỏi outbox và thu hồi blob preview.
- Sửa khởi tạo module ảnh khi profile chưa từng mở chat và chuẩn hóa lỗi Playwright về mã native trước khi gửi. Kiểm chứng nguồn PC 26.9.10 cũng dùng processor ảnh và chunk uploader; không thao tác PC bằng Computer Use.
- Kiểm chứng: TypeScript, 23 test worker, 17 kiểm tra hồi quy composer và 7 nhóm kiểm tra UI upload qua. Đã gửi thật **một TXT và một PNG 480×320** vào My Documents Duy, có ACK và mỗi tin chỉ xuất hiện một lần trong lịch sử; tải lại TXT HTTP 200, nội dung khớp nguyên bản. Chrome Team hiển thị card file và ảnh tải đủ kích thước.
- Giới hạn kiểm chứng: Chrome cá nhân chưa bật quyền file URL cho tiện ích nên không tự chọn được file qua công cụ ở Chrome đó. Luồng chọn/xóa/gửi/chuyển tài khoản kiểm tra bằng browser fixture với API giả lập; gửi thật kiểm tra qua worker và đối chiếu giao diện Chrome. Chưa gửi thử nhóm, tài khoản Ánh, E2EE hoặc mọi định dạng ảnh. Chỉ triển khai worker local, không VPS.

### 01/10/2026 — Emoji trong dòng xem trước danh sách hội thoại

- Sửa `ConversationRow` vốn in nguyên chuỗi `preview` nên lộ shortcode như `Bạn: :)`. Adapter danh sách dùng `P6UB.parseMessage` và tọa độ sprite native để trả thêm `previewInline`; giữ nguyên nhãn người gửi, nội dung chữ và URL. Có dữ liệu ngay trong API danh sách, không cần mở chat hoặc bảng Emoji, không thêm request riêng cho từng dòng.
- `InlineEmoji` dùng chung với nội dung chat; kích thước preview 16×16px theo DOM/CSS Zalo Web ở Chrome Duy Anh Web. Giữ chiều cao dòng, dấu ba chấm và chữ của tài khoản. Chuẩn hóa token/sprite dùng chung qua `web/inline.mjs`; khi token không khớp nội dung thì giữ văn bản gốc.
- Kiểm chứng local: TypeScript, 7 test danh sách và 2 test chuẩn hóa media/emoji qua. API thật của Duy trả shortcode `:)` kèm sprite/position, Ánh vẫn giữ preview văn bản. Đã build lại riêng worker Web và hai tài khoản phục hồi connected. Kiểm tra giao diện sau tải trang mới, chưa mở hội thoại/bảng Emoji; không gửi thêm tin thử.

### 01/10/2026 — Emoji dạng hình trong ô soạn, sprite nét và sticker chuyển động

- Thay textarea bằng `MessageEditor`: emoji hiện artwork ngay trong ô soạn, chèn đúng con trỏ, xóa nguyên biểu tượng, hỗ trợ xuống dòng, undo/redo và paste văn bản. Nội dung gửi vẫn là Unicode/shortcode native, không gửi HTML. Tin đang chờ ACK cũng dùng cùng artwork.
- Sửa nguồn emoji từ sprite cỡ nhỏ sang `getEmojiSrc("larger")`: ảnh gốc 3264×2624, mỗi ô 64px; hiển thị 22px trong dòng và 40px cho tin chỉ có emoji. Đây là nguyên nhân emoji trong chat trước đó bị mờ khi phóng lớn.
- `StickerArtwork` dùng GIF/WebP hoặc strip PNG nhiều frame từ metadata native, thay cho thumbnail tĩnh. Strip dùng CSS steps và thời lượng frame native; picker chạy khi hover, chat chạy khi đang hiện trong viewport. Tạm dừng khi tab bị ẩn hoặc sticker ngoài màn hình.
- Đối chiếu source Web `z0WU`, `79BI`, `_ou9` và core PC 26.9.10: cùng quy tắc chọn stickerGifUrl/stickerSpriteUrl, WebP và totalFrames. PC còn có nhánh emoji PNG riêng theo kích thước; Team dùng sprite độ phân giải cao có sẵn của Web. Không dùng Computer Use với PC.
- Kiểm chứng local: TypeScript, 21 test worker, 2 test chuẩn hóa media/emoji và 17 kiểm tra browser fixture qua. Fixture gồm con trỏ, xóa emoji, undo/redo, paste, IME mô phỏng, frame strip và outbox. Đã gửi thêm một emoji từ editor mới vào My Documents Duy, mở lại thấy message native `8324836954379`; sticker GIF thật có hai ảnh chụp ở khung hình khác nhau. Chưa kiểm chứng mọi bộ sticker hoặc IME thực tế của mọi hệ điều hành.
- Bằng chứng: `.local/send-proof/rich-emoji-input.png`, `sticker-animated-frame-a.png`, `sticker-animated-frame-b.png`. Đã build lại worker Web local, giữ phiên đăng nhập; chưa triển khai VPS.

### 01/10/2026 — Component Sticker / Emoji dùng chung và gửi sticker thật

- `ExpressionPicker` mở tab tương ứng từ nút sticker hoặc mặt cười. Dùng cùng khung 342px, tab header, scroll, nút danh mục và xử lý Escape/bấm ngoài. Danh mục emoji dùng glyph gốc `fa-emoji_*`, sprite 26px, hàng 38px/8 cột. Sticker 4 cột; tải bộ khi chọn, tìm kiếm debounce 250ms tối đa 40 kết quả như source Web. Hủy/loại phản hồi cũ khi đổi bộ, từ khóa hoặc hội thoại.
- Adapter `web/expressions.mjs` đọc `vSga` (bộ/gần đây/tìm sticker), `NDmK`/`XS0u`/`z0WU` (emoji và sprite) từ đúng profile. Kiểm tra owner, identity và hội thoại thuộc inbox trước khi đọc/gửi. Chỉ nhận ID sticker/category hợp lệ; không nhận URL hay payload native tùy ý từ frontend.
- `send-sticker` dùng model `MSG_STICKER`/`4HQc`, native `sendMsgObject`, E2EE wrapper và receipt chống gửi trùng của văn bản. UI hiện sticker ngay, giữ bản nháp, đợi ACK rồi đối chiếu message/client ID với lịch sử. Kết quả chưa rõ phải kiểm tra bằng request ID cũ; chỉ trạng thái đã từ chối mới có nút thử gửi lại. Gửi thành công cập nhật recent native.
- Emoji chèn ở vị trí chọn/con trỏ, giữ giới hạn 2000 ký tự. Emoji gần đây kết hợp nguồn native với các lựa chọn trong bộ nhớ trang riêng theo tài khoản (chưa ghi lựa chọn emoji vào profile native). Bản textarea ban đầu đã được thay bằng `MessageEditor` hiển thị artwork trong lượt sửa ngay phía trên.
- Kiểm chứng local: 21 test worker, TypeScript và 14 kiểm tra browser fixture gửi tin qua. Fixture kiểm tra dùng chung popup, chèn giữa chuỗi, giữ bản nháp khi gửi sticker, optimistic hiển thị trước ACK và không lẫn tài khoản. Đã gửi **một sticker thường và một emoji** trong My Documents của **Duy**, nhận ACK; tải lại trang thấy sticker trong lịch sử native, ảnh tải thành công. Không gửi thử vào nhóm/người khác.
- Đối chiếu Web: đọc source popup `ZURh`, manager `vSga`, renderer `79BI`, luồng gửi `Em8I` và CSS `web-startup.072b39f95cd439c77ef7.css` đang được Chrome Duy Anh Web sử dụng. PC 26.9.10 đối chiếu source/CSS trong `app.asar`: 8 emoji/hàng, sprite 26px, hàng 38px, glyph danh mục và payload sticker. Chrome mẫu không mở được popup ổn định bằng công cụ nên đối chiếu trực quan popup dựa vào ảnh người dùng; kiểm tra trực tiếp UI trên Team. Không thao tác PC bằng Computer Use, không khẳng định đã kiểm tra tương tác trực tiếp PC.
- Phạm vi lượt này: Sticker thường và Emoji; chưa có tab tìm/gửi GIF, photo sticker/AI sticker, kho tải/thêm bộ sticker, chế độ dock/mở rộng. Sticker dùng nguồn GIF có chuyển động như ghi trong lượt sửa phía trên. Bản đang chạy là local; chưa triển khai VPS, chờ người dùng nghiệm thu.

### 01/10/2026 — Phản hồi Enter tức thì, không chờ xác nhận mới hiện bubble

- Nguyên nhân: Team trước đây giữ nguyên ô nhập và không hiện tin cho tới khi request gửi trả xác nhận. Source Web `Em8I` và core PC 26.9.10 đều có bước `_showLocalMessage` trước gửi, rồi `_sentMessage` sau xác nhận.
- Theo cho phép bổ sung của người dùng, gửi một tin thử trong **My Documents của Duy Anh Web** trên Chrome: ngay sau Enter đã có bubble “Đang gửi”, ô nhập trống; kiểm tra sau thấy “Đã gửi”. Quan sát bằng công cụ trình duyệt bao gồm độ trễ điều khiển, không coi đó là thời gian render chính xác hoặc benchmark tốc độ mạng.
- Sửa `send-state`, composer và timeline: bubble cục bộ tức thì, clear input ngay, xếp hàng Enter liên tiếp riêng từng account/chat, phân biệt pending/failed/unknown; giữ nội dung khi lỗi và không tự gửi lại. Worker trả client ID sớm sau lưu receipt để chống bubble trùng khi sự kiện đến trước HTTP hoàn tất. `prepared` không phải xác nhận đã gửi.
- Đã build connector local và cập nhật frontend; gửi một tin thử trong **My Documents Duy** trên Team. Quan sát ngay sau Enter: bubble pending và input trống; sau đó xác nhận sent với đúng một bubble/message ID. Đối chiếu PC bằng core, không điều khiển cửa sổ PC. Ảnh `.local/send-proof/enter-team-sent.png`, `.local/send-proof/enter-web-sent.png`.
- Kiểm tra: TypeScript, worker tests và browser fixture send qua; fixture giữ phản hồi để chứng minh pending bubble trước ACK, clear input, không nhân đôi Enter, gửi tin thứ hai theo hàng, đổi tài khoản giữ draft, unknown/offline/check cùng UUID và lỗi có Soạn lại không tự gửi. Đây là cải thiện thời gian phản hồi giao diện; chưa chứng minh giảm thời gian mạng/Zalo xác nhận, chưa nghiệm thu người dùng.

### 01/10/2026 — Dùng loader/cache/event native, trả dữ liệu từng đợt

- Triển khai phương án đã chốt: bỏ bước force-load rồi đọc lại DB riêng; dùng kết quả loader native, trả cache sớm và tải lịch sử bằng loader top của Zalo. Sidebar dùng callback native và ghép section tuần tự, tránh response cũ ghi đè mới. Frontend giữ nội dung sidebar khi làm mới, hiển thị loading riêng section chưa về.
- Bỏ poll list/chat 10 giây; thêm stream sự kiện có owner, reconnect/resync và coalescing. Tách hàng đợi đọc/gửi, lịch sử từng chat, tài khoản; giữ barrier cho đóng/mở profile và lưu metadata tuần tự.
- Đã build/recreate **connector Web local**, giữ volume và hai profile Duy/Ánh; frontend cập nhật tại `/zalo-team`. Không triển khai VPS, không thay `/zalo` hoặc runtime PC/Wine cũ.
- Đo worker local khi đã có cache: trước mở My Documents 201 ms; sau nhận tin đầu 31–41 ms, hoàn tất 42–46 ms. Sidebar nhận section đầu 24–33 ms, hoàn tất 350–352 ms. Đây là mẫu nhỏ ở worker, số tin đợt đầu khác nhau; không phải p95 trình duyệt hay cam kết nhanh hơn mọi hội thoại.
- Phân trang thật: 13 + 15 + 4 = 32 mục; toàn bộ ID của cache refresh đều có trong các trang, cursor kết thúc đúng. Gửi thêm một tin test tiếng Việt/emoji/hai dòng vào **My Documents của Duy**, được xác nhận và preview tự cập nhật. Ảnh `.local/send-proof/native-loader-send.png`.
- Kiểm tra: TypeScript và 19 test worker đã qua (owner/identity, receipt, scheduler barrier, native loader trả cache trước cloud, cursor và parse một lần); ba browser fixtures send/sidebar/scroll đã qua. Đối chiếu Web đang mở, bundle Web hiện tại và core PC 26.9.10; PC không được điều khiển UI. Chi tiết phép đo và giới hạn ở `tooling/zalo-team/NATIVE-LOADING.md`. Chưa có người dùng nghiệm thu độ mượt, chưa kiểm tra tải nhiều tài khoản hoặc mất mạng dài hạn.

### 01/10/2026 — Sửa emoji trong dòng văn bản và bổ sung bước đối chiếu trước khi chốt

- Sửa `.messageEmoji`: 24px → 22px; bỏ `font-size:0`/baseline -6px, dùng `overflow:hidden`, margin-bottom -3px và baseline native. Emoji đơn/phần chỉ có emoji dùng 40px theo native thay vì 48px. Không thay nội dung hay xóa dấu xuống dòng người dùng nhập.
- Nguyên nhân: inline-block cũ giữ line box không phù hợp, làm hai dòng chữ/emoji cao 72px. Sau sửa hai dòng cao 48px, mỗi sprite 22×22px, bubble khoảng 400×74px; emoji đứng cùng dòng như ảnh PC người dùng cung cấp.
- Đối chiếu CSS Web đang được Chrome tải (`web-startup.072b39f95cd439c77ef7.css`), source renderer Web `79BI`, và đọc trực tiếp CSS trong `app.asar` của Zalo PC 26.9.10. Cả Web/PC dùng sprite thường 22px, lớn 40px và overflow hidden. PC được đối chiếu thêm ảnh người dùng; không điều khiển cửa sổ PC.
- Kiểm tra lại DOM và ảnh của đúng tin trong My Documents Duy trên Team sau HMR; không gửi thêm tin thử. Bổ sung quy tắc kiểm tra cả Web/PC/Team trước khi chốt chức năng ở đầu tài liệu. Chưa có người dùng nghiệm thu lượt sửa này.

### 01/10/2026 — Thanh soạn tin và gửi văn bản thật

- Hiển thị composer trong `ConversationDetail`; nút Gửi/Enter, Shift+Enter, emoji và tên tài khoản gửi. Giữ draft theo cả accountId và conversationId, không mất nội dung đang soạn tiếp khi request trước hoàn tất.
- Thêm API `send`, lệnh worker `send-text`, adapter native và receipt chống gửi trùng. Giữ ranh giới tài khoản/CRM hiện có, không mở endpoint gửi JavaScript/cookie hoặc chọn tài khoản ngầm.
- Cập nhật worker Docker local, giữ nguyên volume/profile. Gửi một tin kiểm thử duy nhất vào My Documents của Duy; native xác nhận thành công, tải lại trang vẫn thấy tin trong lịch sử và preview. Ảnh kiểm chứng: `.local/send-proof/duy-my-documents-sent.png`.
- Kiểm tra: TypeScript qua; 9 test worker qua (validation, owner/danh tính/profile, receipt sau restart và không gửi lại khi chưa rõ kết quả); 8 nhóm browser fixture qua (xuống dòng, draft từng tài khoản, Enter liên tiếp, sửa draft khi đang gửi, chuyển chat, unknown/offline, tra lại cùng UUID, emoji), không pageerror. UUID dùng nguồn ngẫu nhiên crypto kể cả host local không có `randomUUID`.
- Giới hạn hiện tại: gửi văn bản/Unicode emoji; chưa gửi file/ảnh/sticker, reply/mention có cấu trúc, reaction hoặc gọi điện. Chưa triển khai VPS, chưa có người dùng nghiệm thu lượt này.

### 01/10/2026 — Rà lại sidebar theo DOM/CSS Web, sửa điều hướng và hàng file

- Sửa quyết định sai ở lượt trước: chỉ bỏ nút thu gọn trùng bên trong sidebar; khôi phục nút quay lại 20px cho tất cả trang kho/thành viên. `ConversationInfo` không còn nhận callback đóng dư; nút đóng/mở duy nhất nằm trên header chat.
- Đo trực tiếp sidebar Web Duy Anh Web: header 68px, profile 224px, icon tác vụ 20px trong vòng 32px, back 20px, section 40px, nút Xem tất cả 32px/16px, hàng file 64px với SVG 40px, icon hover 16px. Đưa kích thước, khoảng cách và độ đậm về các giá trị này; ảnh cách Xem tất cả 16px, bỏ khoảng dư 12px.
- File sidebar dùng 10 SVG công khai của Web (`files/web/`), không dùng icon card PC 48px co giãn sai. Dùng `object-fit: contain`, giữ kích thước trước khi ảnh tải. Tên file dài rút gọn phần tên, giữ đuôi; hover chỉ phủ action ở góc trên, không đẩy nội dung/ngày. Không thêm hành vi tải/ghi chưa triển khai.
- Chuẩn hóa bề rộng phần nội dung kho giống overview, tránh bị hụt thêm vùng scrollbar. Bộ lọc dùng pill 24px và glyph native, tìm kiếm dạng bo tròn 26px; sửa label inline gây vỡ ô tìm kiếm. Nhóm ngày có separator gốc.
- Icon tác vụ chưa nối API vẫn disabled và có tooltip, nhưng không giảm opacity làm sai mẫu. Tên tài khoản nguồn giữ trong tooltip tên hội thoại; tên tài khoản vẫn có ở danh sách/chat. Có icon sửa tên đúng vị trí, disabled vì chưa triển khai thao tác ghi.
- Kiểm chứng: TypeScript qua; 9 luồng sidebar và 8 nhóm kiểm tra hồi quy qua. Thêm kiểm tra quay lại cả ba tab, một toggle duy nhất, file không đổi hình học khi hover, SVG tải được, hàng 64px/icon 40px, input nằm trong field, bề rộng kho ở viewport 1440px và 1000px. Không pageerror.
- Local Chrome: kho File trả dữ liệu thật, hàng rộng 343px/cao 64px; nút quay lại hoạt động và overview chỉ còn một toggle ở header chat. Ảnh `.local/sidebar-proof/sidebar-reviewed-files.png`. Frontend đang cập nhật qua HMR; chưa có người dùng nghiệm thu lượt này, không deploy VPS hoặc restart connector.

### 01/10/2026 — Sửa icon tải file, gallery, header kho và dòng link

> Điều hướng và icon file của mục này đã được sửa tiếp ở bản rà soát phía trên.

- Card file dùng glyph gốc `file-preview-download-icon` (`eb29`), nút 24px, màu chữ tối; sửa độ ưu tiên CSS để không bị màu xanh của liên kết ghi đè.
- Gallery hội thoại chỉ ghép ảnh/video, loại sticker; sticker vẫn có thể mở riêng. Dải thumbnail giữ cuộn nhưng ẩn thanh cuộn hệ thống.
- Bỏ hai icon trong header Kho lưu trữ theo ảnh yêu cầu; giữ nút đóng/mở ở header chat. Trang thành viên vẫn có nút quay lại.
- Dòng link dùng ô chain 40px, URL 14px/500 và domain 12px màu `#005ae0`; hover/focus chỉ hiện nút Mở liên kết với glyph Web `ebe7`, bỏ copy và menu thừa.
- Đối chiếu CSS/core PC và DOM/CSS Zalo Web trên Chrome Duy Anh Web. Kiểm tra trực tiếp Team: header kho không còn nút thừa, link có một nút mở; viewer mẫu có 9 thumbnail, không trùng nguồn sticker, scrollbar `none`.
- Kiểm chứng: TypeScript `--noEmit --incremental false` qua; browser fixture qua 9 luồng sidebar và 5 kiểm tra hồi quy media/link, không pageerror. Ảnh đối chiếu local `.local/sidebar-proof/sidebar-live-links.png`; fixture được ghi riêng, không coi là dữ liệu thật.
- Frontend local nhận thay đổi qua HMR; không cần khởi động lại connector. Chưa có nghiệm thu của người dùng cho lượt chỉnh này.

### 01/10/2026 — Chuẩn hóa các trang con sidebar theo source Web/PC

- Đối chiếu module Web `VLvn`/`ENRE`/`wlMe` và CSS Zalo PC 26.9.10. Sửa lỗi luồng Xem tất cả và Thành viên trước đây dùng dialog: nay mở trang con ngay trong sidebar, có quay lại; kho có tab Ảnh/Video, File, Link và tự tải thêm khi cuộn. Mặc định mở sidebar khi chọn chat giữ nguyên.
- Tách `InfoLibrary`, `InfoMediaItems`, `MediaViewer`, `info-api.ts`, `info-presentation.ts`. Hàng file/link nhỏ gọn theo mẫu, nhóm ngày, thumbnail lỗi có trạng thái; tìm kiếm không dấu, lọc người gửi/ngày/loại trên phần đã tải với nhãn phạm vi rõ ràng. Chưa tìm kiếm toàn bộ kho phía native.
- Trình xem ảnh dùng chung ở lịch sử và sidebar: nền tối, dải thumbnail, chuyển ảnh/phím trái-phải, zoom/kéo/double click/xoay/reset, video controls, toàn màn hình, mở bản gốc. Có fallback từ ảnh gốc lỗi sang thumbnail và thông báo, không báo đã tải về giả.
- API bổ sung projection người gửi, xử lý `fromUid=0` về tài khoản nguồn và hydrate tên thiếu; giữ nguyên ID lớn dưới dạng chuỗi, auth/owner/inbox/abort boundary.
- Kiểm tra: TypeScript qua, 24 tests adapter/renderer qua; 9 luồng Chromium fixture qua, không pageerror. Đã xem ảnh fixture sidebar/kho/viewer trong `.local/sidebar-proof/`. Chi tiết bằng chứng: `tooling/zalo-team/SIDEBAR-UI-REFERENCE.md`.
- Đã cập nhật frontend local `/zalo-team`, build lại riêng connector và giữ volume. API media thật sau cập nhật trả dữ liệu; không deploy VPS, không thay luồng `/zalo`/CRM.
- Giới hạn: duyệt tự động chặn đọc tab Zalo Web cá nhân; đã tiếp tục bằng source, chưa đối chiếu trực quan phiên Web/PC trong lượt này. Ghim/tắt thông báo/thêm thành viên/quản lý nhóm, nhắc hẹn và nhóm chung chưa nối API; không coi mọi chức năng đã tương đương native.

### 01/10/2026 — Sidebar thông tin hội thoại thật, mặc định mở

- Người dùng xác nhận là sidebar **bên phải**. Chọn chat mở sidebar mặc định; nút panel góc header có trạng thái active và cho đóng/mở. Chọn chat khác mở lại và bỏ dữ liệu/request của chat trước.
- Thêm `POST /api/zalo-team/conversation-info`: `{accountId, conversationId, section?: overview|images|files|links|members, cursor?: string}`. Cùng cổng xác thực CRM/Origin/owner; worker xác minh danh tính và hội thoại thuộc inbox trước khi đọc.
- Nghiên cứu source: `dEOl.getChatMedia`/`loadMiniPreview`, `EYv5` media manager, `Gm1y.getFullInfoGroupById`, `UiPd` profile. Kho sidebar độc lập với 50 tin đang render. Không đổi active conversation native, không đánh dấu đã đọc hoặc gửi tin.
- Overview tối đa 8 media, 3 file, 3 link; Xem tất cả đọc 24 bản ghi native/trang, thành viên 50 người/trang. Ghép theo ID, giữ ID lớn dạng chuỗi, chuẩn hóa URL HTTPS và chỉ trả trường hiển thị. Nội dung protected có trạng thái riêng. Lỗi một kho không biến thành “không có dữ liệu” và không làm mất các kho còn lại.
- UI dùng font/icon/layout chung; file hiển thị icon/tên/dung lượng/ngày gọn, link dạng hàng nhỏ, ảnh/video dạng lưới. Ảnh lớn dùng dialog; ID tiêu đề dialog riêng để hỗ trợ mở ảnh từ hộp kho. Bỏ dữ liệu mẫu “8 thành viên”. Chưa nối nhắc hẹn, nhóm chung và thao tác ghi như ghim/đổi tên/tắt thông báo/quản lý nhóm.
- Kiểm tra: TypeScript qua, **24 tests qua**, gồm 4 tests sidebar mới (cách ly tài khoản/inbox, owner/offline, media/member pagination, dữ liệu protected/lỗi từng kho). API thật: Duy 67 hội thoại, Ánh 53; nhóm mẫu 108 thành viên, hai trang đầu 50 + 50 không trùng; nhóm file mẫu trả 6 file; kho ảnh mẫu trả 23 ảnh.
- UI Chrome local đã kiểm: mặc định mở, đóng panel, chuyển chat tự mở lại; nhóm hiển thị 108 thành viên và dialog tải 50 → 100; đổi từ Duy sang Ánh đổi đúng tài khoản nguồn; Xem tất cả hiển thị 23 ảnh và ảnh lớn tải thành công. Ảnh minh chứng `.local/zalo-team-sidebar-live.png`. Đã reload tab `/zalo-team` để dùng bundle mới.
- Đã build/recreate riêng connector `x3-zalo-team-web-connector-1`, giữ nguyên volume và hai phiên kết nối. Frontend local cập nhật tại `/zalo-team`; không sửa `/zalo`, không deploy VPS. Kho media vẫn phụ thuộc dữ liệu/hạn URL của Zalo Web, chưa có lưu trữ dài hạn và chưa người dùng nghiệm thu.

### 01/10/2026 — Cuộn lên tự tải lịch sử và đối chiếu mẫu hiển thị

- Bỏ nút “Xem tin nhắn cũ hơn”. Khi người dùng cuộn lên cách đầu danh sách dưới 160px, tự tải trang trước. Hỗ trợ bánh xe và phím Home/PageUp/ArrowUp; không tự tải toàn bộ lịch sử lúc mở chat.
- Khóa request lịch sử đang chạy; polling không ngắt request này. Cursor phải tiến về quá khứ; cursor không tiến hoặc lỗi mạng dừng tải tự động và chỉ hiện “Thử lại” cho đúng trang bị lỗi. Cursor null dừng tải.
- Giữ vị trí bằng ID + khoảng cách của tin đang đọc, thay vì chỉ cộng chênh lệch tổng chiều cao. ResizeObserver bù vị trí khi ảnh phía trên tải xong; thao tác cuộn của người dùng cập nhật mốc đọc. Đổi chat hủy và bỏ kết quả cũ.
- Đối chiếu 10 message frame trên Zalo Web trong Chrome Duy Anh Web với 10 tin trên Team: text 15/22px, giờ 12/18px, bubble padding 12px/radius 6px. Đã xem ảnh hiển thị hai bên. Mẫu Web có ảnh kèm chú thích: sửa thứ tự thành ảnh trước, chú thích dưới, tên người gửi nhóm nằm ngoài card ảnh. Đây là hai tài khoản/hội thoại khác nhau, chỉ đối chiếu định dạng.
- Kiểm chứng: TypeScript qua; 14 kiểm tra component/scroll-helper/API qua; 9 tình huống Chromium thật dùng fixture qua (tự tải, một request, giữ mốc prepend/media, cuối lịch sử, không trùng, lỗi/thử lại, cursor không tiến, đổi chat). Trên Chrome dùng dữ liệu thật, cuộn lên tăng **50 → 100 tin, 100 ID duy nhất**, không có nút tải lịch sử. Ảnh local: `.local/zalo-team-auto-history.png`.
- Bộ kiểm tra browser: `tooling/zalo-team/message-scroll.browser.mjs`, chạy qua stdin trong container Playwright tạm, giới hạn 768 MB và không mount profile. Không thay connector, không gửi tin/đánh dấu đã đọc, không triển khai server.
- Giới hạn: đã đối chiếu source PC ở lần trước; chưa đọc được cửa sổ Zalo PC vì công cụ đã từ chối truy cập ứng dụng. Chưa xác minh trực quan 5–10 tin PC hay nghiệm thu toàn bộ rich text/reaction/poll/danh thiếp.

### 01/10/2026 — Chỉnh format chi tiết từ source Zalo Web và Zalo PC

- Đọc trực tiếp CSS/component trong `app.asar` Zalo PC 26.9.10 và bundle Web. Sau yêu cầu của người dùng đã dừng Computer Use; không sửa bản cài, profile PC hoặc luồng `/zalo` cũ.
- Tách renderer nội dung khỏi logic tải lịch sử. Sửa avatar 40px, tên nhóm 13px, text 15/22px, bubble bo 6px/nền gửi `#e5f1ff`, spacing 4/8/16px, giờ cuối cụm và separator khi cách hơn 30 phút. Nhóm theo ID người gửi để không gộp người trùng tên.
- Ảnh/sticker không còn nằm trong bubble trắng có padding; file dùng card ngang, SVG gốc và dung lượng; link có URL/preview/tiêu đề/mô tả/domain; quote có màu nền theo hướng gửi và ảnh nếu sẵn có. Cuộc gọi tách khỏi thông báo hệ thống.
- API bổ sung ID người gửi, kích thước media, thumbnail quote và token emoji native; không trả HTML, không thêm archive hay gửi tin. Đã sửa khác biệt `token.text` (Unicode gốc) và `token.value` (alias) khi render emoji.
- Đã build lại connector riêng và giữ volume phiên. API thật: hai tài khoản connected, 67/52 hội thoại; mẫu chi tiết cá nhân 50 tin, nhóm 50 tin, file 6 tin, cuộc gọi/file 3 tin. Các mẫu không thiếu ID người gửi; nhóm có emoji thật trả sprite thành công HTTP 200.
- Kiểm tra: TypeScript không lỗi; 23 bài kiểm tra adapter và render/component qua, bao gồm phân trang, khác tài khoản, trùng tên, đổi ngày theo múi giờ VN, quote/file/media và emoji Unicode.
- **Chưa nghiệm thu trực quan sau sửa** theo yêu cầu kiểm bằng source, không Computer Use. Chưa phủ toàn bộ rich text, reaction, poll, danh thiếp hoặc nhóm ảnh ghép từ nhiều message riêng; xem tài liệu tham chiếu để tiếp tục đúng phạm vi.

### 01/10/2026 — API và giao diện đọc chi tiết hội thoại

- Kiểm tra tab Zalo của Chrome Duy Anh Web và phân tích bundle Web đang được trang tải. Nối loader/DB/parser của client trong Docker vào lệnh `messages`; không lấy cookie của Chrome cá nhân và không dùng VNC.
- Thêm route `/api/zalo-team/messages`, adapter `tooling/zalo-team/web/messages.mjs`, kiểu tin nhắn và component `ConversationDetail`. Giao diện tái sử dụng font/icon/avatar/bubble/dialog hiện có, hiển thị đúng chiều gửi/nhận và giờ Việt Nam; chọn ảnh mở dialog, file/link mở tài nguyên gốc.
- Kiểm tra API thật: hai phía cùng cuộc trò chuyện Duy/Ánh đều đọc được; hai trang 50 tin không trùng. Nhóm có quote, ảnh và file đọc được. Số chưa đọc giữ nguyên trước/sau đọc API trên các mẫu kiểm tra. Ảnh JXL chuyển sang JPEG và sticker tải được trong Chrome.
- Kiểm tra UI bản cuối: tải từ 50 lên 100 tin, đủ 100 ID duy nhất và giữ vị trí đọc; đổi chat khác tài khoản cập nhật đúng tiêu đề/tài khoản nguồn. BAN TRUYỀN THÔNG hiển thị 100 tin; mở ảnh lớn thành công, ảnh gốc tải được, đóng dialog trở về lịch sử. Nhóm kiểm tra tác giả trước đó thiếu cache đã đủ tên/avatar cho 50 tin. Yêu cầu tải tin cũ chủ động được ưu tiên hơn poll nền đang chạy.
- Kiểm tra tự động: TypeScript sạch; 18 test đạt, gồm scope chủ tài khoản, danh tính phiên, hội thoại ngoài inbox, cursor có ID lớn/cùng thời gian, lỗi tải cloud và chuẩn hóa media/quote. Đã cập nhật connector và frontend local; chưa nghiệm thu bởi người dùng, chưa deploy VPS.

### 01/10/2026 — Đủ ảnh ghép nhóm và chọn tài khoản bằng avatar

- Nguyên nhân avatar nhóm thiếu: adapter chỉ đọc ảnh từ cache danh bạ, bỏ qua `topMember.avatar/dName` dù dữ liệu nhóm đã có; các thành viên chưa hydrate vào cache bị loại khỏi mosaic. Đã bổ sung fallback ảnh/tên trực tiếp từ nhóm và giữ đủ vị trí thành viên.
- API trả `memberCount` từ nguồn nhóm. Avatar chung hiển thị ba ảnh + tổng thành viên khi nhóm trên bốn người, tối đa `99+`; nhóm có ảnh riêng vẫn ưu tiên ảnh nhóm.
- Status adapter đọc avatar chủ tài khoản; registry và API danh sách truyền `avatarSrc`. Component `AccountSwitcher` mở popup cạnh logo mini X3Sales sẵn có của CRM, hiển thị ảnh/tên và trạng thái đang chọn. Chọn tài khoản lọc tại frontend ngay, xóa lựa chọn hội thoại cũ; tìm kiếm và chưa đọc vẫn kết hợp được.
- Đã build và cập nhật riêng connector Docker Zalo Team local; hai profile tự kết nối lại. TypeScript sạch; 12 test đạt, gồm hồi quy ảnh nhóm khi cache danh bạ chưa có thành viên và lọc URL ảnh không hợp lệ.
- Kiểm tra API thật: HĐH và DT002 đều trả đủ bốn ảnh thành viên; HĐH có 108 thành viên. Kiểm tra trình duyệt: ba ảnh HĐH tải thành công, ô `99+`; lọc Duy 67, Ánh 52, tất cả 119. Chưa có nghiệm thu mới từ người dùng; không triển khai VPS.

### 01/10/2026 — Lấy đúng danh sách native, bỏ các dòng metadata thừa cuối inbox

- Nguyên nhân: adapter duyệt `ConvInfoDataManager.getAllConvSync()`. Kho này giữ cả thông tin hội thoại không còn trong inbox Web; `ConvList.getVisibleConv()` chỉ kiểm tra một phần điều kiện, không chứng minh bản ghi thuộc danh sách đang hiển thị. Các dòng không có preview/thời gian bị dồn xuống cuối danh sách CRM.
- Đổi sang `ConvListController.getList({key: mainWindow})`, đúng nguồn danh sách visible của UI gốc và độc lập với bộ lọc unread/label của worker. Kiểm tra `isPreviewLoaded()` trước khi trả kết quả. Vẫn kiểm tra account identity, hidden conversation và loại ID hệ thống.
- Không cắt theo tên, ngày 17/09 hoặc số lượng cố định; không xóa metadata/profile. Hội thoại trống hợp lệ vẫn được giữ nếu native đưa vào inbox.
- Kiểm chứng local: build/recreate connector thành công, cả hai tài khoản phục hồi không cần QR; API còn 67 Duy + 52 Ánh. Duy kết thúc ở đúng Trần Huyền — Sticker — 17/09; Chrome `/zalo-team` lọc Duy và cuộn sát cuối xác nhận không còn LTMTK12-BKACAD hay các dòng trống thừa sau đó. Ảnh `.local/zalo-team-duy-list-end.png`.
- 11/11 kiểm tra Node đạt, gồm regression metadata dư, giữ hội thoại trống native, loại ID hệ thống, chống trùng và chờ danh sách sẵn sàng. Không thay đổi lịch sử/media hoặc các giới hạn preview còn ghi ở trên.

### 01/10/2026 — Khôi phục preview Duy và sửa phân loại trạng thái đồng bộ

- Trước khi sửa code, lần đăng nhập lại đã khôi phục nội dung preview ở các hàng mới bị thiếu trong ảnh. Khởi động lại riêng connector giữ profile vẫn khôi phục đúng cả hai tài khoản; không cần QR lần nữa. Không gán kết quả khôi phục này cho bản sửa formatter.
- Xác định lỗi trong `web/conversations.mjs`: `sh7v.a(preview, conv)` truyền sai hợp đồng. Vendor `8W5D` truyền `{isSyncEnabled, isSyncing}`; thiếu các cờ này khiến `MSG_SYNCING` (2510) bị dịch thành thông báo không có tin gần đây. Adapter nay đọc trạng thái thật từ `SyncConfigService`/`SyncController` và dùng đúng tham số.
- Bổ sung `previewState`; phân biệt chưa đồng bộ, ngoài phạm vi nguồn, đang nạp E2EE và thiếu preview. Khi adapter trạng thái chưa sẵn sàng, không khẳng định lịch sử trống. Chờ PreviewDataManager tải DB trước khi trả danh sách. Chỉ đọc trạng thái, không gọi đồng bộ điện thoại, mở hội thoại, gửi seen hoặc xây kho lưu.
- Kiểm tra: 10/10 kiểm tra Node và TypeScript frontend đạt, gồm regression trạng thái đồng bộ và danh tính tài khoản. Build/recreate connector local thành công; API live sau cập nhật trả 137 dòng, 3 preview Duy có đúng `[Tin nhắn chưa đồng bộ]` với `previewError=false`, 1 preview Ánh thuộc `out_of_range`. Đã kiểm tra trực tiếp UI lọc Duy, ảnh `.local/zalo-team-duy-preview-verified.png`.
- Giới hạn: nguồn của 3 mục Duy vẫn chưa có nội dung đầy đủ. Nhóm HĐH trong mẫu chưa khớp preview sự kiện bình chọn của phiên Chrome; không lấy nội dung mẫu cũ chèn vào API hoặc báo đạt 10/10 mẫu. Nguyên nhân vì sao phiên đầu không nạp đủ dữ liệu chưa được tái hiện sau đăng nhập lại. Chưa coi đăng nhập lại là biện pháp sửa dứt điểm mọi trường hợp.

### 01/10/2026 — Chốt mẫu thật của Duy trước khi đăng nhập lại connector

- Đọc đúng tab **Zalo - Duy** trên Chrome Duy, không dùng tài khoản D U Y A N H W E B It làm mẫu thay thế. Ghi nhận 10 hàng đầu (ID hội thoại dạng chuỗi, preview đang hiển thị, thứ tự/thời gian) và mốc cuối danh sách. Không mở hội thoại mới hoặc thay trạng thái đọc.
- Lưu bằng chứng riêng trong `.local/zalo-web-research/duy-reference-baseline.json`, `duy-reference-top.png`, `duy-reference-boundary.png`; không chép nội dung trò chuyện vào README/Git. Các bundle đang tải trên tab Duy khớp phiên bản trong `WEB-API-RESEARCH.md`.
- Xác nhận trực tiếp Web hiển thị thông báo tìm tin trước **17/09/2026** bằng Zalo PC. Đây là mốc giới hạn lịch sử cũ của phiên Web tại thời điểm kiểm tra, không phải thời điểm tin mới nhất; không dùng mốc này để giải thích preview mới bị thiếu.
- Source adapter hiện chỉ đọc preview trong bộ nhớ client. Source vendor có luồng preload riêng (`getLastMessagesForPreview`); chưa đủ bằng chứng kết luận vì sao dữ liệu trong phiên Docker bị thiếu. Không coi placeholder là kết quả đúng chỉ vì số lượng hội thoại khớp.
- Chưa thay code hoặc báo sửa xong. Bước tiếp theo: sau khi Duy kết nối lại, đối chiếu đúng ID/mẫu đã lưu, kiểm tra dữ liệu đầu vào và formatter để sửa đúng lớp gây thiếu preview.

### 01/10/2026 — API danh sách hội thoại hai tài khoản

- Theo yêu cầu, hoãn luồng lưu/đồng bộ lịch sử và media. Đối chiếu script đang tải trên Chrome **Duy Anh Web**; dùng các manager đã khởi tạo trong worker Web (`QPNp`, `yzMR`, `UiPd`, `Gm1y`) và formatter preview gốc `sh7v`. Không sao chép cookie hay điều khiển chat của tab tham chiếu.
- API `POST /api/zalo-team/conversations`, JSON `{}`; yêu cầu phiên CRM và Origin cùng trang. Response gồm `conversations`, `accounts` (trạng thái/số dòng/lỗi từng tài khoản), `fetchedAt`; no-store. Worker chỉ đọc tài khoản thuộc chủ phiên CRM và đang kết nối. Một tài khoản lỗi không làm mất kết quả tài khoản còn lại.
- Dòng có `id = accountId:conversationId`, `conversationId` dạng chuỗi, `accountId`, `accountName`, `name`, `avatarSrc`, `avatarMembers`, `preview`, `updatedAt` (ms), `unread`, `pinned`, `lastMessageId`. API vẫn trả từng nguồn riêng; từ 03/10 UI dùng liên kết nhóm xác nhận để gộp các nguồn thành một dòng và chọn tài khoản truy cập. Chat cá nhân không gộp. Không xuất token, khóa hoặc nội dung lịch sử vào API này.
- `/zalo-team` bỏ danh sách/bubble mẫu khỏi luồng chạy, lấy API khi mở trang và làm mới mỗi 10 giây khi trang còn mở. Chỉ giữ response trong React state; chưa ghi hội thoại vào DB/file của CRM. Profile/IndexedDB do Zalo Web tự quản lý vẫn hoạt động bình thường, không phải kho lưu riêng của dự án.
- Đã chạy trên local: cả hai tài khoản connected, API trả 81 + 56 = 137 hội thoại, không có tên fallback ID hoặc lỗi formatter ở mẫu kiểm tra. 28 hội thoại có dữ liệu avatar thành viên. Bộ lọc UI Duy/Ánh/Mọi tài khoản trả đúng 81/56/137.
- TypeScript toàn frontend và 8 kiểm tra tự động đạt, gồm cách ly chủ phiên, ID lớn dạng chuỗi, khóa hội thoại theo tài khoản, sắp xếp ghim và lỗi một phần. Chưa nghiệm thu đầy đủ preview mọi loại tin; nguồn có thể trả `[Không có tin nhắn gần đây]`, giữ nguyên thay vì bịa nội dung. Chưa triển khai lịch sử, gửi/nhận qua API riêng, lưu media hoặc VPS.
- Khi tải sạch UI cuối lượt, port 3000 đang chạy `next start` trong khi trình duyệt/cache có tài nguyên dev và lỗi HMR CSS; route trả 500. Đã phục hồi riêng frontend bằng `next dev -H 127.0.0.1 -p 3000` từ `apps/frontend`, log tại `.local/zalo-team-frontend.{out,err}.log`. Không thay source CRM hoặc dịch vụ backend.

### 30/09/2026 — Thêm tài khoản Web độc lập

- Tách quản lý phiên thành `tooling/zalo-team/web/accounts.mjs`; mỗi tài khoản có context, profile, trạng thái và cờ tự phục hồi riêng. Giữ nguyên profile đã đăng nhập của Duy khi chuyển metadata sang phiên bản 2.
- Bổ sung `accountId` cho API và các nút theo hàng; hộp thoại đăng nhập hiển thị đúng tên tài khoản vừa liên kết, không lấy tên hàng đầu tiên.
- TypeScript toàn frontend và 6 kiểm tra tự động đạt: migration, hai danh tính/profile, hủy QR, dừng riêng, phục hồi theo enabled, chặn trùng và kiểm tra quyền sở hữu/lệnh đầu vào. Kiểm tra nhiều phiên dùng browser giả lập trong unit test, chưa thay thế nghiệm thu hai tài khoản thật.
- Worker mới đã chạy local, healthy; Chrome xác nhận Duy vẫn Đang kết nối sau migration. QR mới đã hiển thị; thử hủy QR vẫn giữ Duy online, sau đó mở lại Thêm liên kết thành công. Cần người dùng quét/xác nhận để kiểm chứng phiên thật thứ hai. Ảnh danh sách sau hủy (không chứa QR): `.local/zalo-team-multi-account.png`.
- Chưa đồng bộ tin nhắn, danh bạ/media; chưa triển khai VPS hoặc sửa `/zalo` cũ.

### 30/09/2026 — Chuyển accounts từ PC sang Web

- Thay API/frontend provider bằng Web; bỏ khởi chạy Windows ở route PC cũ. Docker mới `x3-zalo-team-web`, độc lập các container cũ.
- Worker dùng profile bền vững, QR/cancel/retry/status/stop, chặn ghi đè danh tính đã liên kết, không có endpoint chạy JS tùy ý. Chỉ xuất metadata và QR cần hiển thị.
- Theo chỉ dẫn người dùng, đối chiếu trang đăng nhập trên Chrome Duy: QR là SVG, sửa adapter thay vì chỉ tìm img/canvas; entrypoint là chat.zalo.me và để Zalo tự điều hướng.
- Đã thấy QR thật trong `/zalo-team/accounts`; người dùng quét/xác nhận và tài khoản Duy chuyển Đang kết nối. Tạo lại container với source cuối cùng, giữ volume; giao diện xác nhận Duy vẫn kết nối, không cần QR mới.
- TypeScript toàn frontend và 3 kiểm tra guard đạt; container healthy. Kiểm tra HTTP: worker thiếu token trả 403, API sai Origin trả 403, thiếu phiên CRM trả 401, route PC cũ trả 410. Chưa kiểm chứng đa tài khoản hoặc độ ổn định dài hạn.
- Không đổi luồng tin nhắn mẫu, không gửi tin, không triển khai đồng bộ file hoặc VPS.

### 30/09/2026 — Khảo sát API Zalo Web, chưa đổi kiến trúc chạy

- Theo yêu cầu mới, đọc script của tab Zalo Web Duy và phân tích bundle công khai. Bản đồ chi tiết và mức bằng chứng: [WEB-API-RESEARCH.md](tooling/zalo-team/WEB-API-RESEARCH.md).
- Tìm được hàm/endpoint đăng nhập, lịch sử, preview, gửi tin, media, WebSocket/polling, crypto/E2EE và IndexedDB. Chưa ghi Network live, chưa gọi các endpoint bằng connector mới; bundle có code chung PC/Web nên không coi mọi nhánh là đang chạy.
- Tìm được `roll_msg` với mốc mặc định 14 ngày và điều khiển qua remote config; chưa xác nhận giá trị của phiên hiện tại. Kho lưu riêng cần tải nội dung thực, không chỉ giữ URL media.
- Đề xuất thử connector Web riêng với profile bền vững, UI React và kho lưu riêng; chưa triển khai thay cho bản PC hoặc Docker, chưa thay đổi phiên cá nhân.

### 30/09/2026 — Chốt lại vị trí chạy ứng dụng nền

- Sau phản hồi đóng Zalo trên Windows khiến trang mất kết nối, kiểm tra source xác nhận API hiện khởi động trực tiếp bản sao `Zalo.exe` trên máy local, chưa có dịch vụ Docker độc lập.
- Ghi hướng chuyển sang Docker Linux/Wine với UI React truyền dữ liệu qua API, không truyền màn hình VNC. Bước này cập nhật định hướng, chưa thay runtime hoặc di chuyển phiên đang lưu.

### 30/09/2026 — Đăng nhập PC thật và giữ phiên

- Thêm tooling Zalo Team độc lập, profile/path Windows tách riêng trước khi khởi động bundle. Ngăn ứng dụng riêng sửa startup/default protocol của bản cá nhân.
- Thêm API local có kiểm tra phiên CRM, Origin, allowlist command và token connector. Frontend hiển thị QR thật cùng trạng thái chờ quét/xác nhận/hết hạn/đã kết nối; không lấy file metadata làm bằng chứng online.
- Thay account fixture bằng dữ liệu thật. Nút Tạm dừng giữ phiên; Kết nối lại phục hồi profile; Kiểm tra đọc trạng thái ứng dụng. Cột bạn bè để trống vì chưa đồng bộ.
- Người dùng đã quét/xác nhận Duy; kiểm tra trực tiếp Chrome thấy tài khoản kết nối. Đã dừng/mở lại ứng dụng dự án và phục hồi đúng Duy không cần QR; profile isolation báo đạt.
- Kiểm tra: TypeScript toàn frontend đạt; 5/5 kiểm tra giới hạn đường dẫn, danh tính tài khoản và QR đạt. Connector thiếu token trả 403; API khác Origin trả 403; API thiếu phiên CRM trả 401. Lệnh node:test mặc định gặp sandbox `spawn EPERM`, chạy lại với `--test-isolation=none` đạt.
- Tin nhắn trên `/zalo-team` vẫn là UI mẫu; chưa triển khai đọc/gửi, đồng bộ file, đa tài khoản hoặc server.

### 30/09/2026 — Trang Liên kết tài khoản

- Tham khảo trực tiếp `https://zalo.salework.net/setting` trên Chrome **Duy Anh Web**: bảng tài khoản, bộ lọc trạng thái, tìm kiếm và hộp thoại đăng nhập QR. Không sao chép dữ liệu tài khoản hoặc QR thật.
- Thêm route `/zalo-team/accounts`. Dùng font Segoe, icon Zalo, nav 64px, header 68px và control 32px từ bộ giao diện Tin nhắn.
- Bỏ đúng bốn icon dưới cùng theo ảnh người dùng; icon Liên kết tài khoản mới ở cụm trên. Link Tin nhắn/Tài khoản điều hướng thật, có trạng thái active theo trang.
- Theo chỉnh sửa tiếp theo: mọi nút trong cột Hành động đều rộng 120px, cao 32px; các hàng căn theo hai cột cố định, nút Xóa có nhãn rõ ràng.
- Chỉnh typography cột tài khoản theo tab Tin nhắn: tên 16px/24px weight 500; điện thoại/cập nhật 14px/21px (thay 12px/18px); trạng thái và dòng tổng số tài khoản 14px. Giữ avatar 48px và khoảng cách 12px tới nội dung.
- Không đưa ba đoạn quảng bá/chính sách/điều khoản Salework vào giao diện. Không thêm các tab cài đặt khác, xuất Excel hoặc liên kết từ xa ở bước này.
- Tạo ba tài khoản minh họa với trạng thái đang kết nối, cần đăng nhập lại và đã ngắt. Ngắt/xóa chỉ sửa state mẫu trong trang, tải lại sẽ phục hồi. Không gọi API Zalo/Salework/gateway và không tác động tài khoản thật.
- Nút Thêm liên kết/Liên kết lại mở hộp thoại QR; hiện placeholder cùng thông báo chưa kết nối đăng nhập, không tạo QR giả hay thông báo đăng nhập thành công giả.
- Kiểm tra TypeScript toàn frontend đạt; Chrome xác nhận tìm kiếm kết hợp trạng thái còn đúng tài khoản mẫu, trạng thái rỗng và Xóa bộ lọc hoạt động, hộp thoại thêm/liên kết lại mở đúng và Escape đóng được. Chưa kết nối đăng nhập thật, chưa triển khai server; chờ nghiệm thu giao diện.

### 30/09/2026 — Màu badge và cụm soạn tin

- Đọc computed style từ Zalo Web: màu `--red-dot`/`--text-errors` là `#c31818`. Badge ở thanh xanh và danh sách dùng chung token `--zt-unread`, thay hai màu đỏ sáng cũ.
- Tách `MessageComposer` dùng chung. Toolbar dùng nút 32×32px, icon 24×24px, gap 12px và padding ngang 8px. Ô nhập có padding 10px 12px, chữ 15px/22.5px; cụm biểu cảm có nút 30×30px và gap 6px.
- Thay emoji 👍 của hệ điều hành bằng artwork SVG công khai mà mẫu sử dụng; nguồn ghi trong ASSETS.md. Chiều cao composer trống là 92px theo mẫu.
- Vẫn chỉ là UI và bản nháp theo hội thoại, chưa kết nối chức năng gửi hoặc đính kèm.
- Kiểm tra: TypeScript toàn frontend đạt; tải mới trang local không có lỗi console mới. Đo trên Chrome: badge `rgb(195, 24, 24)`, composer 92px, nút toolbar 32px/icon 24px, input line-height 22.5px khớp mẫu. SVG tải thành công; panel nhóm vẫn mở được. Ảnh kiểm tra lưu tại `.local/zalo-team-ui.png`; chờ người dùng nghiệm thu.

### 30/09/2026 — Chuẩn hóa component, tìm kiếm, thanh cuộn và khoảng cách panel

- Tách component dùng chung vào `src/features/zalo-team/`; chuyển stylesheet từ route sang `zalo-team.module.css`, tách fixture và type. Route giữ phần điều phối trạng thái/tương tác mẫu.
- SearchInput dùng input đầy khung 240×32px, line-height 32px, padding ngang 30px, icon định vị đúng 12px/9px như Zalo Web. Focus không làm dịch nội dung.
- ScrollArea dùng thanh cuộn native với phần thumb hiển thị 6px ở danh sách và 8px ở khung nội dung/panel. Bỏ phần border làm thanh cũ chỉ còn 4px. Gutter và bề rộng nội dung ổn định, không thu hẹp dòng chat khi lọc.
- Sửa separator bị cộng hai lần: bỏ border ở nhóm action lồng trong section. “Bảng tin nhóm” mở ra chỉ còn khoảng cách 8px sau dòng nhắc hẹn, thay vì 16px. Header Ảnh/Video, File, Link là 40px; các mục điều hướng là 48px theo mẫu.
- PanelSection quản lý open/closed riêng, hỗ trợ bàn phím và aria-expanded/aria-controls; đổi hội thoại không kế thừa nhầm trạng thái từ mục khác.
- Kiểm tra trực tiếp Chrome: input x80/y16, 240×32px và padding 0 30px khớp mẫu; separator sau dòng nhắc hẹn đúng 8px; dòng hội thoại luôn rộng 328px cả khi có 14 dòng và khi lọc còn một dòng. Đã mở/đóng Bảng tin nhóm trên bản local.
- Chỉ cập nhật giao diện local `/zalo-team`; chưa nối API, chưa triển khai server.

### 30/09/2026 — Rà chi tiết typography, avatar và icon

- Theo phản hồi người dùng: giữ layout đã chốt, đối chiếu lại computed styles giữa Zalo Web và `/zalo-team` trên cùng Chrome.
- Khớp font fallback/unicode-range, letter-spacing 0.2px, text-rendering, weight 500 của tiêu đề; phân biệt tên hội thoại đã đọc (400) và chưa đọc (500). Chỉnh cỡ chữ trong bubble và sidebar theo số đo thực tế, không giảm cỡ chữ đồng loạt bằng cảm giác.
- Icon ghim ở danh sách dùng `Pin_24_Filled` (16px), khác với `pin-outline` (20px) ở panel. Sửa glyph menu, mũi tên disclosure, icon thành viên; zCloud 30px, baseline icon và nền active bo 6px.
- Avatar nhóm: khung ngoài vuông trong suốt, bốn phần tử tròn 26px nằm trong khung 48px, chồng nhau 4px và ô đếm thành viên. Không còn bị cắt bởi border-radius tròn của avatar đơn.
- Căn danh sách bằng grid, giữ row 328×70px và nhịp 78px; preview không bị rút ngắn theo chiều rộng cột thời gian. Màu chọn đúng `#e5f1ff`. Chỉnh vị trí search/toolbar và dùng artwork My Documents mặc định từ CDN công khai (nguồn trong ASSETS.md).
- Panel nhóm có tiêu đề “Thông tin nhóm”, icon thành viên và bộ nút trình bày riêng theo mẫu; vẫn chỉ là UI, chưa có API/thao tác Zalo thật.
- Đã đo lại trên bản local: tên chat 16px/24px, preview 14px/21px, tiêu đề sidebar 18px/27px weight 500, tiêu đề mục 16px/24px weight 500; icon sidebar 28px và icon ghim 16px trùng tọa độ/baseline đã đo trên trang gốc.
- Kiểm tra cuối: 7/7 mẫu đối chiếu computed styles khớp về cỡ chữ/icon, weight, line-height, letter-spacing và màu; TypeScript toàn frontend và Prettier các file thay đổi đạt, không thấy lỗi console. Kết quả đo và ảnh local lưu tại `.local/zalo-team-style-audit.json`, `.local/zalo-team-ui.png` (không đưa dữ liệu riêng tư vào tài liệu).
- Ảnh đại diện cá nhân và nội dung vẫn là dữ liệu mẫu; chưa thể coi toàn bộ hai ảnh chụp giống từng pixel khi dữ liệu khác nhau. Chờ người dùng nghiệm thu chi tiết bản local, không triển khai server.

### 30/09/2026 — Dựng giao diện tab Tin nhắn theo Zalo Web

- Đọc kích thước, computed styles và icon từ trang Zalo Web đang mở; tải bộ font gốc về frontend.
- Thêm `src/app/zalo-team/messages-layout.tsx` và `messages-layout.module.css`; nối vào `page.tsx` hiện có.
- Danh sách chat và nội dung cuộn độc lập, ô nhập luôn nằm dưới khung chat; có trạng thái active/hover/focus, menu phân loại và trạng thái tìm kiếm rỗng.
- Chỉ dựng các phần thuộc tab Tin nhắn. Icon tab khác và chức năng gửi/gọi/đính kèm là phần trình bày, chưa nối xử lý.
- Kiểm tra: TypeScript toàn frontend (`npx tsc --noEmit --incremental false`) đạt; route local trả HTTP 200 và chứa UI mới; kiểm tra trực tiếp Chrome ở 1920×855, đo được nav 64px, inbox 345px tính cả border, header 68px và composer hiện đủ.
- Kiểm tra UI: tìm “Thu Hà” còn đúng một hội thoại, lọc “Công việc” còn bảy hội thoại, panel thông tin mở đúng; không thấy lỗi console trong phiên kiểm tra.
- Bản đang hiển thị tại **http://localhost:3000/zalo-team**. Chưa có nghiệm thu của người dùng, chưa triển khai server và chưa xác minh các chức năng Zalo thật.

### 30/09/2026 — Tạo tài liệu theo dõi riêng

- Thêm `README.ZALO-TEAM.md` làm nơi ghi quyết định và mọi thay đổi tiếp theo của Zalo Team.
- Đối chiếu hiện trạng trực tiếp với `apps/frontend/src/app/zalo-team/page.tsx`.
- Chỉ bổ sung tài liệu; không thay đổi chức năng hoặc runtime.

### 30/09/2026 — Khởi tạo trang trống

- Thêm `apps/frontend/src/app/zalo-team/page.tsx` trong frontend hiện có.
- Khai báo metadata với tiêu đề `Zalo Team`; component trả về `null`.
- Đã kiểm tra ở bước tạo trang: `http://localhost:3000/zalo-team` trả HTTP 200, title đúng.
- Chưa có giao diện hay chức năng để nghiệm thu; chưa triển khai server.

## Bước tiếp theo

Đợt A và phần triển khai source B đã kiểm chứng local, xem nhật ký và mục kết quả đầu [audit](ZALO-TEAM-AUDIT-2026-10-09.md). B còn cổng hiệu năng lớn/đo đồng thời và canary VPS; chưa được coi là nghiệm thu production. Theo lựa chọn mới, ưu tiên **D — Cộng tác CRM trước C — Vận hành/khôi phục**; đề xuất bắt đầu D1 bằng liên kết khách hàng/dự án và phân công hội thoại. Phạm vi D1–D4 ở mục 10 của audit chưa được tự triển khai; mọi bản phát hành vẫn cần kiểm tra quyền, dữ liệu và canary.
