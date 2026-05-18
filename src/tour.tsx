import { useEffect, useState } from 'react';
import * as JoyrideModule from 'react-joyride';

const Joyride =
  JoyrideModule.default || (JoyrideModule as any).Joyride;

const { STATUS, EVENTS, ACTIONS } = JoyrideModule;

interface OnboardingTourProps {
  currentScreen: string;
}

export default function OnboardingTour({
  currentScreen,
}: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem(
      'spectrax-tour-seen'
    );

    if (!hasSeenTour && currentScreen === 'welcome') {
      const timer = setTimeout(() => {
        setRun(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  const allSteps = [
    {
      target: '[data-tour="start-button"]',
      title: 'Start Button',
      content:
        'Click here to begin your AI fitness session.',
      screen: 'welcome',
    },
    {
      target: '[data-tour="camera-feed"]',
      title: 'Camera Feed',
      content:
        'Your camera tracks your body movements in real time here.',
      screen: 'calibration',
    },
    {
      target: '[data-tour="stats-panel"]',
      title: 'Stats Panel',
      content:
        'Your rep count and AI engine status appear here.',
      screen: 'workout',
    },
  ];

  const steps = allSteps
    .filter(step => step.screen === currentScreen)
    .map(({ target, title, content }) => ({
      target,
      title,
      content,
    }));

  const handleCallback = (data: any) => {
    const { action, index, type, status } = data;

    // Stop immediately when finished/skipped
    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED
    ) {
      localStorage.setItem(
        'spectrax-tour-seen',
        'true'
      );

      setRun(false);
      setStepIndex(0);

      return;
    }

    // Skip missing targets safely
    if (type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(prev => prev + 1);
      return;
    }

    // Handle next/back safely
    if (type === EVENTS.STEP_AFTER) {
      const nextIndex =
        index + (action === ACTIONS.PREV ? -1 : 1);

      if (
        nextIndex >= 0 &&
        nextIndex < steps.length
      ) {
        setStepIndex(nextIndex);
      }
    }
  };

  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={run ? stepIndex : undefined}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      spotlightClicks={false}
      disableOverlayClose={true}
      disableCloseOnEsc={true}
      disableScrolling={true}
      debug={false}
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: '#00f0ff',
          backgroundColor: '#0d1127',
          textColor: '#ffffff',
          arrowColor: '#0d1127',
          zIndex: 999999,
        },

        tooltip: {
          borderRadius: '12px',
          border: '2px solid #00f0ff',
          backgroundColor: '#0d1127',
          boxShadow:
            '0 0 30px rgba(0, 240, 255, 0.3)',
        },

        buttonSkip: {
          color: '#a855f7',
          background: 'transparent',
          border: '1px solid #a855f7',
          borderRadius: '6px',
          padding: '8px 14px',
          fontWeight: 700,
          fontSize: '0.8rem',
        },

        buttonNext: {
          backgroundColor: '#00f0ff',
          color: '#000000',
          borderRadius: '6px',
          padding: '8px 16px',
          fontWeight: 700,
          fontSize: '0.8rem',
        },

        buttonBack: {
          color: '#00f0ff',
          border: '1px solid #00f0ff',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '0.8rem',
          marginRight: '8px',
        },

        buttonClose: {
          color: '#00f0ff',
        },
      }}
      locale={{
        skip: 'Skip Tour',
        next: 'Next',
        back: 'Back',
        last: 'Done',
      }}
    />
  );
}