import { useEffect } from 'react';
import { sseEventBus } from '@/services/sseEventBus';

type EventNameOrTag = string;

/**
 * Custom Hook to easily subscribe to SSE events or module invalidate tags in mobile screens.
 * 
 * @param events - Single event/tag or array of events/tags to listen for (e.g. 'quotation_updated' or ['invalidate_Quotations', 'invalidate_Opportunities'])
 * @param callback - Function to trigger when any of the specified events arrive (e.g. fetchData or loadData)
 * 
 * @example
 * // Listen to specific events:
 * useSSERefresh(['quotation_created', 'quotation_updated', 'quotation_approved'], fetchData);
 * 
 * // Or listen to module invalidate tags:
 * useSSERefresh(['invalidate_Quotations', 'invalidate_Opportunities'], loadData);
 */
export const useSSERefresh = (
  events: EventNameOrTag | EventNameOrTag[],
  callback: (payload?: any) => void
) => {
  useEffect(() => {
    if (!events || (Array.isArray(events) && events.length === 0)) return;

    const eventList = Array.isArray(events) ? events : [events];
    const unsubscribers: Array<() => void> = [];

    eventList.forEach((eventName) => {
      const unsub = sseEventBus.on(eventName, (data) => {
        callback(data);
      });
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [Array.isArray(events) ? events.join(',') : events, callback]);
};
