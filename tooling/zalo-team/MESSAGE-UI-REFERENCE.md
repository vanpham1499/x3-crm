# Định dạng chi tiết tin nhắn Zalo Team

Kiểm tra source ngày 01/10/2026. Đây là ghi nhận cấu trúc render để triển khai component Team; không nhúng bundle ứng dụng của Zalo vào frontend.

## Nguồn đã đọc

- Zalo PC 26.9.10 đang cài: `resources/app.asar`, đọc archive bằng `tooling/zalo-bridge/asar.mjs`, không chạy lại hoặc sửa bản cài/profile.
- `pc-dist/compact-app-pc.bee53f6b7719d6a93320.css` và `pc-dist/lazy/default-login-main-startup-shared-worker-znotification.cfb8c4aa40daa0a87751.js`.
- Bundle Web đã tải trong lần nghiên cứu API: `chunk1.js`, `default-render.js`, `web-startup.js` tại `.local/zalo-web-research/`. Tách module qua AST để đọc, không thực thi bundle nghiên cứu.

## Quy tắc tìm được trong source

| Thành phần | Bằng chứng | Áp dụng trong Team |
| --- | --- | --- |
| Bubble | `.message-frame` radius 6px; border trong suốt; shadow `rgba(21,39,71,.25)`; `--blue-message:#e5f1ff` | CSS module dùng cùng token, padding 12px, văn bản 15/22px. |
| Cụm tin | `dm9D.M` so người gửi; `qLCR` tính `isAvatarShown/isFirstInBlock/isLastInBlock`; `XkoV.UI.time_to_break_block_messages=1800000` | So ID người gửi, hướng tin, ngày theo giờ Việt Nam và khoảng cách 30 phút. Không gom bằng tên hiển thị. |
| Khoảng cách | `chat-item-spacing --s1/--s2/--s4` với `--space-xxs:4px` | Tin cùng cụm 4px, cuối cụm 8px, separator 16px. |
| Tên/giờ | `.message-sender-name-wrapper` 13px, padding-bottom 4px; `.card-send-time` margin-top 4px; giờ 12px | Tên đầu cụm, giờ cuối cụm; ảnh/sticker dùng nhãn giờ bên ngoài. |
| File | `.file-message` rộng 376px, content row tối thiểu 49px; thumbnail, tên, dung lượng, thao tác tách riêng | `FileCard`, SVG 48px từ bản cài; nguồn tài nguyên ghi trong `public/zalo-team/ASSETS.md`. |
| Link | `.link-message__preview-link` margin-top 8px; tiêu đề 14/20px, description clamp 2 dòng, domain 13/18px | `MessageAttachmentView` tách thẻ link khỏi file và text. |
| Quote | `U8lA`, `.message-quote-fragment__container` padding 8px, vạch 3px, thumbnail 40px; nền trắng/xanh riêng | Blockquote dùng cùng bố cục, ảnh quote nếu API có. |
| Emoji | `P6UB.parseMessage`, `79BI.renderUnicodeEmoji`, `NDmK.emojiMapPos`, `z0WU.getEmojiSrc`; sprite background-size 5100% | Worker trả text + URL sprite + tọa độ. Giữ `token.text` gốc vì `token.value` có thể đã đổi Unicode sang alias. Không trả HTML native. |

### Đối chiếu emoji 01/10/2026 sau phản hồi người dùng

- CSS Web đang chạy `web-startup.072b39f95cd439c77ef7.css` và CSS đọc trực tiếp từ PC đều quy định `.emoji-sizer` 22×22px, `.larger` 40×40px, `.emoji-outer` inline-block/overflow hidden/letter-spacing 50px/color transparent/text-shadow none.
- Renderer Web `79BI` đặt margin 0, riêng margin-bottom -3px cho emoji trong nội dung tin. Team dùng cùng quy tắc, không dùng font-size 0 và vertical-align -6px gây line box tăng sai.
- Tin hai dòng người dùng chụp: Team trước sửa cao 72px, sau sửa 48px; bubble khoảng 400×74px, phù hợp mẫu PC. Đã kiểm DOM và ảnh Team, source/CSS live Web và source PC; không kiểm qua Computer Use trên PC. Không gửi lại tin trong lượt sửa CSS.

## Thành phần và giới hạn

- `message-presentation.ts`: quy tắc nhóm/ngày/giờ/dung lượng.
- `message-item.tsx`: avatar, tên, bubble, quote, giờ và vị trí theo cụm.
- `message-content.tsx`: text/emoji, ảnh, sticker, video/audio, link và file card.
- `conversation-detail.tsx`: chỉ giữ tải API, đổi hội thoại, phân trang, vị trí cuộn và mở ảnh.
- Lịch sử có thể bị giới hạn bởi phiên Web. Không thêm kho lưu hoặc quyền gửi tin ở bước này.
- Chưa tuyên bố phủ toàn bộ định dạng native: rich text đầy đủ, reaction, poll, danh thiếp và nhóm ảnh tổng hợp từ các message riêng cần dữ liệu/adapter riêng. Không dựng nút hoạt động giả hoặc trạng thái đã xem/gửi giả.
- Nghiên cứu cách triển khai bằng source. Theo yêu cầu đối chiếu sau triển khai ngày 01/10, đã đọc DOM/style của 10 frame Web trong Chrome Duy Anh Web và 10 tin Team, đồng thời xem ảnh hiển thị: text thực tế 15/22px (wrapper native 14/21px), giờ 12/18px, padding 12px, radius 6px. Không dùng wrapper font-size làm cỡ chữ nội dung.
- Mẫu ảnh có caption hiển thị ảnh trước, chú thích dưới, tên nhóm phía ngoài card. Team đã sửa theo thứ tự này. Hai phiên tham chiếu khác tài khoản, nên không khẳng định trùng dữ liệu từng tin.
- Cuộn lịch sử Team đã kiểm trên Chromium fixture và Chrome dữ liệu thật (50 → 100, không trùng). Helper neo vào tin đang đọc và theo dõi resize do media, không tự kéo người dùng về cuối.
- Zalo PC chỉ được đối chiếu source; công cụ đọc cửa sổ PC đã bị từ chối ở lần trước. Chưa xác nhận trực quan 5–10 tin trên PC, chưa có người dùng nghiệm thu.
