const SidebarSkeleton = () => {
  return (
    <aside className="h-full w-20 lg:w-80 border-r border-base-300/80 flex flex-col bg-base-100">
      <div className="p-5 space-y-3 border-b border-base-300/80">
        <div className="skeleton h-8 w-32 hidden lg:block" />
        <div className="skeleton h-9 w-full hidden lg:block rounded-lg" />
      </div>
      <div className="p-3 space-y-2 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="skeleton w-12 h-12 rounded-full shrink-0" />
            <div className="hidden lg:flex flex-col gap-2 flex-1">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-36" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default SidebarSkeleton;
