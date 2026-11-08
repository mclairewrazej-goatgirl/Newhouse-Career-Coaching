import { useId, useState, type FormEvent } from 'react';
import { DEMO_PASSWORD } from '../api/demo';
import type { Api, LoginResult } from '../api/types';
import { signInErrorMessage } from './signInErrors';

interface Props {
  api: Api;
  demo: boolean;
  initialEmail: string;
  /** Shown above the form, e.g. after a sign-in expires. */
  notice: string;
  onSignedIn: (result: LoginResult) => void;
}

export function SignIn({ api, demo, initialEmail, notice, onSignedIn }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorId = useId();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.login(email.trim(), password);
      setBusy(false);
      onSignedIn(result);
    } catch (err) {
      setError(signInErrorMessage(err));
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <main className="center-screen">
      <form className="card narrow" onSubmit={submit} noValidate aria-describedby={error ? errorId : undefined}>
        <h1 className="display brand">Coaching Tracker</h1>
        <p className="muted">Sign in with the email and password you chose in your sheet.</p>
        {notice && !error && <p className="notice" role="status">{notice}</p>}
        {demo && (
          <p className="notice">
            Demo: use any email and the password <strong>{DEMO_PASSWORD}</strong>.
          </p>
        )}
        {error && <p id={errorId} className="notice error" role="alert">{error}</p>}

        <label className="field-label" htmlFor="email">Email</label>
        <input
          id="email" className="field" type="email" autoComplete="username" inputMode="email"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />

        <label className="field-label" htmlFor="password">Password</label>
        <div className="field-with-button">
          <input
            id="password" className="field" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          <button
            type="button" className="btn-quiet" aria-pressed={showPassword} aria-controls="password"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button type="submit" className="btn-primary wide" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="hint">
          Forgot your password? Open your Google Sheet on a computer and choose{' '}
          <strong>Coaching Tracker › Change email or password</strong>.
        </p>
      </form>
    </main>
  );
}
