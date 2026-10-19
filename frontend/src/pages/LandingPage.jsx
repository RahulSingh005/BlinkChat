import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  ArrowRight,
  AudioLines,
  CheckCheck,
  Clock3,
  FileText,
  Inbox,
  Languages,
  Phone,
  Smartphone,
  Sparkles,
  Sunrise,
  Target,
  Timer,
  Users,
  WifiOff,
} from "lucide-react";
import ChatPreview from "../components/marketing/ChatPreview";
import Logo, { LogoMark } from "../components/ui/Logo";

const ESSENTIALS = [
  { icon: CheckCheck, title: "Real-time, with receipts", body: "Typing indicators, delivered and read receipts — and you decide whether to share yours." },
  { icon: Users, title: "Groups up to 256", body: "Admins, member management, and a clean history for new members." },
  { icon: Phone, title: "Voice & video calls", body: "One tap from any chat. Rings on all your devices, with screen sharing on desktop." },
  { icon: AudioLines, title: "Voice notes", body: "Record with a live waveform, play back at 1.5× or 2×, and transcribe when you can't listen." },
  { icon: FileText, title: "Photos, videos & files", body: "Sent instantly with previews and progress, compressed smartly to save your data." },
  { icon: WifiOff, title: "Works on bad networks", body: "Messages you send offline wait in an outbox and go out the moment you reconnect." },
];

const EXTRAS = [
  { icon: Clock3, title: "Their local time", body: "See what time it is for the person you're messaging, right in the chat header." },
  { icon: Sunrise, title: "Send at their morning", body: "Writing late? BlinkChat offers to deliver it at 9:00 AM in their time zone instead." },
  { icon: AlarmClock, title: "Remind me", body: "Turn any message into a reminder that brings it back exactly when you need it." },
  { icon: Inbox, title: "Needs-reply inbox", body: "One tap shows chats where someone is waiting on you, so nothing slips through." },
  { icon: Target, title: "Focus mode", body: "Pause notifications. Contacts see you're focusing and can flag something truly urgent." },
  { icon: Timer, title: "Disappearing messages", body: "Set chats to clear themselves after 24 hours, 7 days or 90 days." },
  { icon: Sparkles, title: "Catch me up", body: "Back from a busy group? Get a short summary of what you missed. Optional, on request." },
  { icon: Languages, title: "Translate", body: "Read messages in your language, or rewrite yours before sending. Optional, on request." },
];

const FAQ = [
  ["Is BlinkChat free?", "Yes. It runs on free tiers of well-known services, and you can host it yourself."],
  ["Are messages end-to-end encrypted?", "No. Messages are encrypted in transit and stored on the server so you can use several devices. We say this plainly because many apps blur it."],
  ["Do the AI features read my chats?", "Only when you tap one (summary, suggestions, rewrite, translate, transcribe). Nothing is sent to an AI provider automatically, and the server owner can turn AI off entirely."],
  ["Does it work on my phone?", "Yes — it's built mobile-first. Add it to your home screen for an app-like experience with notifications on Android and iPhone (iOS 16.4+)."],
];

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    document.documentElement.classList.add("js");
    const els = ref.current?.querySelectorAll("[data-reveal]") || [];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

const WRAP = "mx-auto w-full max-w-[1360px] px-5 sm:px-8 lg:px-12";

