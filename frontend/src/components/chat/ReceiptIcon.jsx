import { CircleAlert, Clock3 } from "lucide-react";

/**
 * Sent / delivered / read ticks. The check strokes draw in when the state
 * advances, so you can see a message get delivered and read.
 */
export default function ReceiptIcon({ status, className = "size-4", readClass = "text-sky-500" }) {
  if (status === "pending") return <Clock3 className={`${className} opacity-70`} aria-label="Sending" />;
  if (status === "failed") return <CircleAlert className={`${className} text-error`} aria-label="Not sent" />;
  const double = status === "delivered" || status === "read";
  return (
    <svg
      key={status}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`tick-draw ${className} ${status === "read" ? readClass : "opacity-80"}`}
      aria-label={status === "read" ? "Read" : double ? "Delivered" : "Sent"}
    >
      {double ? (
        <>
          <path d="M1.5 13.2 6 17.5 15.5 7" />
          <path d="M10.5 16.6 11.4 17.5 21 7" />
        </>
      ) : (
        <path d="M5 12.8 9.4 17 19 7.5" />
      )}
    </svg>
  );
}
