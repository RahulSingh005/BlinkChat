import { Fragment } from "react";

/**
 * Renders chat text with WhatsApp-style formatting (*bold*, _italic_,
 * ~strike~, `code`, ```blocks```), clickable links and optional search
 * highlighting. Produces React nodes only — never HTML — so it's XSS-safe.
 */

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,:;!?)\]}]/gi;
const STYLE_RE = /(^|[\s([{"'])([*_~])(?!\s)([^\n]*?[^\s\\])\2(?=$|[\s.,:;!?)\]}"'])/g;

const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

/** 1-3 emoji and nothing else → render big, like other messengers. */
export function isEmojiOnly(text = "") {
  const t = text.trim();
  if (!t || t.length > 40 || !EMOJI_ONLY.test(t) || /^[\d#*\s]+$/.test(t)) return false;
  const count = segmenter ? [...segmenter.segment(t.replace(/\s+/g, ""))].length : t.length / 2;
  return count <= 3;
}

function highlight(text, query, keyBase) {
  if (!query) return text;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const out = [];
  let i = 0;
  let k = 0;
  for (;;) {
    const at = lower.indexOf(q, i);
    if (at === -1) break;
    if (at > i) out.push(text.slice(i, at));
    out.push(
      <mark key={`${keyBase}-m${k++}`} className="rounded bg-warning/40 px-0.5 text-inherit">
        {text.slice(at, at + q.length)}
      </mark>
    );
    i = at + q.length;
  }
  if (!out.length) return text;
  if (i < text.length) out.push(text.slice(i));
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** @Name mentions (names come from the message's mention list). */
function mentionize(text, query, keyBase, mentions) {
  if (!mentions?.length) return highlight(text, query, keyBase);
  const re = new RegExp(`@(${mentions.map((m) => escapeRe(m.label)).join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const out = [];
  let last = 0;
  let k = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > last) out.push(<Fragment key={`${keyBase}-x${k++}`}>{highlight(text.slice(last, match.index), query, `${keyBase}-q${k}`)}</Fragment>);
    const me = mentions.find((m) => m.label.toLowerCase() === match[1].toLowerCase())?.me;
    out.push(
      <span key={`${keyBase}-@${k++}`} className={`mention ${me ? "mention-me" : ""}`}>
        {match[0]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (!out.length) return highlight(text, query, keyBase);
  if (last < text.length) out.push(<Fragment key={`${keyBase}-x${k}`}>{highlight(text.slice(last), query, `${keyBase}-q${k}`)}</Fragment>);
  return out;
}

function linkify(text, keyBase, query, mentions) {
  const nodes = [];
  let last = 0;
  let k = 0;
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0];
    if (match.index > last) nodes.push(<Fragment key={`${keyBase}-t${k++}`}>{mentionize(text.slice(last, match.index), query, `${keyBase}-h${k}`, mentions)}</Fragment>);
    const href = url.startsWith("http") ? url : `https://${url}`;
    nodes.push(
      <a key={`${keyBase}-a${k++}`} href={href} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>
        {url}
      </a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) nodes.push(<Fragment key={`${keyBase}-t${k}`}>{mentionize(text.slice(last), query, `${keyBase}-h${k}`, mentions)}</Fragment>);
  return nodes;
}

function styled(text, keyBase, query, mentions) {
  const nodes = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(STYLE_RE)) {
    const [whole, lead, marker, inner] = m;
    const start = m.index + lead.length;
    if (start > last) nodes.push(...linkify(text.slice(last, start), `${keyBase}-p${k++}`, query, mentions));
    const children = styled(inner, `${keyBase}-i${k}`, query, mentions);
    const Tag = marker === "*" ? "strong" : marker === "_" ? "em" : "s";
    nodes.push(<Tag key={`${keyBase}-s${k++}`}>{children}</Tag>);
    last = m.index + whole.length;
  }
  if (last < text.length) nodes.push(...linkify(text.slice(last), `${keyBase}-p${k}`, query, mentions));
  return nodes;
}

function inlineCode(text, keyBase, query, mentions) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code key={`${keyBase}-c${i}`}>{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={`${keyBase}-f${i}`}>{styled(part, `${keyBase}-f${i}`, query, mentions)}</Fragment>
    )
  );
}

/** `mentions`: [{ label: "Ava", me: false }] — highlighted as @Ava. */
export function renderMessageText(text = "", { query = "", mentions = null } = {}) {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return blocks.map((block, i) => {
    if (block.startsWith("```") && block.endsWith("```") && block.length > 6) {
      return <pre key={`b${i}`}>{block.slice(3, -3).replace(/^\n|\n$/g, "")}</pre>;
    }
    return <Fragment key={`b${i}`}>{inlineCode(block, `b${i}`, query, mentions)}</Fragment>;
  });
}

/** Plain-text preview without formatting markers (lists, notifications). */
export const stripFormatting = (text = "") =>
  text
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(STYLE_RE, (_m, lead, _marker, inner) => `${lead}${inner}`);
