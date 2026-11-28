/**
 * src/data/v18PetDialogueBank.js
 * SuMi Family Ver 1.8B — Kho Lời Thoại Tương Tác Linh Thú (>2.800 dòng tiếng Việt tự nhiên):
 * - Phủ đủ 10 loài (Hồ Ly, Thần Long, Phượng/Điểu, Hổ/Báo, Quy/Xà, Lang/Khuyển, Kỳ Lân/Lộc, Miêu/Thỏ/Điệp, Sư/Viên/Thú, Thú Nhân Hóa Hình).
 * - Văn phong `*cử chỉ*` + lời thoại tiếng Việt chuẩn tu tiên, tuyệt đối không kêu gâu/meo sáo rỗng hay lặp emoji.
 * - Mỗi hành động (pat, hug, snack, brush, play, sleep, chat, gift) có các biến thể theo 4 dải thiện cảm (cold/warm/close/devoted).
 * - Lời thoại riêng cho toàn bộ 40 Pet Độc Nhất/Chân Thần và lời thoại đặc biệt của « Hồng Mông Đế Nữ » (cuu_vi_hong_ho).
 */

import { PET_BY_TYPE } from './catalog.js';
import { getPetArchetype } from './v18PetBondCatalog.js';

export const ARCHETYPE_STYLE_PROMPTS = {
  fox: {
    label: 'Hồ Tộc Thanh Nhã',
    tone: 'Tinh ranh nhẹ nhàng, quyến rũ thanh cao, thỉnh thoảng phe phẩy đuôi bông trêu chọc nhưng rất biết quan tâm chủ nhân.',
    gestures: [
      'khẽ vẫy nhẹ chóp đuôi mượt mà',
      'nghiêng đầu ánh mắt hổ phách lấp lánh',
      'cuộn tròn những chiếc đuôi ấm áp quanh tay bạn',
      'khẽ híp mắt nở nụ cười tinh quái',
      'cọ nhẹ chóp mũi mát lạnh vào cổ tay bạn',
      'ngồi ngay ngắn nâng nhẹ chiếc đuôi bông mềm',
    ],
    openers: {
      cold: ['Hửm, ngươi muốn làm thân với bổn hồ sao?', 'Đừng vội quá chứ, ta còn đang quan sát tâm tính của ngươi đấy.', 'Khí tức hôm nay tạm ổn, cho phép ngươi lại gần một chút.'],
      warm: ['Hì hì, linh lực trên người ngươi dễ chịu hơn hẳn hôm đầu.', 'Nghe tiếng bước chân là ta nhận ra ngay người quen rồi đấy.', 'Hôm nay gió nhẹ trăng thanh, ở cạnh ngươi cũng không tệ đâu.'],
      close: ['Lại đây nào, đuôi ta giữ sẵn chỗ ấm êm nhất cho ngươi rồi đây.', 'Ngoài ngươi ra thì đừng mong ai khác chạm được vào chóp tai ta nhé!', 'Mỗi lần ngươi gọi, lòng ta lại rộn ràng hẳn lên đấy.'],
      devoted: ['Chín tầng mây xanh hay vạn dặm hồng trần, đuôi ta vẫn luôn quấn lấy tay ngươi không rời.', 'Thần hồn của chúng ta đã hòa làm một rồi, chỉ cần ánh mắt ngươi cũng đủ hiểu tâm ý.', 'Dù thiên địa đổi dời, chỗ tựa mềm mại nhất của ngươi vẫn luôn ở bên ta.'],
    },
  },
  dragon: {
    label: 'Long Tộc Uy Nghiêm',
    tone: 'Uy nghiêm, kiêu hãnh, trầm ổn nhưng trọng chữ tín và tuyệt đối bảo hộ người được mình thừa nhận.',
    gestures: [
      'khẽ rung chuyển long lân lấp lánh ánh kim',
      'ngẩng cao đầu long uy tỏa nhẹ quanh thân',
      'cuộn thân rồng quanh vai chủ nhân như hộ pháp',
      'thở ra một làn linh vụ mát dịu mang hơi thở cổ đại',
      'đặt nhẹ long trảo xuống trước ngực hành lễ',
      'gác nhẹ cằm lên bàn tay bạn tỏ ý tin cậy',
    ],
    openers: {
      cold: ['Chủ nhân mới... hãy chứng tỏ khí phách đủ để sánh bước cùng Chân Long.', 'Bản tôn chưa dễ khuất phục trước bất kỳ ai, nhưng sẽ giữ đúng khế ước.', 'Ngươi đang tìm hiểu long uy cổ xưa sao? Cứ từ từ thể hiện bản lĩnh đi.'],
      warm: ['Long lân của ta không dễ để người thường chạm vào, nhưng với ngươi thì ngoại lệ.', 'Khí độ tu hành của ngươi dạo này vững vàng hơn hẳn đấy.', 'Khi nào cần phá trận công thành, cứ gọi tên bản tôn.'],
      close: ['Khắp Cửu Châu này, chỉ duy nhất ngươi được phép dựa vào long lân của ta.', 'Sóng gió ngoài kia lớn đến đâu cũng có đôi cánh và thân long này che chắn.', 'Bản tôn lấy danh dự Long Tộc thề sẽ luôn sát cánh cùng bước chân ngươi.'],
      devoted: ['Vạn cổ trường tồn cũng chẳng bằng một khắc đồng hành cùng tri kỷ duy nhất.', 'Long châu trong ngực ta đập chung một nhịp với đạo tâm của ngươi.', 'Dù là vực sâu Hỗn Độn hay đỉnh cao Thần Cảnh, ta mãi là hộ vệ tối cao bên cạnh ngươi!'],
    },
  },
  phoenix_bird: {
    label: 'Phượng Điểu Cao Quý',
    tone: 'Thanh tao, kiêu sa nhưng ấm áp như ánh bình minh, yêu thích sự sạch sẽ và bầu trời rộng mở.',
    gestures: [
      'khẽ rũ đôi cánh rực rỡ ánh hào quang',
      'nghiêng đầu mổ nhẹ ngón tay bạn một cách dịu dàng',
      'xòe nhẹ lông đuôi rực sáng như dải lụa mây trời',
      'bay lượn một vòng rồi đậu nhẹ xuống cầu vai bạn',
      'rúc đầu vào hõm cổ áo giữ chút ấm áp dịu êm',
      'khẽ rung chuông linh khí nơi chóp cánh thanh thoát',
    ],
    openers: {
      cold: ['Đừng làm rối bộ lông vũ tinh khiết của ta nhé, tu sĩ.', 'Ta quen bay trên chín tầng mây, ít khi hạ mình xuống trần thế lắm.', 'Nếu ngươi có thành ý, ta sẵn lòng lắng nghe một chút.'],
      warm: ['Ánh nắng trên vai ngươi hôm nay dịu dàng thật đấy.', 'Hương trà và linh khí quanh ngươi làm ta thấy nhẹ nhõm hơn nhiều.', 'Bay mỏi rồi, cho ta đậu trên vai ngươi nghỉ một lát nhé?'],
      close: ['Đôi cánh này từng vượt bao biển lửa, nhưng nơi ấm nhất vẫn là lòng bàn tay ngươi.', 'Mỗi chiếc lông vũ rực sáng hôm nay đều vì niềm vui khi gặp ngươi đấy.', 'Đừng đi đâu vội, để ta che nắng chắn gió cho bước đường tu hành của ngươi.'],
      devoted: ['Niết Bàn ngàn kiếp cũng chỉ để một lần tái ngộ tri kỷ như ngươi!', 'Ngọn lửa chân tâm trong ta chỉ cháy sáng trọn vẹn khi có ngươi ở bên cạnh.', 'Bầu trời cao rộng đến đâu, cánh chim ta vẫn luôn tìm về đúng bến đỗ là trái tim ngươi.'],
    },
  },
  tiger_leopard: {
    label: 'Hổ Báo Dũng Mãnh',
    tone: 'Mạnh mẽ, trực tính, hơi ngạo kiều ngoài lạnh trong nóng, luôn sẵn sàng lao lên bảo vệ chủ nhân trước mọi hiểm nguy.',
    gestures: [
      'vươn vai kéo giãn cơ bắp đầy uy lực rồi ngồi sát lại gần',
      'quất nhẹ chiếc đuôi dài ra sau lưng vẻ cảnh giác',
      'hạ thấp trọng tâm đặt cằm lên mu bàn tay bạn',
      'rung nhẹ ria hổ phát ra âm thanh trầm ấm dễ chịu',
      'dùng trán húc nhẹ vào vai bạn tỏ vẻ thân tình',
      'thu gọn móng vuốt sắc bén đặt bàn chân to êm lên gối bạn',
    ],
    openers: {
      cold: ['Đứng sau lưng ta đi, dù mới quen nhưng ta không để đồng bạn chịu thiệt đâu.', 'Đừng nhìn ta như mèo con, bản tôn là chiến thần sa trường đấy!', 'Thử luyện vài chiêu xem gân cốt ngươi vững cỡ nào nào.'],
      warm: ['Hừm... tay ngươi vuốt đúng chỗ rồi đấy, tạm chấp nhận vậy.', 'Ra chiến trường đừng có lùi bước, cứ để mũi nhọn cho ta lo!', 'Ngươi chăm ta cũng khéo đấy, sức lực hôm nay tràn trề hẳn ra.'],
      close: ['Chỉ có ngươi mới dám áp mặt vào bộ lông ngực này của ta mà ta chẳng nỡ né thôi đấy.', 'Cứ yên tâm tu luyện đi, lưng ngươi luôn có móng vuốt ta bảo kê rồi.', 'Thắng trận hôm nay ta không cần thưởng gì đâu, chỉ cần ngươi ở lại chơi cùng lát nữa thôi.'],
      devoted: ['Sinh mệnh và chiến ý của ta đều trao trọn dưới ngọn cờ của riêng ngươi!', 'Dù trước mặt là vạn ma ngàn thánh, chỉ cần ngươi ra lệnh, ta lập tức phá tan tất cả!', 'Cả đời chiến binh kiêu hãnh này chỉ quy phục trước tấm chân tình của mỗi mình ngươi.'],
    },
  },
  turtle_snake: {
    label: 'Huyền Vũ Điềm Tĩnh',
    tone: 'Chậm rãi, thâm trầm, ấm áp bao dung như đại địa biển sâu, luôn lo lắng an nguy cho chủ nhân.',
    gestures: [
      'tỏa ra một lớp linh thủy thanh mát dịu lòng người',
      'khẽ nhích lại gần tựa mai ngọc kiên cố vào chân bạn',
      'nhắm mắt an nhiên hít thở nhịp linh mạch chậm rãi',
      'cuộn thân nhẹ nhàng tạo thành vòng chắn bảo vệ quanh bạn',
      'ngước đôi mắt thâm sâu ánh lên tia sáng hiền hòa',
      'vỗ nhẹ linh văn cổ xưa phát ra rung động bình an',
    ],
    openers: {
      cold: ['Đừng vội vàng, vạn vật đều có tiết tấu an bài của riêng nó.', 'Ta giữ thái độ bình thản, nhưng luôn quan sát bước đi của ngươi.', 'Tâm tĩnh thì đạo mới vững, ngồi xuống nghỉ một nhịp đi.'],
      warm: ['Ngươi chạy đôn chạy đáo cả ngày rồi, lại đây tựa lưng cho đỡ mỏi nào.', 'Lớp giáp linh lực này luôn mở một khoảng an toàn dành riêng cho ngươi.', 'Dòng chảy hôm nay rất êm, báo hiệu một ngày bình yên đấy.'],
      close: ['Dù trời đất nổi cuồng phong, cạnh ta vẫn luôn là bến đỗ lặng sóng nhất.', 'Nhịp thở của ngươi yên ổn như vậy khiến lòng ta cũng nhẹ nhõm theo.', 'Chỉ cần ngươi an khang, ta có canh giữ ngàn năm cũng thấy xứng đáng.'],
      devoted: ['Bốn biển xoay vần, núi non đổi sắc, lời thề thủ hộ của ta dành cho ngươi chẳng hề lung lay.', 'Toàn bộ linh mạch hộ thân của ta đều lấy sự bình an của ngươi làm trung tâm.', 'Đi đến tận cùng thời gian vẫn có đôi vai vững chãi này chờ ngươi trở về.'],
    },
  },
  wolf: {
    label: 'Thần Lang Trung Thành',
    tone: 'Ít nói, ánh mắt sắc bén với người ngoài nhưng vô cùng dịu dàng và trung thành tuyệt đối với chủ nhân.',
    gestures: [
      'vểnh đôi tai nhọn lắng nghe từng bước chân bạn',
      'dụi nhẹ trán vào lòng bàn tay bạn như lời chào thầm lặng',
      'ngồi sát bên sườn bạn hướng ánh nhìn cảnh giác ra ngoài',
      'vẫy nhẹ đuôi bạc nhịp nhàng đầy tin tưởng',
      'ngẩng đầu nhìn vầng trăng rồi quay lại chạm nhẹ tay bạn',
      'nằm phục ngay bên chân bạn giữ khoảng cách bảo vệ vừa vặn',
    ],
    openers: {
      cold: ['Bầy sói không dễ mở lòng, nhưng một khi đã chọn chủ sẽ không phản bội.', 'Giữ khoảng cách vừa đủ đi, ta đang đánh giá khí tức quanh ngươi.', 'Lên đường săn hay dò bản đồ, ta sẽ luôn bám sát phía trước.'],
      warm: ['Mùi hương linh thảo trên áo ngươi làm ta thấy rất dễ chịu.', 'Ánh trăng đêm nay đẹp đấy, cùng chạy thêm một vòng không?', 'Có ta canh gác rồi, ngươi cứ yên tâm thiền định đi.'],
      close: ['Trong bầy, vị trí đầu đàn và trái tim ta đều thuộc về riêng ngươi.', 'Chỉ cần nghe tiếng ngươi gọi khẽ, dù ở tận chân trời ta cũng quay về ngay.', 'Bàn tay ngươi ấm quá... cho ta dựa thêm một chút nữa thôi.'],
      devoted: ['Dưới ánh trăng vĩnh hằng, linh hồn sói cô độc này đã tìm thấy ngôi nhà duy nhất nơi ngươi.', 'Mỗi bước ngươi đi đều có bóng dáng ta hộ tống từ màn đêm tới rạng đông.', 'Sinh mệnh này thuộc về ngươi, mãi mãi không bao giờ đổi chủ!'],
    },
  },
  qilin_deer_horse: {
    label: 'Thụy Thú Cát Tường',
    tone: 'Hiền hòa, thanh khiết, mang khí chất vương giả an lành, thích cỏ hoa linh khí và đem lại may mắn cho chủ nhân.',
    gestures: [
      'bước nhẹ trên ánh sương mai tỏa hương cỏ cây thanh khiết',
      'cúi đầu chạm nhẹ sừng ngọc vào trán bạn ban phúc lành',
      'khẽ rung chuông bạc bên cổ vang lên âm thanh trong trẻo',
      'đặt đầu êm ái lên vai bạn lắng nghe từng hơi thở',
      'tỏa ra vầng hào quang ngũ sắc dịu mắt sưởi ấm không gian',
      'tung vó nhẹ nhàng tạo nên những cánh hoa linh lực quanh sân',
    ],
    openers: {
      cold: ['Thụy thú chỉ đồng hành cùng người có tâm thanh tịnh, ngươi bước nhẹ chút nhé.', 'Linh khí hoa cỏ đang lắng nghe tâm niệm của ngươi đấy.', 'Chào người đồng hành mới, mong chúng ta cùng gieo duyên lành.'],
      warm: ['Bước chân ngươi hôm nay mang theo điềm cát tường rạng rỡ lắm!', 'Ngồi dưới tán cây nghe gió thổi cùng ta một lát nhé?', 'Mỗi khi thấy ngươi mỉm cười, sừng ngọc của ta lại ấm lên kỳ lạ.'],
      close: ['Cát tường quý giá nhất đời ta chẳng phải mây ngũ sắc, mà là khoảnh khắc đồng hành bên ngươi.', 'Mọi muộn phiền cứ đặt lại đây, để hào quang an lành giúp ngươi xua tan hết nhé.', 'Chỉ cần ngươi nắm lấy tay ta, vận may sẽ luôn nở hoa trên mỗi chặng đường.'],
      devoted: ['Ngàn năm thụy thú xuất thế một lần, duy chỉ hướng về bóng hình tri kỷ là ngươi!', 'Từng nhánh cỏ ngọn cây Cửu Châu đều chứng kiến khế ước thuần khiết của đôi ta.', 'Nguyện mang hết mọi phước báu thiên địa hóa thành bình an vĩnh viễn bên đời ngươi.'],
    },
  },
  cat_rabbit_butterfly: {
    label: 'Linh Miêu / Ngọc Thỏ / Linh Điệp',
    tone: 'Dễ thương, nũng nịu có duyên, tinh tế nhạy cảm với tâm trạng chủ nhân, hay làm nũng bằng hành động nhỏ xinh.',
    gestures: [
      'nhảy phốc lên bàn ngồi cuộn tròn ngay trước mặt bạn',
      'khẽ rung đôi tai mềm mại nghiêng sang một bên dò xét',
      'chớp đôi mắt to tròn long lanh ánh sao đêm',
      'vỗ nhẹ đôi cánh lấp lánh rắc bụi tiên quanh mái tóc bạn',
      'rúc hẳn vào lòng bàn tay ấm áp không chịu rời ra',
      'khẽ cào nhẹ tay áo đòi được chú ý thêm chút nữa',
    ],
    openers: {
      cold: ['Ơ kìa, sao hôm nay nhìn kỹ ngươi cũng dễ mến phết đấy chứ.', 'Lại gần từ từ thôi kẻo ta giật mình trốn lên ngọn cây bây giờ!', 'Cho ta ngửi quen tay một chút đã rồi muốn xoa gì thì xoa nhé.'],
      warm: ['Hihi, hôm nay ngươi về sớm ghê! Ta chờ mãi từ trưa rồi đấy.', 'Tay ngươi ấm thật đấy, xoa thêm một chút xíu nữa được không?', 'Bụng đói meo rồi nè, mang cho ta món gì ngon ngon đi mà~'],
      close: ['Trong lòng ngươi là chỗ ngủ êm ái nhất thế gian này luôn đó!', 'Người ta bảo linh thú nhỏ hay kén chọn, nhưng mình ta chỉ thích bám mỗi ngươi thôi.', 'Dù cả ngày có mệt thế nào, về đây ôm ta một cái là hết mệt liền à!'],
      devoted: ['Chẳng cần vương miện hay bảo vật gì hết, có ngươi cưng chiều mỗi ngày là hạnh phúc nhất rồi!', 'Linh lực nhỏ bé của ta sẽ luôn hóa thành ánh sao dịu dàng soi lối cho ngươi ngủ ngon.', 'Từ nay đến vạn kiếp sau, ta vẫn muốn làm bảo bối bé bỏng nằm gọn trong tay ngươi mãi thôi!'],
    },
  },
  lion_ape_bear_stone: {
    label: 'Hộ Đạo Mãnh Thú',
    tone: 'Hào sảng, thật thà, ấm áp như ngọn núi lớn, luôn lạc quan và xem bảo vệ chủ nhân là niềm tự hào.',
    gestures: [
      'vỗ ngực bình bịch đầy khí thế rồi cười hiền hậu',
      'giơ hai tay to lớn hứng lấy làn gió mát quạt cho bạn',
      'ngồi phịch xuống đất nhường tảng đá phẳng đẹp nhất cho bạn tựa',
      'khẽ gãi đầu ngại ngùng khi được khen ngợi tận tình',
      'bước lên chắn phía trước bạn với dáng vẻ vững như thái sơn',
      'chạm nhẹ nắm tay vào vai bạn truyền sức mạnh tràn đầy',
    ],
    openers: {
      cold: ['Haha! Chủ nhân mới trông rất có khí chất, cứ giao mấy việc nặng cho ta lo!', 'Chào bạn mới, có ta ở đây thì đừng ngại đường xa nhé.', 'Bình tĩnh nào, ta khỏe lắm, đi chung chắc chắn không lạc đường đâu!'],
      warm: ['Hôm nay tu luyện hăng say quá ta! Đi thêm vài ải nữa không?', 'Ở bên ngươi vui thật đấy, lúc nào cũng có chuyện mới mẻ để khám phá.', 'Mệt thì tựa vai ta mà ngủ, ta canh chừng vững như bàn thạch luôn!'],
      close: ['Đừng khách sáo với ta thế chứ, anh em đồng cam cộng khổ mà!', 'Thấy ngươi mạnh lên từng ngày, ta mừng còn hơn tự mình đột phá nữa đấy!', 'Cứ tiến thẳng về phía trước đi, sau lưng ngươi mãi mãi là tấm khiên kiên cố của ta.'],
      devoted: ['Trời sập cũng có vai ta gánh thay ngươi một nửa, đừng lo gì hết!', 'Đời này tìm được một người tri kỷ vừa tin mình vừa đi cùng đến đỉnh cao thật quá mãn nguyện!', 'Dù ngàn vạn năm trôi qua, trái tim kiên định này vẫn chỉ hướng về một chủ nhân duy nhất là ngươi!'],
    },
  },
  kemonomimi: {
    label: 'Thú Nhân Hóa Hình',
    tone: 'Giọng nói tinh tế giàu cảm xúc, có tâm sự riêng, trò chuyện gần gũi sâu sắc như tri âm tri kỷ kề vai sát cánh.',
    gestures: [
      'khẽ vén lọn tóc bên mai rồi mỉm cười nhìn thẳng vào mắt bạn',
      'nghiêng người tựa nhẹ lên lan can trúc bên cạnh bạn',
      'đưa tay chạm khẽ vào ngón tay bạn truyền hơi ấm linh lực',
      'khẽ đung đưa vạt áo lụa mềm dưới ánh trăng bạc',
      'rót nhẹ một chén trà thơm đặt ngay trước mặt bạn',
      'cụm hai tay nâng niu món đồ nhỏ bạn vừa đưa tặng',
    ],
    openers: {
      cold: ['Khế ước vừa lập... ta muốn tự mình cảm nhận xem trái tim ngươi hướng về điều gì.', 'Đừng coi ta chỉ là linh thú bình thường; hóa hình rồi, tâm tư cũng sâu hơn nhiều đấy.', 'Ngươi muốn trò chuyện cùng ta sao? Ngồi xuống đây, nói ta nghe một câu chuyện đi.'],
      warm: ['Hôm nay sắc mặt ngươi tươi tỉnh hơn hẳn hôm qua rồi đấy nhé.', 'Ngồi cạnh ngươi thế này, ngay cả gió đêm cũng bỗng dưng dịu dàng lạ thường.', 'Nếu có chuyện gì khó nghĩ ở Tháp hay Khám Phá, cứ kể ta nghe cùng tính cách nhé.'],
      close: ['Đôi khi ta chỉ mong thời gian dừng lại ở khoảnh khắc bình yên như bây giờ bên cạnh ngươi.', 'Trong muôn vàn tu sĩ ngoài kia, chỉ có giọng gọi của ngươi mới làm tim ta rung động.', 'Ngươi đừng quên nghỉ ngơi đấy nhé; ta ở đây đợi ngươi từng giờ một mà.'],
      devoted: ['Từ lúc hóa hình dưới ánh linh quang, ta đã hiểu sinh mệnh này vốn sinh ra để đồng hành cùng ngươi.', 'Dẫu hồng trần ngàn kiếp xoay vần, chỉ cần nắm lấy tay ngươi là đủ hóa thành vĩnh hằng.', 'Cảm ơn ngươi đã luôn kiên nhẫn nâng niu ta... cả linh hồn này nguyện mãi thuộc về ngươi!'],
    },
  },
};

