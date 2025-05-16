import { MessageSquare } from "lucide-react";

const NoChatSelected = () => {
  return (
    <div
      className="w-full flex flex-1 flex-col items-center justify-center p-8 bg-gradient-to-br from-base-100/80 to-base-200/80 relative overflow-hidden"
      role="main"
      aria-label="No chat selected"
    >

      <div className="absolute -top-20 -left-20 w-60 h-60 bg-primary/10 rounded-full blur-2xl opacity-40 pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-accent/10 rounded-full blur-2xl opacity-30 pointer-events-none" />

      <div className="max-w-md text-center space-y-6 z-10">

        <div className="flex justify-center gap-4 mb-4">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center
                justify-center animate-bounce shadow-lg"
              aria-hidden="true"
            >
              <MessageSquare className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
        </div>


        <h2 className="text-3xl font-extrabold text-base-content">
          Welcome to <span className="text-primary">BlinkChat</span>!
        </h2>
        <p className="text-base-content/70 text-lg">
          Select a conversation from the sidebar to start chatting.
        </p>
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-base-300 text-base-content/70 text-sm shadow-sm">
            💡 Tip: Click on a contact to view your messages!
          </span>
        </div>
      </div>
    </div>
  );
};

export default NoChatSelected;
