#!/bin/sh
set -eu

# A failed migration must stop startup. Both commands use the same local D1 ID
# and storage root. Never reset or replace this directory during updates.
state_path=${DUNE_STATE_PATH:-/data}
# Validate before migration; this is an administrator setting, not a request header.
node --input-type=module -e '
  const value = process.env.DUNE_PUBLIC_ORIGIN;
  if (value) {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password ||
        u.search || u.hash || u.pathname !== "/") throw new Error("Invalid DUNE_PUBLIC_ORIGIN");
  }
'
node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB \
  --local --config tools/wrangler.local.json --persist-to "$state_path"
exec node deploy/serve.mjs
