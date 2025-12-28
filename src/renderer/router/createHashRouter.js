function normalizePath(path) {
  if (!path) return '/';
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

function getHashPath() {
  // Accept "#/new" or "#new"
  const raw = window.location.hash.replace(/^#/, '');
  return normalizePath(raw);
}

export function createHashRouter({ routes, outlet }) {
  if (!outlet) throw new Error('Router requires an outlet element');

  function render() {
    const path = getHashPath();
    const Page = routes[path] ?? routes['/'];
    outlet.replaceChildren(Page({ path, navigate }));

    // Let components update active state after navigation
    window.dispatchEvent(new CustomEvent('app:navigated', { detail: { path } }));
  }

  function navigate(path) {
    window.location.hash = normalizePath(path);
  }

  function start() {
    // Default route
    if (!window.location.hash) window.location.hash = '#/';

    window.addEventListener('hashchange', render);
    render();
  }

  return { start, navigate, getPath: getHashPath };
}


