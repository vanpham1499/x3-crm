# Tài nguyên giao diện Zalo Team

Đối chiếu trực tiếp Zalo Web (`https://chat.zalo.me/`) ngày 30/09/2026. Font và icon dưới đây được
tải từ CDN công khai mà trang gốc sử dụng, theo yêu cầu dùng đúng font/icon của người dùng. Lưu tại
frontend để bản dựng local không cần truy cập Zalo hoặc tải font từ bên thứ ba khi mở trang.

| File local                 | Nguồn                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `fonts/segoe-regular.ttf`  | https://zalo-chat-static.zadn.vn/v1/fonts/Zalo-Segoe-UI.dc1a7d868a0b3a0e2daa8b36567e9ea9.ttf          |
| `fonts/segoe-semibold.ttf` | https://zalo-chat-static.zadn.vn/v1/fonts/Zalo-Segoe-UI-Semibold.8de26695631b05cf79e17378f6d1f134.ttf |
| `fonts/segoe-bold.ttf`     | https://zalo-chat-static.zadn.vn/v1/fonts/Zalo-Segoe-UI-Bold.18b859523696ff3330adac79b99ef554.ttf     |
| `fonts/zalo-icons.woff2`   | https://zalo-chat-static.zadn.vn/v1/fonts/zalo-font.18091f5edc8074ac3016055e77c7d332.woff2            |
| `my-documents.png`         | https://res-zalo.zadn.vn/zds/v1.0.158/zds_cic_my_documents_container_56.png                           |
| `like.svg`                 | https://chat.zalo.me/assets/Like_24_emoji.d52d709508a3702a70e803c13481d0cf.svg                        |

Đây là tài nguyên của bên thứ ba; tài liệu này ghi nguồn, không cấp thêm quyền sử dụng. CSS layout
và dữ liệu minh họa được viết riêng. Không sao chép bundle JavaScript, CSS toàn trang, ảnh đại diện,
nội dung chat, tài khoản hoặc phiên đăng nhập thật. Avatar mẫu được tạo bằng chữ và CSS; không lấy
ảnh cá nhân từ trang tham chiếu.

Tên font được đặt riêng (`ZaloTeamSegoe`, `ZaloTeamIcons`) để không ảnh hưởng CRM. Ánh xạ glyph nằm
trong `src/features/zalo-team/components/icon.tsx`.

## Icon menu và ghim — 01/10/2026

- `fonts/zalo-actions.woff2`: https://zalo-chat-static.zadn.vn/v1/fonts/zalo-font.6f51c9c1a02055230a025c1ad0d1115e.woff2
- Ánh xạ lấy từ `web-startup.c0604e6556321d8996e4.css` và đối chiếu DOM Chrome Duy Anh Web. Dùng font riêng `ZaloTeamActionIcons` cho các glyph nét trong menu và khối ghim, vì bản mới có dịch mã glyph ở một số vị trí. Không dùng mã của phiên bản font này với font cũ.

## Icon tệp từ Zalo PC (01/10/2026)

- `fullscreen.svg`: `pc-dist/assets/fullscreen.e8dbc475ec21efff18bf39b4dd212f2c.svg` trong cùng archive, dùng cho trình xem ảnh. Không dùng glyph fullscreen của PC với font Web vì khác ánh xạ.

Đọc từ bản cài `resources/app.asar`, không thay đổi bản cài hoặc profile. Dùng SVG ảnh tĩnh qua thẻ img, không đưa mã ứng dụng native vào frontend.

| File local | Nguồn |
| --- | --- |
| `files/File_Ai_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Ai_48_Colored.be32c7bcefea724f8cb19358e2d5364f.svg` |
| `files/File_Attachment_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Attachment_48_Colored.b85d5d33512fcd029524073b1b865e1e.svg` |
| `files/File_Code_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Code_48_Colored.8cc62c9711cead120dd865f6ea6d1b3a.svg` |
| `files/File_Dmg_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Dmg_48_Colored.2c1e4caee725ecd5456d63f10ccfe400.svg` |
| `files/File_Empty_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Empty_48_Colored.d6d6452e7b7b562f2e569eb886700a9a.svg` |
| `files/File_Excel_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Excel_48_Colored.22aa9b9c653f3b0f3e1f2ded989b7ee1.svg` |
| `files/File_Folder_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Folder_48_Colored.92dff92be364c28035d451e738448453.svg` |
| `files/File_Image_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Image_48_Colored.82e210c5d42ae9e22cca444d8df720b5.svg` |
| `files/File_Mov_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Mov_48_Colored.727031062b1794125079f0a0bcf717f9.svg` |
| `files/File_Music_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Music_48_Colored.1a0b88d60f3dec97460e6142d75e2fca.svg` |
| `files/File_Pdf_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Pdf_48_Colored.097ad1b44ae953837dd3687c81c709ec.svg` |
| `files/File_Powerpoint_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Powerpoint_48_Colored.ebc9c22c3f69d7d23fc838b40a9f0fb6.svg` |
| `files/File_Pts_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Pts_48_Colored.082c9fbfd69d84097ef621a3c17cee2e.svg` |
| `files/File_Sketch_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Sketch_48_Colored.0072dd6ed79c652e94fb67ad422c98f7.svg` |
| `files/File_System_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_System_48_Colored.4f20d57575a8e928a70d964d3f235292.svg` |
| `files/File_Txt_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Txt_48_Colored.18d51dfb561cf70690bbbad5c1e0aa27.svg` |
| `files/File_Word_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Word_48_Colored.8e526d2803ab653507f662c0e59fc719.svg` |
| `files/File_Xml_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Xml_48_Colored.a83b46159c4b35a7cbe4efca3fbd6ff1.svg` |
| `files/File_Zip_48_Colored.svg` | Zalo PC 26.9.10 `pc-dist/assets/File_Zip_48_Colored.b6edbdc6a8ee34d499c0bd4f12b00bee.svg` |

