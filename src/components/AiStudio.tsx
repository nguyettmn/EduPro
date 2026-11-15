// AI Soạn bài (test slice): fill in grade/subject/outline/materials, let
// Gemini compose a single-file interactive HTML lesson, preview it in a
// sandboxed iframe, revise it by chat until satisfied, then Chốt it into
// "Bài của tôi". The prompt is assembled server-side from the same fields
// (see src/ai/prompt.ts); the browser never sees the API key.
//
// Deferred for later: batch syllabus planning (Lên chương trình), profile
// settings with pre-selected grades/subjects, and proposing HTML lessons
// to Kho chung.
import { useRef, useState } from 'react';
import type { Account, Lesson } from '../types';
import { GRADES, SUBJECTS_BY_GRADE, roleSentenceFor } from '../ai/subjects';
import type { AuthorMode } from '../ai/prompt';
import type { AiRequestBody, ChatTurn, WireAttachment } from '../ai/apiTypes';
import { AiApiError, callAiSoanBai } from '../ai/client';
import { useStore } from '../state/store';
import { SectionBand } from './ui';
import { HtmlLessonPlayer } from './HtmlLessonPlayer';

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

const MODES: { id: AuthorMode; title: string; desc: string }[] = [
  { id: 'auto', title: 'Tự động (AI gợi ý)', desc: 'AI chọn chủ đề phù hợp với khối và môn.' },
  { id: 'topic', title: 'Nhập chủ đề', desc: 'Bạn nhập chủ đề, AI tự xây dàn ý.' },
  { id: 'outline', title: 'Dàn ý hoặc tài liệu', desc: 'AI bám sát dàn ý và tài liệu bạn đưa.' },
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

export function AiStudio({
  account,
  onSaved,
}: {
  account: Account;
  onSaved: (lessonId: string) => void;
}) {
  const { dispatch } = useStore();
  const [grade, setGrade] = useState(5);
  const [subject, setSubject] = useState('Toán');
  const [customSubject, setCustomSubject] = useState('');
  const [roleSentence, setRoleSentence] = useState(() => roleSentenceFor(5, 'Toán'));
  const [roleEdited, setRoleEdited] = useState(false);
  const [mode, setMode] = useState<AuthorMode>('outline');
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState('');
  const [extraRequests, setExtraRequests] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [proposalDraft, setProposalDraft] = useState<string | null>(null);
  const [approvedStructure, setApprovedStructure] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
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

  const refreshRoleSentence = (nextGrade: number, nextSubject: string) => {
    if (!roleEdited) setRoleSentence(roleSentenceFor(nextGrade, nextSubject));
  };

  const changeGrade = (next: number) => {
    const first = SUBJECTS_BY_GRADE[next][0];
    setGrade(next);
    setSubject(first);
    setCustomSubject('');
    setProposalDraft(null);
    setApprovedStructure(null);
    refreshRoleSentence(next, first);
  };

  const changeSubject = (next: string) => {
    setSubject(next);
    setProposalDraft(null);
    setApprovedStructure(null);
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
    mode,
    topic: topic.trim(),
    outline: outline.trim(),
    extraRequests: extraRequests.trim(),
    approvedStructure: approvedStructure ?? undefined,
    attachments: attachments.map(({ name, mimeType, dataBase64 }) => ({ name, mimeType, dataBase64 })),
    ...extra,
  });

  const runCall = async (stage: AiRequestBody['stage'], extra: Partial<AiRequestBody> = {}) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setRetryNotice(null);
    setProgressKb(0);
    try {
      return await callAiSoanBai(buildBody(stage, extra), {
        signal: controller.signal,
        onProgress: setProgressKb,
        onRetry: (violations) =>
          setRetryNotice(`Bản đầu vi phạm hợp đồng output (${violations.join('; ')}). Đang tạo lại…`),
      });
    } finally {
      abortRef.current = null;
    }
  };

  const propose = async () => {
    setStatus('proposing');
    try {
      const result = await runCall('propose');
      if (result.stage === 'propose') {
        setProposalDraft(result.text);
        setWarnings(result.warnings);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof AiApiError) setError({ code: err.code, message: err.message });
    } finally {
      setStatus('idle');
    }
  };

  const generate = async () => {
    if (effectiveSubject === '') {
      setFormHint('Hãy chọn hoặc nhập tên môn học.');
      return;
    }
    if (mode === 'topic' && topic.trim() === '') {
      setFormHint('Chế độ "Nhập chủ đề" cần có chủ đề.');
      return;
    }
    if (mode === 'outline' && outline.trim() === '' && attachments.length === 0) {
      setFormHint('Hãy nhập dàn ý hoặc đính kèm ít nhất một tài liệu.');
      return;
    }
    setFormHint(null);
    setStatus('generating');
    try {
      const result = await runCall('generate');
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
    try {
      const result = await runCall('revise', {
        currentHtml: current.html,
        history: nextChat,
        instruction,
      });
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
      setStatus('idle');
    }
  };

  const saveLesson = () => {
    if (!current) return;
    const lesson: Lesson = {
      id: `AI-${Date.now()}`,
      title: current.title !== '' ? current.title : topic.trim() !== '' ? topic.trim() : 'Bài học AI soạn',
      topicIds: [],
      color: '#2563eb',
      sections: [],
      questionIds: [],
      ownerId: account.id,
      html: current.html,
      grade,
      subject: effectiveSubject,
    };
    dispatch({ type: 'CREATE_LESSON_COPY', lesson });
    onSaved(lesson.id);
  };

  const downloadHtml = () => {
    if (!current) return;
    const name = (current.title !== '' ? current.title : 'bai-hoc').replace(/[\\/:*?"<>|]/g, '_');
    const url = URL.createObjectURL(new Blob([current.html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startNew = () => {
    setVersions([]);
    setCurrentIdx(0);
    setChat([]);
    setProposalDraft(null);
    setApprovedStructure(null);
    setWarnings([]);
    setAssumptions([]);
    setError(null);
  };

  return (
    <div>
      <SectionBand
        title="Soạn bài mới bằng AI"
        guide="Điền khối, môn, dàn ý và tài liệu — AI soạn thành bài học HTML tương tác. Soạn xong, bạn chat với AI để sửa đến khi ưng, rồi bấm Chốt để lưu vào Bài của tôi."
      />

      {error ? (
        <div className="warn-box" role="alert">
          <strong>Không tạo được bài.</strong> {error.message}
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
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Khối {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Môn</span>
              <select value={subject} onChange={(e) => changeSubject(e.target.value)} disabled={busy}>
                {SUBJECTS_BY_GRADE[grade].map((s) => (
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

          <div className="field">
            <span>Cách soạn</span>
            <div className="mode-cards">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={mode === m.id ? 'mode-card mode-card-active' : 'mode-card'}
                  onClick={() => setMode(m.id)}
                  disabled={busy}
                >
                  <strong>{m.title}</strong>
                  <span>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {mode !== 'auto' ? (
            <label className="field">
              <span>Chủ đề{mode === 'topic' ? ' (bắt buộc)' : ' (không bắt buộc)'}</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ví dụ: Phản ứng hoá học"
                disabled={busy}
              />
            </label>
          ) : null}

          {mode !== 'auto' ? (
            <label className="field">
              <span>Dàn ý{mode === 'outline' ? ' (hoặc đính kèm tài liệu bên dưới)' : ' (không bắt buộc)'}</span>
              <textarea
                rows={6}
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                placeholder={'Mỗi dòng một mục, ví dụ:\n- Phản ứng hoá học là gì\n- Dấu hiệu nhận biết\n- Cân bằng phương trình'}
                disabled={busy}
              />
            </label>
          ) : null}

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

          <label className="field">
            <span>Yêu cầu thêm (không bắt buộc)</span>
            <textarea
              rows={3}
              value={extraRequests}
              onChange={(e) => setExtraRequests(e.target.value)}
              placeholder="Ví dụ: Học sinh hay nhầm dấu hiệu vật lý với dấu hiệu hoá học, cần phần phân biệt rõ. Thêm 8 câu luyện tập."
              disabled={busy}
            />
          </label>

          {proposalDraft !== null ? (
            <div className="field">
              <span>Cấu trúc AI đề xuất (sửa được — bấm "Dùng cấu trúc này" để đưa vào bài soạn)</span>
              <textarea
                rows={8}
                value={proposalDraft}
                onChange={(e) => setProposalDraft(e.target.value)}
                disabled={busy}
              />
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setApprovedStructure(proposalDraft);
                    setProposalDraft(null);
                  }}
                  disabled={busy}
                >
                  Dùng cấu trúc này
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setProposalDraft(null)}
                  disabled={busy}
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          ) : null}
          {approvedStructure !== null ? (
            <p className="notice">Đã duyệt cấu trúc — bài soạn sẽ theo đúng cấu trúc này.</p>
          ) : null}

          {formHint ? <p className="guide-text">{formHint}</p> : null}
          {status === 'proposing' || status === 'generating' ? (
            <div className="ai-progress">
              <p>
                {status === 'proposing'
                  ? 'AI đang đề xuất cấu trúc…'
                  : `AI đang soạn bài… đã nhận ${progressKb}KB. Bài dài có thể mất 1–3 phút.`}
              </p>
              {retryNotice ? <p className="guide-text">{retryNotice}</p> : null}
              <button type="button" className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
                Dừng
              </button>
            </div>
          ) : (
            <div className="row-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void propose()}>
                AI đề xuất cấu trúc
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void generate()}>
                Soạn bài
              </button>
            </div>
          )}
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
              {current?.title !== '' ? current?.title : 'Bài học'} · Bản {currentIdx + 1} đang xem
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
              <summary>Ghi chú của AI về bài này (giả định và kiểm tra)</summary>
              <ul>
                {assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {current ? <HtmlLessonPlayer html={current.html} title={current.title} /> : null}

          <h3 className="subhead">Sửa bài bằng chat</h3>
          <p className="guide-text">
            Gõ yêu cầu sửa, AI sẽ soạn lại toàn bộ file. Lời dặn của bạn trong chat luôn thắng dàn ý gốc.
          </p>
          <div className="chat-shell">
            <div className="chat-list">
              {chat.length === 0 ? (
                <p className="guide-text">Chưa có lượt sửa nào. Ví dụ: "Thêm một ví dụ về sắt gỉ" hoặc "Phần 2 ngắn lại, thêm hình".</p>
              ) : (
                chat.map((m, i) => (
                  <div key={i} className={m.from === 'teacher' ? 'chat-msg chat-mine' : 'chat-msg chat-tutor'}>
                    {m.text}
                  </div>
                ))
              )}
              {status === 'revising' ? (
                <div className="chat-msg chat-tutor">AI đang soạn lại… đã nhận {progressKb}KB.</div>
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
            <button type="button" className="btn btn-primary" onClick={saveLesson} disabled={busy}>
              Chốt — lưu vào Bài của tôi
            </button>
            <button type="button" className="btn btn-secondary" onClick={downloadHtml} disabled={busy}>
              Tải file HTML
            </button>
            <button type="button" className="btn btn-ghost" onClick={startNew} disabled={busy}>
              Soạn bài mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
