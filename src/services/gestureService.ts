export interface GestureResult {
  isHandRaised: boolean;
  confidence: number;
  leftWristAboveShoulder: boolean;
  rightWristAboveShoulder: boolean;
  isPoseLost: boolean;
  isThumbsUp?: boolean;
  isCrossedArms: boolean;
}

const VISIBILITY_THRESHOLD = 0.5;
const HAND_RAISE_CONFIDENCE_THRESHOLD = 0.7;

class GestureService {
  private frameBuffer: boolean[] = [];
  private bufferSize: number = 10;

  private getJointVisibility(landmarks: any[], jointIndices: number[]): number {
    if (!landmarks) return 0;
    const visibilities = jointIndices
      .map(idx => landmarks[idx]?.visibility || 0)
      .filter(v => v > 0);
    return visibilities.length > 0 
      ? visibilities.reduce((a, b) => a + b, 0) / visibilities.length 
      : 0;
  }

  private isJointAboveJoint(landmarks: any[], sourceIdx: number, targetIdx: number): boolean {
    const source = landmarks[sourceIdx];
    const target = landmarks[targetIdx];
    
    if (!source || !target) return false;
    if (source.visibility < VISIBILITY_THRESHOLD || target.visibility < VISIBILITY_THRESHOLD) {
      return false;
    }

    return source.y < target.y - 0.05;
  }

  analyze(landmarks: any[]): GestureResult {
    if (!landmarks || landmarks.length < 33) {
      return {
        isHandRaised: false,
        confidence: 0,
        leftWristAboveShoulder: false,
        rightWristAboveShoulder: false,
        isPoseLost: true,
        isThumbsUp: false,
        isCrossedArms: false,
      };
    }

    const leftShoulderIdx = 11;
    const rightShoulderIdx = 12;
    const leftWristIdx = 15;
    const rightWristIdx = 16;
    const leftHipIdx = 23;
    const rightHipIdx = 24;

    const bodyVisibility = this.getJointVisibility(landmarks, [
      leftShoulderIdx,
      rightShoulderIdx,
      leftHipIdx,
      rightHipIdx,
    ]);

    if (bodyVisibility < VISIBILITY_THRESHOLD) {
      return {
        isHandRaised: false,
        confidence: 0,
        leftWristAboveShoulder: false,
        rightWristAboveShoulder: false,
        isPoseLost: true,
        isThumbsUp: false,
        isCrossedArms: false,
      };
    }

    const leftWristAboveShoulder = this.isJointAboveJoint(
      landmarks,
      leftWristIdx,
      leftShoulderIdx
    );
    const rightWristAboveShoulder = this.isJointAboveJoint(
      landmarks,
      rightWristIdx,
      rightShoulderIdx
    );

    const bothHandsRaised = leftWristAboveShoulder && rightWristAboveShoulder;

    const leftThumbIdx = 21;
    const leftIndexIdx = 19;
    const leftPinkyIdx = 17;
    const rightThumbIdx = 22;
    const rightIndexIdx = 20;
    const rightPinkyIdx = 18;

    const leftThumbsUp = 
      this.isJointAboveJoint(landmarks, leftThumbIdx, leftIndexIdx) && 
      this.isJointAboveJoint(landmarks, leftThumbIdx, leftPinkyIdx) &&
      this.isJointAboveJoint(landmarks, leftIndexIdx, leftWristIdx);

    const rightThumbsUp = 
      this.isJointAboveJoint(landmarks, rightThumbIdx, rightIndexIdx) && 
      this.isJointAboveJoint(landmarks, rightThumbIdx, rightPinkyIdx) &&
      this.isJointAboveJoint(landmarks, rightIndexIdx, rightWristIdx);

    const isThumbsUpDetected = leftThumbsUp || rightThumbsUp;

    // Detect Crossed Arms (Wrists close together near chest level)
    let isCrossedArms = false;
    const leftWrist = landmarks[leftWristIdx];
    const rightWrist = landmarks[rightWristIdx];
    const leftShoulder = landmarks[leftShoulderIdx];
    const leftHip = landmarks[leftHipIdx];
    
    if (leftWrist && rightWrist && leftShoulder && leftHip) {
      if (leftWrist.visibility > VISIBILITY_THRESHOLD && rightWrist.visibility > VISIBILITY_THRESHOLD) {
        const wristDistX = Math.abs(leftWrist.x - rightWrist.x);
        const wristDistY = Math.abs(leftWrist.y - rightWrist.y);
        const isBetweenShoulderAndHip = leftWrist.y > leftShoulder.y && leftWrist.y < leftHip.y;
        
        // Wrists are very close to each other horizontally and vertically, and at chest level
        if (wristDistX < 0.15 && wristDistY < 0.15 && isBetweenShoulderAndHip) {
          isCrossedArms = true;
        }
      }
    }

    this.frameBuffer.push(bothHandsRaised || isThumbsUpDetected || isCrossedArms);
    if (this.frameBuffer.length > this.bufferSize) {
      this.frameBuffer.shift();
    }

    const raisedFrames = this.frameBuffer.filter(v => v).length;
    const confidence = raisedFrames / this.frameBuffer.length;

    return {
      isHandRaised: confidence >= HAND_RAISE_CONFIDENCE_THRESHOLD,
      confidence,
      leftWristAboveShoulder,
      rightWristAboveShoulder,
      isPoseLost: false,
      isThumbsUp: isThumbsUpDetected,
      isCrossedArms,
    };
  }

  reset(): void {
    this.frameBuffer = [];
  }
}

export const gestureService = new GestureService();
