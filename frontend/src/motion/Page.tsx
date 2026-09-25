import { motion } from 'motion/react'
import { page } from './presets'
import { cn } from '@/lib/utils'

/**
 * A page's entrance. Children marked with a variant (`rise`, `pop`) arrive
 * in sequence after the page itself.
 */
export function Page({
  className,
  children,
  as = 'main',
}: {
  className?: string
  children: React.ReactNode
  as?: 'main' | 'div' | 'section'
}) {
  const Component = motion[as]
  return (
    <Component className={cn(className)} variants={page} initial="hidden" animate="shown" exit="gone">
      {children}
    </Component>
  )
}
