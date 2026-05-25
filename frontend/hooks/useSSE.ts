import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { onSSEEvent } from '../services/sseClient';

export function useSSEEvent(event: string, callback: (data: any) => void): void {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return onSSEEvent(event, (data) => cbRef.current(data));
  }, [event]);
}
