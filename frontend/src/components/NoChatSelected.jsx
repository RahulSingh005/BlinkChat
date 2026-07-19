import { MessageSquare, Sparkles, Zap, Shield, Search } from "lucide-react";

const features = [
  { icon: Zap, label: "Real-time messaging", color: "text-amber-500" },
  { icon: Sparkles, label: "Emoji & image sharing", color: "text-purple-500" },
  { icon: Search, label: "Search your contacts", color: "text-blue-500" },
  { icon: Shield, label: "Secure & private", color: "text-emerald-500" },
];

const NoChatSelected = () => {
  return (
    <div
      className="w-full flex flex-1 flex-col items-center justify-center p-8 relative overflow-hidden hidden lg:flex"
      role="main"
      aria-label="No chat selected"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl opacity-60 pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl opacity-40 pointer-events-none animate-float-delayed" />

      <div className="max-w-lg text-center space-y-8 z-10">
        <div className="relative inline-flex">
          <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-xl animate-pulse-slow" />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-xl shadow-primary/30">
            <MessageSquare className="w-10 h-10 text-primary-content" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              BlinkChat
            </span>
          </h2>
          <p className="text-base-content/60 text-base lg:text-lg max-w-sm mx-auto">
            Pick a conversation from the sidebar to get started
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {features.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-base-200/60 border border-base-300/50 text-left"
            >
              <Icon className={`size-4 shrink-0 ${color}`} />
              <span className="text-xs font-medium text-base-content/70">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NoChatSelected;
