"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

import { cn } from "@/lib/utils"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ className, ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

// Bridges Base UI's own panel-height variable (--collapsible-panel-height)
// into the var name tw-animate-css's collapsible-down/up keyframes actually
// read — that stylesheet's fallback chain was written for Radix/Bits/Reka/
// Kobalte (--radix-collapsible-content-height etc.), which Base UI doesn't
// set. Without this bridge those keyframes never match a var, fall through
// to "auto", and the panel snaps open/closed instead of animating to its
// measured height.
function CollapsiblePanel({ className, style, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-panel"
      style={{
        ["--radix-collapsible-content-height" as string]: "var(--collapsible-panel-height)",
        ...style,
      }}
      className={cn(
        "overflow-hidden data-open:animate-collapsible-down data-closed:animate-collapsible-up",
        className,
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsiblePanel }
