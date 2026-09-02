import { describe, it, expect } from 'vitest';
import { liveViewerReducer } from '../src/hooks/useLiveViewer';

describe('liveViewerReducer', () => {
  it('idle -> start -> requesting', () => {
    expect(liveViewerReducer('idle', { type: 'start' })).toBe('requesting');
  });
  it('requesting -> offer -> connecting -> connected -> live', () => {
    expect(liveViewerReducer('requesting', { type: 'offer' })).toBe('connecting');
    expect(liveViewerReducer('connecting', { type: 'connected' })).toBe('live');
  });
  it('requesting -> busy', () => {
    expect(liveViewerReducer('requesting', { type: 'busy' })).toBe('busy');
  });
  it('requesting -> timeout -> error', () => {
    expect(liveViewerReducer('requesting', { type: 'timeout' })).toBe('error');
  });
  it('qualquer -> stop -> idle', () => {
    expect(liveViewerReducer('live', { type: 'stop' })).toBe('idle');
    expect(liveViewerReducer('error', { type: 'stop' })).toBe('idle');
  });
  it('ignora offer fora de requesting', () => {
    expect(liveViewerReducer('idle', { type: 'offer' })).toBe('idle');
  });
});
