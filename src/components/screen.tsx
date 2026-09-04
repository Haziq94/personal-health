import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  /** Optional: a screen may render empty while its data loads. */
  children?: ReactNode;
  /** Set false for screens that manage their own scrolling (e.g. long lists). */
  scroll?: boolean;
};

/** Standard page frame: themed background, gutters, and a max width for tablets. */
export function Screen({ children, scroll = true }: ScreenProps) {
  const theme = useTheme();
  const body = <View style={styles.content}>{children}</View>;

  if (!scroll) {
    return <View style={[styles.root, { backgroundColor: theme.background }]}>{body}</View>;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      contentInsetAdjustmentBehavior="automatic">
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.six },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
});
