# CHOAM original ordinary leader portraits

Created 2026-09-06 with the built-in `image_gen` tool. All five ordinary CHOAM leaders now have original local portraits, bringing registry coverage to **45 of 60 ordinary leaders**. Richese, Ecaz, and Moritani ordinary portraits remain unfinished. The separate advanced Auditor disc was not added in this batch.

## Identity and files

Exact names, stable IDs, and strengths were checked against `leaderLists.choam` in `game/cards.ts`. Facial features, clothing, and ages are original artistic interpretations, not new rules or claims of prescribed official likenesses.

| ID        | Name          | Strength | Asset                               |
| --------- | ------------- | -------- | ----------------------------------- |
| `choam-0` | Frankos Aru   | 4        | `public/art/leaders/choam-0-v1.png` |
| `choam-1` | Lady Jalma    | 4        | `public/art/leaders/choam-1-v1.png` |
| `choam-2` | Rajiv Londine | 3        | `public/art/leaders/choam-2-v1.png` |
| `choam-3` | Duke Verdun   | 3        | `public/art/leaders/choam-3-v1.png` |
| `choam-4` | Viscount Tull | 2        | `public/art/leaders/choam-4-v1.png` |

All five files are 1254 × 1254 opaque RGB PNGs with eight bits per channel, copied directly from built-in generator outputs. No raster editing or format conversion was used. `game/leader-art.ts` uses project-local paths and centered `50% 50%` crop positions. Exact ID-and-name lookup and hidden-identity boundaries are unchanged.

## Prompts and provenance

The complete five-prompt set, original output paths, style-reference roles, and canonical metadata are preserved in `public/art/leaders/generation.json`. Hasimir Fenring's existing portrait was supplied only for textured oil-painting treatment, lighting, textile detail, and head-and-shoulders framing. The CHOAM portraits use restrained bronze, muted gold, and charcoal clothing with distinct faces, hair, and expressions. Prompts explicitly exclude film actor likenesses, copied movie costumes, printed artwork tracing, text, borders, insignia, symbols, and embedded game values. All five original outputs passed full-resolution inspection without a correction pass.

All forty previously registered assets retain their exact SHA-256 hashes. Their forty existing manifest entries are unchanged; five new entries were appended.

## Verification

- Existing `node --import tsx --test tests/leader-art.test.ts`: **4 named tests passed**, 0 failures, in `/tmp/dune-ch-art-test.log`. Coverage includes canonical names and IDs, exact identity lookup and hidden-name rejection, unique matching provenance entries, physical local files, exact PNG dimensions and RGB encoding, crop coordinates, and distinct image content.
- All five final full-resolution images were visually inspected for distinct faces, readable eyes, coherent palette and brushwork, complete heads, and absence of unwanted text or graphic elements.
- **Actual 192px inspector and 80px circular browser review passed.** The coordinating agent inspected all five fully loaded portraits and confirmed distinct readable faces, complete clean crops, and coherent presentation at both sizes. This is an asset presentation check, not an end-to-end gameplay claim. The temporary contact-sheet server was stopped cleanly after review.

New asset SHA-256 hashes:

```text
choam-0-v1.png 65a9a98bf7d6f163f5b66815ef2a542185bbfd4e65f8860de90b978780501f0a
choam-1-v1.png 0908b9b5d1cdbc75c582ac2263c9f3baccab5ddd1e936fc126f5dd4dcc3e9351
choam-2-v1.png 19b685622b91b168859db2d4f0c4ebe0e167d4f95b069f0e9216edbb554dc30d
choam-3-v1.png 09286f1adc9b7bb468a215ffa5346ccbf641a3d14dbc56c93d3780d05c4b0e9c
choam-4-v1.png ba209667ef843069e275b36446d61cf16326cb1f2690af091d447a0c89a1d544
```

No engine, UI behavior, AI, test, package, status, or component-inventory files were changed for this batch.
