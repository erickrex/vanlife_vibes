import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import fc from 'fast-check';
import ProfilePreviewCard from '../components/ProfilePreviewCard';

/**
 * Property-based tests for ProfilePreviewCard photo rendering.
 *
 * Property 2: For any non-empty avatar URL and non-empty cover URL passed
 * as props, the ProfilePreviewCard SHALL render an <img> element with the
 * avatar URL as src and an <img> element with the cover URL as src.
 *
 * **Validates: Requirements 3.4, 3.5**
 */

describe('ProfilePreviewCard photo rendering (Property-based)', () => {
  afterEach(() => {
    cleanup();
  });

  it('Property 2: renders avatar img with correct src for any non-empty avatar URL', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (avatarUrl) => {
          cleanup();
          render(
            <ProfilePreviewCard
              avatarUrl={avatarUrl}
              coverUrl={null}
              displayName="Test User"
            />
          );

          const avatarImg = screen.getByAltText('Avatar preview');
          expect(avatarImg).toBeInTheDocument();
          expect(avatarImg.getAttribute('src')).toBe(avatarUrl);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: renders cover img with correct src for any non-empty cover URL', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (coverUrl) => {
          cleanup();
          render(
            <ProfilePreviewCard
              avatarUrl={null}
              coverUrl={coverUrl}
              displayName="Test User"
            />
          );

          const coverImg = screen.getByAltText('Cover preview');
          expect(coverImg).toBeInTheDocument();
          expect(coverImg.getAttribute('src')).toBe(coverUrl);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: renders both avatar and cover imgs with correct src for any non-empty URLs', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.webUrl(),
        (avatarUrl, coverUrl) => {
          cleanup();
          render(
            <ProfilePreviewCard
              avatarUrl={avatarUrl}
              coverUrl={coverUrl}
              displayName="Test User"
            />
          );

          const avatarImg = screen.getByAltText('Avatar preview');
          expect(avatarImg).toBeInTheDocument();
          expect(avatarImg.getAttribute('src')).toBe(avatarUrl);

          const coverImg = screen.getByAltText('Cover preview');
          expect(coverImg).toBeInTheDocument();
          expect(coverImg.getAttribute('src')).toBe(coverUrl);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property-based tests for ProfilePreviewCard display name and avatar placeholder.
 *
 * Property 3: For any non-empty display name and empty avatar URL, the
 * ProfilePreviewCard SHALL render the display name as text and display the
 * uppercase first character of the display name as the avatar placeholder.
 *
 * **Validates: Requirements 3.6, 3.8**
 */

describe('ProfilePreviewCard display name and avatar placeholder (Property-based)', () => {
  afterEach(() => {
    cleanup();
  });

  it('Property 3: renders display name text and first-letter placeholder for any non-empty display name', () => {
    fc.assert(
      fc.property(
        // Generate display names that are invariant under RTL's whitespace normalization
        // (trims edges, collapses internal whitespace). This matches realistic display names.
        fc.string({ minLength: 1 })
          .filter(s => s.trim().length > 0)
          .map(s => s.trim().replace(/\s+/g, ' ')),
        (displayName) => {
          cleanup();
          render(
            <ProfilePreviewCard
              avatarUrl={null}
              coverUrl={null}
              displayName={displayName}
            />
          );

          // The display name should appear as text in a <p> element
          const nameElement = screen.getByText(displayName, { selector: 'p' });
          expect(nameElement).toBeInTheDocument();

          // The first character (uppercased) should appear as the avatar placeholder
          // inside a <span> with class "text-xl font-semibold"
          const expectedInitial = displayName.charAt(0).toUpperCase();
          const placeholderSpan = document.querySelector('span.text-xl.font-semibold');
          expect(placeholderSpan).not.toBeNull();
          expect(placeholderSpan.textContent).toBe(expectedInitial);

          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});

