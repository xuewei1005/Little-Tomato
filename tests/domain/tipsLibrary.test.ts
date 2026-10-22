import { describe, expect, it } from 'vitest';
import { chooseTip, getRandomTip, getTips, TIP_CATEGORIES, TIP_LIBRARY } from '../../src/domain/tipsLibrary';

describe('practical tips content', () => {
  it('offers exactly 200 distinct concise Chinese actions for a brief pet bubble', () => {
    const tips = getTips();

    expect(tips).toHaveLength(200);
    expect(new Set(tips).size).toBe(tips.length);
    for (const tip of tips) {
      expect(tip).toBe(tip.trim());
      expect(Array.from(tip).length, tip).toBeGreaterThanOrEqual(6);
      expect(Array.from(tip).length, tip).toBeLessThanOrEqual(32);
      expect(tip).toMatch(/[\u4e00-\u9fff]/u);
      expect(tip).not.toMatch(/[\r\n]|https?:|API|SettingsWindow|安装|打包|治愈|稳赚|保证收益|永远|绝不|一定能|排毒/u);
    }
  });

  it('covers distinct movement, work, social and money tasks', () => {
    const tips = getTips();

    for (const action of [/桌面/u, /下班/u, /走/u, /第一.*步/u, /关系/u, /订阅/u, /购物/u, /睡/u]) {
      expect(tips.some((tip) => action.test(tip)), action.source).toBe(true);
    }
  });

  it('keeps all eight categories substantial and every record uniquely identifiable', () => {
    expect(TIP_CATEGORIES).toEqual(['身体与久坐', '用眼、睡眠、饮食', '工作效率', '心理减压', '情绪与人际', '财务与生活', '环境与习惯', '生活灵感与小确幸']);
    expect(TIP_LIBRARY.map(({ text }) => text)).toEqual(getTips());
    expect(new Set(TIP_LIBRARY.map(({ id }) => id)).size).toBe(TIP_LIBRARY.length);
    expect(new Set(getTips().map((text) => text.replace(/[\p{P}\p{Z}\s]/gu, ''))).size).toBe(TIP_LIBRARY.length);

    for (const category of TIP_CATEGORIES) {
      expect(TIP_LIBRARY.filter((tip) => tip.category === category), category).toHaveLength(25);
    }
    for (const tip of TIP_LIBRARY) {
      expect(tip.id).toMatch(/^[a-z]+-\d+$/u);
      expect(TIP_CATEGORIES).toContain(tip.category);
    }
  });

  it('keeps health, efficiency, psychology and daily-life content concrete', () => {
    expect(TIP_LIBRARY.filter((tip) => tip.category === '身体与久坐').some((tip) => /走|伸|坐姿/u.test(tip.text))).toBe(true);
    expect(TIP_LIBRARY.filter((tip) => tip.category === '工作效率').some((tip) => /任务|专注|完成/u.test(tip.text))).toBe(true);
    expect(TIP_LIBRARY.filter((tip) => tip.category === '心理减压').some((tip) => /呼吸|担心|情绪/u.test(tip.text))).toBe(true);
    expect(TIP_LIBRARY.filter((tip) => tip.category === '财务与生活').some((tip) => /消费|会员|预算/u.test(tip.text))).toBe(true);
  });

  it('protects public records and category lists against shared-state mutation', () => {
    expect(() => Object.assign(TIP_LIBRARY[0], { text: 'changed' })).toThrow(TypeError);
    expect(() => Object.assign(TIP_LIBRARY, { 0: TIP_LIBRARY[1] })).toThrow(TypeError);
    expect(() => Object.assign(TIP_CATEGORIES, { 0: 'changed' })).toThrow(TypeError);
    expect(getTips()[0]).toBe(TIP_LIBRARY[0].text);
  });

  it('returns a fresh text list so a caller cannot empty the shared library', () => {
    const original = getTips();
    getTips().splice(0);

    expect(getTips()).toEqual(original);
    expect(getRandomTip(() => 0)).toBe(original[0]);
  });
});

