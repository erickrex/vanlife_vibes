/**
 * Format a timestamp for display in chat interfaces.
 * Shows time only for today, date + time for older messages.
 *
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Formatted time string, or empty string if invalid
 */
export function formatTime(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
