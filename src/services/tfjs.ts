import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

class TFJSPoseService {
  private detector: poseDetection.PoseDetector | null = null;
  private multiDetector: poseDetection.PoseDetector | null = null;

  async init(): Promise<void> {
    if (this.detector) return;
    await tf.ready();
    await tf.setBackend('webgl');

    try {
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.BlazePose,
        {
          runtime: 'tfjs',
          modelType: 'full',
        }
      );
      console.log('TFJS Single-Pose Detector initialized.');
    } catch (err) {
      console.error('Failed to initialize Single-Pose detector:', err);
    }
  }

  async initMultiPose(): Promise<void> {
    if (this.multiDetector) return;
    await tf.ready();
    await tf.setBackend('webgl');

    try {
      this.multiDetector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
        }
      );
      console.log('TFJS MoveNet MultiPose Detector initialized.');
    } catch (err) {
      console.error('Failed to initialize MoveNet MultiPose detector:', err);
    }
  }

  async estimatePose(image: HTMLVideoElement | HTMLCanvasElement): Promise<poseDetection.Pose[]> {
    if (!this.detector) {
      await this.init();
    }
    if (!this.detector) return [];
    return this.detector.estimatePoses(image);
  }

  async estimateMultiplePoses(image: HTMLVideoElement | HTMLCanvasElement): Promise<poseDetection.Pose[]> {
    if (!this.multiDetector) {
      await this.initMultiPose();
    }
    if (!this.multiDetector) return [];
    return this.multiDetector.estimatePoses(image);
  }
}

export const tfjsPoseService = new TFJSPoseService();
