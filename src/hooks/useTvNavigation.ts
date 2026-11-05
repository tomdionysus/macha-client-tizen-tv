import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { tvFocus, type FocusRect, type TvDirection } from './tvFocus';
import { SamsungDpadInput, samsungDpadCommand } from '../platform/SamsungDpadInput';
import { samsungMediaCommand } from '../platform/SamsungMediaKeys';
import { selectRelease } from './selectRelease';
import { backHandler } from './backHandler';

/**
 * The Samsung remote in the Android TV client's command vocabulary. The
 * D-pad and Return arrive as key events (`SamsungDpadInput`); the transport
 * keys as the media key names and codes Tizen uses (`SamsungMediaKeys`),
 * registered with the set at start.
 */
export interface TvNavigationOptions {
  /** Return true when Back was consumed; false lets the press go unanswered. */
  onBack?: () => boolean;
  /** `play` and `pause` are the remote's own keys; without an intent the key toggles. */
  onPlayPause?: (intent?: 'play' | 'pause') => void;
  onRewind?: () => void;
  onFastForward?: () => void;
  onStop?: () => void;
  /** The remote's own next / previous keys. */
  onNext?: () => void;
  onPrevious?: () => void;
}

/** A text field has the caret keys and OK while it is focused; see `TvTextInput`. */
export function isTextEditingElement(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const element = value as { tagName?: unknown };
  const tagName = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : '';
  return tagName === 'INPUT' || tagName === 'TEXTAREA';
}

/** Attach the remote to the focus registry. Mount once, at the app root. */
export function useTvNavigation(options: TvNavigationOptions = {}): void {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const input = new SamsungDpadInput((command) => {
      selectRelease.pressed();
      const editor = document.activeElement;

      if (isTextEditingElement(editor)) {
        // The field keeps the caret keys and OK. Back closes it, and Up or
        // Down leave it for the D-pad: on a remote those are the only way
        // between controls, and a field that kept them could only be left
        // with Back. Blurring releases the field's suspension (`TvTextInput`).
        if (command === 'left' || command === 'right' || command === 'activate') return false;
        (editor as HTMLElement).blur();
        if (command === 'back') return true;
      } else if (tvFocus.suspended) {
        // A suspension whose field has gone would disable the remote for
        // good; with no field focused it is stale and is dropped.
        tvFocus.resumeAll();
      }

      if (command === 'back') return backHandler.handle();
      return tvFocus.handle(command);
    });
    input.attach(document);

    // D-pad centre hands over to a text field on key-up: see `selectRelease`.
    const onKeyUp = (event: KeyboardEvent) => {
      if (samsungDpadCommand(event.key, event.keyCode) === 'activate') selectRelease.released();
    };

    const onMediaKey = (event: KeyboardEvent) => {
      const command = samsungMediaCommand(event.key, event.keyCode);
      if (!command) return;
      if (isTextEditingElement(document.activeElement)) return;
      const handlers = latest.current;
      switch (command) {
        case 'play':
          handlers.onPlayPause?.('play');
          break;
        case 'pause':
          handlers.onPlayPause?.('pause');
          break;
        case 'toggle':
          handlers.onPlayPause?.();
          break;
        case 'rewind':
          handlers.onRewind?.();
          break;
        case 'fast-forward':
          handlers.onFastForward?.();
          break;
        case 'stop':
          handlers.onStop?.();
          break;
        case 'next':
          handlers.onNext?.();
          break;
        case 'previous':
          handlers.onPrevious?.();
          break;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('keydown', onMediaKey, true);
    return () => {
      input.detach();
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('keydown', onMediaKey, true);
    };
  }, []);

  // The root's Back listener, registered first so every screen's answers before it.
  useEffect(() => {
    const subscription = backHandler.addListener(() => latest.current.onBack?.() ?? false);
    return () => subscription.remove();
  }, []);
}

export interface UseFocusableOptions {
  /**
   * A stable id, for moving focus here by name (the alphabet strip's jump).
   * Defaults to React's generated id.
   */
  id?: string;
  /** Called on D-pad centre. */
  onSelect?: () => void;
  disabled?: boolean;
  /** Receives focus when its scope becomes active. */
  defaultFocus?: boolean;
  scope?: string;
  /** Keep these directions instead of moving focus. See `Focusable.ownsDirection`. */
  ownsDirection?: (direction: TvDirection) => boolean;
  onDirection?: (direction: TvDirection) => void;
  /** A side rail, reachable sideways from any row. See `Focusable.rail` in `tvFocus.ts`. */
  rail?: boolean;
}

export interface UseFocusableResult {
  focused: boolean;
  ref: React.RefObject<HTMLDivElement | null>;
}

/**
 * Register one focusable. Its rectangle is read from the DOM at each press
 * (`Focusable.measure`), so there is nothing to measure ahead and nothing to
 * correct for scrolling: every element is compared where it is drawn now.
 */
export function useFocusable(options: UseFocusableOptions = {}): UseFocusableResult {
  const generated = useId();
  const id = options.id ?? generated;
  const ref = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const latest = useRef(options);
  latest.current = options;

  useLayoutEffect(() => {
    return tvFocus.register({
      id,
      disabled: latest.current.disabled,
      defaultFocus: options.defaultFocus,
      scope: options.scope,
      activate: () => latest.current.onSelect?.(),
      onFocusChange: setFocused,
      ownsDirection: (direction) => latest.current.ownsDirection?.(direction) ?? false,
      onDirection: (direction) => latest.current.onDirection?.(direction),
      rail: options.rail,
      measure: (): FocusRect | undefined => {
        const element = ref.current;
        if (!element) return undefined;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      },
    });
  }, [id, options.defaultFocus, options.scope, options.rail]);

  // `disabled` is patched in place rather than re-registered, which would
  // reorder the sequential fallback. A selected element that becomes disabled
  // yields to the default.
  const firstDisabled = useRef(true);
  useLayoutEffect(() => {
    if (firstDisabled.current) {
      firstDisabled.current = false;
      return;
    }
    tvFocus.update(id, { disabled: options.disabled });
    if (options.disabled && tvFocus.selected() === id) {
      tvFocus.select(undefined);
      tvFocus.focusDefault();
    }
  }, [id, options.disabled]);

  return { focused, ref };
}
