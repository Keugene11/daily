import { useState, useCallback } from 'react';
import { StreamEvent, PlanState } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

export const usePlanStream = () => {
  const [state, setState] = useState<PlanState>({
    isStreaming: false,
    activeToolCalls: [],
    content: '',
    thinking: [],
    error: null,
    toolResults: {},
    connected: false
  });

  const startStream = useCallback(async (city: string, interests: string[], budget?: string, extras?: {
    mood?: string;
    currentHour?: number;
    energyLevel?: 'low' | 'medium' | 'high';
    dietary?: string[];
    accessible?: boolean;
    dateNight?: boolean;
    antiRoutine?: boolean;
    pastPlaces?: string[];
    recurring?: boolean;
    rightNow?: boolean;
    days?: number;
  }, getAccessToken?: () => Promise<string | null>) => {
    // Reset state
    setState({
      isStreaming: true,
      activeToolCalls: [],
      content: '',
      thinking: [],
      error: null,
      toolResults: {},
      connected: false
    });

    try {
      const token = getAccessToken ? await getAccessToken() : null;

      const response = await fetch(`${API_URL}/api/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ city, interests, budget, ...extras })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('[SSE] Stream ended by server');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData: StreamEvent = JSON.parse(line.slice(6));
                handleEvent(eventData, setState);
              } catch (parseError) {
                console.error('[SSE] Failed to parse event:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('[SSE] Stream error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect to server',
        isStreaming: false
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      activeToolCalls: [],
      content: '',
      thinking: [],
      error: null,
      toolResults: {},
      connected: false
    });
  }, []);

  return { state, startStream, reset };
};

function handleEvent(event: StreamEvent, setState: React.Dispatch<React.SetStateAction<PlanState>>) {
  console.log('[SSE Event]', event.type, event);

  switch (event.type) {
    case 'connected':
      setState(prev => ({ ...prev, connected: true }));
      break;

    case 'thinking_chunk':
      if (event.thinking) {
        setState(prev => ({
          ...prev,
          thinking: [...prev.thinking, event.thinking!]
        }));
      }
      break;

    case 'tool_call_start':
      if (event.tool) {
        setState(prev => ({
          ...prev,
          activeToolCalls: [...prev.activeToolCalls, event.tool!]
        }));
      }
      break;

    case 'tool_call_result':
      if (event.tool && event.result) {
        setState(prev => ({
          ...prev,
          activeToolCalls: prev.activeToolCalls.filter(t => t !== event.tool),
          toolResults: {
            ...prev.toolResults,
            [event.tool!]: event.result!
          }
        }));
      }
      break;

    case 'content_chunk':
      if (event.content) {
        setState(prev => ({
          ...prev,
          content: prev.content + event.content
        }));
      }
      break;

    case 'error':
      setState(prev => ({
        ...prev,
        error: event.error || 'Unknown error occurred',
        isStreaming: false
      }));
      break;

    case 'done':
      setState(prev => ({
        ...prev,
        isStreaming: false
      }));
      break;
  }
}
