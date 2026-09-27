declare const __BUILD_REVISION__: string;

/** The Git commit baked into this build, or 'unavailable' without a checkout/SHA. */
export const buildRevision = typeof __BUILD_REVISION__ === 'string'
  ? __BUILD_REVISION__
  : 'unavailable';
export const buildRevisionLabel = buildRevision === 'unavailable'
  ? 'unavailable'
  : buildRevision.slice(0, 7);
