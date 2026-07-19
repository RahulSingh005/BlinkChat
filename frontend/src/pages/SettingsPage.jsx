import { THEMES } from "../constants";
import { FONT_SIZES, useThemeStore } from "../store/useThemeStore";
import { Link } from "react-router-dom";
import {
  Send,
  CheckCircle,
  MessageSquare,
  ArrowLeft,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Type,
} from "lucide-react";

const PREVIEW_MESSAGES = [
  { id: 1, content: "Hey! How's it going?", isSent: false },
  { id: 2, content: "I'm doing great! Just working on some new features.", isSent: true },
];

const FONT_SIZE_LABELS = { sm: "Small", md: "Medium", lg: "Large", xl: "Extra Large" };
const FONT_SIZE_PREVIEW_CLASS = { sm: "text-xs", md: "text-sm", lg: "text-base", xl: "text-lg" };

const SettingsPage = () => {
  const {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    notificationsEnabled,
    setNotificationsEnabled,
    soundEnabled,
    setSoundEnabled,
  } = useThemeStore();

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled) {
      if (typeof window !== "undefined" && "Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setNotificationsEnabled(false);
          return;
        }
      }
      setNotificationsEnabled(true);
    } else {
      setNotificationsEnabled(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-base-200 via-base-100 to-base-300 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 text-sm font-medium text-base-content/60 hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Link>

        {/* Heading */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BlinkChat Settings</h1>
          <p className="text-base-content/70 text-sm">
            Personalize your chat experience
          </p>
        </div>

        {/* Theme Section */}
        <section className="bg-base-100 rounded-2xl shadow-lg p-6 mb-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Theme</h2>
            <p className="text-sm text-base-content/70">
              Choose a theme for your chat interface
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {THEMES.map((t) => (
              <button
                key={t}
                className={`
                  group flex flex-col items-center gap-2 p-3 rounded-xl border transition
                  focus:outline-none focus:ring-2 focus:ring-primary
                  ${theme === t ? "bg-primary/10 border-primary shadow" : "bg-base-200/60 border-base-300 hover:bg-primary/5"}
                `}
                aria-label={`Switch to ${t} theme`}
                aria-pressed={theme === t}
                tabIndex={0}
                onClick={() => setTheme(t)}
              >
                <div className="relative h-8 w-full rounded-md overflow-hidden" data-theme={t}>
                  <div className="absolute inset-0 grid grid-cols-4 gap-px p-1">
                    <div className="rounded bg-primary"></div>
                    <div className="rounded bg-secondary"></div>
                    <div className="rounded bg-accent"></div>
                    <div className="rounded bg-neutral"></div>
                  </div>
                  {theme === t && (
                    <CheckCircle className="absolute -top-2 -right-2 w-5 h-5 text-primary drop-shadow" />
                  )}
                </div>
                <span className="text-xs font-medium truncate w-full text-center">
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm text-base-content/70 text-center">
            Current theme: <span className="font-semibold text-primary">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </div>
        </section>

        {/* Font Size Section */}
        <section className="bg-base-100 rounded-2xl shadow-lg p-6 mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Type className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Font Size</h2>
              <p className="text-sm text-base-content/70">
                Make text easier to read
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                aria-pressed={fontSize === size}
                className={`
                  flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border transition
                  focus:outline-none focus:ring-2 focus:ring-primary
                  ${fontSize === size
                    ? "bg-primary/10 border-primary shadow"
                    : "bg-base-200/60 border-base-300 hover:bg-primary/5"}
                `}
              >
                <span className={`font-bold ${FONT_SIZE_PREVIEW_CLASS[size]}`}>Aa</span>
                <span className="text-xs font-medium">{FONT_SIZE_LABELS[size]}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Notifications Section */}
        <section className="bg-base-100 rounded-2xl shadow-lg p-6 mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="text-sm text-base-content/70">
                Control how BlinkChat lets you know about new messages
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-base-200/60 border border-base-300">
              <div className="flex items-center gap-3">
                {notificationsEnabled ? (
                  <Bell className="size-4 text-primary" />
                ) : (
                  <BellOff className="size-4 text-base-content/40" />
                )}
                <div>
                  <p className="text-sm font-medium">Desktop notifications</p>
                  <p className="text-xs text-base-content/60">Show a system notification for new messages</p>
                </div>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={notificationsEnabled}
                onChange={handleToggleNotifications}
                aria-label="Toggle desktop notifications"
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-base-200/60 border border-base-300">
              <div className="flex items-center gap-3">
                {soundEnabled ? (
                  <Volume2 className="size-4 text-primary" />
                ) : (
                  <VolumeX className="size-4 text-base-content/40" />
                )}
                <div>
                  <p className="text-sm font-medium">Message alerts</p>
                  <p className="text-xs text-base-content/60">Show an in-app alert when a new message arrives</p>
                </div>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                aria-label="Toggle message alerts"
              />
            </div>
          </div>
        </section>

        {/* Preview Section */}
        <section>
          <h3 className="text-lg font-semibold mb-3">Preview</h3>
          <div
            key={theme} // triggers animation on theme change
            data-theme={theme}
            className="rounded-2xl border border-base-300 overflow-hidden bg-base-100 shadow-lg transition-all duration-300 animate-fade-in"
            aria-label="Theme preview"
          >
            <div className="p-4 bg-base-200">
              <div className="max-w-lg mx-auto">
                <div className="bg-base-100 rounded-xl shadow-sm overflow-hidden">
                  {/* Chat Header */}
                  <div className="px-4 py-3 border-b border-base-300 bg-base-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-content font-medium">
                      J
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">John Doe</h3>
                      <p className="text-xs text-base-content/70">Online</p>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="p-4 space-y-4 min-h-[200px] max-h-[200px] overflow-y-auto bg-base-100">
                    {PREVIEW_MESSAGES.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isSent ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`
                            max-w-[80%] rounded-xl p-3 shadow-sm
                            ${message.isSent ? "bg-primary text-primary-content" : "bg-base-200"}
                          `}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`
                              text-[10px] mt-1.5
                              ${message.isSent ? "text-primary-content/70" : "text-base-content/70"}
                            `}
                          >
                            12:00 PM
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="p-4 border-t border-base-300 bg-base-100">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input input-bordered flex-1 text-sm h-10"
                        placeholder="Type a message..."
                        value="This is a preview"
                        readOnly
                        aria-readonly="true"
                      />
                      <button className="btn btn-primary h-10 min-h-0" tabIndex={-1} aria-disabled>
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
