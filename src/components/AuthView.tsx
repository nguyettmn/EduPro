// Real authentication: email + password via Supabase Auth, replacing the
// old mock-login picker. Signup offers the three self-service roles
// (Principal / Teacher / Student); Team Lead is a later promotion by the
// Principal. Approval happens after signup: a school teacher/student who
// picked a school starts 'pending' and still gets their private
// workspace, while school-scoped things unlock on approval.
import { useEffect, useState } from 'react';
import type { Role, School } from '../types';
import { ROLE_META } from '../types';
import { supabase } from '../supabase/client';

type Tab = 'login' | 'signup';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Email hoặc mật khẩu chưa đúng. Hãy thử lại.';
  }
  if (message.includes('already been registered') || message.includes('User already registered')) {
    return 'Email này đã có tài khoản. Hãy đăng nhập.';
  }
  if (message.includes('Password should be at least')) {
    return 'Mật khẩu cần ít nhất 6 ký tự.';
  }
  if (message.includes('Email rate limit exceeded')) {
    return 'Bạn thử quá nhanh. Đợi một lát rồi thử lại.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Email chưa được xác nhận. Hãy kiểm tra hộp thư của bạn.';
  }
  if (message.includes('same password')) {
    return 'Mật khẩu mới cần khác mật khẩu cũ.';
  }
  return message;
}

export function SetPasswordView({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirm) {
      setError('Hai mật khẩu chưa khớp nhau.');
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    onDone();
  };

  return (
    <div className="picker-page">
      <div className="picker-card">
        <div className="picker-logo">EduPro</div>
        <h1 className="picker-title">Đặt mật khẩu cho tài khoản của bạn</h1>
        <p className="picker-guide">
          Bạn vừa mở đường link mời hoặc đặt lại mật khẩu. Đặt một mật khẩu mới để bắt đầu dùng EduPro.
        </p>
        <label className="field">
          <span>Mật khẩu mới</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span>Nhập lại mật khẩu</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error ? <p className="feedback-bad">{error}</p> : null}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </button>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Email chưa đúng định dạng. Ví dụ: lan@example.com');
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) setError(friendlyError(err.message));
  };

  const sendReset = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Nhập email của bạn rồi bấm gửi link đặt lại mật khẩu.');
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    setForgotSent(true);
  };

  if (forgot) {
    return (
      <div>
        <p className="picker-guide">
          Nhập email đăng ký, EduPro sẽ gửi link đặt lại mật khẩu. Mở link đó trong email để đặt mật khẩu mới.
        </p>
        <label className="field">
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ví dụ: lan@example.com"
            inputMode="email"
            autoComplete="email"
          />
        </label>
        {error ? <p className="feedback-bad">{error}</p> : null}
        {forgotSent ? (
          <p className="feedback-ok">Đã gửi email. Hãy kiểm tra hộp thư (cả mục spam) nhé.</p>
        ) : null}
        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void sendReset()}>
            Gửi link đặt lại mật khẩu
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setForgot(false)}>
            Quay lại đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="field">
        <span>Email</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ví dụ: lan@example.com"
          inputMode="email"
          autoComplete="email"
        />
      </label>
      <label className="field">
        <span>Mật khẩu</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      </label>
      {error ? <p className="feedback-bad">{error}</p> : null}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
      <p className="picker-guide">
        <button type="button" className="btn btn-ghost" onClick={() => setForgot(true)}>
          Quên mật khẩu?
        </button>
      </p>
    </div>
  );
}

const SIGNUP_ROLES: Role[] = ['principal', 'teacher', 'student'];

