import type { AppLanguage } from './types';

const DEFAULT_DISPLAY_NAME = '主人';
const DEFAULT_PET_NAME = '小番茄';

function clean(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

/**
 * 让宠物偶尔把称呼放进话里。variation 由调用方控制，便于回归测试和避免每次渲染变话。
 */
export function personalizePetSpeech(
  message: string,
  displayName?: string,
  petName?: string,
  variation = 0,
  language: AppLanguage = 'zh-CN',
): string {
  const user = clean(displayName, DEFAULT_DISPLAY_NAME);
  const pet = clean(petName, DEFAULT_PET_NAME);
  const variants = language === 'en'
    ? [message, `${user}, ${message}`, `${pet} says: ${message}`, `${user}, ${pet} is with you: ${message}`]
    : language === 'ja'
      ? [message, `${user}さん、${message}`, `${pet}からのお知らせ：${message}`, `${user}さん、${pet}と一緒に${message}`]
      : language === 'ko'
        ? [message, `${user}님, ${message}`, `${pet} 알림: ${message}`, `${user}님, ${pet}와 함께 ${message}`]
        : language === 'ar'
          ? [message, `${user}، ${message}`, `${pet} يذكّرك: ${message}`, `${user}، ${pet} معك: ${message}`]
          : [message, `${user}，${message}`, `${pet}提醒你：${message}`, `${user}，${pet}陪你${message}`];
  return variants[Math.abs(Math.trunc(variation)) % variants.length];
}

