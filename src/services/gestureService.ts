import type { PoseLandmarks } from '../types/pose';

export type GestureEvent =
  | 'handRaised'
  | 'thumbsUp'
  | 'thumbsDown'
  | 'swipeLeft'
  | 'swipeRight'
  | 'poseLost';

export interface GestureResult {
  isHandRaised: boolean;
  confidence: number;
  leftWristAboveShoulder: boolean;
  rightWristAboveShoulder: boolean;
  isPoseLost: boolean;
  isThumbsUp?: boolean;
  isThumbsDown?: boolean;
  isCrossedArms?: boolean;
  swipeDirection?: 'left' | 'right' | null;
  event?: GestureEvent | null;
}

const VISIBILITY_THRESHOLD = 0.5;
const HAND_RAISE_CONFIDENCE_THRESHOLD = 0.7;
const SWIPE_VELOCITY_THRESHOLD = 0.015;

class GestureService {
  private frameBuffer: boolean[] = [];
  private bufferSize = 10;
  private wristHistory: { x: number; t: number }[] = [];
  private lastEvent: GestureEvent | null = null;
  private eventCooldownUntil = 0;

  private getJointVisibility(landmarks: PoseLandmarks, jointIndices: number[]): number {
    if (!landmarks) return 0;
    const visibilities = jointIndices
      .map((idx) => landmarks[idx]?.visibility || 0)
      .filter((v) => v > 0);
    return visibilities.length > 0
      ? visibilities.reduce((a, b) => a + b, 0) / visibilities.length
      : 0;
  }

  private isJointAboveJoint(
    landmarks: PoseLandmarks,
    sourceIdx: number,
    targetIdx: number,
  ): boolean {
    const source = landmarks[sourceIdx];
    const target = landmarks[targetIdx];

    if (!source || !target) return false;
    if (
      (source.visibility ?? 0) < VISIBILITY_THRESHOLD ||
      (target.visibility ?? 0) < VISIBILITY_THRESHOLD
    ) {
      return false;
    }

    return source.y < target.y - 0.05;
  }

  private isJointBelowJoint(
    landmarks: PoseLandmarks,
    sourceIdx: number,
    targetIdx: number,
  ): boolean {
    const source = landmarks[sourceIdx];
    const target = landmarks[targetIdx];
    if (!source || !target) return false;
    return source.y > target.y + 0.04;
  }

