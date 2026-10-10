# Tham chiếu gợi ý @ trong ô soạn tin

## Trạng thái — 01/10/2026

Đã khảo sát trực tiếp Zalo Web trên Chrome **Duy Anh Web**, trong nhóm **hihi haha**, và lần theo mã client Web/PC đang lưu trong bộ tài nguyên nghiên cứu local. Sau yêu cầu tiếp theo, đã triển khai nhắc thành viên và `@All` trên `/zalo-team`, gửi/nhận thật trong nhóm người dùng chỉ định. Phần dưới lưu bằng chứng khảo sát ban đầu; kết quả triển khai ở mục cuối.

- Gõ `@`: thấy hàng Báo cho cả nhóm, thành viên khác trong nhóm, GIF và Sticker.
- Gõ tiếp tên không dấu: danh sách lọc theo tên.
- Bấm một thành viên: chèn `@Tên hiển thị` màu xanh và một khoảng trắng phía sau; popup đóng.
- Đã xóa bản nháp thử sau kiểm tra. Không gửi tin hay thông báo mention vào nhóm.
- Đối chiếu PC bằng source, không điều khiển giao diện PC. Chưa xác minh thao tác gửi/nhận mention thật hoặc nhóm E2EE trong phiên này.

Nguồn giao diện: <https://chat.zalo.me/>. Bằng chứng riêng tư chỉ nằm trong `.local/send-proof/mention-native-hihi-haha.png`, không chép nội dung hội thoại, ID thành viên hoặc ảnh đại diện vào tài liệu.

## Luồng dữ liệu native

### 1. Mở gợi ý và lọc tên

`pVmt.checkListMentions` gọi:

```text
Gm1y.getFullInfoGroupById(conversationId, SRC_GET_PROFILE.DONT_REQ_SERVER)
  -> { groupId, creatorId, topMember }
  -> debounce 70 ms, bỏ kết quả cũ bằng dấu thời gian
  -> TsEa.getListSuggestMention(text, caret, groupInfo)
```

Nhánh gợi ý này đọc dữ liệu nhóm đã tải và lọc trong client. Không tạo HTTP tìm kiếm thành viên cho từng ký tự. Đây là kết luận từ đường gọi trong source; không phải bản ghi Network/HAR trực tiếp từ Chrome.

Khi cần tải thông tin nhóm, tầng native có `getGroupInfoV2`, gọi `GET /api/group/getgi/v2` trên group domain do Zalo cấu hình, với `grid`, `mpage`, `mcount`, kích thước avatar và định danh client được đóng gói trong `params`. Không gọi endpoint này mỗi lần gõ `@`.

### 2. Quy tắc danh sách

- `@` phải ở đầu nội dung hoặc sau khoảng trắng/xuống dòng; email thông thường không mở gợi ý.
- Tìm theo đoạn giữa `@` gần nhất và con trỏ, không giao với mention đã chọn.
- Lọc tên không dấu qua `simpleStripVietnamese`; ghép các từ truy vấn với tiền tố các từ trong tên.
- Dùng tên liên hệ hiện tại khi có, thay vì chỉ lấy tên trong metadata nhóm.
- Bỏ chính tài khoản gửi và người đã được chọn trong nội dung hiện tại.
- `@All` đứng đầu; các thành viên sắp theo tên. Khả năng nhắc cả nhóm và danh sách thành viên chịu cấu hình/giới hạn native, bao gồm nhóm ẩn thành viên/cộng đồng.
- GIF/Sticker là lệnh tìm kiếm, không phải UID thành viên; trạng thái bật/tắt lấy từ thiết lập native. Khi gõ tên thành viên, các lệnh không khớp sẽ biến mất.
- Mã native duy trì vị trí mention khi thêm/xóa chữ; sửa vào giữa tên làm mất metadata mention đó. Không thể suy lại ID chỉ từ chuỗi `@Tên`.

### 3. Chọn và gửi

`Em8I._selectMember` chèn tên và khoảng trắng. `TsEa.getRealListMention()` bỏ các mục lệnh và xuất:

```json
{
  "text": "@An chào bạn",
  "mentions": [
    { "pos": 0, "len": 3, "uid": "<ID thành viên>", "type": 0 }
  ]
}
```

- `pos`, `len` theo vị trí chuỗi JavaScript (UTF-16); vùng mention chứa dấu `@` và tên, không gồm khoảng trắng nối phía sau.
- `MENTION_TYPE_USER = 0`.
- `MENTION_ALL_ID = "-1"`, `MENTION_TYPE_ALL = 1`.
- Model `4HQc` giữ metadata tại `content.mentions`.
- `dThN` chọn nhánh gửi dựa trên nội dung và chế độ mã hóa. Với mention văn bản thông thường, gọi `fBUP.sendMentionMessage`.

Đường gửi văn bản mention thông thường trong `fBUP`:

```text
POST <group domain>/api/group/mention
params = encodeURIComponent(native AES(JSON.stringify(nativeParams)))

nativeParams gồm:
  grid, message, clientId,
  mentionInfo = JSON.stringify(mentions),
  language, visibility,
  các tham số bổ sung do buildParams/native runtime quản lý
```

Không hardcode hostname, khóa hoặc tự dựng phần mã hóa. Tin trích dẫn/link/ảnh có nhánh riêng mang metadata mention; E2EE gọi bộ gửi mã hóa riêng. Vì vậy nên truyền metadata vào model và outbox native hiện có, để Zalo chọn đúng nhánh, thay vì gọi thẳng `/api/group/mention` cho mọi loại tin.

