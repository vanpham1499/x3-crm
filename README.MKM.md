# MKM nền tảng tặng — 13/10/2026

## Phạm vi

MKM ở đây là ngân sách quảng cáo nền tảng **tặng miễn phí**, không phải mã mua từ đối tác. Đã triển khai production ngày 15/10/2026. Nguồn tiền nạp và nguồn MKM được lưu riêng, không suy diễn nguồn tiền từ tên thẻ. [Biên bản triển khai](tooling/deployment/production/RELEASE-2026-10-15.md).

## Ví dụ 3 triệu tiền + 3 triệu MKM

| Chỉ tiêu | Giá trị |
| --- | ---: |
| Khách thanh toán ngân sách | 3.000.000 |
| Tiền thật nạp vào quảng cáo | 3.000.000 |
| MKM được nền tảng cấp | 3.000.000 |
| Tổng ngân sách quảng cáo được bổ sung | 6.000.000 |
| Tiền còn có thể nạp sau lần nạp trên | 0 |
| MKM còn hiệu lực, nếu chưa dùng/thu hồi/hết hạn | 3.000.000 |

Ví dụ chỉ minh họa ngân sách, không bao gồm phí quản lý hoặc VAT riêng. Chính sách phí/VAT hiện có được giữ. MKM không tạo khoản phải thu, khoản chi tiền, lợi nhuận phí quản lý hay số dư tiền có thể hoàn. Phí quản lý trên báo phí vẫn dùng cơ sở ngân sách tiền đã nhập, không tự cộng MKM vào cơ sở tính phí.

## Cách dùng

### 1. Báo phí

Trong phần tính báo phí quảng cáo, nhập **ngân sách tiền** như trước và **MKM nền tảng tặng (dự kiến)** nếu có. Bản xem trước/bản gửi khách hiển thị ngân sách tiền, MKM và tổng dự kiến riêng. MKM không cộng vào tổng thanh toán. Phần dự kiến chưa tạo khoản MKM thực cấp.

### 2. Tiền nạp

Vào **Dự án → Tài chính → Thêm lần nạp**. Nguồn **Tiền nạp**: chọn thẻ thật, CID và số tiền. Quy trình xác nhận nạp và kiểm tra hạn mức như hiện tại. Không chọn thẻ MKM cũ cho khoản mới.

### 3. MKM

Trong cùng form, chọn nguồn **Mã khuyến mãi nền tảng tặng**:

1. Nhập CID, mã/tên ưu đãi, giá trị MKM, ngày cấp/dự kiến, hạn sử dụng nếu có. Có thể gắn báo phí thuộc dự án.
2. Lưu tạo trạng thái **Chờ cấp MKM**. Chưa được cộng vào MKM còn hiệu lực.
3. Khi nền tảng thực cấp: bổ sung ngày cấp và ảnh xác nhận. Người có quyền xác nhận nạp/chi đổi trạng thái thành **Đã cấp MKM**. Đây là ghi nhận trong CRM, không phải thao tác nạp lên nền tảng.
4. Khi đối soát, mở sửa khoản MKM và cập nhật **Đã dùng (lũy kế)**, **Bị thu hồi (lũy kế)**. Số này được cập nhật thủ công, chưa tự lấy từ Google/Facebook.

MKM còn hiệu lực = giá trị được cấp − đã dùng − bị thu hồi. Chỉ áp dụng khoản đã cấp và chưa quá hạn theo ngày Việt Nam. Hết hạn thì phần khả dụng bằng 0; giữ nguyên lịch sử đã dùng. Không sinh khoản hoàn tiền/hoàn hạn mức tiền.

### 4. Kiểm soát

- Mỗi MKM gắn cố định với dự án/CID và nguồn đã tạo; không đổi qua tiền thật.
- Chặn cùng mã/tên ưu đãi và CID khi còn khoản chưa hủy. Nhập mã định danh riêng cho từng đợt cấp nếu nền tảng dùng chung tên chương trình.
- Tổng đã dùng + thu hồi không vượt giá trị MKM. Không giảm lũy kế đã ghi hoặc hủy khoản đã dùng; sai lệch lịch sử cần đối soát riêng.
- Ảnh, ngày cấp bắt buộc trước xác nhận; ngày cấp không ở tương lai, ngày hết hạn không trước ngày cấp.
- Lưu người, thời điểm, dữ liệu trước/sau mỗi lần cập nhật. Ảnh đang hoặc từng dùng làm xác nhận được bảo vệ khỏi xóa trong thư viện.
- Excel tách giá trị khoản, dòng tiền thực chi và các chỉ tiêu MKM. Không cộng cột **Giá trị khoản (gồm MKM)** thành tổng chi tiền.

## Dữ liệu thẻ MKM cũ

Giữ nguyên bản ghi và công thức lịch sử, đánh dấu để rà soát; không tự chuyển mọi khoản có tên thẻ MKM sang nguồn khuyến mãi. Cần kiểm tra bằng chứng từng khoản trước một đợt điều chỉnh dữ liệu có đối soát. Vì vậy các khoản lịch sử chưa đối soát vẫn có thể ảnh hưởng số tiền cũ.

## Kiểm tra kỹ thuật

- `tooling/tests/ad-promotion-local.php`: 29 kiểm tra với transaction rollback; cấp, dùng, thu hồi, hạn mức, quyền, trùng mã, bằng chứng hiện tại/lịch sử.
- `tooling/tests/project-finance.php`: 60 kiểm tra gồm tình huống 3 triệu + 3 triệu và loại MKM khỏi chi phí Dashboard/KPI.
- `node --test tooling/tests/project-finance.test.cjs`: 8 kiểm tra frontend về tiền nạp/lợi nhuận/MKM.
- `tooling/tests/partner-finance-local.php`: 43 kiểm tra hồi quy sổ đối tác, tất cả fixture rollback.
- TypeScript kiểm tra không lỗi. Không tạo khoản tài chính thật để thử, không gửi báo phí cho khách.
- Đã xem form trên desktop/390px (không tràn ngang), nhập thử rồi hủy. Trên form báo phí, thêm 3 triệu MKM không thay đổi tổng thanh toán hay phí quản lý. Chưa nghiệm thu upload ảnh và xuất PDF/Excel bằng thao tác trình duyệt; các luồng này dùng component xuất/upload hiện có.

Khi deploy sau này, sao lưu DB và chạy migration bổ sung cột trước khi đưa code mới lên. Không chạy `migrate:fresh`, seed hoặc tự chuyển dữ liệu thẻ MKM cũ.
