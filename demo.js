// Old SPA bookmarks use the same selectable demo as the native role screens.
export function demo(route) {
  location.replace('index.html#'+encodeURIComponent(route));
  return '<a href="child.html?mode=demo">発表用デモをひらく</a>';
}

export function demoAction(actionName) {
  const route=actionName==='demo-reset'?'demo-reset':'demo-child';
  location.replace('index.html#'+route);
  return true;
}
