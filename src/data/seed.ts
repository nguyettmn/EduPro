// Mock data for EduPro frame v1. All demo state lives here and is copied
// into the store on load; "reset demo" restores exactly this data.
import type {
  Account,
  Assignment,
  ClassGroup,
  GameDef,
  Lesson,
  LessonSection,
  MarketplaceItem,
  Pack,
  Proposal,
  RepoItem,
  School,
  StudentAnswer,
  Submission,
  Team,
  TutorData,
} from '../types';
import { QUESTIONS } from './questions';
import { correctStudentAnswer, scoreAnswers } from '../answers';

const DAY = 86400000;
const iso = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

export const SCHOOLS: School[] = [
  { id: 'S1', name: 'Trường Tiểu học An Bình' },
  { id: 'S2', name: 'Trường Tiểu học Bình Minh' },
];

export const TEAMS: Team[] = [
  { id: 'T1', schoolId: 'S1', name: 'Tổ Toán 5' },
  { id: 'T2', schoolId: 'S1', name: 'Tổ Toán 6' },
  { id: 'T3', schoolId: 'S2', name: 'Tổ Toán' },
];

export const CLASSES: ClassGroup[] = [
  { id: 'C5A', schoolId: 'S1', teamId: 'T1', name: 'Lớp 5A', grade: 5, teacherId: 'u-teacher-a' },
  { id: 'C5B', schoolId: 'S1', teamId: 'T1', name: 'Lớp 5B', grade: 5, teacherId: 'u-teacher-a' },
  { id: 'C6B', schoolId: 'S1', teamId: 'T2', name: 'Lớp 6B', grade: 6, teacherId: 'u-teacher-b' },
  { id: 'C5C', schoolId: 'S2', teamId: 'T3', name: 'Lớp 5C', grade: 5, teacherId: 'u-teacher-s2' },
];

export const ACCOUNTS: Account[] = [
  { id: 'u-admin', name: 'Quản trị hệ thống', role: 'admin', schoolId: null, teamId: null, classIds: [], demoLogin: true, initials: 'AD' },
  { id: 'u-principal', name: 'Cô Hiệu trưởng Lan', role: 'principal', schoolId: 'S1', teamId: null, classIds: [], demoLogin: true, initials: 'HL' },
  { id: 'u-lead', name: 'Thầy Tổ trưởng Toán', role: 'lead', schoolId: 'S1', teamId: 'T1', classIds: [], demoLogin: true, initials: 'TT' },
  { id: 'u-teacher-a', name: 'Cô Mai — Toán 5', role: 'teacher', schoolId: 'S1', teamId: 'T1', classIds: ['C5A', 'C5B'], demoLogin: true, initials: 'CM', teachingProfile: { grades: [5], subjectsByGrade: { '5': ['Toán'] } } },
  { id: 'u-teacher-b', name: 'Thầy Hùng — Toán 6', role: 'teacher', schoolId: 'S1', teamId: 'T2', classIds: ['C6B'], demoLogin: true, initials: 'TH', teachingProfile: { grades: [6], subjectsByGrade: { '6': ['Toán'] } } },
  { id: 'u-an', name: 'An', role: 'student', schoolId: 'S1', teamId: null, classIds: ['C5A'], demoLogin: true, initials: 'AN' },
  { id: 'u-binh', name: 'Bình', role: 'student', schoolId: 'S1', teamId: null, classIds: ['C5A'], demoLogin: true, initials: 'BI' },
  { id: 'u-chi', name: 'Chi', role: 'student', schoolId: 'S1', teamId: null, classIds: ['C5A'], demoLogin: true, initials: 'CH' },
  { id: 'u-phuong', name: 'Phương', role: 'student', schoolId: 'S1', teamId: null, classIds: ['C5B'], demoLogin: true, initials: 'PH' },
  { id: 'u-tuan', name: 'Tuấn', role: 'student', schoolId: 'S1', teamId: null, classIds: ['C5B'], demoLogin: true, initials: 'TU' },
  { id: 'u-dung', name: 'Dũng', role: 'student', schoolId: 'S1', teamId: null, classIds: ['C6B'], demoLogin: true, initials: 'DU' },
  { id: 'u-principal2', name: 'Hiệu trưởng Bình Minh', role: 'principal', schoolId: 'S2', teamId: null, classIds: [], demoLogin: false, initials: 'BM' },
  { id: 'u-teacher-s2', name: 'Cô Thu — Toán 5', role: 'teacher', schoolId: 'S2', teamId: 'T3', classIds: ['C5C'], demoLogin: false, initials: 'CT', teachingProfile: { grades: [5], subjectsByGrade: { '5': ['Toán'] } } },
  { id: 'u-ha', name: 'Hà', role: 'student', schoolId: 'S2', teamId: null, classIds: ['C5C'], demoLogin: false, initials: 'HA' },
  { id: 'u-minh', name: 'Minh', role: 'student', schoolId: 'S2', teamId: null, classIds: ['C5C'], demoLogin: false, initials: 'MI' },
];

