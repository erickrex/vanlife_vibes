/**
 * Default placeholder avatar URL used across the application.
 */
export const DEFAULT_AVATAR = 'https://via.placeholder.com/150/6c5ce7/ffffff?text=👤';

/**
 * Activity type definitions with labels and emojis.
 * Matches ACTIVITY_TYPE_CHOICES from backend Activity model.
 */
export const ACTIVITY_TYPES = {
  climbing: { value: 'climbing', label: 'Climbing', emoji: '🧗' },
  snowboarding: { value: 'snowboarding', label: 'Snowboarding', emoji: '🏂' },
  skiing: { value: 'skiing', label: 'Skiing', emoji: '⛷️' },
  hiking: { value: 'hiking', label: 'Hiking', emoji: '🥾' },
  kayaking: { value: 'kayaking', label: 'Kayaking', emoji: '🛶' },
  surfing: { value: 'surfing', label: 'Surfing', emoji: '🏄' },
  biking: { value: 'biking', label: 'Biking', emoji: '🚴' },
  camping: { value: 'camping', label: 'Camping', emoji: '🏕️' },
  coffee: { value: 'coffee', label: 'Coffee', emoji: '☕' },
  cowork: { value: 'cowork', label: 'Cowork', emoji: '💻' },
  potluck: { value: 'potluck', label: 'Potluck', emoji: '🍲' },
  campfire: { value: 'campfire', label: 'Campfire', emoji: '🔥' },
  dog_walk: { value: 'dog_walk', label: 'Dog Walk', emoji: '🐕' },
  sunset: { value: 'sunset', label: 'Sunset', emoji: '🌅' },
  sunrise_hike: { value: 'sunrise_hike', label: 'Sunrise Hike', emoji: '🌄' },
  other: { value: 'other', label: 'Other', emoji: '✨' },
};

/**
 * Get activity type info by type key.
 * @param {string} type - Activity type key
 * @returns {{ value: string, label: string, emoji: string }}
 */
export function getActivityTypeInfo(type) {
  return ACTIVITY_TYPES[type] || { value: type, label: type, emoji: '📅' };
}

/**
 * Get emoji for an activity type.
 * @param {string} type - Activity type key
 * @returns {string} Emoji character
 */
export function getActivityTypeEmoji(type) {
  return (ACTIVITY_TYPES[type]?.emoji) || '📅';
}

/**
 * Get activity types as an array for select/dropdown components.
 * @param {boolean} includeAllOption - Whether to include "All Activities" option
 * @returns {Array<{ value: string, label: string, emoji: string }>}
 */
export function getActivityTypesArray(includeAllOption = false) {
  const types = Object.values(ACTIVITY_TYPES);
  if (includeAllOption) {
    return [{ value: '', label: 'All Activities', emoji: '' }, ...types];
  }
  return types;
}
