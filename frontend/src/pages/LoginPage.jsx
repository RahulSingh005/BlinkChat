import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import { Divider, FormError, PasswordField, TextField } from "../components/auth/Fields";
import GoogleButton from "../components/auth/GoogleButton";
import Spinner from "../components/ui/Spinner";
import { errorMessage } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useFeatures, useGoogleEnabled } from "../store/useConfigStore";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const google = useGoogleEnabled();
  const features = useFeatures();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await useAuthStore.getState().login(form);
    } catch (err) {
      setError(errorMessage(err, "Couldn't sign in. Please try again."));
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-[1.75rem] font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-base-content/60">Sign in to continue to your chats.</p>

      {google && (
        <>
          <div className="mt-7">
            <GoogleButton text="signin_with" />
          </div>
          <Divider />
        </>
      )}

      <form onSubmit={submit} className={google ? "space-y-4" : "mt-7 space-y-4"} noValidate>
        <FormError message={error} />
        <TextField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <PasswordField
          autoComplete="current-password"
          placeholder="Your password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          right={
            features.passwordReset !== false && (
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            )
          }
        />
        <button type="submit" disabled={busy || !form.email || !form.password} className="btn btn-primary h-12 min-h-0 w-full rounded-xl text-[0.95rem]">
          {busy ? <Spinner className="size-5" /> : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-base-content/60">
        New to BlinkChat?{" "}
        <Link to="/signup" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
