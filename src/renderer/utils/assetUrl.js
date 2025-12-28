export function assetUrl(path) {
  // Works in dev (BASE_URL = "/") and in production build (BASE_URL = "./")
  const base = import.meta.env.BASE_URL || '/';
  const normalized = String(path).replace(/^\/+/, '');
  return `${base}${normalized}`;
}


