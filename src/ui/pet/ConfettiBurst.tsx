import type { CSSProperties } from 'react';

const COLORS = ['#f88776', '#ffd278', '#95d2b4', '#b1a4ef', '#ffe9b5', '#f5a7c4'];

export function ConfettiBurst({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="confetti-burst" data-testid="confetti-burst" aria-hidden="true">
      {Array.from({ length: 40 }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const style = {
          '--confetti-x': `${side * (24 + (index * 19) % 88)}px`,
          '--confetti-arc': `${-65 - (index * 13) % 92}px`,
          '--confetti-end': `${45 + (index * 11) % 60}px`,
          '--confetti-turn': `${side * (160 + index * 29)}deg`,
          '--confetti-delay': `${Math.floor(index / 10) * 170 + (index % 5) * 22}ms`,
          backgroundColor: COLORS[index % COLORS.length],
        } as CSSProperties;
        return <span key={index} className={`confetti-piece confetti-shape-${index % 3}`} style={style} />;
      })}
    </div>
  );
}
