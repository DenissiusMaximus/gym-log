import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatFullDate, formatColumnDate, formatLongDate } from '../../lib/date';
import { formatWeight } from '../../lib/format';
import { strings } from '../../lib/strings';
import { useTheme } from '../../theme/ThemeProvider';
import { shape } from '../../theme/tokens';
import { Icon, type IconName } from '../../ui/Icon';
import { Text } from '../../ui/Text';
import { useFills } from '../../ui/themed';
import type { ChartPoint, PeriodChange, PlateauInfo, RecordInfo } from './chartMath';
import { pointValue, relativeDay, setsText, signed } from './labels';

const s = strings.chart;

type SummaryProps = {
  /** The point to describe: the one under the cursor, else the latest. */
  point: ChartPoint;
  /** True while a point is picked on the chart. */
  scrubbing: boolean;
  today: string;
};

/** Words above the chart: the value, its date and, for several sets, the sets. */
export const ChartSummary = memo(function ChartSummary({ point, scrubbing, today }: SummaryProps) {
  const { prefix, value } = pointValue(point);
  const date = formatLongDate(point.date);
  const when = scrubbing ? date : `${date} · ${relativeDay(point.date, today)}`;
  const valueText = `${prefix ? `${prefix} ` : ''}${value} ${s.unit}`;
  return (
    <View
      style={styles.summary}
      testID="chart-summary"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${valueText}, ${when}${point.weights.length > 1 ? `, ${s.sets(setsText(point.weights))}` : ''}`}
    >
      <View style={styles.valueRow}>
        {prefix ? (
          <Text variant="titleMedium" color="onSurfaceVariant" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <Text variant="displaySmall" numeric testID="chart-summary-value">
          {value}
        </Text>
        <Text variant="titleMedium" color="onSurfaceVariant" style={styles.unit}>
          {s.unit}
        </Text>
      </View>
      <Text variant="bodyMedium" color="onSurfaceVariant" testID="chart-summary-date">
        {when}
      </Text>
      {point.weights.length > 1 ? (
        <Text variant="bodyMedium" color="onSurfaceVariant" numeric testID="chart-summary-sets">
          {s.sets(setsText(point.weights))}
        </Text>
      ) : null}
    </View>
  );
});

type CardProps = {
  label: string;
  value: string;
  sub?: string;
  icon?: IconName;
  iconColor?: 'primary' | 'onSurfaceVariant';
  testID: string;
  accessibilityLabel: string;
};

function StatCard({ label, value, sub, icon, iconColor = 'onSurfaceVariant', testID, accessibilityLabel }: CardProps) {
  const { colors } = useTheme();
  const fills = useFills();
  return (
    <View
      style={[styles.card, fills.surfaceContainerLow]}
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      <Text variant="labelMedium" color="onSurfaceVariant" numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.cardValue}>
        {icon ? <Icon name={icon} size={18} color={colors[iconColor]} /> : null}
        {/* One line on a 360 dp screen: smaller type, shrunk further where the platform supports it. */}
        <Text
          variant="titleSmall"
          numeric
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={styles.cardValueText}
        >
          {value}
        </Text>
      </View>
      {sub ? (
        <Text variant="labelSmall" color="onSurfaceVariant" numeric>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

type CardsProps = {
  record: RecordInfo | null;
  /** First-to-last change of the visible points; null with fewer than two. */
  change: PeriodChange | null;
  plateau: PlateauInfo | null;
  /** The change card needs a second point somewhere in the series. */
  showChange: boolean;
  /** With up to three points the change card names the number of days instead of the range. */
  fewPoints: boolean;
};

/** Record, change over the period and the length of the current plateau. */
export const StatCards = memo(function StatCards({ record, change, plateau, showChange, fewPoints }: CardsProps) {
  const showPlateau = plateau !== null && (plateau.count >= 2 || plateau.isNew);

  let changeValue = '-';
  let changeSub: string | undefined;
  let changeIcon: IconName = 'trending_flat';
  if (change) {
    if (Math.abs(change.delta) < 1e-9) {
      changeValue = s.noChange;
    } else {
      changeIcon = change.delta > 0 ? 'trending_up' : 'trending_down';
      changeValue = fewPoints ? s.inPeriod(signed(change.delta), change.days) : s.delta(signed(change.delta));
      changeSub = fewPoints ? undefined : s.fromTo(formatWeight(change.from), formatWeight(change.to));
    }
  }

  return (
    <View style={styles.cards}>
      {record ? (
        <StatCard
          testID="chart-card-record"
          label={s.record}
          value={`${formatWeight(record.value)} ${s.unit}`}
          sub={formatFullDate(record.date)}
          accessibilityLabel={`${s.record}: ${formatWeight(record.value)} ${s.unit}, ${formatFullDate(record.date)}`}
        />
      ) : null}
      {showChange ? (
        <StatCard
          testID="chart-card-period"
          label={s.thisPeriod}
          value={changeValue}
          sub={changeSub}
          icon={change ? changeIcon : undefined}
          iconColor={changeIcon === 'trending_up' ? 'primary' : 'onSurfaceVariant'}
          accessibilityLabel={`${s.thisPeriod}: ${changeValue}${changeSub ? `, ${changeSub}` : ''}`}
        />
      ) : null}
      {showPlateau && plateau ? (
        <StatCard
          testID="chart-card-plateau"
          label={s.atThisWeight}
          value={plateau.isNew ? s.newWeight : s.workouts(plateau.count)}
          sub={plateau.isNew ? undefined : s.since(formatColumnDate(plateau.since))}
          accessibilityLabel={
            plateau.isNew
              ? `${s.atThisWeight}: ${s.newWeight}`
              : `${s.atThisWeight}: ${s.workouts(plateau.count)}, ${s.since(formatColumnDate(plateau.since))}`
          }
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  summary: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  prefix: { marginRight: 2 },
  unit: { marginLeft: 2 },
  cards: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  card: { flex: 1, borderRadius: shape.large, paddingHorizontal: 8, paddingVertical: 12, gap: 4 },
  cardValue: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardValueText: { flexShrink: 1 },
});
