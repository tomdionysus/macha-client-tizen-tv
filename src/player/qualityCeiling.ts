import { qualityCeiling, type QualityCeiling } from '@machafoundation/core';
import { tizenPlatform } from '../platform/TizenPlatform';
import { qualityPreferenceStore } from '../state/qualityPreference';

/**
 * The cap on automatic quality: core's `qualityCeiling` from the panel's mode
 * and the viewer's setting. No connection is passed, which core counts as
 * Wi-Fi. Called at each start, so a changed setting applies to the next play.
 */
export function deviceQualityCeiling(): QualityCeiling | undefined {
  const display = tizenPlatform.display();
  const preference = qualityPreferenceStore().get();
  return qualityCeiling({
    ...(display ? { display } : {}),
    preference,
  });
}
