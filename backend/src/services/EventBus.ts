import { EventType } from '@shared/types/event';
import { logger } from '../utils/logger';

type EventHandler = (data: any) => void;

export class EventBus {
  private static instance: EventBus;
  private handlers: Map<EventType, EventHandler[]>;

  private constructor() {
    this.handlers = new Map();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on(eventType: EventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    logger.info(`Event handler registered for: ${eventType}`);
  }

  public emit(eventType: EventType, data: any): void {
    logger.info(`Event emitted: ${eventType}`, data);
    
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  public off(eventType: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  public clear(): void {
    this.handlers.clear();
  }
}
