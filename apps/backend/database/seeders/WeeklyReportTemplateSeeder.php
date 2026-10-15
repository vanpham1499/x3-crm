<?php

namespace Database\Seeders;

use App\Models\WeeklyReportTemplate;
use Illuminate\Database\Seeder;

class WeeklyReportTemplateSeeder extends Seeder
{
    public function run(): void
    {
        // Neutral draft language: does not claim measurements or completed work.
        $groups = [
            'Duy trì & theo dõi' => [
                ['Theo dõi trước khi điều chỉnh', 'Chiến dịch chưa có đủ dữ liệu để kết luận.', 'Trong tuần tới, đội ngũ sẽ tiếp tục theo dõi dữ liệu và đối chiếu các chỉ số trước khi đề xuất điều chỉnh chiến dịch.'],
                ['Duy trì phương án hiện tại', 'Các chỉ số thực tế phù hợp mục tiêu đã thống nhất.', 'Đề xuất tiếp tục duy trì phương án hiện tại, đồng thời theo dõi chi tiêu và chất lượng khách hàng để điều chỉnh khi cần.'],
                ['Đánh giá theo từng sản phẩm', 'Dự án quảng bá nhiều nhóm sản phẩm hoặc dịch vụ.', 'Đội ngũ sẽ đánh giá riêng từng nhóm sản phẩm, đối chiếu chi phí và chất lượng khách hàng để đề xuất hướng triển khai phù hợp.'],
                ['Theo dõi sau thay đổi', 'Vừa có thay đổi trong chiến dịch.', 'Trong tuần tới, đội ngũ sẽ theo dõi tác động của các điều chỉnh gần đây trước khi quyết định mở rộng hoặc thay đổi thêm.'],
            ],
            'Ngân sách & chi tiêu' => [
                ['Rà soát phân bổ ngân sách', 'Cần đánh giá lại mức chi giữa các nhóm.', 'Đội ngũ sẽ rà soát mức chi của từng nhóm quảng cáo và đề xuất phân bổ ngân sách theo hiệu quả thực tế và sản phẩm ưu tiên.'],
                ['Kiểm tra mức chi chưa đạt kế hoạch', 'Chi tiêu thấp hơn kế hoạch đã thống nhất.', 'Trong tuần tới, đội ngũ sẽ kiểm tra các yếu tố ảnh hưởng đến khả năng phân phối và đề xuất điều chỉnh để bám sát kế hoạch chi tiêu.'],
                ['Kiểm soát nhịp chi tiêu', 'Cần theo dõi mức chi để không vượt kế hoạch.', 'Đội ngũ sẽ theo dõi nhịp chi tiêu và điều chỉnh giới hạn ngân sách theo kế hoạch đã thống nhất với anh/chị.'],
                ['Trao đổi kế hoạch ngân sách tiếp theo', 'Cần khách hàng xác nhận ngân sách kỳ tới.', 'Nhờ anh/chị xác nhận ngân sách dự kiến cho giai đoạn tiếp theo để đội ngũ chủ động lập kế hoạch và duy trì triển khai liên tục.'],
            ],
            'Hiệu quả quảng cáo' => [
                ['Rà soát chi phí chuyển đổi', 'Chi phí chuyển đổi cần được đánh giá lại.', 'Đội ngũ sẽ rà soát chi phí theo từng nguồn chuyển đổi, đối chiếu chất lượng khách hàng và đề xuất các điều chỉnh ưu tiên.'],
                ['Đánh giá chất lượng khách hàng', 'Cần phản hồi từ bộ phận tư vấn hoặc bán hàng.', 'Nhờ anh/chị tổng hợp phản hồi về chất lượng khách hàng nhận được để đội ngũ đối chiếu với dữ liệu quảng cáo và điều chỉnh hướng tiếp cận.'],
                ['Kiểm tra hành trình chuyển đổi', 'Có truy cập nhưng số liên hệ chưa đáp ứng kỳ vọng.', 'Đội ngũ sẽ rà soát hành trình từ quảng cáo đến trang đích và các bước liên hệ để xác định điểm cần cải thiện.'],
                ['Thử nghiệm phương án mới', 'Cần so sánh các cách tiếp cận khác nhau.', 'Đề xuất thử nghiệm một số phương án nội dung và tiếp cận với phạm vi ngân sách phù hợp, sau đó đánh giá trước khi mở rộng.'],
            ],
            'Nội dung & đối tượng' => [
                ['Rà soát từ khóa tìm kiếm', 'Dự án có quảng cáo tìm kiếm.', 'Đội ngũ sẽ rà soát các cụm từ tìm kiếm, bổ sung từ khóa phủ định phù hợp và điều chỉnh trọng tâm theo nhu cầu khách hàng mục tiêu.'],
                ['Làm mới nội dung quảng cáo', 'Cần bổ sung hoặc thử nghiệm nội dung mới.', 'Đề xuất bổ sung nội dung quảng cáo với các góc tiếp cận khác nhau, làm rõ lợi ích sản phẩm và lời kêu gọi liên hệ.'],
                ['Rà soát đối tượng tiếp cận', 'Cần đánh giá lại tệp khách hàng mục tiêu.', 'Đội ngũ sẽ rà soát phạm vi tiếp cận, đối chiếu phản hồi chất lượng khách hàng và đề xuất điều chỉnh đối tượng phù hợp hơn.'],
                ['Ưu tiên sản phẩm trọng tâm', 'Khách hàng có sản phẩm hoặc dịch vụ ưu tiên.', 'Nhờ anh/chị xác nhận các sản phẩm trọng tâm trong tuần tới để đội ngũ điều chỉnh nội dung và phân bổ nguồn lực phù hợp.'],
                ['Rà soát khu vực và thời gian', 'Chiến dịch có thể điều chỉnh vị trí hoặc lịch phân phối.', 'Đội ngũ sẽ đánh giá dữ liệu theo khu vực và khung giờ để đề xuất phạm vi phân phối phù hợp với khả năng phục vụ khách hàng.'],
            ],
            'Website & đo lường' => [
                ['Kiểm tra trang đích', 'Cần rà soát trải nghiệm website.', 'Đội ngũ sẽ rà soát nội dung và trải nghiệm trang đích, ưu tiên các điểm ảnh hưởng đến việc tìm hiểu sản phẩm và liên hệ.'],
                ['Rà soát biểu mẫu liên hệ', 'Dự án nhận khách qua biểu mẫu trên website.', 'Đề xuất kiểm tra biểu mẫu liên hệ và luồng tiếp nhận thông tin để hạn chế gián đoạn khi khách hàng gửi yêu cầu.'],
                ['Kiểm tra đo lường chuyển đổi', 'Cần đối chiếu độ chính xác của dữ liệu đo lường.', 'Đội ngũ sẽ kiểm tra cấu hình ghi nhận chuyển đổi và đối chiếu với dữ liệu tiếp nhận thực tế trước khi đưa ra đánh giá hiệu quả.'],
                ['Cải thiện trải nghiệm trên điện thoại', 'Phần lớn khách hàng tiếp cận qua thiết bị di động.', 'Đề xuất rà soát tốc độ tải, khả năng đọc nội dung và các nút liên hệ trên điện thoại để cải thiện trải nghiệm khách hàng.'],
            ],
            'Phối hợp khách hàng' => [
                ['Bổ sung hình ảnh và tư liệu', 'Cần tư liệu để triển khai nội dung.', 'Nhờ anh/chị bổ sung hình ảnh, video hoặc thông tin sản phẩm mới để đội ngũ chuẩn bị nội dung phù hợp cho giai đoạn tiếp theo.'],
                ['Cập nhật chương trình bán hàng', 'Cần xác nhận giá, ưu đãi hoặc điều kiện áp dụng.', 'Nhờ anh/chị cập nhật chương trình bán hàng và thời gian áp dụng để nội dung quảng cáo thống nhất với thông tin tư vấn.'],
                ['Phản hồi kết quả tư vấn', 'Cần liên kết dữ liệu quảng cáo với hoạt động bán hàng.', 'Nhờ anh/chị phản hồi tình hình tiếp nhận và tư vấn khách hàng để đội ngũ đánh giá chất lượng từng nguồn và ưu tiên phương án phù hợp.'],
                ['Thống nhất kế hoạch tuần tới', 'Cần xác nhận các đầu việc trước khi triển khai.', 'Đề xuất thống nhất các đầu việc ưu tiên và thông tin cần bổ sung cho tuần tới để đội ngũ chủ động triển khai theo mục tiêu chung.'],
            ],
        ];
        $index = 0;
        foreach ($groups as $category => $rows) {
            foreach ($rows as [$title, $hint, $content]) {
                $index++;
                WeeklyReportTemplate::firstOrCreate(['seed_key' => 'starter-v1-'.$index], [
                    'title' => $title, 'category' => $category, 'usage_hint' => $hint, 'content' => $content,
                    'is_active' => true, 'sort_order' => $index * 10,
                ]);
            }
        }
    }
}