// ---------- Pack: Toán 5 – Phân số ----------

export const PACK: Pack = {
  id: 'pack-toan5-phanso',
  title: 'Toán 5 – Phân số',
  grade: 5,
  subject: 'Toán',
  color: '#2563eb',
  topics: [
    { id: 'A', code: 'A', title: 'Rút gọn', color: '#2563eb' },
    { id: 'B', code: 'B', title: 'Hỗn số', color: '#7c3aed' },
    { id: 'C', code: 'C', title: 'Cộng và trừ', color: '#059669' },
    { id: 'D', code: 'D', title: 'Nhân', color: '#d97706' },
    { id: 'E', code: 'E', title: 'Chia', color: '#dc2626' },
    { id: 'F', code: 'F', title: 'Số thập phân', color: '#0891b2' },
    { id: 'G', code: 'G', title: 'Trường hợp đặc biệt', color: '#475569' },
    { id: 'H', code: 'H', title: 'Thử thách', color: '#db2777' },
  ],
  lessonIds: ['L1', 'L2', 'L3', 'L4', 'L5'],
};

const F = (n: number, d: number) => ({ k: 'f' as const, n, d });
const M = (w: number, n: number, d: number) => ({ k: 'm' as const, w, n, d });
const T = (s: string) => ({ k: 't' as const, s });

const L1_SECTIONS: LessonSection[] = [
  {
    id: 'L1S1',
    title: 'Rút gọn phân số',
    example: [
      [F(18, 24), T('='), F(3, 4)],
      [T('18 ÷ 6 = 3')],
      [T('24 ÷ 6 = 4')],
    ],
    steps: [
      'Tìm số lớn nhất chia hết cho cả tử số và mẫu số: 6.',
      'Chia cả tử số và mẫu số cho 6.',
      'Kiểm tra: 3 và 4 không còn chia chung được nữa.',
    ],
    tip: 'Lỗi hay gặp: chỉ chia tử số mà quên chia mẫu số.',
    bar: { filled: 3, total: 4 },
  },
  {
    id: 'L1S2',
    title: 'Hỗn số và phân số',
    example: [
      [F(11, 4), T('='), M(2, 3, 4)],
      [T('11 ÷ 4 = 2 dư 3')],
    ],
    steps: [
      'Chia tử số cho mẫu số: 11 ÷ 4 = 2 dư 3.',
      'Số nguyên là 2, phần phân số là 3 phần 4.',
      'Ngược lại: 2 × 4 + 3 = 11, nên hỗn số bằng phân số 11 phần 4.',
    ],
    tip: 'Hỗn số không có tử số bằng 0.',
  },
];

const L2_SECTIONS: LessonSection[] = [
  {
    id: 'L2S1',
    title: 'Cộng hai phân số',
    example: [
      [F(1, 2), T('='), F(3, 6)],
      [F(1, 3), T('='), F(2, 6)],
      [F(3, 6), T('+'), F(2, 6), T('='), F(5, 6)],
    ],
    steps: [
      'Tìm mẫu số chung: 6.',
      'Đổi mỗi phân số về mẫu số 6.',
      'Cộng tử số, giữ nguyên mẫu số, rồi rút gọn nếu được.',
    ],
    bar: { filled: 5, total: 6 },
  },
  {
    id: 'L2S2',
    title: 'Trừ hai phân số',
    example: [
      [F(3, 4), T('='), F(9, 12)],
      [F(1, 6), T('='), F(2, 12)],
      [F(9, 12), T('−'), F(2, 12), T('='), F(7, 12)],
    ],
    steps: [
      'Tìm mẫu số chung: 12.',
      'Đổi mỗi phân số về mẫu số 12.',
      'Trừ tử số, giữ nguyên mẫu số, rồi rút gọn nếu được.',
    ],
    tip: 'Chỉ cộng và trừ tử số. Không cộng mẫu số.',
  },
];

