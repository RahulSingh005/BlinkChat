import { useChatStore } from "../store/useChatStore";
import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <main className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex flex-col">
      {/* Top Spacer for Navbar */}
      <div className="h-16 md:h-20" aria-hidden="true" />
      {/* Main Content */}
      <section className="flex-1 flex items-center justify-center px-2 md:px-4 pb-4">
        <div
          className="w-full max-w-6xl h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)]
          bg-base-100 rounded-2xl shadow-xl border border-base-300 flex overflow-hidden transition-all duration-300"
          aria-label="BlinkChat main content"
        >
          {/* Sidebar */}
          <Sidebar />

          {/* Chat Area */}
          <div className="flex-1 flex animate-fade-in">
            {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
