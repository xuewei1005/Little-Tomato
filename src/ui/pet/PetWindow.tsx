import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSettings } from '../../domain/settingsStore';
import { getAmbientPetState } from '../../domain/petStateMachine';
import type { AppSettings, PetVisualState } from '../../domain/types';
import { getMoodVisualState, getPetMood } from '../../domain/petEmotion';
import { emit, listen } from '@tauri-apps/api/event';
import { PetAvatar } from './PetAvatar';
import { PetBubble } from './PetBubble';
import { showPetContextMenu } from '../window/petMenu';
import { PET_COMMAND_EVENT, type PetCommand } from '../window/petCommands';
import { ConfettiBurst } from './ConfettiBurst';
import { PetTimerBoard } from './PetTimerBoard';
import { PET_ACTION_EVENT, localizePetReaction, pickPetReaction } from './petInteraction';
import { usePetInteraction } from './usePetInteraction';
import { usePetRuntime } from './usePetRuntime';
import { translate } from '../../i18n/catalog';
import { getTimerSoundPath } from '../../domain/petRuntime';
import { usePetHitTest } from './usePetHitTest';

export function PetWindow() {
  const [settings] = useState<AppSettings>(() => loadSettings());
  const [ambientState, setAmbientState] = useState<PetVisualState>('idle');
  const [reactionMessage, setReactionMessage] = useState('');
  const [actionSeed, setActionSeed] = useState(0);
  const [lastInteractionAtMs, setLastInteractionAtMs] = useState(() => Date.now() - 30_001);
  const [moodClock, setMoodClock] = useState(() => Date.now());
  const tapHistory = useRef<number[]>([]);
  const actionResetTimer = useRef<number | null>(null);
  const reactionResetTimer = useRef<number | null>(null);
  const runtime = usePetRuntime({
    displayName: settings.displayName,
    focusConfig: { ...settings.focus, standUpMinutes: settings.standUpMinutes },
    settingsSnapshot: { language: settings.language, petName: settings.petName, displayName: settings.displayName, petTheme: settings.petTheme, opacity: settings.opacity, animationEnabled: settings.animationEnabled, soundEnabled: settings.soundEnabled },
  });
  const liveSettings = runtime.settingsSnapshot ?? { language: settings.language, petName: settings.petName, displayName: settings.displayName, petTheme: settings.petTheme, opacity: settings.opacity, animationEnabled: settings.animationEnabled, soundEnabled: settings.soundEnabled };
  const playedSoundCueIdRef = useRef(0);

  useEffect(() => {
    const cue = runtime.timerSoundCue;
    if (!cue || cue.id <= playedSoundCueIdRef.current) return;
    playedSoundCueIdRef.current = cue.id;
    if (!liveSettings.soundEnabled || typeof Audio === 'undefined') return;
    const audio = new Audio(getTimerSoundPath(cue.type));
    audio.preload = 'auto';
    audio.volume = cue.type === 'complete' ? 0.72 : 0.58;
    void audio.play().catch(() => {
      // Windows may block autoplay until the app has an audio-capable interaction.
    });
  }, [liveSettings.soundEnabled, runtime.timerSoundCue]);

  useEffect(() => {
    if (runtime.visualState === 'angry') setActionSeed((seed) => seed + 1);
  }, [runtime.visualState]);

  const playAmbientAction = useCallback((nextState: PetVisualState = getAmbientPetState()) => {
    setAmbientState(nextState);
    setActionSeed((seed) => seed + 1);
    if (actionResetTimer.current !== null) window.clearTimeout(actionResetTimer.current);
    actionResetTimer.current = window.setTimeout(() => setAmbientState('idle'), 4_800);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setMoodClock(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>(PET_ACTION_EVENT, ({ payload }) => {
      if (!disposed && payload === 'spin') playAmbientAction('spin');
    }).then((cleanup) => { if (disposed) cleanup(); else unlisten = cleanup; }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, [playAmbientAction]);

  useEffect(() => {
    if (!liveSettings.animationEnabled) {
      setAmbientState('idle');
      return;
    }
    const timer = window.setInterval(() => playAmbientAction(), 18_000);
    return () => {
      window.clearInterval(timer);
      if (actionResetTimer.current !== null) window.clearTimeout(actionResetTimer.current);
      if (reactionResetTimer.current !== null) window.clearTimeout(reactionResetTimer.current);
      actionResetTimer.current = null;
      reactionResetTimer.current = null;
    };
  }, [liveSettings.animationEnabled, playAmbientAction]);

  const onClickReaction = useCallback(() => {
    const nowMs = Date.now();
    setLastInteractionAtMs(nowMs);
    setMoodClock(nowMs);
    tapHistory.current = [...tapHistory.current.filter((time) => nowMs - time < 1_800), nowMs];
    const reaction = tapHistory.current.length >= 4 ? { state: 'dizzy' as const, message: translate(liveSettings.language, 'pet.reaction.dizzy') } : localizePetReaction(pickPetReaction(), liveSettings.language);
    setReactionMessage(reaction.message);
    playAmbientAction(reaction.state);
    if (reactionResetTimer.current !== null) window.clearTimeout(reactionResetTimer.current);
    reactionResetTimer.current = window.setTimeout(() => setReactionMessage(''), 4_800);
  }, [liveSettings.language, playAmbientAction]);
  const interaction = usePetInteraction({ onClickReaction });
  usePetHitTest(interaction.interactionClass);
  const sendCommand = useCallback((command: PetCommand) => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) void emit(PET_COMMAND_EVENT, command).catch(() => undefined);
  }, []);
  const critical = runtime.showConfetti || runtime.visualState === 'notification' || runtime.visualState === 'angry' || runtime.timerState.phase === 'standUp' || Boolean(runtime.message && !runtime.showTip);
  const moodState = getMoodVisualState(getPetMood(moodClock, lastInteractionAtMs));
  const visualState = critical ? runtime.visualState : ambientState !== 'idle' ? ambientState : runtime.visualState === 'idle' ? moodState : runtime.visualState;
  const message = runtime.showTip && reactionMessage ? reactionMessage : runtime.message || reactionMessage;
  const holdingTimer = runtime.timerState.status === 'running' || runtime.timerState.status === 'paused' || runtime.timerState.status === 'awaitingStandUp';
  return (
    <main className="pet-window" aria-label={translate(liveSettings.language, 'app.name')}>
      <div
        className={`pet-window-inner ${interaction.interactionClass}${liveSettings.animationEnabled ? '' : ' animations-off'}`}
        style={{ opacity: liveSettings.opacity }}
        onPointerDown={interaction.handlePointerDown}
        onPointerMove={interaction.handlePointerMove}
        onPointerUp={interaction.handlePointerUp}
        onPointerCancel={interaction.handlePointerCancel}
        onPointerEnter={interaction.handlePointerEnter}
        onClick={interaction.handleClick}
        onContextMenu={(event) => { if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) { event.preventDefault(); void showPetContextMenu(); } }}
      >
        <div className="pet-stage">
          <ConfettiBurst visible={runtime.showConfetti} />
          {message && <div className="pet-speech"><PetBubble compact>{message}</PetBubble></div>}
          <PetAvatar language={liveSettings.language} theme={liveSettings.petTheme} visualState={visualState} size="large" animationEnabled={liveSettings.animationEnabled} actionSeed={actionSeed} heldItem={holdingTimer ? <PetTimerBoard language={liveSettings.language} state={runtime.timerState} onPause={() => sendCommand('pause-timer')} onResume={() => sendCommand('resume-timer')} onConfirmStandUp={() => sendCommand('confirm-stand-up')} /> : undefined} />
        </div>
      </div>
    </main>
  );
}
