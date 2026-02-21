// Frontend type definitions

export interface StreamEvent {
  type: 'connected' | 'tool_call_start' | 'tool_call_result' | 'content_chunk' | 'thinking_chunk' | 'city_resolved' | 'done' | 'error';
  tool?: string;
  args?: any;
  result?: ToolResult;
  content?: string;
  thinking?: string;
  error?: string;
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PlanState {
  isStreaming: boolean;
  activeToolCalls: string[];
  content: string;
  thinking: string[];
  error: string | null;
  toolResults: Record<string, ToolResult>;
  connected: boolean;
  resolvedCity?: string;
}