function Feature({ icon: Icon, title, body, i }) {
  return (
    <div data-reveal style={{ "--i": i }} className="rounded-2xl border border-base-300 bg-base-100 p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-base-content/60">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  const ref = useReveal();

  return (
    <div ref={ref} className="min-h-dvh bg-base-100 text-base-content">
      <header className="safe-top sticky top-0 z-30 border-b border-base-300/60 bg-base-100/85 backdrop-blur-md">
        <div className={`${WRAP} flex h-16 items-center gap-3`}>
          <Link to="/" aria-label="BlinkChat home" className="shrink-0">
            <LogoMark size={32} />
          </Link>
          <div className="flex min-w-0 items-baseline gap-8">
            <Link to="/" className="text-[1.0625rem] font-bold leading-none tracking-tight">
              BlinkChat
            </Link>
            <nav className="hidden items-baseline gap-7 text-[0.9375rem] leading-none text-base-content/65 md:flex">
              <a href="#features" className="transition-colors hover:text-base-content">
                Features
              </a>
              <a href="#extras" className="transition-colors hover:text-base-content">
                What's different
              </a>
              <a href="#faq" className="transition-colors hover:text-base-content">
                FAQ
              </a>
            </nav>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="btn btn-ghost btn-sm h-9 rounded-xl">
              Sign in
            </Link>
            <Link to="/signup" className="btn btn-primary btn-sm h-9 rounded-xl">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" />
        <div className={`${WRAP} relative grid items-center gap-14 pb-20 pt-14 md:pt-20 lg:grid-cols-[1.1fr_1fr]`}>
          <div>
            <p className="anim-cascade inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3 py-1 text-xs font-medium text-base-content/70" style={{ "--i": 0 }}>
              <span className="size-1.5 rounded-full bg-success" /> Free · works in any browser · installable
            </p>
            <h1 className="anim-cascade mt-5 text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.6rem]" style={{ "--i": 2 }}>
              Messaging that respects <span className="text-primary">everyone's time.</span>
            </h1>
            <p className="anim-cascade mt-5 max-w-xl text-lg leading-relaxed text-base-content/65" style={{ "--i": 4 }}>
              Fast chats, groups, calls and voice notes — plus the details other apps skip: their local time, delivery at their morning, reminders, focus mode and an
              optional catch-up when you've been away.
            </p>
            <div className="anim-cascade mt-8 flex flex-col gap-3 sm:flex-row" style={{ "--i": 6 }}>
              <Link to="/signup" className="btn btn-primary h-12 min-h-0 rounded-xl px-6 text-[0.95rem]">
                Create a free account <ArrowRight className="size-4" />
              </Link>
              <Link to="/login" className="btn h-12 min-h-0 rounded-xl border-base-300 bg-base-100 px-6 text-[0.95rem] hover:border-base-content/20 hover:bg-base-200">
                I already have an account
              </Link>
            </div>
            <p className="anim-cascade mt-5 flex items-center gap-2 text-sm text-base-content/50" style={{ "--i": 8 }}>
              <Smartphone className="size-4" /> Add to your home screen on iPhone and Android for notifications.
            </p>
          </div>
          <div className="anim-cascade flex justify-center lg:justify-end" style={{ "--i": 5 }}>
            <ChatPreview />
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-base-300/60 bg-base-200/60 py-20">
        <div className={WRAP}>
          <div data-reveal className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">The essentials, done properly</h2>
            <p className="mt-3 text-base-content/60">Everything you expect from a modern messenger, built to feel instant on phones and desktops alike.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ESSENTIALS.map((f, i) => (
              <Feature key={f.title} {...f} i={i} />
            ))}
          </div>
        </div>
      </section>

      <section id="extras" className="py-20">
        <div className={WRAP}>
          <div data-reveal className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Small things that change how chatting feels</h2>
            <p className="mt-3 text-base-content/60">Time zones, busy days and noisy groups are where messaging breaks down. These are built in.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EXTRAS.map((f, i) => (
              <Feature key={f.title} {...f} i={i} />
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-base-300/60 bg-base-200/60 py-16">
        <div className="mx-auto max-w-3xl px-5">
          <h2 data-reveal className="text-3xl font-bold tracking-tight">Straight answers</h2>
          <div className="mt-8 divide-y divide-base-300/70 rounded-2xl border border-base-300/70 bg-base-100">
            {FAQ.map(([q, a], i) => (
              <details key={q} data-reveal style={{ "--i": i }} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="text-base-content/40 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-base-content/65">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="safe-bottom border-t border-base-300/60 bg-base-100">
        <div className={`${WRAP} py-12`}>
          <div data-reveal className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-base-300 bg-base-200/60 p-6 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-balance text-2xl font-bold tracking-tight">Start a conversation in under a minute</h2>
              <p className="mt-1.5 text-base-content/60">Create an account, find your friends by name or email, and say hello.</p>
            </div>
            <Link to="/signup" className="btn btn-primary h-12 min-h-0 shrink-0 rounded-xl px-6">
              Get started, it's free <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-10 flex flex-col gap-4 text-sm text-base-content/55 sm:flex-row sm:items-center sm:justify-between">
            <Logo size={26} />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="#features" className="hover:text-base-content">
                Features
              </a>
              <a href="#faq" className="hover:text-base-content">
                FAQ
              </a>
              <Link to="/privacy" className="hover:text-base-content">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-base-content">
                Terms
              </Link>
              <span className="text-base-content/40">© {new Date().getFullYear()} BlinkChat</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
