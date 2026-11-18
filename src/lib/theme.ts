export const THEME_KEY = "sumo-hub:theme";
/** Cookie mirror of the choice, for browsers/webviews that don't keep localStorage across reloads. */
export const THEME_COOKIE = "sumo-hub-theme";

/**
 * Runs in <head> before first paint so a saved theme never flashes.
 * Reads localStorage first, then the cookie.
 */
export const THEME_SCRIPT = `(function(){try{var t=null;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}if(t!=="light"&&t!=="dark"){var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);t=m?m[1]:null}if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
