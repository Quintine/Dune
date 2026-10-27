import {
  parseShipmentExpression,
  ShipmentClaimError,
  type ShipmentExpression,
} from './shipment-promises';

/** Shipment limits count leaves, rather than counting the containing groups. */
export function shipmentExpressionInputSize(value: ShipmentExpression): { leaves: number; depth: number } {
  if (!('op' in value)) return { leaves: 1, depth: 0 };
  const children = value.terms.map(shipmentExpressionInputSize);
  return {
    leaves: children.reduce((sum, child) => sum + child.leaves, 0),
    depth: 1 + Math.max(0, ...children.map(child => child.depth)),
  };
}

/** Use the existing parser's structure and bounds while unfinished leaf fields
 * remain editable. Frozen current facts are never valid pure-shipment input. */
export function shipmentExpressionInputError(value: ShipmentExpression): string | null {
  const structure = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    if ('op' in node) return {
      ...node,
      ...('terms' in node && Array.isArray(node.terms) ? { terms: node.terms.map(structure) } : {}),
    };
    if ('constant' in node) return node;
    // Keep the real territory for an exact sector so the shared parser checks
    // their relationship; territory-only draft editing retains its old rules.
    return { ...node, territory: Object.hasOwn(node, 'sector') && 'territory' in node
      ? node.territory : 'arrakeen', minimum: 1 };
  };
  try {
    parseShipmentExpression(structure(value), { allowConstants: false });
    return null;
  } catch (error) {
    if (error instanceof ShipmentClaimError) return error.message;
    throw error;
  }
}
