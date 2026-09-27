/**
 * How a student is growing, said so a child can follow it (and a parent,
 * about their child):
 *
 * - their buddy sums it up in one sentence, with four plain numbers;
 * - their recent scores as bars, so "getting better" is something they see;
 * - skills in three groups — got it, getting there, let's practise — each with
 *   stars and "4 of 5 right" instead of fractions and percentages;
 * - what they finished, by when, each with a word for how it went.
 */
import { ArrowRight, ArrowDown, ArrowUp, Barbell, ChartBar, Minus, Star, Trophy, TrendUp, type Icon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Chip } from '@/components/ui'
import { Buddy } from '@/features/buddies'
import { lookOfKind } from '@/features/learning/kinds'
import type { HistoryRow, MadeForYou, Results, SkillInsight } from '@/features/play/api'
import { starsFor } from '@/features/play/session'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { rise, spring, stagger } from '@/motion'

const RECENT = 10

export interface ResultsViewProps {
  results: Results
  /** Whose results: undefined for the student themselves, a first name for a parent. */
  name?: string
  buddy?: string | null
  /** Practice made for a skill, to link its "Practise" button. */
  madeForYou?: MadeForYou[]
  /** Where a finished try opens. */
  hrefFor?: (row: HistoryRow) => string
}

export function ResultsView({ results, name, buddy, madeForYou = [], hrefFor = (row) => `/attempts/${row.attempt_id}` }: ResultsViewProps) {
  const rows = results.attempts
  const summary = summarise(rows, results.insights.skills)
  return (
    // A container: the groups and bars lay out by this column's width.
    <div className="@container space-y-10">
      <Summary summary={summary} name={name} buddy={buddy} />
      {rows.length >= 2 && <RecentScores rows={rows.slice(0, RECENT).reverse()} />}
      <Skills skills={results.insights.skills} name={name} madeForYou={madeForYou} />
      <Finished rows={rows} name={name} hrefFor={hrefFor} />
    </div>
  )
}

// --- the summary -------------------------------------------------------------------

interface SummaryData {
  finished: number
  usual: number
  stars: number
  trend: 'up' | 'steady' | 'down' | 'new'
  best: SkillInsight | null
  next: SkillInsight | null
}

/** Numbers a child can read: how many, their usual score, stars won, and
 *  whether the last few beat the few before. */
export function summarise(rows: HistoryRow[], skills: SkillInsight[]): SummaryData {
  const recent = rows.slice(0, 5)
  const usual = recent.length ? Math.round(recent.reduce((sum, r) => sum + r.percent, 0) / recent.length) : 0
  const now = rows.slice(0, 3)
  const before = rows.slice(3, 6)
  const mean = (list: HistoryRow[]) => list.reduce((sum, r) => sum + r.percent, 0) / list.length
  const change = now.length && before.length ? mean(now) - mean(before) : 0
  const trend = before.length === 0 ? 'new' : change >= 8 ? 'up' : change <= -8 ? 'down' : 'steady'
  const ranked = [...skills].sort((a, b) => b.mastery - a.mastery || b.total - a.total)
  const best = ranked.find((s) => s.level === 'strong') ?? null
  const next = [...skills].filter((s) => s.level === 'practise').sort((a, b) => a.mastery - b.mastery)[0] ?? null
  return { finished: rows.length, usual, stars: rows.reduce((sum, r) => sum + starsFor(r.percent), 0), trend, best, next }
}

function sentence(s: SummaryData, name?: string): string {
  const you = name ?? 'You'
  const your = name ? `${name}'s` : 'your'
  if (s.finished === 0) return name ? `${name} hasn't finished anything yet.` : "Finish a quiz or some flashcards and I'll show you how you're growing!"
  const strong = s.best ? `${you}${name ? ' is' : "'re"} a star at ${s.best.label}!` : `${you}${name ? ' has' : "'ve"} finished ${s.finished} so far.`
  const next = s.next ? ` Next, let's practise ${s.next.label}.` : ` Keep it up — ${your} skills are looking good.`
  return strong + next
}

const TREND: Record<SummaryData['trend'], { Icon: Icon; words: string; tone: string }> = {
  up: { Icon: ArrowUp, words: 'Getting better', tone: 'text-success' },
  steady: { Icon: Minus, words: 'Steady', tone: 'text-sky-700 dark:text-sky-100' },
  down: { Icon: ArrowDown, words: 'A bit lower', tone: 'text-sun-600 dark:text-sun-300' },
  new: { Icon: TrendUp, words: 'Just starting', tone: 'text-primary' },
}

