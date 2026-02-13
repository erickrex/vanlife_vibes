import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { componentTokens, radius } from '../theme/tokens';

const FILTER_TOKENS = componentTokens.filter || {};
const FILTER_BAR = FILTER_TOKENS.bar || {};
const FILTER_ACTIVE = FILTER_TOKENS.active || {};
const CARD_TOKENS = componentTokens.card?.shell || {};

const TRAVEL_PACE_OPTIONS = [
  { value: '', label: 'Any pace', icon: '🌍' },
  { value: 'slow', label: 'Slow', icon: '🐢' },
  { value: 'mixed', label: 'Mixed', icon: '🔄' },
  { value: 'fast', label: 'Fast', icon: '⚡' },
];

const PROFILE_TYPE_OPTIONS = [
  { value: '', label: 'Any type', icon: '👤' },
  { value: 'solo', label: 'Solo', icon: '🧑' },
  { value: 'couple', label: 'Couple', icon: '👫' },
  { value: 'group', label: 'Group', icon: '👥' },
];

function FilterChip({ label, selected, onPress, disabled, accent }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: accent, borderColor: accent, ...FILTER_ACTIVE } : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

export default function DiscoveryFilters({
  mode = 'dating',
  filters = {},
  onFilterChange,
  disabled = false,
  showHeader = true,
}) {
  const [expanded, setExpanded] = useState(false);

  const travelPace = filters.travel_pace || '';
  const profileType = filters.profile_type || '';
  const petCompatible = filters.pet_compatible || false;

  const accent = mode === 'dating' ? colors.rose : colors.blue;

  const activeFilterCount = useMemo(() => {
    return [travelPace ? 1 : 0, profileType ? 1 : 0, petCompatible ? 1 : 0].reduce((a, b) => a + b, 0);
  }, [petCompatible, profileType, travelPace]);

  const hasActive = activeFilterCount > 0;

  const notifyChange = (next) => {
    const clean = {};
    if (next.travel_pace) clean.travel_pace = next.travel_pace;
    if (next.profile_type) clean.profile_type = next.profile_type;
    if (next.pet_compatible) clean.pet_compatible = next.pet_compatible;
    onFilterChange?.(clean);
  };

  const panel = (
    <View style={styles.panel}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚐 Travel pace</Text>
        <View style={styles.chipRow}>
          {TRAVEL_PACE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={`${option.icon} ${option.label}`}
              selected={travelPace === option.value}
              onPress={() => notifyChange({ travel_pace: option.value, profile_type: profileType, pet_compatible: petCompatible })}
              disabled={disabled}
              accent={accent}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Profile type</Text>
        <View style={styles.chipRow}>
          {PROFILE_TYPE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={`${option.icon} ${option.label}`}
              selected={profileType === option.value}
              onPress={() => notifyChange({ travel_pace: travelPace, profile_type: option.value, pet_compatible: petCompatible })}
              disabled={disabled}
              accent={accent}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🐾 Pet preferences</Text>
        <Pressable
          onPress={() => notifyChange({ travel_pace: travelPace, profile_type: profileType, pet_compatible: !petCompatible })}
          disabled={disabled}
          style={({ pressed }) => [
            styles.checkboxRow,
            pressed && !disabled ? styles.pressed : null,
            disabled ? styles.disabled : null,
          ]}
        >
          <View style={[styles.checkbox, petCompatible ? { backgroundColor: accent, borderColor: accent } : null]}>
            {petCompatible ? <Text style={styles.checkboxTick}>✓</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkboxLabel}>Pet-compatible only</Text>
            <Text style={styles.checkboxHelp}>Show only profiles open to pet-friendly meetups</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );

  if (!showHeader) {
    return <View style={[styles.wrap, styles.wrapInline]}>{panel}</View>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.headerButton,
            expanded ? { borderColor: `${accent}66`, backgroundColor: `${accent}22` } : null,
            pressed && !disabled ? styles.pressed : null,
            disabled ? styles.disabled : null,
          ]}
        >
          <Text style={styles.headerIcon}>🔍</Text>
          <Text style={styles.headerText}>Filters</Text>
          {hasActive ? (
            <View style={[styles.countBadge, { backgroundColor: accent }]}>
              <Text style={styles.countText}>{activeFilterCount}</Text>
            </View>
          ) : null}
          <Text style={styles.chevron}>{expanded ? '▼' : '▶'}</Text>
        </Pressable>

        {hasActive ? (
          <Pressable onPress={() => onFilterChange?.({})} disabled={disabled} style={({ pressed }) => [pressed ? styles.pressed : null, disabled ? styles.disabled : null]}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {expanded ? panel : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    gap: 10,
  },
  wrapInline: {
    marginBottom: 0,
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    ...FILTER_BAR,
  },
  headerIcon: {
    fontSize: 14,
  },
  headerText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  chevron: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  clearText: {
    color: colors.muted,
    fontWeight: '800',
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 14,
    gap: 16,
    ...CARD_TOKENS,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    ...FILTER_BAR,
  },
  chipText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
  },
  chipTextSelected: {
    color: colors.primaryText,
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxTick: {
    color: colors.primaryText,
    fontWeight: '900',
    marginTop: -1,
  },
  checkboxLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  checkboxHelp: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
});
