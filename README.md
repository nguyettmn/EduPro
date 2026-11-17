# EduPro — Khung giao diện

Khung giao diện EduPro: một app duy nhất, bốn vai trò, dữ liệu thật chạy
trên Supabase (Postgres + Auth + phân quyền theo hàng). Đăng nhập thật
bằng email/mật khẩu; mọi thay đổi được lưu vào cơ sở dữ liệu và đồng bộ
giữa các lần đăng nhập. Có hai serverless function: `api/ai-soan-bai.ts`
gọi Gemini cho tính năng AI Soạn bài và tạo game, và `api/invite.ts` gửi
email mời thêm người vào lớp/trường — xem các mục bên dưới.

## Chạy

```sh
npm install
npm run dev
```

Mở đường link Vite in ra (thường là `http://localhost:5173`) rồi đăng ký
hoặc đăng nhập bằng email. Chạy local cần file `.env.local` với
`VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` của project Supabase (xem
mục Cấu hình). Không có hai biến này, app chỉ hiện thẻ hướng dẫn cấu hình.

Build bản production:

```sh
npm run build
npm run preview
```

## Vai trò và màu sắc

| Vai trò      | Màu        | Mã màu    |
| ------------ | ---------- | --------- |
| Hiệu trưởng  | Xanh dương | `#1d4ed8` |
| Tổ trưởng    | Xanh ngọc  | `#0f766e` |
| Giáo viên    | Cam        | `#ea580c` |
| Học sinh     | Hồng       | `#be185d` |

Màu vai trò dùng thống nhất ở avatar, nhãn vai trò, thanh đầu trang và trạng
thái đang chọn trong điều hướng.

## Nguyên tắc phân quyền

- Ai quản lý ai thì thấy hết của người đó, trừ nội dung bên trong Tutor Space
  của học sinh. Người quản lý chỉ thấy tóm tắt chung: số buổi luyện, chủ đề
  còn yếu và số game tự tạo (qua RPC `get_tutor_summary`).
- Truy cập nghĩa là xem, copy, giao lại và yêu cầu sửa. Không sửa hoặc xóa
  trực tiếp bản gốc của người khác: muốn sửa thì sửa trên bản sao.
- Chuỗi duyệt Kho chung: giáo viên gửi đề xuất, Tổ trưởng duyệt Kho Tổ, Hiệu
  trưởng duyệt Kho Trường. Đề xuất của học sinh được giáo viên duyệt trước.
  Học sinh chọn ẩn tên hoặc hiện tên cho từng đề xuất.
- Tạo game của học sinh nằm trong Tutor Space, không nằm ở điều hướng chính.
- Mọi quyết định về quyền đều nằm ở `src/permissions.ts`. Component không tự
  kiểm tra vai trò để quyết định quyền.

## Đăng ký, đăng nhập và duyệt tài khoản

- Đăng ký mở: người dùng chọn Hiệu trưởng / Giáo viên / Học sinh. Hiệu
  trưởng đăng ký cho một trường MỚI (đặt tên trường, kích hoạt ngay).
  Giáo viên chọn trường hoặc dạy độc lập (không thuộc trường nào); học
  sinh chọn trường hoặc chưa thuộc trường nào.
- Tài khoản chọn trường bắt đầu ở trạng thái chờ duyệt, nhưng vẫn dùng
  được phần riêng tư: giáo viên soạn bài, tạo game, tạo lớp riêng; học
  sinh dùng Tutor Space. Hiệu trưởng duyệt trong mục Quản lý; học sinh
  được xếp vào lớp thì tự động kích hoạt.
- Tổ trưởng không có ở bước đăng ký: Hiệu trưởng đặt một giáo viên làm Tổ
  trưởng trong mục Quản lý (kèm chọn tổ).
- Thêm người bằng email: giáo viên thêm học sinh vào lớp, hiệu trưởng
  thêm giáo viên vào trường. Người chưa có tài khoản nhận email mời đặt
  mật khẩu; người đã có tài khoản thì vào lớp/trường ngay. Luồng này chạy
  qua `api/invite.ts` (dùng service-role key phía máy chủ).
- Schema, luật phân quyền theo hàng (RLS) và trigger tạo hồ sơ nằm trong
  `supabase/migrations/0001_init.sql` và `0002_registration_approval.sql`
  (chạy theo đúng thứ tự trong SQL Editor của Supabase).

