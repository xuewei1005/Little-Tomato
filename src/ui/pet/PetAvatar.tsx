import { useEffect, useRef, type ReactNode } from 'react';
import type { AppLanguage, PetTheme, PetVisualState } from '../../domain/types';
import { translate } from '../../i18n/catalog';

interface PetAvatarProps {
  theme?: PetTheme;
  language?: AppLanguage;
  visualState?: PetVisualState;
  size?: 'small' | 'medium' | 'large';
  animationEnabled?: boolean;
  heldItem?: ReactNode;
  actionSeed?: number;
}

const VISUAL_STATE_KEYS: Record<PetVisualState, string> = {
  idle: 'pet.state.idle', focus: 'pet.state.focus', stretch: 'pet.state.stretch', notification: 'pet.state.notification', celebrate: 'pet.state.celebrate', sleepy: 'pet.state.sleepy', happy: 'pet.state.happy', wave: 'pet.state.wave', wink: 'pet.state.wink', thinking: 'pet.state.thinking', angry: 'pet.state.angry', bounce: 'pet.state.bounce', spin: 'pet.state.spin', loved: 'pet.state.loved', sad: 'pet.state.sad', dizzy: 'pet.state.dizzy',
};

// Variants enrich the existing state contract without random changes during renders.
const STATE_GESTURES = {
  idle: ['breathe'],
  focus: ['attentive'],
  stretch: ['sky-stretch', 'side-stretch'],
  notification: ['alert'],
  celebrate: ['hooray'],
  sleepy: ['sleepy-nod'],
  happy: ['excited-hop', 'tippy-taps'],
  wave: ['wave', 'hello-bow'],
  wink: ['cheeky-wink'],
  thinking: ['head-tilt', 'curious-peek'],
  angry: ['cheek-puff', 'angry-stomp', 'angry-cross'],
  bounce: ['jelly-hop', 'double-hop'],
  spin: ['twirl'],
  loved: ['bashful', 'snuggle'],
  sad: ['small-sigh'],
  dizzy: ['wobbly'],
} as const satisfies Record<PetVisualState, readonly string[]>;

export function PetAvatar({ theme = 'tomato', language = 'zh-CN', visualState = 'idle', size = 'medium', animationEnabled = true, heldItem, actionSeed = 0 }: PetAvatarProps) {
  const rig = useRef<HTMLDivElement>(null);
  const seed = Number.isFinite(actionSeed) ? Math.abs(Math.trunc(actionSeed)) : 0;
  const gestures = STATE_GESTURES[visualState];
  const gesture = heldItem && ['spin', 'bounce', 'happy', 'celebrate'].includes(visualState)
    ? 'timer-sway'
    : gestures[seed % gestures.length];

  useEffect(() => {
    if (!animationEnabled || rig.current?.closest('.interaction-pressed, .interaction-dragging')) return;
    // Replay CSS motion without remounting interactive held controls or losing focus.
    for (const animation of rig.current?.getAnimations?.({ subtree: true }) ?? []) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (target instanceof Element && target.closest('.pet-held-item')) continue;
      animation.cancel();
      animation.play();
    }
  }, [actionSeed, visualState, gesture, animationEnabled]);

  return (
    <div className={`pet-avatar ${size} theme-${theme} state-${visualState}${heldItem ? ' is-holding' : ''}${animationEnabled ? '' : ' motion-disabled'}`} data-gesture={gesture} aria-label={`${translate(language, 'app.name')}正在${translate(language, VISUAL_STATE_KEYS[visualState])}`}>
      <div className="pet-shadow" />
      <div className="pet-orbit" ref={rig}>
        <div className="pet-squish">
          <div className="pet-character">
            <div className="pet-leaf leaf-back" />
            <div className="pet-leaf" />
            <div className="pet-body">
              <div className="pet-gloss" />
              <div className="pet-belly" />
              <div className="pet-face">
                <span className="pet-brow left" /><span className="pet-brow right" />
                <span className="pet-eye" /><span className="pet-eye" />
                <span className="pet-mouth" />
                <span className="pet-blush left" /><span className="pet-blush right" />
              </div>
            </div>
            <div className="pet-feet"><span className="pet-foot" /><span className="pet-foot" /></div>
            {heldItem && <div className="pet-held-item">{heldItem}</div>}
            <div className="pet-arms"><span className="pet-arm left" /><span className="pet-arm right" /></div>
            <div className="pet-expression-sparks" aria-hidden="true"><span /><span /><span /></div>
            <div className="pet-emotion-symbol" aria-hidden="true">
              {visualState === 'loved' ? '♥' : visualState === 'sad' ? '…' : visualState === 'angry' ? '♨' : visualState === 'dizzy' ? '✧' : visualState === 'sleepy' ? 'z' : '✦'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
