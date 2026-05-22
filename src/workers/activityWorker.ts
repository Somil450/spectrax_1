import { pipeline, env } from '@xenova/transformers';

// Skip local model check (fetch from Hugging Face)
// @ts-ignore
env.allowLocalModels = false;

let classifier: any = null;
const pipeline_type = 'zero-shot-image-classification';
const model_id = 'Xenova/clip-vit-base-patch32';

async function loadModel() {
  if (!classifier) {
    console.log(`[ActivityWorker] Loading ${pipeline_type} model (${model_id})...`);
    classifier = await pipeline(pipeline_type as any, model_id, {
      progress_callback: (data: any) => {
        if (data.status === 'progress') {
          self.postMessage({ type: 'progress', progress: data.progress });
        }
      }
    });
    console.log('[ActivityWorker] Model loaded.');
  }
}

self.onmessage = async (event) => {
  const { image, labels, type } = event.data;

  if (type === 'init') {
    await loadModel();
    self.postMessage({ type: 'ready' });
    return;
  }

  if (type === 'analyze') {
    if (!classifier) await loadModel();
    try {
      const results = await classifier(image, labels);
      self.postMessage({
        type: 'prediction',
        results
      });
    } catch (error) {
      self.postMessage({ type: 'error', error: (error as Error).message });
    }
    return;
  }
};

