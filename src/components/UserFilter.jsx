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

    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width
    });
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
        className="w-48 justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[99999] min-w-[var(--dropdown-width)] max-h-[60vh] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            '--dropdown-width': `${position.width}px`
          }}
        >
          <div className="p-2">
            <div className="flex items-center justify-between mb-2 pb-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-7 text-xs"
              >
                {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
              </Button>
              {selectedUsers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {users.map((user) => {
                const isSelected = selectedUsers.includes(user.name);
                return (
                  <div
                    key={user.name}
                    className="flex items-center gap-2 p-2 rounded-sm hover:bg-accent cursor-pointer"
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
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