Không có vai trò Admin: người sửa mã nguồn chính là người quản trị hệ
thống, nên các việc hệ thống (thêm trường, tạo tài khoản Hiệu trưởng)
làm trực tiếp trên mã nguồn / cơ sở dữ liệu.

## Điều hướng (theo quy trình làm việc)

- Giáo viên: Trang chính (“Hôm nay”), Lớp học, Soạn bài, Kho bài chuẩn,
  Kho chung, Trong phạm vi quản lý, Hồ sơ. Trang chính liệt kê mọi việc
  cần xử lý, mỗi việc đều bấm vào được. Lớp học là nơi tạo lớp mới, thêm
  học sinh bằng email, xem học sinh, bài giao và chấm bài kèm đáp án của
  học sinh. Soạn bài là một không gian duy nhất: Bài của tôi (xếp theo
  khối → môn → Topic, dạng thu gọn/mở), Soạn bài mới (AI), Lên chương
  trình (soạn hàng loạt); giao bài ngay từ bài học, cho cả lớp hoặc từng
  học sinh, và từ cuối trang xem nội dung bài. Kho bài chuẩn là nội dung
  chuẩn theo chương trình BGD và chợ công khai; Trong phạm vi quản lý cho
  xem và copy bản sao của người mình quản lý. Hồ sơ giữ hồ sơ giảng dạy
  (khối và môn dạy, chọn trước để khỏi chọn lại mỗi lần soạn bài bằng AI).
- Tổ trưởng, Hiệu trưởng: thêm mục Quản lý.
- Học sinh: Trang chính, Space (tên lớp học của em, em tự đổi tên riêng),
  Tutor Space, Hồ sơ. Bài giao nằm trong Space; bài giao riêng chỉ hiện
  với học sinh được giao.

## Nội dung mẫu: Kho bài chuẩn — Toán 5 – Phân số

Năm bài học, tám chủ đề (A đến H), 59 câu hỏi, nằm ở nhánh “Theo chương
trình BGD” của Kho bài chuẩn (chọn Khối 5 · Toán). Mọi đáp án đều được tính
bằng máy trong lúc tạo ngân hàng câu hỏi, không gõ tay. Phân số luôn hiển thị
dạng xếp chồng (tử số ở trên, mẫu số ở dưới), không bao giờ viết dạng gạch
chéo trong giao diện. Nhánh “Kho user nộp lên” là chợ công khai mẫu: vài bài
đăng mẫu (miễn phí và có phí, bài soạn cùng AI được ghi rõ); bản demo chưa có
thanh toán và đăng bán.

## AI Soạn bài (bản test)

Tab “Soạn bài mới (AI)” trong Soạn bài: giáo viên chọn khối và môn, nhập chủ
đề/dàn ý/yêu cầu thêm, đính kèm ảnh, PDF, DOCX hoặc TXT — Gemini soạn thành
một file HTML tương tác duy nhất. Giáo viên xem trước trong iframe sandbox,
chat với AI để sửa (mỗi lần sửa soạn lại toàn bộ file, có lưu các bản), rồi
bấm Chốt để lưu vào “Bài của tôi” và giao cho lớp hoặc từng học sinh như bài
thường. Bài HTML hiển thị trong iframe sandbox (`allow-scripts`, không có
quyền same-origin) và không bao giờ được chèn trực tiếp vào DOM của app.

Prompt gồm hai lớp: lớp chất lượng cố định (hợp đồng output, quy tắc
không-game, quy tắc hiển thị theo môn, quy tắc đúng) + dàn ý/tài liệu của
giáo viên là nguồn sự thật duy nhất. Code lắp prompt nằm TRONG file function
`api/ai-soan-bai.ts` (file function phải tự chứa toàn bộ, không import file
nội bộ khác — xem chú thích ở đầu file). File `src/ai/prompt.ts` còn sót lại
là bản chết, không được dùng.

Tab “Lên chương trình”: tải đề cương/tài liệu lên, AI phân tích và chỉ gợi ý
TÊN các bài theo thứ tự dạy; giáo viên giữ/bỏ/thêm tay, bấm vào từng bài để
sang bước soạn. Gom theo Topic làm trong “Bài của tôi”, không làm ở bước này.