const L3_SECTIONS: LessonSection[] = [
  {
    id: 'L3S1',
    title: 'Nhân hai phân số',
    example: [
      [F(3, 4), T('×'), F(2, 5), T('='), F(6, 20)],
      [F(6, 20), T('='), F(3, 10)],
    ],
    steps: [
      'Nhân tử số với tử số: 3 × 2 = 6.',
      'Nhân mẫu số với mẫu số: 4 × 5 = 20.',
      'Rút gọn kết quả.',
    ],
  },
  {
    id: 'L3S2',
    title: 'Chia hai phân số',
    example: [
      [F(3, 4), T('÷'), F(2, 5), T('='), F(3, 4), T('×'), F(5, 2)],
      [F(3, 4), T('×'), F(5, 2), T('='), F(15, 8)],
      [F(15, 8), T('='), M(1, 7, 8)],
    ],
    steps: [
      'Giữ nguyên phân số đầu.',
      'Đổi phép chia thành phép nhân.',
      'Đảo ngược phân số sau, rồi nhân như thường.',
    ],
    tip: 'Chỉ đảo ngược phân số sau, không đảo cả hai.',
  },
];

const L4_SECTIONS: LessonSection[] = [
  {
    id: 'L4S1',
    title: 'Định nghĩa trước: mẫu số 10 và 100',
    example: [
      [F(3, 10), T('='), T('0.3')],
      [F(115, 100), T('='), T('1.15')],
      [F(150, 100), T('='), T('1.50')],
    ],
    steps: [
      'Mẫu số 10 nghĩa là 1 chữ số sau dấu chấm.',
      'Mẫu số 100 nghĩa là 2 chữ số sau dấu chấm.',
      'Đọc tử số theo giá trị vị trí.',
    ],
    bar: { filled: 3, total: 10 },
  },
  {
    id: 'L4S2',
    title: 'Cách 1: Đổi về mẫu số 10 hoặc 100',
    example: [
      [F(2, 25), T('='), F(8, 100)],
      [F(8, 100), T('='), T('0.08')],
    ],
    steps: [
      'Tìm số nhân để mẫu số thành 10, 100 hoặc 1000.',
      'Nhân cả tử số và mẫu số với số đó.',
      'Đọc kết quả theo giá trị vị trí.',
    ],
    tip: 'Nhớ nhân cả tử số, không chỉ mẫu số.',
  },
  {
    id: 'L4S3',
    title: 'Cách 2: Chia dài',
    example: [[T('3 ÷ 8 = 0.375')]],
    steps: [
      'Viết 3 thành 3.000 rồi chia cho 8.',
      'Chia từng bước, mỗi bước ghi thương và số dư.',
      'Dừng khi số dư bằng 0.',
    ],
    longDivision: {
      dividend: 3,
      divisor: 8,
      result: '0.375',
      rows: [
        { label: '30 ÷ 8 = 3', detail: '3 × 8 = 24, dư 6, hạ 0' },
        { label: '60 ÷ 8 = 7', detail: '7 × 8 = 56, dư 4, hạ 0' },
        { label: '40 ÷ 8 = 5', detail: '5 × 8 = 40, dư 0, xong' },
      ],
    },
  },
];

const L5_SECTIONS: LessonSection[] = [
  {
    id: 'L5S1',
    title: 'Trường hợp đặc biệt',
    example: [
      [F(0, 5), T('='), T('0')],
      [F(5, 5), T('='), T('1')],
      [F(7, 1), T('='), T('7')],
    ],
    steps: [
      'Tử số 0 thì phân số bằng 0.',
      'Tử số bằng mẫu số thì phân số bằng 1.',
      'Mẫu số 1 thì phân số là số nguyên.',
    ],
    tip: 'Không bao giờ chia cho 0. Mẫu số không được bằng 0.',
  },
  {
    id: 'L5S2',
    title: 'Thử thách tổng hợp',
    example: [
      [F(3, 4), T('−'), F(1, 4), T('='), F(1, 2)],
      [F(1, 2), T('×'), F(2, 3), T('='), F(1, 3)],
    ],
    steps: [
      'Tính trong ngoặc trước.',
      'Rút gọn sớm để số nhỏ lại.',
      'Nhân và rút gọn kết quả cuối cùng.',
    ],
  },
];

