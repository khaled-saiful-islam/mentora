/**
 * A study guide as the class will see it — every part in one scroll — and,
 * from the same page, a handout: Print lays it out on paper with the checks
 * as questions and an answer key at the end.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeSlash, Printer } from '@phosphor-icons/react'
import { Alert, Button, Skeleton } from '@/components/ui'
import { learningApi, type GuideSection, type ReadingLevel } from '@/features/learning/api'
import { OPTION_LOOKS } from '@/features/learning/options'
import { useResource } from '@/hooks/useResource'
import { cn } from '@/lib/utils'
import { GuideCover } from './GuideCover'
import { GuideEnd, glossaryOf } from './GuideEnd'
import { rememberedLevel } from './level'
import { LevelSwitch } from './LevelSwitch'
import { SectionBody } from './SectionBody'
import { translationLabel } from './text'
import { useReadAloud } from './useReadAloud'

export default function GuidePreviewPage() {
  const { setId = '' } = useParams()
  const loaded = useResource(`set:${setId}`, () => learningApi.get(setId))
  const [level, setLevel] = useState<ReadingLevel>(rememberedLevel)
  const [answers, setAnswers] = useState(false)
  const voice = useReadAloud(loaded.data?.language ?? 'en')

  if (loaded.error) return <div className="mx-auto max-w-3xl p-6"><Alert>{loaded.error}</Alert></div>
  const set = loaded.data
  if (!set) return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-72 rounded-[2rem]" /></div>
  const sections = set.items as GuideSection[]
  const label = translationLabel(set.language)
  const jump = (i: number) => document.getElementById(`part-${i + 1}`)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-dvh bg-background print:bg-white">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to={`/library/${set.id}`} className="inline-flex items-center gap-1.5 font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft weight="bold" className="size-4" /> Back to editing
          </Link>
          <span className="ml-auto" />
          <LevelSwitch value={level} onChange={setLevel} />
          <Button variant="outline" size="sm" onClick={() => setAnswers((a) => !a)} aria-pressed={answers}>
            {answers ? <EyeSlash weight="bold" className="size-4" /> : <Eye weight="bold" className="size-4" />}
            {answers ? 'Hide answers' : 'Show answers'}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer weight="bold" className="size-4" /> Print handout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <GuideCover
          title={set.title}
          extras={set.extras}
          sections={sections}
          level={level}
          onLevel={setLevel}
          onStart={() => jump(0)}
          onJump={jump}
          meta={[set.grade_label, set.subject].filter((m): m is string => Boolean(m))}
        />

        {sections.map((section, i) => (
          <section key={section.id} id={`part-${i + 1}`} className="mt-12 scroll-mt-20 print:mt-0 print:break-before-page">
            <SectionBody
              section={section}
              number={i + 1}
              total={sections.length}
              skill={set.skills.find((s) => s.slug === section.skill)?.label}
              level={level}
              onLevel={setLevel}
              voice={voice}
              translationLabel={label}
              still
            />
            <CheckQuestion section={section} showAnswer={answers} />
          </section>
        ))}

        <div className="mt-14 print:break-before-page">
          <GuideEnd extras={set.extras} glossary={glossaryOf(sections)} translationLabel={label} />
        </div>

        <AnswerKey sections={sections} />
      </main>
    </div>
  )
}

/** The check as a question to answer on paper, with the answer if asked. */
function CheckQuestion({ section, showAnswer }: { section: GuideSection; showAnswer: boolean }) {
  return (
    <div className="mt-8 rounded-[2rem] border-2 border-kind-study-guide-vivid/40 p-5 print:break-inside-avoid">
      <p className="text-sm font-bold uppercase tracking-wider text-kind-study-guide">Check yourself</p>
      <p className="mt-2 font-display text-xl font-bold">{section.prompt}</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 print:grid-cols-2">
        {section.options.map((option, i) => {
          const right = showAnswer && i === section.answer
          return (
            <li key={i} className={cn('flex items-center gap-2 rounded-2xl border-2 p-2 font-semibold', right ? 'border-correct bg-correct-soft' : 'border-border')}>
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg text-sm font-bold', OPTION_LOOKS[i].tile)}>{OPTION_LOOKS[i].letter}</span>
              <span className="flex-1">{option}</span>
              {right && <Check weight="bold" className="size-5 text-correct" aria-label="The answer" />}
            </li>
          )
        })}
      </ol>
      {showAnswer && section.explanation && <p className="mt-3 text-sm text-muted-foreground">{section.explanation}</p>}
    </div>
  )
}

/** For the teacher's copy: printed last, on its own page. */
function AnswerKey({ sections }: { sections: GuideSection[] }) {
  return (
    <section className="hidden print:block print:break-before-page">
      <h2 className="font-display text-2xl font-bold">Answer key</h2>
      <ol className="mt-4 space-y-2">
        {sections.map((s, i) => (
          <li key={s.id}>
            <b>Part {i + 1}:</b> {OPTION_LOOKS[s.answer]?.letter} — {s.options[s.answer]}
            {s.explanation && <span className="text-muted-foreground"> · {s.explanation}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
