import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation';
import { demoMode, useSession } from '../state/session';
import { Screen } from '../ui/Screen';
import { colors as c } from '../ui/theme';
import { auth } from '../services';
import { errorMessage } from '../api/contracts';
import { dismissNotification, notify } from '../ui/notifications';
import { useAuthNotification } from '../auth/useAuthNotification';
import { Brand, Button, Field, Icon, Notice, textStyles as t } from '../ui/components';
import { apiConfig, liveConfigurationError } from '../config';
import { isGatewayLogin, validateLogin } from '../auth/login-validation';

export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParams, 'Login'>) {
  const { signIn, error: sessionError } = useSession();
  const { id: notificationId, focused } = useAuthNotification();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (focused && sessionError) notify(notificationId, 'error', 'Session ended', sessionError);
  }, [focused, sessionError, notificationId]);
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const errors = validateLogin(email, password);
  async function proceed() {
    if (pending.current || liveConfigurationError) return;
    dismissNotification(notificationId);
    setSubmitted(true);
    if (errors.email) {
      emailInput.current?.focus();
      return;
    }
    if (errors.password) {
      passwordInput.current?.focus();
      return;
    }
    if (!demoMode && isGatewayLogin(email, password, apiConfig)) {
      notify(
        notificationId,
        'info',
        'Use your Readlens account',
        'These are the assessment gateway credentials. Sign in with your registered account’s email and password.',
      );
      return;
    }
    Keyboard.dismiss();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      if (!demoMode) await auth.login(email.trim(), password, controller.signal);
      if (!controller.signal.aborted) {
        setPassword('');
        navigation.navigate('Verify', { email: email.trim() });
      }
    } catch (error) {
      if (!controller.signal.aborted)
        notify(notificationId, 'error', 'Couldn’t sign in', errorMessage(error));
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  return (
    <Screen backgroundColor={c.background}>
      <View style={styles.brandRow}>
        <Brand compact />
      </View>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.loginTitle}>
          Welcome back
        </Text>
        <Text style={t.body}>Sign in to pick up where you left off.</Text>
      </View>
      <View style={styles.form}>
        <Field
          inputRef={emailInput}
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            dismissNotification(notificationId);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          error={submitted ? errors.email : undefined}
          editable={!busy}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordInput.current?.focus()}
          style={styles.loginInput}
        />
        <Field
          inputRef={passwordInput}
          label="Password"
          placeholder="At least 6 characters"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            dismissNotification(notificationId);
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          error={submitted ? errors.password : undefined}
          editable={!busy}
          onSubmitEditing={proceed}
          returnKeyType="go"
          submitBehavior="submit"
          style={styles.loginInput}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => setShowPassword((value) => !value)}
              style={({ pressed }) => [
                styles.passwordToggle,
                pressed && styles.passwordTogglePressed,
              ]}
            >
              <Icon
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={21}
                color={c.muted}
              />
            </Pressable>
          }
        />
        <View style={styles.submit}>
          <Button
            label={busy ? 'Signing in…' : 'Sign in'}
            onPress={() => {
              void proceed();
            }}
            loading={busy}
            disabled={!!liveConfigurationError || !!errors.email || !!errors.password}
          />
          <Text style={styles.verificationHint}>Next, verify your sign-in with an email code.</Text>
        </View>
        {liveConfigurationError && <Notice error>{liveConfigurationError}</Notice>}
        {demoMode && (
          <Notice>
            Local preview: use a sample email and a password of at least 6 characters. No sign-in
            request or email is sent.
          </Notice>
        )}
        {demoMode && (
          <Button label="Explore sample reports" secondary onPress={signIn} icon="play-outline" />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  intro: { gap: 8, marginBottom: 24 },
  loginTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -1.1,
    color: c.ink,
  },
  form: { gap: 20 },
  loginInput: { fontSize: 16, minHeight: 56 },
  passwordToggle: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordTogglePressed: { backgroundColor: c.softGreen },
  submit: { gap: 12, paddingTop: 4 },
  verificationHint: { fontSize: 12, lineHeight: 18, color: c.muted, textAlign: 'center' },
});
