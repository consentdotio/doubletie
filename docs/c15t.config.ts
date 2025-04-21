// c15t Client Configuration
import type { ConsentManagerOptions } from '@c15t/react';

export const c15tConfig = {
  // Using hosted c15t (consent.io) or self-hosted instance
  mode: 'c15t',
  backendURL: 'https://consent-io-europe-doubletie.c15t.dev/',
  
} satisfies ConsentManagerOptions;

// Use in your app layout:
// <ConsentManagerProvider options={c15tConfig}>
//   {children}
//   <CookieBanner />
//   <ConsentManagerDialog />
// </ConsentManagerProvider>
