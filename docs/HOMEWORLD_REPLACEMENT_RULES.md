# Homeworld replacement: source audit and adapter contract

Audited 9 September 2026. Read alongside [Homeworld rules](HOMEWORLD_RULES.md).
This document authorizes no runtime activation and adds no occupation or Ghola
ruling. No production files changed in this audit.

## Sources and explicit rules

The [GF9 Ixians & Tleilaxu rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf)
currently returns HTTP 403. Its publisher-authored 12-page
[retailer mirror](https://lelekan.com.ua/files/rules/2081/pravila-nastilnoyi-gri-dyuna-dim-iksianciv-ta-dim-tlejlaksu-dune-ixians-amp-amp-tleilaxu-dopovnennya-angl-anglijskoyu-movoyu.0.pdf)
was freshly read, including GF9 2020/Future Pastimes credits, pp.6, 9–10 and 12;
the official indexed p.9 and Karama table agree. This is original publisher
content, not the retailer's own rules.

- **Face Dance, p.6:** another faction's victory remains its victory. The
  revealed leader dies without a new bounty. Surviving winning forces return
  to their reserves. Tleilaxu replacements may come from its reserves or
  Arrakis, up to the returning force count. No positive minimum is specified.
  The p.10 FAQ orders traitor declaration, winner declaration, then Face Dance.
- **Ixians, pp.9–10:** after calculating casualties, surviving Suboids at that
  battle's location may replace Cyborgs lost in that battle, one for one. The
  example sends the substituted Suboids to the Tanks and retains the Cyborgs.
  The p.12 Karama table permits canceling this ordinary substitution advantage.

The [GF9 E3 rulebook, p.10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=10)
was freshly checked through its official indexed text; direct retrieval also
returns 403. Only natives may call Homeworld Face Dancers. It does not require
the native caller to be one of the two combatants. Homeworlds hold reserves;
they are not Arrakis territories. Advanced Emperor has two homes: initial
Sardaukar and revived Sardaukar go to Salusa, revived normal forces to Kaitain.
An expressly permitted transfer can subsequently mix the types. Those placement
sentences do not expressly assign forces returned by Face Dance. The
[designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani)
supplies no additional replacement ruling. No community compilation was adopted
as an erratum.

## Physical interpretation and remaining assignment boundary

**Native Tleilaxu:** composition of the ordinary caller rule permits a reveal
after two visitors fight at Tleilax, subject to the existing occupied-face
restriction. Eligibility must not require Tleilaxu to have lost that battle.
This is a composition, not a separately retrieved three-army FAQ.

Native reserve counters are already at the destination. Selecting some as
replacement sources must produce no net force change. The interface may omit
that redundant selection while allowing zero external replacements. Existing
natives remain; returning winners disappear. Only actual external arrivals
increase the native pool. Never create a Tleilaxu visitor pool on Tleilax or
withdraw the same reserves twice. The original source scope does not expressly
include Tleilaxu garrisons on other foreign Homeworlds.

**Returning winner:** preserve every normal/special identity and return only
that winning army, not third parties. A single native Homeworld has an
unambiguous destination. Advanced Emperor's allocation remains unverified:
neither arbitrary player choice, universal Salusa routing for stars, nor
restoration to a historical shipment origin is expressly prescribed for this
effect. Keep this assignment boundary visible rather than presenting a revival
helper's default as a confirmed Face Dance rule.

**Ixian adapter:** treating substitution as ordinary battle cleanup at a
Homeworld is an application of existing combat mechanics, not a new shipment
permission. Use the one actual native or visiting Ixian pool at the battle
location. Record the Cyborg casualties of that resolved battle; surviving
Suboids elsewhere cannot pay. Exchange exact types between that pool and
the Tanks. Total physical casualties and total Tanks remain unchanged by the
exchange; only their type allocation changes. No sectors, reserve shipment,
revival allowance, revival income or fresh population-arrival event is created.
Native reserves elsewhere and unrelated old Cyborg deaths are not recovery
sources. Cancellation leaves the original casualties intact.

## Verification targets

Test native and visitor Ixian pools, exact casualty receipts, cancellation and
JSON resume. For Face Dance, cover a noncombatant native, no replacement,
existing native reserves, Arrakis arrivals, untouched third-party armies,
special-counter returns, and the unresolved Emperor assignment explicitly.
Reject duplicate or nonexistent sources before changing custody. Preserve the
original winner, leader/card cleanup and any prior battle rewards.
