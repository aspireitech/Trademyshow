/**
 * The one inline script this app ships: it applies a stored theme choice
 * before first paint so an explicit dark preference never flashes light.
 *
 * It lives here rather than inline in the layout so the CSP tests can assert
 * things about it, and so there is exactly one place to look when asking what
 * inline script the app serves.
 */
export const THEME_BOOTSTRAP =
  "try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}";
