import type { TruthAnswer, TruthFact } from './truthtrance';

/** Original public clauses only; answer-time constants never belong in a question. */
export type MixedActionExpression<A> =
  | { kind: 'fact'; fact: TruthFact }
  | { kind: 'action'; action: A }
  | { kind: 'and' | 'or'; terms: MixedActionExpression<A>[] };

/** Private answer-time result. Residual groups contain only actions and groups. */
export type CompiledMixedAction<A> =
  | { kind: 'constant'; value: boolean }
  | { kind: 'action'; action: A }
  | { kind: 'and' | 'or'; terms: CompiledMixedAction<A>[] };

export type MixedActionExpressionLimits = {
  maxDepth?: number;
  maxLeaves?: number;
  maxNodes?: number;
  maxTerms?: number;
  /** Travel expressions may consist entirely of future actions. */
  requireFact?: boolean;
};
export class MixedActionQuestionError extends Error {}

type ExpressionSize = { leaves: number; depth: number; nodes: number; maxTerms: number };
const leafSize = (): ExpressionSize => ({ leaves: 1, depth: 0, nodes: 1, maxTerms: 0 });
function groupSize(children: ExpressionSize[]): ExpressionSize {
  return {
    leaves: children.reduce((sum, child) => sum + child.leaves, 0),
    depth: 1 + Math.max(0, ...children.map(child => child.depth)),
    nodes: 1 + children.reduce((sum, child) => sum + child.nodes, 0),
    maxTerms: Math.max(children.length, ...children.map(child => child.maxTerms)),
  };
}
function factSize(fact: TruthFact): ExpressionSize {
  return fact.kind === 'and' || fact.kind === 'or'
    ? groupSize(fact.terms.map(factSize)) : leafSize();
}

/** A fact wrapper contributes its actual logical subtree, not a second node. */
export function mixedActionExpressionSize<A>(mixed: MixedActionExpression<A>): ExpressionSize {
  if (mixed.kind === 'fact') return factSize(mixed.fact);
  if (mixed.kind === 'action') return leafSize();
  return groupSize(mixed.terms.map(mixedActionExpressionSize));
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new MixedActionQuestionError(message);
}

function record(value: unknown): Record<string, unknown> {
  check(value && typeof value === 'object' && !Array.isArray(value),
    'Choose a current fact, future action, or AND/OR group.');
  return value as Record<string, unknown>;
}

/** The callbacks retain fact authority and validate one action leaf, respectively.
 * One logical budget spans the outer expression and all embedded fact groups. */
export function parseMixedActionExpression<A>(
  value: unknown,
  parseFact: (value: unknown) => TruthFact,
  parseAction: (value: unknown) => A,
  limits: MixedActionExpressionLimits = {},
): MixedActionExpression<A> {
  const maxDepth = limits.maxDepth ?? 4;
  const maxLeaves = limits.maxLeaves ?? 16;
  check(Number.isSafeInteger(maxDepth) && maxDepth >= 0 &&
    Number.isSafeInteger(maxLeaves) && maxLeaves >= 1 &&
    (limits.maxNodes === undefined || Number.isSafeInteger(limits.maxNodes) && limits.maxNodes >= 1) &&
    (limits.maxTerms === undefined || Number.isSafeInteger(limits.maxTerms) && limits.maxTerms >= 2) &&
    (limits.requireFact === undefined || typeof limits.requireFact === 'boolean'),
  'Choose valid logical depth and clause limits.');
  let leaves = 0;
  let nodes = 0;
  let hasFact = false;
  let hasAction = false;
  const count = (depth: number, leaf: boolean): void => {
    check(depth <= maxDepth && (!leaf || ++leaves <= maxLeaves),
      `Truthtrance supports at most ${maxLeaves} logical clauses and ${maxDepth} levels of grouping.`);
    check(limits.maxNodes === undefined || ++nodes <= limits.maxNodes,
      `Truthtrance supports at most ${limits.maxNodes} logical nodes, including groups.`);
  };
  const countTerms = (terms: readonly unknown[]): void => {
    check(limits.maxTerms === undefined || terms.length <= limits.maxTerms,
      `Truthtrance supports at most ${limits.maxTerms} terms in each AND/OR group.`);
  };
  const countFact = (fact: TruthFact, depth: number): void => {
    const group = fact.kind === 'and' || fact.kind === 'or';
    count(depth, !group);
    if (group) {
      countTerms(fact.terms);
      for (const term of fact.terms) countFact(term, depth + 1);
    }
  };
  const parse = (input: unknown, depth: number): MixedActionExpression<A> => {
    const node = record(input);
    if (node.kind === 'fact') {
      check(Object.keys(node).sort().join(',') === 'fact,kind',
        'Supply only the original current fact, not a frozen answer.');
      const fact = parseFact(node.fact);
      countFact(fact, depth);
      hasFact = true;
      return { kind: 'fact', fact };
    }
    count(depth, node.kind === 'action');
    if (node.kind === 'action') {
      check(Object.keys(node).sort().join(',') === 'action,kind',
        'Supply only one original future-action statement.');
      const action = parseAction(node.action);
      hasAction = true;
      return { kind: 'action', action };
    }
    check(Object.keys(node).sort().join(',') === 'kind,terms' &&
      (node.kind === 'and' || node.kind === 'or') && Array.isArray(node.terms) &&
      node.terms.length >= 2 && node.terms.length <= maxLeaves,
    'Join two or more current facts or future actions with AND or OR.');
    countTerms(node.terms);
    return { kind: node.kind, terms: node.terms.map(term => parse(term, depth + 1)) };
  };
  const mixed = parse(value, 0);
  check(hasAction && (limits.requireFact === false || hasFact), limits.requireFact === false
    ? 'An action question must include a future-action statement.'
    : 'A mixed question must include a current fact and a future-action statement.');
  return mixed;
}

/** Snapshot every fact before folding. Unknown takes the worst case for the
 * selected whole answer, so the residual guarantees it without hidden guesses. */
export function compileMixedActionExpression<A>(
  mixed: MixedActionExpression<A>,
  answerFact: (fact: TruthFact) => TruthAnswer,
  answer: boolean,
): CompiledMixedAction<A> {
  if (mixed.kind === 'fact') {
    const result = answerFact(mixed.fact);
    return { kind: 'constant', value: result === 'unknown' ? !answer : result === 'yes' };
  }
  if (mixed.kind === 'action') return { kind: 'action', action: mixed.action };
  // Do not short-circuit: a decisive earlier clause cannot skip later facts.
  const terms = mixed.terms.map(term => compileMixedActionExpression(term, answerFact, answer));
  const identity = mixed.kind === 'and';
  if (terms.some(term => term.kind === 'constant' && term.value !== identity))
    return { kind: 'constant', value: !identity };
  const residual = terms.filter(term => term.kind !== 'constant');
  if (residual.length === 0) return { kind: 'constant', value: identity };
  if (residual.length === 1) return residual[0];
  return { kind: mixed.kind, terms: residual };
}

/** Public text comes from the original tree, never private compiled clauses. */
export function mixedActionExpressionText<A>(
  mixed: MixedActionExpression<A>,
  factText: (fact: TruthFact) => string,
  actionText: (action: A) => string,
): string {
  if (mixed.kind === 'fact') return factText(mixed.fact);
  if (mixed.kind === 'action') return actionText(mixed.action);
  return `(${mixed.terms.map(term => mixedActionExpressionText(term, factText, actionText))
    .join(mixed.kind === 'and' ? ' AND ' : ' OR ')})`;
}
