# Richese original ordinary leader portraits

Created 2026-09-06 using the built-in `image_gen` tool. The five ordinary Richese leaders now have original local portraits, bringing the registry to **50 of 60 ordinary leaders**. Ecaz and Moritani ordinary portraits and separate special-disc artwork remain unfinished. This artwork checkpoint does not certify faction or expansion gameplay compliance.

## Identity and files

Exact names, IDs, and strengths were checked against `leaderLists.richese` in `game/cards.ts`; the existing local publisher-rulebook page 3 rendering was also inspected. See `CHOAM_RICHESE_LEADERS.md` for the source chain. Faces, clothing, and age details are original artistic interpretations, not gameplay facts or claims of prescribed official likenesses. The published illustration was not supplied to the generator or traced.

| ID          | Name          | Strength | Asset                                 |
| ----------- | ------------- | -------- | ------------------------------------- |
| `richese-0` | Ein Calimar   | 5        | `public/art/leaders/richese-0-v1.png` |
| `richese-1` | Lady Helena   | 4        | `public/art/leaders/richese-1-v1.png` |
| `richese-2` | Flinto Kinnis | 3        | `public/art/leaders/richese-2-v1.png` |
| `richese-3` | Haloa Rund    | 2        | `public/art/leaders/richese-3-v1.png` |
| `richese-4` | Talis Balt    | 2        | `public/art/leaders/richese-4-v1.png` |

Each asset is a 1254 × 1254 opaque RGB PNG with eight bits per channel, copied directly from the built-in generator output. No external raster editing or conversion was performed. The registry uses local paths and centered `50% 50%` positions. Its strict ID-and-name lookup and identity access rules remain unchanged.

## Prompt set and provenance

All five complete prompts, source output paths, canonical metadata, and style-reference roles are appended to `public/art/leaders/generation.json`. The existing Hasimir Fenring portrait was supplied solely for textured oil-painting treatment, warm upper-left light, readable cool shadows, textile detail, and head-and-shoulders framing. Richese portraits use silver-gray, muted steel-blue, and charcoal fabrics with individual faces and silhouettes. Flinto Kinnis has transparent-lens spectacles that preserve eye visibility. Prompts exclude film actor likenesses, copied film costumes, traced published illustrations, text, borders, insignia, symbols, and embedded game values. No correction pass was needed.

All 45 earlier registered asset hashes and all 45 existing manifest entries were compared before and after the addition and are unchanged.

## Verification

- Existing `node --import tsx --test tests/leader-art.test.ts`: **4 named tests passed**, 0 failures; log `/tmp/dune-ri-art-test.log`. These check canonical identity, exact lookup and hidden-name rejection, unique matching provenance, actual local file existence, exact PNG dimensions and RGB encoding, valid crop coordinates, and unique image hashes.
- Every actual saved full-resolution PNG was opened and visually inspected. The five faces are individually readable with coherent painting and palette, complete heads, visible eyes, and no unwanted text or graphic elements.
- **Actual 192px inspector and 80px circular browser review passed.** The coordinating agent inspected all five portraits in the browser and confirmed distinct readable faces and complete clean crops at both sizes. This is an asset presentation check, not an end-to-end gameplay claim. The temporary contact-sheet server was stopped cleanly after review.

New asset SHA-256 hashes:

```text
richese-0-v1.png efd80c882963112daac190cf902cf84b65be5adebbe7692779595cbc7d4f8411
richese-1-v1.png 4a1fa9306d0778a28a8fc79f6ec364f4a308df04198650bcd53a521aaea0f488
richese-2-v1.png 8567333c8661f38ac57c39c53d0c52aaee4a4815c289d213b6c8a5f2d61de32d
richese-3-v1.png adbf7d6c79a901f489f1d9eb022095d2a5d11595a442286f5db7aa9193b2e610
richese-4-v1.png 6baf1cd0587819b3c49d51c1cd15b9ef9fe51decb01a420ae43c4785740ebeef
```

No engine, UI behavior, AI, test, package, status, or component-inventory files were changed for this batch.
