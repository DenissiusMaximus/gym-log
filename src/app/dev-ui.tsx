// Temporary showcase of the UI kit (stage 3); removed in stage 8.
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useData } from '@/data/useData';
import { addDays, todayStr } from '@/lib/date';
import * as haptics from '@/lib/haptics';
import { strings } from '@/lib/strings';
import type { ThemeMode } from '@/theme/ThemeProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { typography, type TypeVariant } from '@/theme/tokens';
import { ActionSheet } from '@/ui/ActionSheet';
import { Banner } from '@/ui/Banner';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Chip } from '@/ui/Chip';
import { DatePickerDialog } from '@/ui/DatePickerDialog';
import { Dialog } from '@/ui/Dialog';
import { Fab } from '@/ui/Fab';
import { FabMenu } from '@/ui/FabMenu';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { icons, type IconName } from '@/ui/icons.generated';
import { ListItem } from '@/ui/ListItem';
import { SegmentedButtons } from '@/ui/SegmentedButtons';
import { showSnackbar } from '@/ui/Snackbar';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { TopAppBar } from '@/ui/TopAppBar';

const s = strings.devUi;

const THEME_OPTIONS = [
  { value: 'light', label: s.light },
  { value: 'dark', label: s.dark },
  { value: 'system', label: s.system },
] as const;

