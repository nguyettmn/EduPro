// Lên chương trình hàng loạt: the teacher uploads syllabus materials,
// AI proposes LESSON NAMES ONLY (no content, no Topic grouping here),
// the teacher keeps/discards/adds names by hand, then clicks a name to
// compose it in the AI studio. Finished lessons land in "Bài của tôi"
// and are grouped by Topic there (user decision 2026-11-16).
import { useRef, useState } from 'react';
import type { Account } from '../types';
import { gradesFor, roleSentenceFor, subjectsFor } from '../ai/subjects';
import type { WireAttachment } from '../ai/apiTypes';
import { AiApiError, callAiJson } from '../ai/client';
import { EmptyState } from './ui';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const CUSTOM_SUBJECT = '__custom__';

export interface BatchItem {
  id: string;
  title: string;
  status: 'kept' | 'discarded' | 'done';
  source: 'ai' | 'manual';
}

interface LocalAttachment extends WireAttachment {
  id: string;
  size: number;
}

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

export function BatchPlanner({
  account,
  items,
  onItemsChange,
  onCompose,
  onOpenSettings,
}: {
  account: Account;
  items: BatchItem[];
  onItemsChange: (items: BatchItem[]) => void;
  onCompose: (prefill: { topic: string; grade: number; subject: string }) => void;
  onOpenSettings: () => void;
}) {
  const profile = account.teachingProfile;
  const gradeOptions = gradesFor(profile);
  const startGrade = gradeOptions[0] ?? 5;
  const startSubject = subjectsFor(profile, startGrade)[0] ?? 'Toán';
  const [grade, setGrade] = useState(startGrade);
  const [subject, setSubject] = useState(startSubject);
  const [customSubject, setCustomSubject] = useState('');
  const [roleSentence, setRoleSentence] = useState(() => roleSentenceFor(startGrade, startSubject));
  const [roleEdited, setRoleEdited] = useState(false);
  const [syllabus, setSyllabus] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSubject = subject === CUSTOM_SUBJECT ? customSubject.trim() : subject;
  const kept = items.filter((i) => i.status === 'kept');
  const discarded = items.filter((i) => i.status === 'discarded');
  const done = items.filter((i) => i.status === 'done');

  const refreshRoleSentence = (nextGrade: number, nextSubject: string) => {
    if (!roleEdited) setRoleSentence(roleSentenceFor(nextGrade, nextSubject));
  };

  const changeGrade = (next: number) => {
    const first = subjectsFor(profile, next)[0] ?? 'Toán';
    setGrade(next);
    setSubject(first);
    setCustomSubject('');
    refreshRoleSentence(next, first);
  };

  const changeSubject = (next: string) => {
    setSubject(next);
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
        setAttachError(`File "${file.name}" quá lớn (tối đa 3MB mỗi file).`);
        continue;
      }
      if (total + file.size > MAX_TOTAL_BYTES) {
        setAttachError('Tổng dung lượng file đính kèm tối đa 3MB trong bản test.');
        continue;
      }
      total += file.size;
      const dataBase64 = await readFileAsBase64(file);
      next.push({
        id: `att-${Date.now()}-${next.length}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64,
        size: file.size,
      });
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const analyze = async () => {
    setWorking(true);
    setError(null);
    try {
      const data = await callAiJson<{ lessons: { title: string }[] }>({
        stage: 'plan',
        grade,
        subject: effectiveSubject,
        roleSentence,
        mode: 'outline',
        topic: '',
        outline: syllabus,
        extraRequests: '',
        attachments: attachments.map(({ id: _id, size: _size, ...w }) => w),
      });
      onItemsChange(
        data.lessons.map((l, i) => ({
          id: `BP-${Date.now()}-${i}`,
          title: l.title,
          status: 'kept' as const,
          source: 'ai' as const,
        })),
      );
    } catch (err) {
      if (err instanceof AiApiError) setError({ code: err.code, message: err.message });
      else setError({ code: 'unknown', message: 'Không phân tích được. Hãy thử lại.' });
    } finally {
      setWorking(false);
    }
  };

  const setStatus = (id: string, status: BatchItem['status']) =>
    onItemsChange(items.map((i) => (i.id === id ? { ...i, status } : i)));

  const addManual = () => {
    const title = manualTitle.trim();
    if (title === '') return;
    onItemsChange([
      ...items,
      { id: `BP-${Date.now()}-m`, title, status: 'kept', source: 'manual' },
    ]);
    setManualTitle('');
  };

  const showSetupSteps = error?.code === 'missing_key' || error?.code === 'invalid_key';

  return (
    <div>
      <p className="guide-text">
        Tải đề cương hoặc tài liệu lên, AI sẽ phân tích và gợi ý TÊN các bài học theo thứ tự dạy. Bạn
        chọn giữ bài nào, bỏ bài nào, thêm bài bằng tay, rồi bấm vào từng bài để soạn. Gom theo Topic
        làm sau, trong Bài của tôi.
      </p>
      <div className="field-row">
        <label className="field">
          <span>Khối lớp</span>
          <select value={grade} onChange={(e) => changeGrade(Number(e.target.value))}>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Môn học</span>
          <select value={subject} onChange={(e) => changeSubject(e.target.value)}>
            {subjectsFor(profile, grade).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={CUSTOM_SUBJECT}>Môn khác (gõ tay)…</option>
          </select>
        </label>
        {subject === CUSTOM_SUBJECT ? (
          <label className="field">
            <span>Tên môn</span>
            <input
              value={customSubject}
              onChange={(e) => {
                setCustomSubject(e.target.value);
                refreshRoleSentence(grade, e.target.value.trim() || 'môn học');
              }}
              placeholder="Ví dụ: Khoa học máy tính"
            />
          </label>
        ) : null}
      </div>
      <p className="guide-text">
        {profile
          ? 'Danh sách khối/môn lấy từ Hồ sơ giảng dạy của bạn.'
          : 'Bạn chưa chọn khối/môn mặc định trong Hồ sơ — đang hiện tất cả các khối và môn.'}{' '}
        <button type="button" className="btn btn-ghost btn-small" onClick={onOpenSettings}>
          Mở Hồ sơ
        </button>
      </p>
      <label className="field">
        <span>Vai trò của AI (câu mở đầu của yêu cầu gửi cho AI)</span>
        <input
          value={roleSentence}
          onChange={(e) => {
            setRoleSentence(e.target.value);
            setRoleEdited(true);
          }}
        />
      </label>
      <label className="field">
        <span>Đề cương / chương trình (dán văn bản, không bắt buộc)</span>
        <textarea
          rows={5}
          value={syllabus}
          onChange={(e) => setSyllabus(e.target.value)}
          placeholder="Dán đề cương, khung chương trình, hoặc ghi các chủ đề cần dạy…"
        />
      </label>
      <div className="field">
        <span>Tài liệu đính kèm (ảnh, PDF, DOCX, TXT — tối đa 3MB)</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.docx,.txt"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {attachError ? <p className="feedback-bad">{attachError}</p> : null}
        {attachments.length > 0 ? (
          <div className="attach-list">
            {attachments.map((a) => (
              <div key={a.id} className="attach-row">
                <span>
                  {a.name} ({formatKb(a.size)})
                </span>
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                >
                  Gỡ
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="row-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={working || effectiveSubject === ''}
          onClick={() => void analyze()}
        >
          {working ? 'AI đang phân tích…' : 'Yêu cầu AI phân tích & tạo khung'}
        </button>
      </div>
      {error ? (
        <div className="warn-box">
          <strong>Không phân tích được.</strong> {error.message}
          {showSetupSteps ? (
            <ol className="ai-setup-steps">
              <li>
                Vào <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">Google AI Studio</a> để
                tạo API key Gemini (miễn phí).
              </li>
              <li>Mở project EduPro trong Vercel → Settings → Environment Variables.</li>
              <li>
                Thêm biến <code>GEMINI_API_KEY</code> rồi Redeploy.
              </li>
            </ol>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div>
          <h3 className="subhead">
            Khung chương trình — Giữ {kept.length} · Bỏ {discarded.length} · Đã soạn {done.length}
          </h3>
          <div className="batch-list">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={item.status === 'discarded' ? 'batch-row batch-row-discarded' : 'batch-row'}
              >
                <span className="muted">{idx + 1}.</span>
                <span className="batch-title">{item.title}</span>
                {item.source === 'manual' ? <span className="muted">(thêm tay)</span> : null}
                {item.status === 'done' ? (
                  <span className="feedback-ok">Đã soạn xong</span>
                ) : null}
                <span className="row-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() =>
                      onCompose({ topic: item.title, grade, subject: effectiveSubject })
                    }
                  >
                    {item.status === 'done' ? 'Soạn lại' : 'Soạn bài này'}
                  </button>
                  {item.status === 'discarded' ? (
                    <button
                      type="button"
                      className="btn btn-small btn-secondary"
                      onClick={() => setStatus(item.id, 'kept')}
                    >
                      Giữ lại
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      onClick={() => setStatus(item.id, 'discarded')}
                    >
                      Bỏ
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState text="Chưa có khung chương trình nào. Tải tài liệu lên và bấm phân tích, hoặc thêm bài bằng tay ở dưới." />
      )}
      <div className="inline-add">
        <label className="field">
          <span>Thêm bài bằng tay</span>
          <input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addManual();
              }
            }}
            placeholder="Tên bài học…"
          />
        </label>
        <button type="button" className="btn btn-secondary" onClick={addManual}>
          Thêm bài
        </button>
      </div>
    </div>
  );
}
