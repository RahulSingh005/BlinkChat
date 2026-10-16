import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function TextField({ label, id, error, hint, className = "", ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} className={`field ${error ? "border-error focus:border-error focus:ring-error/15" : ""}`} aria-invalid={Boolean(error)} {...props} />
      {error ? <p className="mt-1.5 text-xs text-error">{error}</p> : hint ? <p className="mt-1.5 text-xs text-base-content/50">{hint}</p> : null}
    </div>
  );
}

export function PasswordField({ label = "Password", id = "password", error, right, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-base-content/80">
          {label}
        </label>
        {right}
      </div>
      <div className="relative">
        <input id={id} type={show ? "text" : "password"} className={`field pr-12 ${error ? "border-error" : ""}`} aria-invalid={Boolean(error)} {...props} />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-base-content/45 transition hover:text-base-content"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
}

function strength(password = "") {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length < 6) return { score: 0, label: "Too short" };
  if (score <= 1) return { score: 1, label: "Weak" };
  if (score <= 3) return { score: 2, label: "Good" };
  return { score: 3, label: "Strong" };
}

export function StrengthMeter({ password }) {
  if (!password) return null;
  const s = strength(password);
  const colors = ["bg-error", "bg-error", "bg-warning", "bg-success"];
  return (
    <div className="mt-2 flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= s.score ? colors[s.score] : "bg-base-300"}`} />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-base-content/55">{s.label}</span>
    </div>
  );
}

export function Divider({ children = "or" }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-base-content/40">
      <span className="h-px flex-1 bg-base-300" />
      {children}
      <span className="h-px flex-1 bg-base-300" />
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="anim-slide-down mb-4 rounded-xl border border-error/30 bg-error/10 px-3.5 py-2.5 text-sm text-error">
      {message}
    </div>
  );
}
