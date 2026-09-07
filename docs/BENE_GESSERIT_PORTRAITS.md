# Bene Gesserit original leader portraits

Completed 2026-09-06 using the built-in `image_gen` tool. The five ordinary Bene Gesserit leaders now have original local portraits; this adds four portraits and preserves the existing Princess Irulan image. The ordinary portrait registry now covers 30 of 60 leaders, completing all six base-faction rosters. Expansion leader portraits remain unfinished.

## Identity and assets

Names, IDs, and strengths were checked against `leaderLists.beneGesserit` in `game/cards.ts`. All five leaders have strength 5. Painted age, costume, and facial features are original artistic interpretations, not new gameplay data or claims of an officially prescribed likeness.

| ID               | Canonical name          | Asset                                                  |
| ---------------- | ----------------------- | ------------------------------------------------------ |
| `beneGesserit-0` | Alia                    | `public/art/leaders/beneGesserit-0-v1.png`             |
| `beneGesserit-1` | Wanna Marcus            | `public/art/leaders/beneGesserit-1-v1.png`             |
| `beneGesserit-2` | Princess Irulan         | `public/art/leaders/beneGesserit-2-v1.png` (unchanged) |
| `beneGesserit-3` | Reverend Mother Ramallo | `public/art/leaders/beneGesserit-3-v1.png`             |
| `beneGesserit-4` | Margot Lady Fenring     | `public/art/leaders/beneGesserit-4-v1.png`             |

All four new files are 1254 × 1254 PNGs, eight bits per channel, opaque RGB. They are directly copied from built-in generator outputs; no external raster editing or format conversion was used. `game/leader-art.ts` references the project-local assets at centered `50% 50%` positions. Its exact ID-and-name identity check is unchanged.

## Prompt set and provenance

The complete original prompt for each portrait, source output path, style reference, and any correction prompt are recorded in `public/art/leaders/generation.json`. All 26 existing manifest entries were preserved exactly as data; four new entries were appended.

Princess Irulan's existing portrait was supplied as a style reference for textured realistic oil painting, warm upper-left light, cool visible shadows, restrained blue-gray textiles, and centered head-and-shoulders framing. Each prompt explicitly requests an original individual face, no film actor likeness, no copied movie costume, no text, no frame, and no symbols or game values embedded in the bitmap. Alia is depicted as a fully clothed child. Alia and Ramallo received a second built-in image edit limited to the eyes, replacing pale sclera with blue-within-blue spice eyes while preserving their portrait identities and composition.

## Verification

- Existing `node --import tsx --test tests/leader-art.test.ts`: **4 named tests passed**, 0 failed. This checks every registered portrait's canonical identity, strict identity lookup and hidden-name rejection, matching unique manifest record, local file existence, exact PNG dimensions and RGB encoding, valid crop coordinates, and distinct SHA-256 content.
- Original Princess Irulan file hash and all existing manifest records were compared before and after integration and remain unchanged.
- Each final full-resolution image was visually inspected. Faces, eyes, clothing, framing, and painterly treatment are coherent; no names, rules, insignia, or unwanted text appear in the bitmaps.
- A temporary local browser contact sheet displayed all five portraits at actual **192px square inspector** and **80px circular token** sizes. All faces remain legible within the circular crop, with distinct identities and no clipped head or facial feature. This was an asset presentation check, not an end-to-end gameplay claim. The temporary review tab and server were closed afterward.

New asset SHA-256 hashes:

```text
beneGesserit-0-v1.png 16c2acbe56295e3213febdbaff61422aa95281eab9106b8930257932a4afe290
beneGesserit-1-v1.png 42d11a6ba24607191504a9270b4bc70988f7fea4b2e1680888f0944bc0f119fc
beneGesserit-3-v1.png 2693709c9dfbe8c449c8681a8c87242c1bdd3ff93ef378277eed404d8a5c6f84
beneGesserit-4-v1.png 0a83f82fe6333654ce005537d66237c73827062daa0f1d83fe8b6ddcb79f3b01
```

No unresolved issue was found within this four-portrait assignment. No rules, UI behavior, AI policy, package scripts, or other faction assets were changed.
