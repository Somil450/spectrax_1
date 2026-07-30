import { describe, it, expect, vi } from 'vitest';
import { sanitizeTelemetryPayload } from '../telemetrySanitizer';
import { privacyModeService } from '../../services/privacyModeService';

describe('Client Privacy & Telemetry Sanitizer', () => {
  it('extracts non-identifying workout metrics correctly', () => {
    const rawData = {
      exercise: 'squat',
      reps: 15,
      duration: 120,
      calories: 45,
      accuracy: 95,
      timestamp: 1600000000000,
    };

    const sanitized = sanitizeTelemetryPayload(rawData);

    expect(sanitized.exerciseKey).toBe('squat');
    expect(sanitized.repCount).toBe(15);
    expect(sanitized.durationSecs).toBe(120);
    expect(sanitized.caloriesBurned).toBe(45);
    expect(sanitized.accuracyScore).toBe(95);
  });

  it('strips video frame, canvas, and base64 image data from telemetry payloads', () => {
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const unsafePayload = {
      exercise: 'pushup',
      reps: 10,
      videoFrameBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      snapshotImageData: { width: 640, height: 480 },
      canvasBlob: 'blob:http://localhost/12345',
    };

    const sanitized = sanitizeTelemetryPayload(unsafePayload);

    expect(sanitized).not.toHaveProperty('videoFrameBase64');
    expect(sanitized).not.toHaveProperty('snapshotImageData');
    expect(sanitized).not.toHaveProperty('canvasBlob');
    expect(spyWarn).toHaveBeenCalled();

    spyWarn.mockRestore();
  });

  it('switches privacy render modes in privacyModeService', () => {
    expect(privacyModeService.getMode()).toBe('full_camera');
    
    privacyModeService.setMode('skeleton_only');
    expect(privacyModeService.isSkeletonOnly()).toBe(true);
    expect(privacyModeService.shouldMaskBackground()).toBe(true);

    privacyModeService.setMode('blurred_background');
    expect(privacyModeService.isSkeletonOnly()).toBe(false);
    expect(privacyModeService.shouldMaskBackground()).toBe(true);

    privacyModeService.setMode('full_camera');
    expect(privacyModeService.shouldMaskBackground()).toBe(false);
  });
});
