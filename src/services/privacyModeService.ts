export type PrivacyRenderMode = 'full_camera' | 'blurred_background' | 'skeleton_only';

class PrivacyModeService {
  private mode: PrivacyRenderMode = 'full_camera';

  setMode(mode: PrivacyRenderMode): void {
    this.mode = mode;
    console.log(`[Privacy] Render mode switched to: ${mode}`);
  }

  getMode(): PrivacyRenderMode {
    return this.mode;
  }

  /**
   * Returns true if background pixels should be completely masked/blurred.
   */
  shouldMaskBackground(): boolean {
    return this.mode === 'blurred_background' || this.mode === 'skeleton_only';
  }

  /**
   * Returns true if ONLY keypoints and skeleton should be drawn on a solid dark canvas.
   */
  isSkeletonOnly(): boolean {
    return this.mode === 'skeleton_only';
  }
}

export const privacyModeService = new PrivacyModeService();
