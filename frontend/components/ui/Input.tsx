import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  useColorScheme,
  TextInputProps,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, icon, isPassword, style, ...props },
  ref
) {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getBorderColor = () => {
    if (error) return theme.danger;
    if (isFocused) return theme.primary;
    return theme.border;
  };

  const getBackgroundColor = () => {
    if (isDark) return isFocused ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.04)';
    return isFocused ? '#FAFBFF' : '#FFFFFF';
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: isFocused ? theme.primary : theme.textSecondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            backgroundColor: getBackgroundColor(),
            borderWidth: 1.5,
            ...(Platform.OS === 'ios' && {
              shadowColor: isFocused ? theme.primary : error ? theme.danger : 'transparent',
              shadowOpacity: isFocused || error ? 0.15 : 0,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }),
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? theme.primary : error ? theme.danger : theme.icon}
            style={styles.icon}
          />
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            { color: theme.text },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : undefined,
            style,
          ]}
          placeholderTextColor={isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)'}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={isFocused ? theme.primary : theme.icon}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color={theme.danger} />
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.borderRadius.md,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: Theme.typography.body.fontSize,
    paddingVertical: 13,
    fontWeight: '500',
  },
  icon: {
    marginRight: 10,
  },
  eyeIcon: {
    marginLeft: 10,
    padding: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
