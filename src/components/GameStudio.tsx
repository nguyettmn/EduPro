// Game studio (test slice): pick grade/subject/topic/game type/theme,
// let Gemini propose a Game Card (rules + scoring + question plan),
// generate a single-file HTML game, preview it in the sandboxed player,
// revise it by chat in one of five modes until satisfied, then save it
// onto the lesson (or into the student's Tutor Space). Editing a saved
// game reopens it here with its current file as version 1.
//
// The prompt is assembled server-side (see api/ai-soan-bai.ts game
// stages); the browser never sees the API key.
import { useMemo, useRef, useState } from 'react';
import type { Account, HtmlGame } from '../types';
import { canDo } from '../permissions';
import { gradesFor, roleSentenceFor, subjectsFor } from '../ai/subjects';
import type {
  AiRequestBody,
  ChatTurn,
  GameCard,
  GameMechanicChoice,
  GameReviseMode,
  GameSession,
  WireAttachment,
} from '../ai/apiTypes';
import { AiApiError, callAiJson, callAiSoanBai } from '../ai/client';
import { buildGameExport } from '../ai/gameFile';
import { downloadTextFile, lessonTextFromHtml, safeFilename } from '../ai/lessonFile';
import { useStore } from '../state/store';
import type { Route } from '../route';
import { SectionBand } from './ui';
import { GamePlayer } from './GamePlayer';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const CUSTOM_SUBJECT = '__custom__';

interface LocalAttachment extends WireAttachment {
  id: string;
  size: number;
}

interface Version {
  id: string;
  html: string;
  title: string;
}

type Status = 'idle' | 'proposing' | 'generating' | 'revising';

const MECHANICS: { id: GameMechanicChoice; title: string; desc: string }[] = [
  { id: 'ai', title: 'AI đề xuất', desc: 'AI chọn loại game hợp nhất với môn và chủ đề.' },
  { id: 'snake', title: 'Snake — Rắn ăn đáp án', desc: 'Ăn mồi mang đáp án đúng, tránh đáp án sai.' },
  { id: 'pacman', title: 'Pac-Man — Mê cung', desc: 'Ăn chấm đáp án đúng trong mê cung, tránh quái.' },
  { id: 'runner', title: 'Runner — Chạy trốn', desc: 'Chạy tới đích, thu vật đúng, né vật sai.' },
  { id: 'defender', title: 'Defender — Bảo vệ / Phân loại', desc: 'Bắn hoặc phân loại đúng mục tiêu rơi xuống.' },
  { id: 'adventure', title: 'Adventure — Phiêu lưu', desc: '3 bản đồ, nhiệm vụ orb + rương + quái + boss. Game lớn.' },
];

const REVISE_MODES: { id: GameReviseMode; title: string; desc: string }[] = [
  { id: 'tune', title: 'Chỉnh số', desc: 'Tốc độ, điểm, mạng, thời gian — giữ nguyên luật và câu hỏi.' },
  { id: 'reskin', title: 'Đổi theme', desc: 'Bối cảnh, nhân vật, màu sắc — giữ nguyên luật và câu hỏi.' },
  { id: 'rules', title: 'Đổi luật', desc: 'Luật chơi, điều kiện thắng/thua — giữ nguyên theme.' },
  { id: 'questions', title: 'Câu hỏi mới', desc: 'Đổi ngân hàng/hàm sinh câu hỏi — giữ nguyên luật và theme.' },
  { id: 'redo', title: 'Làm lại', desc: 'Sinh lại toàn bộ file từ đầu.' },
];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file.'));
    reader.onload = () => {
      const url = String(reader.result ?? '');
      const comma = url.indexOf(',');
      resolve(comma >= 0 ? url.slice(comma + 1) : url);
    };
    reader.readAsDataURL(file);
  });
}

