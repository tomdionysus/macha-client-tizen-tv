import { useCallback, useEffect, useRef } from 'react';
import { css, Text, View, type Style } from './primitives';
import { Focusable } from './Focusable';
import { selectRelease } from '../hooks/selectRelease';
import { tvFocus } from '../hooks/tvFocus';
import { colour, font, radius, rem, type } from '../styles/theme';

/**
 * A text field typed into with the set's on-screen keyboard, which opens
 * when the field takes DOM focus. While the field is focused it owns the
 * D-pad, so focus navigation is suspended (`tvFocus.suspend()`); Return
 * closes it and Up or Down leave it (`useTvNavigation`).
 */
export function TvTextInput({
  label,
  value,
  onChangeText,
  onSubmit,
  placeholder,
  secure,
  defaultFocus,
  focusId,
  scope,
  autoCapitalize = 'none',
  boxStyle,
  boxFocusedStyle,
  inputStyle,
  fieldStyle,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  secure?: boolean;
  defaultFocus?: boolean;
  focusId?: string;
  scope?: string;
  autoCapitalize?: 'none' | 'sentences';
  /** Overrides the field's box, for a row of equal controls (Search's `.search-bar`). */
  boxStyle?: Style;
  boxFocusedStyle?: Style;
  inputStyle?: Style;
  /** The outer wrapper, e.g. `flex: 1` to take a row's remaining width. */
  fieldStyle?: Style;
}): React.JSX.Element {
  const input = useRef<HTMLInputElement | null>(null);
  // The live suspension. It must be released exactly once: a leak leaves the
  // client unnavigable, and a double release lifts someone else's.
  const resume = useRef<(() => void) | undefined>(undefined);

  const release = useCallback(() => {
    resume.current?.();
    resume.current = undefined;
  }, []);

  // Release on unmount: a screen can be replaced while the keyboard is up.
  useEffect(() => release, [release]);

  return (
    <View style={css(styles.field, fieldStyle)}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Focusable
        ring={false}
        focusId={focusId}
        scope={scope}
        defaultFocus={defaultFocus}
        // D-pad centre hands over to the keyboard once OK is up: see `selectRelease`.
        onSelect={() => selectRelease.hold(() => input.current?.focus())}
        style={css(styles.shell, boxStyle)}
        focusedStyle={css(styles.shellFocused, boxFocusedStyle)}
      >
        {() => (
          <input
            ref={input}
            value={value}
            onChange={(event) => onChangeText(event.target.value)}
            placeholder={placeholder}
            type={secure ? 'password' : 'text'}
            autoCapitalize={autoCapitalize}
            autoCorrect="off"
            spellCheck={false}
            style={css(styles.input, inputStyle)}
            // On `onFocus`, not the press handler: the platform can raise the
            // keyboard by itself.
            onFocus={() => {
              resume.current?.();
              resume.current = tvFocus.suspend();
            }}
            onBlur={release}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.keyCode !== 13) return;
              // Done: close the keyboard and hand the D-pad back.
              event.preventDefault();
              input.current?.blur();
              release();
              onSubmit?.();
            }}
          />
        )}
      </Focusable>
    </View>
  );
}

const styles = {
  field: {
    marginBottom: rem(0.9),
  },
  label: {
    color: colour.textDim,
    fontSize: type.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: rem(0.3),
  },
  shell: {
    borderRadius: radius.control,
    backgroundColor: colour.surface2,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  shellFocused: {
    borderColor: colour.accent,
  },
  input: {
    color: colour.text,
    fontSize: type.body,
    fontFamily: font.family,
    paddingLeft: rem(0.8),
    paddingRight: rem(0.8),
    paddingTop: rem(0.6),
    paddingBottom: rem(0.6),
    minWidth: rem(18),
  },
} satisfies Record<string, Style>;