Bài tập: từ một bài HTML, giáo viên bấm “Tạo bài tập” để AI đọc nội dung bài
và ra câu hỏi trắc nghiệm/trả lời ngắn dạng dữ liệu có cấu trúc; giáo viên
duyệt và sửa từng câu trước khi lưu. Học sinh mở bài được giao sẽ làm bài tập
để tự luyện (chấm ngay từng câu, chưa tính điểm nộp bài).

Xuất/Nhập: bài HTML tải về là một file duy nhất có kèm JSON nguồn bên trong
(nhúng trong thẻ script), mở được trong mọi trình duyệt và tải lên lại để
tiếp tục làm việc; “Xuất JSON Môn” tải toàn bộ bài của một khối · môn ra một
file JSON, “Nhập file bài học” nhận cả hai loại file. File HTML nhập vào chỉ
hiển thị trong iframe sandbox, và file chứa script tải từ bên ngoài sẽ bị từ
chối.

## Tạo game bằng AI (bản test)

Mỗi bài học đều có mục “Trò chơi” ở cuối bài (cả bài thường lẫn bài HTML),
và Tutor Space của học sinh cũng có mục game riêng. Một bài có thể có nhiều
game. Giáo viên bấm “Tạo game bằng AI” để mở studio tạo game: chọn khối/môn,
chủ đề, loại game (Snake, Pac-Man, Runner, Defender, Adventure, hoặc để AI
đề xuất — chọn loại là có sẵn bộ luật mẫu + cách tính điểm), theme, nguồn
câu hỏi (nội dung bài học, dàn ý, tài liệu). AI đề xuất “Thẻ game” (luật,
điểm, kế hoạch câu hỏi) để duyệt trước, rồi sinh game thành một file HTML
duy nhất, tự chứa hoàn toàn. Sửa game bằng chat theo 5 chế độ (chỉnh số, đổi
theme, đổi luật, câu hỏi mới, làm lại) — AI chỉ đổi đúng phần đó. Game đã
lưu có nút Sửa để mở lại trong studio.

Game cũng tải lên được: file JSON dạng bản ghi cũ (`{id, title, mechanic,
theme, htmlCode, createdAt}` hoặc `{lessonId, htmlCode}`) hoặc file HTML
thô. File game cũ dùng Tailwind CDN + Google Fonts vẫn chơi được (kèm cảnh
báo cần mạng); script ngoài khác đều bị từ chối.

Game chơi trong iframe sandbox và báo kết quả về app qua giao thức
`EDUPRO_GAME_RESULT` (postMessage): điểm, sao, đúng/sai theo từng kỹ năng.
Kết quả cập nhật chủ đề yếu theo cùng luật với nộp bài, và hiện tóm tắt
dưới khung chơi. Mọi lượt chơi đều gieo hạt bằng mã thử thách (seed) nên
cùng một mã thì lượt chơi giống hệt nhau — thi đấu công bằng.

Prompt tạo game cũng hai lớp và đa môn (toán sinh câu hỏi bằng code, môn
khác dùng ngân hàng câu hỏi liệt kê đủ trong Thẻ game để duyệt). Các stage
`game-propose` (JSON), `game-generate` và `game-revise` (SSE) nằm chung
trong `api/ai-soan-bai.ts`, kèm kiểm tra hợp đồng output (game bắt buộc
phải gửi `EDUPRO_GAME_RESULT`).

Cấu hình (Vercel → project → Settings → Environment Variables, rồi deploy
lại):

- `VITE_SUPABASE_URL` — địa chỉ project Supabase (dạng
  `https://<project-id>.supabase.co`).
- `VITE_SUPABASE_ANON_KEY` — key công khai (Publishable key) của project.
- `SUPABASE_SERVICE_ROLE_KEY` — key bí mật (Secret key), chỉ dùng phía máy
  chủ cho `api/invite.ts`. Không bao giờ để lộ ra trình duyệt.
- `GEMINI_API_KEY` — bắt buộc cho AI Soạn bài và tạo game. Lấy tại Google AI Studio. Key chỉ nằm phía
  máy chủ, trình duyệt không bao giờ thấy key.
- `GEMINI_MODEL` — không bắt buộc. Mặc định `gemini-3.1-pro-preview`.

