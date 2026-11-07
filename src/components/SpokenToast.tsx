import React, { useEffect, useRef, useState } from 'react';
import { Toast } from './Toast';
import type { SpeechStatus } from '../types';

export interface SpokenToastProps {
  status: SpeechStatus;
  /** How far above the bottom edge the toast floats, so the host screen can clear the safe area. */
  bottomOffset?: number;
}

/**
 * A brief "Spoken" confirmation shown once an utterance has finished.
 *
 * The status banner already says what is happening in words; this adds the small moment of
 * reassurance a sighted user needs to see that the message actually got out, especially when they
 * tapped a card at the top of the screen and are not watching the status area.
 *
 * The visible pill is a shared {@link Toast}; what lives here is only the trigger, because the user
 * cares about the utterance finishing rather than about the speech engine's raw status changing.
 */
export function SpokenToast({ status, bottomOffset = 24 }: SpokenToastProps) {
  const [message, setMessage] = useState<string | null>(null);
  const previousStatus = useRef<SpeechStatus>(status);

  useEffect(() => {
    const justFinished = previousStatus.current === 'speaking' && status === 'ready';
    previousStatus.current = status;
    if (justFinished) {
      setMessage('✓ Spoken');
    }
  }, [status]);

  return (
    <Toast
      message={message}
      announcement="Message spoken."
      bottomOffset={bottomOffset}
      onHidden={() => setMessage(null)}
    />
  );
}
