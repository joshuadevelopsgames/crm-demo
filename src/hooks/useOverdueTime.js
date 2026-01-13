import { useState, useEffect } from 'react';
import { differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { parseCalgaryDate } from '@/utils/timezone';

/**
 * Hook to calculate and format overdue time dynamically
 * Updates every minute to show current overdue time
 * @param {string} dueDateString - Task due date in YYYY-MM-DD format
 * @returns {string} Formatted overdue time (e.g., "5 seconds", "3 minutes", "2 hours", "5 days")
 */
export function useOverdueTime(dueDateString) {
  const [overdueTime, setOverdueTime] = useState('');

  useEffect(() => {
    if (!dueDateString) {
      setOverdueTime('');
      return;
    }

    const calculateOverdueTime = () => {
      const dueDate = parseCalgaryDate(dueDateString);
      const now = new Date();

      if (!dueDate) {
        setOverdueTime('');
        return;
      }

      // Calculate differences in various units
      const secondsDiff = differenceInSeconds(now, dueDate);
      const minutesDiff = differenceInMinutes(now, dueDate);
      const hoursDiff = differenceInHours(now, dueDate);
      const daysDiff = differenceInDays(now, dueDate);

      // Return the most appropriate unit
      if (secondsDiff < 60) {
        setOverdueTime(`${secondsDiff} second${secondsDiff !== 1 ? 's' : ''}`);
      } else if (minutesDiff < 60) {
        setOverdueTime(`${minutesDiff} minute${minutesDiff !== 1 ? 's' : ''}`);
      } else if (hoursDiff < 24) {
        setOverdueTime(`${hoursDiff} hour${hoursDiff !== 1 ? 's' : ''}`);
      } else {
        setOverdueTime(`${daysDiff} day${daysDiff !== 1 ? 's' : ''}`);
      }
    };

    // Calculate immediately
    calculateOverdueTime();

    // Update every minute (60000ms)
    const interval = setInterval(calculateOverdueTime, 60000);

    return () => clearInterval(interval);
  }, [dueDateString]);

  return overdueTime;
}
