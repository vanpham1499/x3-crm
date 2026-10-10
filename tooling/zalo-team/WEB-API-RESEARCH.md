# Khảo sát Zalo Web — 30/09/2026

> Cập nhật 01/10/2026: phần bên dưới ghi nhận khảo sát ban đầu. Hiện login/giữ phiên hai tài khoản và API danh sách hội thoại đã được kiểm chứng local; xem `README.ZALO-TEAM.md`. Danh sách dùng `QPNp.a.ConvInfoDataManager.getAllConvSync`, `yzMR.PreviewDataManager`, formatter `sh7v.a/b`, profile `UiPd`/`Gm1y`, không mở từng chat. Chưa triển khai lịch sử hoặc kho lưu riêng.

## Phạm vi và mức bằng chứng

Đọc danh sách script từ tab `https://chat.zalo.me/` đang mở trên Chrome Duy, sau đó tải bundle JavaScript công khai từ CDN để phân tích tĩnh. Không xuất cookie/token/khóa của tài khoản, không gửi tin, không mở chat khác hay đổi trạng thái đọc. Không thay runtime PC, Docker hoặc VPS.

**Đã tìm thấy định nghĩa API và các hàm gọi trong source đang được trang tải. Chưa ghi Network/WebSocket live, chưa tái hiện đăng nhập Web độc lập hoặc gọi API bằng một connector mới.** Bundle chứa nhánh dùng chung PC/Web, debug và tính năng có cờ cấu hình; có trong source không chứng minh nhánh đang được phiên này sử dụng.

## Nguồn tái kiểm tra

Nguồn gốc lấy từ `script[src]` của trang:

- `https://zalo-chat-static.zadn.vn/v1/lazy/1.e0ef5e98f8f9d8970e2c.js`
- `https://zalo-chat-static.zadn.vn/v1/lazy/web-startup.17b0ef90dff987d682d1.js`
- `https://zalo-chat-static.zadn.vn/v1/lazy/default-embed-render.0cedff15d77b86e778c6.js`
- `https://zalo-chat-static.zadn.vn/v1/lazy/lang-vi.1ed4e8f0e9447cae2257.js`

Bản tải nằm tại `.local/zalo-web-research/`, đã gitignore. Không đưa bundle vendor vào Git. SHA256:

| Tên local | SHA256 |
| --- | --- |
| chunk1.js | D046D3923F355E812F479F81903F0364F1D6D3E0C27D655D478BECCD8D4185C6 |
| web-startup.js | 770671DF6A64E7F9E9B0675FFC9E6748DD27CCE3B713A00653D4212531B40937 |
| default-render.js | 8B62AB513315A2737106088FECF1A24B171D343E4D84F251DBFF30417B66D5F7 |

Vị trí dưới đây là offset ký tự zero-based theo JavaScript string trong đúng bản tải, không phải số dòng hay byte offset. Script phân tích local `inspect.cjs` chỉ tìm chuỗi và trích ngữ cảnh, không thực thi mã vendor.

## Bản đồ ban đầu

| Luồng | Bằng chứng source | Vị trí |
| --- | --- | --- |
| QR | `getQRCode` dùng `/api/login/reqqr`, `encryptParam`, `decryptResp`; có client/device metadata | chunk1:10934251 |
| Khôi phục thông tin đăng nhập | `getLoginInfo` dùng `/api/login/getLoginInfo`; caller nhận config và khóa phiên | chunk1:10938318, 8817360 |
| Web login entry | Config chứa `apiLogin` trên chat domain, `apiLoginOnAuth` trên id domain; chưa trace redirect/QR của Web từ đầu | default-render:294443 |
| Danh sách/preview | `getLastMessagesForPreview`, `/api/preloadconvers/get-last-msgs`; nhận map thread/local message ID, không phải API lấy toàn bộ danh sách chat | chunk1:11044721 |
| Hội thoại local | Có `getConversations()` và truy vấn message storage theo hội thoại; phải kết hợp khởi tạo, profile/nhóm, event và local storage | chunk1:3680863; web-startup:841312 |
| Lịch sử cloud | `/api/cm/getoldv2`, `/api/cm/getrecentv2`, `/api/cm/rgetv2`; cursor/global message ID và count, điều kiện phân loại hội thoại | chunk1:11029123, 11029246 |
| Lịch sử nhóm | `getHistoryMessage` dùng `/api/group/history`, tham số grid/count | chunk1:11023442 |
| Nhận realtime | `new WebSocket`, binary arraybuffer; authenticate, ping, `_onRawData`; code có polling, action cursor và xử lý fallback | chunk1:1156705, 1151358, 2893044 |
| Giải mã/chuẩn hóa | `preProcessChatMsgs`: decodeAES, giữ ID dạng chuỗi để tránh mất chính xác số lớn; `preProcessChatMsgsFromServer` phân biệt msgs/groupMsgs/pageMsgs | chunk1:2895807, 5941799 |
| Gửi văn bản | Nhánh cá nhân `/api/message/sms`, nhóm `/api/group/sendmsg`; mã hóa params và `_postSendMsg` | chunk1:10977421 |
| Kho media | `getMediaFromConversation` dùng `/api/mediastore/list`; My Documents dùng `/api/media/oneone/list`; có limit/last_id/lastFetchId | chunk1:10946943 |
| Link media | `renewLink` dùng `/api/message/renewlink`; có metadata ảnh và cờ E2EE. Không bảo đảm mọi file hết hạn có thể lấy lại | chunk1:10982468 |
| E2EE | Có libsignal, identity/session store theo user/device, lưu session vào DB; không thể chỉ giữ cookie | chunk1:4324865, 4328974, 4333587 |
| Lưu dữ liệu Web | IndexedDB migration/partition, schema version và lifecycle connection | web-startup:87725, 90798, 108447 |