PC source cũng có `getListSuggestMention`, `sendMentionMessage` và `mentionInfo`; nhánh E2EE còn chuyển UID sang global ID. Đây là đối chiếu kiến trúc nguồn, chưa phải kiểm thử hoạt động trên PC.

## Kích thước và kiểu hiển thị đã đo trên Web

| Thành phần | Thông số |
| --- | --- |
| Danh sách gợi ý | Rộng 300 px; chiều cao theo số mục; danh sách ảo hóa |
| Dòng gợi ý | Cao 48 px; padding ngang 16 px |
| Avatar/icon | 32 × 32 px |
| Tên và nhãn | 14 px, line-height 21 px, weight 400 |
| Khoảng cách sau avatar | 12 px |
| Nền mục đang chọn | `#ebecf0` |
| Bo góc danh sách | 8 px |
| Thanh cuộn | Kiểu native mảnh, 8 px |
| Hộp hướng dẫn | Nội dung rộng 300 px, cao 50 px; tính viền 302 × 52 px; radius 4 px |
| Chữ hướng dẫn | 13 px / 19.5 px |
| Bóng hộp hướng dẫn | `0 0 1px rgba(21,39,71,.3), 0 8px 12px rgba(21,39,71,.15)` |

Popup nằm phía trên ô nhập, bám vị trí vùng soạn/con trỏ. Tên được chọn nằm cùng dòng với nội dung, dùng màu `--text-mention` của Zalo. Nút hướng dẫn thiết lập không nên được chép thành nút chết nếu Team chưa có thiết lập tương ứng.

Các tài nguyên quan sát từ DOM: `icon-mention.8e73ce03c4e5646b42cd4f71c8f77c9e.svg`, `icon-suggest-gif.97a7361801fe41770a68639154d4a34e.svg`, `icon-suggest-sticker.b73cdbada2f92b2840ce4d60e9269250.svg`. Chưa tải/thêm chúng vào asset frontend trong bước khảo sát này.

## Cách nối vào Team

1. Đọc catalog thành viên được phép nhắc từ đúng phiên native, khóa cache theo `accountId + conversationId`; không gọi worker cho mỗi phím gõ.
2. Tạo popup dùng chung trong composer theo kích thước trên. Lọc local, xử lý mũi tên/Enter/Escape; Enter khi popup mở chọn thành viên trước, không gửi nhầm tin.
3. Mở rộng bản nháp/editor bằng `mentions` riêng với rich styles. Giữ đúng offset khi chèn emoji, dán nhiều dòng, sửa chữ, undo/redo và đổi hội thoại.
4. Thêm metadata vào optimistic message, hàng đợi, fingerprint idempotency và model gửi native. Kiểm tra phạm vi, UID, loại mention và hội thoại trước khi gửi; không chuyển mention không hợp lệ thành một lời nhắc tới người khác.
5. Đọc và render metadata từ lịch sử để tên mention đúng màu ở bubble/preview. GIF/Sticker đi vào bộ tìm kiếm biểu cảm hiện có, không được gửi như nhắc thành viên.
6. Kiểm thử popup/nháp ở nhóm tham chiếu mà không gửi. Kiểm thử gửi thật chỉ trong cuộc chat/nhóm đã được người dùng chỉ định cho thao tác gửi; đối chiếu phía nhận trước khi ghi hoàn thành.

Các module nghiên cứu local: `ui-pVmt.js`, `ui-TsEa.js`, `ui-Gm1y.js`, `ui-Em8I.js`, `ui-4HQc.js`, `ui-dThN.js`, `ui-fBUP.js`, `ui-1pet.js` dưới `.local/zalo-web-research/`. Module ID/hash là chi tiết của bundle đã khảo sát, có thể thay đổi khi Zalo cập nhật.

## Kết quả triển khai local

- Nhắc thành viên và `@All` đã nối native thật; popup không chứa nút giả cho GIF/Sticker. Hai lệnh tìm biểu cảm này chưa thuộc phần đã hoàn thành.
- `readMentions` tạo instance `TsEa.e` riêng, dùng nhóm của đúng tài khoản; frontend cache 30 giây theo account/conversation và lọc local. Khi gửi, kiểm tra lại catalog trước khi chuyển metadata vào model; model tự chọn nhánh thường/quote/E2EE.
- Kiểm thử được người dùng cho phép trong nhóm **Trần Hảo, Nguyễn Thị Ánh**: Duy nhắc thành viên; Ánh gửi `@All` có emoji phía trước và chữ đậm. Đã đối chiếu dữ liệu lịch sử/bubble ở phía nhận của cả hai tài khoản. Không coi kiểm thử nhóm thường này là xác nhận E2EE hay thông báo đẩy điện thoại.
- `getPlainText` thay tên theo danh bạ người xem. `displayMentions` rebase vị trí/độ dài mention và các mốc RTF từ nội dung gốc sang tên hiển thị, tránh tô xanh cả chữ phía sau tên. Có kiểm thử hồi quy cho khác biệt độ dài tên và emoji UTF-16.
- Chrome xác nhận kích thước 300/48/32/14px và padding 16px; chọn bằng chuột/Enter, tìm tên không dấu, undo/redo, Escape rồi gõ lại. Bản nháp tách tài khoản/hội thoại; tin gửi xong không còn bản nháp thử.
- 15/15 kiểm tra tập trung đạt; TypeScript đạt. Giới hạn các harness cũ được ghi tại README. Chỉ cập nhật connector local của Zalo Team, không triển khai VPS/luồng Zalo cũ.
