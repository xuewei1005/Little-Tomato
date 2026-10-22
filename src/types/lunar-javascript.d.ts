declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
    toYmd(): string;
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar;
    getSolar(): Solar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    toString(): string;
  }

  export class LunarMonth {
    static fromYm(year: number, month: number): LunarMonth | null;
    getYear(): number;
    getMonth(): number;
    getDayCount(): number;
    next(months: number): LunarMonth;
  }

  export class LunarYear {
    static fromYear(year: number): LunarYear;
    getMonthsInYear(): LunarMonth[];
  }
}
