export async function exportCanvasHighlight(
  canvas: HTMLCanvasElement,
  durationMs = 5000,
  filename = 'spectrax-replay.webm',
): Promise<void> {
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    throw new Error(
      'Video export is not supported in this browser. Try Chrome or Firefox on desktop.',
    );
  }

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = () => reject(new Error('Recording failed'));

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    };

    recorder.start(100);
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, durationMs);
  });
}
