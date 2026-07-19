import DashboardNav from "./DashboardNav";

const DashboardLayout = ({ children }) => {
  return (
    <div className="h-screen flex bg-base-200 overflow-hidden">
      <DashboardNav />
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;
