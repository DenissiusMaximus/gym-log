import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLongDate } from '../../lib/date';
import { formatWeight } from '../../lib/format';
import { strings } from '../../lib/strings';
import { Text } from '../../ui/Text';
import { createThemedStyles } from '../../ui/themed';
import type { ChartPoint } from './chartMath';
import { historyLabel } from './labels';

const s = strings.chart;

const useDivider = createThemedStyles((c) => StyleSheet.create({ line: { borderBottomColor: c.outlineVariant } }));

/** "History" heading above the rows. */
export function HistoryTitle() {
  return (
    <Text variant="titleMedium" accessibilityRole="header" style={styles.title} testID="history-title">
      {s.history}
    </Text>
  );
}

/**
 * One workout of the exercise: the date on the left, the weight on the right ("45 kg", or the
 * sets "40 · 42.5 · 45 kg" with their average underneath). The list is the text twin of the chart.
 */
export const HistoryRow = memo(function HistoryRow({ point }: { point: ChartPoint }) {
  const divider = useDivider();
  const several = point.weights.length > 1;
  return (
    <View
      style={[styles.row, divider.line]}
      testID={`history-row-${point.date}`}
      accessible
      accessibilityLabel={historyLabel(point)}
    >
      <Text variant="bodyLarge" style={styles.date} numberOfLines={1}>
        {formatLongDate(point.date)}
      </Text>
      <View style={styles.value}>
        <Text variant="bodyLarge" numeric style={styles.valueText}>
          {several
            ? `${point.weights.map(formatWeight).join(' · ')} ${s.unit}`
            : `${formatWeight(point.avg)} ${s.unit}`}
        </Text>
        {several ? (
          <Text variant="labelSmall" color="onSurfaceVariant" numeric>
            {`${s.avg} ${formatWeight(point.avg)}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  title: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: { flexShrink: 1 },
  value: { flex: 1, alignItems: 'flex-end' },
  valueText: { textAlign: 'right' },
});
