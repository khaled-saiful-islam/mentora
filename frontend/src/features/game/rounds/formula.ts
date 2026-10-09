/**
 * The Lab's formulas (§26.8), worked out without `eval`: a small parser for
 * the one grammar the server's `app/learning/formula.py` reads the same way.
 *
 *   numbers     12, 0.5, .5
 *   names       the controls' ids — lower case, `[a-z_][a-z0-9_]*` — and `pi`
 *   operators   + - * /, and ^ (right to left, tighter than a leading minus:
 *               -2^2 is -4), with brackets
 *   functions   sin cos tan (in degrees), sqrt abs, min max (two or more)
 *
 * Anything it cannot work out — bad syntax, a name it does not know, dividing
 * by zero, the root of a negative — is NaN, never an error.
 */

export type Node =
  | { kind: 'number'; value: number }
  | { kind: 'name'; name: string }
  | { kind: 'negate'; of: Node }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { kind: 'call'; fn: string; args: Node[] }

type Token = { kind: 'number'; value: number } | { kind: 'name'; name: string } | { kind: 'symbol'; symbol: string }

const ONE_ARG = new Set(['sin', 'cos', 'tan', 'sqrt', 'abs'])
const MANY_ARGS = new Set(['min', 'max'])
const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|([a-z_][a-z0-9_]*)|([-+*/^(),]))/y

function tokens(formula: string): Token[] | null {
  const found: Token[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < formula.length) {
    if (/^\s*$/.test(formula.slice(TOKEN.lastIndex))) break
    const match = TOKEN.exec(formula)
    if (!match) return null
    if (match[1] !== undefined) found.push({ kind: 'number', value: Number(match[1]) })
    else if (match[2] !== undefined) found.push({ kind: 'name', name: match[2] })
    else found.push({ kind: 'symbol', symbol: match[3] })
  }
  return found
}

/** Reads tokens left to right; each rule takes what it can and moves on. */
class Reader {
  private at = 0
  constructor(private readonly list: Token[]) {}

  done(): boolean {
    return this.at >= this.list.length
  }

  private peek(symbol: string): boolean {
    const token = this.list[this.at]
    return token?.kind === 'symbol' && token.symbol === symbol
  }

  private take(symbol: string): boolean {
    if (!this.peek(symbol)) return false
    this.at += 1
    return true
  }

  /** The first of `symbols` that comes next, taken; null if none does. */
  private either<S extends string>(...symbols: S[]): S | null {
    return symbols.find((symbol) => this.take(symbol)) ?? null
  }

  sum(): Node {
    let node = this.product()
    for (let op = this.either('+', '-'); op; op = this.either('+', '-')) {
      node = { kind: 'binary', op, left: node, right: this.product() }
    }
    return node
  }

  private product(): Node {
    let node = this.signed()
    for (let op = this.either('*', '/'); op; op = this.either('*', '/')) {
      node = { kind: 'binary', op, left: node, right: this.signed() }
    }
    return node
  }

  private signed(): Node {
    if (this.take('-')) return { kind: 'negate', of: this.signed() }
    if (this.take('+')) return this.signed()
    return this.power()
  }

  private power(): Node {
    const base = this.atom()
    // The exponent may carry its own sign: 2^-1.
    return this.take('^') ? { kind: 'binary', op: '^', left: base, right: this.signed() } : base
  }

  private atom(): Node {
    const token = this.list[this.at]
    if (!token) throw new SyntaxError('ends too soon')
    this.at += 1
    if (token.kind === 'number') return { kind: 'number', value: token.value }
    if (token.kind === 'name') return this.take('(') ? this.call(token.name) : { kind: 'name', name: token.name }
    if (token.symbol === '(') {
      const inner = this.sum()
      if (!this.take(')')) throw new SyntaxError('a bracket is not closed')
      return inner
    }
    throw new SyntaxError(`unexpected ${token.symbol}`)
  }

  private call(fn: string): Node {
    const args = [this.sum()]
    while (this.take(',')) args.push(this.sum())
    if (!this.take(')')) throw new SyntaxError('a call is not closed')
    const fits = (ONE_ARG.has(fn) && args.length === 1) || (MANY_ARGS.has(fn) && args.length >= 2)
    if (!fits) throw new SyntaxError(`${fn} cannot take ${args.length}`)
    return { kind: 'call', fn, args }
  }
}

const parsed = new Map<string, Node | null>()

/** The formula's tree, or null when it is not one this grammar reads. */
export function parse(formula: string): Node | null {
  if (parsed.has(formula)) return parsed.get(formula) ?? null
  let node: Node | null = null
  const list = tokens(formula)
  if (list && list.length > 0) {
    try {
      const reader = new Reader(list)
      const read = reader.sum()
      node = reader.done() ? read : null
    } catch {
      node = null // not a formula this grammar reads: worked out as NaN
    }
  }
  parsed.set(formula, node)
  return node
}

const DEGREES = Math.PI / 180

function apply(fn: string, args: number[]): number {
  switch (fn) {
    case 'sin':
      return Math.sin(args[0] * DEGREES)
    case 'cos':
      return Math.cos(args[0] * DEGREES)
    case 'tan':
      return Math.tan(args[0] * DEGREES)
    case 'sqrt':
      return args[0] < 0 ? NaN : Math.sqrt(args[0])
    case 'abs':
      return Math.abs(args[0])
    case 'min':
      return Math.min(...args)
    case 'max':
      return Math.max(...args)
    default:
      return NaN
  }
}

function binary(op: string, left: number, right: number): number {
  if (op === '+') return left + right
  if (op === '-') return left - right
  if (op === '*') return left * right
  if (op === '/') return right === 0 ? NaN : left / right
  return left ** right
}

function work(node: Node, values: Record<string, number>): number {
  switch (node.kind) {
    case 'number':
      return node.value
    case 'name':
      if (node.name === 'pi') return Math.PI
      return Object.prototype.hasOwnProperty.call(values, node.name) ? values[node.name] : NaN
    case 'negate':
      return -work(node.of, values)
    case 'binary':
      return binary(node.op, work(node.left, values), work(node.right, values))
    case 'call':
      return apply(node.fn, node.args.map((arg) => work(arg, values)))
  }
}

/** The formula worked out with the controls at `values`; NaN when it cannot be. */
export function evaluate(formula: string, values: Record<string, number>): number {
  const node = parse(formula)
  if (!node) return NaN
  const result = work(node, values)
  return Number.isFinite(result) ? result : NaN
}

/** The names a formula reads, besides `pi` — the controls it needs. */
export function variablesOf(formula: string): string[] {
  const node = parse(formula)
  const names = new Set<string>()
  const visit = (n: Node) => {
    if (n.kind === 'name' && n.name !== 'pi') names.add(n.name)
    else if (n.kind === 'negate') visit(n.of)
    else if (n.kind === 'binary') [n.left, n.right].forEach(visit)
    else if (n.kind === 'call') n.args.forEach(visit)
  }
  if (node) visit(node)
  return [...names]
}
