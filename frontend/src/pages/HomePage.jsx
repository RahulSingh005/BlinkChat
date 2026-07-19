import { useChatStore } from "../store/useChatStore";
import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <main className="h-full w-full bg-mesh flex flex-col">
      <section className="flex-1 flex items-stretch justify-center px-0 sm:px-4 lg:px-6 py-0 sm:py-4">
        <div
          className="w-full max-w-7xl h-full
            bg-base-100/90 sm:rounded-2xl shadow-2xl shadow-base-content/5
            border border-base-300/60 flex overflow-hidden backdrop-blur-sm"
          aria-label="BlinkChat main content"
        >
          <div className={selectedUser ? "hidden lg:flex shrink-0" : "flex shrink-0 w-full lg:w-auto"}>
            <Sidebar expanded={!selectedUser} />
          </div>

          <div className={`flex-1 flex min-w-0 animate-fade-in ${!selectedUser ? "hidden lg:flex" : "flex"}`}>
            {!selectedUser ? (
              <NoChatSelected />
            ) : (
              <ChatContainer />
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
