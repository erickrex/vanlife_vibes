import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';
import { componentTokens, radius } from '../theme/tokens';

const INPUT_TOKENS = componentTokens.input || {};
const INPUT_LABEL = INPUT_TOKENS.label || {};
const INPUT_FIELD = INPUT_TOKENS.field || {};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateInput(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function normalizeDateBoundary(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === 'string') {
    return parseDateInput(value);
  }
  return null;
}

function toYyyyMmDd(date) {
  if (!(date instanceof Date)) return '';
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function compareDays(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

function isOutOfRange(date, minDate, maxDate) {
  if (minDate && date < minDate) return true;
  if (maxDate && date > maxDate) return true;
  return false;
}

function clampDate(date, minDate, maxDate) {
  if (!date) return null;
  if (minDate && date < minDate) return minDate;
  if (maxDate && date > maxDate) return maxDate;
  return date;
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }
  while (days.length % 7 !== 0) {
    days.push(null);
  }
  return days;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  editable = true,
  error,
  helperText,
  minimumDate,
  maximumDate,
  clearable = true,
  containerStyle,
}) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(null);
  const [monthCursor, setMonthCursor] = useState(() => firstDayOfMonth(new Date()));

  const selectedDate = useMemo(() => parseDateInput(value), [value]);
  const minDate = useMemo(() => normalizeDateBoundary(minimumDate), [minimumDate]);
  const maxDate = useMemo(() => normalizeDateBoundary(maximumDate), [maximumDate]);

  const openPicker = () => {
    if (!editable) return;
    const today = new Date();
    const base = selectedDate || today;
    const normalized = clampDate(base, minDate, maxDate) || today;
    setDraftDate(normalized);
    setMonthCursor(firstDayOfMonth(normalized));
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
  };

  const saveDate = () => {
    const normalized = clampDate(draftDate, minDate, maxDate);
    onChange?.(normalized ? toYyyyMmDd(normalized) : '');
    closePicker();
  };

  const clearDate = () => {
    onChange?.('');
    closePicker();
  };

  const monthLabel = monthCursor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const dayCells = buildCalendarDays(monthCursor);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={openPicker}
        disabled={!editable}
        style={({ pressed }) => [
          styles.input,
          error ? styles.inputError : null,
          !editable ? styles.disabled : null,
          pressed && editable ? styles.pressed : null,
        ]}
      >
        <Text style={value ? styles.inputValue : styles.inputPlaceholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>

      {helperText && !error ? <Text style={styles.helper}>{helperText}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropTap} onPress={closePicker} />
          <View style={styles.modalCard}>
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={() => setMonthCursor((prev) => addMonths(prev, -1))}
                style={({ pressed }) => [styles.monthArrow, pressed ? styles.pressed : null]}
              >
                <Text style={styles.monthArrowText}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{monthLabel}</Text>
              <Pressable
                onPress={() => setMonthCursor((prev) => addMonths(prev, 1))}
                style={({ pressed }) => [styles.monthArrow, pressed ? styles.pressed : null]}
              >
                <Text style={styles.monthArrowText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {WEEKDAY_LABELS.map((weekday) => (
                <Text key={weekday} style={styles.weekdayText}>{weekday}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {dayCells.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }
                const selected = draftDate ? compareDays(day, draftDate) : false;
                const disabledDay = isOutOfRange(day, minDate, maxDate);
                return (
                  <Pressable
                    key={toYyyyMmDd(day)}
                    onPress={() => {
                      if (disabledDay) return;
                      setDraftDate(day);
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      selected ? styles.dayCellSelected : null,
                      disabledDay ? styles.dayCellDisabled : null,
                      pressed && !disabledDay ? styles.pressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected ? styles.dayTextSelected : null,
                        disabledDay ? styles.dayTextDisabled : null,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.actions}>
              {clearable ? (
                <Pressable
                  onPress={clearDate}
                  style={({ pressed }) => [styles.actionButton, styles.clearButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : (
                <View style={styles.actionSpacer} />
              )}

              <View style={styles.rightActions}>
                <Pressable
                  onPress={closePicker}
                  style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveDate}
                  style={({ pressed }) => [styles.actionButton, styles.confirmButton, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.confirmText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    ...INPUT_LABEL,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    ...INPUT_FIELD,
  },
  inputValue: {
    color: colors.text,
    fontSize: 15,
  },
  inputPlaceholder: {
    color: colors.placeholder,
    fontSize: 15,
  },
  icon: {
    color: colors.primary,
    fontSize: 15,
  },
  helper: {
    color: colors.muted,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
  inputError: {
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayStrong,
    justifyContent: 'center',
    padding: 20,
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    padding: 16,
    gap: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrow: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  monthArrowText: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  monthLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  weekHeader: {
    flexDirection: 'row',
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellDisabled: {
    opacity: 0.35,
  },
  dayText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: colors.primaryText,
  },
  dayTextDisabled: {
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionSpacer: {
    width: 64,
  },
  actionButton: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  clearButton: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
  },
  confirmButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  clearText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmText: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: '800',
  },
});
