import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/tokens';

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
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
