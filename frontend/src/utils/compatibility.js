function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCityOverlap(currentWindows = [], targetWindows = []) {
  for (const currentWindow of currentWindows) {
    const currentStart = parseDate(currentWindow.start_date);
    const currentEnd = parseDate(currentWindow.end_date);
    if (!currentStart || !currentEnd) continue;

    for (const targetWindow of targetWindows) {
      if (!targetWindow?.city_area || !currentWindow?.city_area) continue;
      if (
        currentWindow.city_area.trim().toLowerCase() !==
        targetWindow.city_area.trim().toLowerCase()
      ) {
        continue;
      }

      const targetStart = parseDate(targetWindow.start_date);
      const targetEnd = parseDate(targetWindow.end_date);
      if (!targetStart || !targetEnd) continue;

      const overlapStart = currentStart > targetStart ? currentStart : targetStart;
      const overlapEnd = currentEnd < targetEnd ? currentEnd : targetEnd;
      if (overlapStart <= overlapEnd) return currentWindow.city_area;
    }
  }
  return null;
}

export function buildCompatibilityChips(currentProfile, targetProfile, max = 4) {
  if (!currentProfile || !targetProfile) return [];

  const chips = [];
  const currentHobbies = new Set((currentProfile.hobbies || []).map((item) => item.slug || item.id));
  const targetHobbies = new Set((targetProfile.hobbies || []).map((item) => item.slug || item.id));

  let sharedHobbyCount = 0;
  for (const hobby of currentHobbies) {
    if (targetHobbies.has(hobby)) sharedHobbyCount += 1;
  }
  if (sharedHobbyCount > 0) {
    chips.push(sharedHobbyCount === 1 ? '1 shared hobby' : `${sharedHobbyCount} shared hobbies`);
  }

  if (currentProfile.travel_pace && targetProfile.travel_pace) {
    if (currentProfile.travel_pace === targetProfile.travel_pace) {
      chips.push('Same travel pace');
    }
  }

  if (currentProfile.profile_type && targetProfile.profile_type) {
    if (currentProfile.profile_type === targetProfile.profile_type) {
      chips.push('Similar travel setup');
    }
  }

  if (currentProfile.has_pets && targetProfile.has_pets) {
    chips.push('Both travel with pets');
  } else if (currentProfile.has_pets && targetProfile.pet_friendly_only === false) {
    chips.push('Pet-compatible');
  } else if (currentProfile.pet_friendly_only && targetProfile.has_pets) {
    chips.push('Matches your pet preference');
  }

  if (currentProfile.now_in_city && targetProfile.now_in_city) {
    if (
      currentProfile.now_in_city.trim().toLowerCase() ===
      targetProfile.now_in_city.trim().toLowerCase()
    ) {
      chips.push(`Both in ${targetProfile.now_in_city}`);
    }
  }

  const overlapCity = getCityOverlap(
    currentProfile.in_town_windows || [],
    targetProfile.in_town_windows || [],
  );
  if (overlapCity) {
    chips.push(`Window overlap in ${overlapCity}`);
  }

  return [...new Set(chips)].slice(0, max);
}

