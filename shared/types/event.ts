export enum EventType {
  PERSON_DETECTED = 'person_detected',
  BUTTON_PRESSED = 'button_pressed',
  DELIVERY_SELECTED = 'delivery_selected',
  CALL_REQUESTED = 'call_requested',
  CALL_STARTED = 'call_started',
  CALL_ENDED = 'call_ended',
  RECORDING_STARTED = 'recording_started',
  RECORDING_FINISHED = 'recording_finished',
  NOTIFICATION_SENT = 'notification_sent',
  MOTION_DETECTED = 'motion_detected',
  PERSON_LEFT = 'person_left'
}

export enum EventStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Event {
  id: number;
  type: EventType;
  status: EventStatus;
  metadata?: Record<string, any>;
  created_at: string;
  ended_at?: string;
}

export interface CreateEventDTO {
  type: EventType;
  metadata?: Record<string, any>;
}

export interface UpdateEventDTO {
  status?: EventStatus;
  ended_at?: string;
  metadata?: Record<string, any>;
}
