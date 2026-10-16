import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "../components/ui/Logo";

const UPDATED = "October 16, 2026";

const PRIVACY = [
  ["What we store", "Your account details (name, email, optional photo, about, phone, time zone), the messages and files you send, and basic settings. Passwords are stored only as salted hashes."],
  ["How messages are protected", "Everything travels over encrypted connections (HTTPS/WSS). Messages are stored on our servers so you can use BlinkChat on several devices; they are not end-to-end encrypted."],
  ["Who can see what", "Messages are visible to the people in that chat. You control whether others see your last seen, read receipts and local time. People you block can't see your photo, status or presence."],
  ["AI features", "AI features are optional and only run when you tap them (summaries, suggestions, rewrites, translation, transcription). The relevant text or audio is then sent to the AI provider configured by this server's operator. Nothing is sent automatically."],
  ["Notifications", "If you enable push notifications, your browser's push service delivers them. You can turn them off any time in Settings."],
  ["Deleting your data", "You can clear or delete chats, delete messages for everyone, and delete your account in Settings → Account. Disappearing messages are erased automatically after the timer you choose."],
  ["Third parties", "Depending on the deployment: MongoDB Atlas (database), Cloudinary (media storage), Google (sign-in), an email provider (password reset codes), a TURN provider (call relay) and an AI provider. Each processes only what's needed for its function."],
  ["Contact", "Questions about privacy? Contact the operator of this BlinkChat deployment."],
];

const TERMS = [
  ["Using BlinkChat", "You must be old enough to consent to data processing in your country. Keep your login details safe; you're responsible for activity on your account."],
  ["Acceptable use", "Don't use BlinkChat to harass people, send spam, share illegal content, or attempt to break or overload the service. Accounts that do may be removed."],
  ["Your content", "You own what you send. You give the service permission to store and deliver it to the people you send it to."],
  ["Availability", "BlinkChat is provided as-is. We work to keep it running, but we can't guarantee it will always be available or free of errors."],
  ["Changes", "These terms may be updated. Continuing to use BlinkChat after changes means you accept them."],
];

export default function LegalPage({ kind }) {
  const navigate = useNavigate();
  const privacy = kind === "privacy";
  const sections = privacy ? PRIVACY : TERMS;

  return (
    <div className="min-h-dvh bg-base-100">
      <header className="safe-top sticky top-0 z-10 border-b border-base-300/60 bg-base-100/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <button type="button" className="icon-btn -ml-2" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} aria-label="Back">
            <ArrowLeft className="size-5" />
          </button>
          <Link to="/">
            <Logo size={28} />
          </Link>
        </div>
      </header>
      <main className="anim-fade mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{privacy ? "Privacy Policy" : "Terms of Use"}</h1>
        <p className="mt-2 text-sm text-base-content/50">Last updated {UPDATED}</p>
        <div className="mt-8 space-y-7">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-1.5 leading-relaxed text-base-content/70">{body}</p>
            </section>
          ))}
        </div>
        <p className="mt-12 text-sm text-base-content/50">
          See also the <Link to={privacy ? "/terms" : "/privacy"} className="text-primary hover:underline">{privacy ? "Terms of Use" : "Privacy Policy"}</Link>.
        </p>
      </main>
    </div>
  );
}
