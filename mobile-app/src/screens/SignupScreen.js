import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

import AppButton from '../components/AppButton';
import FormTextInput from '../components/FormTextInput';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../services/api';
import { colors } from '../theme/colors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen({ navigation, route }) {
  const { signup } = useAuth();
  const headerHeight = useHeaderHeight();
  const phoneNumber = route?.params?.phoneNumber;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const canSubmit = useMemo(() => {
    return (
      username.trim().length >= 3 &&
      EMAIL_RE.test(email.trim()) &&
      password.length >= 4 &&
      confirmPassword.length > 0 &&
      confirmPassword === password
    );
  }, [confirmPassword, email, password, username]);

  const validate = () => {
    const next = {};
    if (!username.trim()) next.username = 'Username is required';
    else if (username.trim().length < 3) next.username = 'Username must be at least 3 characters';

    if (!email.trim()) next.email = 'Email is required';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Please enter a valid email address';

    if (!password) next.password = 'Password is required';
    else if (password.length < 4) next.password = 'Password must be at least 4 characters';

    if (!confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const result = await signup({
      username: username.trim(),
      email: email.trim(),
      password,
      password_confirm: confirmPassword,
    });
    setSubmitting(false);
    if (!result.success) {
      setErrors({ submit: result.error || 'Signup failed' });
    }
  };

  useEffect(() => {
    if (!phoneNumber) {
      navigation.replace('PhoneCapture');
    }
  }, [navigation, phoneNumber]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the van life community</Text>
          {__DEV__ ? <Text style={styles.debugText}>API: {API_BASE_URL}</Text> : null}

          <View style={styles.form}>
            <FormTextInput
              label="Username"
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                if (errors.username) setErrors((prev) => ({ ...prev, username: null }));
              }}
              placeholder="Choose a username"
              autoCapitalize="none"
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              error={errors.username}
              editable={!submitting}
            />

            <FormTextInput
              label="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              error={errors.email}
              editable={!submitting}
            />

            <FormTextInput
              label="Password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
              }}
              placeholder="Create a password"
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              error={errors.password}
              editable={!submitting}
            />

            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
            >
              <Text style={styles.toggleText}>{showPassword ? 'Hide password' : 'Show password'}</Text>
            </Pressable>

            <FormTextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: null }));
              }}
              placeholder="Confirm your password"
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              error={errors.confirmPassword}
              editable={!submitting}
            />

            <Pressable
              onPress={() => setShowConfirm((prev) => !prev)}
              style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
            >
              <Text style={styles.toggleText}>{showConfirm ? 'Hide confirmation' : 'Show confirmation'}</Text>
            </Pressable>

            {errors.submit ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{errors.submit}</Text>
              </View>
            ) : null}

            <AppButton
              title={submitting ? 'Creating account…' : 'Sign Up'}
              onPress={onSubmit}
              disabled={!canSubmit || submitting}
            />

            <Pressable onPress={() => navigation.navigate('Login')} style={styles.footerLink}>
              <Text style={styles.footerText}>
                Already have an account? <Text style={styles.footerTextStrong}>Log in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6,
    marginBottom: 18,
  },
  debugText: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 10,
  },
  form: {
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: 18,
  },
  toggle: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  togglePressed: {
    opacity: 0.9,
  },
  toggleText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  banner: {
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
  footerLink: {
    paddingVertical: 4,
  },
  footerText: {
    color: colors.muted,
    textAlign: 'center',
  },
  footerTextStrong: {
    color: colors.primary,
    fontWeight: '700',
  },
});
