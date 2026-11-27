import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OnboardingStep } from '../../../../shared/onboarding';
import { OnboardingFrame } from '../frame';
import { Button, Notice } from '../../../components/ui';
import { errorMessage } from '../../../lib/api';
import { desktopSetup, completeDesktopPreferences } from '../../../lib/desktop';
import { Messages } from '../motion';

export function DesktopPreferencesSetup({
  onReady,
  notice,
  steps,
}: {
  onReady(): void;
  notice?: ReactNode;
  steps: readonly OnboardingStep[];
}) {
  const [error, setError] = useState('');
  const [loginItemNotice, setLoginItemNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    let current = true;
    void desktopSetup()
      .then((value) => (value.preferenceStep === 'complete' ? value : completeDesktopPreferences()))
      .then((value) => {
        if (!current) return;
        if (value.preferenceStep !== 'complete')
          throw new Error('Nod couldn’t finish setup. Try again.');
        if (value.loginItemError) setLoginItemNotice(value.loginItemError);
        else ready.current();
      })
      .catch((cause) => {
        if (current) setError(errorMessage(cause));
      });
    return () => {
      current = false;
    };
  }, [retry]);

  return (
    <OnboardingFrame step="join" steps={steps}>
      <section className="ob-step">
        <Messages items={[]} typing={!error && !loginItemNotice} />
        {error && (
          <Notice>
            {error}{' '}
            <Button
              variant="ghost"
              onClick={() => {
                setError('');
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </Notice>
        )}
        {loginItemNotice && (
          <Notice kind="info">
            {loginItemNotice} You can turn it on later in Settings.{' '}
            <Button variant="ghost" onClick={() => ready.current()}>
              Continue
            </Button>
          </Notice>
        )}
      </section>
      {notice}
    </OnboardingFrame>
  );
}
