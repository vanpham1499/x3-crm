# Nhóm nội bộ và phạm vi Toàn nhóm

## 1. Cách sử dụng

1. Vào **Tài khoản → Nhóm → Thêm nhóm**.
2. Nhập tên, chọn phòng ban, trưởng nhóm và thành viên. Có thể để trống trưởng nhóm trong lúc thiết lập.
3. Nếu chọn một nhân sự đang thuộc nhóm khác, tích xác nhận chuyển nhóm rồi lưu.
4. Vào **Tài khoản → Vai trò**, cấp **Toàn nhóm** cho từng quyền cần dùng: xem, sửa, xóa, duyệt hoặc quản lý KPI.
5. Vào **Dashboard** hoặc **KPI**, chọn nhóm tại bộ lọc **Phạm vi nhóm**. Người có quyền toàn bộ/toàn phòng có thể chọn nhóm thuộc phạm vi của mình; người có quyền toàn nhóm chỉ thấy những nhóm được quản lý.
6. Trong KPI, tab **Theo nhóm** dùng để xem tổng và nhập kế hoạch tháng. Tab **Theo nhân sự** thể hiện phần đóng góp của từng người vào nhóm đang xem; chi tiết và Excel giữ nguyên bộ lọc nhóm.

Chức danh trưởng nhóm không tự cấp quyền nghiệp vụ. Ví dụ, muốn trưởng nhóm duyệt báo cáo phải cấp riêng quyền duyệt báo cáo tuần ở phạm vi Toàn nhóm.

## 2. Cơ cấu và quyền

| Phạm vi | Dữ liệu |
| --- | --- |
| Toàn bộ | Toàn hệ thống theo quyền của từng phân hệ |
| Toàn phòng | Phòng ban chính và các phòng được giao quản lý |
| Toàn nhóm | Nhóm chính và các nhóm được giao làm trưởng nhóm |
| Cá nhân | Dữ liệu cá nhân theo quy tắc sở hữu hiện có |

- Mỗi nhóm thuộc một phòng ban. Nhóm đã tạo giữ nguyên phòng ban; khi tổ chức lại, tạo nhóm mới và chuyển thành viên.
- Mỗi nhân sự có tối đa một nhóm chính. Nhân sự có thể chưa được xếp nhóm.
- Một người có thể làm trưởng nhiều nhóm trong cùng phòng. Việc nhận thêm nhóm quản lý không tự chuyển nhóm chính của người đó.
- Khi chuyển người sang phòng khác, nhóm chính không còn phù hợp sẽ được gỡ; các nhiệm vụ trưởng nhóm ở phòng cũ cũng được gỡ.
- Nhóm chỉ xóa được khi không còn thành viên. Để giải thể, bỏ trưởng nhóm, chuyển/gỡ toàn bộ thành viên rồi xóa. Lịch sử và KPI vẫn giữ; người có quyền toàn bộ/toàn phòng có thể chọn nhóm đã lưu trữ để xem số liệu.
- Người chỉ có quyền cá nhân vẫn xem dữ liệu của mình dù chưa thuộc nhóm nào.
- Xem/sửa không tự cấp quyền xóa, duyệt, nạp tiền hay quản lý thanh toán. Quyền kế toán hiện có vẫn áp dụng.
- Quyền nhóm được kiểm tra ở backend cho danh sách, chi tiết, lookup, thao tác và người nhận thông báo. Trưởng nhóm không được tự duyệt báo cáo của chính mình bằng quyền duyệt nhóm.

## 3. KPI khi chuyển nhóm

KPI nhóm dùng cùng công thức phí quản lý trước VAT của KPI hiện có, áp dụng từ tháng 10/2026:

- Nhánh triển khai: ghi nhận phí quản lý theo tiền thu và người hưởng đã chốt của báo phí.
- Nhánh Sale: ghi nhận báo phí đầu tiên theo chính sách hiện có.
- Nhóm hưởng được xác định bằng **lịch sử nhóm chính tại thời điểm giao dịch thu tiền**.
- Lãnh đạo nhiều nhóm không làm KPI cá nhân được ghi nhận vào nhiều nhóm. Chỉ nhóm chính tại thời điểm thu tiền được hưởng từng nhánh.
- Hoàn tiền đảo lại các khoản phí đã ghi nhận theo thứ tự thu trước, trừ trước (FIFO), về đúng nhóm đã hưởng. Không lấy nhóm hiện tại để trừ.
- Từ 10/2026, KPI chính của nhóm và tỷ lệ hoàn thành chỉ tính nhánh triển khai. KPI Sale hiển thị riêng để đối soát, không cộng vào chỉ tiêu hoàn thành. Điều chỉnh này đang ở workspace, chưa triển khai production trong đợt rà soát ngày 15/10/2026.

