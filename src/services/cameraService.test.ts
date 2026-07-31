import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cameraService, CAMERA_START_TIMEOUT_MS } from './cameraService';

type GetUserMediaMock = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

function setGetUserMedia(mock: GetUserMediaMock) {
  const mediaDevices: any = navigator.mediaDevices ?? {};
  mediaDevices.getUserMedia = mock;
  Object.defineProperty(navigator, 'mediaDevices', {
    value: mediaDevices,
    writable: true,
    configurable: true,
  });
}

function createFakeStream(): MediaStream {
  return { getTracks: () => [] } as unknown as MediaStream;
}

describe('cameraService.startCamera', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cameraService.stopCamera();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects with CAMERA_TIMEOUT when getUserMedia never resolves', async () => {
    setGetUserMedia(() => new Promise(() => {}));
    const video = document.createElement('video');

    const promise = cameraService.startCamera(video);
    const assertion = expect(promise).rejects.toThrow('CAMERA_TIMEOUT');

    await vi.advanceTimersByTimeAsync(CAMERA_START_TIMEOUT_MS + 1);
    await assertion;
  });

  it('rejects with CAMERA_TIMEOUT when loadedmetadata never fires', async () => {
    setGetUserMedia(() => Promise.resolve(createFakeStream()));
    const video = document.createElement('video');

    const promise = cameraService.startCamera(video);
    const assertion = expect(promise).rejects.toThrow('CAMERA_TIMEOUT');

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(CAMERA_START_TIMEOUT_MS + 1);
    await assertion;
  });

  it('resolves with the stream and starts playback once metadata loads', async () => {
    const stream = createFakeStream();
    setGetUserMedia(() => Promise.resolve(stream));
    const play = vi.fn();
    const video = document.createElement('video');
    video.play = play;

    const promise = cameraService.startCamera(video);
    await vi.advanceTimersByTimeAsync(0);

    video.onloadedmetadata?.(new Event('loadedmetadata'));
    await expect(promise).resolves.toBe(stream);
    expect(play).toHaveBeenCalled();
  });

  it('maps NotAllowedError to PERMISSION_DENIED', async () => {
    const err = new Error('permission blocked');
    err.name = 'NotAllowedError';
    setGetUserMedia(() => Promise.reject(err));

    const video = document.createElement('video');
    await expect(cameraService.startCamera(video)).rejects.toThrow('PERMISSION_DENIED');
  });
});
