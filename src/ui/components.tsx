import {
  useState,
  type ComponentProps,
  type PropsWithChildren,
  type ReactNode,
  type Ref,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors as c } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 20,
  color = c.green,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}

export function Button({
  label,
  onPress,
  icon,
  secondary = false,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (disabled || loading) && { opacity: 0.6 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? c.green : '#FFF'} />
      ) : icon ? (
        <Icon name={icon} color={secondary ? c.green : '#FFF'} />
      ) : null}
      <Text style={[styles.buttonText, secondary && { color: c.green }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  inputRef,
  trailing,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  inputRef?: Ref<TextInput>;
  trailing?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 9 }}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholderTextColor="#87928B"
          selectionColor={c.green}
          {...props}
          ref={inputRef}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            props.multiline && { minHeight: 150, textAlignVertical: 'top' },
            props.style,
            trailing != null && { paddingRight: 60 },
            focused && { borderColor: c.green },
            error && { borderColor: c.error },
          ]}
        />
        {trailing != null && <View style={styles.inputTrailing}>{trailing}</View>}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, compact && { width: 34, height: 34, borderRadius: 11 }]}>
        <Icon name="layers-outline" color={c.lime} size={compact ? 21 : 26} />
      </View>
      <Text style={[styles.brand, compact && { fontSize: 23 }]}>
        readlens<Text style={{ color: '#789C55' }}>.</Text>
      </Text>
    </View>
  );
}

export function IconButton({
  name,
  label,
  onPress,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: c.softGreen }]}
    >
      <Icon name={name} />
    </Pressable>
  );
}

export function Badge({ status }: { status: string }) {
  const pending = status.toLowerCase().includes('review');
  return (
    <View style={[styles.badge, { backgroundColor: pending ? c.softAmber : c.softGreen }]}>
      <View style={[styles.dot, { backgroundColor: pending ? c.amber : c.green }]} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: pending ? c.amber : c.green }}>
        {status}
      </Text>
    </View>
  );
}

export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return (
    <View style={[styles.notice, error && { backgroundColor: c.softError }]}>
      <Icon
        name={error ? 'alert-circle-outline' : 'information-circle-outline'}
        size={18}
        color={error ? c.error : c.green}
      />
      <Text
        accessibilityRole={error ? 'alert' : undefined}
        style={{ flex: 1, fontSize: 12, lineHeight: 18, color: error ? c.error : c.muted }}
      >
        {children}
      </Text>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({
  title,
  description,
  icon = 'documents-outline',
}: {
  title: string;
  description: string;
  icon?: IconName;
}) {
  return (
    <View style={{ paddingVertical: 44, alignItems: 'center', gap: 12 }}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '600', color: c.ink }}>{title}</Text>
      <Text
        style={{ maxWidth: 290, textAlign: 'center', fontSize: 14, lineHeight: 22, color: c.muted }}
      >
        {description}
      </Text>
    </View>
  );
}

export const textStyles = StyleSheet.create({
  heading: { fontSize: 34, fontWeight: '700', letterSpacing: -1.2, lineHeight: 40, color: c.ink },
  body: { fontSize: 15, lineHeight: 24, color: c.muted },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: c.green },
  label: { fontSize: 13, fontWeight: '600', color: c.ink },
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: c.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 29, color: c.ink, fontWeight: '700', letterSpacing: -1.4 },
  button: {
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: c.green,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  secondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  label: { fontSize: 13, fontWeight: '600', color: c.ink },
  input: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 14,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: c.ink,
    minHeight: 54,
  },
  error: { fontSize: 12, color: c.error },
  inputTrailing: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    backgroundColor: c.softGreen,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 20,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: c.softGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
