import { Users } from "lucide-react";
const SidebarSkeleton = () => {
  // Create 8 skeleton items with varied widths
  const skeletonContacts = Array(8).fill(null);
  const nameWidths = [80, 110, 90, 120, 100, 115, 95, 105];
  const statusWidths = [40, 50, 35, 60, 55, 45, 38, 52];

  return (
    <aside
      className="h-full w-20 lg:w-72 border-r border-base-300 bg-gray-50 dark:bg-gray-900 
      flex flex-col transition-all duration-200 shadow-sm"
    >
      {/* Header */}
      <div className="border-b border-base-300 w-full p-5 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-gray-500 dark:text-gray-300" />
          <span className="font-medium hidden lg:block text-gray-700 dark:text-gray-100">Contacts</span>
        </div>
      </div>

      {/* Skeleton Contacts */}
      <div className="overflow-y-auto w-full py-3">
        {skeletonContacts.map((_, idx) => (
          <div
            key={idx}
            className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
          >
            {/* Avatar skeleton */}
            <div className="relative mx-auto lg:mx-0">
              <div className="skeleton-shimmer size-12 rounded-full shadow" />
            </div>

            {/* User info skeleton - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0 flex-1">
              <div
                className="skeleton-shimmer h-4 rounded mb-2"
                style={{ width: nameWidths[idx % nameWidths.length] }}
              />
              <div
                className="skeleton-shimmer h-3 rounded"
                style={{ width: statusWidths[idx % statusWidths.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default SidebarSkeleton;