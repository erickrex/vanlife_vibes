import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { locationsAPI } from '../services/api';
import { colors } from '../theme/colors';

export default function CityAutocomplete({
  label,
  value,
  onChange,
  placeholder = 'Search cities…',
  editable = true,
  optional = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const displayValue = useMemo(() => value || '', [value]);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const fetchCities = async (nextQuery) => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError('');
      const response = await locationsAPI.getCities(nextQuery.trim());
      if (requestId !== requestIdRef.current) return;
      const data = response.data.data || response.data || [];
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setSuggestions([]);
      setError(err.message || 'Failed to load cities');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const scheduleFetch = (nextQuery) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchCities(nextQuery);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const openPicker = () => {
    if (!editable) return;
    setOpen(true);
    scheduleFetch(query);
  };

  const handleSelect = (city) => {
    const next = city?.display_name || '';
    onChange(next);
    setOpen(false);
  };

  const clearValue = () => {
    onChange('');
    setQuery('');
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {optional ? <Text style={styles.optional}>(Optional)</Text> : null}
        </View>
      ) : null}

      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          styles.input,
          !editable ? styles.disabled : null,
          pressed && editable ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.value, !displayValue ? styles.placeholder : null]} numberOfLines={1}>
          {displayValue || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label || 'Pick a city'}</Text>
            <View style={styles.modalHeaderActions}>
              {optional && value ? (
                <Pressable onPress={clearValue} style={({ pressed }) => [styles.clear, pressed ? styles.pressed : null]}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setOpen(false)} style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                scheduleFetch(text);
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.search}
            />
          </View>

          {error ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}

          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id || item.display_name}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.muted} />
                  <Text style={styles.loadingText}>Loading…</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
              >
                <Text style={styles.rowText}>{`📍 ${item.display_name}`}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  label: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  optional: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
  },
  value: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
    fontWeight: '600',
  },
  placeholder: {
    color: colors.muted,
    fontWeight: '500',
  },
  chevron: {
    color: colors.muted,
    fontWeight: '900',
  },
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  close: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
  },
  closeText: {
    color: colors.muted,
    fontWeight: '700',
  },
  clear: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
  },
  clearText: {
    color: colors.rose,
    fontWeight: '800',
  },
  searchWrap: {
    padding: 20,
    paddingBottom: 10,
  },
  search: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    color: colors.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  banner: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
    padding: 12,
    borderRadius: 14,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 13,
  },
  list: {
    padding: 20,
    paddingTop: 10,
    gap: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    color: colors.muted,
    fontWeight: '700',
  },
  row: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
  },
  rowPressed: {
    opacity: 0.9,
  },
  rowText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
