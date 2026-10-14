/**
 * Detective Case (§26.8): a case file — the question, the suspects (people or
 * things), and clue cards to open and read, some with a small table. First
 * the child picks who or what it is; then the clue that proves it, tapped or
 * dragged onto who it names (§28.3.5). A wrong
 * pick wobbles and the buddy says why it is not so; the right ones are
 * stamped. Show me makes one right pick at a time.
 */
import { motion } from 'motion/react'
import { CaretDown, CheckFat, FolderOpen, MagnifyingGlass, X } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { pop, spring } from '@/motion'
import { MAGNET, useMagnet, type DragEvent } from './drag'
import { ReadIt, SHOW_ME_MS, SIZE, useFinish, useLater, useShowMe, useWobble } from './parts'
import { shuffled, type Shuffled } from './shuffle'
import type { Band, CaseClue, CaseContent, CaseSuspect, RoundProps } from './types'

type Step = 'who' | 'proof' | 'done'

const add = (set: Set<string>, id: string) => new Set(set).add(id)

export function DetectiveCase({ content, band, calm, say, sound, showMe, onMove, onDone, shuffle = shuffled }: RoundProps<CaseContent> & Shuffled) {
  const [suspects] = useState(() => shuffle(content.suspects))
  const play = useCase({ content, calm, say, sound, showMe, onMove })
  const { step, showing } = play
  const magnet = useMagnet('suspect', sound)
  useFinish(step === 'done', onDone)

  return (
    <div ref={play.scope} className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <CaseHeader question={content.question} band={band} say={say} />
        <p className="mx-auto w-fit max-w-full break-words rounded-full bg-surface/90 px-4 py-1 text-center font-display text-lg font-bold" aria-live="polite">
          {step === 'who' ? 'Who — or what — is it? Read the clues, then pick.' : step === 'proof' ? 'Which clue proves it?' : 'Case closed!'}
        </p>
        <section aria-label="Suspects" className={cn('grid gap-3', suspects.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2')}>
          {suspects.map((suspect) => (
            <SuspectCard key={suspect.id} suspect={suspect} band={band} calm={calm} picking={step === 'who'} named={step !== 'who' && suspect.id === content.answer} out={play.ruledOut.has(suspect.id)} pointed={showing === suspect.id} near={step === 'proof' && magnet.near === suspect.id} onPick={() => play.accuse(suspect)} />
          ))}
        </section>
        <section aria-label="Clues" className="grid gap-3 sm:grid-cols-2">
          {content.clues.map((clue, n) => (
            <ClueCard
              key={clue.id}
              clue={clue}
              number={n + 1}
              calm={calm}
              open={play.opened.has(clue.id)}
              proving={step === 'proof'}
              proved={step === 'done' && clue.id === content.key}
              pointed={showing === clue.id}
              onOpen={() => play.open(clue.id)}
              onProve={() => play.prove(clue)}
              onDrag={magnet.track}
              onDrop={(event) => {
                // Onto who it names: the clue is offered as the proof.
                if (magnet.drop(event) === content.answer) play.prove(clue)
              }}
            />
          ))}
        </section>
      </div>
    </div>
  )
}

/** The case as it is worked: who is picked, which clue proves it, what is
 *  open and ruled out — and Show me, one right pick at a time. */
function useCase({ content, calm, say, sound, showMe, onMove }: {
  content: CaseContent; calm: boolean; say: (text: string) => void; sound: RoundProps<CaseContent>['sound']; showMe: number; onMove: RoundProps<CaseContent>['onMove']
}) {  // fmt: skip
  const [step, setStep] = useState<Step>('who')
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  const [ruledOut, setRuledOut] = useState<Set<string>>(() => new Set())
  const [showing, setShowing] = useState<string | null>(null)
  const [scope, shake] = useWobble(calm)
  const later = useLater()
  const open = (id: string) => setOpened((all) => add(all, id))

  function pick(id: string, right: boolean, why: string, next: Step) {
    onMove({ piece: id, right })
    sound(right ? 'correct' : 'wrong')
    if (right) return setStep(next)
    say(why)
    shake(id)
  }

  function accuse(suspect: CaseSuspect) {
    if (step !== 'who' || showing) return
    const right = suspect.id === content.answer
    if (right) say(suspect.why)
    else setRuledOut((all) => add(all, suspect.id))
    pick(suspect.id, right, suspect.why, 'proof')
  }

  function prove(clue: CaseClue) {
    if (step !== 'proof' || showing) return
    open(clue.id)
    pick(clue.id, clue.id === content.key, clue.why, 'done')
  }

  useShowMe(showMe, () => {
    const target = step === 'who' ? content.answer : step === 'proof' ? content.key : null
    if (!target || showing) return
    if (step === 'proof') open(target)
    setShowing(target)
    const culprit = step === 'who' ? content.suspects.find((s) => s.id === content.answer) : undefined
    later(() => {
      setShowing(null)
      sound('correct')
      if (culprit) say(culprit.why)
      setStep(step === 'who' ? 'proof' : 'done')
    }, SHOW_ME_MS)
  })

  return { step, opened, ruledOut, showing, scope, open, accuse, prove }
}

function CaseHeader({ question, band, say }: { question: string; band: Band; say: (text: string) => void }) {
  return (
    <header className="rounded-3xl border-4 border-dashed border-warning/60 bg-surface/95 p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-warning">
        <FolderOpen weight="fill" className="size-5" aria-hidden />
        Case file
      </p>
      <div className="mt-1 flex items-start gap-2">
        <h3 className="min-w-0 flex-1 break-words font-display text-xl font-semibold sm:text-2xl">{question}</h3>
        {band === 'early' && <ReadIt text={question} say={say} />}
      </div>
    </header>
  )
}

/** A big rubber stamp across a card: the right pick. */
function Stamp({ label, calm }: { label: string; calm: boolean }) {
  return (
    <motion.span variants={pop} initial={calm ? false : 'hidden'} animate="shown" className="absolute right-3 top-3 flex -rotate-6 items-center gap-1 rounded-xl border-4 border-success bg-surface px-2 py-0.5 font-display text-lg font-bold uppercase text-success shadow-sm">
      <CheckFat weight="fill" className="size-5" aria-hidden />
      {label}
    </motion.span>
  )
}

function SuspectCard({ suspect, band, calm, picking, named, out, pointed, near, onPick }: {
  suspect: CaseSuspect; band: Band; calm: boolean; picking: boolean; named: boolean; out: boolean; pointed: boolean; near: boolean; onPick: () => void
}) {  // fmt: skip
  const size = SIZE[band]
  return (
    <button
      type="button"
      data-piece={suspect.id}
      data-suspect={named ? suspect.id : undefined}
      onClick={onPick}
      disabled={!picking}
      aria-label={named ? `${suspect.name}: it is this one` : `Pick ${suspect.name}: ${suspect.claim}`}
      className={cn(
        'relative flex min-h-28 min-w-0 flex-col items-start gap-1 rounded-3xl border-4 bg-surface p-4 text-left shadow-sm transition-colors',
        // Room for the stamp or the cross, so neither covers a word.
        named ? 'pt-14' : out && 'pr-14',
        'enabled:hover:border-hover-border enabled:hover:bg-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
        near ? MAGNET : named ? 'border-success bg-correct-soft' : pointed ? 'border-primary ring-4 ring-primary/40' : 'border-border',
        'transition-[transform,border-color,background-color]',
        out && 'opacity-60',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {suspect.icon && <span className={cn(size.icon, 'leading-none')} aria-hidden>{suspect.icon}</span>}
        <span className={cn('min-w-0 break-words font-display font-semibold', size.piece)}>{suspect.name}</span>
      </span>
      <span className="min-w-0 break-words text-muted-foreground">{suspect.claim}</span>
      {out && (
        <span aria-hidden className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-wrong-soft text-destructive">
          <X weight="bold" className="size-5" />
        </span>
      )}
      {named && <Stamp label="That's it!" calm={calm} />}
    </button>
  )
}

function ClueCard({ clue, number, calm, open, proving, proved, pointed, onOpen, onProve, onDrag, onDrop }: {
  clue: CaseClue; number: number; calm: boolean; open: boolean; proving: boolean; proved: boolean; pointed: boolean; onOpen: () => void; onProve: () => void
  onDrag: (event: DragEvent) => void; onDrop: (event: DragEvent) => void
}) {  // fmt: skip
  // A drag ends with a click where it started: that is not a tap.
  const dragged = useRef(false)
  const tapped = (action: () => void) => () => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    action()
  }
  return (
    <motion.article
      data-piece={clue.id}
      aria-label={`Clue ${number}: ${clue.title}`}
      drag={proving}
      dragSnapToOrigin
      whileDrag={calm ? undefined : { scale: 1.04, rotate: -1.5, zIndex: 30 }}
      onDragStart={() => {
        dragged.current = true
      }}
      onDrag={(event: DragEvent) => onDrag(event)}
      onDragEnd={(event: DragEvent) => onDrop(event)}
      className={cn('relative min-w-0 rounded-3xl border-4 bg-surface p-3 shadow-sm', proving && 'cursor-grab touch-none active:cursor-grabbing', proved ? 'border-success pt-14' : pointed ? 'border-primary ring-4 ring-primary/40' : 'border-border')}
    >
      <button type="button" onClick={tapped(onOpen)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-1 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
        <span className="text-3xl leading-none" aria-hidden>{clue.icon || '🔎'}</span>
        <span className="min-w-0 flex-1 break-words font-display text-lg font-semibold">
          <span className="block text-xs font-bold uppercase tracking-wide text-primary">Clue {number}</span>
          {clue.title}
        </span>
        {open ? <MagnifyingGlass weight="bold" className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : <CaretDown weight="bold" className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
      </button>
      {open && (
        <motion.div initial={calm ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} className="mt-2 space-y-2 px-1">
          <p className="break-words">{clue.text}</p>
          {clue.rows.length > 1 && <ClueTable rows={clue.rows} title={clue.title} />}
        </motion.div>
      )}
      {proving && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={tapped(onProve)} aria-label={`This clue proves it: ${clue.title}`}>
          This proves it
        </Button>
      )}
      {proving && <p className="mt-2 text-sm text-muted-foreground">Or drag it onto who it points to.</p>}
      {proved && <Stamp label="Proof!" calm={calm} />}
    </motion.article>
  )
}

/** A clue's small table: its first row the headings. */
function ClueTable({ rows, title }: { rows: string[][]; title: string }) {
  const [head, ...body] = rows
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">{title}</caption>
      <thead>
        <tr>
          {head.map((cell, n) => (
            <th key={n} scope="col" className="break-words border-b-2 border-border px-2 py-1 text-left font-bold">{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, r) => (
          <tr key={r}>
            {row.map((cell, n) => (
              <td key={n} className="break-words border-b border-border px-2 py-1 align-top">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