Các endpoint trên là đường dẫn nội bộ quan sát trong source, không phải API công khai được Zalo cam kết. Domain được lấy qua domain manager/config, có thể thay đổi; không hard-code các host hoặc apiVersion tìm thấy thành hợp đồng lâu dài.

## Phát hiện về lịch sử 14 ngày

- Có cơ chế `roll_msg`, state machine chọn tin và gọi `rollMessages` khi `enable_roll_db` bật: chunk1:14544038.
- Được khởi chạy theo cấu hình remote: chunk1:14546228. Hàm kiểm tra thời gian có ngoại lệ cho My Documents: chunk1:14547335.
- Giá trị fallback `expired_time:12096e5` tương đương 14 ngày; **fallback enable/enable_roll_db là false**, không phải bằng chứng giá trị đang áp dụng trong tài khoản: default-render:304792 và chunk1:14549060.
- Có đúng chuỗi thông báo hướng người dùng sang Zalo PC tìm tin trước mốc ngày: lang-vi:310740.
- Có các quy tắc tuổi file và hết phiên riêng. Không được gom mọi chuỗi “14 ngày” thành một chính sách duy nhất.

**Kết luận:** có bằng chứng về vòng đời/giới hạn dữ liệu trên client Web. Không có bằng chứng rằng sửa một cờ local sẽ lấy được lịch sử server không cung cấp, hoặc vô hiệu hóa mọi giới hạn lưu trữ. Kho lưu riêng phải thu thập nội dung còn truy cập được và ghi bền vững trước khi nguồn không còn cung cấp.

## Kiến trúc đề xuất để kiểm chứng

1. Giữ UI React Zalo Team; connector Web là backend riêng, browser người dùng không giữ vai trò nhận tin nền.
2. Thử một browser worker có profile bền vững cho một tài khoản trước. Dùng môi trường Web của vendor để xử lý login/crypto; không truyền màn hình, không VNC/Wine/PC trong phương án Web.
3. Adapter nhận dữ liệu sau xử lý hợp lệ của client, chuyển thành sự kiện nội bộ. Lưu account + conversation + message ID dưới dạng string; không trộn khóa/phiên giữa tài khoản.
4. Ghi sự kiện/message và checkpoint có cơ chế chống trùng, bắt lỗi và replay. Đối chiếu reconnect, lịch sử bù, sửa/thu hồi, reaction, nhóm/My Documents/E2EE trước khi gọi là đủ dữ liệu.
5. Hàng đợi tải media thật, hash/size kiểm tra hoàn tất, retry có giới hạn, kho riêng và backup. Thumbnail/URL hết hạn không được tính là file đã lưu.
6. Sau khi một tài khoản chạy ổn định, thử hai profile để kiểm chứng cách ly, RAM và xung đột phiên. Chỉ nghiên cứu bỏ renderer khi có bằng chứng adapter độc lập giữ đủ crypto/storage/reconnect.

## Chưa xác minh

- Network trace thực tế, handshake/QR Web đầy đủ, nơi áp dụng từng cấu hình remote.
- Hoạt động nhận tin khi tắt browser người dùng; restart worker còn phiên; mất mạng rồi bù đủ.
- Nhận/gửi/đọc file và lịch sử bằng connector mới; tính đầy đủ của E2EE.
- Mức RAM, tốc độ, số tài khoản vận hành ổn định, chính sách phiên của Zalo Web.
- Lưu trữ riêng chưa triển khai; không hứa khôi phục dữ liệu cũ chưa từng lưu hoặc nguồn đã xóa/hết hạn.

Không cần mở DevTools hoặc đổi cấu hình bảo mật trình duyệt để làm phần phân tích tĩnh này. Cần môi trường kiểm chứng riêng cho bước Network/adapter tiếp theo; chưa can thiệp tab cá nhân hiện tại.