describe('practical tip selection', () => {
  it('returns categorized records with the same selection rules as the text API', () => {
    const record = chooseTip({ random: () => 0, category: '财务与生活' });

    expect(record.category).toBe('财务与生活');
    expect(record.id).toBe('money-1');
    expect(record.text).toBe(getRandomTip(() => 0, { category: '财务与生活' }));
    expect(chooseTip({ random: () => 0, category: '财务与生活', previousTip: record.text }).id).toBe('money-2');
    expect(TIP_LIBRARY).toContain(chooseTip());
  });

  it('preserves no-argument and injected-random string calls without global history', () => {
    const first = getTips()[0];

    expect(getTips()).toContain(getRandomTip());
    expect(getRandomTip(() => 0)).toBe(first);
    getRandomTip(() => 0.5);
    expect(getRandomTip(() => 0)).toBe(first);
  });

  it('makes every tip reachable with one evenly spaced draw per entry', () => {
    const tips = getTips();
    const selected = tips.map((_, index) => getRandomTip(() => (index + 0.5) / tips.length));

    expect(selected).toEqual(tips);
  });

  it.each([
    [0, 'first'],
    [-0.1, 'first'],
    [Number.NaN, 'first'],
    [Number.NEGATIVE_INFINITY, 'first'],
    [Number.POSITIVE_INFINITY, 'first'],
    [0.999999999, 'last'],
    [1, 'last'],
    [1.1, 'last'],
  ] as const)('keeps RNG sample %s in range (%s)', (sample, endpoint) => {
    const tips = getTips();

    expect(getRandomTip(() => sample)).toBe(endpoint === 'first' ? tips[0] : tips[tips.length - 1]);
  });

  it('avoids consecutive repeats with a constant generator and one draw per selection', () => {
    let previousTip = getRandomTip(() => 0);
    let draws = 0;
    const constantRandom = () => {
      draws += 1;
      return 0;
    };

    for (let index = 0; index < 20; index += 1) {
      const next = getRandomTip(constantRandom, { previousTip });
      expect(next).not.toBe(previousTip);
      expect(getTips()).toContain(next);
      previousTip = next;
    }
    expect(draws).toBe(20);
  });

  it('excludes any previous entry before sampling, including at RNG boundaries', () => {
    for (const previousTip of getTips()) {
      for (const sample of [0, 0.5, 1, -1, Number.NaN]) {
        expect(getRandomTip(() => sample, { previousTip })).not.toBe(previousTip);
      }
    }
  });

  it.each(TIP_CATEGORIES)('selects every entry within %s', (category) => {
    const tips = TIP_LIBRARY.filter((tip) => tip.category === category);
    const selected = tips.map((_, index) => getRandomTip(() => (index + 0.5) / tips.length, { category }));

    expect(selected).toEqual(tips.map(({ text }) => text));
    expect(getRandomTip(() => 1, { category })).toBe(tips[tips.length - 1].text);
  });

  it('combines category filtering with repeat exclusion', () => {
    const moneyTips = TIP_LIBRARY.filter((tip) => tip.category === '财务与生活');

    expect(getRandomTip(() => 0, { category: '财务与生活', previousTip: moneyTips[0].text })).toBe(moneyTips[1].text);
    expect(getRandomTip(() => 1, { category: '财务与生活', previousTip: moneyTips[moneyTips.length - 1].text }))
      .toBe(moneyTips[moneyTips.length - 2].text);
  });

  it('ignores a previous tip absent from the candidate pool', () => {
    const firstMoneyTip = TIP_LIBRARY.find((tip) => tip.category === '财务与生活')!;

    expect(getRandomTip(() => 0, { previousTip: 'an older tip no longer in the library' })).toBe(getTips()[0]);
    expect(getRandomTip(() => 0, { category: '财务与生活', previousTip: getTips()[0] })).toBe(firstMoneyTip.text);
  });

  it('accepts selection options while using the default random source', () => {
    const previousTip = getTips()[0];
    const next = getRandomTip(undefined, { category: '身体与久坐', previousTip });

    expect(next).not.toBe(previousTip);
    expect(TIP_LIBRARY.filter((tip) => tip.category === '身体与久坐').map(({ text }) => text)).toContain(next);
  });
});
