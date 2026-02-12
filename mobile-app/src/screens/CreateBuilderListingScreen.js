import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import { builderAPI } from '../services/api';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

const CATEGORIES = [
  { value: 'electrical', label: '⚡ Electrical' },
  { value: 'plumbing', label: '🚿 Plumbing' },
  { value: 'carpentry', label: '🪚 Carpentry' },
  { value: 'mechanical', label: '🔧 Mechanical' },
  { value: 'painting', label: '🎨 Painting' },
  { value: 'insulation', label: '🧱 Insulation' },
  { value: 'solar', label: '☀️ Solar' },
  { value: 'general', label: '🛠️ General' },
];

const TYPES = [
  { value: 'offering', label: 'I can help' },
  { value: 'requesting', label: 'I need help' },
];

export default function CreateBuilderListingScreen() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [listingType, setListingType] = useState('offering');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        category,
        listing_type: listingType,
      };
      if (price.trim()) data.price = price.trim();
      await builderAPI.create(data);
      navigation.goBack();
    } catch (err) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>What do you need?</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setListingType(t.value)}
                style={[styles.typeBtn, listingType === t.value && styles.typeBtnActive]}
              >
                <Text style={[styles.typeBtnText, listingType === t.value && styles.typeBtnTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Category</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                style={[styles.catChip, category === c.value && styles.catChipActive]}
              >
                <Text style={[styles.catChipText, category === c.value && styles.catChipTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Solar panel installation"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            maxLength={100}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what you offer or need..."
            placeholderTextColor={colors.placeholder}
            style={[styles.input, styles.textArea]}
            multiline
            maxLength={500}
          />

          <Text style={styles.label}>Price (optional, leave blank for negotiable)</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="$0"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            keyboardType="numeric"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            title={submitting ? 'Posting...' : 'Post Listing'}
            onPress={handleSubmit}
            variant="primary"
            disabled={submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  label: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panel,
    borderRadius: radius.md, paddingVertical: 12, alignItems: 'center',
  },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}26` },
  typeBtnText: { color: colors.muted, fontWeight: '900', fontSize: 14 },
  typeBtnTextActive: { color: colors.primary },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panel,
    borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12,
  },
  catChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}38` },
  catChipText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  catChipTextActive: { color: colors.text },
  input: {
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface,
    color: colors.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
