import {Slot} from '@radix-ui/react-slot'
import {cva} from 'class-variance-authority'
import {clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'
import type {ComponentProps} from 'react'
const variants=cva('button',{variants:{variant:{default:'button-primary',outline:'button-outline',ghost:'button-ghost'}},defaultVariants:{variant:'default'}})
export function Button({className,variant,asChild=false,...props}:ComponentProps<'button'>&{variant?:'default'|'outline'|'ghost';asChild?:boolean}) {
  const Component=asChild?Slot:'button'
  return <Component className={twMerge(clsx(variants({variant}),className))} {...props}/>
}
