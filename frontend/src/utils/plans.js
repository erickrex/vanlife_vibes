export const PLAN_TYPES = {
  coffee: { label: 'Coffee' },
  sunrise_hike: { label: 'Sunrise Hike' },
  dog_walk: { label: 'Dog Walk' },
  cowork: { label: 'Cowork' },
  sunset: { label: 'Sunset' },
  other: { label: 'Other' },
};

export const PLAN_TYPE_OPTIONS = [
  { value: 'coffee', label: 'Coffee', description: 'Casual coffee meetup' },
  { value: 'sunrise_hike', label: 'Sunrise Hike', description: 'Morning trail meetup' },
  { value: 'dog_walk', label: 'Dog Walk', description: 'Walk with fellow pet owners' },
  { value: 'cowork', label: 'Cowork', description: 'Focused work session' },
  { value: 'sunset', label: 'Sunset', description: 'Golden-hour meetup' },
  { value: 'other', label: 'Other', description: 'Any meetup format' },
];

function normalizeAttendee(attendee) {
  if (!attendee) return attendee;
  return {
    ...attendee,
    user: attendee.user_profile || attendee.user || null,
  };
}

function normalizeMessage(message) {
  if (!message) return message;
  return {
    ...message,
    sender: message.sender_profile || message.sender || null,
  };
}

export function normalizePlan(plan) {
  if (!plan) return plan;
  return {
    ...plan,
    created_by: plan.created_by_profile || plan.created_by || null,
    attendees: Array.isArray(plan.attendees)
      ? plan.attendees.map(normalizeAttendee)
      : [],
  };
}

export function normalizePlans(plans) {
  if (!Array.isArray(plans)) return [];
  return plans.map(normalizePlan);
}

export function normalizePlanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map(normalizeMessage);
}
