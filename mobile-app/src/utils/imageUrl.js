import { API_BASE_URL } from '../services/api';

const LOCAL_HOST_REGEX =
  /^(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i;
const INVALID_IMAGE_VALUES = new Set(['null', 'undefined', 'none', 'nan', '[object object]']);

function isLocalHost(hostname) {
  return LOCAL_HOST_REGEX.test(hostname || '');
}

function sanitizeImageValue(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (INVALID_IMAGE_VALUES.has(trimmed.toLowerCase())) return '';
  return trimmed;
}

function safeEncode(url) {
  try {
    return encodeURI(url);
  } catch {
    return url;
  }
}

export function normalizeImageUrl(value) {
  const trimmed = sanitizeImageValue(value);
  if (!trimmed) return '';
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');

  if (trimmed.startsWith('//')) {
    try {
      const apiUrl = new URL(origin);
      return safeEncode(`${apiUrl.protocol}${trimmed}`);
    } catch {
      return safeEncode(`https:${trimmed}`);
    }
  }

  if (/^(https?:\/\/|file:\/\/|content:\/\/|ph:\/\/|asset:\/\/|data:|blob:)/i.test(trimmed)) {
    // If backend generated http:// for the same API host behind SSL proxy, prefer https:// in app.
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const apiUrl = new URL(origin);
        const imgUrl = new URL(trimmed);
        if (
          imgUrl.protocol === 'http:' &&
          ((apiUrl.protocol === 'https:' && apiUrl.host === imgUrl.host) || !isLocalHost(imgUrl.hostname))
        ) {
          imgUrl.protocol = 'https:';
        }
        return safeEncode(imgUrl.toString());
      } catch {
        // Ignore URL parse failures and return input as-is.
      }
    }
    return safeEncode(trimmed);
  }

  if (!origin) return safeEncode(trimmed);

  try {
    const normalized = new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, origin).toString();
    return safeEncode(normalized);
  } catch {
    return safeEncode(`${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
  }
}
