import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// Faden buttons: always round (999). Primary is black, "highlight" (lime)
// only for the single most important action on a screen. Default height
// 44 px, the minimum touch target size.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        highlight: "bg-highlight text-highlight-foreground hover:bg-highlight/85",
        outline:
          "border-border bg-card text-foreground hover:bg-tile aria-expanded:bg-tile",
        secondary: "bg-tile text-foreground hover:bg-border aria-expanded:bg-border",
        ghost: "text-foreground hover:bg-tile aria-expanded:bg-tile",
        destructive:
          "bg-error text-error-foreground hover:bg-error/80 focus-visible:ring-destructive/30",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-[18px]",
        sm: "h-9 gap-1.5 px-3.5 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        icon: "size-11",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-4",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
