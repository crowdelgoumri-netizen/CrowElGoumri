/**
 * useIsOffline — NetInfo hook with reconnect event emitter.
 *
 * Returns `{ isOffline, isConnected }`. On transition from disconnected
 * → connected, calls emitReconnect() so the mutation queue flushes.
 */
import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { emitReconnect, setIsOffline } from "../lib/network";

interface UseIsOfflineResult {
  isOffline: boolean;
  isConnected: boolean | null;
}

export function useIsOffline(): UseIsOfflineResult {
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((s) => {
      const wasOffline = setIsOffline(!s.isConnected);
      if (wasOffline && s.isConnected) {
        emitReconnect();
      }
      setState(s);
    });
  }, []);

  return {
    isOffline: state ? !state.isConnected : true,
    isConnected: state?.isConnected ?? null,
  };
}
