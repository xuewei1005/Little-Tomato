import { formatTimerSeconds } from '../../domain/focusTimer';
import type { AppLanguage, FocusTimerState } from '../../domain/types';
import { translate } from '../../i18n/catalog';

export interface PetTimerBoardProps {
  state: FocusTimerState;
  onPause: () => void;
  onResume: () => void;
  onConfirmStandUp: () => void;
  language?: AppLanguage;
}

export function PetTimerBoard({ state, onPause, onResume, onConfirmStandUp, language = 'zh-CN' }: PetTimerBoardProps) {
  if (state.status !== 'running' && state.status !== 'paused' && state.status !== 'awaitingStandUp') return null;

  if (state.status === 'awaitingStandUp') {
    return (
      <section className="pet-timer-board board-confirm" data-testid="pet-timer-board" aria-label={translate(language, 'timer.confirmBoard')}>
        <button type="button" className="timer-board-action" data-pet-interactive="true" onClick={onConfirmStandUp} aria-label={translate(language, 'timer.confirmStandUp')}>
          <span aria-hidden="true" className="timer-board-icon">✓</span>
        </button>
      </section>
    );
  }

  const paused = state.status === 'paused';
  const time = formatTimerSeconds(state.remainingSec);
  return (
    <section className={`pet-timer-board board-${paused ? 'paused' : 'running'}`} data-testid="pet-timer-board" aria-label={paused ? translate(language, 'timer.pausedBoard') : translate(language, 'timer.countdownBoard')}>
      <span className={`timer-board-display${time.length > 5 ? ' timer-board-long' : ''}`} aria-label={translate(language, 'timer.remaining', { time })}>{time}</span>
      <button type="button" className="timer-board-action" data-pet-interactive="true" onClick={paused ? onResume : onPause} aria-label={paused ? translate(language, 'timer.resumeBoard') : translate(language, 'timer.pauseBoard')}>
        <span aria-hidden="true" className="timer-board-icon">{paused ? '▶' : 'Ⅱ'}</span>
      </button>
    </section>
  );
}
