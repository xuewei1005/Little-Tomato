import { useEffect, useMemo, useRef, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { createFocusTimerState, getStandUpPromptMood } from '../../domain/focusTimer';
import { PET_RUNTIME_EVENT, PET_RUNTIME_SYNC_REQUEST, petNoticeFromRuntimeEvent, selectPetNotice, type PetNotice, type PetRuntimeEvent } from '../../domain/petRuntime';
import { getPetVisualState } from '../../domain/petStateMachine';
import { getRandomTip, localizeTip } from '../../domain/tipsLibrary';
import { personalizePetSpeech } from '../../domain/petSpeech';
import type { FocusTimerConfig, FocusTimerState, PetVisualState } from '../../domain/types';
import type { PetSettingsSnapshot } from '../../domain/petRuntime';
import { translate } from '../../i18n/catalog';

const TIP_INITIAL_DELAY_MS = 800;
const TIP_MIN_INTERVAL_MS = 30_000;
const TIP_MAX_INTERVAL_MS = 60_000;
const TIP_VISIBLE_MS = 12_000;
const TIMER_NOTICE_VISIBLE_MS = 5 * 60_000;
const CONFETTI_VISIBLE_MS = 4_200;

interface UsePetRuntimeOptions {
  displayName?: string;
  focusConfig?: FocusTimerConfig;
  settingsSnapshot?: PetSettingsSnapshot;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function usePetRuntime(options: UsePetRuntimeOptions = {}) {
  const [timerState, setTimerState] = useState<FocusTimerState>(() => createFocusTimerState(options.focusConfig));
  const [settingsSnapshot, setSettingsSnapshot] = useState<PetSettingsSnapshot | null>(() => options.settingsSnapshot ?? null);
  const [notice, setNotice] = useState<PetNotice | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const [showConfetti, setShowConfetti] = useState(false);
  const previousTimerRef = useRef(timerState);
  const confettiTimerRef = useRef<number | null>(null);
  const queuedNoticesRef = useRef<PetNotice[]>([]);
  const displayNameRef = useRef(options.displayName ?? options.settingsSnapshot?.displayName ?? '');
  const petNameRef = useRef(options.settingsSnapshot?.petName ?? '小番茄');
  const languageRef = useRef(options.settingsSnapshot?.language ?? 'zh-CN');
  const lastTipRef = useRef<string | undefined>(undefined);

  const presentNotice = (candidate: PetNotice, nowMs: number) => {
    setNotice((current) => {
      const selected = selectPetNotice(current, candidate, nowMs);
      if (current && selected === current) {
        queuedNoticesRef.current = [
          ...queuedNoticesRef.current.filter((queued) => !(queued.priority === candidate.priority && queued.message === candidate.message)),
          candidate,
        ].slice(-8);
      }
      return selected;
    });
  };

  const takeQueuedNotice = (nowMs: number): PetNotice | null => {
    let selected: PetNotice | null = null;
    for (const candidate of queuedNoticesRef.current) selected = selectPetNotice(selected, candidate, nowMs);
    if (selected) queuedNoticesRef.current = queuedNoticesRef.current.filter((candidate) => candidate !== selected);
    else queuedNoticesRef.current = queuedNoticesRef.current.filter((candidate) => candidate.expiresAtMs > nowMs);
    return selected;
  };

  useEffect(() => {
    const id = window.setInterval(() => setClockMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<PetRuntimeEvent>(PET_RUNTIME_EVENT, ({ payload }) => {
      if (disposed) return;
      const nowMs = Date.now();
      if (payload.type === 'settings-state') {
        languageRef.current = payload.settings.language;
        displayNameRef.current = payload.settings.displayName;
        petNameRef.current = payload.settings.petName;
        setSettingsSnapshot(payload.settings);
        return;
      }
      if (payload.type === 'timer-state') {
        const previous = previousTimerRef.current;
        previousTimerRef.current = payload.state;
        const enteringStandUp = previous.phase !== 'standUp' && payload.state.phase === 'standUp' && payload.state.status === 'awaitingStandUp';
        const leavingStandUp = previous.phase === 'standUp' && payload.state.phase !== 'standUp';
        if (enteringStandUp) {
          if (confettiTimerRef.current !== null) window.clearTimeout(confettiTimerRef.current);
          setShowConfetti(true);
          confettiTimerRef.current = window.setTimeout(() => setShowConfetti(false), CONFETTI_VISIBLE_MS);
          const timerNotice: PetNotice = {
            priority: 'timer',
            message: personalizePetSpeech(translate(languageRef.current, 'pet.timerComplete'), displayNameRef.current, petNameRef.current, Math.floor(nowMs / 60_000), languageRef.current),
            createdAtMs: payload.emittedAtMs || nowMs,
            expiresAtMs: nowMs + TIMER_NOTICE_VISIBLE_MS,
            visualState: 'stretch',
          };
          presentNotice(timerNotice, nowMs);
        } else if (leavingStandUp) {
          queuedNoticesRef.current = queuedNoticesRef.current.filter((queued) => queued.priority !== 'timer');
          setNotice((current) => current?.priority === 'timer' ? takeQueuedNotice(nowMs) : current);
        }
        setTimerState(payload.state);
        return;
      }

      const candidate = petNoticeFromRuntimeEvent(payload, nowMs);
      if (!candidate) return;
      presentNotice(candidate, nowMs);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    }).catch(() => {
      // 浏览器预览或旧版权限环境没有事件桥时，宠物仍可展示本地动作。
    });
    void emit(PET_RUNTIME_SYNC_REQUEST).catch(() => {
      // 事件桥不可用时不影响透明宠物窗口启动。
    });
    return () => {
      disposed = true;
      unlisten?.();
      if (confettiTimerRef.current !== null) window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = null;
    };
  }, [options.displayName]);

  useEffect(() => {
    if (!notice) return;
    const delay = Math.max(0, notice.expiresAtMs - Date.now());
    const id = window.setTimeout(() => setNotice((current) => current === notice ? takeQueuedNotice(Date.now()) : current), delay);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    let disposed = false;
    let tipTimer: number | null = null;
    const schedule = (delayMs: number) => {
      tipTimer = window.setTimeout(() => {
        if (disposed) return;
        const nowMs = Date.now();
        const rawTip = getRandomTip(Math.random, { previousTip: lastTipRef.current });
        lastTipRef.current = rawTip;
        const candidate: PetNotice = {
          priority: 'tip',
          message: personalizePetSpeech(localizeTip(rawTip, languageRef.current), displayNameRef.current, petNameRef.current, Math.floor(Math.random() * 4), languageRef.current),
          createdAtMs: nowMs,
          expiresAtMs: nowMs + TIP_VISIBLE_MS,
        };
        presentNotice(candidate, nowMs);
        const nextDelay = TIP_MIN_INTERVAL_MS + Math.floor(Math.random() * (TIP_MAX_INTERVAL_MS - TIP_MIN_INTERVAL_MS));
        schedule(nextDelay);
      }, delayMs);
    };
    schedule(TIP_INITIAL_DELAY_MS);
    return () => {
      disposed = true;
      if (tipTimer !== null) window.clearTimeout(tipTimer);
    };
  }, []);

  const standUpMood = getStandUpPromptMood(timerState, clockMs);
  const activeNotice = notice && notice.expiresAtMs > clockMs ? notice : null;
  const showTip = activeNotice?.priority === 'tip';
  const angryMessage = timerState.phase === 'standUp' && standUpMood === 'angry'
    ? personalizePetSpeech(translate(languageRef.current, 'pet.standUpAngry'), displayNameRef.current, petNameRef.current, Math.floor(clockMs / 60_000), languageRef.current)
    : '';
  const message = angryMessage || activeNotice?.message || '';
  const visualState: PetVisualState = useMemo(() => {
    if (showConfetti) return 'celebrate';
    if (timerState.phase === 'standUp' && standUpMood === 'angry') return 'angry';
    if (activeNotice?.visualState) return activeNotice.visualState;
    return getPetVisualState({
      focusPhase: timerState.phase,
      hasReminder: Boolean(activeNotice) || timerState.phase === 'shortBreak' || timerState.phase === 'longBreak',
      hasIncomingNotification: false,
    });
  }, [activeNotice, showConfetti, standUpMood, timerState.phase]);

  return { timerState, settingsSnapshot, message, visualState, showTip, showConfetti, standUpMood };
}