const questionsFor = (topicIds: string[]): string[] =>
  QUESTIONS.filter((q) => topicIds.includes(q.topicId)).map((q) => q.id);

export const PACK_LESSONS: Lesson[] = [
  { id: 'L1', title: 'Rút gọn phân số và hỗn số', topicIds: ['A', 'B'], color: '#2563eb', sections: L1_SECTIONS, questionIds: questionsFor(['A', 'B']) },
  { id: 'L2', title: 'Cộng và trừ phân số', topicIds: ['C'], color: '#059669', sections: L2_SECTIONS, questionIds: questionsFor(['C']) },
  { id: 'L3', title: 'Nhân và chia phân số', topicIds: ['D', 'E'], color: '#d97706', sections: L3_SECTIONS, questionIds: questionsFor(['D', 'E']) },
  { id: 'L4', title: 'Phân số sang số thập phân', topicIds: ['F'], color: '#0891b2', sections: L4_SECTIONS, questionIds: questionsFor(['F']) },
  { id: 'L5', title: 'Trường hợp đặc biệt và thử thách', topicIds: ['G', 'H'], color: '#db2777', sections: L5_SECTIONS, questionIds: questionsFor(['G', 'H']) },
];

export const LESSON_COPIES: Lesson[] = [
  {
    ...PACK_LESSONS[0],
    id: 'LC-A1',
    title: 'Rút gọn phân số và hỗn số (bản của Cô Mai)',
    ownerId: 'u-teacher-a',
    sourceId: 'L1',
  },
  {
    ...PACK_LESSONS[0],
    id: 'LC-A2',
    title: 'Rút gọn phân số — bản nâng cao',
    ownerId: 'u-teacher-a',
    sourceId: 'L1',
    sections: [
      ...L1_SECTIONS,
      {
        id: 'LC-A2-S3',
        title: 'Nâng cao: rút gọn hai bước',
        example: [
          [F(48, 60), T('='), F(12, 15)],
          [F(12, 15), T('='), F(4, 5)],
        ],
        steps: [
          'Rút gọn lần 1: chia cả tử số và mẫu số cho 4.',
          'Rút gọn lần 2: chia cả tử số và mẫu số cho 3.',
          'Kiểm tra: 4 và 5 không còn chia chung được nữa.',
        ],
      },
    ],
  },
  {
    ...PACK_LESSONS[2],
    id: 'LC-B1',
    title: 'Nhân và chia phân số (bản của Thầy Hùng)',
    ownerId: 'u-teacher-b',
    sourceId: 'L3',
  },
  {
    ...PACK_LESSONS[1],
    id: 'LC-RI1',
    title: 'Cộng và trừ phân số — bản mẫu',
    ownerId: 'u-teacher-a',
    sourceId: 'L2',
  },
];

// ---------- Games ----------

export const GAME_CHI: GameDef = {
  id: 'G-CHI',
  title: 'Đua xe phân số',
  mechanic: 'quick-quiz',
  theme: 'forest',
  topicId: 'A',
  questionIds: ['A1', 'A2', 'A3', 'A4'],
  createdBy: 'u-chi',
  createdByName: 'Chi',
  anonymous: true,
};

export const GAME_AN: GameDef = {
  id: 'G-AN',
  title: 'Đố nhanh phân số',
  mechanic: 'quick-quiz',
  theme: 'space',
  topicId: 'C',
  questionIds: ['C1', 'C4', 'C7', 'C8'],
  createdBy: 'u-an',
  createdByName: 'An',
  anonymous: false,
};

export const GAME_REPO: GameDef = {
  id: 'G-RI3',
  title: 'Vũ trụ phân số',
  mechanic: 'quick-quiz',
  theme: 'space',
  topicId: 'D',
  questionIds: ['D1', 'D2', 'D6'],
  createdBy: 'u-chi',
  createdByName: 'Chi',
  anonymous: true,
};