Function AI kiểm tra JWT của người dùng đã đăng nhập trước khi gọi Gemini;
trình duyệt gửi token kèm mỗi request. Trong Supabase, giữ “Allow new
users” BẬT (đăng ký mở), đặt Site URL thành địa chỉ app (để link mời và
đặt lại mật khẩu quay về đúng app), và tắt “Confirm email” nếu muốn đăng
ký xong vào được ngay trong giai đoạn thử nghiệm.

Giới hạn của bản test: file đính kèm tối đa 3MB mỗi file và 3MB tổng cộng;
một lần soạn tối đa 5 phút (giới hạn của Vercel Hobby); bài HTML chưa chấm
điểm và chưa gửi lên Kho chung được; bài tập từ bài HTML chỉ để tự luyện,
chưa tính vào điểm nộp bài.

## Cấu trúc code

```text
api/
  ai-soan-bai.ts      Vercel function tự chứa toàn bộ: kiểm tra JWT, lắp
                      prompt hai lớp, gọi Gemini (SSE cho soạn bài và tạo
                      game, JSON cho lên chương trình, tạo bài tập và Thẻ
                      game), trích văn bản DOCX/TXT, kiểm tra hợp đồng
                      output; không import file nội bộ
  invite.ts           Vercel function tự chứa toàn bộ: kiểm tra JWT + quyền,
                      tìm-hoặc-mời tài khoản qua email (Admin API), xếp vào
                      lớp; dùng service-role key phía máy chủ
supabase/
  migrations/         0001_init.sql (schema + RLS + seed), 0002_registration_
                      approval.sql (đăng ký mở + duyệt + giáo viên độc lập)
src/
  types.ts            Kiểu dữ liệu chung
  permissions.ts      Bảng quyền trung tâm + hàm xác định phạm vi
  answers.ts          Chấm đáp án (dùng chung cho quiz, game và dữ liệu mẫu)
  tutorEngine.ts      Gia sư demo trả lời theo gợi ý có sẵn, không dùng AI thật
  supabase/
    client.ts         Supabase client + kiểm tra biến môi trường
    mapping.ts        Chuyển đổi giữa hàng DB và kiểu dữ liệu của app
    load.ts           Tải toàn bộ trạng thái nhìn thấy được (RLS phân phạm vi)
    persist.ts        Ghi lại từng thay đổi vào Supabase, theo hàng đợi FIFO
  ai/
    subjects.ts       Danh sách môn theo khối + câu vai trò mặc định
    apiTypes.ts       Kiểu dữ liệu gửi tới /api/ai-soan-bai (bản sao trong
                      function phải giữ đồng bộ với file này)
    client.ts         Client gọi API AI (đọc luồng SSE + gọi JSON, kèm JWT)
    lessonFile.ts     Xuất/nhập file bài học: HTML kèm JSON nguồn, JSON Môn
    gameFile.ts       Xuất/nhập file game: JSON bản ghi cũ hoặc HTML thô
  data/
    questions.ts      Ngân hàng câu hỏi (được tạo ra, đáp án đã tính sẵn)
    sampleGame.ts     Game HTML mẫu (giữ lại để tham khảo; không còn seed sẵn)
    seed.ts           Pack Toán 5 – Phân số, trường/tổ mẫu (nội dung tĩnh)
  state/store.tsx     Context + reducer + cổng auth + hàng đợi ghi Supabase
  components/         Giao diện theo từng màn hình và từng khối chức năng
  App.tsx             Cổng đăng nhập thật, khung app và điều hướng theo trạng thái
  styles.css          Hệ thống thiết kế, CSS thuần, không thư viện giao diện
```

## Giới hạn đã biết của khung này

- Studio Soạn bài là bản khung đơn giản: sửa tiêu đề và các bước trên bản
  sao, thêm, xóa và sắp xếp lại các phần. Bản thiết kế lại đầy đủ sẽ đến sau.
- Chat AI trong Tutor Space trả lời bằng gợi ý có sẵn theo từ khóa, không gọi
  API nào. Với bài được giao, gia sư chỉ gợi ý, không cho đáp án trực tiếp.
- Game hiện có hai dạng: đố nhanh tính giờ từ ngân hàng câu hỏi (khung cũ),
  và game HTML một file (AI tạo hoặc tải lên) gắn vào bài học hoặc Tutor
  Space. Game HTML chưa gửi lên Kho chung được trong bản test.
- Bài HTML do AI soạn chưa chấm điểm và chưa gửi lên Kho chung được trong
  bản test.
