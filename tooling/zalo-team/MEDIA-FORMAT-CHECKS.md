# Kiểm tra gửi ảnh/file — 01/10/2026

## Phạm vi

Tệp mẫu từ [Pine & Birch](https://www.pine-and-birch.com/sample-files/documents) (gói documents/images/audio) và [Samplelib MP4](https://samplelib.com/sample-mp4.html). Chỉ gửi vào My Documents của Duy, từng tệp một, có receipt chống gửi lại. Không chạy tệp tải về.

37 định dạng là phạm vi đã kiểm tra gửi/tải, không đại diện mọi định dạng hoặc mọi codec. Video/âm thanh chọn bằng File giữ loại tin `MSG_FILE`; MP4 có thêm trình phát ngay trên thẻ file.

| Định dạng | Gửi | Tin native | Đọc lịch sử | Tải lại | Dữ liệu |
|---|---|---|---|---|---|
| ZIP | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| MP4 | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| GIF | Đạt | MSG_GIF | Đạt | HTTP 200 | GIF89a động |
| WAV | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| FLAC | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| AAC | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| M4A | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| OPUS | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| MP3 | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| OGG | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| WMA | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| AIFF | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| PSD | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| PDF | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| DOC | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| DOCX | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| ODT | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| RTF | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| EPUB | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| ICO | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| PNG | Đạt | MSG_PHOTO | Đạt | HTTP 200 | JPEG do Zalo xử lý |
| AVIF | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| HEIC | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| JPG | Đạt | MSG_PHOTO | Đạt | HTTP 200 | JPEG do Zalo xử lý |
| WEBP | Đạt | MSG_PHOTO | Đạt | HTTP 200 | JPEG do Zalo xử lý |
| TIFF | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| BMP | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| MD | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| ODP | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| PPTX | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| ODS | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| XLS | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| XLSX | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| TXT | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| AI | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| EPS | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |
| SVG | Đạt | MSG_FILE | Đạt | HTTP 200 | Khớp SHA-256 |

## Hiển thị và giới hạn

- Chrome /zalo-team: ảnh tải được; GIF dùng URL gốc 320×180; viewer zoom 125%; BMP gửi dạng file mở được 640×480. Icon thẻ file tải đủ, không có icon vỡ.
- Đối chiếu DOM thẻ file trên Zalo Web và module `4VTe`/CSS trong core PC. Toàn bộ thẻ file dùng chung icon SVG Web 38×48px, gap 10px, padding 12px, bề rộng nội dung 374px. Kho file dùng cùng component ở 32×40px. MD hiện nhãn MD; tên dài giữ đuôi. Không khẳng định pixel-perfect mọi định dạng trên PC.
- MP4 mẫu phát hết 5,758 giây trong Chrome thật. PDF A4 ngang render trang đầu trong chat và canvas lớn ở dialog. MD/TXT có preview 1024 byte và dialog đọc nội dung; MD dùng CodeMirror markdown như cấu hình native `NDmK.tfe.ext_type_map`.
- SVG trả application/octet-stream, không hiển thị qua img trực tiếp; giữ dạng file mở/tải bản gốc. HEIC/TIFF, Office và định dạng trình duyệt không hỗ trợ chưa có viewer nội bộ. Tải thành công không đồng nghĩa đã xem được mọi tài liệu.
- Bộ chọn kiểm tra bằng fixture; gửi thật qua worker, xem lại trong Chrome. Extension chưa cho upload đường dẫn local nên chưa phải end-to-end từ bộ chọn Chrome người dùng cho cả 37 tệp.
- Bằng chứng local: .local/send-proof/format-chat-verified.png và format-image-preview.png. Kết quả chi tiết ở .local/media-format-test/results.json; không đưa signed URL/receipt vào tài liệu.
- Bằng chứng bổ sung: `.local/send-proof/file-video-playing.png`, `file-markdown-card.png`, `file-pdf-card.png`. Đối chiếu PC từ core, không thao tác PC qua computer use. Đối chiếu Web live và kiểm tra Zalo Team là hai phiên tài khoản riêng, không khẳng định cùng từng tin với Web/PC.

## Fixture preview và tài nguyên

`file-preview.browser.mjs` chạy với thư mục mẫu public được mount read-only ở `/fixtures` (hoặc `FIXTURE_DIR`). API và media fixture bị chặn trong test, không đăng nhập/gửi tin thật. Đạt 35 định dạng icon, MD label, nội dung đầy đủ MD/TXT, PDF canvas, video chạy và thu hồi nguồn khi cuộn đi. 8 nhóm kiểm tra luồng upload cũ tiếp tục đạt.

Preview chỉ tải trực tiếp từ URL CDN đã có trên tin nhắn, credentials omit/no-referrer; không thêm media proxy. Video/PDF giới hạn 25 MiB, text đầy đủ 1 MiB; lỗi tải/định dạng không hỗ trợ giữ liên kết bản gốc. Video hủy tải/thu hồi blob khi rời vùng xem; PDF thumbnail hủy worker sau render. PDF canvas dùng DPR tối đa 2 theo [PDF.js rendering](https://mozilla.github.io/pdf.js/examples/).

## Hồi quy

24 kiểm tra worker, 8 nhóm browser fixture và TypeScript đạt. Hủy chọn không gửi; file rỗng bị chặn; chọn xong gửi ngay; giữ draft; đổi chat không đổi đích tệp đã xếp hàng; kiểm tra kết quả chưa rõ không upload/gửi trùng.

Giới hạn: 25 MB/tệp, 10 tệp/lượt, tổng 100 MB. Chưa kiểm tra album, mọi codec hoặc nhóm/E2EE.
