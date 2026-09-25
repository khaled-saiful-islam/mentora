/**
 * The primitives everything else is built from.
 *
 * Round, bold and tactile: a button has a pressable edge and sinks under a
 * finger, an input is soft and glows grape when it has focus. Every colour is
 * a token from theme.css, so restyling happens in one file.
 */

import { forwardRef } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { CircleNotch, Info, WarningCircle, XCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// --- Button -------------------------------------------------------------

type ButtonVariant = 'primary' | 'sun' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-press hover:brightness-110 active:shadow-none',
  sun: 'bg-sun-400 text-grape-900 shadow-press hover:brightness-105 active:shadow-none',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-hover',
  ghost: 'text-foreground hover:bg-hover',
  outline:
    'border-2 border-border bg-surface text-foreground hover:border-hover-border hover:bg-hover',
  danger:
    'bg-destructive text-destructive-foreground shadow-press hover:brightness-110 active:shadow-none',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-base gap-2',
  lg: 'h-14 px-7 text-lg gap-2.5',
  icon: 'size-10 p-0',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

/** A button's look, for something that is not a `<button>` — a link. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-bold',
    'transition-[transform,box-shadow,filter,background-color,border-color] duration-150',
    'active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading && <CircleNotch weight="bold" className="size-[1.1em] animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

/** Navigation that looks like a button: somewhere to go, not something to do. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

// --- Input --------------------------------------------------------------

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-12 w-full rounded-2xl border-2 border-input bg-surface px-4 text-base font-semibold',
          'placeholder:font-normal placeholder:text-muted-foreground',
          'transition-[border-color,box-shadow] duration-150',
          'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
          'aria-invalid:border-wrong aria-invalid:ring-wrong/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

// --- Label --------------------------------------------------------------

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('select-none text-sm font-bold text-foreground/85', className)}
      {...props}
    />
  )
}

// --- Field --------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: React.ReactNode
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : (
        hint && <div className="text-sm text-muted-foreground">{hint}</div>
      )}
    </div>
  )
}

// --- Alert --------------------------------------------------------------

const ALERT_TONES = {
  error: { box: 'border-destructive/25 bg-destructive/10 text-destructive', Icon: XCircle },
  warning: { box: 'border-warning/30 bg-warning/10 text-warning', Icon: WarningCircle },
  info: { box: 'border-border bg-muted text-muted-foreground', Icon: Info },
} as const

export function Alert({
  tone = 'error',
  children,
  className,
}: {
  tone?: keyof typeof ALERT_TONES
  children: React.ReactNode
  className?: string
}) {
  const { box, Icon } = ALERT_TONES[tone]
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-2xl border-2 px-4 py-3 text-sm font-semibold',
        box,
        className,
      )}
    >
      <Icon weight="fill" className="mt-0.5 size-[1.15em] shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// --- Card ---------------------------------------------------------------

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[1.5rem] border border-border bg-surface shadow', className)}
      {...props}
    />
  )
}

// --- Spinner ------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return (
    <CircleNotch
      weight="bold"
      className={cn('size-5 animate-spin text-primary', className)}
      aria-hidden
    />
  )
}

// --- Chip ---------------------------------------------------------------

export function Chip({
  className,
  tone = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'grape' | 'sun' | 'mint' | 'coral' | 'sky'
}) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    grape: 'bg-grape-100 text-grape-800 dark:bg-grape-800/40 dark:text-grape-200',
    sun: 'bg-sun-100 text-sun-600 dark:bg-sun-600/25 dark:text-sun-300',
    mint: 'bg-mint-100 text-mint-700 dark:bg-mint-700/30 dark:text-mint-100',
    coral: 'bg-coral-100 text-coral-700 dark:bg-coral-700/30 dark:text-coral-100',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-700/30 dark:text-sky-100',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

// --- Skeleton -----------------------------------------------------------

/** A shimmering placeholder in the shape of what is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-xl', className)} />
}
