/**
 * Fallback provider for platforms with no health store (web, and anything the
 * platform-specific files below do not cover).
 *
 * Metro resolves `provider.ios.ts` and `provider.android.ts` ahead of this file
 * on those platforms.
 */

import { unsupportedProvider, type StepsProvider } from '@/health/types';

export const stepsProvider: StepsProvider = unsupportedProvider;
