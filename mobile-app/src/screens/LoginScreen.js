import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import FormTextInput from '../components/FormTextInput';
import Screen from '../components/Screen';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const canSubmit = useMemo(() => username.trim().length > 0 && password.length > 0, [password.length, username]);

  const validate = () => {
    const next = {};
    if (!username.trim()) next.username = 'Username is required';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const result = await login({ username, password });
    setSubmitting(false);
    if (!result.success) {
      setErrors({ submit: result.error || 'Login failed' });
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your journey</Text>

        <View style={styles.form}>
          <FormTextInput
            label="Username"
            value={username}
            onChangeText={(value) => {
              setUsername(value);
              if (errors.username) setErrors((prev) => ({ ...prev, username: null }));
            }}
            placeholder="Enter your username"
            autoCapitalize="none"
            error={errors.username}
            editable={!submitting}
          />

          <FormTextInput
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
            }}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            error={errors.password}
            editable={!submitting}
          />

          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
          >
            <Text style={styles.toggleText}>{showPassword ? 'Hide password' : 'Show password'}</Text>
          </Pressable>

          {errors.submit ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{errors.submit}</Text>
            </View>
          ) : null}

          <AppButton title={submitting ? 'Logging in…' : 'Log In'} onPress={onSubmit} disabled={!canSubmit || submitting} />

          <Pressable onPress={() => navigation.navigate('Signup')} style={styles.footerLink}>
            <Text style={styles.footerText}>
              Don&apos;t have an account? <Text style={styles.footerTextStrong}>Sign up</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
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
  form: {
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
  },
  toggle: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderColor: '#7f1d1d',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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

