const DateSeparator = ({ label }) => {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-base-300" />
      <span className="text-xs font-medium text-base-content/50 px-3 py-1 rounded-full bg-base-200/80">
        {label}
      </span>
      <div className="flex-1 h-px bg-base-300" />
    </div>
  );
};

export default DateSeparator;
