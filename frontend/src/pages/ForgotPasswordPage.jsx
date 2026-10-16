import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, MailCheck } from "lucide-react";
import AuthLayout from "../components/auth/AuthLayout";
import { FormError, PasswordField, StrengthMeter, TextField } from "../components/auth/Fields";
import Spinner from "../components/ui/Spinner";
import { api, errorMessage } from "../lib/api";
import { useFeatures } from "../store/useConfigStore";

const RESEND_SECONDS = 45;

function OtpInput({ value, onChange, onComplete, disabled }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const set = (next) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d.trim()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          aria-label={`Digit ${i + 1}`}
          className="field h-14 w-full px-0 text-center text-xl font-semibold tabular-nums"
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            if (typed.length > 1) {
              set(typed); // paste / autofill of the whole code
              refs.current[Math.min(5, typed.length - 1)]?.focus();
              return;
            }
            const next = value.slice(0, i) + typed + value.slice(i + 1);
            set(next);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (value[i]) set(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) {
                set(value.slice(0, i - 1) + value.slice(i));
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            set(e.clipboardData.getData("text"));
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const features = useFeatures();
  const [step, setStep] = useState("email"); // email | code | password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e) => {
    e?.preventDefault();
    run(async () => {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
    });
  };

  const verify = (value = code) =>
    run(async () => {
      const res = await api.post("/auth/verify-reset-otp", { email: email.trim(), otp: value });
      setResetToken(res.data.resetToken);
      setStep("password");
    });

  const reset = (e) => {
    e.preventDefault();
    if (password.length < 6) return setError("Use at least 6 characters");
    if (password !== confirm) return setError("Passwords don't match");
    run(async () => {
      await api.post("/auth/reset-password", { email: email.trim(), resetToken, newPassword: password });
      toast.success("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    });
  };

  if (features.passwordReset === false) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-bold tracking-tight">Password reset unavailable</h1>
        <p className="mt-2 text-sm text-base-content/60">Email isn't set up on this server yet, so codes can't be sent. Ask the administrator to configure SMTP.</p>
        <Link to="/login" className="btn mt-6 h-11 min-h-0 w-full rounded-xl">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-base-content/55 hover:text-base-content">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>

      {step === "email" && (
        <form onSubmit={sendCode} className="anim-fade space-y-4">
          <div>
            <h1 className="text-[1.75rem] font-bold tracking-tight">Reset your password</h1>
            <p className="mt-1 text-sm text-base-content/60">We'll email you a 6-digit code.</p>
          </div>
          <FormError message={error} />
          <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <button type="submit" disabled={busy || !email.trim()} className="btn btn-primary h-12 min-h-0 w-full rounded-xl">
            {busy ? <Spinner className="size-5" /> : "Send code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <div className="anim-fade space-y-5">
          <div>
            <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MailCheck className="size-6" />
            </span>
            <h1 className="text-[1.75rem] font-bold tracking-tight">Check your email</h1>
            <p className="mt-1 text-sm text-base-content/60">
              If an account exists for <span className="font-medium text-base-content">{email}</span>, we sent a code. It expires in 10 minutes.
            </p>
          </div>
          <FormError message={error} />
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
          <button type="button" onClick={() => verify()} disabled={busy || code.length !== 6} className="btn btn-primary h-12 min-h-0 w-full rounded-xl">
            {busy ? <Spinner className="size-5" /> : "Verify code"}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-base-content/55 hover:text-base-content" onClick={() => setStep("email")}>
              Use a different email
            </button>
            <button type="button" disabled={cooldown > 0 || busy} onClick={sendCode} className="font-semibold text-primary disabled:font-normal disabled:text-base-content/40">
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}

      {step === "password" && (
        <form onSubmit={reset} className="anim-fade space-y-4">
          <div>
            <h1 className="text-[1.75rem] font-bold tracking-tight">Choose a new password</h1>
            <p className="mt-1 text-sm text-base-content/60">You'll be signed out on your other devices.</p>
          </div>
          <FormError message={error} />
          <div>
            <PasswordField id="new-password" label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <StrengthMeter password={password} />
          </div>
          <PasswordField id="confirm-password" label="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button type="submit" disabled={busy || !password || !confirm} className="btn btn-primary h-12 min-h-0 w-full rounded-xl">
            {busy ? <Spinner className="size-5" /> : "Update password"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