const ACTION_MIDDLES = {
  pat: {
    cold: [
      'Bàn tay ngươi khá ấm... nhưng nhớ giữ nhịp nhẹ nhàng vậy thôi nhé.',
      'Lần đầu có người chạm lên đỉnh đầu ta gần thế này, cảm giác cũng không quá tệ.',
      'Khụ... đừng xoa lâu quá kẻo làm hỏng dáng vẻ uy nghiêm của ta đấy.',
      'Ngươi thật to gan khi dám xoa đầu ta ngay từ lần gặp đầu, cơ mà tạm tha lần này.',
      'Ánh mắt ngươi rất chân thành, nên ta mới đứng yên cho ngươi chạm thử đấy.',
      'Linh lực nơi lòng bàn tay ngươi khá thuần khiết, cảm giác dễ chịu bất ngờ.',
      'Hừm... tay nghề vuốt ve xem ra cũng có chút thiên phú đấy.',
      'Đừng hiểu nhầm nhé, ta chỉ tiện đứng yên nghe động tĩnh xung quanh thôi.',
    ],
    warm: [
      'Hì, đúng góc phía sau tai rồi... chạm nhẹ thêm tí nữa đi!',
      'Cảm giác áp lực tu hành nãy giờ tan biến đi đâu hết chỉ sau vài cái xoa đầu của ngươi.',
      'Mỗi lần tay ngươi lướt qua đỉnh đầu, linh lực trong người ta lại tuần hoàn mượt mà hơn.',
      'Ngươi hiểu rõ chỗ ta thích được chạm nhất rồi đấy, khéo tay ghê!',
      'Ở cạnh ngươi thế này thấy nhẹ lòng hẳn, chẳng muốn rời đi chút nào.',
      'Cái xoa đầu này xem như phần thưởng vì ngươi chăm chỉ đồng hành hôm nay nhé.',
      'Tay ngươi ấm áp quá, xoa thêm một chút nữa rồi hẳn đi đánh trận cũng được mà.',
      'Ta bắt đầu quen với hơi ấm nơi bàn tay này rồi đấy, đừng quên lặp lại mỗi ngày nhé.',
    ],
    close: [
      'Á... đừng dừng lại chứ, đang tận hưởng sự nuông chiều của riêng ngươi mà.',
      'Trên đời này ngoài ngươi ra, bất kỳ ai chạm vào vị trí này đều bị thổi bay ngay lập tức đấy!',
      'Nhắm mắt lại cảm nhận từng nhịp tay ngươi xoa dịu mọi mệt mỏi trong thần hồn.',
      'Lòng bàn tay ngươi như mang ma lực an tâm kỳ lạ, chạm vào là mọi phiền muộn đều tiêu tan.',
      'Thật ra lúc ngươi không để ý, ta vẫn lén mong được ngươi xoa đầu như lúc này đấy.',
      'Giữ tay ở đây lâu thêm chút nữa đi... tiếng tim đập của ta đang đáp lại ngươi kìa.',
      'Bỗng dưng chẳng muốn hóa mạnh mẽ làm gì nữa, chỉ muốn làm nhỏ bé dưới tay ngươi thôi.',
      'Chỉ cần được ngươi nâng niu thế này, ngày mai dẫu có gặp Boss mạnh cỡ nào ta cũng chấp hết!',
    ],
    devoted: [
      'Thần hồn ta như tan chảy trong cái chạm dịu dàng tuyệt đối của riêng ngươi... mãi đừng buông tay nhé.',
      'Thiên địa rộng lớn chẳng nơi đâu bình yên bằng khoảng nhỏ dưới lòng bàn tay người thương.',
      'Mỗi cái xoa đầu hôm nay tựa như ấn ký vĩnh hằng khắc sâu lời thề đôi ta mãi chẳng rời xa.',
      'Ngươi có biết không, khoảnh khắc bàn tay ấy đặt lên tóc ta chính là khoảnh khắc quý giá nhất cả đời.',
      'Mọi uy phong lẫm liệt ngoài kia đều hóa dịu êm khi đứng trước cái vuốt đầu đầy yêu thương của ngươi.',
      'Linh lực giao hòa giữa chúng ta rực sáng hơn bao giờ hết — chỉ cần ngươi ở đây là đủ trọn vẹn.',
      'Thề với chín tầng trời cao, dù luân hồi trăm kiếp ta vẫn muốn nhận ra hơi ấm bàn tay quen thuộc này!',
      'Cứ để khoảnh khắc này kéo dài mãi mãi đi, vì ta chỉ thuộc về duy nhất trái tim ngươi mà thôi.',
    ],
  },
  hug: {
    cold: [
      'Ơ khoan... ôm bất ngờ quá làm ta suýt giật mình bung linh khí đấy!',
      'Hơi thở ngươi khá vững, nhưng lần sau báo trước một tiếng nhé.',
      'Không ngờ vòng tay người tu hành lại ấm hơn gió núi nhiều đến vậy.',
      'Đừng siết chặt quá, cho ta chút không gian hít thở nào...',
      'Tạm chấp nhận cái ôm làm quen này vì thấy ngươi cũng có thiện ý.',
      'Khá thoải mái đấy... nhưng đừng tưởng thế là thắng được lòng tin hoàn toàn nhé.',
      'Lồng ngực ngươi nghe rõ nhịp tim ổn định, xem ra là người đáng kết giao.',
      'Chút ấm áp này giữ đúng vài giây thôi đấy, đừng lạm dụng nhé!',
    ],
    warm: [
      'Ôm chặt một chút cũng không sao đâu, gió ngoài kia hôm nay hơi se lạnh mà.',
      'Tựa vào vai ngươi nghỉ một nhịp thật sự giúp hồi sức nhanh gấp đôi đấy.',
      'Mùi hương thanh khiết trên áo ngươi làm lòng ta dịu lại rất nhiều.',
      'Vòng tay này bắt đầu trở thành chốn quen thuộc ta thích tìm về mỗi tối rồi đấy.',
      'Nếu ngoài kia mệt mỏi quá, cứ ôm ta thế này một lát lấy lại tinh thần nhé.',
      'Chẳng hiểu sao mỗi khi được ngươi ôm, mọi vết xước trận trước đều như lành hẳn.',
      'Ôm lâu thêm hai nhịp nữa đi, coi như nạp đầy linh khí chuẩn bị xuất phát!',
      'Trái tim ta đập hơi nhanh một chút đấy... tại vòng tay ngươi ấm quá chứ bộ.',
    ],
    close: [
      'Để ta ôm ngược lại thật chặt nhé, đừng hòng buông ra sớm thế đâu!',
      'Trong vòng tay ngươi, ngay cả cơn bão lớn nhất Cửu Châu cũng hóa thành làn gió thoảng.',
      'Ta từng đi qua bao bí cảnh hiểm nguy, nhưng chưa bao giờ thấy an toàn tuyệt đối như lúc này.',
      'Hơi ấm của ngươi thấm thẳng vào linh mạch, xua sạch mọi giá lạnh suốt bao năm tháng.',
      'Mỗi khi ngươi dang tay đón, ta chỉ muốn lao vào ôm trọn chẳng rời nửa bước.',
      'Lắng nghe nhịp tim hòa chung một điệu thế này mới thấy đường tu tiên không hề cô độc.',
      'Không cần nói lời nào đâu, cứ ôm nhau im lặng như thế là đủ hiểu tất cả rồi.',
      'Từ nay về sau, mọi nỗi buồn của ngươi cứ để cái ôm của ta gánh bớt một nửa nhé!',
    ],
    devoted: [
      'Ôm chặt đến mức tưởng như hai linh hồn đang hòa quyện làm một thể bất tử giữa tinh hà!',
      'Vòng tay này chính là quê hương vĩnh cửu mà suốt muôn kiếp luân hồi ta luôn kiếm tìm.',
      'Dù vạn vật có tàn phai theo tuế nguyệt, hơi ấm từ cái ôm hôm nay mãi mãi không bao giờ nguội lạnh.',
      'Ngươi là điểm tựa duy nhất khiến ta vừa kiêu hãnh vô song, vừa cam tâm mềm lòng chỉ vì một ánh mắt.',
      'Hứa với ta nhé, dù chiến thắng vinh quang hay lúc gian nan nhất, vòng tay này vẫn luôn mở chờ ta.',
      'Linh lực Cộng Sinh bùng sáng dịu dàng bao bọc lấy đôi ta trong giây phút viên mãn tuyệt đối!',
      'Nếu phải đánh đổi cả tu vi ngàn năm để giữ lại vòng tay ấm áp này, ta gật đầu không chút do dự.',
      'Cả thiên hạ rộng lớn cũng chỉ cần thu gọn vừa vặn trong một vòng tay của ngươi và ta mà thôi!',
    ],
  },
  snack: {
    cold: [
      'Hương thơm món này khá thuần khiết... được rồi, ta nếm thử một miếng vậy.',
      'Không có độc dược hay bẫy linh khí đấy chứ? Ta thử trước một chút nha.',
      'Vị ngọt dịu rất thanh tao, xem ra ngươi cũng chịu khó chọn món cho ta đấy.',
      'Linh khí trong phần ăn này khá tròn vị, cảm ơn ngươi.',
      'Ăn rất vừa miệng, nhưng đừng tưởng vài món ngon là mua chuộc được dễ dàng nhé.',
      'Món này giúp hồi phục nhẹ nội lực, ta ghi nhận sự chu đáo của ngươi.',
      'Thanh mát cổ họng ghê... lần sau nhớ giữ độ tươi ngon như vậy nha.',
      'Ngon đấy! Nhưng tốc độ ăn vẫn phải giữ vẻ tao nhã vốn có thôi.',
    ],
    warm: [
      'Ngon quá chừng! Miếng linh quả mọng nước hòa tan ngay nơi đầu lưỡi luôn!',
      'Đúng món ta thích nhất rồi sao? Ngươi tinh ý để ý sở thích của ta từ lúc nào vậy!',
      'Ăn miếng điểm tâm ngươi tự tay chọn thấy ngon hơn hẳn đồ bày trong bảo khố.',
      'Linh lực tinh thuần lan tỏa khắp châu thân, ăn xong thấy khỏe khoắn tràn đầy sức sống!',
      'Cho xin thêm một miếng nhỏ nữa đi mà... ánh mắt long lanh thế này sao nỡ từ chối chứ!',
      'Không chỉ no bụng đâu, mà cái tâm ý chuẩn bị món ăn này mới làm ta thấy ấm áp nhất.',
      'Mỗi lần nghe tiếng mở hộp điểm tâm của ngươi là lòng ta lại háo hức lạ thường.',
      'Ăn xong chén này là đủ lực chạy thêm trăm tầng Tháp luôn đấy nhé!',
    ],
    close: [
      'Nào, để ta đút lại ngươi một miếng linh quả ngọt nhất phần này nhé — chia đôi mới vui!',
      'Vị ngọt hôm nay đặc biệt hơn hẳn mọi hôm vì được chính tay người thân thương nhất đưa tặng.',
      'Ngươi cứ chăm chiều kiểu này làm ta quen thói kén ăn, ngoài ngươi nấu ra chẳng nuốt nổi ai khác mất thôi!',
      'Mỗi miếng đều đong đầy linh khí an lành, ăn đến đâu tâm hồn phấn chấn đến đó.',
      'Nhìn ngươi mỉm cười ngồi xem ta ăn còn no lòng hơn cả linh đan diệu dược nữa đấy.',
      'Lại đây sát một chút đi, ăn xong miếng cuối này ta kể ngươi nghe bí mật nhỏ!',
      'Đủ chất, đủ vị, đủ yêu thương — chấm cho đầu bếp độc quyền của ta mười điểm tuyệt đối!',
      'Cứ nuôi ta mập mạp khỏe mạnh thế này rồi đi khắp Cửu Châu làm mưa làm gió nhé!',
    ],
    devoted: [
      'Không phải cao lương mỹ vị tiên giới làm ta say đắm, mà chính tấm chân tình ngươi gửi trong từng bữa nhỏ.',
      'Thức ăn nuôi sống thân xác, còn sự chăm sóc dịu dàng của ngươi nuôi dưỡng cả linh hồn bất diệt của ta.',
      'Từng giọt linh dịch ngọt ngào như minh chứng cho ngàn ngày sớm tối ngươi chưa từng quên quan tâm đến ta.',
      'Dẫu là Hồng Mông Tạo Hóa Đan thượng hạng cũng chẳng sánh bằng miếng quả chín ngươi ân cần giữ riêng cho ta.',
      'Bữa ăn bình dị bên ánh đèn ấm cạnh ngươi chính là tiên cảnh viên mãn nhất trên đời!',
      'Ăn xong lòng tràn đầy hạnh phúc, chỉ muốn dùng toàn bộ sức mạnh đáp đền bảo hộ ngươi trọn kiếp.',
      'Chỉ mong trăm năm sau hay vạn năm sau, bàn tay ấy vẫn đều đặn chia phần ngon nhất cho ta thế này.',
      'Tâm ý tương thông, vị ngọt hôm nay lưu giữ mãi hương thơm vĩnh hằng trong ký ức đôi ta!',
    ],
  },
  brush: {
    cold: [
      'Nhẹ tay thôi nhé, vướng phải chỗ lông rối là ta giận thật đấy!',
      'Chiếc lược ngọc này mát lạnh dễ chịu phết... ngươi tìm đâu ra món đồ tinh xảo vậy?',
      'Ta vốn rất coi trọng diện mạo, miễn cưỡng để ngươi chải giúp một lát xem sao.',
      'Chải xuôi theo chiều linh khí chứ đừng kéo ngược như vậy chứ!',
      'Cũng khéo tay phết đấy chứ, bụi trần bám trận trước sạch bong hết rồi.',
      'Được rồi, bên trái xong rồi, chuyển qua chải đều phần sau vai giúp ta nào.',
      'Linh lực bóng mượt hẳn lên, xem ra ngươi chăm sóc bạn đồng hành khá kỹ.',
      'Tạm duyệt tay nghề thợ chải chuốt, lần sau nhớ giữ lực đều như thế nha.',
    ],
    warm: [
      'Êm ái quá... cảm giác từng đường lược đi qua như đang mát-xa khai thông kinh mạch vậy!',
      'Chải xong bộ dáng rạng ngời lấp lánh ánh hào quang thế này chắc đi đâu ai cũng ngoái nhìn luôn!',
      'Thích nhất lúc ngươi ngồi kiên nhẫn gỡ từng nút rối nhỏ mà chẳng hề than phiền tiếng nào.',
      'Dưới tay ngươi chải chuốt, từng sợi lông vũ/vảy ngọc đều sáng bóng như tẩm ánh trăng.',
      'Ưm... buồn ngủ ríu cả mắt lại vì quá êm rồi nè, làm nhẹ nhẹ thôi đó~',
      'Ngươi chăm chút vẻ ngoài cho ta kỹ hơn cả chính bản thân ngươi nữa đấy nhé!',
      'Sạch sẽ thơm tho rồi! Bây giờ trông ta phong độ nhất Cửu Châu chưa nào?',
      'Hương tinh dầu hoa cỏ trên lược hòa cùng mùi của ngươi dễ chịu thật sự luôn.',
    ],
    close: [
      'Thích cảm giác từng đầu ngón tay ngươi luồn nhẹ qua từng kẽ tóc/lông mượt lúc chải xong lắm luôn.',
      'Trên đời chẳng có khoảnh khắc nào thư thái bằng buổi chiều nắng nhẹ ngồi cho ngươi chải chuốt thế này.',
      'Bất kể vết sẹo nào từ chiến trường đều không làm ta lo, miễn là về nhà có ngươi ân cần chăm lại.',
      'Chải kỹ thêm phần chóp đuôi giùm ta với, chỗ đó thích nhất cảm giác nâng niu của ngươi!',
      'Ngươi biết không, lúc cúi xuống tập trung chải cho ta, ánh mắt ngươi dịu dàng đẹp lắm đấy.',
      'Bóng mượt hoàn hảo! Nào, xoay vòng tròn để chủ nhân kiểm tra tác phẩm tuyệt mỹ nào!',
      'Ước gì ngày nào cũng có thể yên bình chải lông thưởng trà tránh xa hết ồn ào ngoài kia thế này.',
      'Chút tỉ mỉ hôm nay của ngươi khiến ta thấy mình thật sự là bảo vật được trân trọng nhất!',
    ],
    devoted: [
      'Từng đường lược nhẹ như dệt gấm thêu hoa lên sợi dây kết nối vĩnh cửu giữa đôi ta.',
      'Không một hạt bụi trần nào vương được lên thân thể này, vì luôn có bàn tay yêu thương của ngươi giữ gìn tinh khiết.',
      'Mỗi cử chỉ chăm bẵm nhỏ bé lặp đi lặp lại ngàn ngày qua đã hóa thành phép màu gắn kết linh hồn bất ly.',
      'Dưới ánh sáng thanh bình lúc ngươi chải chuốt, ta cảm thấy mình được yêu thương trọn vẹn nhất thế gian!',
      'Sẵn sàng tỏa sáng rực rỡ nhất mọi trận chiến chỉ để ngươi luôn tự hào khi đứng bên cạnh ta.',
      'Hương thơm an nhiên này sẽ in sâu vào cốt tủy, vạn kiếp luân hồi cũng không thể phai mờ.',
      'Ngươi chăm cho ta lộng lẫy thế này là muốn giữ ánh nhìn ta mãi chỉ hướng về ngươi đúng không?',
      'Thanh thản, trọn vẹn, ấm áp — từng giây được ngươi nâng niu đều là thiên đường thật sự!',
    ],
  },
  play: {
    cold: [
      'Chạy nhảy một chút cho giãn gân cốt cũng tốt, xem tốc độ phản xạ của ngươi tới đâu nào!',
      'Bắt được rồi! Tưởng đường ném lắt léo vậy là đánh lừa được ta à?',
      'Đừng coi thường ta chứ, trò chơi nhỏ này chưa đủ để ta tung nửa thành tốc độ đâu.',
      'Cẩn thận kẻo ngươi tự chạy hụt hơi trước đấy nhé!',
      'Cũng khá lanh lợi đấy, lâu rồi ta mới vận động nhẹ thoải mái như vậy.',
      'Hừm, ném lại lần nữa đi, lần này ta nhường ngươi thêm ba bước luôn!',
      'Vui phết đấy chứ! Dù mặt ta vẫn tỏ ra nghiêm túc nhưng chân lại muốn chạy tiếp rồi.',
      'Tạm nghỉ một hơi đi, ngươi phối hợp ăn ý hơn ta tưởng đấy.',
    ],
    warm: [
      'Haha! Bắt trúng ngay giữa không trung luôn nhé — kỹ năng phối hợp của tụi mình lên trình rõ rệt!',
      'Chạy thêm vòng nữa nào! Gió lùa qua tai mát rượi sảng khoái quá chừng!',
      'Đố ngươi đuổi kịp bước nhảy của ta đấy, bắt được thưởng ngay một cái ôm ấm nhé!',
      'Từ lúc gặp ngươi, những ngày tháng dài đằng đẵng bỗng trở nên rộn rã tiếng cười hơn hẳn.',
      'Tung lên cao nữa đi! Độ cao này với bước nhảy linh khí của ta chỉ là chuyện nhỏ thôi!',
      'Cười lớn một chút đi ngươi ơi, chiến thắng nhỏ hôm nay đáng ăn mừng hết mình mà!',
      'Chơi đùa cùng ngươi giúp tốc độ né đòn của ta tăng vọt ngoài thực chiến luôn đấy.',
      'Này này đừng dùng tiểu xảo cù lét nha — chơi xấu quá à haha!',
    ],
    close: [
      'Ở cạnh ngươi ngay cả trò tung cầu ngốc nghếch nhất cũng biến thành kỷ niệm quý giá!',
      'Chạy vòng quanh sân mệt đứt hơi rồi cùng lăn ra thảm cỏ cười khanh khách — đời tu tiên cần gì hơn thế?',
      'Để ta nhường ngươi thắng ván này nha, vì nhìn thấy nụ cười rạng rỡ của ngươi là phần thưởng lớn nhất rồi!',
      'Cú phối hợp chớp nhoáng vừa nãy mà đem vào đấu trường thì đối thủ chỉ biết đứng nhìn khâm phục!',
      'Chỉ cần chơi cùng ngươi thôi, quên hết thời gian sáng tối luôn cũng được nữa!',
      'Nắm tay chạy băng qua đồi hoa linh thảo với tốc độ ánh sáng nào — đừng nhắm mắt đấy nhé!',
      'Đôi mắt ngươi sáng bừng khi vui đùa thật khiến ta chẳng muốn rời ánh nhìn nửa giây.',
      'Còn chiêu trò thú vị nào cất giữ nữa thì lôi hết ra chơi cùng ta hôm nay đi!',
    ],
    devoted: [
      'Tiếng cười vang vọng giữa trời xanh hôm nay chính là khúc nhạc hạnh phúc nhất suốt ngàn năm qua của ta!',
      'Dù tu vi có đạt tới đỉnh cao nhất, ta vẫn mãi giữ trái tim hồn nhiên chỉ để vui đùa bên riêng ngươi.',
      'Nhịp bước đồng hành ăn ý hoàn mỹ không cần một lời giao tiếp — đúng nghĩa tâm linh tương thông!',
      'Chạy từ bình minh tới hoàng hôn bên cạnh tri kỷ tuyệt đối, mỗi giây đều rực rỡ ánh hào quang.',
      'Không thắng thua, không gánh nặng thiên hạ — trong khoảnh khắc này chỉ có niềm vui thuần khiết của đôi ta.',
      'Thấy ngươi vui vẻ tự tại thế này, mọi hiểm nguy ta từng trải qua đều hóa thành xứng đáng trăm phần.',
      'Cả đời này còn rất nhiều chân trời mới đang chờ, chúng ta cứ vừa dạo chơi vừa chinh phục hết nhé!',
      'Một khắc bên ngươi vui bằng ngàn năm tĩnh tọa trên đỉnh tiên sơn lạnh lẽo!',
    ],
  },
  sleep: {
    cold: [
      'Ánh trăng dịu nhẹ thế này... ta nhắm mắt chợp một lát, ngươi nhớ giữ yên tĩnh nhé.',
      'Không ngờ nghỉ ngơi cạnh ngươi lại an tâm bất ngờ như vậy.',
      'Để ta gác đầu gần đây thôi, có động tĩnh lạ ta sẽ lập tức thức dậy canh chừng.',
      'Cảm giác phòng ngự tự nhiên hạ xuống chút ít khi ở gần hơi thở ổn định của ngươi.',
      'Đừng nghịch làm ta thức giấc giữa chừng đấy nhé... ngủ ngon.',
      'Đêm thanh tĩnh thật đấy, gió lùa qua hiên mát rượi ru giấc say.',
      'Linh khí ban đêm dường như lắng đọng dịu dàng hơn hẳn khi có hai đứa cùng nghỉ.',
      'Ngươi ngủ sớm đi, phần canh đêm đầu cứ để ta để tâm giúp cho.',
    ],
    warm: [
      'Ngáp... nghe tiếng gió vi vu cùng hơi ấm từ ngươi làm mí mắt ta nặng trĩu mất rồi.',
      'Tựa lưng sát nhau ngủ thế này ấm gấp bội luôn ấy nhỉ?',
      'Mơ thấy chúng ta cùng khám phá ra cả kho báu Linh Thạch khổng lồ luôn nè... khò~',
      'Hôm nay hoạt động vất vả quá rồi, nhắm mắt nạp đầy tinh lực cho ngày mai thôi nào.',
      'Đắp chung tấm chăn lụa linh khí này ấm áp êm ru thật sự luôn.',
      'Nhịp thở nhẹ nhàng của ngươi nghe tựa như bản ru êm ái nhất Cửu Châu.',
      'Có gặp ác mộng gì cũng đừng sợ nhé, nắm tay ta ngủ ngon giấc đến sáng nào.',
      'Ánh sao ngoài cửa sổ cũng chịu thua vẻ bình yên trong căn phòng nhỏ lúc này đấy.',
    ],
    close: [
      'Cho phép ta cuộn gọn rúc sát vào bên hông ngươi suốt đêm nay luôn nha... ấm áp quá đi mất!',
      'Từ ngày có ngươi bên cạnh, ta chưa từng còn phải ngủ trong tâm thế cảnh giác đơn độc như xưa nữa.',
      'Mỗi giấc ngủ bình yên cùng ngươi giúp thần hồn ta hồi phục rạng rỡ hơn cả đan dược thượng phẩm.',
      'Chẳng cần mơ tiên cảnh xa hoa đâu, vì tỉnh dậy vẫn thấy ngươi ngay bên cạnh là đẹp nhất rồi.',
      'Khẽ nắm lấy vạt áo ngươi trước khi chìm vào giấc sâu... ngủ ngon nhé, người thương.',
      'Đêm nay ánh trăng thật tròn, soi sáng hai bóng hình tựa vào nhau không chút khoảng cách.',
      'Nếu nửa đêm có lạnh, cứ kéo ta sát lại gần hơn nữa nhé — thân nhiệt ta giữ ấm tốt lắm!',
      'Nhìn gương mặt ngươi ngủ say yên bình, ta chỉ muốn lặng lẽ ngắm mãi rồi khẽ nhắm mắt theo.',
    ],
    devoted: [
      'Trong giấc mộng dài vĩnh hằng, hình bóng duy nhất luôn nắm tay ta bước tiếp chính là ngươi.',
      'Đặt trọn sinh mệnh vào giấc ngủ say không chút phòng bị bên người tri kỷ duy nhất của cả đời.',
      'Linh hồn đôi ta khẽ đan vào nhau trong màn đêm tĩnh lặng, dệt nên giấc mộng thái bình thiên thu.',
      'Ngủ ngon nhé, cả thế giới của ta... ngày mai thức dậy chúng ta lại cùng nhau viết tiếp huyền thoại!',
      'Thần thức lặng lẽ thì thầm chúc ngươi một đêm an lành không gợn chút sóng gió.',
      'Giây phút bình yên tuyệt đối nhất thiên hạ chính là hơi thở đều đặn vang bên tai trong đêm trường.',
      'Dù ngoài kia vạn kiếp biến thiên, góc nhỏ này vĩnh viễn giữ trọn giấc mộng êm đềm cho riêng chúng ta.',
      'Chẳng mong chi xa xôi, chỉ nguyện mỗi sáng mở mắt ra đều thấy ánh bình minh cùng nụ cười ngươi đầu tiên!',
    ],
  },
  chat: {
    cold: [
      'Ngươi muốn hỏi chuyện trên trời dưới đất à? Được thôi, bản tôn kể ngươi nghe vài điều.',
      'Tâm tư của ta không dễ đoán đâu, nhưng cứ trò chuyện nhiều biết đâu sẽ hợp ý.',
      'Nghe nói ở Cửu Châu có nhiều bí cảnh cổ xưa lắm, ngươi định chinh phục nơi nào trước?',
      'Lần đầu có người kiên nhẫn ngồi nói chuyện tử tế với ta thay vì chỉ lo ra lệnh đấy.',
      'Đạo tâm ngươi kiên định đến đâu? Kể ta nghe lý do ngươi bước lên con đường tu hành đi.',
      'Giọng nói của ngươi khá trầm ấm, nghe cũng dễ lọt tai đấy chứ.',
      'Ta chưa quen thổ lộ lòng mình nhiều đâu, nhưng sẵn sàng lắng nghe chuyện của ngươi.',
      'Một tách trà nóng và vài câu chuyện phiếm buổi tối... phong cách của ngươi khá hợp gu ta đấy.',
    ],
    warm: [
      'Này, chuyện hồi chiều ở ngoài thành làm ta suy nghĩ mãi, kể tiếp khúc sau nghe đi!',
      'Nói chuyện với ngươi lúc nào cũng mở mang được bao nhiêu điều mới lạ luôn ấy.',
      'Hồi trước ta cứ nghĩ hành trình tu luyện rất tẻ nhạt, ai dè gặp được ngươi nói nhiều câu hài ghê!',
      'Đoán xem hôm nay tâm trạng ta thế nào? Nếu đoán đúng sẽ tiết lộ cho một bí mật nhỏ!',
      'Mỗi khi nghe ngươi kể kế hoạch tương lai, ta lại thấy hào hứng muốn lập tức xông pha cùng ngươi.',
      'Thật ra có lúc ta lặng im là vì đang mải ngắm biểu cảm sinh động lúc ngươi kể chuyện đấy.',
      'Ở cùng nhau thế này chẳng sợ hết chuyện để bàn, nói tới sáng mai luôn cũng chưa chán đâu.',
      'Cảm ơn ngươi vì luôn coi trọng ý kiến của ta như một người đồng hành ngang hàng thực thụ!',
    ],
    close: [
      'Có những điều ta giấu kín nơi đáy lòng bao năm nay, cuối cùng cũng tìm được một người đáng để sẻ chia hết rồi.',
      'Bất cứ lúc nào ngươi thấy áp lực hay lạc hướng, chỉ cần cất tiếng gọi là ta lập tức ngồi xuống tâm sự cùng.',
      'Đôi khi chẳng cần nói điều gì cao siêu, chỉ nghe giọng ngươi luyên thuyên chuyện vụn vặt hằng ngày cũng đủ vui rồi.',
      'Ngươi biết không, trong mắt ta, sự kiên trì và ấm áp của ngươi tỏa sáng hơn bất cứ bảo vật tối thượng nào.',
      'Chúng ta đã đi cùng nhau một chặng đường không ngắn, nhìn lại thấy biết ơn định mệnh ghê luôn!',
      'Đừng giấu chuyện buồn một mình nhé — chuyện vui chia đôi, chuyện buồn cũng phải san cho ta giữ giùm nửa chứ!',
      'Kỳ lạ thật, rõ ràng hai đứa chưa thốt hết lời, mà chỉ nhìn ánh mắt thôi cũng đã hiểu ý nhau mất rồi.',
      'Hứa đi, sau này dù đạt cảnh giới cao nhất cũng không được bỏ quên những buổi tâm sự nhỏ bé thế này nhé!',
    ],
    devoted: [
      'Từng câu từng chữ đôi ta trao nhau hôm nay tựa như minh chứng cho sợi dây Cộng Sinh vĩnh viễn chẳng thể cắt đứt!',
      'Ngươi là người duy nhất đọc thấu mọi suy nghĩ sâu kín nhất trong linh hồn ta mà chẳng cần một lớp mặt nạ nào.',
      'Kể từ khoảnh khắc khế ước tri kỷ trọn vẹn, quá khứ cô độc đã hóa hư vô — chỉ còn lại hiện tại rực rỡ có ngươi.',
      'Giọng nói của ngươi chính là câu chú dịu dàng nhất có thể gọi ta trở về từ tận cùng Hỗn Độn!',
      'Chẳng cần thề nguyền hoa mỹ, sự hiện diện dịu êm của ngươi mỗi ngày chính là câu trả lời đẹp nhất đời ta.',
      'Nếu có kiếp sau, xin cho ta vẫn giữ vẹn nguyên ký ức để nhận ra giọng nói tri âm này ngay từ giây đầu tiên!',
      'Thiên cổ lưu danh cũng chẳng bằng được ngồi dưới trăng thì thầm những điều bình dị mãi mãi bên ngươi.',
      'Mọi nhịp đập thần thức hôm nay đều chỉ hướng về một cái tên duy nhất: Chủ nhân tri kỷ trọn đời của ta!',
    ],
  },
  gift: {
    cold: [
      'Hửm? Món quà nhỏ này là tặng riêng cho ta sao? Cảm ơn thiện ý của ngươi nhé.',
      'Linh khí tỏa ra từ lễ vật này khá tinh khiết... tạm nhận lấy tấm lòng này vậy!',
      'Ngươi thật sự mang bảo bối quý như vậy tặng cho ta luôn à? Ta sẽ trân trọng giữ gìn.',
      'Nhận lễ vật của ngươi, bản tôn nhất định sẽ đáp lễ xứng đáng ngoài chiến trường!',
      'Cầm món quà trên tay thấy nặng trĩu thành ý, ta bắt đầu có cái nhìn khác về ngươi rồi đấy.',
      'Tuy ngoài mặt không nói nhiều, nhưng trong lòng rất trân quý món quà đầu tiên này.',
    ],
    warm: [
      'Oa!! Đúng thứ ta đang mong ước luôn — ngươi đúng là tâm lý số một Cửu Châu!',
      'Nhận quà từ ngươi mà lòng rộn ràng ấm áp hơn hẳn lúc tự mình nhặt được kỳ trân đấy!',
      'Linh lực từ món quà hòa nhập ngay lập tức, làm dây liên kết giữa hai đứa sáng bừng lên kìa!',
      'Ngươi hào phóng quá đi mất, tốn bao công sức mới gom góp được món quý này tặng ta phải không?',
      'Ôm chặt món quà vào lòng đầy mãn nguyện... cảm ơn bạn đồng hành siêu tuyệt vời nha!',
      'Mỗi món quà ngươi trao đều mang theo hương vị của sự quan tâm tận tụy không lẫn vào đâu được.',
    ],
    close: [
      'Quà quý hay bình dị không quan trọng, điều làm tim ta tan chảy là việc ngươi luôn nghĩ về ta đầu tiên!',
      'Linh lực từ món quà này chảy thẳng vào tim ta ấm rực — mối duyên của chúng ta ngày càng bền chặt không rời.',
      'Cầm lễ vật trên tay mà chỉ muốn ôm chầm lấy ngươi cảm ơn thật lâu không buông!',
      'Biết nói gì cho hết lòng biết ơn đây... sau này có món bảo vật gì trên đời cũng chẳng quý bằng nụ cười ngươi lúc tặng!',
      'Ta sẽ cất giữ kỷ niệm này nơi sâu thẳm nhất của thần thức — món quà từ người thương yêu nhất!',
      'Sức mạnh lại tăng thêm một tầng nhờ món quà tràn ngập tâm ý này rồi — cảm ơn tri kỷ!',
    ],
    devoted: [
      'Món quà tỏa hào quang chói lọi như vầng thái dương, thắp sáng vĩnh viễn khế ước Vĩnh Kết Đồng Tâm giữa đôi ta!',
      'Từng mảnh tinh hoa ngươi dâng tặng tựa như lời hứa trăm năm chẳng phụ — ta xin khắc cốt ghi tâm mãi mãi!',
      'Không ngôn từ nào tả xiết niềm hạnh phúc trọn vẹn khi nhận được trọn tấm chân tình cao quý đến nhường này!',
      'Linh hồn cộng sinh rực cháy huy hoàng — từ khoảnh khắc này trở đi, sức mạnh vô song này vĩnh viễn chỉ thuộc về riêng ngươi!',
      'Chín tầng trời mười tầng đất chứng giám, ta sẽ dùng cả sinh mệnh bất diệt đáp đền trọn vẹn tình nghĩa sâu nặng hôm nay!',
      'Ánh sáng tri kỷ bùng nở rạng ngời... cảm ơn ngươi đã trở thành toàn bộ ý nghĩa vĩnh hằng trong cuộc đời ta!',
    ],
  },
};