// ---------- Assignments & submissions (end-to-end slice) ----------

export const ASSIGNMENTS: Assignment[] = [
  {
    id: 'ASG1',
    lessonId: 'L1',
    title: 'Luyện tập: Rút gọn phân số và hỗn số',
    classId: 'C5A',
    createdBy: 'u-teacher-a',
    dueDate: iso(2),
    attemptsAllowed: 2,
    status: 'active',
    createdAt: iso(-3),
  },
  {
    id: 'ASG2',
    lessonId: 'L2',
    title: 'Luyện tập: Cộng và trừ phân số',
    classId: 'C5A',
    createdBy: 'u-teacher-a',
    dueDate: iso(0),
    attemptsAllowed: 2,
    status: 'active',
    createdAt: iso(-1),
  },
  {
    id: 'ASG3',
    lessonId: 'L3',
    title: 'Luyện tập: Nhân và chia phân số',
    classId: 'C6B',
    createdBy: 'u-teacher-b',
    dueDate: iso(3),
    attemptsAllowed: 2,
    status: 'active',
    createdAt: iso(-2),
  },
  {
    id: 'ASG4',
    lessonId: 'L1',
    title: 'Luyện tập: Rút gọn phân số và hỗn số',
    classId: 'C5B',
    createdBy: 'u-teacher-a',
    dueDate: iso(4),
    attemptsAllowed: 2,
    status: 'active',
    createdAt: iso(-1),
  },
];

function buildSubmission(
  id: string,
  assignmentId: string,
  studentId: string,
  lessonId: string,
  wrong: Record<string, StudentAnswer>,
  reviewed: boolean,
  comment: string | undefined,
  submittedOffset: number,
): Submission {
  const lesson = PACK_LESSONS.find((l) => l.id === lessonId);
  const questions = QUESTIONS.filter((q) => lesson?.questionIds.includes(q.id));
  const answers: Record<string, StudentAnswer> = {};
  for (const q of questions) {
    answers[q.id] = wrong[q.id] ?? correctStudentAnswer(q);
  }
  const { score, total } = scoreAnswers(questions, answers);
  return {
    id,
    assignmentId,
    studentId,
    answers,
    score,
    total,
    submittedAt: iso(submittedOffset),
    comment,
    reviewed,
  };
}

export const SUBMISSIONS: Submission[] = [
  buildSubmission('SUB1', 'ASG1', 'u-an', 'L1',
    { A8: { type: 'fraction', n: 2, d: 3 } },
    true, 'Làm rất tốt! Chú ý câu rút gọn 42 và 56 nhé.', -1),
  buildSubmission('SUB2', 'ASG1', 'u-binh', 'L1',
    {
      A4: { type: 'fraction', n: 2, d: 3 },
      A7: { type: 'fraction', n: 5, d: 6 },
      B2: { type: 'mixed', w: 3, n: 1, d: 5 },
      B5: { type: 'fraction', n: 16, d: 5 },
    },
    false, undefined, -1),
  buildSubmission('SUB3', 'ASG3', 'u-dung', 'L3',
    {
      E4: { type: 'fraction', n: 8, d: 27 },
      D3: { type: 'fraction', n: 1, d: 2 },
      E1: { type: 'fraction', n: 6, d: 20 },
      D5: { type: 'fraction', n: 2, d: 5 },
    },
    false, undefined, -1),
];

// ---------- Proposals & shared repository ----------

