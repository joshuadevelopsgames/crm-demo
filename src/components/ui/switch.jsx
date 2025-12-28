import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { useDeviceDetection } from "@/hooks/useDeviceDetection"
import { useTheme } from "@/contexts/ThemeContext"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ className, ...props }, ref) => {
  const { isMobile, isPWA, isNativeApp } = useDeviceDetection();
  const { isDarkMode } = useTheme();
  const isMobileDevice = isMobile || isPWA || isNativeApp;
  
  // Also check window width as fallback for SSR/hydration issues
  const [isMobileWindow, setIsMobileWindow] = React.useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => setIsMobileWindow(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const shouldUseMobileStyle = isMobileDevice || isMobileWindow;
  
  if (shouldUseMobileStyle) {
    // Ant Design style switch: 28px width, 16px height, 12px thumb
    return (
      <SwitchPrimitives.Root
        className={cn(
          "peer inline-flex shrink-0 cursor-pointer items-center border-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
          "h-[16px] w-[28px] rounded-[8px] p-[2px]",
          // Unchecked: rgba(0,0,0,.25) or rgba(255,255,255,.35) in dark
          "data-[state=unchecked]:bg-[rgba(0,0,0,0.25)] dark:data-[state=unchecked]:bg-[rgba(255,255,255,0.35)]",
          // Checked: #1890ff or #177ddc in dark
          "data-[state=checked]:bg-[#1890ff] dark:data-[state=checked]:bg-[#177ddc]",
          className
        )}
        {...props}
        ref={ref}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "pointer-events-none block bg-white ring-0 transition-all duration-200 relative",
            "w-[12px] h-[12px] rounded-[6px]",
            "shadow-[0_2px_4px_0_rgb(0_35_11_/_20%)]",
            "data-[state=unchecked]:translate-x-0",
            "data-[state=checked]:translate-x-[12px]"
          )}
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



















