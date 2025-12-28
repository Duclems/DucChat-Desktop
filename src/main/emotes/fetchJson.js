export async function fetchJson(url, { timeoutMs = 8000 } = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch() is not available in this runtime');
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DucChat/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}