export const PROPOSALS: Proposal[] = [
  {
    id: 'PR1',
    kind: 'lesson',
    title: 'Rút gọn phân số — bản nâng cao',
    topicId: 'A',
    createdBy: 'u-teacher-a',
    createdByName: 'Cô Mai — Toán 5',
    anonymous: false,
    targetRepo: 'team',
    schoolId: 'S1',
    teamId: 'T1',
    stage: 'team',
    status: 'pending',
    lessonCopyId: 'LC-A2',
    createdAt: iso(-1),
  },
  {
    id: 'PR2',
    kind: 'game',
    title: 'Đua xe phân số',
    topicId: 'A',
    createdBy: 'u-chi',
    createdByName: 'Chi',
    anonymous: true,
    targetRepo: 'school',
    schoolId: 'S1',
    teamId: 'T1',
    stage: 'teacher',
    status: 'pending',
    game: GAME_CHI,
    createdAt: iso(-1),
  },
  {
    id: 'PR3',
    kind: 'lesson',
    title: 'Cộng và trừ phân số — bản mẫu',
    topicId: 'C',
    createdBy: 'u-teacher-a',
    createdByName: 'Cô Mai — Toán 5',
    anonymous: false,
    targetRepo: 'school',
    schoolId: 'S1',
    teamId: 'T1',
    stage: 'done',
    status: 'approved',
    lessonCopyId: 'LC-RI1',
    createdAt: iso(-6),
    decidedBy: 'u-principal',
  },
];

export const REPO_ITEMS: RepoItem[] = [
  {
    id: 'RI1',
    repo: 'school',
    kind: 'lesson',
    title: 'Cộng và trừ phân số — bản mẫu',
    topicId: 'C',
    ownerName: 'Cô Mai — Toán 5',
    anonymous: false,
    schoolId: 'S1',
    teamId: 'T1',
    lessonCopyId: 'LC-RI1',
    approvedBy: 'Cô Hiệu trưởng Lan',
  },
  {
    id: 'RI2',
    repo: 'team',
    kind: 'questions',
    title: 'Bộ câu hỏi rút gọn nhanh',
    topicId: 'A',
    ownerName: 'Thầy Tổ trưởng Toán',
    anonymous: false,
    schoolId: 'S1',
    teamId: 'T1',
    questionIds: ['A1', 'A2', 'A3', 'A4'],
    approvedBy: 'Thầy Tổ trưởng Toán',
  },
  {
    id: 'RI3',
    repo: 'school',
    kind: 'game',
    title: 'Vũ trụ phân số',
    topicId: 'D',
    ownerName: 'Chi',
    anonymous: true,
    schoolId: 'S1',
    teamId: 'T1',
    game: GAME_REPO,
    approvedBy: 'Cô Hiệu trưởng Lan',
  },
];

// ---------- Tutor Space data (private per student) ----------

export const TUTOR_DATA: Record<string, TutorData> = {
  'u-an': {
    studentId: 'u-an',
    sessions: 12,
    weakTopics: [],
    chat: [
      { id: 'm1', from: 'tutor', text: 'Chào An! Hôm nay em muốn luyện phần nào?' },
      { id: 'm2', from: 'student', text: 'Em muốn luyện rút gọn phân số.' },
      { id: 'm3', from: 'tutor', text: 'Tốt! Hãy thử rút gọn 18 phần 24. Em tìm số nào chia hết cho cả 18 và 24?' },
    ],
    selfGames: [GAME_AN],
    reviewQuestionIds: ['A8'],
    masteredIds: ['A1', 'A2'],
    bestScores: { 'G-AN': 4 },
  },
  'u-binh': {
    studentId: 'u-binh',
    sessions: 6,
    weakTopics: ['B'],
    chat: [{ id: 'm1', from: 'tutor', text: 'Chào Bình! Em cần giúp phần nào?' }],
    selfGames: [],
    reviewQuestionIds: ['A4', 'B2'],
    masteredIds: [],
    bestScores: {},
  },
  'u-chi': {
    studentId: 'u-chi',
    sessions: 9,
    weakTopics: ['A', 'C'],
    chat: [
      { id: 'm1', from: 'tutor', text: 'Chào Chi! Cứ hỏi thoải mái, sai cũng không sao nhé.' },
      { id: 'm2', from: 'student', text: 'Em hay nhầm khi cộng hai phân số khác mẫu số.' },
      { id: 'm3', from: 'tutor', text: 'Không sao đâu. Bước đầu tiên luôn là đổi về cùng mẫu số. Thử với 1 phần 2 cộng 1 phần 3 nhé, mẫu số chung là mấy?' },
    ],
    selfGames: [GAME_CHI],
    reviewQuestionIds: ['A6', 'C2', 'A4'],
    masteredIds: [],
    bestScores: {},
  },
  'u-dung': {
    studentId: 'u-dung',
    sessions: 4,
    weakTopics: ['E'],
    chat: [{ id: 'm1', from: 'tutor', text: 'Chào Dũng! Em cần giúp phần nào?' }],
    selfGames: [],
    reviewQuestionIds: ['E4'],
    masteredIds: [],
    bestScores: {},
  },
  'u-phuong': {
    studentId: 'u-phuong',
    sessions: 3,
    weakTopics: ['D'],
    chat: [],
    selfGames: [],
    reviewQuestionIds: ['D2'],
    masteredIds: [],
    bestScores: {},
  },
  'u-tuan': {
    studentId: 'u-tuan',
    sessions: 0,
    weakTopics: [],
    chat: [],
    selfGames: [],
    reviewQuestionIds: [],
    masteredIds: [],
    bestScores: {},
  },
  'u-ha': {
    studentId: 'u-ha',
    sessions: 2,
    weakTopics: [],
    chat: [],
    selfGames: [],
    reviewQuestionIds: [],
    masteredIds: [],
    bestScores: {},
  },
  'u-minh': {
    studentId: 'u-minh',
    sessions: 1,
    weakTopics: ['A'],
    chat: [],
    selfGames: [],
    reviewQuestionIds: ['A1'],
    masteredIds: [],
    bestScores: {},
  },
};

