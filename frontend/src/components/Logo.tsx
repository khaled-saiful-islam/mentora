import { LogoMark } from '@/brand/Logo'

/**
 * The brand mark, under the name older screens import. New code imports from
 * `@/brand/Logo` directly.
 */
export function Logo({ className, accent = true }: { className?: string; accent?: boolean }) {
  return <LogoMark className={className} accent={accent} />
}
