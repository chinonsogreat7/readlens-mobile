import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation';
import { demoMode, useSession } from '../state/session';
import { Screen } from '../ui/Screen';
import { colors as c } from '../ui/theme';
import { auth } from '../services';
import { errorMessage } from '../api/contracts';
import { dismissNotification, notify } from '../ui/notifications';
import { useAuthNotification } from '../auth/useAuthNotification';
import { Button, Icon, Notice } from '../ui/components';
import { OtpInput } from '../ui/OtpInput';
import { isOtpComplete, OTP_LENGTH } from '../auth/otp-input';
import { createVerificationLifetime } from '../auth/verification-lifetime';
import {
  formatResendCountdown,
  OTP_RESEND_DELAY_MS,
  resendSecondsRemaining,
} from '../auth/otp-cooldown';

export function VerifyScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParams, 'Verify'>) {
  const { signIn, signedIn } = useSession();
  const { id: notificationId } = useAuthNotification();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(() =>
    demoMode
      ? Date.now() + OTP_RESEND_DELAY_MS
      : (auth.getResendAvailableAt(route.params.email) ?? 0),
  );
  const [remaining, setRemaining] = useState(() => resendSecondsRemaining(resendAvailableAt));
  useEffect(() => {
    const update = () => setRemaining(resendSecondsRemaining(resendAvailableAt));
    update();
    const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [resendAvailableAt]);
  const pending = useRef<AbortController | null>(null);
  const lifetime = useRef<ReturnType<typeof createVerificationLifetime> | null>(null);
  if (!lifetime.current) {
    lifetime.current = createVerificationLifetime(() => {
      pending.current?.abort();
      auth.cancel();
    });
  }
  useEffect(() => lifetime.current!.attach(), []);
  useEffect(() => {
    // A full reload cannot recover memory-only credentials. Never leave an
    // unusable OTP screen presenting a countdown as though an email was sent.
    if (!demoMode && !signedIn && auth.getResendAvailableAt(route.params.email) === undefined) {
      navigation.popTo('Login');
    }
  }, [navigation, route.params.email, signedIn]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const codeInput = useRef<TextInput>(null);
  async function resend() {
    if (pending.current || resendSecondsRemaining(resendAvailableAt) > 0) return;
    const controller = new AbortController();
    pending.current = controller;
    setResending(true);
    dismissNotification(notificationId);
    try {
      if (!demoMode) {
        const request = auth.resend(route.params.email, controller.signal);
        const deadline = auth.getResendAvailableAt(route.params.email);
        if (deadline !== undefined) setResendAvailableAt(deadline);
        await request;
      }
      if (controller.signal.aborted) return;
      setCode('');
      setError(undefined);
      notify(
        notificationId,
        'success',
        demoMode ? 'Preview code ready' : 'New code sent',
        demoMode
          ? 'Use 123456. No email was sent.'
          : 'Check your inbox and use the latest email code.',
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        notify(notificationId, 'error', 'Couldn’t resend code', errorMessage(error));
        if (!demoMode && auth.getResendAvailableAt(route.params.email) === undefined)
          navigation.popTo('Login');
      }
    } finally {
      if (!controller.signal.aborted) {
        const deadline = demoMode
          ? Date.now() + OTP_RESEND_DELAY_MS
          : auth.getResendAvailableAt(route.params.email);
        if (deadline !== undefined) setResendAvailableAt(deadline);
        setResending(false);
      }
      pending.current = null;
    }
  }
  async function verify() {
    if (pending.current) return;
    dismissNotification(notificationId);
    if (!isOtpComplete(code)) {
      setError('Enter all 6 digits from your email.');
      codeInput.current?.focus();
      return;
    }
    if (demoMode && code !== '123456') {
      setError('For this preview, enter 123456.');
      codeInput.current?.focus();
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    Keyboard.dismiss();
    setBusy(true);
    setError(undefined);
    try {
      if (demoMode) signIn();
      else await auth.verify(route.params.email, code.trim(), controller.signal);
    } catch (error) {
      if (!controller.signal.aborted)
        notify(notificationId, 'error', 'Couldn’t verify code', errorMessage(error));
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  return (
    <Screen backgroundColor={c.background}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
        disabled={busy || resending}
        accessibilityState={{ disabled: busy || resending }}
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backLink, pressed && styles.linkPressed]}
      >
        <Icon name="arrow-back" size={20} />
        <Text style={styles.linkText}>Back to sign in</Text>
      </Pressable>
      <View style={styles.verifyIntro}>
        <View style={styles.mailIcon}>
          <Icon name="mail-outline" size={26} />
        </View>
        <Text accessibilityRole="header" style={styles.verifyTitle}>
          Check your email
        </Text>
        <View style={styles.emailCopy}>
          <Text style={styles.verifyDescription}>
            {demoMode ? 'Preview email verification for' : 'Enter the code we sent to'}
          </Text>
          <Text style={styles.destinationEmail}>{route.params.email}</Text>
        </View>
      </View>
      <View style={styles.verifyForm}>
        <OtpInput
          inputRef={codeInput}
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError(undefined);
            dismissNotification(notificationId);
          }}
          length={OTP_LENGTH}
          disabled={busy || resending}
          error={error}
          onSubmit={() => void verify()}
        />
        <Button
          label={busy ? 'Verifying…' : 'Verify email'}
          onPress={() => {
            void verify();
          }}
          loading={busy}
          disabled={resending || !isOtpComplete(code)}
        />
        {demoMode && (
          <Notice>
            Preview code: 123456. This demonstrates the flow without sending an email or creating an
            authenticated session.
          </Notice>
        )}
        <View style={styles.codeHelp}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Requests a new verification code by email."
            accessibilityState={{ disabled: busy || resending || remaining > 0, busy: resending }}
            disabled={busy || resending || remaining > 0}
            onPress={() => void resend()}
            style={({ pressed }) => [styles.resendLink, pressed && styles.linkPressed]}
          >
            <Text
              style={[
                styles.linkText,
                (remaining > 0 || busy || resending) && styles.resendDisabled,
              ]}
            >
              {resending
                ? 'Sending code…'
                : remaining > 0
                  ? `Resend code in ${formatResendCountdown(remaining)}`
                  : 'Resend code'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mailIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.softGreen,
  },
  backLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingRight: 12,
    marginBottom: 20,
    borderRadius: 10,
  },
  linkText: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: c.green },
  linkPressed: { opacity: 0.65, backgroundColor: c.softGreen },
  verifyIntro: { alignItems: 'center', gap: 16, marginBottom: 32 },
  verifyTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: c.ink,
    textAlign: 'center',
  },
  emailCopy: { gap: 4, alignSelf: 'stretch' },
  verifyDescription: { fontSize: 14, lineHeight: 21, color: c.muted, textAlign: 'center' },
  destinationEmail: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: c.ink,
    textAlign: 'center',
  },
  verifyForm: { gap: 24 },
  codeHelp: { alignItems: 'center' },
  resendDisabled: { color: c.muted, fontVariant: ['tabular-nums'] },
  resendLink: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
});
