import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import AuthImagePattern from "../components/AuthImagePattern";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, Sparkles } from "lucide-react";
import GoogleAuthButton from "../components/GoogleAuthButton";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const { login, isLoggingIn } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(formData);
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-mesh relative overflow-y-auto">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float pointer-events-none" />
      <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-float-delayed pointer-events-none" />

      {/* Left Side - Form */}
      <div className="relative z-10 flex flex-col justify-center items-center p-6 sm:p-12">
        <Link
          to="/"
          className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm font-medium text-base-content/60 hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>

        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="bg-base-100/70 backdrop-blur-xl border border-base-300/60 rounded-3xl shadow-2xl shadow-primary/5 p-8 sm:p-10">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="flex flex-col items-center gap-2 group">
                <div
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center
                  transition-transform shadow-lg shadow-primary/30 group-hover:scale-105"
                >
                  <MessageSquare className="w-7 h-7 text-primary-content" />
                </div>
                <h1 className="text-2xl font-extrabold mt-3 tracking-tight">
                  Welcome back to <span className="text-primary">BlinkChat</span>
                </h1>
                <p className="text-base-content/60 flex items-center gap-1.5 text-sm">
                  <Sparkles className="size-3.5 text-secondary" /> Sign in to continue chatting
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-error/10 border border-error text-error rounded-lg px-4 py-2 text-sm text-center mb-6">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6" aria-label="Login form">
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
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    autoComplete="email"
                    required
                    aria-required="true"
                    aria-label="Email"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label" htmlFor="password">
                  <span className="label-text font-medium">Password</span>
                  <Link
                    to="/forgot-password"
                    className="label-text-alt link link-hover text-primary"
                    tabIndex={0}
                  >
                    Forgot password?
                  </Link>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-base-content/40" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="input input-bordered w-full pl-10 rounded-xl focus:input-primary"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    autoComplete="current-password"
                    required
                    aria-required="true"
                    aria-label="Password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={0}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-base-content/40" />
                    ) : (
                      <Eye className="h-5 w-5 text-base-content/40" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30"
                disabled={isLoggingIn}
                aria-disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-base-300" />
              <span className="text-xs text-base-content/40 font-medium">OR</span>
              <div className="h-px flex-1 bg-base-300" />
            </div>

            <GoogleAuthButton label="Continue with Google" />

            <div className="text-center mt-6">
              <p className="text-base-content/60">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="link link-primary font-medium">
                  Create account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Image/Pattern */}
      <AuthImagePattern
        title={"Welcome back to BlinkChat!"}
        subtitle={"Sign in to continue your conversations and catch up with your messages."}
      />
    </div>
  );
};

export default LoginPage;
