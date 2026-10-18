import { FACTIONS, type FactionId } from './catalog';
import type { ResponseWindow } from './engine';
import { CHOAM_NEXUS_EFFECTS } from './nexus-choam';

type DetailedResponseKind = 'choamWorthless' | 'eliteStrength';
type AliasResponseKind = 'nexusPrescience' | 'nexusAdvisorFlip';
type OrdinaryResponseKind = Exclude<ResponseWindow['kind'], DetailedResponseKind | AliasResponseKind>;
const worthlessLabels = CHOAM_NEXUS_EFFECTS;
type WorthlessPurposeEffect = keyof typeof worthlessLabels;

/** Purpose records contain semantic public effects, never a hidden card,
 * amount, force count, route, recipient or native variant declaration. */
export type KullPurpose =
  | 'shipment-price'
  | 'auction-free-purchase'
  | `special:${FactionId}`
  | `cancel:${OrdinaryResponseKind}`
  | `cancel:choamWorthless:${WorthlessPurposeEffect}`
  | `cancel:eliteStrength:${FactionId}`;

/** Exhaustive against the engine's typed public response kinds. New response
 * families must receive an explicit purpose rather than an arbitrary suffix. */
const cancellationLabels = {
  moritaniPlacement: 'Moritani Terror placement',
  ecazPlacement: 'Ecaz Ambassador placement',
  ecazCollection: 'Ecaz collection',
  ecazOccupy: 'Ecaz Occupy',
  moritaniAlliance: 'Moritani alliance',
  moritaniDuke: 'the Moritani Duke',
  moritaniRetention: 'Moritani card retention',
  voice: 'the Voice',
  prescience: 'Prescience',
  advisor: 'a spiritual advisor shipment',
  emperorIncome: 'Emperor income',
  richesePurchaseIncome: 'Richese purchase income',
  richeseGift: 'a Richese gift',
  richeseNoField: 'Richese No-Field use',
  harkonnenBonus: 'the Harkonnen bonus card',
  harkonnenTraitor: 'the Harkonnen allied traitor call',
  guildIncome: 'Guild income',
  guildRate: 'the Guild shipping rate',
  guildTransportPermission: 'Guild transport permission',
  emperorGift: 'the Emperor gift',
  emperorRevival: 'Emperor revival',
  stormPeek: 'the storm peek',
  stormProtection: 'storm protection',
  wormPlacement: 'additional worm placement',
  wormSurvival: 'worm survival',
  wormAllyProtection: 'allied worm protection',
  atreidesAuction: 'Atreides auction inspection',
  atreidesSpice: 'Atreides Spice Deck inspection',
  guildTiming: 'Guild timing',
  kwisatz: 'Kwisatz Haderach',
  capture: 'Harkonnen leader capture',
  fremenSupport: 'Fremen support',
  advisorFlip: 'advisor conversion',
  nexusSardaukar: 'Nexus Sardaukar strength',
  nexusFremenCunning: 'Fremen Nexus Cunning',
  nexusEcazBetrayal: 'Ecaz Nexus Betrayal',
  nexusGuildCunning: 'Guild Nexus Cunning',
  bgCharity: 'Bene Gesserit charity',
  choamCharity: 'CHOAM charity',
  choamInflation: 'CHOAM inflation',
  choamSale: 'a CHOAM sale',
  choamBattleIncome: 'CHOAM battle income',
  choamAudit: 'the CHOAM audit',
  choamBattleAid: 'CHOAM battle aid',
  worthlessKarama: 'Worthless-card Karama substitution',
  faceDancerReplacement: 'Face Dancer replacement',
  choamRevival: 'CHOAM revival',
  revivalLimit: 'the revival limit',
  revivalDiscount: 'the revival discount',
  earlyRevival: 'early revival',
  revivalIncome: 'revival income',
  foreignGhola: 'a foreign ghola',
  ixSubstitution: 'Ixian substitution',
  ixMovement: 'Ixian movement',
  fremenMovement: 'Fremen movement',
  mobileStronghold: 'Hidden Mobile Stronghold movement',
  richeseAuction: 'the Richese auction',
  richeseBlackMarket: 'the Richese Black Market',
  ixAuction: 'Ixian auction selection',
  ixTechnology: 'Ixian auction technology',
  ixAllyCard: 'the Ixian allied card',
} satisfies Record<OrdinaryResponseKind, string>;

const purposeLabels = new Map<KullPurpose, string>([
  ['shipment-price', 'Karama shipment pricing'],
  ['auction-free-purchase', 'a free Treachery purchase'],
]);
for (const faction of FACTIONS) {
  purposeLabels.set(`special:${faction.id}`, `the ${faction.name} special Karama power`);
  purposeLabels.set(`cancel:eliteStrength:${faction.id}`, `cancellation of ${faction.name} special-force strength`);
}
for (const [kind, label] of Object.entries(cancellationLabels) as [OrdinaryResponseKind, string][])
  purposeLabels.set(`cancel:${kind}`, `cancellation of ${label}`);
for (const [effect, label] of Object.entries(worthlessLabels) as [WorthlessPurposeEffect, string][])
  purposeLabels.set(`cancel:choamWorthless:${effect}`, `cancellation of ${label}`);

export function isKullPurpose(value: unknown): value is KullPurpose {
  return typeof value === 'string' && purposeLabels.has(value as KullPurpose);
}
export function kullCancellationPurpose(kind: ResponseWindow['kind'], detail?: string): KullPurpose {
  if (kind === 'choamWorthless') {
    if (typeof detail !== 'string' || !Object.hasOwn(worthlessLabels, detail))
      throw new Error('Kull cancellation needs the canonical CHOAM effect.');
    return `cancel:choamWorthless:${detail as WorthlessPurposeEffect}`;
  }
  if (kind === 'eliteStrength') {
    if (!FACTIONS.some(faction => faction.id === detail))
      throw new Error('Kull cancellation needs the special-force owner faction.');
    return `cancel:eliteStrength:${detail as FactionId}`;
  }
  const canonical = kind === 'nexusPrescience' ? 'prescience' : kind === 'nexusAdvisorFlip' ? 'advisorFlip' : kind;
  if (detail !== undefined || !Object.hasOwn(cancellationLabels, canonical))
    throw new Error('Kull cancellation needs one canonical response purpose without extra details.');
  return `cancel:${canonical}`;
}
export function kullSpecialPurpose(faction: FactionId): KullPurpose {
  if (!FACTIONS.some(candidate => candidate.id === faction))
    throw new Error('Kull special Karama needs the actual native faction.');
  return `special:${faction}`;
}
export function kullPurposeLabel(purpose: KullPurpose): string {
  if (!isKullPurpose(purpose)) throw new Error('Kull needs a canonical purpose.');
  return purposeLabels.get(purpose)!;
}

/** Projection messages belong to the engine. Legacy all-purpose restrictions
 * take priority; a purpose-specific entry blocks only the requested purpose. */
export function kullPurposeBlock(view: {
  karamaBlocked?: string | null;
  karamaPurposeBlocks?: readonly { purpose: KullPurpose; message: string }[];
}, purpose: KullPurpose): string | null {
  if (view.karamaBlocked) return view.karamaBlocked;
  return isKullPurpose(purpose)
    ? view.karamaPurposeBlocks?.find(entry => entry.purpose === purpose)?.message ?? null : null;
}
