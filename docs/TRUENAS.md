# Private TrueNAS container

The requested instance starts with **new games**, serving HTTP at
`http://192.168.2.251:33046` behind the existing NGINX HTTPS endpoint
`https://dune.procrastination.games`. Development games remain in their original
`.wrangler/state`; they are never copied into an image. This private local
runtime prototype does not change public release or rules-mode gates.

## Checkpoint images

Every push to `main` starts `.github/workflows/container.yml`. The Docker build
runs the production build using the lockfile. Types, lint and offline tests
remain part of source checkpoint verification rather than being repeated in
the container build.
Before publishing, CI creates an isolated container and volume, checks accepted
and rejected HTTP origins, verifies saved-seat restoration through restart and
container replacement, then runs the HTTP integration suite.

Only a passing image is pushed to `ghcr.io/quintine/dune:checkpoint`, alongside
`ghcr.io/quintine/dune:sha-<full-commit>`. GitHub Actions builds; TrueNAS pulls the
image. Failed checks leave the previous update tag untouched. This workflow
targets Linux AMD64, the architecture of ordinary x86 TrueNAS systems.

The user selected a **public image**, matching the existing public source
repository, so TrueNAS needs no registry login. GitHub initially creates packages
privately; after the first successful publication, set this package's visibility
to public in GitHub package settings. Images contain application code and assets,
never saved games or credentials. Publishing uses the workflow's built-in token.
A source push alone does not prove image publication; repository permissions or
package policy may prevent the workflow from publishing.

## Install

On a Docker-based TrueNAS release, use **Apps → Discover Apps → Install via YAML**
and paste [the Compose configuration](../deploy/truenas.compose.yaml), naming the
app `dune`. It maps host port **33046** to container port 3000. A persistent named
volume mounts at `/data`, starts empty and inherits writable ownership from the
image. The container runs as UID/GID 1000. If using a dedicated host dataset
instead, mount it at `/data` and give UID/GID 1000 write access before starting.

Startup applies pending additive migrations before serving. Both commands use
the same database ID and storage root. A failed migration stops startup without
deleting games. The inspector remains on container loopback and is not published.

The container serves the built Worker directly through pinned Miniflare/workerd,
with persisted D1-compatible SQLite. Wrangler only applies startup migrations.
The development proxy produced intermittent POST failures after rejected request
bodies; the direct listener avoids that proxy. This preserves the application without a database
rewrite. It does not supply managed D1 backups, replication, high availability
or durable unattended bot scheduling. Keep this prototype on a trusted LAN;
public hosting remains separately gated. HTTP does not encrypt cookies or seat
recovery kits. Browser operation IDs now use cryptographic `getRandomValues`,
which also works at LAN HTTP origins where `randomUUID` is unavailable.

## Production navigation

Use native anchors for app page links. The pinned Vinext/Vite production build
renames navigation exports while its Link runtime dynamically looks up their
original names, breaking clicks and prefetch despite successful HTTP responses.
Native navigation keeps query strings, rule anchors, browser history and saved
seat cookies. The Next.js lint preference for client-side Link is disabled for
this intentional choice. Verify page links in the production browser when
changing framework versions; development navigation alone does not cover it.

## Update and preserve games

### Existing NGINX HTTPS termination

Keep the NGINX upstream **HTTP**, `192.168.2.251:33046`. Set the app environment
variable `DUNE_PUBLIC_ORIGIN` to the exact external HTTPS origin (scheme and
hostname, optional port, no path). This keeps strict origin validation and marks
seat cookies Secure, even though the proxy-to-app connection is HTTP. Dune does
not blindly trust client-supplied forwarding headers. When configured, use the
HTTPS address to play; direct HTTP browser POSTs are intentionally rejected.
The supplied Compose file already sets `https://dune.procrastination.games`.

Keep NGINX's usual original Host and forwarded-protocol headers. Enable
WebSocket support in NGINX Proxy Manager, or forward Upgrade/Connection headers
with HTTP/1.1 in an existing NGINX location. Dune currently uses HTTP polling,
not game WebSockets; enabling proxy support does not change its transport.
See [NGINX WebSocket forwarding](https://nginx.org/en/docs/http/websocket.html).

### Applying an update

1. Wait for the checkpoint workflow to succeed. Check for image updates in
   TrueNAS and apply the update manually at a safe point between decisions.
2. Before updating, stop the app and back up or snapshot its persistent storage.
   Include the named volume in the Apps backup procedure; a dedicated host
   dataset provides a more explicit ZFS snapshot boundary.
3. Update while retaining the same app identity and `/data` volume. Never delete
   the volume, reinstall with empty storage or reset a database to resolve an
   error. Restart and confirm the saved seat restores.
4. Retain the prior immutable image tag. Rollback may require its matching storage
   snapshot if a subsequent migration is incompatible; switching the image alone
   is not a guaranteed database rollback.

No unattended updater is installed. The health probe checks HTTP availability;
the CI integration and saved-seat checks separately exercise persistence.

## Verification and installation boundary

On a machine with Docker:

```sh
docker build -t dune:verify .
node tools/verify-container.mjs dune:verify
```

The verifier only removes containers and volumes with names it randomly creates.
It never mounts development games or an existing TrueNAS volume.

Container execution and NAS installation require a successful CI run and an
authenticated TrueNAS session. Final acceptance includes create/join at the NAS
URL, saved-seat restoration, restart and update retaining storage. Source checks
alone do not certify these steps.

Sources: [TrueNAS custom apps](https://apps.truenas.com/managing-apps/installing-custom-apps/),
[GitHub container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry),
[Cloudflare local runtime](https://developers.cloudflare.com/workers/local-development/).
