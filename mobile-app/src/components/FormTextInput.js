import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { componentTokens, radius } from '../theme/tokens';

const INPUT_TOKENS = componentTokens.input || {};
const INPUT_LABEL = INPUT_TOKENS.label || {};
const INPUT_FIELD = INPUT_TOKENS.field || {};

export default function FormTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'none',
  autoCorrect = false,
  keyboardType,
  secureTextEntry,
  editable = true,
  error,
  helperText,
  returnKeyType,
  onSubmitEditing,
  autoComplete,
  textContentType,
  style,
  containerStyle,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        autoComplete={autoComplete}
        textContentType={textContentType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          INPUT_FIELD,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          style,
        ]}
        selectionColor={colors.primary}
        {...rest}
      />
      {helperText && !error ? <Text style={styles.helper}>{helperText}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: colors.focusRing,
    borderWidth: 2,
  },
  inputError: {
    borderColor: colors.danger,
  },
  helper: {
    color: colors.muted,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
});
