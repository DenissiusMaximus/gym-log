// Per-weight entry points: the package root would pull every Roboto weight into the web bundle.
import { Roboto_400Regular } from '@expo-google-fonts/roboto/400Regular';
import { Roboto_500Medium } from '@expo-google-fonts/roboto/500Medium';
import { Roboto_700Bold } from '@expo-google-fonts/roboto/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useData } from '@/data/useData';
import { useUi } from '@/data/useUi';
import { installCrashLog } from '@/dev/crashLog';
import { installErrorLog } from '@/dev/errorLog';
import { AppNotices } from '@/features/system/AppNotices';
import { WriteFailureLayout } from '@/features/system/WriteFailureBanner';
import { requestPersistentStorage } from '@/pwa/persistStorage';
import { registerSW } from '@/pwa/registerSW';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { PortalHost, PortalProvider } from '@/ui/Portal';
import { SnackbarHost } from '@/ui/Snackbar';

SplashScreen.preventAutoHideAsync();
installErrorLog();
installCrashLog();

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  const hydrated = useData((s) => s.hydrated);
  const themeMode = useData((s) => s.meta.themeMode);
  const ready = (fontsLoaded || fontError != null) && hydrated;

  useEffect(() => {
    void useData.getState().hydrate();
    registerSW();
    // iOS resumes a PWA without a reload, so "today" is refreshed when the app becomes active.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') useUi.getState().refreshToday();
    });
    // A PWA left open overnight has no resume event, so the day change is polled.
    const timer = setInterval(() => useUi.getState().refreshToday(), 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void requestPersistentStorage();
    // A new day: empty workouts of earlier days (or without a date) disappear.
    return useUi.subscribe((st, prev) => {
      if (st.today !== prev.today) useData.getState().pruneEmptyWorkouts(st.today);
    });
  }, [hydrated]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Until fonts and data are ready, render nothing: the splash screen covers native, and
  // the page background (set by the theme) covers web.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider mode={themeMode}>
          <PortalProvider>
            <WriteFailureLayout>
              <ThemedStack />
            </WriteFailureLayout>
            {/* Overlays sit outside the layout above, so they keep the real insets and draw over the banner; the snackbar above the overlays. */}
            <PortalHost />
            <SnackbarHost />
            <AppNotices />
          </PortalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
