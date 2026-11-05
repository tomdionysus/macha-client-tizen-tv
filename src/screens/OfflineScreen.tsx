import { useEffect } from 'react';
import { Image, Text, View, type Style } from '../components/primitives';
import { Button } from '../components/Button';
import { tvFocus } from '../hooks/tvFocus';
import { machaIconUrl } from '../uiAssets';
import { colour, font, rem, type } from '../styles/theme';

export const OFFLINE_SCOPE = 'offline';

/**
 * No node answered. Not a login: no node refused the viewer, and signing in
 * needs a reachable node too. Offers only Settings; core retries on its own
 * timer and the screen goes away when a node comes back.
 */
export function OfflineScreen({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}): React.JSX.Element {
  useEffect(() => {
    tvFocus.pushScope(OFFLINE_SCOPE);
    return () => tvFocus.popScope(OFFLINE_SCOPE);
  }, []);

  return (
    <View style={styles.page}>
      <Image source={machaIconUrl} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Can’t reach Macha</Text>
      <Text style={styles.blurb}>
        No server answered. This is usually the network rather than anything
        wrong with the set; it will reconnect on its own.
      </Text>
      {onOpenSettings ? (
        <Button label="Server settings" onSelect={onOpenSettings} scope={OFFLINE_SCOPE} defaultFocus />
      ) : null}
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colour.background,
    paddingLeft: rem(3),
    paddingRight: rem(3),
  },
  logo: {
    width: rem(4),
    height: rem(4),
    marginBottom: rem(1),
    opacity: 0.5,
  },
  title: {
    color: colour.text,
    fontSize: type.h2,
    fontWeight: font.weightSemibold,
  },
  blurb: {
    color: colour.textDim,
    fontSize: type.body,
    marginTop: rem(0.4),
    marginBottom: rem(1.4),
    textAlign: 'center',
    maxWidth: rem(30),
  },
} satisfies Record<string, Style>;