// ---------- Public marketplace ("Kho user nộp lên") ----------
// Sample listings only. Deals are user-to-user and EduPro takes a small
// marketplace fee (user decision 2026-11-15); no real payments exist in
// the demo, so paid items can be previewed but not bought yet. Listings
// made with AI assistance are labelled as such.

export const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'MKT-1',
    title: 'So sánh phân số bằng hình ảnh',
    description:
      'Hai thanh hình chữ nhật tô màu giúp học sinh thấy ngay phân số nào lớn hơn, trước khi học quy tắc quy đồng.',
    grade: 5,
    subject: 'Toán',
    topic: 'Phân số',
    sellerName: 'Cô Lan — Trường TH An Bình',
    price: 0,
    aiAssisted: false,
    lesson: {
      id: 'MKT-L1',
      title: 'So sánh phân số bằng hình ảnh',
      topicIds: [],
      color: '#2563eb',
      sections: [
        {
          id: 'MS1',
          title: 'Nhìn hình, đoán phân số nào lớn hơn',
          example: [
            [{ k: 't', s: 'Thanh 1 tô ' }, { k: 'f', n: 3, d: 4 }, { k: 't', s: ' — thanh 2 tô ' }, { k: 'f', n: 2, d: 3 }, { k: 't', s: '. Thanh nào tô nhiều hơn?' }],
          ],
          steps: ['Vẽ hai thanh dài bằng nhau.', 'Tô màu theo từng phân số.', 'Phần tô dài hơn là phân số lớn hơn.'],
          tip: 'Học sinh hay so sánh mẫu số thay vì nhìn phần được tô.',
        },
        {
          id: 'MS2',
          title: 'Kiểm tra bằng quy đồng',
          example: [
            [{ k: 'f', n: 3, d: 4 }, { k: 't', s: ' = ' }, { k: 'f', n: 9, d: 12 }, { k: 't', s: ' và ' }, { k: 'f', n: 2, d: 3 }, { k: 't', s: ' = ' }, { k: 'f', n: 8, d: 12 }],
          ],
          steps: ['Quy đồng hai phân số về cùng mẫu số.', 'So sánh tử số.', 'Kết quả phải khớp với hình đã vẽ.'],
        },
      ],
      questionIds: [],
      topic: 'Phân số',
    },
  },
  {
    id: 'MKT-2',
    title: 'Đổi đơn vị đo độ dài',
    description:
      'Bảng đơn vị từ ki-lô-mét đến mi-li-mét, kèm mẹo nhớ "mỗi bước nhân hoặc chia 10". Bài do giáo viên soạn cùng AI và đã duyệt lại.',
    grade: 5,
    subject: 'Toán',
    topic: 'Đo lường',
    sellerName: 'Thầy Đức — Trường TH Bình Minh',
    price: 20000,
    aiAssisted: true,
    lesson: {
      id: 'MKT-L2',
      title: 'Đổi đơn vị đo độ dài',
      topicIds: [],
      color: '#059669',
      sections: [
        {
          id: 'MS1',
          title: 'Thang đơn vị đo độ dài',
          example: [[{ k: 't', s: 'km — hm — dam — m — dm — cm — mm' }]],
          steps: ['Viết thang đơn vị theo thứ tự từ lớn đến bé.', 'Mỗi bước sang phải: nhân 10.', 'Mỗi bước sang trái: chia 10.'],
        },
        {
          id: 'MS2',
          title: 'Ví dụ đổi đơn vị',
          example: [[{ k: 't', s: '2,5 km = 2500 m (đi 3 bước sang phải: nhân 1000)' }]],
          steps: ['Đếm số bước giữa hai đơn vị.', 'Nhân hoặc chia cho 10 theo số bước.', 'Kiểm tra: đổi ngược lại phải ra số ban đầu.'],
          tip: 'Lỗi hay gặp: đếm nhầm số bước khi có đơn vị dam.',
        },
      ],
      questionIds: [],
      topic: 'Đo lường',
    },
  },
  {
    id: 'MKT-3',
    title: 'Đọc hiểu: Sự tích cây khế',
    description:
      'Bài đọc hiểu truyện cổ tích kèm 3 câu hỏi gợi mở về lòng tham và tình anh em, phù hợp tiết đọc mở rộng.',
    grade: 2,
    subject: 'Tiếng Việt',
    topic: 'Đọc hiểu',
    sellerName: 'Cô Hạnh — Trường TH An Bình',
    price: 0,
    aiAssisted: false,
    lesson: {
      id: 'MKT-L3',
      title: 'Đọc hiểu: Sự tích cây khế',
      topicIds: [],
      color: '#7c3aed',
      sections: [
        {
          id: 'MS1',
          title: 'Đọc truyện',
          example: [[{ k: 't', s: 'Ngày xưa, có hai anh em nhà kia. Người anh tham lam lấy hết ruộng vườn, chỉ để lại cho em một cây khế...' }]],
          steps: ['Đọc thầm đoạn truyện.', 'Gạch chân từ khó hiểu.', 'Kể lại truyện bằng lời của em.'],
        },
        {
          id: 'MS2',
          title: 'Hỏi — đáp',
          example: [[{ k: 't', s: 'Vì sao người em không lấy nhiều vàng? Em học được điều gì từ người em?' }]],
          steps: ['Trả lời miệng trước, viết sau.', 'Trích dẫn câu trong truyện làm bằng chứng.', 'Nghe bạn trả lời rồi bổ sung.'],
        },
      ],
      questionIds: [],
      topic: 'Đọc hiểu',
    },
  },
  {
    id: 'MKT-4',
    title: 'Cộng trong phạm vi 100 (không nhớ)',
    description:
      'Phép cộng hai chữ số bằng que tính và bảng chục — đơn vị, dành cho học sinh mới làm quen với cộng có hai chữ số.',
    grade: 1,
    subject: 'Toán',
    topic: 'Số học',
    sellerName: 'Cô Thu — Trường TH Bình Minh',
    price: 15000,
    aiAssisted: false,
    lesson: {
      id: 'MKT-L4',
      title: 'Cộng trong phạm vi 100 (không nhớ)',
      topicIds: [],
      color: '#d97706',
      sections: [
        {
          id: 'MS1',
          title: 'Que tính và bảng chục — đơn vị',
          example: [[{ k: 't', s: '34 + 25: 3 chục + 2 chục = 5 chục; 4 đơn vị + 5 đơn vị = 9 đơn vị.' }]],
          steps: ['Xếp que tính thành chục và đơn vị.', 'Cộng chục với chục, đơn vị với đơn vị.', 'Đọc kết quả: 59.'],
        },
        {
          id: 'MS2',
          title: 'Đặt tính rồi tính',
          example: [[{ k: 't', s: 'Đặt thẳng hàng chục với chục, đơn vị với đơn vị, rồi cộng từ phải sang trái.' }]],
          steps: ['Viết số thẳng cột.', 'Cộng cột đơn vị trước.', 'Cộng cột chục sau.'],
          tip: 'Nhắc học sinh đặt thẳng hàng trước khi cộng.',
        },
      ],
      questionIds: [],
      topic: 'Số học',
    },
  },
];