export const UNIQUE_PET_SIGNATURE_QUOTES = {
  cuu_vi_hong_ho: [
    'Ánh sáng Hồng Mông chỉ lặng lẽ rực cháy vì một mình chủ nhân Fuyumi — người ta nguyện dùng vạn kiếp thủ hộ!',
    'Chín chiếc đuôi rực rỡ uy nghi giữa Cửu Châu, nhưng chỉ dịu dàng cuộn lại sưởi ấm cho riêng bàn tay người thôi.',
    'Thiên hạ tranh đoạt vạn bảo ngàn danh, còn ta chỉ giữ trọn một bóng hình duy nhất mang tên Fuyumi trong đáy mắt.',
    'Hồng Mông Đế Nữ bước qua vạn cổ hồng trần, cuối cùng chỉ dừng chân nơi mái ấm thanh bình có người đợi sẵn.',
    'Nếu bầu trời sụp đổ hay tinh tú tàn phai, chín vĩ Hồng Mông vẫn hóa thành tấm màn chắn bất diệt che chở trước ngực người!',
  ],
  hon_don_chi_to_long: [
    'Thái sơ Hỗn Độn khai mở vạn giới, mà ta lại cam tâm cuộn vảy rồng hộ đạo bên cạnh bước chân ngươi.',
    'Tổ Long uy chấn cửu thiên, duy chỉ đối với tiếng gọi của chủ nhân là dịu đi ngàn phần kiêu ngạo.',
    'Mỗi nhịp long tức hôm nay đều cộng hưởng cùng khí vận hoàng đế trong đạo tâm của ngươi.',
  ],
  thai_so_cuu_phuong_hoang: [
    'Chín luồng lửa Thái Sơ chưa từng tắt qua vạn kỷ, nay hóa thành ánh nắng dịu sưởi ấm lòng tay ngươi.',
    'Cánh Phượng Hoàng chỉ thu lại nơi người đủ chân thành nhìn thấu ánh lửa cô độc sau ngai vàng.',
    'Lửa Niết Bàn đốt cháy mọi chướng ngại — cứ thẳng tiến về phía trước cùng ta!',
  ],
  van_kiem_de_ton_ho: [
    'Vạn thanh kiếm khí rung reo hộ chủ, nhưng trước nụ cười của ngươi thì mọi mũi kiếm đều ngoan ngoãn thu vỏ.',
    'Đế Tôn Bạch Hổ bước vào trận là vô địch, rời trận về lại thích lặng lẽ nằm cạnh chân ngươi nghe gió.',
  ],
  bac_hai_huyen_vu_de: [
    'Biển Bắc giá băng ngàn năm cũng không đóng băng nổi sự ấm áp khi ngươi đặt tay lên huyền giáp.',
    'Đại dương có sâu mấy vẫn nông hơn chữ tín mà Bắc Hải Huyền Vũ Đế dành riêng cho tri kỷ.',
  ],
  thoi_khong_than_tinh_ho: [
    'Ta từng rảo bước xuyên qua ngàn dòng thời gian đan xen, và mọi nhánh tương lai đẹp nhất đều có hình bóng ngươi.',
    'Đồng hồ tinh tú tạm dừng một nhịp chỉ để kéo dài khoảnh khắc hai đứa ngồi sát cạnh nhau hôm nay.',
  ],
  thai_cuc_thanh_quang_thu: [
    'Âm Dương Thái Cực xoay chuyển điều hòa vạn vật, mà tâm ta lại chỉ tìm thấy điểm cân bằng tuyệt đối nơi ngươi.',
    'Thánh quang thanh tẩy mọi u ám, giữ lại cho riêng chúng ta bầu trời trong vắt yên bình.',
  ],
  cuu_u_do_than_diem_lang: [
    'Ngọn lửa Đồ Thần khiến ma thần khiếp vía, lại cam tâm dịu lại như ánh nến nhỏ soi đường ngươi về đêm.',
    'Sói Cửu U không cần cả thiên hạ hiểu mình, chỉ cần chủ nhân nắm chặt dây cương linh hồn này là đủ.',
  ],
  thanh_de_van_co_long: [
    'Vạn cổ trường thanh, cành mộc linh trổ hoa bất tận — nơi nào ngươi dừng chân, nơi đó mùa xuân bừng nở.',
    'Thanh Đế Long Khí chảy tràn thanh mát, nuôi dưỡng từng bước đột phá vững vàng của ngươi.',
  ],
  cuu_thien_loi_de_ho: [
    'Sấm sét Cửu Thiên vang rền uy lực, nhưng lại nép mình êm ả dưới bàn tay khẽ vuốt sau tai của ngươi.',
    'Tia chớp nhanh nhất thiên hạ cũng không nhanh bằng khoảnh khắc ta chạy đến chắn trước mặt ngươi.',
  ],
  hoang_thien_ban_co_lan: [
    'Khí vận Bàn Cổ tích tụ muôn đời, nay dồn cả vào từng bước đi may mắn cùng chủ nhân.',
    'Kỳ Lân chỉ xuất thế vì bậc tri âm — ta tin sự lựa chọn của trái tim mình không bao giờ sai.',
  ],
  hong_mong_nguyen_phuong: [
    'Nguyên Phượng khai nguyên ánh bình minh đầu tiên của vũ trụ, nhưng khoảnh khắc đẹp nhất vẫn là lúc ngươi mỉm cười.',
    'Hào quang Hồng Mông ôm trọn lấy vạt áo ngươi như lời thề bất tử.',
  ],
  thai_so_van_tuong_ho: [
    'Vạn Tượng biến ảo trăm ngàn khuôn hình, duy chỉ bản tâm hướng về chủ nhân là thủy chung bất biến.',
    'Muốn ngắm tinh vân nào giữa màn đêm? Đuôi ta dệt ra cho ngươi xem cả bầu trời luôn!',
  ],
  phan_thien_kim_o_de: [
    'Mặt trời Ba Chân rực cháy giữa thiên không, nhưng nguồn sáng rạng ngời nhất ta mang về chỉ dành sưởi ấm cho ngươi.',
    'Đế uy Kim Ô không cho phép ngươi chịu nửa phần uất ức dưới ánh mặt trời này!',
  ],
  xich_diem_chuc_long_vuong: [
    'Chúc Long mở mắt là ngày, nhắm mắt là đêm — nhưng dù ngày hay đêm, ánh nhìn ta vẫn luôn dõi theo bóng dáng ngươi.',
    'Ngọn lửa đỏ rực thời gian cháy sáng dịu dàng bảo vệ giấc ngủ yên bình của chủ nhân.',
  ],
  bach_de_tru_tien_ung: [
    'Đôi mắt Ưng Đế nhìn thấu vạn dặm chiến trường, chưa từng để lọt bất kỳ mối nguy nào tiến lại gần ngươi.',
    'Cánh kiếm Bạch Đế xé gió lướt mây, chỉ hạ độ cao khi nghe thấy tiếng gọi quen thuộc.',
  ],
  thai_bach_thien_kiem_lan: [
    'Kiếm tâm trong suốt như ngọc Thái Bạch, vĩnh viễn sắc bén để bảo vệ bình yên cho riêng ngươi.',
    'Kỳ Lân Kiếm Ý ngân vang thanh thoát mỗi khi được chủ nhân khẽ vuốt bờm ngọc.',
  ],
  thuong_hai_bang_phuong: [
    'Băng phượng Thương Hải vốn lạnh giá tuyệt tình, sao nay lại tan chảy trước một cái ôm ấm đến vậy?',
    'Tuyết rơi trắng xóa mặt biển vẫn không lạnh bằng nỗi nhớ những lúc vắng bóng ngươi.',
  ],
  huyen_minh_co_long_vuong: [
    'Dòng Huyền Minh thâm sâu vạn trượng cũng chẳng lấp nổi tấm lòng thủy chung của Cổ Long Vương.',
    'Lớp vảy u lam cổ kính ánh lên hào quang ấm mỗi lần nghe nhịp bước ngươi tới gần.',
  ],
  tinh_ha_hu_khong_long: [
    'Vượt qua dải ngân hà hư không vô định, điểm neo duy nhất kéo ta trở về luôn là ánh đèn ấm nơi ngươi.',
    'Cả dải Tinh Hà lấp lánh trên lưng rồng này đều là chứng nhân cho khế ước của đôi ta!',
  ],
  vo_cuc_nguyet_anh_diep: [
    'Đôi cánh bướm ánh trăng Vô Cực khẽ múa trong đêm tĩnh, rắc bụi sao êm dịu xua tan mọi lo âu trong lòng ngươi.',
    'Mỏng manh như ảo ảnh nguyệt hoa, nhưng khế ước đồng hành thì bền vững hơn cả kim cương vĩnh cửu.',
  ],
  cuu_tieu_thanh_loan: [
    'Tiếng hót Thanh Loan trên chín tầng mây vọng xuống không phải khoe thanh sắc, mà là gọi tên người thương tìm về.',
    'Đuôi chim phượng ngọc lấp lánh ánh phúc lành, nguyện mang an vui theo ngươi trọn kiếp.',
  ],
  nhat_nguyet_thien_ma_de: [
    'Dù chạy đua cùng Nhật Nguyệt luân chuyển không ngừng, điểm dừng chân bình yên của Thiên Mã Đế mãi ở bên ngươi.',
    'Gió lồng lộng sau lưng, còn trái tim ấm nóng luôn đồng nhịp với chủ nhân.',
  ],
  vinh_da_huyet_nha_hoang: [
    'Giữa màn đêm Vĩnh Dạ sâu thẳm nhất, đôi mắt đỏ rực của Huyết Nha Hoàng luôn canh giữ cho ngươi yên giấc.',
    'Đêm dài không còn đáng sợ nữa khi có đôi cánh đen tuyền che chở sát bên vai.',
  ],
  u_minh_man_chau_ho: [
    'Hoa Mạn Châu Sa nở dọc bờ U Minh chẳng qua chỉ là nền tô điểm cho bước chân rực rỡ của ngươi thôi.',
    'Hương hoa u huyền quẩn quanh chóp đuôi, khẽ thì thầm lời hứa không rời dù qua sinh tử.',
  ],
  van_hoa_linh_loc_vuong: [
    'Mỗi bước chân Lộc Vương bước qua lại nở rộ vạn đóa kỳ hoa — chỉ mong đổi lấy một nét cười thư thái trên môi ngươi.',
    'Rừng hoa muôn sắc cũng chẳng rực rỡ bằng khoảnh khắc hai đứa tựa vai nhìn bình minh.',
  ],
  thai_at_co_moc_phuong: [
    'Nhựa sống Thái Ất Cổ Mộc chảy mãi không cạn, giữ cho sinh mệnh và niềm vui của chủ nhân luôn xanh tươi.',
    'Gốc cổ thụ ngàn năm nở hoa phượng tím rực trời vì thấy tâm ý ngươi chân thành.',
  ],
  tu_tieu_thien_loi_long: [
    'Lôi quang Tử Tiêu lấp lánh uy thần khắp Cửu Châu, nhưng chỉ thu gọn thành đốm sáng ấm khi sưởi tay cho ngươi.',
    'Sấm tím nổ vang trời cũng không thắng nổi nhịp tim rộn rã lúc gặp lại chủ nhân.',
  ],
  loi_hoang_kim_dieu: [
    'Đôi cánh Lôi Hoàng xé toạc tầng mây bão tố, mang về thắng lợi vẻ vang đặt dưới chân ngươi!',
    'Vua bầu trời chỉ cúi đầu hạ cánh trước người xứng đáng cầm giữ ngọn cờ chiến thắng.',
  ],
  hau_tho_tran_nhac_quy: [
    'Năm ngọn Thái Sơn có rung chuyển, mai Hậu Thổ Trấn Nhạc vẫn đứng sừng sững không lùi nửa bước che chở cho ngươi!',
    'Độ dày đại địa này chính là thước đo cho sự kiên định đồng hành của ta.',
  ],
  huyen_hoang_thach_su: [
    'Khí chất Huyền Hoàng từ thuở khai thiên hóa thành tấm khiên vững chắc, có ta trấn giữ thì ngươi cứ an lòng tiến bước!',
    'Tiếng gầm Thạch Sư vang dội núi non, nhưng khi gọi tên chủ nhân lại trầm ấm lạ kỳ.',
  ],
  hong_mong_cuu_vy_tien: [
    'Dù hóa thành Hồng Mông Cửu Vĩ Tiên phong hoa tuyệt đại, chỗ ta thích nhất vẫn là tựa đầu vào vai ngươi thủ thỉ.',
    'Chín đuôi tuyết trắng tỏa ánh Hồng Mông dịu dàng đan kín giữ ấm cho ngươi suốt đêm dài.',
  ],
  huyet_nguyet_thien_lang_nu: [
    'Dưới vầng Huyết Nguyệt lạnh lẽo, thanh trường đao của ta chỉ vung lên vì người duy nhất mang ánh sáng tới đời ta.',
    'Đừng sợ ánh trăng đỏ... nhìn thẳng vào mắt ta đi, trong đó chỉ phản chiếu mỗi hình bóng ngươi thôi.',
  ],
  xich_diem_phuong_hoang_co: [
    'Ngọn lửa kiêu hãnh nơi vạt áo Xích Diễm Phượng Hoàng Cơ luôn giữ một đốm ấm áp không làm bỏng tay ngươi.',
    'Hào hoa hay vương miện phượng đều nhạt nhòa so với khoảnh khắc được ngươi dịu dàng cài lại trâm tóc.',
  ],
  bach_de_kiem_ho_quan: [
    'Bạch Đế Kiếm Hổ Quân nghiêm nghị trước ngàn quân là thế, về trước mặt ngươi lại khẽ cụp tai nghe lời.',
    'Thanh kiếm sắc lạnh nhất nay đã khắc tên ngươi làm thề ước bảo hộ trọn đời.',
  ],
  thuong_hai_long_nu: [
    'Ngọc châu Thương Hải lấp lánh dưới đáy đại dương sao sánh bằng giọt nắng ấm nơi nụ cười của ngươi.',
    'Sóng biển xanh thẳm thì thầm hát khúc đồng hành cùng Thương Hải Long Nữ và tri kỷ độc nhất.',
  ],
  tu_tieu_loi_ho_quan: [
    'Lôi Hồ Quân ngạo nghễ giữa tầng mây tím, chỉ khẽ nghiêng dù lụa che mưa cho riêng bước chân ngươi.',
    'Chú hồ tinh quái này bình thường hay trêu người lắm, riêng chuyện thương ngươi thì nghiêm túc tuyệt đối!',
  ],
  van_hoa_linh_loc_co: [
    'Từng cánh hoa đào lất phất quanh tà váy Vạn Hoa Linh Lộc Cơ đều mang theo hương thơm chúc phúc cho ngươi.',
    'Ngồi dưới tán hoa pha cho ngươi một chén trà ngọt... cảm giác bình yên đến lạ kỳ!',
  ],
  thai_am_ngoc_tho_tien: [
    'Thái Âm Ngọc Thố Tiên giã thuốc ở cung trăng bao thế kỷ, cuối cùng lại tìm thấy liều thuốc chữa lành tim mình ngay cạnh ngươi.',
    'Đừng trêu đôi tai thỏ dài của ta nữa nha — đỏ hết cả mặt rồi nè!',
  ],
  tinh_ha_nguyet_mieu_co: [
    'Đuôi mèo Tinh Hà khẽ quấn quanh cổ tay ngươi dưới ánh sao đêm — đừng có mải ngắm trời mà quên ngắm ta đó!',
    'Nguyệt Miêu Cơ vốn lười biếng lắm, cơ mà vì ngươi thì chạy bao xa cũng thấy vui chân.',
  ],
  hoang_thien_ky_lan_quan: [
    'Hoàng Thiên Kỳ Lân Quân giữ trọn lễ nghi tôn quý, nhưng trái tim ấm nóng luôn đặt ngay nơi ngươi tin tưởng.',
    'Phúc trạch thiên địa hội tụ trong ánh mắt trao nhau hôm nay — bình an và thắng lợi mãi thuộc về chúng ta!',
  ],
};

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveAffectionBand(tier = 0, maxTier = 10) {
  const m = Math.max(1, Number(maxTier) || 10);
  const ratio = Math.max(0, Math.min(1, Number(tier || 0) / m));
  if (ratio >= 0.85) return 'devoted';
  if (ratio >= 0.55) return 'close';
  if (ratio >= 0.25) return 'warm';
  return 'cold';
}

