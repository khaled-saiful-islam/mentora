import { forwardRef, useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Told when the password is shown or hidden again. */
  onShownChange?: (shown: boolean) => void
}

/** A password field with a show/hide eye — kinder than typing blind. */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { onShownChange, className, ...props },
  ref,
) {
  const [shown, setShown] = useState(false)

  function toggle() {
    const next = !shown
    setShown(next)
    onShownChange?.(next)
  }

  return (
    <div className="relative">
      <Input ref={ref} {...props} type={shown ? 'text' : 'password'} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={toggle}
        // Pressing the eye keeps the typing where it was, rather than taking
        // focus off the field mid-word.
        onMouseDown={(event) => event.preventDefault()}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
      >
        {shown ? <EyeSlash weight="bold" className="size-5" /> : <Eye weight="bold" className="size-5" />}
      </button>
    </div>
  )
})
