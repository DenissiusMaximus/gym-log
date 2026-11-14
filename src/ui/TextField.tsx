import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import {
  Platform,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, shape, stateLayer, typography } from '../theme/tokens';
import { animateTo } from './animate';
import { withAlpha } from './color';
import { useSurfaceColor } from './surface';
import { createThemedStyles } from './themed';
import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Error message: turns the field red and replaces the supporting text. */
  error?: string;
  supportingText?: string;
  /** Shown only while the field is focused and empty (the label occupies the spot otherwise). */
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  selectTextOnFocus?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

const HEIGHT = 56;
const LABEL_LIFT = -28;
const LABEL_SCALE = 0.75;

const useOutlines = createThemedStyles((c) =>
  StyleSheet.create({
    rest: { borderWidth: 1, borderColor: c.outline },
    focused: { borderWidth: 2, borderColor: c.primary },
    error: { borderWidth: 1, borderColor: c.error },
    errorFocused: { borderWidth: 2, borderColor: c.error },
    disabled: { borderWidth: 1, borderColor: withAlpha(c.onSurface, stateLayer.disabledContainer) },
  }),
);

const useLabelColors = createThemedStyles((c) =>
  StyleSheet.create({
    rest: { color: c.onSurfaceVariant },
    focused: { color: c.primary },
    error: { color: c.error },
    disabled: { color: withAlpha(c.onSurface, stateLayer.disabledContent) },
  }),
);

/** MD3 outlined text field: 56 dp, radius 4, 1 px outline (2 px primary when focused), label rises onto the outline. */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  supportingText,
  placeholder,
  disabled,
  autoFocus,
  selectTextOnFocus,
  keyboardType,
  returnKeyType,
  autoCapitalize,
  maxLength,
  onSubmitEditing,
  onFocus,
  onBlur,
  ref,
}: Props) {
  const { colors } = useTheme();
  const surface = useSurfaceColor();
  const reduced = useReducedMotion();
  const outlines = useOutlines();
  const labelColors = useLabelColors();
  const [focused, setFocused] = useState(false);

  const floated = focused || value.length > 0;
  const lift = useSharedValue(floated ? 1 : 0);
  useEffect(() => {
    lift.set(animateTo(floated ? 1 : 0, 'spatialFast', reduced));
  }, [floated, lift, reduced]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: LABEL_LIFT * lift.get() }, { scale: 1 - (1 - LABEL_SCALE) * lift.get() }],
  }));

  const hasError = error !== undefined;
  const outline = disabled
    ? outlines.disabled
    : hasError
      ? focused
        ? outlines.errorFocused
        : outlines.error
      : focused
        ? outlines.focused
        : outlines.rest;
  const labelColor = disabled
    ? labelColors.disabled
    : hasError
      ? labelColors.error
      : focused
        ? labelColors.focused
        : labelColors.rest;
  const note = error ?? supportingText;

  return (
    <View style={styles.root}>
      <View style={styles.field}>
        <View style={[styles.outline, outline]} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          autoFocus={autoFocus}
          selectTextOnFocus={selectTextOnFocus}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholder={focused ? placeholder : undefined}
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          maxFontSizeMultiplier={1.5}
          accessibilityLabel={label}
          accessibilityHint={error}
          style={[styles.input, { color: disabled ? withAlpha(colors.onSurface, stateLayer.disabledContent) : colors.onSurface }]}
        />
        <Animated.View style={[styles.labelWrap, { backgroundColor: surface }, labelStyle]}>
          <RNText numberOfLines={1} style={[styles.label, labelColor]}>
            {label}
          </RNText>
        </Animated.View>
      </View>
      {note ? (
        <Text variant="bodySmall" color={hasError ? 'error' : 'onSurfaceVariant'} style={styles.note}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const webReset = Platform.select<TextStyle>({ web: { outlineWidth: 0 }, default: {} });

const styles = StyleSheet.create({
  // The top padding leaves room for the label while it sits on the outline.
  root: { paddingTop: 8 },
  field: { height: HEIGHT, justifyContent: 'center' },
  outline: { ...StyleSheet.absoluteFill, borderRadius: shape.extraSmall, pointerEvents: 'none' },
  input: {
    height: HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    letterSpacing: typography.bodyLarge.letterSpacing,
    textAlignVertical: 'center',
    ...webReset,
  },
  labelWrap: {
    position: 'absolute',
    left: 12,
    top: 16,
    paddingHorizontal: 4,
    transformOrigin: 'left center',
    pointerEvents: 'none',
  },
  label: { ...typography.bodyLarge },
  note: { paddingHorizontal: 16, marginTop: 4 },
});
