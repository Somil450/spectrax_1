import { pipeline, env } from '@xenova/transformers';

// Skip local model check (fetch from Hugging Face)
env.allowLocalModels = false;

const PIPELINE_TYPE = 'zero-shot-image-classification';
const MODEL_ID = 'Xenova/clip-vit-base-patch32';

let classifier: any = null;
let currentQuantizedState: boolean | null = null;

export interface AnalyzeMessage {
  type: 'analyze';
  image: ImageBitmap;
  labels: string[];
  frameId?: number;
}

export interface InitMessage {
  type: 'init';
  quantized?: boolean;
}

type WorkerMessage = InitMessage | AnalyzeMessage;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function createClassifier(quantized: boolean) {
  return pipeline(PIPELINE_TYPE as any, MODEL_ID, {
    quantized,
    progress_callback: (data: any) => {
      if (data.status === 'progress') {
        self.postMessage({ type: 'progress', progress: data.progress });
      }
    }
  });
}

async function loadModel(quantized: boolean) {
  if (classifier && currentQuantizedState === quantized) {
    return;
  }

  try {
    console.log(`[ActivityWorker] Loading ${PIPELINE_TYPE} model (${MODEL_ID}) with INT8 quantized=${quantized}...`);
    classifier = await createClassifier(quantized);
    currentQuantizedState = quantized;
    console.log('[ActivityWorker] Model loaded successfully.');
    self.postMessage({ type: 'model-loaded', quantized, fallback: false });
  } catch (error) {
    console.error(`[ActivityWorker] Failed to load model with quantized=${quantized}:`, getErrorMessage(error));
    if (quantized) {
      console.log('[ActivityWorker] Falling back to FP32 model...');
      try {
        classifier = await createClassifier(false);
        currentQuantizedState = false;
        console.log('[ActivityWorker] Fallback FP32 model loaded successfully.');
        self.postMessage({ type: 'model-loaded', quantized: false, fallback: true });
      } catch (fallbackError) {
        throw new Error(`Fallback failed: ${getErrorMessage(fallbackError)}`);
      }
    } else {
      throw error;
    }
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const data = event.data;

  if (data.type === 'init') {
    try {
      const quantized = data.quantized ?? true;
      await loadModel(quantized);
      self.postMessage({ type: 'ready', quantized: currentQuantizedState });
    } catch (error) {
      self.postMessage({ type: 'error', error: getErrorMessage(error) });
    }
    return;
  }

  if (data.type === 'analyze') {
    const { image, labels, frameId } = data;

    if (!classifier) {
      try {
        await loadModel(true);
      } catch (error) {
        self.postMessage({ type: 'error', error: getErrorMessage(error) });
        if (image && typeof image.close === 'function') image.close();
        return;
      }
    }

    try {
      const startTime = performance.now();
      const results = await classifier(image, labels);
      const inferenceTimeMs = performance.now() - startTime;

      self.postMessage({
        type: 'prediction',
        results,
        inferenceTimeMs,
        quantized: currentQuantizedState,
        frameId
      });
    } catch (error) {
      self.postMessage({ type: 'error', error: getErrorMessage(error) });
    } finally {
      if (image && typeof image.close === 'function') {
        image.close();
      }
    }
    return;
  }
};
