// Hồ sơ giảng dạy: the teacher's pre-selected grades + subjects.
// Lives in Hồ sơ (settings). The AI authoring flow offers only these
// grades/subjects when a profile is set, so the teacher never re-picks
// them for every lesson. Teachers can return here any time to add more
// grades or subjects, and can add a subject by hand when the master list
// misses one (user decision 2026-11-15).
import { useState } from 'react';
import type { Account } from '../types';
import { GRADES, SUBJECTS_BY_GRADE } from '../ai/subjects';
import { canDo } from '../permissions';
import { useStore } from '../state/store';

export function TeachingProfileForm({ account }: { account: Account }) {
  const { dispatch } = useStore();
  const [grades, setGrades] = useState<number[]>(account.teachingProfile?.grades ?? []);
  const [picked, setPicked] = useState<Record<string, string[]>>(
    account.teachingProfile?.subjectsByGrade ?? {},
  );
  // Hand-added subjects already saved: those not on the master list.
  // Kept separately so unticking one never loses it from the form.
  const [customs, setCustoms] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    const saved = account.teachingProfile?.subjectsByGrade ?? {};
    for (const [g, subs] of Object.entries(saved)) {
      const extra = subs.filter((s) => !SUBJECTS_BY_GRADE[Number(g)]?.includes(s));
      if (extra.length > 0) out[g] = extra;
    }
    return out;
  });
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  if (!canDo(account, 'createContent')) return null;

  const toggleGrade = (grade: number) => {
    setSaved(false);
    if (grades.includes(grade)) {
      setPicked((p) => {
        const next = { ...p };
        delete next[String(grade)];
        return next;
      });
      setGrades((prev) => prev.filter((g) => g !== grade));
    } else {
      setGrades((prev) => [...prev, grade].sort((a, b) => a - b));
    }
  };

  const toggleSubject = (grade: number, subject: string) => {
    setSaved(false);
    const key = String(grade);
    setPicked((prev) => {
      const list = prev[key] ?? [];
      return {
        ...prev,
        [key]: list.includes(subject) ? list.filter((s) => s !== subject) : [...list, subject],
      };
    });
  };

  const addCustomSubject = (grade: number) => {
    const key = String(grade);
    const name = (customDrafts[key] ?? '').trim();
    if (name === '') return;
    const options = [...(SUBJECTS_BY_GRADE[grade] ?? []), ...(customs[key] ?? [])];
    if (options.includes(name)) return;
    setSaved(false);
    setCustoms((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), name] }));
    setPicked((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), name] }));
    setCustomDrafts((prev) => ({ ...prev, [key]: '' }));
  };

  const save = () => {
    const subjectsByGrade: Record<string, string[]> = {};
    for (const g of grades) subjectsByGrade[String(g)] = picked[String(g)] ?? [];
    dispatch({
      type: 'SET_TEACHING_PROFILE',
      accountId: account.id,
      profile: { grades, subjectsByGrade },
    });
    setSaved(true);
  };

  return (
    <div className="form-card">
      <h3 className="subhead">Hồ sơ giảng dạy</h3>
      <p className="guide-text">
        Chọn khối và môn bạn dạy. Khi soạn bài bằng AI, bạn chỉ cần chọn trong danh sách này, khỏi
        chọn lại mỗi lần. Quay lại đây bất cứ lúc nào để thêm khối hoặc môn.
      </p>
      <div className="field">
        <span>Khối lớp bạn dạy</span>
        <div className="check-grid">
          {GRADES.map((g) => (
            <label key={g} className="check-row">
              <input type="checkbox" checked={grades.includes(g)} onChange={() => toggleGrade(g)} />
              Khối {g}
            </label>
          ))}
        </div>
      </div>
      {grades.map((g) => {
        const key = String(g);
        const options = [...(SUBJECTS_BY_GRADE[g] ?? []), ...(customs[key] ?? [])];
        return (
          <div className="field" key={g}>
            <span>Môn dạy ở Khối {g}</span>
            <div className="check-grid">
              {options.map((s) => (
                <label key={s} className="check-row">
                  <input
                    type="checkbox"
                    checked={(picked[key] ?? []).includes(s)}
                    onChange={() => toggleSubject(g, s)}
                  />
                  {s}
                </label>
              ))}
            </div>
            <div className="inline-add">
              <label className="field">
                <span>Thêm môn khác (nếu danh sách thiếu)</span>
                <input
                  value={customDrafts[key] ?? ''}
                  onChange={(e) => setCustomDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="Ví dụ: Khoa học máy tính"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomSubject(g);
                    }
                  }}
                />
              </label>
              <button type="button" className="btn btn-secondary" onClick={() => addCustomSubject(g)}>
                Thêm môn
              </button>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-primary" onClick={save}>
        Lưu hồ sơ giảng dạy
      </button>
      {saved ? (
        <p className="feedback-ok">
          Đã lưu. Vào Soạn bài → Soạn bài mới (AI) sẽ thấy đúng các khối và môn bạn đã chọn.
        </p>
      ) : null}
    </div>
  );
}