function Summary({ summary, name, buddy }: { summary: SummaryData; name?: string; buddy?: string | null }) {
  const trend = TREND[summary.trend]
  return (
    <motion.section variants={rise} initial="hidden" animate="shown" className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-4 bg-gradient-to-br from-grape-100 via-surface to-mint-100 p-5 dark:from-grape-800/30 dark:to-mint-700/20">
        {buddy !== undefined && <Buddy buddy={buddy} size={96} mood={summary.trend === 'down' ? 'idle' : 'happy'} bubble="top" interactive={false} />}
        <p className="min-w-[min(100%,16rem)] flex-1 font-display text-xl leading-snug font-semibold md:text-2xl">{sentence(summary, name)}</p>
      </div>
      <motion.ul className="grid grid-cols-2 gap-px bg-border @2xl:grid-cols-4" variants={stagger(0.06, 0.15)} initial="hidden" animate="shown">
        <Stat label="Finished" value={String(summary.finished)} hint="quizzes and decks" />
        <Stat label={name ? 'Usual score' : 'Your usual score'} value={`${summary.usual}%`} hint="the last five, on average" />
        <Stat label="Stars won" value={String(summary.stars)} hint="up to three each time" star />
        <Stat label="Lately" value={trend.words} hint="the last three against the three before" Icon={trend.Icon} tone={trend.tone} />
      </motion.ul>
    </motion.section>
  )
}

function Stat({ label, value, hint, star = false, Icon, tone }: { label: string; value: string; hint: string; star?: boolean; Icon?: Icon; tone?: string }) {
  return (
    <motion.li variants={rise} className="bg-surface p-4">
      <p className="text-sm font-bold text-muted-foreground">{label}</p>
      <p className={cn('mt-1 flex items-center gap-1.5 font-display text-2xl font-semibold', tone)}>
        {star && <Star weight="fill" className="size-6 text-star" aria-hidden />}
        {Icon && <Icon weight="bold" className="size-6" aria-hidden />}
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </motion.li>
  )
}

// --- recent scores -----------------------------------------------------------------

function RecentScores({ rows }: { rows: HistoryRow[] }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <ChartBar weight="duotone" className="size-6 text-primary" aria-hidden /> Recent scores
      </h2>
      <p className="mt-1 text-muted-foreground">Oldest on the left, newest on the right. Taller is better.</p>
      <div className="mt-4 rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <ol className="flex h-44 items-end gap-2" aria-label="Recent scores, oldest first">
          {rows.map((row, i) => {
            const stars = starsFor(row.percent)
            return (
              <li key={row.attempt_id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${row.title}: ${Math.round(row.percent)}%`}>
                <span className="text-xs font-bold tabular-nums">{Math.round(row.percent)}%</span>
                <motion.span
                  className={cn('w-full max-w-12 rounded-t-xl', stars >= 3 ? 'bg-correct' : stars === 2 ? 'bg-star' : stars === 1 ? 'bg-sky-400' : 'bg-wrong/70')}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, row.percent)}%` }}
                  transition={{ ...spring.gentle, delay: 0.1 + i * 0.05 }}
                />
                <span className="sr-only">{row.title}</span>
              </li>
            )
          })}
        </ol>
        <div className="mt-2 flex justify-between text-xs font-bold text-muted-foreground">
          <span>Earlier</span>
          <span>Latest</span>
        </div>
      </div>
    </section>
  )
}

// --- skills ------------------------------------------------------------------------

interface Group {
  key: SkillInsight['level']
  title: string
  note: string
  Icon: Icon
  tone: string
  empty: string
}

const GROUPS: Group[] = [
  { key: 'strong', title: 'Got it!', note: 'Mostly right, again and again.', Icon: Trophy, tone: 'bg-correct-soft', empty: 'Skills land here once they are mostly right.' },
  { key: 'growing', title: 'Getting there', note: 'Some right — a little more and they stick.', Icon: TrendUp, tone: 'bg-sun-100 dark:bg-sun-600/15', empty: 'Nothing in the middle right now.' },
  { key: 'practise', title: "Let's practise", note: 'Tricky so far. Practice turns these around.', Icon: Barbell, tone: 'bg-wrong-soft', empty: 'Nothing tricky right now. Brilliant!' },
]

/** Stars for how sure a skill is: three when mostly right. */
function skillStars(skill: SkillInsight): number {
  if (skill.mastery >= 0.8) return 3
  if (skill.mastery >= 0.5) return 2
  return skill.mastery > 0 ? 1 : 0
}

