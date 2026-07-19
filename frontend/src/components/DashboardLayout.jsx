import DashboardNav from "./DashboardNav";
import MobileNav from "./MobileNav";

const DashboardLayout = ({ children, scroll = false }) => {
  return (
    <div className="h-screen flex flex-col md:flex-row bg-base-200 overflow-hidden">
      <DashboardNav />
      <div className={`flex-1 flex min-w-0 min-h-0 ${scroll ? "overflow-y-auto" : "overflow-hidden"}`}>
        {children}
      </div>
      <MobileNav />
    </div>
  );
};

export default DashboardLayout;
