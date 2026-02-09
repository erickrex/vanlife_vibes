import { useEffect, useMemo, useState } from 'react';

function IcebreakerModal({
  suggestions = [],
  onSend,
  onRegenerate,
  onClose,
  sending,
  otherUserName,
}) {
  const normalizedSuggestions = useMemo(
    () => suggestions.map((item) => String(item || '').trim()).filter(Boolean),
    [suggestions]
  );
  const [selectedSuggestion, setSelectedSuggestion] = useState(normalizedSuggestions[0] || '');
  const [draft, setDraft] = useState(normalizedSuggestions[0] || '');

  useEffect(() => {
    const firstSuggestion = normalizedSuggestions[0] || '';
    setSelectedSuggestion(firstSuggestion);
    setDraft(firstSuggestion);
  }, [normalizedSuggestions]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSuggestionPick = (suggestion) => {
    setSelectedSuggestion(suggestion);
    setDraft(suggestion);
  };

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold">Send an Icebreaker</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onRegenerate}
              disabled={sending}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Regenerate suggestions"
            >
              ↻ Regenerate
            </button>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors" title="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-zinc-400 text-sm">
            Quick prompts to start a real conversation with {otherUserName || 'your match'}.
          </p>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {normalizedSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion}-${index + 1}`}
                onClick={() => handleSuggestionPick(suggestion)}
                disabled={sending}
                className={`w-full text-left p-3 rounded-xl border text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  selectedSuggestion === suggestion
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-50'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Edit before sending
            </label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Write your opener..."
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              disabled={sending}
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Personalize it so it feels natural.</span>
              <span>{draft.length}/300</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800">
          <button onClick={onClose} className="app-btn-secondary px-4 py-2 text-sm">
            Close
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Sending...' : 'Send Icebreaker'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IcebreakerModal;
