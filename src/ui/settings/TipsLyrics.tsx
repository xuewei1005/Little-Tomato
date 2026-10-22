import { useEffect, useRef, useState } from 'react';
import { getTips } from '../../domain/tipsLibrary';
import { useI18n } from '../../i18n/I18nProvider';

function shuffledTips(language: Parameters<typeof getTips>[0]): string[] {
  const result = getTips(language);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** A shuffled, non-repeating cycle with a lyric-like moving focal line. */
export function TipsLyrics() {
  const { language, t } = useI18n();
  const [playlist, setPlaylist] = useState(() => shuffledTips(language));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [moving, setMoving] = useState(false);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advance = () => {
    if (moving) return;
    setMoving(true);
    transitionRef.current = setTimeout(() => {
      setIndex((current) => {
        if (current + 1 < playlist.length) return current + 1;
        setPlaylist(shuffledTips(language));
        return 0;
      });
      setMoving(false);
    }, 650);
  };
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(advance, 9_000);
    return () => clearInterval(timer);
  }, [paused, moving, playlist.length, language]);
  useEffect(() => {
    setPlaylist(shuffledTips(language));
    setIndex(0);
  }, [language]);
  useEffect(() => () => { if (transitionRef.current) clearTimeout(transitionRef.current); }, []);

  return <section className="card tips-lyrics-card" aria-label={t('tips.label')}>
    <div className="tips-lyrics-heading"><span>{t('tips.heading')}</span><span className="tips-playing" aria-hidden="true"><i /><i /><i /></span></div>
    <div className={`tips-lyrics-viewport ${moving ? 'is-moving' : ''}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="tips-lyrics-track">
        {[-2, -1, 0, 1, 2, 3].map((offset) => <p key={offset} className={`tip-lyric offset-${offset < 0 ? `minus${-offset}` : offset}`} aria-current={offset === 0 ? 'true' : undefined}>{playlist[(index + offset + playlist.length) % playlist.length]}</p>)}
      </div>
    </div>
    <div className="tips-lyrics-footer"><span>{String(index + 1).padStart(2, '0')} / {playlist.length}</span><button type="button" onClick={advance} aria-label={t('tips.next')}>{t('tips.next')} <span aria-hidden="true">↗</span></button></div>
  </section>;
}
