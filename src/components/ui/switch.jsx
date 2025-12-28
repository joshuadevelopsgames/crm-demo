import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { useDeviceDetection } from "@/hooks/useDeviceDetection"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, ...props }, ref) => {
  const { isMobile, isPWA, isNativeApp } = useDeviceDetection();
  const isMobileDevice = isMobile || isPWA || isNativeApp;
  
  if (isMobileDevice) {
    // Slim horizontal cylinder style: 16px height, 48px width, 14px thumb for perfect pill shape
    return (
      <SwitchPrimitives.Root
        className={cn(
          "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300 dark:data-[state=checked]:bg-emerald-600 dark:data-[state=unchecked]:bg-slate-600 touch-manipulation",
          className
        )}
        style={{
          height: '16px',
          width: '48px',
          borderRadius: '8px', // Half of height for perfect cylinder
          padding: '1px'
        }}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[33px] data-[state=unchecked]:translate-x-[1px]"
          )}
          style={{
            width: '14px',
            height: '14px'
          }}
        />
      </SwitchPrimitives.Root>
    );
  }
  
  // Desktop: slim switch
  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-slate-900 data-[state=unchecked]:bg-slate-200 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950 dark:data-[state=checked]:bg-slate-50 dark:data-[state=unchecked]:bg-slate-800",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-3 w-3 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0 dark:bg-slate-950"
        )}
      />
    </SwitchPrimitives.Root>
  );
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }



















