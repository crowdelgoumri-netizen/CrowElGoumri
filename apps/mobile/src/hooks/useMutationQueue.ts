/**
 * useMutationQueue — React hook that flushes the queue on reconnect.
 *
 * Subscribes to the reconnect event emitter and calls flushQueue().
 * Exposes { pendingCount, isFlushing } for the OfflineBanner.
 */
import { useEffect, useState } from "react";
import { subscribeReconnect } from "../lib/network";
import {
  flushQueue,
  getPendingCount,
  getIsFlushing,
  subscribeCount,
} from "../lib/mutation-queue";
import { queueSize } from "../lib/mutation-queue";

export function useMutationQueue() {
  const [pendingCount, setPendingCount] = useState(getPendingCount);
  const [isFlushing, setIsFlushing] = useState(getIsFlushing);

  useEffect(() => {
    // Seed count from AsyncStorage on mount.
    queueSize().then((n) => setPendingCount(n));

    const unsubCount = subscribeCount(() => {
      setPendingCount(getPendingCount());
      setIsFlushing(getIsFlushing());
    });

    const unsubReconnect = subscribeReconnect(() => {
      flushQueue();
    });

    return () => {
      unsubCount();
      unsubReconnect();
    };
  }, []);

  return { pendingCount, isFlushing };
}
