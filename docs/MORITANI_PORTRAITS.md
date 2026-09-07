# Moritani original ordinary leader portraits

Created 2026-09-06 using the built-in `image_gen` tool. The five ordinary Moritani leaders now have original local portraits, completing **60 of 60 ordinary leaders** across the base game and all three faction expansions. Separate special-disc artwork remains unfinished. This artwork checkpoint does not certify faction or expansion gameplay compliance.

## Identity and files

Exact names, IDs, and strengths were checked against `leaderLists.moritani` in `game/cards.ts` and the publisher rulebook page 3 component image rendered locally at `/tmp/dune-rules/ecaz-p3-audit.png`. The source is the [Ecaz and Moritani rulebook, page 3](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf#page=3); see `MORITANI_TERROR_RULES.md` for the source chain. The adjacent Viscount image is a faction portrait, not another ordinary valued disc. Duke Prad Vidal is a separate shared disc and is excluded. Faces, clothing, and age details are original artistic interpretations, not gameplay facts or claims of prescribed official likenesses. The published illustration was not supplied to the generator or traced.

| ID           | Name          | Strength | Asset                                  |
| ------------ | ------------- | -------- | -------------------------------------- |
| `moritani-0` | Lupino Ord    | 5        | `public/art/leaders/moritani-0-v1.png` |
| `moritani-1` | Grieu Kronos  | 4        | `public/art/leaders/moritani-1-v1.png` |
| `moritani-2` | Hiih Resser   | 4        | `public/art/leaders/moritani-2-v1.png` |
| `moritani-3` | Trin Kronos   | 2        | `public/art/leaders/moritani-3-v1.png` |
| `moritani-4` | Vando Terboli | 1        | `public/art/leaders/moritani-4-v1.png` |

Each asset is a 1254 × 1254 opaque RGB PNG with eight bits per channel, copied directly from the built-in generator output. No external raster editing or conversion was performed. The registry uses local paths and centered `50% 50%` positions. Its strict ID-and-name lookup and identity access rules remain unchanged.

## Prompt set and provenance

All five complete prompts, source output paths, canonical metadata, and style-reference roles are appended to `public/art/leaders/generation.json`. The existing Hasimir Fenring portrait was supplied solely for textured oil-painting treatment, warm upper-left light, readable cool shadows, textile detail, and head-and-shoulders framing. Moritani portraits use midnight-blue, muted cyan-teal, and charcoal fabrics against smoky blue-black backgrounds, with individual faces and silhouettes. This palette draws on the printed component's blue treatment; the application's rose faction accent remains unchanged. Lupino has tousled dark hair and a broad face, Grieu has long dark hair and a full beard, Hiih has short copper hair and freckles, Trin has a side fringe and small chin beard, and Vando has a round face and long blond-gray hair. Prompts exclude film actor likenesses, copied film costumes, traced published illustrations, text, borders, insignia, symbols, and embedded game values. No correction pass was needed.

All 55 earlier registered asset hashes and all 55 existing manifest entries were compared before and after the addition and are unchanged, as is existing manifest metadata.

## Verification

- Existing `node --import tsx --test tests/leader-art.test.ts`: **4 named tests passed**, 0 failures; log `/tmp/dune-mo-art-test.log`. These check canonical identity, exact lookup and hidden-name rejection, unique matching provenance, actual local file existence, exact PNG dimensions and RGB encoding, valid crop coordinates, and unique image hashes.
- Every actual saved full-resolution PNG was opened and visually inspected. The five faces are individually readable with coherent painting and palette, complete heads, visible eyes, and no unwanted text or graphic elements.
- **Actual 192px inspector and 80px circular browser review passed.** The coordinating agent inspected all five portraits in the browser and confirmed distinguishable faces, clear small-size silhouettes, a coherent deep-blue palette with restrained collar accents, and no letters or clipping at either size. This is an asset presentation check, not an end-to-end gameplay claim. The temporary contact-sheet server was stopped cleanly after review.

New asset SHA-256 hashes:

```text
moritani-0-v1.png 1e398a01401494fc24fb07d19325ef36ce195ceca4548440e49853506c0dddb1
moritani-1-v1.png f3182a397ce845b22da0dff9ea633b0c644659228d43c5df7e4fef1c7a42acbc
moritani-2-v1.png 60e3bd074fed973db8622f74e288b2cc91b6adea4be209a474945ade56032968
moritani-3-v1.png 2fe6971a80f8d529c216f6687954dc3e265fd35e6b3dfb75f51d6d988cddcbff
moritani-4-v1.png b8291381bb35518e433efba4b43e30bca3864c0ff30689b57cc19dd16da43172
```

No engine, UI behavior, AI, test, package, status, or component-inventory files were changed for this batch.
