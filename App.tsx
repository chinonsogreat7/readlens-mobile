import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParams } from './src/navigation';
import { SessionProvider, useSession } from './src/state/session';
import { LoginScreen } from './src/screens/LoginScreen';
import { VerifyScreen } from './src/screens/VerifyScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { CreateReportScreen } from './src/screens/CreateReportScreen';
import { ReportDetailScreen } from './src/screens/ReportDetailScreen';
import { MediaViewerScreen } from './src/screens/MediaViewerScreen';
import { useReducedMotion } from 'react-native-reanimated';
import { colors } from './src/ui/theme';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from './src/ui/Screen';
import { Button, Notice } from './src/ui/components';
import { queryRetry } from './src/api/contracts';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppToaster } from './src/ui/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: queryRetry },
    mutations: { retry: false },
  },
});
const Stack = createNativeStackNavigator<RootStackParams>();
const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.green },
};

function Navigation() {
  const reducedMotion = useReducedMotion();
  const { signedIn, restoring, blocked, error, retryStorage } = useSession();
  if (restoring)
    return (
      <Screen>
        <ActivityIndicator
          accessibilityLabel="Restoring your session"
          color={colors.green}
          style={{ marginTop: 70 }}
        />
      </Screen>
    );
  if (blocked)
    return (
      <Screen>
        <View style={{ gap: 20, paddingTop: 60 }}>
          <Notice error>{error}</Notice>
          <Button label="Clear saved session and try again" onPress={retryStorage} />
        </View>
      </Screen>
    );
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        {signedIn ? (
          <Stack.Group navigationKey="authenticated">
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="CreateReport" component={CreateReportScreen} />
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
            <Stack.Screen
              name="MediaViewer"
              component={MediaViewerScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: reducedMotion ? 'fade' : 'default',
                gestureEnabled: false,
                contentStyle: { backgroundColor: '#111A16' },
              }}
            />
          </Stack.Group>
        ) : (
          <Stack.Group navigationKey="signed-out">
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Verify" component={VerifyScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style="dark" />
            <Navigation />
          </SessionProvider>
        </QueryClientProvider>
        <AppToaster />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
