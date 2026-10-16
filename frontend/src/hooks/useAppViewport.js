import { useEffect } from "react";

/**
 * Keeps the app exactly as tall as the *visible* viewport. On iOS the
 * keyboard overlays the page instead of resizing it, which used to push the
 * chat header off-screen and hide the composer. We size the shell to
 * visualViewport and pin the document at the top while the keyboard is up.
 */
export function useAppViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return undefined;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
        // iOS scrolls the layout viewport to reveal the focused input; undo it.
        if (window.scrollY !== 0 && vv.height < window.innerHeight) window.scrollTo(0, 0);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--app-height");
    };
  }, []);
}
