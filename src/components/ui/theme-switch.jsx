import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { useDeviceDetection } from "@/hooks/useDeviceDetection"
import { useTheme } from "@/contexts/ThemeContext"
import { cn } from "@/lib/utils"

// Material-UI style switch for theme toggle on mobile
export const ThemeSwitch = React.forwardRef(({ className, checked, onCheckedChange, ...props }, ref) => {
  const { isMobile, isPWA, isNativeApp } = useDeviceDetection();
  const { isDarkMode } = useTheme();
  const isMobileDevice = isMobile || isPWA || isNativeApp;

  // Sun icon SVG (for light mode)
  const sunIcon = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent('#fff')}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>`;

  // Moon icon SVG (for dark mode)
  const moonIcon = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent('#fff')}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>`;

  if (isMobileDevice) {
    // Material-UI style for mobile - exact specifications
    return (
      <SwitchPrimitives.Root
        ref={ref}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative inline-flex h-[34px] w-[62px] shrink-0 cursor-pointer items-center rounded-full border-0 p-[7px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
          checked 
            ? "bg-[#8796A5]" 
            : "bg-[#aab4be]",
          className
        )}
        style={{
          borderRadius: '20px'
        }}
        {...props}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            "pointer-events-none relative block h-8 w-8 rounded-full shadow-lg ring-0 transition-transform"
          )}
          style={{
            backgroundImage: checked ? `url('${moonIcon}')` : `url('${sunIcon}')`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: '20px 20px',
            backgroundColor: isDarkMode ? '#003892' : '#001e3c',
            transform: checked ? 'translateX(22px)' : 'translateX(6px)'
          }}
        />
      </SwitchPrimitives.Root>
    );
  }

  // Regular switch for desktop
  return (
    <SwitchPrimitives.Root
      ref={ref}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "peer inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-slate-900 data-[state=unchecked]:bg-slate-200 dark:focus-visible:ring-slate-300 dark:focus-visible:ring-offset-slate-950 dark:data-[state=checked]:bg-slate-50 dark:data-[state=unchecked]:bg-slate-800",
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-3 w-3 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-3 data-[state=unchecked]:translate-x-0 dark:bg-slate-950"
        )}
      />
    </SwitchPrimitives.Root>
  );
});

ThemeSwitch.displayName = "ThemeSwitch";

