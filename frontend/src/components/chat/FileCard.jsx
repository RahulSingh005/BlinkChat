import { memo } from "react";
import { Download, FileArchive, FileAudio, FileSpreadsheet, FileText, File as FileIcon } from "lucide-react";
import { mediaUrl } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { extOf } from "../../lib/media";

const ICONS = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText, rtf: FileText, odt: FileText, pages: FileText, epub: FileText,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet, ods: FileSpreadsheet, numbers: FileSpreadsheet,
  zip: FileArchive, rar: FileArchive, "7z": FileArchive, tar: FileArchive, gz: FileArchive,
  mp3: FileAudio, wav: FileAudio, m4a: FileAudio, ogg: FileAudio,
};

function FileCard({ att, mine }) {
  const ext = extOf(att.name);
  const Icon = ICONS[ext] || FileIcon;
  const href = att.local ? undefined : mediaUrl(att.url);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={att.name || true}
      onClick={(e) => {
        e.stopPropagation();
        if (!href) e.preventDefault();
      }}
      className={`flex w-[min(68vw,280px)] items-center gap-3 rounded-xl p-2.5 transition ${
        mine ? "bg-bubble-out-content/[0.12] hover:bg-bubble-out-content/[0.18]" : "bg-base-content/[0.05] hover:bg-base-content/[0.08]"
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${mine ? "bg-bubble-out-content/20" : "bg-primary/10 text-primary"}`}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{att.name || "File"}</span>
        <span className={`block text-xs ${mine ? "text-bubble-out-content/70" : "text-base-content/50"}`}>
          {[ext.toUpperCase(), formatBytes(att.size)].filter(Boolean).join(" · ")}
          {att.local && ` · ${Math.round((att.progress || 0) * 100)}%`}
        </span>
      </span>
      {href && <Download className={`size-4 shrink-0 ${mine ? "text-bubble-out-content/80" : "text-base-content/45"}`} />}
    </a>
  );
}

export default memo(FileCard);