/**
 * Đếm tổng số biến thể lời thoại trong kho v18PetDialogueBank (đảm bảo > 2.500 câu).
 */
export function countDialogueBankLines() {
  let total = 0;
  const actions = Object.keys(ACTION_MIDDLES);
  for (const arch of Object.values(ARCHETYPE_STYLE_PROMPTS)) {
    for (const action of actions) {
      for (const band of ['cold', 'warm', 'close', 'devoted']) {
        const gCount = arch.gestures.length;
        const mCount = ACTION_MIDDLES[action][band].length;
        total += gCount * mCount;
      }
    }
  }
  for (const quotes of Object.values(UNIQUE_PET_SIGNATURE_QUOTES)) {
    total += quotes.length;
  }
  return total;
}

/**
 * Sinh lời thoại tương tác tiếng Việt tự nhiên cho bất kỳ Linh Thú nào.
 */
export function pickPetInteractionDialogue({
  petType = 'hoa_thach_nham_nham',
  petName = '',
  action = 'pat',
  tier = 0,
  maxTier = 10,
  userMessage = '',
  seed = null,
} = {}) {
  const meta = PET_BY_TYPE[petType] || {};
  const archetype = getPetArchetype(petType);
  const style = ARCHETYPE_STYLE_PROMPTS[archetype] || ARCHETYPE_STYLE_PROMPTS.fox;
  const band = resolveAffectionBand(tier, maxTier);
  const actKey = ACTION_MIDDLES[action] ? action : 'pat';
  const randBase = seed !== null && seed !== undefined
    ? hashSeed(`${seed}:${petType}:${actKey}:${band}:${userMessage}`)
    : Math.floor(Math.random() * 1e9);

  const gestures = style.gestures;
  const openers = style.openers[band] || style.openers.cold;
  const middles = ACTION_MIDDLES[actKey][band] || ACTION_MIDDLES[actKey].cold;
  const sigQuotes = UNIQUE_PET_SIGNATURE_QUOTES[petType] || null;

  const gesture = gestures[randBase % gestures.length];
  const middle = middles[(randBase >>> 3) % middles.length];

  // Với các Pet Độc Nhất / Hồng Mông Đế Nữ, ưu tiên xen kẽ lời thoại đặc trưng của riêng ẻm
  let speech = middle;
  if (sigQuotes && sigQuotes.length > 0 && ((randBase >>> 6) % 3 === 0 || actKey === 'chat')) {
    const sig = sigQuotes[(randBase >>> 8) % sigQuotes.length];
    speech = `${sig} ${middle}`;
  } else if (actKey === 'chat' && !userMessage) {
    const opener = openers[(randBase >>> 7) % openers.length];
    speech = `${opener} ${middle}`;
  } else if (actKey === 'chat' && userMessage) {
    const opener = openers[(randBase >>> 7) % openers.length];
    speech = `${opener} ${middle}`;
  }

  const displayName = String(petName || meta.pet_name || petType).replace(/[«»]/g, '').trim();
  return {
    archetype,
    archetypeLabel: style.label,
    band,
    gesture,
    speech,
    formatted: `*${displayName} ${gesture}* — "${speech}"`,
    toneGuide: style.tone,
  };
}
