# Ixian original leader portraits

Created 2026-09-06 using the built-in `image_gen` tool. All five ordinary Ixian leaders now have original local portrait assets. The registry covers **35 of 60 ordinary leaders**: all six base factions and Ixians. Other expansion portraits remain unfinished.

## Identity and assets

Names, exact Unicode spelling, IDs, and strengths were checked against `leaderLists.ixians` in `game/cards.ts`. Facial features and clothing are original artistic interpretations, not additional gameplay data or claims of officially prescribed likenesses.

| ID         | Canonical name  | Strength | Asset                                |
| ---------- | --------------- | -------- | ------------------------------------ |
| `ixians-0` | Dominic Vernius | 4        | `public/art/leaders/ixians-0-v1.png` |
| `ixians-1` | C’tair Pilru    | 5        | `public/art/leaders/ixians-1-v1.png` |
| `ixians-2` | Tessia Vernius  | 5        | `public/art/leaders/ixians-2-v1.png` |
| `ixians-3` | Kailea Vernius  | 2        | `public/art/leaders/ixians-3-v1.png` |
| `ixians-4` | Cammar Pilru    | 1        | `public/art/leaders/ixians-4-v1.png` |

Each file is a 1254 × 1254 PNG with eight bits per channel and opaque RGB encoding. Files were copied directly from built-in generator outputs without external raster editing or format conversion. `game/leader-art.ts` uses local asset paths and centered `50% 50%` crop positions. Its exact ID-and-name visibility lookup is unchanged.

## Prompt set and provenance

All five complete prompts and source output paths are preserved in `public/art/leaders/generation.json`. The existing Thufir Hawat portrait was supplied solely for paint treatment, lighting, and centered head-and-shoulders framing. Prompts specify distinct original faces, dark teal/slate/charcoal Ixian textiles, atmospheric teal-gray backdrops, no film actor likeness, no copied film costume, and no text, frames, insignia, strength values, or UI embedded in the image. All five outputs were accepted after full-resolution visual inspection; no correction pass was needed.

The 30 previous manifest entries and all 30 previously registered image hashes were compared before and after integration and remain unchanged.

## Verification

- Existing `node --import tsx --test tests/leader-art.test.ts`: **4 named tests passed**, 0 failures. Coverage includes canonical names and IDs, strict identity lookup, hidden-name rejection, unique matching provenance entries, physical local asset existence, exact PNG dimensions and encoding, valid crop positions, and unique image hashes. Test output: `/tmp/dune-ix-art-test.log`.
- Full-resolution visual inspection passed for all five portraits: recognizable individual faces, coherent painted style and lighting, legible eyes, complete heads, and no unwanted text or graphic elements.
- **Actual 192px inspector and 80px circular browser review passed.** The coordinating agent inspected the temporary contact sheet at `localhost:3011` and confirmed five distinct readable faces at both sizes, with no clipping or unwanted elements. This is an asset presentation check, not an end-to-end gameplay claim. The temporary contact-sheet server was then stopped cleanly.

New asset SHA-256 hashes:

```text
ixians-0-v1.png dcd2e57c4357dbd5cab2ae19b3fa19e85f096550693bd4c195c4fb36a0eb58d1
ixians-1-v1.png d367a9d61daea8db15fde6da75b8049bc9489c0216ae01f3142cde6257698273
ixians-2-v1.png 9e9f05d8d4095eab4720339168cdc4fb1d95e0af450ffd67f8b1eec1acc704a7
ixians-3-v1.png df809afd35dea59325aac4f3c4947c7d8bc6093e8de433d3472c98f285ca49a4
ixians-4-v1.png 0e091a426b3ea963552ea95932c4eb2b72816e596279e5b3039f495ae9cdf418
```

No engine, UI behavior, AI policy, package scripts, tests, or other faction assets were changed in this assignment.