function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('teacher');
  const [schoolName, setSchoolName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [independent, setIndependent] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void supabase
      .from('schools')
      .select('id, name')
      .order('name')
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setSchoolsError('Không tải được danh sách trường. Kiểm tra mạng rồi tải lại trang nhé.');
          return;
        }
        setSchools((data ?? []) as School[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (cleanName === '') {
      setError('Hãy nhập tên của bạn.');
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Email chưa đúng định dạng. Ví dụ: lan@example.com');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    if (role === 'principal' && schoolName.trim() === '') {
      setError('Hiệu trưởng đăng ký cho một trường mới: hãy nhập tên trường.');
      return;
    }
    if (role !== 'principal' && !independent && schoolId === '') {
      setError('Hãy chọn trường của bạn, hoặc tick “không thuộc trường nào”.');
      return;
    }
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const metadata: Record<string, unknown> = {
      name: cleanName,
      role,
      invited: 'false',
    };
    if (role === 'principal') {
      metadata.school_name = schoolName.trim();
    } else if (!independent) {
      metadata.school_id = schoolId;
    }
    const { data, error: err } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: metadata },
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    // Supabase fakes success for an already-registered email when email
    // confirmation is on: the user comes back with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('Email này đã có tài khoản. Hãy đăng nhập.');
      return;
    }
    if (!data.session) {
      // Email confirmation is on: the account exists, the user must click
      // the link in their inbox before signing in.
      setCheckEmail(true);
    }
    // With a session, the auth listener takes over and loads the app.
  };

  const resend = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    setResent(true);
  };

  if (checkEmail) {
    return (
      <div>
        <p className="picker-guide">
          Tài khoản đã được tạo. EduPro vừa gửi một email xác nhận tới <strong>{email.trim()}</strong>.
          Hãy mở email đó và bấm vào link xác nhận, rồi quay lại đây đăng nhập nhé.
        </p>
        {resent ? <p className="feedback-ok">Đã gửi lại email xác nhận.</p> : null}
        {error ? <p className="feedback-bad">{error}</p> : null}
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void resend()}>
          Gửi lại email xác nhận
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="field">
        <span>Họ và tên</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className="field">
        <span>Email</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ví dụ: lan@example.com"
          inputMode="email"
          autoComplete="email"
        />
      </label>
      <label className="field">
        <span>Mật khẩu (ít nhất 6 ký tự)</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <div className="field">
        <span>Tôi là</span>
        {SIGNUP_ROLES.map((r) => (
          <label key={r} className="check-row">
            <input
              type="radio"
              name="signup-role"
              checked={role === r}
              onChange={() => setRole(r)}
            />
            <span style={{ color: ROLE_META[r].color }}>{ROLE_META[r].label}</span>
          </label>
        ))}
      </div>
      {role === 'principal' ? (
        <label className="field">
          <span>Tên trường mới của bạn</span>
          <input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="Ví dụ: Trường Tiểu học An Bình"
          />
        </label>
      ) : (
        <>
          <label className="check-row">
            <input
              type="checkbox"
              checked={independent}
              onChange={(e) => setIndependent(e.target.checked)}
            />
            <span>
              {role === 'teacher'
                ? 'Tôi dạy độc lập, không thuộc trường nào'
                : 'Tôi chưa thuộc trường nào'}
            </span>
          </label>
          {!independent ? (
            <label className="field">
              <span>Trường của bạn</span>
              {schoolsError ? (
                <p className="feedback-bad">{schoolsError}</p>
              ) : (
                <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                  <option value="">— Chọn trường —</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : null}
          <p className="picker-guide">
            {role === 'teacher'
              ? 'Giáo viên chọn trường sẽ cần hiệu trưởng duyệt mới thấy nội dung của trường, nhưng vẫn soạn bài, tạo game và dạy lớp riêng ngay từ lúc đăng ký.'
              : 'Học sinh chọn trường sẽ được kích hoạt khi thầy cô xếp em vào lớp. Trong lúc chờ, em vẫn dùng được Tutor Space.'}
          </p>
        </>
      )}
      {error ? <p className="feedback-bad">{error}</p> : null}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
        {busy ? 'Đang tạo tài khoản…' : 'Đăng ký'}
      </button>
    </div>
  );
}

export function AuthView() {
  const [tab, setTab] = useState<Tab>('login');
  return (
    <div className="picker-page">
      <div className="picker-card">
        <div className="picker-logo">EduPro</div>
        <h1 className="picker-title">
          {tab === 'login' ? 'Đăng nhập EduPro' : 'Đăng ký tài khoản EduPro'}
        </h1>
        <div className="tabs" role="tablist">
          <button
            type="button"
            className={tab === 'login' ? 'tab tab-active' : 'tab'}
            onClick={() => setTab('login')}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={tab === 'signup' ? 'tab tab-active' : 'tab'}
            onClick={() => setTab('signup')}
          >
            Đăng ký
          </button>
        </div>
        {tab === 'login' ? <LoginForm /> : <SignupForm />}
      </div>
    </div>
  );
}
