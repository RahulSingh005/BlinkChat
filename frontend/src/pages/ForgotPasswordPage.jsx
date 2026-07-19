import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import AuthImagePattern from "../components/AuthImagePattern";
import { useAuthStore } from "../store/useAuthStore";

const RESEND_COOLDOWN = 30;

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const {
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    isSendingOtp,
    isVerifyingOtp,
    isResettingPassword,
  } = useAuthStore();

  const [step, setStep] = useState("email"); // email -> otp -> password -> done
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await forgotPassword(email.trim());
    if (ok) {
      setStep("otp");
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const ok = await forgotPassword(email.trim());
    if (ok) setCooldown(RESEND_COOLDOWN);
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split("");
    while (next.length < 6) next.push("");
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return;
    const ok = await verifyResetOtp(email.trim(), code);
    if (ok) setStep("password");
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    if (newPassword !== confirmPassword) return;
    const ok = await resetPassword(email.trim(), newPassword);
    if (ok) setStep("done");
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-mesh relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-float-delayed pointer-events-none" />

      <div className="relative z-10 flex flex-col justify-center items-center p-6 sm:p-12">
        <Link
          to="/login"
          className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-base-content/60 hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>

        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="bg-base-100/70 backdrop-blur-xl border border-base-300/60 rounded-3xl shadow-2xl shadow-primary/5 p-8 sm:p-10">
            <div className="text-center mb-8">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                  {step === "done" ? (
                    <ShieldCheck className="w-7 h-7 text-primary-content" />
                  ) : (
                    <MessageSquare className="w-7 h-7 text-primary-content" />
                  )}
                </div>
                <h1 className="text-2xl font-extrabold mt-3 tracking-tight">
                  {step === "email" && "Forgot your password?"}
                  {step === "otp" && "Check your email"}
                  {step === "password" && "Set a new password"}
                  {step === "done" && "Password updated!"}
                </h1>
                <p className="text-base-content/60 text-sm text-center">
                  {step === "email" && "Enter your email and we'll send you a verification code."}
                  {step === "otp" && (
                    <>
                      We sent a 6-digit code to <span className="font-medium">{email}</span>
                    </>
                  )}
                  {step === "password" && "Choose a new password for your account."}
                  {step === "done" && "You can now sign in with your new password."}
                </p>
              </div>
            </div>

            {step === "email" && (
              <form onSubmit={handleSendOtp} className="space-y-6">
                <div className="form-control">
                  <label className="label" htmlFor="email">
                    <span className="label-text font-medium">Email</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-base-content/40" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      className="input input-bordered w-full pl-10 rounded-xl focus:input-primary"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-full rounded-xl flex items-center justify-center gap-2"
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Sending code...
                    </>
                  ) : (
                    "Send verification code"
                  )}
                </button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="input input-bordered size-12 text-center text-lg font-bold rounded-xl focus:input-primary"
                      aria-label={`Digit ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full rounded-xl flex items-center justify-center gap-2"
                  disabled={isVerifyingOtp || otp.join("").length !== 6}
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Verify code"
                  )}
                </button>

                <div className="text-center text-sm text-base-content/60">
                  Didn&apos;t get a code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || isSendingOtp}
                    className="link link-primary font-medium disabled:no-underline disabled:text-base-content/40"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-xs text-base-content/50 hover:text-primary flex items-center gap-1 mx-auto"
                >
                  <ArrowLeft className="size-3" /> Use a different email
                </button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="form-control">
                  <label className="label" htmlFor="newPassword">
                    <span className="label-text font-medium">New password</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-base-content/40" />
                    </div>
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      className="input input-bordered w-full pl-10 rounded-xl focus:input-primary"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-base-content/40" />
                      ) : (
                        <Eye className="h-5 w-5 text-base-content/40" />
                      )}
                    </button>
                  </div>
                  {newPassword && newPassword.length < 6 && (
                    <span className="text-error text-xs mt-1">At least 6 characters</span>
                  )}
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="confirmPassword">
                    <span className="label-text font-medium">Confirm password</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-base-content/40" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      className="input input-bordered w-full pl-10 rounded-xl focus:input-primary"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <span className="text-error text-xs mt-1">Passwords don&apos;t match</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full rounded-xl flex items-center justify-center gap-2"
                  disabled={
                    isResettingPassword ||
                    newPassword.length < 6 ||
                    newPassword !== confirmPassword
                  }
                >
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Updating...
                    </>
                  ) : (
                    "Update password"
                  )}
                </button>
              </form>
            )}

            {step === "done" && (
              <button
                onClick={() => navigate("/login")}
                className="btn btn-primary w-full rounded-xl"
              >
                Back to sign in
              </button>
            )}

            {step === "email" && (
              <div className="text-center mt-6">
                <p className="text-base-content/60">
                  Remembered it?{" "}
                  <Link to="/login" className="link link-primary font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthImagePattern
        title="Let's get you back in"
        subtitle="A quick verification code is all it takes to reset your password securely."
      />
    </div>
  );
};

export default ForgotPasswordPage;
