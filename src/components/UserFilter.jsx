import React, { useState, useRef, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

export function UserFilter({ users, selectedUsers, onSelectionChange, placeholder = "Filter by User" }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Calculate position
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    // Calculate initial position
    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4, // Use viewport coordinates for fixed positioning
      left: rect.left,
      width: rect.width
    });

    // Close dropdown on window scroll (but not on dropdown internal scroll)
    // The dropdown's onScroll handler stops propagation, so this only fires for window scrolls
    const handleScroll = () => {
      setIsOpen(false);
    };

    // Update position on window resize
    const handleResize = () => {
      if (triggerRef.current) {
        const newRect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: newRect.bottom + 4,
          left: newRect.left,
          width: newRect.width
        });
      }
    };

    // Use passive listeners for better performance
    // Listen on window for scroll events (dropdown scrolls are stopped from bubbling)
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleToggleUser = (userName) => {
    const newSelection = selectedUsers.includes(userName)
      ? selectedUsers.filter(u => u !== userName)
      : [...selectedUsers, userName];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(users.map(u => u.name));
    }
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const displayText = selectedUsers.length === 0
    ? placeholder
    : selectedUsers.length === 1
    ? selectedUsers[0]
    : `${selectedUsers.length} users selected`;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        className={cn(
          "w-40 h-9 justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          selectedUsers.length === 0 && "text-muted-foreground"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </Button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] min-w-[var(--dropdown-width)] max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 duration-150"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            '--dropdown-width': `${position.width}px`
          }}
          onScroll={(e) => {
            // Stop scroll events from bubbling to window, preventing dropdown from closing
            e.stopPropagation();
          }}
        >
          <div className="p-1">
            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-7 text-xs px-2"
              >
                {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedUsers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs px-2"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="space-y-0.5">
              {users.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No users found. Users are extracted from estimates with salesperson or estimator fields.
                </div>
              ) : (
                users.map((user) => {
                  const isSelected = selectedUsers.includes(user.name);
                  return (
                    <div
                      key={user.name}
                      className="flex items-center gap-2 py-1.5 pl-2 pr-2 rounded-sm hover:bg-accent cursor-pointer"
                      onClick={() => handleToggleUser(user.name)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleUser(user.name)}
                      />
                      <span className="flex-1 text-sm">{user.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {user.count}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

