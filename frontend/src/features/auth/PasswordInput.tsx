import { forwardRef, useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { Input } from '@/components/ui'

/** A password field with a show/hide eye — kinder than typing blind. */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput(props, ref) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} {...props} type={shown ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-hover hover:text-foreground"
      >
        {shown ? <EyeSlash weight="bold" className="size-5" /> : <Eye weight="bold" className="size-5" />}
      </button>
    </div>
  )
})