function Skills({ skills, name, madeForYou }: { skills: SkillInsight[]; name?: string; madeForYou: MadeForYou[] }) {
  if (skills.length === 0) return null
  const practice = (skill: SkillInsight) => madeForYou.find((m) => !m.done && m.skills.some((s) => s.toLowerCase() === skill.label.toLowerCase()))
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{name ? `${name}'s skills` : 'Your skills'}</h2>
      <p className="mt-1 text-muted-foreground">
        Every question practises a skill. The stars show how sure {name ?? 'you'} {name ? 'is' : 'are'}: three is mostly right.
      </p>
      <motion.div className="mt-4 grid items-start gap-4 @4xl:grid-cols-3" variants={stagger(0.08)} initial="hidden" animate="shown">
        {GROUPS.map((group) => {
          const mine = skills.filter((s) => s.level === group.key).sort((a, b) => b.mastery - a.mastery)
          return (
            <motion.section key={group.key} variants={rise} className={cn('rounded-[1.75rem] p-5', group.tone)} aria-label={group.title}>
              <h3 className="flex items-center gap-2 font-display text-xl font-semibold">
                <group.Icon weight="fill" className="size-6" aria-hidden /> {group.title}
              </h3>
              <p className="text-sm text-foreground/70">{group.note}</p>
              {mine.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-surface/70 p-3 text-sm text-muted-foreground">{group.empty}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {mine.map((skill) => {
                    const made = !name && group.key !== 'strong' ? practice(skill) : undefined
                    return (
                      <li key={skill.subject + skill.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-surface p-3 shadow-sm">
                        <span className="min-w-[min(100%,10rem)] flex-1">
                          <span className="block break-words font-bold capitalize leading-snug">{skill.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {skill.correct} of {skill.total} right
                          </span>
                        </span>
                        <span className="flex" aria-label={`${skillStars(skill)} of 3 stars`}>
                          {[0, 1, 2].map((i) => (
                            <Star key={i} weight="fill" className={cn('size-5', i < skillStars(skill) ? 'text-star' : 'text-foreground/10')} />
                          ))}
                        </span>
                        {made && (
                          <Link to={`/practice/${made.set_id}`} className="inline-flex items-center gap-1 rounded-full bg-sun-400 px-3 py-1 text-sm font-bold text-grape-900 shadow-press">
                            Practise <ArrowRight weight="bold" className="size-4" aria-hidden />
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </motion.section>
          )
        })}
      </motion.div>
    </section>
  )
}

// --- what was finished -------------------------------------------------------------

function verdictFor(percent: number): { words: string; tone: 'mint' | 'sun' | 'sky' | 'coral' } {
  if (percent >= 90) return { words: 'Brilliant!', tone: 'mint' }
  if (percent >= 70) return { words: 'Good work', tone: 'sun' }
  if (percent >= 40) return { words: 'Keep going', tone: 'sky' }
  return { words: 'Tricky one', tone: 'coral' }
}

const WHERE: Record<HistoryRow['purpose'], string> = { assign: 'From school', practice: 'Practice', family: 'From home' }

function whenGroup(iso: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1 && new Date(iso).toDateString() === now.toDateString()) return 'Today'
  if (days < 7) return 'This week'
  return 'Earlier'
}

function Finished({ rows, name, hrefFor }: { rows: HistoryRow[]; name?: string; hrefFor: (row: HistoryRow) => string }) {
  if (rows.length === 0) return null
  const groups = new Map<string, HistoryRow[]>()
  for (const row of rows) {
    const key = whenGroup(row.completed_at)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{name ? `What ${name} finished` : "What you've finished"}</h2>
      <p className="mt-1 text-muted-foreground">Open any of them to see each answer, and why.</p>
      <div className="mt-4 space-y-6">
        {[...groups.entries()].map(([when, list]) => (
          <div key={when}>
            <h3 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{when}</h3>
            <motion.ul className="mt-2 space-y-2" variants={stagger(0.04)} initial="hidden" animate="shown">
              {list.map((row) => {
                const look = lookOfKind(row.kind)
                const stars = starsFor(row.percent)
                const verdict = verdictFor(row.percent)
                return (
                  <motion.li key={row.attempt_id} variants={rise}>
                    <Link to={hrefFor(row)} className="group flex flex-wrap items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 transition-colors hover:border-hover-border">
                      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', look.hero)}>
                        <look.Icon weight="fill" className="size-6" aria-hidden />
                      </span>
                      <span className="min-w-[min(100%,12rem)] flex-1">
                        <span className="block break-words font-bold leading-snug">{row.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {WHERE[row.purpose]} · {row.score} of {row.max_score} right · {timeAgo(row.completed_at)}
                        </span>
                      </span>
                      <Chip tone={verdict.tone}>{verdict.words}</Chip>
                      <span className="flex" aria-label={`${stars} of 3 stars`}>
                        {[0, 1, 2].map((i) => (
                          <Star key={i} weight="fill" className={cn('size-5', i < stars ? 'text-star' : 'text-foreground/10')} />
                        ))}
                      </span>
                      <ArrowRight weight="bold" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </motion.li>
                )
              })}
            </motion.ul>
          </div>
        ))}
      </div>
    </section>
  )
}
