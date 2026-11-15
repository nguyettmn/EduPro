// Subject lists per grade (Khối 1–12) for the AI authoring test slice.
// Test data only: the teacher's pre-selected grades/subjects in profile
// settings will replace this when settings are built. Teachers can always
// type a custom subject, so an incomplete list never blocks composing.

export const GRADES: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const SUBJECTS_BY_GRADE: Record<number, string[]> = {
  1: ['Tiếng Việt', 'Toán', 'Đạo đức', 'Tự nhiên và Xã hội', 'Tiếng Anh', 'Giáo dục thể chất', 'Âm nhạc', 'Mĩ thuật', 'Hoạt động trải nghiệm'],
  2: ['Tiếng Việt', 'Toán', 'Đạo đức', 'Tự nhiên và Xã hội', 'Tiếng Anh', 'Giáo dục thể chất', 'Âm nhạc', 'Mĩ thuật', 'Hoạt động trải nghiệm'],
  3: ['Tiếng Việt', 'Toán', 'Đạo đức', 'Tự nhiên và Xã hội', 'Lịch sử và Địa lí', 'Khoa học', 'Tin học', 'Công nghệ', 'Tiếng Anh', 'Giáo dục thể chất', 'Âm nhạc', 'Mĩ thuật', 'Hoạt động trải nghiệm'],
  4: ['Tiếng Việt', 'Toán', 'Đạo đức', 'Khoa học', 'Lịch sử và Địa lí', 'Tin học', 'Công nghệ', 'Tiếng Anh', 'Giáo dục thể chất', 'Âm nhạc', 'Mĩ thuật', 'Hoạt động trải nghiệm'],
  5: ['Tiếng Việt', 'Toán', 'Đạo đức', 'Khoa học', 'Lịch sử và Địa lí', 'Tin học', 'Công nghệ', 'Tiếng Anh', 'Giáo dục thể chất', 'Âm nhạc', 'Mĩ thuật', 'Hoạt động trải nghiệm'],
  6: ['Ngữ văn', 'Toán', 'Tiếng Anh', 'Khoa học tự nhiên', 'Lịch sử và Địa lí', 'Giáo dục công dân', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm'],
  7: ['Ngữ văn', 'Toán', 'Tiếng Anh', 'Khoa học tự nhiên', 'Lịch sử và Địa lí', 'Giáo dục công dân', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm'],
  8: ['Ngữ văn', 'Toán', 'Tiếng Anh', 'Khoa học tự nhiên', 'Lịch sử và Địa lí', 'Giáo dục công dân', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm'],
  9: ['Ngữ văn', 'Toán', 'Tiếng Anh', 'Khoa học tự nhiên', 'Lịch sử và Địa lí', 'Giáo dục công dân', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm'],
  10: ['Ngữ văn', 'Toán', 'Tiếng Anh', 'Vật lí', 'Hoá học', 'Sinh học', 'Lịch sử', 'Địa lí', 'Giáo dục kinh tế và pháp luật', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm'],
  11: ['Ngữ văn', 'Toán', 'Tiếng Anh', 'Vật lí', 'Hoá học', 'Sinh học', 'Lịch sử', 'Địa lí', 'Giáo dục kinh tế và pháp luật', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm'],
  12: ['Ngữ văn', 'Toán', 'Tiếng Anh', 'Vật lí', 'Hoá học', 'Sinh học', 'Lịch sử', 'Địa lí', 'Giáo dục kinh tế và pháp luật', 'Tin học', 'Công nghệ', 'Giáo dục thể chất', 'Nghệ thuật', 'Hoạt động trải nghiệm'],
};

/** Default role sentence, pre-filled from the chosen grade + subject. */
export function roleSentenceFor(grade: number, subject: string): string {
  return `Bạn là giáo viên lớp ${grade} dạy môn ${subject.toLowerCase()} với nhiều năm kinh nghiệm.`;
}
