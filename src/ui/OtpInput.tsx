import { useState, type Ref } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';
import { CodeField, useClearByFocusCell } from 'react-native-confirmation-code-field';
import { normalizeOtp, otpCellCount } from '../auth/otp-input';
import { colors as c } from './theme';

type OtpInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  inputRef?: Ref<TextInput>;
  length?: number;
  error?: string;
  disabled?: boolean;
};

export function OtpInput({
  value,
  onChangeText,
  onSubmit,
  inputRef,
  length,
  error,
  disabled = false,
}: OtpInputProps) {
  const [focused, setFocused] = useState(false);
  const cellCount = otpCellCount(value, length);
  const changeValue = (next: string) => {
    if (!disabled) onChangeText(normalizeOtp(next));
  };
  const [focusProps, getCellOnLayoutHandler] = useClearByFocusCell({
    value,
    setValue: changeValue,
  });
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Verification code</Text>
      <CodeField
        {...focusProps}
        ref={inputRef}
        value={value}
        onChangeText={changeValue}
        cellCount={cellCount}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCapitalize="none"
        // Keep the native paste menu available; the native input owns all digits.
        caretHidden={false}
        selectionColor="transparent"
        editable={!disabled}
        accessibilityLabel="Verification code"
        accessibilityHint={error ?? 'Enter or paste the code from your email.'}
        accessibilityState={{ disabled }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        submitBehavior="submit"
        returnKeyType="done"
        rootStyle={[styles.cells, disabled && styles.disabled]}
        renderCell={({ index, symbol, isFocused }) => (
          <View
            key={index}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={getCellOnLayoutHandler(index)}
            style={[
              styles.cell,
              !!symbol && styles.filledCell,
              (isFocused || (focused && value.length === cellCount && index === cellCount - 1)) &&
                styles.focusCell,
              !!error && styles.errorCell,
            ]}
          >
            <Text style={[styles.digit, !!error && styles.errorText]}>{symbol}</Text>
            {!symbol && isFocused && <View style={styles.caret} />}
            {!symbol && !isFocused && <View style={styles.placeholder} />}
          </View>
        )}
      />
      {error && (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 12 },
  label: { color: c.ink, fontSize: 13, fontWeight: '600' },
  cells: { gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' },
  cell: {
    flexGrow: 1,
    flexBasis: 36,
    minHeight: 58,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  filledCell: { backgroundColor: '#F0F5EE', borderColor: '#C7D9CA' },
  focusCell: { borderColor: c.green, backgroundColor: c.surface },
  errorCell: { borderColor: c.error, backgroundColor: c.softError },
  digit: { color: c.ink, fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  caret: { position: 'absolute', width: 2, height: 24, borderRadius: 1, backgroundColor: c.green },
  placeholder: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.line,
  },
  errorText: { color: c.error, fontSize: 12, lineHeight: 18 },
  disabled: { opacity: 0.6 },
});
