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
import { installErrorLog } from '@/dev/errorLog';
import { requestPersistentStorage } from '@/pwa/persistStorage';
import { registerSW } from '@/pwa/registerSW';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();
installErrorLog();

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
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (hydrated) void requestPersistentStorage();
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
          <ThemedStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