  private detectSwipe(landmarks: PoseLandmarks): 'left' | 'right' | null {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftVis = leftWrist?.visibility ?? 0;
    const rightVis = rightWrist?.visibility ?? 0;
    const wrist = leftVis >= rightVis ? leftWrist : rightWrist;
    if (!wrist || (wrist.visibility ?? 0) < VISIBILITY_THRESHOLD) return null;

    const now = Date.now();
    this.wristHistory.push({ x: wrist.x, t: now });
    this.wristHistory = this.wristHistory.filter((p) => now - p.t < 400);

    if (this.wristHistory.length < 4) return null;

    const first = this.wristHistory[0];
    const last = this.wristHistory[this.wristHistory.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return null;

    const velocity = (last.x - first.x) / dt;
    if (Math.abs(velocity) < SWIPE_VELOCITY_THRESHOLD) return null;

    return velocity > 0 ? 'right' : 'left';
  }

  analyze(landmarks: PoseLandmarks): GestureResult {
    if (!landmarks || landmarks.length < 33) {
      return {
        isHandRaised: false,
        confidence: 0,
        leftWristAboveShoulder: false,
        rightWristAboveShoulder: false,
        isPoseLost: true,
        isThumbsUp: false,
        isThumbsDown: false,
        isCrossedArms: false,
        swipeDirection: null,
        event: 'poseLost',
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
        isThumbsDown: false,
        isCrossedArms: false,
        swipeDirection: null,
        event: 'poseLost',
      };
    }

    const leftWristAboveShoulder = this.isJointAboveJoint(
      landmarks,
      leftWristIdx,
      leftShoulderIdx,
    );
    const rightWristAboveShoulder = this.isJointAboveJoint(
      landmarks,
      rightWristIdx,
      rightShoulderIdx,
    );

    const bothHandsRaised = leftWristAboveShoulder && rightWristAboveShoulder;

    const leftThumbsUp =
      this.isJointAboveJoint(landmarks, 21, 19) &&
      this.isJointAboveJoint(landmarks, 21, 17) &&
      this.isJointAboveJoint(landmarks, 19, leftWristIdx);

    const rightThumbsUp =
      this.isJointAboveJoint(landmarks, 22, 20) &&
      this.isJointAboveJoint(landmarks, 22, 18) &&
      this.isJointAboveJoint(landmarks, 20, rightWristIdx);

    const isThumbsUpDetected = leftThumbsUp || rightThumbsUp;

    const leftThumbsDown =
      this.isJointBelowJoint(landmarks, 21, 19) &&
      this.isJointBelowJoint(landmarks, 21, 17);

    const rightThumbsDown =
      this.isJointBelowJoint(landmarks, 22, 20) &&
      this.isJointBelowJoint(landmarks, 22, 18);

    const isThumbsDownDetected = leftThumbsDown || rightThumbsDown;
    const swipeDirection = this.detectSwipe(landmarks);

    let isCrossedArms = false;
    const leftWrist = landmarks[leftWristIdx];
    const rightWrist = landmarks[rightWristIdx];
    const leftShoulder = landmarks[leftShoulderIdx];
    const leftHip = landmarks[leftHipIdx];

    if (leftWrist && rightWrist && leftShoulder && leftHip) {
      if (
        leftWrist.visibility > VISIBILITY_THRESHOLD &&
        rightWrist.visibility > VISIBILITY_THRESHOLD
      ) {
        const wristDistX = Math.abs(leftWrist.x - rightWrist.x);
        const wristDistY = Math.abs(leftWrist.y - rightWrist.y);
        const isBetweenShoulderAndHip =
          leftWrist.y > leftShoulder.y && leftWrist.y < leftHip.y;

        if (wristDistX < 0.15 && wristDistY < 0.15 && isBetweenShoulderAndHip) {
          isCrossedArms = true;
        }
      }
    }

    this.frameBuffer.push(bothHandsRaised || isThumbsUpDetected || isCrossedArms);
    if (this.frameBuffer.length > this.bufferSize) {
      this.frameBuffer.shift();
    }

    const raisedFrames = this.frameBuffer.filter(Boolean).length;
    const confidence = raisedFrames / this.frameBuffer.length;

    let event: GestureEvent | null = null;
    const now = Date.now();

    if (now >= this.eventCooldownUntil) {
      if (swipeDirection === 'left') {
        event = 'swipeLeft';
      } else if (swipeDirection === 'right') {
        event = 'swipeRight';
      } else if (isThumbsDownDetected) {
        event = 'thumbsDown';
      } else if (isThumbsUpDetected) {
        event = 'thumbsUp';
      } else if (confidence >= HAND_RAISE_CONFIDENCE_THRESHOLD) {
        event = 'handRaised';
      }

      if (event && event !== this.lastEvent) {
        this.lastEvent = event;
        this.eventCooldownUntil = now + 1200;
      } else if (!event) {
        this.lastEvent = null;
      }
    }

    return {
      isHandRaised: confidence >= HAND_RAISE_CONFIDENCE_THRESHOLD,
      confidence,
      leftWristAboveShoulder,
      rightWristAboveShoulder,
      isPoseLost: false,
      isThumbsUp: isThumbsUpDetected,
      isThumbsDown: isThumbsDownDetected,
      isCrossedArms,
      swipeDirection,
      event,
    };
  }

  reset(): void {
    this.frameBuffer = [];
    this.wristHistory = [];
    this.lastEvent = null;
    this.eventCooldownUntil = 0;
  }
}

export const gestureService = new GestureService();
