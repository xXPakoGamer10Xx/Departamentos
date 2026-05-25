import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const iconSize = size === 'sm' ? 15 : size === 'md' ? 18 : 22;

  const getContainerStyles = (): ViewStyle => {
    const base: ViewStyle = {};
    if (variant === 'secondary') {
      base.backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)';
      base.borderWidth = 1;
      base.borderColor = theme.border;
    } else if (variant === 'danger') {
      base.backgroundColor = theme.danger;
      // Shadow rojo en danger
      base.shadowColor = theme.danger;
      base.shadowOpacity = isDark ? 0.4 : 0.25;
      base.shadowRadius = 8;
      base.shadowOffset = { width: 0, height: 3 };
    } else if (variant === 'ghost') {
      base.backgroundColor = 'transparent';
    } else if (variant === 'outline') {
      base.backgroundColor = 'transparent';
      base.borderWidth = 1;
      base.borderColor = theme.borderStrong;
    }

    if (disabled) {
      base.opacity = 0.45;
    }

    return base;
  };

  const getTextColor = () => {
    if (variant === 'primary' || variant === 'danger') return '#FFFFFF';
    if (variant === 'secondary') return theme.text;
    if (variant === 'ghost' || variant === 'outline') return theme.text;
    return theme.text;
  };

  const renderContent = () => (
    <>
      {icon && iconPosition === 'left' && !loading && (
        <Ionicons
          name={icon}
          size={iconSize}
          color={getTextColor()}
          style={styles.leftIcon}
        />
      )}
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'sm' && styles.textSm,
            size === 'lg' && styles.textLg,
            { color: getTextColor() },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
      {icon && iconPosition === 'right' && !loading && (
        <Ionicons
          name={icon}
          size={iconSize}
          color={getTextColor()}
          style={styles.rightIcon}
        />
      )}
    </>
  );

  const containerStyle: ViewStyle[] = [
    styles.container,
    size === 'sm' && styles.containerSm,
    size === 'lg' && styles.containerLg,
    fullWidth && styles.fullWidth,
    getContainerStyles(),
    style,
  ];

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[fullWidth ? styles.fullWidth : undefined, disabled && { opacity: 0.45 }]}
        activeOpacity={0.8}
        {...(Platform.OS === 'web' ? { style: [fullWidth ? styles.fullWidth : undefined, disabled && { opacity: 0.45 }, { cursor: disabled ? 'not-allowed' : 'pointer' } as any] } : {})}
      >
        <LinearGradient
          colors={isDark
            ? [theme.primary, theme.primaryDark]
            : [theme.primary, '#3730A3']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[containerStyle, {
            shadowColor: theme.primary,
            shadowOpacity: isDark ? 0.5 : 0.3,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={containerStyle}
      activeOpacity={0.75}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: Theme.borderRadius.md,
    minHeight: 48,
  },
  containerSm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: Theme.borderRadius.sm,
  },
  containerLg: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    minHeight: 56,
    borderRadius: Theme.borderRadius.lg,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  textSm: {
    fontSize: 13,
  },
  textLg: {
    fontSize: Theme.typography.bodyLarge.fontSize,
    fontWeight: '700',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
});
