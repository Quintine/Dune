# Tleilaxu original leader portraits

Created 2026-09-06 with the built-in `image_gen` tool. All five ordinary Tleilaxu leaders now have original project-local portraits. The registry covers **40 of 60 ordinary leaders**, completing the six base factions plus Ixians and Tleilaxu. CHOAM, Richese, Ecaz, and Moritani ordinary portraits remain unfinished.

## Identity and files

Exact names, IDs, and strengths were verified against `leaderLists.tleilaxu` in `game/cards.ts`. The facial details and clothing are original artistic interpretations, not new gameplay facts or assertions of prescribed official likenesses.

| ID           | Name              | Strength | Asset                                  |
| ------------ | ----------------- | -------- | -------------------------------------- |
| `tleilaxu-0` | Zoal              | 3        | `public/art/leaders/tleilaxu-0-v1.png` |
| `tleilaxu-1` | Hidar Fen Ajidica | 4        | `public/art/leaders/tleilaxu-1-v1.png` |
| `tleilaxu-2` | Master Zaaf       | 3        | `public/art/leaders/tleilaxu-2-v1.png` |
| `tleilaxu-3` | Wykk              | 2        | `public/art/leaders/tleilaxu-3-v1.png` |
| `tleilaxu-4` | Blin              | 1        | `public/art/leaders/tleilaxu-4-v1.png` |

Each final asset is a 1254 × 1254 opaque RGB PNG, eight bits per channel, copied directly from its built-in generator output. No external raster editing or format conversion was used. The registry keeps centered `50% 50%` positions and the existing exact ID-and-name visibility checks.

## Prompt set and provenance

Complete prompts, source output paths, canonical metadata, and style-reference roles are stored in `public/art/leaders/generation.json`. The existing Thufir Hawat image supplied only the textured oil-painting treatment, warm upper-left lighting, visible shadow detail, and head-and-shoulders composition. The new set uses muted umber, ash-gray, and dusty mauve textiles with distinct faces and silhouettes. Prompts explicitly exclude film actor likenesses, copied movie costumes, text, frames, insignia, game values, machinery covering the face, and unwanted graphic elements. All five first outputs passed full-resolution inspection; no correction pass was needed.

All 35 existing manifest entries and all 35 existing asset SHA-256 hashes were compared before and after this addition and remain unchanged.

## Verification

- Existing `node --import tsx --test tests/leader-art.test.ts`: **4 named tests passed**, 0 failures; output `/tmp/dune-tl-art-test.log`. These verify canonical identities, strict lookup and hidden-name rejection, unique matching provenance, actual local file existence, exact PNG dimensions and RGB encoding, valid crop positions, and unique image content.
- Every final full-resolution portrait was visually inspected for distinct facial identity, visible eyes, coherent palette and painted texture, complete heads, and absence of unwanted text or elements.
- **Actual 192px inspector and 80px circular browser review passed.** The coordinating agent inspected all five fully loaded portraits in the temporary local contact sheet, confirming individually distinct and readable faces, no clipping, and a coherent palette at both sizes. This is an asset presentation check, not an end-to-end gameplay claim. The temporary contact-sheet server was stopped cleanly after review.

New asset SHA-256 hashes:

```text
tleilaxu-0-v1.png b97e80e04a3ac3aa4f48e03447c94fe5b5b9497dcf91f6f0a6a21c3e6d3d3aa9
tleilaxu-1-v1.png 821f270fae5e117f65079ead12955be7d8d9cc39e8f204289665edcaa69f1237
tleilaxu-2-v1.png de117ae29b1808a6d569346bf8bd1238565b177626b24661f0021f883a4f6d4e
tleilaxu-3-v1.png 77aee9053c8a60b12d396eeabb67e675c47cd5aa65f4020a46f6b68d49393684
tleilaxu-4-v1.png 1fb93d26a49ba5f9d71f375df28169e769e4fc94668a5478a8c05e33f4c5d672
```

No engine, UI behavior, AI, package, or test files were changed for this portrait batch.
