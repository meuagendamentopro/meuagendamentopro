import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      onOpenAutoFocus={(e) => {
        // Importante: Reseta o scroll horizontal quando o popover abre
        window.scrollTo(0, window.scrollY);
        e.preventDefault();
      }}
      style={{ 
        position: 'fixed', 
        maxWidth: 'calc(100vw - 2rem)',
        width: '100%',
        margin: 'auto',
        zIndex: 9999,
        // Centralizar no meio da tela, independente da rolagem
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }}
      className={cn(
        "z-[9999] w-full max-w-[300px] rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin] sm:w-72 sm:p-4 overflow-y-auto max-h-[70vh]",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
