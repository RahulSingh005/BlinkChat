/** A labelled switch row used throughout settings. */
export default function Toggle({ checked, onChange, label, description, icon: Icon, disabled = false }) {
  return (
    <label className={`flex items-center gap-3 px-4 py-3.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      {Icon && (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
          <Icon className="size-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-base-content/55">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="toggle toggle-primary"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
