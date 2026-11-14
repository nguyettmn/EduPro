// Rule-based demo tutor. No AI API, no network. Replies are canned hints
// matched by keyword. NEVER gives direct answers for graded work: the
// engine has no access to assignment answers, and answer-begging messages
// get a hint-only reply.
export function tutorReply(input: string, studentName: string): string {
  const text = input.toLowerCase();

  const asksAnswer =
    text.includes('đáp án') ||
    text.includes('dapan') ||
    text.includes('làm hộ') ||
    text.includes('giải hộ');
  const gradedContext =
    text.includes('bài giao') ||
    text.includes('kiểm tra') ||
    text.includes('bài tập về nhà') ||
    text.includes('điểm');
  if (asksAnswer && gradedContext) {
    return 'Với bài được giao thì thầy chỉ gợi ý thôi, không cho đáp án trực tiếp đâu. Em nói thầy nghe em đang stuck ở bước nào, thầy sẽ gợi ý đúng bước đó nhé.';
  }
  if (asksAnswer) {
    return 'Thầy không cho đáp án ngay đâu, vì như vậy em sẽ không nhớ lâu. Em thử làm bước đầu tiên rồi gửi cho thầy xem nhé, thầy sẽ kiểm tra cùng em.';
  }
  if (text.includes('rút gọn')) {
    return 'Rút gọn nghĩa là chia cả tử số và mẫu số cho cùng một số. Ví dụ 18 phần 24: số nào chia hết cho cả 18 và 24? Gợi ý: số lớn nhất là 6. Em thử chia cả hai cho 6 xem.';
  }
  if (text.includes('cộng')) {
    return 'Muốn cộng hai phân số, bước đầu tiên là đổi về cùng mẫu số. Ví dụ 1 phần 2 cộng 1 phần 3: mẫu số chung là 6. Em đổi mỗi phân số về mẫu số 6 rồi cộng tử số nhé.';
  }
  if (text.includes('trừ')) {
    return 'Trừ phân số cũng bắt đầu bằng mẫu số chung. Đổi cả hai về cùng mẫu số, trừ tử số, giữ nguyên mẫu số, rồi rút gọn nếu được. Em thử với 3 phần 4 trừ 1 phần 6 nhé.';
  }
  if (text.includes('nhân')) {
    return 'Nhân phân số rất thẳng: nhân tử số với tử số, nhân mẫu số với mẫu số, rồi rút gọn. Ví dụ 3 phần 4 nhân 2 phần 5 bằng 6 phần 20, rút gọn thành 3 phần 10.';
  }
  if (text.includes('chia')) {
    return 'Chia phân số có 3 bước: giữ nguyên phân số đầu, đổi thành nhân, đảo ngược phân số sau. Ví dụ 3 phần 4 chia 2 phần 5 thành 3 phần 4 nhân 5 phần 2. Em thử tính tiếp nhé.';
  }
  if (text.includes('thập phân')) {
    return 'Đổi phân số thành số thập phân có 2 cách. Cách 1: đổi về mẫu số 10 hoặc 100, ví dụ 2 phần 25 bằng 8 phần 100 bằng 0.08. Cách 2: chia dài, ví dụ 3 chia 8 bằng 0.375. Em muốn luyện cách nào?';
  }
  if (text.includes('hỗn số')) {
    return 'Đổi phân số thành hỗn số bằng phép chia: 11 chia 4 bằng 2 dư 3, nên 11 phần 4 bằng hỗn số 2 và 3 phần 4. Ngược lại: 2 nhân 4 cộng 3 bằng 11.';
  }
  if (text.includes('mẫu số')) {
    return 'Mẫu số là số ở dưới, cho biết một cái bánh được chia thành bao nhiêu phần bằng nhau. Khi cộng hoặc trừ, mẫu số phải giống nhau trước đã.';
  }
  if (text.includes('tử số')) {
    return 'Tử số là số ở trên, cho biết em có bao nhiêu phần. Khi cộng hoặc trừ, chỉ cộng hoặc trừ tử số thôi, mẫu số giữ nguyên nhé.';
  }
  if (text.includes('game')) {
    return 'Em vào tab Tạo game trong Tutor Space này nhé. Chọn chủ đề và giao diện, game sẽ tạo từ ngân hàng câu hỏi, chơi xong còn có thể đề xuất lên Kho chung nữa.';
  }
  if (text.includes('chào') || text.includes('hello') || text.includes('hi')) {
    return `Chào ${studentName}! Em muốn hỏi về rút gọn, cộng trừ, nhân chia, hay số thập phân? Cứ hỏi thoải mái nhé.`;
  }
  if (text.includes('khó') || text.includes('không hiểu') || text.includes('không biết')) {
    return 'Không sao đâu, mình đi từng bước nhỏ nhé. Em cho thầy biết em đang học chủ đề nào: rút gọn, hỗn số, cộng trừ, nhân, chia, hay số thập phân?';
  }
  return 'Thầy gợi ý theo từng bước nhé. Em đang cần giúp chủ đề nào: rút gọn, hỗn số, cộng và trừ, nhân, chia, hay số thập phân? Em cũng có thể vào tab Tự luyện để làm thử vài câu.';
}