Ví dụ: nhân sự thu 100 phí ở nhóm A, sau đó chuyển sang B và thu thêm 50. Khi hoàn 120 phí, nhóm A bị trừ 100, nhóm B bị trừ 20. Phần còn lại của B là 30.

**Dữ liệu trước khi có lịch sử thành viên:** hệ thống không tự gán những khoản thu cũ vào nhóm hiện tại. KPI cá nhân/phòng/công ty tiếp tục giữ nguyên. Vì vậy tổng nhóm có thể thấp hơn tổng phòng trong giai đoạn bắt đầu sử dụng; phần chưa có lịch sử nhóm không được tính vào nhóm nào. Đợt này không backfill hay sửa số liệu cũ.

Kế hoạch nhóm được nhập độc lập theo tháng. Trong màn đóng góp nhân sự của một nhóm, không chỉnh kế hoạch cá nhân toàn công ty vì số KPI hiển thị chỉ là phần thuộc nhóm đang xem.

## 4. Dashboard và báo cáo

- Khi chọn nhóm, KPI, kế hoạch, dự án, khách hàng, lead và các số nhắc việc được thu hẹp vào nhóm và giao với quyền sẵn có của từng phân hệ.
- Biểu đồ KPI dùng lũy kế và so sánh cùng kỳ như luồng đã triển khai trước đó.
- KPI lịch sử dùng nhóm tại thời điểm thu; danh sách công việc/dự án dùng nhân sự phụ trách và nhóm hiện tại. Do đó sau điều chuyển, công việc đi theo người phụ trách còn KPI đã ghi nhận giữ ở nhóm cũ.
- Nhóm đã lưu trữ dùng để xem lịch sử, không nhập kế hoạch mới.
- Thay đổi nhóm có lịch sử thời điểm bắt đầu/kết thúc; màn lịch sử hiển thị 200 lượt gần nhất.

## 5. Kỹ thuật và triển khai

- Migration: `apps/backend/database/migrations/2026_10_14_000100_create_internal_teams.php`.
- Thêm `teams`, `team_memberships`, `users.team_id`, các quyền `*_team` tương ứng phạm vi phòng và `team.view/create/update/delete`.
- Migration chỉ thêm quyền mới cho ADMIN. Các vai trò khác giữ nguyên cho đến khi admin cấu hình.
- Có ràng buộc một lịch sử thành viên đang mở/người, tên nhóm không trùng trong cùng phòng khi chưa xóa, và chỉ mục cho tra cứu thành viên/trưởng nhóm.
- Không tạo sẵn nhóm thật, không chuyển nhân sự thật, không thay quyền các vai trò khác.
- Đã áp dụng migration trên DB local và production. Production cập nhật ngày 15/10/2026; nhóm thật còn trống để admin cấu hình. [Biên bản triển khai](tooling/deployment/production/RELEASE-2026-10-15.md).

### Kiểm thử

- `tooling/tests/internal-teams-local.php`: CRUD, chuyển nhóm, phân quyền từng nghiệp vụ, thông báo duyệt, KPI/hoàn tiền, chi tiết, kế hoạch và Dashboard. Mọi fixture được rollback; không gửi thông báo.
- `tooling/tests/dashboard-kpi-trend.php`: hồi quy lũy kế và so sánh cùng kỳ.
- `tooling/tests/dashboard-kpi-trend-local.php`: đối chiếu Dashboard cá nhân/phòng trên dữ liệu local, chỉ đọc.
- `tooling/tests/dashboard-new-projects-local.php`: hồi quy thống kê dự án mới, rollback fixture.
- Kiểm tra TypeScript và PHP syntax; kiểm tra giao diện local bằng phiên CRM đã đăng nhập.

Kết quả kiểm tra local ngày 14/10/2026: 53 tình huống nhóm đạt; các bộ hồi quy Dashboard lần lượt đạt 40, 12 và 11 kiểm tra. TypeScript và PHP syntax đạt. Đã kiểm tra danh sách/popup quản lý nhóm ở desktop và chiều rộng 390px, chọn nhóm và mở chi tiết KPI, Dashboard nhóm với số nhắc việc đúng phạm vi. Nhóm rỗng phục vụ kiểm tra giao diện đã được dọn; chưa cấu hình nhóm cho nhân sự thật.

Khi triển khai lên môi trường khác: sao lưu DB theo quy trình dự án, đưa backend/frontend cùng phiên bản lên, chạy migration, kiểm tra lại quyền vai trò rồi tạo cơ cấu nhóm thực tế. Không tự suy ra nhóm từ tên phòng hoặc tên nhân sự.
