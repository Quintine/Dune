# Reinforcements battle prototype

The separate Ecaz Treachery Cards variant shuffles one physical Reinforcements
card independently of choosing the Ecaz faction. Its bounded handler supports
Basic or Advanced classic-faction tables and clean Ecaz/Moritani expansion
tables without other optional modules or co-present Ecaz allied armies. The
holder may commit it in either Battle Plan card slot. It is neither a weapon
nor a defense: Prescience of a category receives **None**, while the physical
slot stays occupied and hidden until reveal. A named-card inspection still
fixes the exact card. Harass & Withdraw and Stone Burner cannot share this
plan; Homeworld and other optional-module combinations remain gated.

The holder must have three own reserve counters when sealing the plan. The owner-only battle offer displays availability and the exact provisional cost. The current prototype deterministically takes ordinary reserves first, then elite reserves if needed, transferring precisely three physical counters to the corresponding Tanks subpools when the battle settles. There is no spice payment or on-board arrival. The +2 changes the calculated normal-outcome battle score, **not** the committed physical dial, support payment, casualty count or leader survival. The card is discarded after any revealed result, including an own, opposing or mutual Traitor call and Lasgun/Shield explosion. The cost is likewise paid on each of those outcomes. A successful Traitor call still supersedes the normal score; the modifier never overrides it. Public history records the transfer; the sealed card and owner reserve mix stay private until the reveal. JSON-restored decisions and transactional room updates cannot charge the same cost twice.

**Provisional interpretations, not publisher rulings:** The card says “increase the dialed number by 2” and transfer three reserves, but no retrieved combined ruling answers whether a sole successful Traitor caller instead keeps their reserves, how the transfer orders against an explosion, whether +2 adds Advanced support or physical losses, which reserve types the holder may select, or whether the three spent reserves count as battle losses for Atreides. For this bounded prototype, payment is at battle settlement before on-board casualties on every outcome; the engine counts the three as battle losses, chooses normal-first rather than offering a type selection, and keeps the score bonus separate from physical dial. [The source review](ECAZ_TREACHERY_RULES.md#14-september-reinforcements-cost-review) records the competing reading and pending user question. These choices are visible so they can be revised without changing prior hands or inventing hidden information.

The owner receives a card-slot explanation and disabled reason when fewer than three reserve counters remain or the bounded mode is unsupported. All four AI profiles generate legal candidates in the classic and Ecaz/Moritani profiles and can select either slot, including an Advanced plan. The current scoring is a minimal legal participation heuristic, not difficulty calibration. The prototype does not certify the whole three-card variant, other expansion combinations, optional modules, historical-save compatibility or public mode starts.

Focused rule, engine, controls and in-memory SQLite tests cover both slots, Basic/Advanced payment, elite subpool conservation, traitor/explosion disposal, private sealed views, JSON restoration, rejected-action immutability and competing final room commits, now including a paired Ecaz/Moritani saved battle. The test results and actual browser/UI evidence for the current checkpoint are recorded in [Implementation status](IMPLEMENTATION_STATUS.md); test coverage is not a publisher ruling.
