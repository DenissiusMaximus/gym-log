import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { strings } from '../../lib/strings';
import { shape } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { useFills } from '../../ui/themed';

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

/** iPhone or iPad (iPadOS Safari reports itself as a Mac, but has a touch screen). */
function isIosDevice(nav: NavigatorWithStandalone): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

// "Got it" hides the card until the next launch only: a module variable lives as long as the page.
let dismissed = false;

/** Reminder to install the PWA, shown in iOS Safari outside standalone mode. */
export function InstallHint() {
  const fills = useFills();
  const [hidden, setHidden] = useState(dismissed);

  if (hidden || typeof navigator === 'undefined') return null;
  const nav = navigator as NavigatorWithStandalone;
  if (!isIosDevice(nav) || nav.standalone === true) return null;

  return (
    <View style={[styles.card, fills.tertiaryContainer]} accessibilityRole="alert">
      <Text variant="bodyMedium" color="onTertiaryContainer">
        {strings.install.text}
      </Text>
      <Button
        title={strings.install.gotIt}
        variant="text"
        style={styles.action}
        onPress={() => {
          dismissed = true;
          setHidden(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, borderRadius: shape.large, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 4 },
  action: { alignSelf: 'flex-end' },
});
