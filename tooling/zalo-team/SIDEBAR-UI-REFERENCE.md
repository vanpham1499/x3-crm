# Sidebar thông tin hội thoại — 01/10/2026

## Nguồn đối chiếu

- Bundle Web `1.e0ef5e98f8f9d8970e2c.js`, đã lưu khi nghiên cứu tab Duy Anh Web. Phân tích AST, không chạy bundle nghiên cứu. Module `VLvn`, `ENRE`, `wlMe`.
- Zalo PC 26.9.10: đọc CSS `pc-dist/compact-app-pc.bee53f6b7719d6a93320.css` trong bản cài; không chỉnh bản cài/profile.
- Tệp nghiên cứu `.local/zalo-web-research/sidebar-*.js` được gitignore, không đưa bundle ứng dụng vào frontend.
- Lượt ban đầu công cụ từ chối Computer Use theo chỉ dẫn cũ. Sau đó ngày 01/10 người dùng cho phép Computer Use trên Chrome, gồm Zalo Web và Team; chỉ PC giữ cách đọc source/core. Đã đối chiếu DOM/CSS Web tại Duy Anh Web và giao diện Team thật trong lượt sửa tiếp theo.

## Những chỗ sai đã sửa

| Thành phần | Bằng chứng gốc | Triển khai |
| --- | --- | --- |
| Xem tất cả | Web `.chat-info__header`, `btn_MutualGrp_Back`: glyph `ea94`, 20px, nút 32px bên trái 8px; header 68px | Trang con ngay trong sidebar, có nút quay lại ở mọi tab và thành viên. Chỉ header chat giữ toggle; bỏ toggle dư trong sidebar. |
| Lưới media | `.media-store-preview-item`: radius 4px, border 1px, ô full khoảng 98px; skeleton Web 8 ô 72px overview, 3 cột full | Overview 4 cột, full 3 cột theo chiều rộng panel; nhóm ngày, hover, lỗi thumbnail có trạng thái. |
| Phân trang | `VLvn._onScroll` gọi loadMore khi tới cuối | Cuộn gần cuối tải tiếp, khóa request, hủy khi rời trang; nút Xem thêm dự phòng khi nội dung không đủ cuộn; lỗi cần Thử lại. |
| File/link | File `.cb-info-file-item` cao 64px/padding 0 16px, SVG Web 40px, title 14px/500, phụ và ngày 13px. Link padding 11px 16px, domain/ngày 12px. Action 16px | Renderer hàng riêng, SVG Web bằng thẻ img/contain; metadata cùng hàng, hover không làm dịch hình học. Tên file giữ đuôi. Không tái dùng card PC. |
| Profile và tác vụ | `.header-info` 224px, avatar 56px, tên 18px/26px, icon action 20px/vòng 32px; Xem tất cả 32px, text 16px | Căn lại spacing/opacity và thêm edit disabled; nguồn tài khoản trong tooltip, không thêm dòng làm lệch chiều cao. |
| Search/filter | Web input 26px, filter chips 24px/radius 16px, glyph down `ed45` 14px | Label block giữ field/input cùng hàng, select dùng chung `LibrarySelect`; loại file 22%, vùng cuộn giữ cùng chiều rộng overview. |
| Bộ lọc | `ENRE`: tên file/link, người gửi, ngày gửi, loại tệp | Ô tìm kiếm không dấu và select hoạt động trên dữ liệu đã tải; hiển thị rõ phạm vi khi còn cursor. Chưa gọi tìm kiếm kho native trên toàn lịch sử. |
| Thành viên | `VLvn`, nhánh MEMBERS có `usage: RIGHT_BAR` | Trang con sidebar, tìm kiếm, vai trò, phân trang; không dùng dialog riêng. |
| Trình xem media | CSS PC `media-viewer-layout`: nền tối, strip phải 120px, thumbnail 88px, footer 56px | `MediaViewer` dùng chung tin nhắn/sidebar: chuyển ảnh, phím trái/phải, Escape, zoom, kéo ảnh đã zoom, double click, xoay, vừa màn hình, toàn màn hình, mở bản gốc; video có controls. |

## Dữ liệu và giới hạn

- `fromUid = 0` phải ánh xạ về ID tài khoản nguồn; ID lớn giữ chuỗi. Profile người gửi được hydrate nếu thiếu, chỉ trả ID/tên hiển thị.
- Không gửi tin, đánh dấu đã đọc, ghim, tắt thông báo hoặc chỉnh nhóm khi kiểm tra. Nút thao tác ghi vẫn disabled, không báo thành công giả.
- Chưa nối nhắc hẹn, nhóm chung, toàn bộ menu quản lý nhóm hoặc thao tác ghi của native. Không khẳng định toàn bộ sidebar đã tương đương Zalo.
- File/ảnh phụ thuộc URL và lịch sử phiên Web; lỗi ảnh gốc có fallback preview kèm nhãn. Mở bản gốc là mở URL, không báo đã lưu file vào máy.

## Kiểm chứng

- Lượt rà toàn sidebar theo phản hồi tiếp theo: 9 luồng và 8 nhóm hồi quy qua, thêm back mọi tab, chỉ một toggle, hình học file không đổi khi hover, icon đúng 40px/hàng 64px, input không vỡ dòng và bề rộng ở hai viewport. Local Chrome kiểm chứng File thật và back; proof `.local/sidebar-proof/sidebar-reviewed-files.png`. Không coi kiểm thử fixture là nghiệm thu của người dùng.

- Lượt chỉnh tiếp theo: glyph card file PC `eb29`; link Web `.chat-info-link__title` 14px/500, subtitle 12px `rgb(0,90,224)`, thumbnail 40px, action `.fa-icon-outline-share` (`ebe7`) 16px. Chỉ giữ nút mở theo yêu cầu, không sao chép toàn bộ thao tác ghi của native.
- Browser fixture bổ sung kiểm tra loại sticker, màu nút tải, header không nút thừa, scrollbar ẩn, một action link; tất cả qua. TypeScript qua. Local Chrome xác nhận header và link trên dữ liệu thật, viewer mẫu 9 thumbnail không chứa nguồn sticker. Proof `.local/sidebar-proof/sidebar-live-links.png`.

- `tooling/zalo-team/sidebar.browser.mjs`: Chromium tách biệt, API fixture, không dùng cookie/tab cá nhân. 9 luồng: inline library, tab, cuộn phân trang, zoom/xoay/phím/reset, Escape, tìm không dấu, thành viên, lỗi/thử lại, đổi tài khoản hủy kết quả cũ. Không pageerror.
- Ảnh fixture `.local/sidebar-proof/sidebar-{overview,library,viewer}.png` đã xem bố cục. Không dùng ảnh fixture để khẳng định dữ liệu tài khoản thật.
- TypeScript và 24 tests adapter/renderer qua; bổ sung kiểm tra ID người gửi lớn và self ID.
- Connector được build ở lượt trước, giữ volume; API kho thật trả ảnh/file/link ở mẫu kiểm tra. Lượt sửa icon/media/header/link chỉ cập nhật frontend; đã kiểm tra Chrome, chưa có người dùng nghiệm thu.
