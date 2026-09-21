/** The administrator configures the external origin; forwarded headers are untrusted. */
export function requestOrigin(request: Request, configured?: string): string {
  if (!configured) return new URL(request.url).origin;
  const url = new URL(configured);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/'
  ) throw new Error('DUNE_PUBLIC_ORIGIN must be an HTTP(S) origin without a path.');
  return url.origin;
}
