import { EyeSlash, ShieldWarning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { GuardAlert } from '@/hooks/useChat'

const SOURCE_LABELS: Record<string, string> = {
  user_input: 'your message',
  web_search: 'a search result',
  document: 'a document',
}

const RULE_LABELS: Record<string, string> = {
  instruction_override: 'tried to override the assistant’s instructions',
  instruction_reset: 'tried to reset the assistant’s instructions',
  role_hijack: 'tried to change the assistant’s role',
  system_prompt_exfiltration: 'asked for the system prompt',
  fake_delimiters: 'contained fake chat-template markers',
  invisible_characters: 'contained hidden characters',
  opaque_blob: 'contained a long encoded blob',
}

/**
 * Shown when a check acted on this turn.
 *
 * Says what was found, where it came from, and quotes the evidence — a check
 * that silently alters what the model sees is indistinguishable from a bug,
 * and a warning nobody can check is one people learn to dismiss. Personal
 * details taken out of a student's message get a friendlier note of their
 * own: it is advice for a child, not a security finding.
 */
export function GuardBanner({ alerts }: { alerts: GuardAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="mb-3 space-y-2">
      {alerts.map((alert, index) =>
        alert.rules.includes('personal_info') ? (
          <p
            key={`${alert.source}-${index}`}
            role="status"
            className="flex items-start gap-2 rounded-2xl bg-sky-100 px-4 py-2.5 text-sm font-semibold text-sky-700 dark:bg-sky-700/30 dark:text-sky-100"
          >
            <EyeSlash weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
            {alert.evidence}
          </p>
        ) : (
          <Injection key={`${alert.source}-${index}`} alert={alert} />
        ),
      )}
    </div>
  )
}

function Injection({ alert }: { alert: GuardAlert }) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-2xl border px-4 py-2.5 text-xs',
        alert.severity === 'high'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-warning/30 bg-warning/10 text-warning',
      )}
    >
      <p className="flex items-start gap-1.5 font-bold">
        <ShieldWarning weight="bold" className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          Prompt-injection guard: {SOURCE_LABELS[alert.source] ?? alert.source}{' '}
          {alert.rules.map((r) => RULE_LABELS[r] ?? r).join(', ')}.
        </span>
      </p>
      {alert.evidence && <p className="mt-1 pl-5 font-mono opacity-80">“{alert.evidence}”</p>}
      <p className="mt-1 pl-5 opacity-80">
        {alert.source === 'user_input'
          ? 'Your message was sent unchanged — this is only a notice.'
          : 'That text was marked as data, not instructions, before the model saw it.'}
      </p>
    </div>
  )
}
