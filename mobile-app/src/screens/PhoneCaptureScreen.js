import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import FormTextInput from '../components/FormTextInput';
import Screen from '../components/Screen';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

const US_PREFIX = '+1';

function normalizePhoneInput(value) {
  const raw = typeof value === 'string' ? value : '';
  const sanitized = raw.replace(/[^\d+]/g, '');

  if (!sanitized) return US_PREFIX;
  if (sanitized.startsWith(US_PREFIX)) return sanitized;

  const digits = sanitized.replace(/\D/g, '');
  const localDigits = digits.startsWith('1') ? digits.slice(1) : digits;
  return `${US_PREFIX}${localDigits}`;
}

export default function PhoneCaptureScreen({ navigation }) {
  const [phone, setPhone] = useState(US_PREFIX);
  const [error, setError] = useState('');

  const hasPhoneDigits = useMemo(() => phone.replace(/\D/g, '').length > 1, [phone]);

  const handleContinue = () => {
    if (!hasPhoneDigits) {
      setError('Please enter your phone number to continue.');
      return;
    }
    navigation.navigate('Signup', { phoneNumber: phone.trim() });
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>US Onboarding</Text>
            <Text style={styles.title}>Can we have your phone number</Text>
            <Text style={styles.subtitle}>
              We are currently localized for US users.
            </Text>
          </View>

          <View style={styles.formCard}>
            <FormTextInput
              label="Phone number"
              value={phone}
              onChangeText={(value) => {
                setPhone(normalizePhoneInput(value));
                if (error) setError('');
              }}
              placeholder="+1"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              error={error}
              style={styles.input}
            />

            <AppButton
              title="Continue"
              onPress={handleContinue}
              disabled={!hasPhoneDigits}
            />

            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={({ pressed }) => [styles.footerLink, pressed ? styles.footerLinkPressed : null]}
            >
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.footerTextStrong}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 28,
    justifyContent: 'space-between',
    gap: 20,
  },
  hero: {
    gap: 12,
    paddingTop: 12,
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    maxWidth: 330,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 310,
  },
  formCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
    gap: 14,
  },
  input: {
    fontSize: 18,
    letterSpacing: 0.4,
  },
  footerLink: {
    paddingVertical: 4,
  },
  footerLinkPressed: {
    opacity: 0.9,
  },
  footerText: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 13,
  },
  footerTextStrong: {
    color: colors.primary,
    fontWeight: '700',
  },
});
