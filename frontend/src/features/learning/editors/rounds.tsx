/**
 * Editing an island's round (§26), in the template it is played in: a Sort It
 * Out's baskets and the cards that go in each, a Line Up's steps in their
 * right order, a Match Up's pairs. Every piece has its *why* — what the buddy
 * says when a child puts it in the wrong place.
 *
 * Within the sizes the server keeps (`SORT_CARDS` and the rest in
 * app/learning/game.py), so nothing saved here is refused there.
 */
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react'
import type { Basket, MatchContent, OrderContent, Pair, SortCard, SortContent, Step } from '@/features/game/rounds'
import { GrowingText } from './fields'

export const PIECE_LIMITS = { label: 40, piece: 120, why: 220, icon: 16 }
const SIZES = { baskets: [2, 4], cards: [3, 14], steps: [3, 9], pairs: [3, 8] } as const

/** An id for a new piece that no other piece has. */
function freshId(prefix: string, taken: { id: string }[]): string {
  const ids = new Set(taken.map((p) => p.id))
  let n = taken.length + 1
  while (ids.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

export function SortEditor({ content, onChange }: { content: SortContent; onChange: (content: SortContent) => void }) {
  const setBasket = (id: string, patch: Partial<Basket>) => onChange({ ...content, baskets: content.baskets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  const setCard = (id: string, patch: Partial<SortCard>) => onChange({ ...content, cards: content.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const dropBasket = (id: string) => {
    const left = content.baskets.filter((b) => b.id !== id)
    onChange({ baskets: left, cards: content.cards.map((c) => (c.basket === id ? { ...c, basket: left[0].id } : c)) })
  }
  return (
    <div className="space-y-3">
      <Group label="Baskets" adding={content.baskets.length < SIZES.baskets[1] ? 'Add a basket' : null} onAdd={() => onChange({ ...content, baskets: [...content.baskets, { id: freshId('b', content.baskets), label: '', icon: '' }] })}>
        {content.baskets.map((basket, n) => (
          <Row key={basket.id} label={`Basket ${n + 1}`} icon={basket.icon} onIcon={(icon) => setBasket(basket.id, { icon })} onRemove={content.baskets.length > SIZES.baskets[0] ? () => dropBasket(basket.id) : null}>
            <GrowingText label={`Basket ${n + 1}`} value={basket.label} maxLength={PIECE_LIMITS.label} placeholder="What goes in it" onChange={(label) => setBasket(basket.id, { label })} />
          </Row>
        ))}
      </Group>
      <Group label="Cards" adding={content.cards.length < SIZES.cards[1] ? 'Add a card' : null} onAdd={() => onChange({ ...content, cards: [...content.cards, { id: freshId('c', content.cards), text: '', icon: '', basket: content.baskets[0].id, why: '' }] })}>
        {content.cards.map((card, n) => (
          <Row key={card.id} label={`Card ${n + 1}`} icon={card.icon} onIcon={(icon) => setCard(card.id, { icon })} onRemove={content.cards.length > SIZES.cards[0] ? () => onChange({ ...content, cards: content.cards.filter((c) => c.id !== card.id) }) : null}>
            <GrowingText label={`Card ${n + 1}`} value={card.text} maxLength={PIECE_LIMITS.piece} placeholder="The card" onChange={(text) => setCard(card.id, { text })} />
            <select aria-label={`Card ${n + 1}: its basket`} value={card.basket} onChange={(e) => setCard(card.id, { basket: e.target.value })} className="h-9 w-full max-w-full rounded-full border-2 border-border bg-surface px-3 text-sm font-bold sm:w-auto">
              {content.baskets.map((basket) => (
                <option key={basket.id} value={basket.id}>Goes in: {basket.label || 'an unnamed basket'}</option>
              ))}
            </select>
            <Why label={`Card ${n + 1}`} value={card.why} onChange={(why) => setCard(card.id, { why })} />
          </Row>
        ))}
      </Group>
    </div>
  )
}

export function OrderEditor({ content, onChange }: { content: OrderContent; onChange: (content: OrderContent) => void }) {
  const steps = content.steps
  const setStep = (id: string, patch: Partial<Step>) => onChange({ steps: steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const move = (n: number, by: -1 | 1) => {
    const next = [...steps]
    ;[next[n], next[n + by]] = [next[n + by], next[n]]
    onChange({ steps: next })
  }
  return (
    <Group label="Steps, in the right order" adding={steps.length < SIZES.steps[1] ? 'Add a step' : null} onAdd={() => onChange({ steps: [...steps, { id: freshId('s', steps), text: '', icon: '', why: '' }] })}>
      {steps.map((step, n) => (
        <Row key={step.id} label={`Step ${n + 1}`} icon={step.icon} onIcon={(icon) => setStep(step.id, { icon })} onRemove={steps.length > SIZES.steps[0] ? () => onChange({ steps: steps.filter((s) => s.id !== step.id) }) : null}>
          <div className="flex items-start gap-1">
            <span className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">{n + 1}</span>
            <div className="min-w-0 flex-1">
              <GrowingText label={`Step ${n + 1}`} value={step.text} maxLength={PIECE_LIMITS.piece} placeholder="What happens" onChange={(text) => setStep(step.id, { text })} />
            </div>
            <button type="button" aria-label={`Move step ${n + 1} up`} disabled={n === 0} onClick={() => move(n, -1)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover disabled:opacity-30">
              <ArrowUp weight="bold" className="size-4" />
            </button>
            <button type="button" aria-label={`Move step ${n + 1} down`} disabled={n === steps.length - 1} onClick={() => move(n, 1)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover disabled:opacity-30">
              <ArrowDown weight="bold" className="size-4" />
            </button>
          </div>
          <Why label={`Step ${n + 1}`} value={step.why} onChange={(why) => setStep(step.id, { why })} />
        </Row>
      ))}
    </Group>
  )
}

export function MatchEditor({ content, onChange }: { content: MatchContent; onChange: (content: MatchContent) => void }) {
  const pairs = content.pairs
  const setPair = (id: string, patch: Partial<Pair>) => onChange({ pairs: pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  return (
    <Group label="Pairs" adding={pairs.length < SIZES.pairs[1] ? 'Add a pair' : null} onAdd={() => onChange({ pairs: [...pairs, { id: freshId('p', pairs), left: '', right: '', why: '' }] })}>
      {pairs.map((pair, n) => (
        <Row key={pair.id} label={`Pair ${n + 1}`} onRemove={pairs.length > SIZES.pairs[0] ? () => onChange({ pairs: pairs.filter((p) => p.id !== pair.id) }) : null}>
          <div className="grid gap-2 @md:grid-cols-2">
            <GrowingText label={`Pair ${n + 1}: one side`} value={pair.left} maxLength={PIECE_LIMITS.piece} placeholder="One side" onChange={(left) => setPair(pair.id, { left })} />
            <GrowingText label={`Pair ${n + 1}: the other side`} value={pair.right} maxLength={PIECE_LIMITS.piece} placeholder="What it goes with" onChange={(right) => setPair(pair.id, { right })} />
          </div>
          <Why label={`Pair ${n + 1}`} value={pair.why} onChange={(why) => setPair(pair.id, { why })} />
        </Row>
      ))}
    </Group>
  )
}

function Group({ label, adding, onAdd, children }: { label: string; adding: string | null; onAdd: () => void; children: React.ReactNode }) {
  return (
    // A fieldset is as wide as its widest content unless told otherwise: a
    // long basket name in a card's picker would push the page sideways.
    <fieldset className="min-w-0 rounded-2xl border-2 border-border p-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</legend>
      <ol className="space-y-2">{children}</ol>
      {adding && (
        <button type="button" onClick={onAdd} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
          <Plus weight="bold" className="size-4" /> {adding}
        </button>
      )}
    </fieldset>
  )
}

function Row({ label, icon, onIcon, onRemove, children }: { label: string; icon?: string; onIcon?: (icon: string) => void; onRemove: (() => void) | null; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-muted/40 p-2">
      {onIcon && <input aria-label={`${label}: its picture`} value={icon ?? ''} maxLength={PIECE_LIMITS.icon} onChange={(e) => onIcon(e.target.value)} className="size-11 shrink-0 rounded-xl bg-surface text-center text-2xl" />}
      <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
      {onRemove && (
        <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-destructive">
          <Trash weight="bold" className="size-4" />
        </button>
      )}
    </li>
  )
}

function Why({ label, value, onChange }: { label: string; value: string; onChange: (why: string) => void }) {
  return <GrowingText label={`${label}: why`} value={value} maxLength={PIECE_LIMITS.why} placeholder="Why — said when it is put in the wrong place" onChange={onChange} className="text-sm text-muted-foreground" />
}
