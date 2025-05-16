import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User } from "lucide-react";
import { Link } from "react-router-dom";
import AuthImagePattern from "../components/AuthImagePattern.jsx";
import toast from "react-hot-toast";

// Simple password strength checker
const getPasswordStrength = (password) => {
  if (!password) return "";
  if (password.length < 6) return "Weak";
  if (password.match(/[A-Z]/) && password.match(/[0-9]/) && password.length >= 8) return "Strong";
  return "Medium";
};

const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const { signup, isSigningUp } = useAuthStore();

  const validateForm = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = "Full name is required";
    if (!formData.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = "Invalid email format";
    if (!formData.password) errs.password = "Password is required";
    else if (formData.password.length < 6) errs.password = "Password must be at least 6 characters";
    setErrors(errs);
    if (Object.keys(errs).length) {
      Object.values(errs).forEach((msg) => toast.error(msg));
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) signup(formData);
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gradient-to-br from-base-200 via-base-100 to-base-300">
      {/* Left side */}
      <div className="flex flex-col justify-center items-center p-4 sm:p-8 pt-12">
        <div className="w-full max-w-sm space-y-6 animate-fade-in">
          {/* Logo & Heading */}
          <div className="text-center mb-2">
            <div className="flex flex-col items-center gap-2 group">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <MessageSquare className="size-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mt-2 tracking-tight">
                Join <span className="text-primary">BlinkChat</span>
              </h1>
              <p className="text-base-content/60 text-sm">Create your free account</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign up form">
            {/* Full Name */}
            <div className="form-control">
              <label className="label" htmlFor="fullName">
                <span className="label-text font-medium text-sm">Full Name</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="size-4 text-base-content/40" />
                </div>
                <input
                  id="fullName"
                  type="text"
                  className={`input input-bordered w-full pl-10 text-sm ${errors.fullName ? "input-error" : ""}`}
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  aria-required="true"
                  aria-invalid={!!errors.fullName}
                />
              </div>
              {errors.fullName && <span className="text-error text-xs mt-1">{errors.fullName}</span>}
            </div>

            {/* Email */}
            <div className="form-control">
              <label className="label" htmlFor="email">
                <span className="label-text font-medium text-sm">Email</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="size-4 text-base-content/40" />
                </div>
                <input
                  id="email"
                  type="email"
                  className={`input input-bordered w-full pl-10 text-sm ${errors.email ? "input-error" : ""}`}
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  aria-required="true"
                  aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && <span className="text-error text-xs mt-1">{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-control">
              <label className="label" htmlFor="password">
                <span className="label-text font-medium text-sm">Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="size-4 text-base-content/40" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={`input input-bordered w-full pl-10 text-sm ${errors.password ? "input-error" : ""}`}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  aria-required="true"
                  aria-invalid={!!errors.password}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={0}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4 text-base-content/40" />
                  ) : (
                    <Eye className="size-4 text-base-content/40" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                {errors.password && <span className="text-error text-xs">{errors.password}</span>}
                {formData.password && (
                  <span
                    className={`text-xs ml-auto ${
                      passwordStrength === "Strong"
                        ? "text-green-600"
                        : passwordStrength === "Medium"
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {passwordStrength} password
                  </span>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary w-full text-sm flex items-center justify-center gap-2"
              disabled={isSigningUp}
              aria-disabled={isSigningUp}
            >
              {isSigningUp ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Terms & Privacy */}
          <div className="text-xs text-base-content/60 text-center mt-2">
            By signing up, you agree to our{" "}
            <a href="/terms" className="link link-primary" tabIndex={0}>
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="link link-primary" tabIndex={0}>
              Privacy Policy
            </a>
            .
          </div>

          {/* Already have account */}
          <div className="text-center">
            <p className="text-base-content/60 text-sm">
              Already have an account?{" "}
              <Link to="/login" className="link link-primary font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side */}
      <AuthImagePattern
        title="Join BlinkChat"
        subtitle="Connect, share, and stay in touch with your friends and community."
      />
    </div>
  );
};

export default SignUpPage;
