import { EventBus } from './EventBus';
import { EventType } from '@shared/types/event';
import { logger } from '../utils/logger';

export class EventService {
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Log all events
    Object.values(EventType).forEach(type => {
      this.eventBus.on(type, (data) => {
        logger.info(`Event occurred: ${type}`, data);
      });
    });

    // Future: Add specific handlers for different event types
    // Example:
    // this.eventBus.on(EventType.PERSON_DETECTED, this.handlePersonDetected.bind(this));
  }

  public emitEvent(type: EventType, data: any): void {
    this.eventBus.emit(type, data);
  }

  // Example handler (will be implemented in Phase 2)
  private handlePersonDetected(data: any): void {
    logger.info('Person detected, starting recording...', data);
    // Future: Trigger camera recording
  }
}
