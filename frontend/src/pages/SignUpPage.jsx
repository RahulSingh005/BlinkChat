import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import { Divider, FormError, PasswordField, StrengthMeter, TextField } from "../components/auth/Fields";
import GoogleButton from "../components/auth/GoogleButton";
import Spinner from "../components/ui/Spinner";
import { errorMessage } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useGoogleEnabled } from "../store/useConfigStore";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpPage() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const google = useGoogleEnabled();

  const errors = {
    fullName: !form.fullName.trim() ? "Tell us your name" : "",
    email: !EMAIL.test(form.email.trim()) ? "Enter a valid email address" : "",
    password: form.password.length < 6 ? "Use at least 6 characters" : "",
  };
  const valid = !errors.fullName && !errors.email && !errors.password;

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true });
    if (!valid) return;
    setError("");
    setBusy(true);
    try {
      await useAuthStore.getState().signup({ ...form, fullName: form.fullName.trim(), email: form.email.trim() });
    } catch (err) {
      setError(errorMessage(err, "Couldn't create your account. Please try again."));
      setBusy(false);
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    error: touched[key] ? errors[key] : "",
  });

  return (
    <AuthLayout>
      <h1 className="text-[1.75rem] font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-base-content/60">Free, no phone number needed.</p>

      {google && (
        <>
          <div className="mt-7">
            <GoogleButton text="signup_with" />
          </div>
          <Divider />
        </>
      )}

      <form onSubmit={submit} className={google ? "space-y-4" : "mt-7 space-y-4"} noValidate>
        <FormError message={error} />
        <TextField id="fullName" label="Full name" autoComplete="name" placeholder="Ava Wilson" maxLength={60} {...field("fullName")} />
        <TextField id="email" label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" {...field("email")} />
        <div>
          <PasswordField autoComplete="new-password" placeholder="At least 6 characters" {...field("password")} />
          <StrengthMeter password={form.password} />
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary h-12 min-h-0 w-full rounded-xl text-[0.95rem]">
          {busy ? <Spinner className="size-5" /> : "Create account"}
        </button>
        <p className="text-center text-xs leading-relaxed text-base-content/50">
          By continuing you agree to the{" "}
          <Link to="/terms" className="underline underline-offset-2 hover:text-base-content">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-base-content">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-base-content/60">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