const PERIOD_OPTIONS = [
  { value: '1m', label: '1 mo' },
  { value: '3m', label: '3 mo' },
  { value: '6m', label: '6 mo' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
] as const;

const TYPE_VARIANTS = Object.keys(typography) as TypeVariant[];
const ICON_NAMES = Object.keys(icons) as IconName[];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  const style = useMemo(() => ({ backgroundColor: colors.surfaceContainerLow }), [colors.surfaceContainerLow]);
  return (
    <View style={[styles.section, style]}>
      <Text variant="titleMedium">{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Caption({ children }: { children: string }) {
  return (
    <Text variant="labelMedium" color="onSurfaceVariant">
      {children}
    </Text>
  );
}

type OverlayName = 'modal' | 'nonModal' | 'actions' | 'dialog' | 'dialogTop' | 'date' | null;

export default function DevUi() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const rootStyle = useMemo(() => ({ backgroundColor: colors.surface }), [colors.surface]);

  const [overlay, setOverlay] = useState<OverlayName>(null);
  const close = () => setOverlay(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [filter, setFilter] = useState(true);
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]['value']>('3m');
  const [checks, setChecks] = useState({ a: false, b: true });
  const [name, setName] = useState('Bench press');
  const [empty, setEmpty] = useState('');
  const [dialogName, setDialogName] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState(true);

  const today = todayStr();
  const marked = useMemo(
    () => new Set([addDays(today, -2), addDays(today, -5), addDays(today, 3), today]),
    [today],
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const setTheme = (value: ThemeMode) => useData.getState().setMeta({ themeMode: value });

  return (
    <View style={[styles.root, rootStyle]}>
      <TopAppBar
        title={s.title}
        onBack={goBack}
        actions={<IconButton icon="settings" accessibilityLabel="Settings (demo)" onPress={() => {}} />}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 + sheetHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <Section title={s.theme}>
          <SegmentedButtons
            accessibilityLabel={s.theme}
            options={THEME_OPTIONS}
            value={mode}
            onChange={setTheme}
          />
          <Row>
            <Button title={s.back} variant="tonal" icon="arrow_back" onPress={goBack} />
          </Row>
        </Section>

        <Section title="Text">
          {TYPE_VARIANTS.map((variant) => (
            <Text key={variant} variant={variant} numberOfLines={1}>
              {variant} 0123456789
            </Text>
          ))}
          <Text variant="bodyMedium" color="onSurfaceVariant">
            onSurfaceVariant
          </Text>
          <Text variant="bodyMedium" color="primary">
            primary
          </Text>
          <Text variant="bodyMedium" color="error">
            error
          </Text>
        </Section>

        <Section title="Icons">
          <View style={styles.icons}>
            {ICON_NAMES.map((icon) => (
              <Icon key={icon} name={icon} color={colors.onSurfaceVariant} />
            ))}
          </View>
        </Section>

        <Section title="Button">
          <Caption>filled / tonal / text</Caption>
          <Row>
            <Button title="Filled" onPress={() => {}} />
            <Button title="Tonal" variant="tonal" onPress={() => {}} />
            <Button title="Text" variant="text" onPress={() => {}} />
          </Row>
          <Caption>with icon</Caption>
          <Row>
            <Button title="Add" icon="add" onPress={() => {}} />
            <Button title="Edit" icon="edit" variant="tonal" onPress={() => {}} />
            <Button title="Share" icon="ios_share" variant="text" onPress={() => {}} />
          </Row>
          <Caption>error tone</Caption>
          <Row>
            <Button title="Delete" tone="error" onPress={() => {}} />
            <Button title="Delete" tone="error" variant="tonal" onPress={() => {}} />
            <Button title="Delete" tone="error" variant="text" onPress={() => {}} />
          </Row>
          <Caption>disabled</Caption>
          <Row>
            <Button title="Filled" disabled onPress={() => {}} />
            <Button title="Tonal" variant="tonal" disabled onPress={() => {}} />
            <Button title="Text" variant="text" disabled onPress={() => {}} />
          </Row>
        </Section>

        <Section title="IconButton">
          <Row>
            <IconButton icon="more_vert" accessibilityLabel="More" onPress={() => {}} />
            <IconButton icon="show_chart" accessibilityLabel="Chart" variant="filled" onPress={() => {}} />
            <IconButton icon="edit" accessibilityLabel="Edit" variant="tonal" onPress={() => {}} />
            <IconButton icon="trending_up" accessibilityLabel="Trend" selected onPress={() => {}} />
            <IconButton icon="delete" accessibilityLabel="Delete" disabled onPress={() => {}} />
          </Row>
          <Caption>56 dp, press scale 0.92 (stepper)</Caption>
          <Row>
            <IconButton icon="remove" accessibilityLabel="Decrease" variant="tonal" size={56} pressedScale={0.92} onPress={() => haptics.tick()} />
            <IconButton icon="add" accessibilityLabel="Increase" variant="filled" size={56} pressedScale={0.92} onPress={() => haptics.tick()} />
          </Row>
        </Section>

        <Section title="Fab">
          <Row>
            <Fab icon="add" accessibilityLabel="Add" onPress={() => {}} />
            <Fab icon="edit" label="Extended" accessibilityLabel="Extended action" onPress={() => {}} />
          </Row>
          <Caption>FabMenu sits at the bottom right of this screen</Caption>
        </Section>

        <Section title="Chip">
          <Row>
            <Chip label="All" selected={filter} onPress={() => setFilter((v) => !v)} />
            <Chip label="Push" selected={!filter} onPress={() => setFilter((v) => !v)} />
            <Chip label="Disabled" selected={false} disabled onPress={() => {}} />
            <Chip label="Group" icon="add" onPress={() => {}} />
          </Row>
        </Section>

        <Section title="SegmentedButtons">
          <SegmentedButtons options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </Section>

        <Section title="Checkbox">
          <Row>
            <Checkbox
              accessibilityLabel="Unchecked"
              checked={checks.a}
              onChange={(a) => setChecks((c) => ({ ...c, a }))}
            />
            <Checkbox
              accessibilityLabel="Checked"
              checked={checks.b}
              onChange={(b) => setChecks((c) => ({ ...c, b }))}
            />
            <Checkbox accessibilityLabel="Disabled" checked={false} disabled onChange={() => {}} />
            <Checkbox accessibilityLabel="Disabled checked" checked disabled onChange={() => {}} />
            <Checkbox accessibilityLabel="Error" checked={false} error onChange={() => {}} />
          </Row>
          <Checkbox
            label="With a label"
            checked={checks.a}
            onChange={(a) => setChecks((c) => ({ ...c, a }))}
          />
        </Section>

        <Section title="TextField">
          <TextField label="Exercise name" value={empty} onChangeText={setEmpty} placeholder="For example, Squat" />
          <TextField label="Exercise name" value={name} onChangeText={setName} supportingText="Up to 40 characters" />
          <TextField label="Exercise name" value="Bench press" onChangeText={() => {}} error="This exercise already exists" />
          <TextField label="Disabled" value="Read only" onChangeText={() => {}} disabled />
        </Section>

        <Section title="ListItem">
          <ListItem headline="One line" />
          <ListItem headline="Pressable with icon" leading={<Icon name="fitness_center" color={colors.onSurfaceVariant} />} onPress={() => {}} />
          <ListItem headline="Two lines" supporting="Supporting text" onPress={() => {}} trailing={<Icon name="chevron_right" color={colors.onSurfaceVariant} />} />
          <ListItem headline="Selected" selected={selectedItem} onPress={() => setSelectedItem((v) => !v)} />
          <ListItem headline="Destructive" headlineColor="error" onPress={() => {}} leading={<Icon name="delete" color={colors.error} />} />
          <ListItem headline="Disabled" disabled onPress={() => {}} />
        </Section>

        <Section title="Banner">
          <Banner tone="error" text={strings.persist.failedBanner} actionLabel={strings.persist.saveCopy} onAction={() => {}} />
          <Banner tone="info" text="Install the app to use it offline." />
          <Banner tone="warning" text="There was no backup for a long time." actionLabel="Save" onAction={() => {}} />
        </Section>

        <Section title="Overlays">
          <Row>
            <Button title="Modal sheet" variant="tonal" onPress={() => setOverlay('modal')} />
            <Button title="Non-modal sheet" variant="tonal" onPress={() => setOverlay('nonModal')} />
            <Button title="Action sheet" variant="tonal" onPress={() => setOverlay('actions')} />
          </Row>
          <Row>
            <Button title="Dialog" variant="tonal" onPress={() => setOverlay('dialog')} />
            <Button title="Dialog (top)" variant="tonal" onPress={() => setOverlay('dialogTop')} />
            <Button title="Date picker" variant="tonal" onPress={() => setOverlay('date')} />
          </Row>
          <Text variant="bodyMedium" color="onSurfaceVariant">
            Picked date: {picked ?? 'none'} | sheet height: {Math.round(sheetHeight)}
          </Text>
        </Section>

        <Section title="Snackbar">
          <Row>
            <Button title="Plain" variant="tonal" onPress={() => showSnackbar({ text: 'Workout deleted' })} />
            <Button
              title="With action"
              variant="tonal"
              onPress={() => showSnackbar({ text: 'Workout deleted', actionLabel: strings.common.undo, onAction: () => showSnackbar({ text: 'Restored' }) })}
            />
            <Button
              title="Above FAB"
              variant="tonal"
              onPress={() => showSnackbar({ text: 'Raised by 72 dp', actionLabel: 'OK', bottomOffset: 72 })}
            />
            <Button
              title="Long text"
              variant="tonal"
              onPress={() =>
                showSnackbar({
                  text: 'This is a long message that does not fit on one line of a narrow phone screen',
                  actionLabel: 'Dismiss',
                  duration: 8000,
                })
              }
            />
          </Row>
        </Section>

        <Section title="Haptics (Android only)">
          <Row>
            <Button title="tapCell" variant="text" onPress={haptics.tapCell} />
            <Button title="tick" variant="text" onPress={haptics.tick} />
            <Button title="key" variant="text" onPress={haptics.key} />
            <Button title="confirm" variant="text" onPress={haptics.confirm} />
            <Button title="dragStart" variant="text" onPress={haptics.dragStart} />
            <Button title="dragStep" variant="text" onPress={haptics.dragStep} />
            <Button title="reject" variant="text" onPress={haptics.reject} />
          </Row>
        </Section>
      </ScrollView>

      <FabMenu
        open={fabOpen}
        onOpenChange={setFabOpen}
        accessibilityLabel="New workout"
        visible={overlay !== 'nonModal'}
        items={[
          { key: 'today', label: `Today, ${today.slice(8, 10)}.${today.slice(5, 7)}`, icon: 'today', onPress: () => haptics.confirm() },
          { key: 'nodate', label: 'No date', icon: 'event_upcoming', onPress: () => haptics.confirm() },
        ]}
      />

      <BottomSheet visible={overlay === 'modal'} onClose={close} accessibilityLabel="Modal sheet">
        <View style={styles.sheetBody}>
          <Text variant="titleMedium">Modal sheet</Text>
          <Text variant="bodyMedium" color="onSurfaceVariant">
            Scrim 0.32. Tap the scrim, press back or drag the handle down to close.
          </Text>
          <Button title="Close" variant="tonal" onPress={close} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={overlay === 'nonModal'}
        onClose={close}
        modal={false}
        onHeightChange={setSheetHeight}
        accessibilityLabel="Non-modal sheet"
      >
        <View style={styles.sheetBody}>
          <Text variant="titleMedium">Non-modal sheet</Text>
          <Text variant="bodyMedium" color="onSurfaceVariant">
            No scrim: the list above stays scrollable and tappable. Height: {Math.round(sheetHeight)}.
          </Text>
          <Row>
            <Button title="Snackbar above" variant="tonal" onPress={() => showSnackbar({ text: 'Above the sheet', bottomOffset: sheetHeight - 16 })} />
            <Button title="Done" onPress={close} />
          </Row>
        </View>
      </BottomSheet>

      <ActionSheet
        visible={overlay === 'actions'}
        onClose={close}
        title="Workout 21.10.2026, Wed"
        actions={[
          { key: 'date', label: 'Change date...', icon: 'event_upcoming', onPress: () => setOverlay('date') },
          { key: 'today', label: 'Today', icon: 'today', onPress: () => {} },
          { key: 'off', label: 'Disabled entry', icon: 'archive', disabled: true, onPress: () => {} },
          { key: 'delete', label: 'Delete', icon: 'delete', destructive: true, onPress: () => showSnackbar({ text: 'Workout deleted', actionLabel: strings.common.undo }) },
        ]}
      />

      <Dialog
        visible={overlay === 'dialog'}
        onClose={close}
        title="Discard changes?"
        actions={
          <>
            <Button title={strings.ui.cancel} variant="text" onPress={close} />
            <Button title="Discard" variant="text" tone="error" onPress={close} />
          </>
        }
      >
        <Text variant="bodyMedium" color="onSurfaceVariant">
          A standard centered dialog: radius 28, surface-container-high, padding 24.
        </Text>
      </Dialog>

      <Dialog
        visible={overlay === 'dialogTop'}
        onClose={close}
        anchor="top"
        title="New exercise"
        actions={
          <>
            <Button title={strings.ui.cancel} variant="text" onPress={close} />
            <Button title={strings.ui.done} variant="text" disabled={dialogName.trim() === ''} onPress={close} />
          </>
        }
      >
        <TextField
          label="Name"
          value={dialogName}
          onChangeText={setDialogName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={close}
        />
      </Dialog>

      <DatePickerDialog
        visible={overlay === 'date'}
        value={picked}
        today={today}
        markedDates={marked}
        getWarning={(date) => (marked.has(date) ? 'A workout already exists on this date - the columns will be merged' : null)}
        onCancel={close}
        onConfirm={(date) => {
          setPicked(date);
          close();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  section: { borderRadius: 16, padding: 12, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  sheetBody: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, gap: 12 },
});
