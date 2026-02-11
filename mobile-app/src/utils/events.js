export const TIME_WINDOWS = {
  morning: { label: 'Morning', time: '6am-12pm', emoji: 'sunrise' },
  afternoon: { label: 'Afternoon', time: '12pm-5pm', emoji: 'sun' },
  evening: { label: 'Evening', time: '5pm-9pm', emoji: 'moon' },
  flexible: { label: 'Flexible', time: 'Any time', emoji: 'refresh' },
};

export const EVENT_TYPES = {
  coffee: { value: 'coffee', label: 'Coffee', emoji: 'coffee' },
  potluck: { value: 'potluck', label: 'Potluck', emoji: 'potluck' },
  campfire: { value: 'campfire', label: 'Campfire', emoji: 'campfire' },
  cowork: { value: 'cowork', label: 'Cowork Session', emoji: 'cowork' },
  hiking: { value: 'hiking', label: 'Hiking', emoji: 'hiking' },
  sunrise_hike: { value: 'sunrise_hike', label: 'Sunrise Hike', emoji: 'sunrise_hike' },
  sunset: { value: 'sunset', label: 'Sunset Viewpoint', emoji: 'sunset' },
  climbing: { value: 'climbing', label: 'Climbing', emoji: 'climbing' },
  biking: { value: 'biking', label: 'Biking', emoji: 'biking' },
  kayaking: { value: 'kayaking', label: 'Kayaking', emoji: 'kayaking' },
  surfing: { value: 'surfing', label: 'Surfing', emoji: 'surfing' },
  camping: { value: 'camping', label: 'Camping', emoji: 'camping' },
  snowboarding: { value: 'snowboarding', label: 'Snowboarding', emoji: 'snowboarding' },
  skiing: { value: 'skiing', label: 'Skiing', emoji: 'skiing' },
  dog_walk: { value: 'dog_walk', label: 'Dog Walk', emoji: 'dog_walk' },
  other: { value: 'other', label: 'Other', emoji: 'other' },
};

export const EVENT_TYPE_CATEGORIES = [
  { name: 'Social', types: ['coffee', 'potluck', 'campfire', 'cowork'] },
  { name: 'Outdoor', types: ['hiking', 'sunrise_hike', 'sunset', 'climbing', 'biking', 'kayaking', 'surfing', 'camping'] },
  { name: 'Winter', types: ['snowboarding', 'skiing'] },
  { name: 'Other', types: ['dog_walk', 'other'] },
];

export const JOIN_MODES = [
  { value: 'direct', label: 'Direct Join', description: 'Others can join immediately' },
  { value: 'swipe', label: 'Swipe to Join', description: 'Others swipe to express interest' },
];

export const EVENT_STATUS = {
  open: { label: 'Open' },
  full: { label: 'Full' },
  matched: { label: 'Matched' },
  cancelled: { label: 'Cancelled' },
  completed: { label: 'Completed' },
};

export function getEventTypeInfo(type) {
  return EVENT_TYPES[type] || { value: type, label: type || 'Event', emoji: 'other' };
}

export function getTimeWindowInfo(timeWindow) {
  return TIME_WINDOWS[timeWindow] || { label: timeWindow || 'Time', time: '', emoji: 'time' };
}

export function getEventTypeEmoji(type) {
  const key = getEventTypeInfo(type).emoji;
  if (key === 'coffee') return '☕';
  if (key === 'potluck') return '🍲';
  if (key === 'campfire') return '🔥';
  if (key === 'cowork') return '💻';
  if (key === 'hiking') return '🥾';
  if (key === 'sunrise_hike') return '🌄';
  if (key === 'sunset') return '🌅';
  if (key === 'climbing') return '🧗';
  if (key === 'biking') return '🚴';
  if (key === 'kayaking') return '🛶';
  if (key === 'surfing') return '🏄';
  if (key === 'camping') return '🏕️';
  if (key === 'snowboarding') return '🏂';
  if (key === 'skiing') return '⛷️';
  if (key === 'dog_walk') return '🐕';
  return '✨';
}

export function getTimeWindowEmoji(timeWindow) {
  const key = getTimeWindowInfo(timeWindow).emoji;
  if (key === 'sunrise') return '🌅';
  if (key === 'sun') return '☀️';
  if (key === 'moon') return '🌙';
  if (key === 'refresh') return '🔄';
  return '🕐';
}

export function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatEventDateLong(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
