import { css, Image, Text, View, type Style } from './primitives';
import { Focusable } from './Focusable';
import { NAV_FOCUS_PREFIX } from '../hooks/tvFocus';
import { SettingsIcon, UserIcon } from './NavIcons';
import { machaIconUrl } from '../uiAssets';
import { px, colour, font, layout, pageGutter, radius, rem, type } from '../styles/theme';

export interface NavItem {
  key: string;
  label: string;
}

/**
 * The application top bar, from `.topbar` in base.css: brand, centred nav,
 * then the account and a cog to Settings.
 */
export function TopBar({
  items,
  active,
  onSelect,
  username,
  onSignOut,
  onOpenSettings,
  settingsActive,
}: {
  items: NavItem[];
  active: string;
  onSelect: (key: string) => void;
  username?: string;
  /** Selecting the account signs out. */
  onSignOut?: () => void;
  onOpenSettings: () => void;
  settingsActive?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.topbar}>
      <View style={styles.brand}>
        <Image source={machaIconUrl} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandName}>Macha</Text>
      </View>

      <View style={styles.nav}>
        {items.map((item, index) => (
          <Focusable
            key={item.key}
            focusId={`${NAV_FOCUS_PREFIX}${item.key}`}
            onSelect={() => onSelect(item.key)}
            style={css(styles.navItem, index > 0 && styles.navItemAfterFirst, active === item.key && styles.navItemActive)}
            focusedStyle={styles.navItemFocused}
          >
            {({ focused }) => (
              <Text style={css(styles.navLabel, (active === item.key || focused) && styles.navLabelActive)}>
                {item.label}
              </Text>
            )}
          </Focusable>
        ))}
      </View>

      {/* `.topbar-trailing { display: flex; align-items: center; gap: .75rem }` */}
      <View style={styles.trailing}>
        {/* The client's only sign-out. */}
        {username ? (
          <Focusable
            onSelect={() => onSignOut?.()}
            disabled={!onSignOut}
            style={styles.account}
            focusedStyle={styles.navItemFocused}
          >
            {({ focused }) => (
              <>
                <UserIcon />
                <Text style={css(styles.accountName, focused && styles.accountNameFocused)} numberOfLines={1}>
                  {username}
                </Text>
              </>
            )}
          </Focusable>
        ) : null}
        <Focusable
          focusId={`${NAV_FOCUS_PREFIX}settings`}
          onSelect={onOpenSettings}
          style={css(styles.settings, Boolean(username) && styles.settingsAfterAccount, settingsActive && styles.navItemActive)}
          focusedStyle={styles.navItemFocused}
        >
          {({ focused }) => (
            <SettingsIcon colour={settingsActive || focused ? colour.text : colour.textDim} />
          )}
        </Focusable>
      </View>
    </View>
  );
}

const styles = {
  // `.topbar { min-height: 62px; padding: .45rem 3vw; gap: 2rem }`, with
  // `--navigation-surface`'s gradient as a flat fill.
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.topbarHeight,
    paddingTop: rem(0.45),
    paddingBottom: rem(0.45),
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    backgroundColor: colour.background,
  },
  // `.brand-link { gap: .65rem }`; the bar's `2rem` gap follows it.
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: px(110),
    marginRight: rem(2),
  },
  // `.app-logo { width: 42px; height: 42px }`
  logo: {
    width: px(42),
    height: px(42),
    marginRight: rem(0.65),
  },
  // `.brand-name { color: #d8d8dc; font-size: 1.08rem; font-weight: 500 }`
  brandName: {
    color: '#d8d8dc',
    fontSize: rem(1.08),
    fontWeight: font.weightMedium,
    letterSpacing: 0.14,
  },
  // `.topbar nav { display: flex; gap: .25rem; justify-content: center }`
  nav: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  // `.topbar nav a { padding: .65rem .9rem; border-radius: .55rem }`
  navItem: {
    paddingTop: rem(0.65),
    paddingBottom: rem(0.65),
    paddingLeft: rem(0.9),
    paddingRight: rem(0.9),
    borderRadius: radius.control,
  },
  navItemAfterFirst: {
    marginLeft: rem(0.25),
  },
  // `.topbar nav a.active { background: var(--accent-surface) }`
  navItemActive: {
    backgroundColor: colour.accentSurface,
  },
  // With `Focusable`'s ring, which tells focus from the active page's fill.
  navItemFocused: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  navLabel: {
    color: colour.textDim,
    fontWeight: font.weightMedium,
    fontSize: type.body,
  },
  navLabelActive: {
    color: colour.text,
  },
  /** `.topbar-trailing { display: flex; align-items: center; gap: .75rem; margin-left: auto }`. */
  trailing: {
    minWidth: px(110),
    marginLeft: rem(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // `AccountMenu`'s trigger without its overflow menu: the name only.
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: rem(11),
  },
  accountNameFocused: {
    color: colour.text,
  },
  // `gap: .4rem` after the icon.
  accountName: {
    marginLeft: rem(0.4),
    color: colour.textDim,
    fontSize: type.small,
  },
  /** `.topbar-settings { padding: .3rem; border-radius: .45rem }`. */
  settings: {
    padding: rem(0.3),
    borderRadius: radius.small,
  },
  settingsAfterAccount: {
    marginLeft: rem(0.75),
  },
} satisfies Record<string, Style>;
