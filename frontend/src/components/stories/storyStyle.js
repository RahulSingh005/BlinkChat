// Must match STORY_BACKGROUNDS in backend/src/validation/schemas.js.
export const STORY_BACKGROUNDS = ["#5B5BD6", "#E5484D", "#12A594", "#F76B15", "#8E4EC6", "#0090FF", "#D6409F", "#3E63DD", "#29A383", "#1C2024"];

export const STORY_FONTS = {
  sans: { label: "Sans", className: "font-sans font-semibold" },
  serif: { label: "Serif", className: "font-serif font-medium italic" },
  mono: { label: "Mono", className: "font-mono font-medium" },
  display: { label: "Bold", className: "font-sans font-black uppercase tracking-tight" },
};

export const FONT_ORDER = ["sans", "serif", "mono", "display"];

/** Bigger text for short statuses, smaller for long ones. */
export const storyTextSize = (text = "") => {
  const n = text.length;
  if (n < 40) return "text-[clamp(1.8rem,7vw,2.75rem)] leading-tight";
  if (n < 120) return "text-[clamp(1.4rem,5vw,2rem)] leading-snug";
  if (n < 300) return "text-[clamp(1.1rem,4vw,1.5rem)] leading-snug";
  return "text-base leading-relaxed";
};
