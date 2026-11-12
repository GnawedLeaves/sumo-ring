export const THEME_KEY = "sumo-hub:theme";

/** Runs in <head> before first paint so a saved theme never flashes. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
