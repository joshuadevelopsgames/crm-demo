import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Simple dropdown component without complex positioning
 * Positions relative to trigger, no Floating UI, simple vertical animation
 */
export function SimpleDropdown({ 
  trigger, 
  children, 
  className,
  align = "start" // 'start' | 'end' | 'center'
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef(null)
  const dropdownRef = React.useRef(null)

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Close on escape
  React.useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  // Calculate position
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 })
  
  React.useEffect(() => {
    if (!isOpen || !triggerRef.current || !dropdownRef.current) return

    // Use requestAnimationFrame to ensure dropdown is fully rendered and measured
    const updatePosition = () => {
      if (!triggerRef.current || !dropdownRef.current) return

      const triggerRect = triggerRef.current.getBoundingClientRect()
      const dropdownRect = dropdownRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const padding = 8 // Minimum padding from screen edges
      
      let left = triggerRect.left
      
      if (align === "end") {
        left = triggerRect.right - dropdownRect.width
      } else if (align === "center") {
        left = triggerRect.left + (triggerRect.width - dropdownRect.width) / 2
      }

      // Ensure dropdown stays within viewport bounds
      // If it would go off the left edge, align to the left with padding
      if (left < padding) {
        left = padding
      }
      // If it would go off the right edge, align to the right with padding
      const dropdownWidth = dropdownRect.width || 240 // Fallback width if not measured yet
      if (left + dropdownWidth > viewportWidth - padding) {
        left = Math.max(padding, viewportWidth - dropdownWidth - padding)
      }

      setPosition({
        top: triggerRect.bottom + 4,
        left,
        width: triggerRect.width
      })
    }

    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(updatePosition)
    })
  }, [isOpen, align])

  // Clone trigger and add click handler
  const triggerWithClick = React.cloneElement(trigger, {
    ref: triggerRef,
    onClick: (e) => {
      e.stopPropagation(); // Prevent card click
      setIsOpen(!isOpen);
      // Call original onClick if it exists
      if (trigger.props.onClick) {
        trigger.props.onClick(e);
      }
    }
  });

  return (
    <div className="relative inline-block">
      {triggerWithClick}
      
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "fixed z-50 rounded-md border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 slide-in-from-top-2 duration-200",
            className
          )}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            minWidth: `${position.width}px`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function SimpleDropdownItem({ 
  children, 
  onClick, 
  className,
  ...props 
}) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

