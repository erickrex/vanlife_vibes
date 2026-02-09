/**
 * ProfilePreviewCard — Miniature profile header preview for onboarding.
 *
 * Renders a scaled-down version of the ProfilePage header so users can
 * see how their avatar, cover photo, and display name will look together.
 *
 * Styled with onboarding CSS variables (--onboard-ink, --onboard-border,
 * --onboard-card) so it blends with the onboarding theme.
 */
export default function ProfilePreviewCard({ avatarUrl, coverUrl, displayName }) {
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

  return (
    <div className="rounded-2xl border border-[var(--onboard-border)] overflow-hidden bg-[var(--onboard-card)]">
      {/* Cover photo area */}
      <div className="relative aspect-[3/1] rounded-t-2xl overflow-hidden bg-zinc-800">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Cover preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Avatar + display name */}
      <div className="flex flex-col items-center pb-4">
        {/* Avatar with negative margin to overlap cover */}
        <div className="-mt-8">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar preview"
              className="w-16 h-16 rounded-full border-2 border-[var(--onboard-card)] object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-[var(--onboard-card)] bg-zinc-700 flex items-center justify-center">
              <span className="text-xl font-semibold text-[var(--onboard-ink)]">
                {initial}
              </span>
            </div>
          )}
        </div>

        {/* Display name */}
        <p className="mt-2 text-sm font-semibold text-[var(--onboard-ink)]">
          {displayName || 'Your Name'}
        </p>
      </div>
    </div>
  );
}
