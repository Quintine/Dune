# Duke Prad Vidal original special-disc portrait

Created 2026-09-06 with the built-in `image_gen` tool. Duke Prad Vidal now has one original portrait used by his existing shared-disc component and inspector. This is separate from the completed sixty ordinary leader portraits and does not add a native leader or Traitor Card. Auditor and Kwisatz Haderach artwork remain outside this batch. Artwork and component checks do not certify full faction gameplay compliance.

## Canonical identity and files

`game/duke-vidal.ts` supplies stable identity `duke-vidal`, exact name **Duke Prad Vidal**, strength **6**, and native faction Ecaz. The existing public projection remains the sole source of current custody and death state. The [publisher-authored Ecaz and Moritani rulebook, printed page 3](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=3) verifies the separate valued disc and absence of a traitor; its local rendered component image `/tmp/dune-rules/ecaz-p3-audit.png` was inspected. See `MORITANI_TERROR_RULES.md` for the source chain. The published illustration was not supplied to the generator or traced.

- Selected image: `public/art/leaders/duke-vidal-v1.png`.
- Separate exact-ID-and-name registry: `game/special-leader-art.ts`.
- Separate prompt and output provenance: `public/art/leaders/special-generation.json`.
- Consumer: `components/duke-vidal.tsx`.
- Focused tests: `tests/special-leader-art.test.ts`.

The selected image is a 1254 × 1254 opaque RGB PNG, eight bits per channel, copied directly from the built-in tool output. No raster editing or conversion was performed. It is an original artistic interpretation with a lean olive face, dark swept-back hair, plum and charcoal woven court clothes, a muted green inner collar, and warm light. Physical appearance details are artistic choices, not asserted rules or prescribed official likenesses.

## Generation provenance

The complete prompt is retained in `special-generation.json`, along with canonical metadata and the source file:

`/home/quintine/.codex/generated_images/01a07621-d3f9-74d1-bc38-4b9a6dd1f742/exec-26d0c280-b336-450c-9cfd-e16a9d22274a.png`.

The existing Sanya Ecaz portrait, `ecaz-0-v1.png`, was provided only for paint treatment, lighting and framing. Its identity and garment design were explicitly excluded. The prompt excludes film actor likenesses, copied movie costumes, published-art tracing, letters, numbers, symbols, weapons, frames, insignia and other people. No correction pass was required.

SHA-256: `85295e61ddb11a2b7f86374d26daeeab3a2b61ecc4b8836b39ea36afb8fbaed5`.

## Component behavior

The 80px shared-disc presentation and 192px inspector resolve the portrait only from the exact ID and name already supplied by the public Duke projection. Missing or mismatched identities use the existing geometric SVG medallion, as does an image loading error. The portrait is decorative with an empty alternative string because adjacent HTML continues to supply the name, strength 6, current custody and No Traitor Card text. The existing dialog, control labels and read-only semantics remain unchanged; inspection never selects a leader or changes custody. The limitation note was audited against the runtime acquisition branch: Moritani acquisition, one battle of use, death and unused end-turn release are implemented; Ecaz Ambassador acquisition and loans, revival, and exceptional captured/ghola custody remain unfinished.

No ordinary art registry, ordinary generation manifest or ordinary asset was changed. Byte comparisons confirmed that all 60 earlier PNGs, `game/leader-art.ts`, and `public/art/leaders/generation.json` remain exactly unchanged.

## Verification

- Saved full-resolution PNG opened and visually inspected: complete head and shoulders, legible eyes, coherent painted style, no lettering or unwanted graphics.
- `node --import tsx --test tests/special-leader-art.test.ts tests/leader-art.test.ts`: **8 named tests passed**, including 4 new special-art cases and 4 ordinary regressions; log `/tmp/dune-duke-art-test.log`. Tests cover canonical identity, ordinary/special separation, missing/mismatched/inherited identity rejection, provenance consistency, PNG shape/encoding and uniqueness against all 60 ordinary images.
- Full `tsc --noEmit --incremental false`: passed; log `/tmp/dune-duke-art-type.log`.
- Scoped `oxlint` for the component, registry and new tests: passed.
- **Actual browser review passed.** The coordinating agent verified the portrait at 80px and 192px, set-aside/controlled/dead custody labels, the actual inspector, invalid-identity SVG fallback, and a fresh real HTTP 404 fallback in both the 80px disc and 192px inspector with readable strength 6. The initial same-document failure fixture retained an already decoded image and was not accepted as failure evidence; after a fresh document request, the raw contact-sheet images visibly failed while both actual component instances rendered the SVG fallback. The missing-ID guard is covered by the focused lookup tests; no separate missing-ID browser claim is made. The loopback-only temporary Vite harness mounted byte-identical copies of the actual component and required UI/rules/registry files, using the real installed Next Image shim with optimization disabled solely for this server. No live room or gameplay actions were involved. This verifies component presentation and interaction, not multiplayer custody transitions or production image optimization. The exact temporary server was stopped cleanly after review.

Only the listed image, special manifest, special registry, Duke component, new test and this document belong to this change. No engine, game-table, shared card/reveal, package, root status or component inventory files were edited.
