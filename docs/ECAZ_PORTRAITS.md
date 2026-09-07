# Ecaz original ordinary leader portraits

Created 2026-09-06 using the built-in `image_gen` tool. The five ordinary Ecaz leaders now have original local portraits, bringing the registry to **55 of 60 ordinary leaders**. Moritani ordinary portraits and separate special-disc artwork remain unfinished. Duke Prad Vidal is a separate disc and was excluded from this batch. This artwork checkpoint does not certify faction or expansion gameplay compliance.

## Identity and files

Exact names, IDs, and strengths were checked against `leaderLists.ecaz` in `game/cards.ts` and the publisher rulebook page 3 component image rendered locally at `/tmp/dune-rules/ecaz-p3-audit.png`. The source is the [Ecaz and Moritani rulebook, page 3](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=3); see `MORITANI_TERROR_RULES.md` for the source chain. Faces, clothing, and age details are original artistic interpretations, not gameplay facts or claims of prescribed official likenesses. The published illustration was not supplied to the generator or traced.

| ID       | Name           | Strength | Asset                              |
| -------- | -------------- | -------- | ---------------------------------- |
| `ecaz-0` | Sanya Ecaz     | 4        | `public/art/leaders/ecaz-0-v1.png` |
| `ecaz-1` | Whitmore Bludd | 4        | `public/art/leaders/ecaz-1-v1.png` |
| `ecaz-2` | Ilesa Ecaz     | 3        | `public/art/leaders/ecaz-2-v1.png` |
| `ecaz-3` | Rivvy Dinari   | 3        | `public/art/leaders/ecaz-3-v1.png` |
| `ecaz-4` | Bindikk Narvi  | 2        | `public/art/leaders/ecaz-4-v1.png` |

Each asset is a 1254 × 1254 opaque RGB PNG with eight bits per channel, copied directly from the built-in generator output. No external raster editing or conversion was performed. The registry uses local paths and centered `50% 50%` positions. Its strict ID-and-name lookup and identity access rules remain unchanged.

## Prompt set and provenance

All five complete prompts, source output paths, canonical metadata, and style-reference roles are appended to `public/art/leaders/generation.json`. The existing Lady Jessica portrait was supplied solely for textured oil-painting treatment, warm upper-left light, readable cool shadows, textile detail, and head-and-shoulders framing. Ecaz portraits use moss-green, muted plum, and charcoal fabrics against smoky olive backgrounds, with individual faces and silhouettes. Sanya and Ilesa have distinct face shapes and hairstyles; Whitmore has silver hair and a white goatee, Rivvy has short reddish hair and a cloth headband, and Bindikk has a dark beard and green hood. Prompts exclude film actor likenesses, copied film costumes, traced published illustrations, text, borders, insignia, symbols, and embedded game values. No correction pass was needed.

All 50 earlier registered asset hashes and all 50 existing manifest entries were compared before and after the addition and are unchanged.

## Verification

- Existing `node --import tsx --test tests/leader-art.test.ts`: **4 named tests passed**, 0 failures; log `/tmp/dune-ec-art-test.log`. These check canonical identity, exact lookup and hidden-name rejection, unique matching provenance, actual local file existence, exact PNG dimensions and RGB encoding, valid crop coordinates, and unique image hashes.
- Every actual saved full-resolution PNG was opened and visually inspected. The five faces are individually readable with coherent painting and palette, complete heads, visible eyes, and no unwanted text or graphic elements.
- **Actual 192px inspector and 80px circular browser review passed.** The coordinating agent inspected all five portraits in the browser and confirmed distinguishable faces, complete clean crops without letters or clipping, and a coherent green-gold faction palette at both sizes. This is an asset presentation check, not an end-to-end gameplay claim. The temporary contact-sheet server was stopped cleanly after review.

New asset SHA-256 hashes:

```text
ecaz-0-v1.png 8423a0520815c6d750a798b0efcc29dbb14261958fa88e3225e44d71b13905be
ecaz-1-v1.png edd4a0451011483c09cf1361d78e67fb55e64170d705c2e5d1587d1906eca78f
ecaz-2-v1.png 34c23c0dc2f0dda12f951cc2164573f9e310d429752d6da635e16c211dabe179
ecaz-3-v1.png 412aa6fe62beaf5606a0709595e848f7fa97c63e5b0b1faec51b56bec4de0c86
ecaz-4-v1.png 2482085fc1b0cd98ed14c4983ba0c15b34e11480896d6fffa6c604b228f18036
```

No engine, UI behavior, AI, test, package, status, or component-inventory files were changed for this batch.
