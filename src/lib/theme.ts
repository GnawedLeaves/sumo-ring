export const THEME_KEY = "sumo-hub:theme";
/** Cookie mirror of the choice, for browsers/webviews that don't keep localStorage across reloads. */
export const THEME_COOKIE = "sumo-hub-theme";

/**
 * Runs in <head> before first paint so a saved theme never flashes.
 * Reads localStorage first, then the cookie.
 */
export const THEME_SCRIPT = `(function(){try{var t=null;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark"){var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);t=m?m[1]:null}if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/**
 * Runs in <head> before React. When a page update lands while the tab is hidden (e.g. the live refresh),
 * the browser skips the view transition and rejects its `ready`/`finished` promises with
 * "InvalidStateError: Document hidden". The update itself still applies; this marks those rejections as
 * handled so they don't surface as errors. Everything else about startViewTransition is unchanged.
 */
export const VIEW_TRANSITION_GUARD_SCRIPT = `(function(){var o=document.startViewTransition;if(!o)return;document.startViewTransition=function(){var t=o.apply(document,arguments);try{t.ready.catch(function(){});t.finished.catch(function(){});t.updateCallbackDone.catch(function(){})}catch(e){}return t}})()`;
