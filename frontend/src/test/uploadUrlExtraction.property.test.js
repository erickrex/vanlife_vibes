import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

/**
 * Property-based tests for upload response URL extraction logic.
 *
 * The extraction function used in OnboardingPage.jsx:
 *   const photoUrl = data?.data?.image || data?.image;
 *
 * This logic handles two response shapes:
 *   1. Nested (standard backend response via Axios): { data: { image: url } }
 *   2. Flat (fallback): { image: url }
 *
 * **Validates: Requirements 1.1, 1.2, 2.2**
 */

/**
 * Pure extraction function matching the logic in OnboardingPage.jsx.
 * Extracts the photo URL from an upload response object.
 */
function extractPhotoUrl(data) {
  return data?.data?.image || data?.image;
}

describe('Upload response URL extraction (Property-based)', () => {
  it('Property 1: extracts URL from nested response { data: { image: url } }', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          const response = { data: { image: url } };
          const extracted = extractPhotoUrl(response);
          expect(extracted).toBe(url);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: extracts URL from flat response { image: url }', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          const response = { image: url };
          const extracted = extractPhotoUrl(response);
          expect(extracted).toBe(url);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: nested format takes precedence over flat format', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.webUrl(),
        (nestedUrl, flatUrl) => {
          fc.pre(nestedUrl !== flatUrl);
          const response = { data: { image: nestedUrl }, image: flatUrl };
          const extracted = extractPhotoUrl(response);
          expect(extracted).toBe(nestedUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: works with arbitrary non-empty string URLs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (url) => {
          const nestedResponse = { data: { image: url } };
          const flatResponse = { image: url };
          expect(extractPhotoUrl(nestedResponse)).toBe(url);
          expect(extractPhotoUrl(flatResponse)).toBe(url);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: returns undefined for responses with no image field', () => {
    fc.assert(
      fc.property(
        fc.record({
          data: fc.record({
            id: fc.string(),
            photo_type: fc.constantFrom('avatar', 'cover'),
          }),
        }),
        (response) => {
          const extracted = extractPhotoUrl(response);
          expect(extracted).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1: returns undefined for null/undefined input', () => {
    expect(extractPhotoUrl(null)).toBeUndefined();
    expect(extractPhotoUrl(undefined)).toBeUndefined();
  });
});
