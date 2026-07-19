import { Link } from "react-router-dom";
import {
  MessageSquare,
  Download,
  Lock,
  Globe,
  Play,
  Send,
  CheckCheck,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { LANDING_CHATS, DEMO_AVATARS } from "../constants/avatars";

const LandingPage = () => {
  return (
    <div className="min-h-dvh bg-brand-cream text-neutral overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-brand-cream/90 backdrop-blur-md border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-brand-green flex items-center justify-center">
              <MessageSquare className="size-5 text-white" />
            </div>
            <span className="font-bold text-lg">BlinkChat</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral/70">
            <a href="#features" className="hover:text-neutral transition-colors">Features</a>
            <a href="#privacy" className="hover:text-neutral transition-colors">Privacy</a>
            <a href="#help" className="hover:text-neutral transition-colors">Help Center</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:inline text-sm font-medium hover:text-brand-green-dark transition-colors">
              BlinkChat Web
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors shadow-md"
            >
              <Download className="size-4" />
              Download
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full border border-brand-green/10 animate-pulse-slow" />
          <div className="absolute w-[450px] h-[450px] rounded-full border border-brand-green/15" />
          <div className="absolute w-[300px] h-[300px] rounded-full border border-brand-green/20" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-brand-green-dark bg-brand-green/10 px-3 py-1.5 rounded-full mb-6">
            <Zap className="size-3.5 fill-brand-green-dark" />
            Delivered in the blink of an eye
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            Say it once.
            <br />
            It's already there.
          </h1>
          <p className="text-neutral/60 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            BlinkChat is the fast, secure way to talk to the people who matter —
            instant delivery, real presence, zero clutter. Free, forever.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-brand-green hover:bg-brand-green-dark text-white font-semibold px-8 py-4 rounded-full text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Download className="size-5" />
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-neutral font-semibold px-8 py-4 rounded-full text-lg border-2 border-neutral/10 hover:border-neutral/20 transition-colors"
            >
              I already have an account
            </Link>
          </div>
        </div>

        {/* Floating UI + Phone Mockup */}
        <div className="relative max-w-5xl mx-auto mt-16 flex justify-center">
          {/* Left floating cards */}
          <div className="hidden lg:block absolute left-0 top-8 space-y-4 z-20">
            <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3 w-56 animate-float">
              <img src={DEMO_AVATARS.man1} alt="" className="size-10 rounded-full object-cover" />
              <div className="flex-1">
                <div className="flex gap-0.5 h-6 items-end">
                  {[3, 5, 4, 7, 5, 8, 4, 6].map((h, i) => (
                    <div key={i} className="w-1 bg-brand-green rounded-full" style={{ height: `${h * 3}px` }} />
                  ))}
                </div>
              </div>
              <button className="size-8 rounded-full bg-brand-green/10 flex items-center justify-center">
                <Play className="size-4 text-brand-green fill-brand-green" />
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-card p-4 w-48 animate-float-delayed">
              <div className="flex items-center gap-2 mb-2">
                <span className="size-2 rounded-full bg-brand-green animate-pulse-slow" />
                <p className="text-xs font-semibold text-neutral/70">Delivered</p>
              </div>
              <p className="text-2xl font-extrabold text-brand-green-dark leading-none flex items-baseline gap-1">
                38<span className="text-sm font-semibold text-neutral/40">ms</span>
              </p>
              <p className="text-[11px] text-neutral/40 mt-1">avg. message speed</p>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="relative z-10 w-[280px] sm:w-[320px] bg-white rounded-[2.5rem] shadow-phone border-[6px] border-neutral/10 overflow-hidden">
            <div className="bg-brand-green px-4 py-3 flex items-center justify-between text-white">
              <span className="text-sm font-medium">Edit</span>
              <span className="font-bold">Chats</span>
              <div className="flex gap-2">
                <div className="size-5 rounded bg-white/20" />
                <div className="size-5 rounded bg-white/20" />
              </div>
            </div>

            <div className="px-3 py-2">
              <div className="bg-base-200 rounded-xl px-3 py-2 text-xs text-neutral/40">
                Search
              </div>
            </div>

            <div className="divide-y divide-base-200">
              {LANDING_CHATS.map((chat) => (
                <div key={chat.name} className="flex items-center gap-3 px-4 py-3">
                  <img src={chat.avatar} alt={chat.name} className="size-11 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-sm truncate">{chat.name}</span>
                      <span className="text-[10px] text-neutral/40 shrink-0 ml-1">{chat.time}</span>
                    </div>
                    <p className="text-xs text-neutral/50 truncate">{chat.message}</p>
                  </div>
                  {chat.unread > 0 && (
                    <span className="size-5 rounded-full bg-brand-green text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {chat.unread}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right floating cards */}
          <div className="hidden lg:block absolute right-0 top-4 space-y-4 z-20">
            <div className="bg-white rounded-2xl shadow-card p-4 w-52 animate-float-delayed">
              <div className="flex items-start gap-3">
                <Lock className="size-5 text-brand-green shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">End-to-end encrypted</p>
                  <p className="text-xs text-neutral/50 mt-1">Your messages stay private and secure.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-card p-4 w-44 animate-float">
              <div className="flex -space-x-2 mb-2">
                {[DEMO_AVATARS.woman1, DEMO_AVATARS.man2, DEMO_AVATARS.woman3].map((src) => (
                  <img key={src} src={src} alt="" className="size-7 rounded-full border-2 border-white object-cover" />
                ))}
              </div>
              <p className="text-xs text-neutral/60">
                <span className="font-semibold text-neutral">3 people</span> are online now
              </p>
            </div>

            <div className="bg-brand-green text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-card max-w-[180px] ml-auto animate-float">
              <p className="text-sm">Hey! Are you free today? 😊</p>
              <div className="flex justify-end mt-1">
                <CheckCheck className="size-3 text-blue-200" />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-card p-3 flex items-center gap-2 w-48">
              <div className="size-8 rounded-lg bg-brand-green/10 flex items-center justify-center">
                <Play className="size-4 text-brand-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">vacation.mp4</p>
                <div className="h-1.5 bg-base-200 rounded-full mt-1">
                  <div className="h-full w-2/3 bg-brand-green rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Send FAB */}
          <div className="hidden lg:flex absolute -right-4 bottom-20 size-14 rounded-2xl bg-brand-green-dark text-white items-center justify-center shadow-xl animate-float z-30">
            <Send className="size-6" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-4">Built to feel instant</h2>
          <p className="text-neutral/60 text-center mb-12 max-w-lg mx-auto">
            Every part of BlinkChat is designed around one idea: nothing should
            slow down a conversation.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Real-time messaging", desc: "Messages, typing indicators, and read receipts sync the moment they happen.", icon: Zap },
              { title: "Image sharing", desc: "Drop in a photo and it's on the other end before you let go of the mouse.", icon: Play },
              { title: "Online presence", desc: "See exactly who's online and free to talk, right from your sidebar.", icon: Globe },
              { title: "Private by design", desc: "Every conversation is protected end-to-end — yours to read, no one else's.", icon: ShieldCheck },
              { title: "One app, every device", desc: "Start a chat on desktop, finish it on your phone, without missing a beat.", icon: MessageSquare },
              { title: "Free, no catch", desc: "No subscriptions, no message limits, no ads. Just chat.", icon: Lock },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl bg-brand-cream border border-black/5 hover:shadow-card transition-shadow">
                <div className="size-11 rounded-xl bg-brand-green/10 flex items-center justify-center mb-3">
                  <f.icon className="size-5 text-brand-green-dark" />
                </div>
                <h3 className="font-bold mb-1">{f.title}</h3>
                <p className="text-sm text-neutral/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 bg-brand-green text-white text-center">
        <h2 className="text-3xl font-extrabold mb-4">Ready to start chatting?</h2>
        <p className="text-white/80 mb-8 max-w-md mx-auto">
          Create your account in under a minute and start talking to friends,
          family, and colleagues right away.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/signup" className="bg-white text-brand-green-dark font-bold px-8 py-3.5 rounded-full hover:bg-white/90 transition-colors">
            Create Free Account
          </Link>
          <Link to="/login" className="border-2 border-white/60 text-white font-semibold px-8 py-3.5 rounded-full hover:bg-white/10 transition-colors">
            Sign In
          </Link>
        </div>
      </section>

      <footer id="privacy" className="py-8 px-4 text-center text-sm text-neutral/40 bg-brand-cream">
        <p>© 2026 BlinkChat. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
