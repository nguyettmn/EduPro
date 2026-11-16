# EduPro — Khung giao diện (bản demo)

Khung giao diện EduPro: một app duy nhất, năm vai trò, dữ liệu giả chạy hoàn
toàn trên trình duyệt. **Chưa có cơ sở dữ liệu, chưa có đăng nhập thật.**
Mọi thay đổi sẽ mất khi tải lại trang. Có một serverless function duy nhất
(`api/ai-soan-bai.ts`) gọi Gemini cho tính năng AI Soạn bài — xem mục AI Soạn
bài bên dưới.

## Chạy

```sh
npm install
npm run dev
```

Mở đường link Vite in ra (thường là `http://localhost:5173`), chọn một tài
khoản mẫu để vào. Dùng mục “Đổi vai nhanh” trên thanh đầu trang để thử các
vai khác mà không cần thoát.

Build bản production:

```sh
npm run build
npm run preview
```

## Vai trò và màu sắc

| Vai trò      | Màu        | Mã màu    |
| ------------ | ---------- | --------- |
| Admin        | Tím        | `#6d28d9` |
| Hiệu trưởng  | Xanh dương | `#1d4ed8` |
| Tổ trưởng    | Xanh ngọc  | `#0f766e` |
| Giáo viên    | Cam        | `#ea580c` |
| Học sinh     | Hồng       | `#be185d` |

Màu vai trò dùng thống nhất ở avatar, nhãn vai trò, thanh đầu trang và trạng
thái đang chọn trong điều hướng.

## Nguyên tắc phân quyền (bản demo)

- Ai quản lý ai thì thấy hết của người đó, trừ nội dung bên trong Tutor Space
  của học sinh. Người quản lý chỉ thấy tóm tắt chung: số buổi luyện và chủ đề
  còn yếu.
- Truy cập nghĩa là xem, copy, giao lại và yêu cầu sửa. Không sửa hoặc xóa
  trực tiếp bản gốc của người khác: muốn sửa thì sửa trên bản sao.
- Chuỗi duyệt Kho chung: giáo viên gửi đề xuất, Tổ trưởng duyệt Kho Tổ, Hiệu
  trưởng duyệt Kho Trường. Đề xuất của học sinh được giáo viên duyệt trước.
  Học sinh chọn ẩn tên hoặc hiện tên cho từng đề xuất.
- Tạo game của học sinh nằm trong Tutor Space, không nằm ở điều hướng chính.
- Mọi quyết định về quyền đều nằm ở `src/permissions.ts`. Component không tự
  kiểm tra vai trò để quyết định quyền.

## Tài khoản mẫu

- Admin: Quản trị hệ thống — xem cả hai trường.
- Hiệu trưởng: Cô Hiệu trưởng Lan — Trường Tiểu học An Bình.
- Tổ trưởng: Thầy Tổ trưởng Toán — Tổ Toán 5.
- Giáo viên: Cô Mai (Toán 5, Lớp 5A và Lớp 5B) và Thầy Hùng (Toán 6, Lớp 6B, tổ khác).
- Học sinh Lớp 5A: An, Bình, Chi. Học sinh Lớp 5B: Phương, Tuấn. Học sinh Lớp 6B: Dũng.
- Trường Tiểu học Bình Minh có dữ liệu tối thiểu để Admin thấy quản lý nhiều
  trường.

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
- Tổ trưởng, Hiệu trưởng, Admin: thêm mục Quản lý.
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

- `GEMINI_API_KEY` — bắt buộc. Lấy tại Google AI Studio. Key chỉ nằm phía
  máy chủ, trình duyệt không bao giờ thấy key.
- `GEMINI_MODEL` — không bắt buộc. Mặc định `gemini-3.1-pro-preview`.

Giới hạn của bản test: file đính kèm tối đa 3MB mỗi file và 3MB tổng cộng;
một lần soạn tối đa 5 phút (giới hạn của Vercel Hobby); bài HTML chưa chấm
điểm và chưa gửi lên Kho chung được; bài tập từ bài HTML chỉ để tự luyện,
chưa tính vào điểm nộp bài.

## Cấu trúc code

```text
api/
  ai-soan-bai.ts      Vercel function tự chứa toàn bộ: lắp prompt hai lớp,
                      gọi Gemini (SSE cho soạn bài và tạo game, JSON cho
                      lên chương trình, tạo bài tập và Thẻ game), trích
                      văn bản DOCX/TXT, kiểm tra hợp đồng output; không
                      import file nội bộ
src/
  types.ts            Kiểu dữ liệu chung
  permissions.ts      Bảng quyền trung tâm + hàm xác định phạm vi
  answers.ts          Chấm đáp án (dùng chung cho quiz, game và dữ liệu mẫu)
  tutorEngine.ts      Gia sư demo trả lời theo gợi ý có sẵn, không dùng AI thật
  ai/
    subjects.ts       Danh sách môn theo khối + câu vai trò mặc định
    apiTypes.ts       Kiểu dữ liệu gửi tới /api/ai-soan-bai (bản sao trong
                      function phải giữ đồng bộ với file này)
    client.ts         Client gọi API AI (đọc luồng SSE + gọi JSON)
    lessonFile.ts     Xuất/nhập file bài học: HTML kèm JSON nguồn, JSON Môn
    gameFile.ts       Xuất/nhập file game: JSON bản ghi cũ hoặc HTML thô
  data/
    questions.ts      Ngân hàng câu hỏi (được tạo ra, đáp án đã tính sẵn)
    sampleGame.ts     Game HTML mẫu để thử các luồng game không cần API key
    seed.ts           Tài khoản, trường, lớp, bài học, bài giao, đề xuất mẫu
  state/store.tsx     Context + reducer cho toàn bộ trạng thái demo
  components/         Giao diện theo từng màn hình và từng khối chức năng
  App.tsx             Cổng đăng nhập giả, khung app và điều hướng theo trạng thái
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
