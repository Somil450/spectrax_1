// src/hooks/useCollaboration.ts
// Hook for joining or hosting a real-time collaborative workout session

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CollabAnnotation {
  id: string;
  socketId: string;
  text: string;
  timestamp: number;
}

export interface CollabState {
  reps?: number;
  accuracy?: number;
  exercise?: string;
  [key: string]: unknown;
}

interface UseCollaborationOptions {
  serverUrl?: string;
  onStateUpdate?: (state: CollabState) => void;
}

export function useCollaboration(options: UseCollaborationOptions = {}) {
  const serverUrl = options.serverUrl ?? (import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000');
  const socketRef = useRef<Socket | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [annotations, setAnnotations] = useState<CollabAnnotation[]>([]);
  const [remoteState, setRemoteState] = useState<CollabState>({});

  // Connect to /collab namespace
  useEffect(() => {
    const socket = io(`${serverUrl}/collab`, {
      autoConnect: false,
      transports: ['websocket'],
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('collab:created', ({ sessionId }: { sessionId: string }) => {
      setSessionId(sessionId);
    });

    socket.on('collab:state-sync', ({ annotations: existingAnnotations, state, participantCount: count }: {
      annotations: CollabAnnotation[];
      state: CollabState;
      participantCount: number;
    }) => {
      setAnnotations(existingAnnotations);
      setRemoteState(state);
      setParticipantCount(count);
    });

    socket.on('collab:state-update', ({ state }: { state: CollabState }) => {
      setRemoteState(state);
      options.onStateUpdate?.(state);
    });

    socket.on('collab:annotation-added', ({ annotation }: { annotation: CollabAnnotation }) => {
      setAnnotations(prev => [...prev, annotation]);
    });

    socket.on('collab:participant-joined', ({ participantCount: count }: { participantCount: number }) => {
      setParticipantCount(count);
    });

    socket.on('collab:participant-left', ({ participantCount: count }: { participantCount: number }) => {
      setParticipantCount(count);
    });

    socket.on('collab:error', ({ message }: { message: string }) => {
      console.error('[SpectraX Collab]', message);
    });

    socket.connect();
    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  // Create a new session (host)
  const createSession = useCallback(() => {
    socketRef.current?.emit('collab:create');
  }, []);

  // Join an existing session (viewer)
  const joinSession = useCallback((id: string) => {
    setSessionId(id);
    socketRef.current?.emit('collab:join', { sessionId: id });
  }, []);

  // Push live workout state to viewers
  const pushState = useCallback((state: CollabState) => {
    if (!sessionId) return;
    socketRef.current?.emit('collab:state-update', { sessionId, state });
  }, [sessionId]);

  // Add an annotation
  const addAnnotation = useCallback((text: string) => {
    if (!sessionId) return;
    socketRef.current?.emit('collab:annotate', { sessionId, annotation: { text } });
  }, [sessionId]);

  // Shareable URL for this session
  const shareUrl = sessionId
    ? `${window.location.origin}?collab=${sessionId}`
    : null;

  return {
    sessionId,
    isConnected,
    participantCount,
    annotations,
    remoteState,
    shareUrl,
    createSession,
    joinSession,
    pushState,
    addAnnotation,
  };
}