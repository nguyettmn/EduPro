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

- Giáo viên: Trang chính (“Hôm nay”), Lớp học, Soạn bài, Kho chung, Hồ
  sơ. Trang chính liệt kê mọi việc cần xử lý, mỗi việc đều bấm vào được.
  Lớp học là nơi tạo lớp mới, thêm học sinh bằng email, xem học sinh, bài
  giao và chấm bài kèm đáp án của học sinh. Soạn bài là một không gian
  duy nhất: bài của tôi, Pack, và bài trong phạm vi quản lý; giao bài ngay
  từ bài học, cho cả lớp hoặc từng học sinh. Hồ sơ giữ hồ sơ giảng dạy
  (khối và môn dạy, chọn trước để khỏi chọn lại mỗi lần soạn bài bằng AI).
- Tổ trưởng, Hiệu trưởng, Admin: thêm mục Quản lý.
- Học sinh: Trang chính, Space (tên lớp học của em, em tự đổi tên riêng),
  Tutor Space, Hồ sơ. Bài giao nằm trong Space; bài giao riêng chỉ hiện
  với học sinh được giao.

## Nội dung mẫu: Pack Toán 5 – Phân số

Năm bài học, tám chủ đề (A đến H), 59 câu hỏi. Mọi đáp án đều được tính bằng
máy trong lúc tạo ngân hàng câu hỏi, không gõ tay. Phân số luôn hiển thị
dạng xếp chồng (tử số ở trên, mẫu số ở dưới), không bao giờ viết dạng gạch
chéo trong giao diện.

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
giáo viên là nguồn sự thật duy nhất. Code lắp prompt nằm ở `src/ai/prompt.ts`
và được dùng chung bởi function và giao diện.

Cấu hình (Vercel → project → Settings → Environment Variables, rồi deploy
lại):

- `GEMINI_API_KEY` — bắt buộc. Lấy tại Google AI Studio. Key chỉ nằm phía
  máy chủ, trình duyệt không bao giờ thấy key.
- `GEMINI_MODEL` — không bắt buộc. Mặc định `gemini-3.1-pro-preview`.

Giới hạn của bản test: file đính kèm tối đa 3MB mỗi file và 3MB tổng cộng;
một lần soạn tối đa 5 phút (giới hạn của Vercel Hobby); bài HTML chưa chấm
điểm và chưa gửi lên Kho chung được; chưa có soạn hàng loạt theo chương trình
và chưa có cài đặt khối/môn chọn sẵn trong hồ sơ giáo viên.

## Cấu trúc code

```text
api/
  ai-soan-bai.ts      Vercel function: gọi Gemini, trích văn bản DOCX/TXT,
                      kiểm tra hợp đồng output, trả về theo luồng SSE
src/
  types.ts            Kiểu dữ liệu chung
  permissions.ts      Bảng quyền trung tâm + hàm xác định phạm vi
  answers.ts          Chấm đáp án (dùng chung cho quiz, game và dữ liệu mẫu)
  tutorEngine.ts      Gia sư demo trả lời theo gợi ý có sẵn, không dùng AI thật
  ai/
    prompt.ts         Lắp prompt hai lớp (dùng chung client + function)
    subjects.ts       Danh sách môn theo khối + câu vai trò mặc định
    apiTypes.ts       Kiểu dữ liệu gửi tới /api/ai-soan-bai
    client.ts         Client gọi API AI (đọc luồng SSE)
  data/
    questions.ts      Ngân hàng câu hỏi (được tạo ra, đáp án đã tính sẵn)
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
- Game hiện có một cơ chế chơi được: đố nhanh tính giờ, từ ngân hàng câu hỏi.
- Bài HTML do AI soạn chưa chấm điểm và chưa gửi lên Kho chung được trong
  bản test.
