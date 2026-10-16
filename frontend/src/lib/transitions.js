import { flushSync } from "react-dom";
import { prefersReducedMotion } from "./platform";

export const canViewTransition = () =>
  typeof document !== "undefined" && typeof document.startViewTransition === "function" && !prefersReducedMotion();

/**
 * Sets the stack direction used by the slide animation in index.css. Call it
 * right before a navigation that uses React Router's `viewTransition`.
 */
export function setNavDirection(direction) {
  const root = document.documentElement;
  root.dataset.nav = direction;
  clearTimeout(setNavDirection.timer);
  setNavDirection.timer = setTimeout(() => delete root.dataset.nav, 700);
}

/**
 * Theme change with a circular reveal expanding from (x, y) — usually the
 * button that was tapped. Falls back to an instant switch.
 */
export function revealThemeChange(apply, x, y) {
  if (!canViewTransition()) {
    apply();
    return;
  }
  const root = document.documentElement;
  const cx = x ?? window.innerWidth / 2;
  const cy = y ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));

  root.classList.add("theme-switching");
  const transition = document.startViewTransition(() => flushSync(apply));
  transition.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${radius}px at ${cx}px ${cy}px)`] },
        { duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
      )
    )
    .catch(() => {});
  transition.finished.finally(() => root.classList.remove("theme-switching"));
}
