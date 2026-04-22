import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold tracking-[0.01em] transition-[transform,background-color,color,border-color,box-shadow,opacity] duration-200 disabled:pointer-events-none disabled:opacity-45 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none active:translate-y-px focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[4px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(20,20,20,0.10),0_6px_14px_rgba(20,20,20,0.10)] hover:bg-primary/92 hover:shadow-[0_1px_2px_rgba(20,20,20,0.10),0_8px_16px_rgba(20,20,20,0.12)]",
        destructive:
          "border border-transparent bg-destructive text-white shadow-[0_1px_2px_rgba(127,29,29,0.2),0_8px_18px_rgba(127,29,29,0.18)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-border/90 bg-card text-foreground shadow-[0_1px_2px_rgba(20,20,20,0.05)] hover:border-border hover:bg-accent/75 hover:text-accent-foreground hover:shadow-[0_4px_10px_rgba(20,20,20,0.06)] dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)] hover:bg-secondary/80",
        ghost:
          "text-foreground/80 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "rounded-md text-primary underline-offset-4 shadow-none hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 px-3 gap-1.5 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