function formatKb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)}KB`;
}

/** Plain-text question source from a section lesson (titles + steps + tips). */
function sectionLessonText(lesson: { sections: { title: string; steps: string[]; tip?: string }[] }): string {
  const parts: string[] = [];
  for (const s of lesson.sections) {
    parts.push(s.title);
    for (const step of s.steps) parts.push(`- ${step}`);
    if (s.tip) parts.push(`Ghi chú: ${s.tip}`);
  }
  return parts.join('\n').slice(0, 12000);
}

export function GameStudio({ account, route, go }: { account: Account; route: Route; go: (route: Route) => void }) {
  const { state, dispatch } = useStore();
  const editing = route.gameId ? state.htmlGames.find((g) => g.id === route.gameId) : undefined;
  const lesson = route.lessonId ? state.lessons.find((l) => l.id === route.lessonId) : undefined;
  const isStudent = canDo(account, 'useTutor');
  const profile = account.teachingProfile;
  const gradeOptions = gradesFor(profile);
  const studentGrade =
    state.classes.find((c) => account.classIds.includes(c.id))?.grade ?? 5;
  const defaultGrade = editing?.grade ?? lesson?.grade ?? (isStudent ? studentGrade : (gradeOptions[0] ?? 5));
  const defaultSubject = editing?.subject ?? lesson?.subject ?? subjectsFor(profile, defaultGrade)[0] ?? 'Toán';
  const subjectOptions = subjectsFor(profile, defaultGrade);
  const subjectIsListed = subjectOptions.includes(defaultSubject);

  const roleDefault = (g: number, s: string): string =>
    isStudent
      ? `Bạn là học sinh lớp ${g} đang tự tạo game để ôn tập môn ${s.toLowerCase()}.`
      : roleSentenceFor(g, s);

  const [grade, setGrade] = useState(defaultGrade);
  const [subject, setSubject] = useState(subjectIsListed ? defaultSubject : CUSTOM_SUBJECT);
  const [customSubject, setCustomSubject] = useState(subjectIsListed ? '' : defaultSubject);
  const [roleSentence, setRoleSentence] = useState(() => roleDefault(defaultGrade, defaultSubject));
  const [roleEdited, setRoleEdited] = useState(false);
  const [topic, setTopic] = useState(editing?.topic ?? lesson?.topic ?? lesson?.title ?? '');
  const [mechanic, setMechanic] = useState<GameMechanicChoice>('ai');
  const [theme, setTheme] = useState(editing?.theme ?? '');
  const [rulesOverride, setRulesOverride] = useState('');
  const [outline, setOutline] = useState('');
  const [extraRequests, setExtraRequests] = useState('');
  const [seedInput, setSeedInput] = useState(editing?.seed ?? '');
  const [session, setSession] = useState<GameSession>('standard');
  const [language, setLanguage] = useState<'en' | 'vi'>('en');
  const [players, setPlayers] = useState<1 | 2>(1);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [card, setCard] = useState<GameCard | null>(null);
  const [approvedCard, setApprovedCard] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>(
    editing ? [{ id: 'v-original', html: editing.htmlCode, title: editing.title }] : [],
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reviseMode, setReviseMode] = useState<GameReviseMode>('tune');
  const [status, setStatus] = useState<Status>('idle');
  const [progressKb, setProgressKb] = useState(0);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [formHint, setFormHint] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSubject = subject === CUSTOM_SUBJECT ? customSubject.trim() : subject;
  const busy = status !== 'idle';
  const current = versions[currentIdx];

  const lessonText = useMemo(() => {
    if (!lesson) return '';
    if (lesson.html) return lessonTextFromHtml(lesson.html);
    return sectionLessonText(lesson);
  }, [lesson]);

  const refreshRoleSentence = (nextGrade: number, nextSubject: string) => {
    if (!roleEdited) setRoleSentence(roleDefault(nextGrade, nextSubject));
  };

  const changeGrade = (next: number) => {
    const first = subjectsFor(profile, next)[0] ?? 'Toán';
    setGrade(next);
    setSubject(first);
    setCustomSubject('');
    setCard(null);
    setApprovedCard(null);
    refreshRoleSentence(next, first);
  };

  const changeSubject = (next: string) => {
    setSubject(next);
    setCard(null);
    setApprovedCard(null);
    refreshRoleSentence(grade, next === CUSTOM_SUBJECT ? customSubject.trim() || 'môn học' : next);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setAttachError(null);
    const currentTotal = attachments.reduce((sum, a) => sum + a.size, 0);
    let total = currentTotal;
    const next: LocalAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        setAttachError(`File "${file.name}" quá lớn (tối đa 3MB mỗi file trong bản test).`);
        continue;
      }
      if (total + file.size > MAX_TOTAL_BYTES) {
        setAttachError('Tổng dung lượng file đính kèm tối đa 3MB trong bản test.');
        break;
      }
      total += file.size;
      next.push({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataBase64: await readFileAsBase64(file),
      });
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next]);
  };

  const buildBody = (stage: AiRequestBody['stage'], extra: Partial<AiRequestBody> = {}): AiRequestBody => ({
    stage,
    grade,
    subject: effectiveSubject,
    roleSentence: roleSentence.trim(),
    mode: 'topic',
    topic: topic.trim(),
    outline: outline.trim(),
    extraRequests: extraRequests.trim(),
    attachments: attachments.map(({ name, mimeType, dataBase64 }) => ({ name, mimeType, dataBase64 })),
    lessonText: lessonText !== '' ? lessonText : undefined,
    gameMechanic: mechanic,
    gameTheme: theme.trim(),
    gameRules: rulesOverride.trim(),
    gameSeed: seedInput.trim() !== '' ? seedInput.trim().toUpperCase() : undefined,
    gameSession: session,
    gameLanguage: language,
    gamePlayers: players,
    gameCard: approvedCard ?? undefined,
    ...extra,
  });

  const propose = async () => {
    if (topic.trim() === '') {
      setFormHint('Hãy nhập chủ đề của game.');
      return;
    }
    setFormHint(null);
    setStatus('proposing');
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await callAiJson<GameCard>(buildBody('game-propose'), { signal: controller.signal });
      setCard(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof AiApiError) setError({ code: err.code, message: err.message });
    } finally {
      abortRef.current = null;
      setStatus('idle');
    }
  };

  const generate = async () => {
    if (effectiveSubject === '') {
      setFormHint('Hãy chọn hoặc nhập tên môn học.');
      return;
    }
    if (topic.trim() === '') {
      setFormHint('Hãy nhập chủ đề của game.');
      return;
    }
    if (!lesson && outline.trim() === '' && attachments.length === 0) {
      setFormHint('Hãy nhập dàn ý/các kỹ năng cần luyện, hoặc đính kèm ít nhất một tài liệu.');
      return;
    }
    setFormHint(null);
    setStatus('generating');
    setError(null);
    setRetryNotice(null);
    setProgressKb(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await callAiSoanBai(buildBody('game-generate'), {
        signal: controller.signal,
        onProgress: setProgressKb,
        onRetry: (violations) =>
          setRetryNotice(`Bản đầu vi phạm hợp đồng output (${violations.join('; ')}). Đang tạo lại…`),
      });
      if (result.stage !== 'propose') {
        setVersions([{ id: `v-${Date.now()}`, html: result.html, title: result.title }]);
        setCurrentIdx(0);
        setChat([]);
        setWarnings(result.warnings);
        setAssumptions(result.assumptions);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof AiApiError) setError({ code: err.code, message: err.message });
    } finally {
      abortRef.current = null;
      setStatus('idle');
    }
  };

  const revise = async () => {
    const instruction = chatInput.trim();
    if (instruction === '' || !current) return;
    const nextChat: ChatTurn[] = [...chat, { from: 'teacher', text: instruction }];
    setChat(nextChat);
    setChatInput('');
    setStatus('revising');
    setError(null);
    setRetryNotice(null);
    setProgressKb(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await callAiSoanBai(
        buildBody('game-revise', {
          currentHtml: current.html,
          history: nextChat,
          instruction,
          gameMode: reviseMode,
        }),
        {
          signal: controller.signal,
          onProgress: setProgressKb,
          onRetry: (violations) =>
            setRetryNotice(`Bản đầu vi phạm hợp đồng output (${violations.join('; ')}). Đang tạo lại…`),
        },
      );
      if (result.stage !== 'propose') {
        const nextVersions = [
          ...versions,
          { id: `v-${Date.now()}`, html: result.html, title: result.title },
        ];
        setVersions(nextVersions);
        setCurrentIdx(nextVersions.length - 1);
        setChat([...nextChat, { from: 'ai', text: `Đã tạo bản mới (bản ${nextVersions.length}).` }]);
        setWarnings(result.warnings);
        setAssumptions(result.assumptions);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof AiApiError) setError({ code: err.code, message: err.message });
    } finally {
      abortRef.current = null;
      setStatus('idle');
    }
  };

  const goBack = () => {
    if (route.from === 'lesson' && route.lessonId) {
      go({ view: 'lesson', lessonId: route.lessonId, tab: 'content' });
    } else if (route.from === 'tutor') {
      go({ view: 'tutor', studentId: account.id });
    } else {
      go({ view: 'dashboard' });
    }
  };

  const saveGame = () => {
    if (!current) return;
    const title =
      current.title !== '' ? current.title : topic.trim() !== '' ? topic.trim() : 'Game mới';
    const seed = seedInput.trim() !== '' ? seedInput.trim().toUpperCase() : undefined;
    if (editing) {
      dispatch({
        type: 'UPDATE_HTML_GAME',
        game: {
          ...editing,
          title,
          htmlCode: current.html,
          theme: theme.trim() !== '' ? theme.trim() : editing.theme,
          grade,
          subject: effectiveSubject,
          topic: topic.trim() !== '' ? topic.trim() : editing.topic,
          seed: seed ?? editing.seed,
        },
      });
    } else {
      const game: HtmlGame = {
        id: `game_${Date.now()}`,
        title,
        mechanic:
          card?.mechanic ?? MECHANICS.find((m) => m.id === mechanic)?.title ?? 'Imported',
        theme: theme.trim() !== '' ? theme.trim() : 'Custom',
        htmlCode: current.html,
        ownerId: account.id,
        ...(lesson ? { lessonId: lesson.id } : {}),
        ...(seed ? { seed } : {}),
        createdAt: new Date().toISOString().slice(0, 10),
        grade,
        subject: effectiveSubject,
        topic: topic.trim() !== '' ? topic.trim() : undefined,
      };
      dispatch({ type: 'CREATE_HTML_GAME', game });
    }
    goBack();
  };

  const downloadCurrent = (asJson: boolean) => {
    if (!current) return;
    const title = current.title !== '' ? current.title : topic.trim() !== '' ? topic.trim() : 'Game mới';
    if (asJson) {
      const record = {
        id: editing?.id ?? `game_${Date.now()}`,
        title,
        mechanic: card?.mechanic ?? 'Imported',
        theme: theme.trim() !== '' ? theme.trim() : 'Custom',
        htmlCode: current.html,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      downloadTextFile(safeFilename(title, 'json'), buildGameExport(record), 'application/json');
    } else {
      downloadTextFile(safeFilename(title, 'html'), current.html, 'text/html;charset=utf-8');
    }
  };

  const previewGame: HtmlGame | null = current
    ? {
        id: 'preview',
        title: current.title,
        mechanic: 'preview',
        theme: theme,
        htmlCode: current.html,
        ownerId: account.id,
        seed: seedInput.trim() !== '' ? seedInput.trim().toUpperCase() : undefined,
        createdAt: '',
      }
    : null;

  const startNew = () => {
    setVersions([]);
    setCurrentIdx(0);
    setChat([]);
    setCard(null);
    setApprovedCard(null);
    setWarnings([]);
    setAssumptions([]);
    setError(null);
  };

  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={goBack}>
        ← Quay lại
      </button>
      <SectionBand
        title={editing ? `Sửa game: ${editing.title}` : 'Tạo game mới bằng AI'}
        guide={
          lesson
            ? `Game sẽ gắn vào cuối bài "${lesson.title}". Một bài có thể có nhiều game.`
            : 'Game sẽ lưu trong Tutor Space của em. Chỉ em xem được.'
        }
      />

      {error ? (
        <div className="warn-box" role="alert">
          <strong>Không tạo được game.</strong> {error.message}
          {error.code === 'missing_key' || error.code === 'invalid_key' ? (
            <ol className="ai-setup-steps">
              <li>
                Lấy API key miễn phí tại{' '}
                <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">
                  Google AI Studio
                </a>{' '}
                (Get API key).
              </li>
              <li>
                Mở Vercel → project EduPro → Settings → Environment Variables → thêm biến{' '}
                <code>GEMINI_API_KEY</code> với key vừa lấy.
              </li>
              <li>Deploy lại (Deployments → Redeploy) rồi thử lại.</li>
            </ol>
          ) : null}
        </div>
      ) : null}

      {versions.length === 0 ? (
        <div className="form-card">
          <div className="field-row">
            <label className="field">
              <span>Khối</span>
              <select value={grade} onChange={(e) => changeGrade(Number(e.target.value))} disabled={busy}>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    Khối {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Môn</span>
              <select value={subject} onChange={(e) => changeSubject(e.target.value)} disabled={busy}>
                {subjectsFor(profile, grade).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value={CUSTOM_SUBJECT}>Môn khác (gõ tay)…</option>
              </select>
            </label>
          </div>
          {subject === CUSTOM_SUBJECT ? (
            <label className="field">
              <span>Tên môn học</span>
              <input
                value={customSubject}
                onChange={(e) => {
                  setCustomSubject(e.target.value);
                  refreshRoleSentence(grade, e.target.value.trim() || 'môn học');
                }}
                placeholder="Ví dụ: Khoa học máy tính"
                disabled={busy}
              />
            </label>
          ) : null}
          <label className="field">
            <span>Câu vai trò (đứng đầu prompt, sửa được)</span>
            <input
              value={roleSentence}
              onChange={(e) => {
                setRoleSentence(e.target.value);
                setRoleEdited(true);
              }}
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Chủ đề (bắt buộc)</span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: Rút gọn phân số, Thì quá khứ đơn, Axit–bazơ"
              disabled={busy}
            />
          </label>

          <div className="field">
            <span>Loại game (chọn loại là có sẵn bộ luật + cách tính điểm)</span>
            <div className="mode-cards">
              {MECHANICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={mechanic === m.id ? 'mode-card mode-card-active' : 'mode-card'}
                  onClick={() => setMechanic(m.id)}
                  disabled={busy}
                >
                  <strong>{m.title}</strong>
                  <span>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Theme / đồ họa (1 câu — bối cảnh, nhân vật chính, hành động; để trống thì AI đề xuất)</span>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ví dụ: ong bay trong tổ ong, thu thập phấn hoa, tránh nhện"
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Luật chơi muốn khác bộ luật mẫu (không bắt buộc — phần nào không ghi thì lấy mẫu)</span>
            <textarea
              rows={2}
              value={rulesOverride}
              onChange={(e) => setRulesOverride(e.target.value)}
              placeholder="Ví dụ: 5 mạng, không tính giờ, thắng khi đạt 2000 điểm."
              disabled={busy}
            />
          </label>

          {lesson ? (
            <p className="guide-text">
              Nguồn câu hỏi: nội dung bài học này (đã lấy sẵn). Bạn có thể thêm dàn ý hoặc tài liệu bên
              dưới để bổ sung.
            </p>
          ) : null}
          <label className="field">
            <span>Dàn ý / các kỹ năng cần luyện{lesson ? ' (không bắt buộc)' : ' (hoặc đính kèm tài liệu)'}</span>
            <textarea
              rows={4}
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder={'Mỗi dòng một kỹ năng, ví dụ:\n- Rút gọn phân số về tối giản\n- Rút gọn hai bước'}
              disabled={busy}
            />
          </label>

          <div className="field">
            <span>Tài liệu đính kèm (ảnh, PDF, DOCX, TXT — tối đa 3MB)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.docx,.txt"
              multiple
              hidden
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                + Thêm file
              </button>
              <span className="muted">Ảnh và PDF được AI đọc trực tiếp; DOCX/TXT được trích văn bản.</span>
            </div>
            {attachError ? <p className="guide-text">{attachError}</p> : null}
            {attachments.length > 0 ? (
              <div className="attach-list">
                {attachments.map((a) => (
                  <div key={a.id} className="attach-row">
                    <span>
                      {a.name} <span className="muted">({formatKb(a.size)})</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                      disabled={busy}
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="field-row">
            <label className="field">
              <span>Thời lượng chơi</span>
              <select value={session} onChange={(e) => setSession(e.target.value as GameSession)} disabled={busy}>
                <option value="short">Ngắn (~3 phút)</option>
                <option value="standard">Chuẩn (~5 phút)</option>
                <option value="long">Dài (~10 phút)</option>
              </select>
            </label>
            <label className="field">
              <span>Ngôn ngữ trong game</span>
              <select value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'vi')} disabled={busy}>
                <option value="en">Tiếng Anh</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
            <label className="field">
              <span>Số người chơi</span>
              <select value={players} onChange={(e) => setPlayers(Number(e.target.value) as 1 | 2)} disabled={busy}>
                <option value={1}>1 người</option>
                <option value={2}>2 người (luân phiên)</option>
              </select>
            </label>
            <label className="field">
              <span>Mã thử thách (không bắt buộc)</span>
              <input
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12))}
                placeholder="Để trống: tự sinh mã"
                disabled={busy}
              />
            </label>
          </div>

          <label className="field">
            <span>Yêu cầu thêm (không bắt buộc)</span>
            <textarea
              rows={3}
              value={extraRequests}
              onChange={(e) => setExtraRequests(e.target.value)}
              placeholder="Ví dụ: Học sinh hay nhầm rút gọn với quy đồng, cần câu phân biệt hai cái. Nhân vật chính là một chú mèo."
              disabled={busy}
            />
          </label>

          {card ? (
            <div className="game-card">
              <h3 className="subhead">Thẻ game AI đề xuất</h3>
              <p>
                <strong>{card.title}</strong> · {card.mechanic}
              </p>
              <p>{card.themeSummary}</p>
              <p>
                <strong>Mục tiêu học:</strong> {card.learningGoal}
              </p>
              <p>
                <strong>Luật chơi:</strong>
              </p>
              <ul>
                {card.rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p>
                <strong>Cách tính điểm:</strong>
              </p>
              <ul>
                {card.scoring.map((s, i) => (
                  <li key={i}>
                    {s.action}: {s.points}
                  </li>
                ))}
              </ul>
              <p>
                <strong>Kế hoạch câu hỏi:</strong> {card.questionPlan}
              </p>
              <p>
                <strong>Bậc khó:</strong> {card.difficultyTiers.join(' · ')}
              </p>
              {card.questionBank && card.questionBank.length > 0 ? (
                <details className="guide-text">
                  <summary>Ngân hàng câu hỏi ({card.questionBank.length} câu — bấm để xem hết)</summary>
                  <ul>
                    {card.questionBank.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setApprovedCard(JSON.stringify(card));
                    setCard(null);
                  }}
                  disabled={busy}
                >
                  Duyệt Thẻ game này
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setCard(null)} disabled={busy}>
                  Bỏ qua
                </button>
              </div>
            </div>
          ) : null}
          {approvedCard !== null ? (
            <p className="notice">Đã duyệt Thẻ game — game sẽ theo đúng luật, điểm và kế hoạch câu hỏi này.</p>
          ) : null}

          {formHint ? <p className="guide-text">{formHint}</p> : null}
          {status === 'proposing' || status === 'generating' ? (
            <div className="ai-progress">
              <p>
                {status === 'proposing'
                  ? 'AI đang đề xuất Thẻ game…'
                  : `AI đang tạo game… đã nhận ${progressKb}KB. Game lớn có thể mất 1–3 phút.`}
              </p>
              {retryNotice ? <p className="guide-text">{retryNotice}</p> : null}
              <button type="button" className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
                Dừng
              </button>
            </div>
          ) : (
            <div className="row-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void propose()}>
                AI đề xuất Thẻ game
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void generate()}>
                Tạo game
              </button>
            </div>
          )}
          <p className="guide-text">
            Mẹo: bấm "AI đề xuất Thẻ game" trước để xem và duyệt luật chơi + cách tính điểm, rồi mới tạo game.
            Bạn cũng có thể bấm "Tạo game" ngay — AI sẽ tự dùng bộ luật mẫu của loại game đã chọn.
          </p>
        </div>
      ) : (
        <div>
          <div className="version-bar">
            <span className="muted">Các bản:</span>
            {versions.map((v, i) => (
              <button
                key={v.id}
                type="button"
                className={i === currentIdx ? 'version-btn version-btn-active' : 'version-btn'}
                onClick={() => setCurrentIdx(i)}
              >
                Bản {i + 1}
              </button>
            ))}
            <span className="muted">
              {current?.title !== '' ? current?.title : 'Game'} · Bản {currentIdx + 1} đang xem
            </span>
          </div>
          {warnings.length > 0 ? (
            <div className="warn-box">
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          ) : null}
          {assumptions.length > 0 ? (
            <details className="guide-text">
              <summary>Ghi chú của AI về game này (giả định và kiểm tra)</summary>
              <ul>
                {assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {previewGame ? <GamePlayer game={previewGame} studentId={account.id} preview /> : null}

          <h3 className="subhead">Sửa game bằng chat</h3>
          <p className="guide-text">
            Chọn kiểu sửa, rồi gõ yêu cầu. AI chỉ đổi đúng phần đó và giữ nguyên mọi thứ còn lại — đặc biệt
            là tốc độ và điểm đã chốt.
          </p>
          <div className="field">
            <span>Kiểu sửa</span>
            <div className="mode-cards">
              {REVISE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={reviseMode === m.id ? 'mode-card mode-card-active' : 'mode-card'}
                  onClick={() => setReviseMode(m.id)}
                  disabled={busy}
                >
                  <strong>{m.title}</strong>
                  <span>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="chat-shell">
            <div className="chat-list">
              {chat.length === 0 ? (
                <p className="guide-text">
                  Chưa có lượt sửa nào. Ví dụ: "Con rắn chạy nhanh quá, chậm lại một nửa" hoặc "Câu hỏi khó
                  quá, thêm gợi ý sau 2 lần sai".
                </p>
              ) : (
                chat.map((m, i) => (
                  <div key={i} className={m.from === 'teacher' ? 'chat-msg chat-mine' : 'chat-msg chat-tutor'}>
                    {m.text}
                  </div>
                ))
              )}
              {status === 'revising' ? (
                <div className="chat-msg chat-tutor">AI đang sửa game… đã nhận {progressKb}KB.</div>
              ) : null}
            </div>
            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                void revise();
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Gõ yêu cầu sửa…"
                disabled={busy}
              />
              <button type="submit" className="btn btn-primary" disabled={busy || chatInput.trim() === ''}>
                Gửi
              </button>
              {status === 'revising' ? (
                <button type="button" className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
                  Dừng
                </button>
              ) : null}
            </form>
          </div>
          {retryNotice ? <p className="guide-text">{retryNotice}</p> : null}

          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={saveGame} disabled={busy}>
              {editing ? 'Lưu game' : lesson ? 'Chốt — lưu game vào bài học' : 'Chốt — lưu vào Tutor Space'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => downloadCurrent(true)} disabled={busy}>
              Tải file JSON
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => downloadCurrent(false)} disabled={busy}>
              Tải file HTML
            </button>
            {!editing ? (
              <button type="button" className="btn btn-ghost" onClick={startNew} disabled={busy}>
                Tạo game mới
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