## Icon file sidebar Zalo Web — 01/10/2026

SVG gốc công khai. Component `FileIcon` dùng chung trong chat (38×48px) và kho file (32×40px), tránh khoảng trắng trong bộ artwork PC 48px. Nhãn MD và các đuôi chưa có artwork riêng là chữ do Zalo Team thêm theo yêu cầu người dùng; không phải ảnh raster.

| File local | URL nguồn |
| --- | --- |
| `files/web/icon-excel.svg` | https://chat.zalo.me/assets/icon-excel.8a677940b84360d0a750fc4470354191.svg |
| `files/web/icon-file-empty.svg` | https://chat.zalo.me/assets/icon-file-empty.a2123f249f4f7cf8f8e537d23d1b2d85.svg |
| `files/web/icon-music.svg` | https://chat.zalo.me/assets/icon-music.b27a86d9fda5560ab41a69d581760bfa.svg |
| `files/web/icon-pdf.svg` | https://chat.zalo.me/assets/icon-pdf.51cd88ff166552930d03701ff5cbd1d8.svg |
| `files/web/icon-photo.svg` | https://chat.zalo.me/assets/icon-photo.1ef82b2ce3e302f5e186a8c54f74252f.svg |
| `files/web/icon-powerpoint.svg` | https://chat.zalo.me/assets/icon-powerpoint.21888ec09f70c82e004aef9516b87695.svg |
| `files/web/icon-txt.svg` | https://chat.zalo.me/assets/icon-txt.f07bb88ef2f30345c6d3df2be2cfd3fb.svg |
| `files/web/icon-video.svg` | https://chat.zalo.me/assets/icon-video.7636eeed2fddb86a487d53b6bea0461e.svg |
| `files/web/icon-word.svg` | https://chat.zalo.me/assets/icon-word.398880844ced42f82eba2ace17f5d511.svg |
| `files/web/icon-zip.svg` | https://chat.zalo.me/assets/icon-zip.46d7aecf2744daf632b51e9a85cbcb8b.svg |
# Mention — 01/10/2026

- `mention.svg`: icon @ 32px công khai từ `https://chat.zalo.me/assets/icon-mention.8e73ce03c4e5646b42cd4f71c8f77c9e.svg`, được quan sát trực tiếp trong popup Zalo Web. Giữ SVG gốc, không raster hóa.
- Bóng đèn hướng dẫn dùng glyph `lightbulb` U+EC41 của font `zalo-actions.woff2` đã có, đối chiếu CSS Zalo Web hiện tại.


## Icon lịch sử cuộc gọi — 02/10/2026

Icon `timer` trong `components/icon.tsx` dùng SVG inline gốc của `.chat-box-info-ttl__icon` trên `https://chat.zalo.me/`, quan sát DOM ngày 02/10/2026. Giữ path/viewBox 24×24 và render 20px trong sidebar.

SVG tĩnh từ Zalo PC 26.9.10 resources/app.asar, đối chiếu module r6Qt; không đọc profile hoặc chạy UI PC.

| File local | Nguồn |
| --- | --- |
| `calls/call-incoming-audio.svg` | `pc-dist/assets/call-incoming-audio.1cdd79e30ab9b31921dbca8e991d26af.svg` |
| `calls/call-incoming-missed-audio.svg` | `pc-dist/assets/call-incoming-missed-audio.4e5fe29200332379221767e659e744d0.svg` |
| `calls/call-incoming-missed-video.svg` | `pc-dist/assets/call-incoming-missed-video.c9543afe73b7e17b93aaa68ea01326e7.svg` |
| `calls/call-incoming-video.svg` | `pc-dist/assets/call-incoming-video.1f7bae99fe783455d1cd302a774ffdad.svg` |
| `calls/call-outgoing-audio.svg` | `pc-dist/assets/call-outgoing-audio.bc09dca01b2a0e711d26c969b60097c7.svg` |
| `calls/call-outgoing-missed-audio.svg` | `pc-dist/assets/call-outgoing-missed-audio.2b7506851fc07ba0ad02f872275cb728.svg` |
| `calls/call-outgoing-missed-video.svg` | `pc-dist/assets/call-outgoing-missed-video.5c827d0689051383e3b755eb952fa1a8.svg` |
| `calls/call-outgoing-video.svg` | `pc-dist/assets/call-outgoing-video.edb07ce68cfa4d62e3727f1c2ae49421.svg` |
| `calls/call-rejected-audio.svg` | `pc-dist/assets/call-rejected-audio.e98cf03cba0d6b00a081ee644717bd70.svg` |
| `calls/call-rejected-video.svg` | `pc-dist/assets/call-rejected-video.b6e24313bb2a2162ca67b3ed2cc24a2d.svg` |
