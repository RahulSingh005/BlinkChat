import { useState } from "react";
import { useUIStore } from "../../store/useUIStore";
import Sheet from "./Sheet";

/** Global confirmation prompt driven by useUIStore().ask(...). */
export default function ConfirmDialog() {
  const confirm = useUIStore((s) => s.confirm);
  const answer = useUIStore((s) => s.answer);
  const [checked, setChecked] = useState(false);

  const close = () => {
    answer(false);
    setChecked(false);
  };
  const accept = () => {
    answer(confirm?.checkbox ? { checked } : true);
    setChecked(false);
  };

  return (
    <Sheet open={Boolean(confirm)} onClose={close} size="sm" showClose={false} title={confirm?.title} description={confirm?.body}>
      {confirm?.checkbox && (
        <label className="mb-1 mt-2 flex cursor-pointer items-center gap-3 rounded-xl bg-base-200/60 px-3 py-2.5 text-sm">
          <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          {confirm.checkbox}
        </label>
      )}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost h-11 min-h-0 rounded-xl" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          data-autofocus
          className={`btn h-11 min-h-0 rounded-xl ${confirm?.danger ? "btn-error" : "btn-primary"}`}
          onClick={accept}
        >
          {confirm?.confirmLabel || "Confirm"}
        </button>
      </div>
    </Sheet>
  );
}
