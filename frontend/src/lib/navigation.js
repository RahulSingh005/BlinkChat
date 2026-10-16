// Lets non-React code (stores, socket handlers, notifications) navigate
// through the router without importing it (avoids import cycles).
let navigateFn = null;

export const setNavigate = (fn) => {
  navigateFn = fn;
};

export const navigateTo = (path, options) => {
  if (navigateFn) navigateFn(path, options);
  else window.location.assign(path);
};
