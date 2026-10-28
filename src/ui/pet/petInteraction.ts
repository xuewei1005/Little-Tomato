import type { PetVisualState } from '../../domain/types';
import type { AppLanguage } from '../../domain/types';
import { translate } from '../../i18n/catalog';

export const PET_ACTION_EVENT = 'pet-play-action';

export interface PetHitRegion {
  rect: { left: number; top: number; width: number; height: number };
  shape: 'ellipse' | 'rectangle';
}

export function pointInPetRegion(x: number, y: number, regions: PetHitRegion[]): boolean {
  return regions.some(({ rect, shape }) => {
    if (rect.width <= 0 || rect.height <= 0) return false;
    const dx = (x - rect.left) / rect.width;
    const dy = (y - rect.top) / rect.height;
    if (shape === 'rectangle') return dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1;
    return ((dx - 0.5) / 0.5) ** 2 + ((dy - 0.5) / 0.5) ** 2 <= 1;
  });
}

const REACTIONS: Array<{ state: PetVisualState; message: string }> = [
  // 摸摸头
  { state: 'happy', message: '嘿嘿，叶子都开心得翘起来啦！' },
  { state: 'loved', message: '再摸一下嘛，就一下！' },
  { state: 'bounce', message: '呜哇！被发现喜欢摸头了！' },
  { state: 'loved', message: '唔……这里好舒服呀～' },
  { state: 'thinking', message: '我的叶子是不是乱啦？' },
  { state: 'happy', message: '嘿嘿，今天也是乖番茄！' },
  { state: 'sleepy', message: '呼噜呼噜……番茄充电中' },
  { state: 'bounce', message: '再摸就要长高一厘米啦！' },
  { state: 'loved', message: '你手心暖暖的耶' },
  { state: 'loved', message: '哎呀，脸蛋要红透啦！' },
  { state: 'wink', message: '这就是传说中的摸头杀吗？' },
  { state: 'happy', message: '嘿嘿，我把开心分你一半！' },
  { state: 'stretch', message: '叶子说它还想再来一次' },
  { state: 'happy', message: '哇！幸福值偷偷加一！' },
  { state: 'loved', message: '嗯嗯，批准你继续摸！' },
  // 点击戳戳
  { state: 'bounce', message: '啵！你戳到一颗小番茄！' },
  { state: 'sad', message: '哎哟！我的番茄肚肚！' },
  { state: 'thinking', message: '咦？是谁在敲门呀？' },
  { state: 'happy', message: '戳一下，快乐冒泡泡！' },
  { state: 'bounce', message: '噗叽！番茄弹性测试通过！' },
  { state: 'angry', message: '再戳就要变番茄酱啦！' },
  { state: 'angry', message: '嘿！我也是有脾气的番茄！' },
  { state: 'bounce', message: '啊呜！抓到一根手指！' },
  { state: 'dizzy', message: '咕叽咕叽，什么声音？' },
  { state: 'angry', message: '不许戳！除非再戳一下' },
  { state: 'thinking', message: '我怀疑你在测试我的手感' },
  { state: 'happy', message: '叮！你获得一只傻番茄' },
  { state: 'wink', message: '嘿嘿，我就知道你会来找我' },
  { state: 'wink', message: '你是不是偷偷喜欢我呀？' },
  { state: 'thinking', message: '番茄雷达检测到一只手指！' },
  // 拖动与移动
  { state: 'spin', message: '芜湖！番茄起飞啦！' },
  { state: 'dizzy', message: '慢点慢点，叶子要飞走啦！' },
  { state: 'bounce', message: '哇！今天坐的是手指飞机！' },
  { state: 'thinking', message: '我们这是要去哪里探险？' },
  { state: 'spin', message: '咻——番茄空中运输中！' },
  { state: 'sad', message: '等等！我的小短腿跟不上！' },
  { state: 'happy', message: '新家不错嘛，风水很好！' },
  { state: 'dizzy', message: '我晕啦，我是一颗晕茄' },
  { state: 'happy', message: '这里视野不错，批准入住！' },
  { state: 'thinking', message: '你搬家怎么不提前通知我！' },
  // 专注开始
  { state: 'focus', message: '好！启动认真番茄模式！' },
  { state: 'happy', message: '你负责努力，我负责可爱！' },
  { state: 'focus', message: '嘘……我们悄悄变厉害' },
  { state: 'focus', message: '番茄特工，准备就位！' },
  { state: 'focus', message: '这次就专心做一件事吧！' },
  { state: 'focus', message: '我来帮你看着时间，放心！' },
  { state: 'bounce', message: '开工啦！叶子都竖起来了！' },
  { state: 'focus', message: '先做五分钟也很棒呀！' },
  { state: 'focus', message: '小番茄已进入陪伴状态' },
  { state: 'happy', message: '冲呀！但不要冲过头哦！' },
  // 专注结束与任务完成
  { state: 'celebrate', message: '哇！你真的做到了耶！' },
  { state: 'celebrate', message: '撒花！撒花！番茄开派对！' },
  { state: 'celebrate', message: '任务完成！奖励一个番茄抱抱！' },
  { state: 'happy', message: '嘿嘿，我就知道你可以！' },
  { state: 'celebrate', message: '今天的你，又偷偷厉害了一点！' },
  { state: 'celebrate', message: '噔噔！番茄颁奖典礼开始！' },
  { state: 'loved', message: '辛苦啦！给你盖个小红章！' },
  { state: 'celebrate', message: '好耶！我们又赢了一小局！' },
  { state: 'celebrate', message: '完成啦！叶子开心得打结！' },
  { state: 'loved', message: '这颗番茄为你感到骄傲！' },
  { state: 'celebrate', message: '啪叽！送你一枚空气奖牌！' },
  { state: 'celebrate', message: '任务消灭！番茄小队获胜！' },
  { state: 'bounce', message: '我已经开心得原地发芽啦！' },
  { state: 'celebrate', message: '今天的成就，值得一颗星星！' },
  { state: 'stretch', message: '嘿嘿，休息一下再出发吧！' },
  // 休息与犯困
  { state: 'sleepy', message: '哈欠……叶子都困弯啦' },
  { state: 'sleepy', message: '我先眯一小会儿，就一小会儿' },
  { state: 'sleepy', message: '嘘……番茄正在做甜甜的梦' },
  { state: 'sleepy', message: '你也累了吗？一起发会儿呆吧' },
  { state: 'sleepy', message: '呼……呼……番茄睡着啦' },
  { state: 'stretch', message: '再忙也要让脑袋透透气呀' },
  { state: 'thinking', message: '今天的云，像不像棉花糖？' },
  { state: 'thinking', message: '我在认真研究怎么偷懒' },
  { state: 'sleepy', message: '休息时间到！番茄宣布放假！' },
  { state: 'loved', message: '你休息，我负责守护桌面！' },
  // 长时间没有互动
  { state: 'sad', message: '咦？你是不是忘记这里有颗番茄？' },
  { state: 'thinking', message: '我刚刚和桌面壁纸聊了会儿天' },
  { state: 'happy', message: '嘿嘿，你终于回来啦！' },
  { state: 'thinking', message: '我数了好多片不存在的叶子' },
  { state: 'loved', message: '你不在的时候，我很乖哦！' },
  { state: 'sad', message: '我差点以为自己是桌面图标' },
  { state: 'thinking', message: '刚才有只鼠标从我旁边路过！' },
  { state: 'happy', message: '欢迎回来！番茄没有偷吃东西！' },
  { state: 'loved', message: '我一直在这里偷偷长可爱' },
  { state: 'happy', message: '你忙你的，我也会自己玩！' },
  // 调皮吐槽
  { state: 'thinking', message: '你怎么又在看我？工作呢！' },
  { state: 'wink', message: '我怀疑你在摸鱼，但我没证据' },
  { state: 'happy', message: '你负责赚钱，我负责卖萌！' },
  { state: 'thinking', message: '我的工作是陪你，你的工作呢？' },
  { state: 'angry', message: '不要再戳啦！番茄也有尊严！' },
  { state: 'happy', message: '今天的工作进度：番茄很满意！' },
  { state: 'thinking', message: '别看我，我也不知道怎么写代码' },
  { state: 'wink', message: '你再发呆，我就陪你一起发呆！' },
  { state: 'sad', message: '我只是颗番茄，压力不要给我呀！' },
  { state: 'bounce', message: '你是不是把我当解压球啦？' },
  // 隐藏彩蛋
  { state: 'thinking', message: '嘘……其实我是一颗草莓卧底' },
  { state: 'spin', message: '据说连续摸头十次，会召唤番茄王' },
  { state: 'dizzy', message: '我昨天梦见自己变成了西红柿炒蛋' },
  { state: 'thinking', message: '不要告诉别人，我偷偷学会了光合作用' },
  { state: 'happy', message: '我的终极梦想，是拥有自己的小花盆！' },
];

export function pickPetReaction(random: () => number = Math.random): { state: PetVisualState; message: string } {
  const sample = random();
  const value = Number.isFinite(sample) ? Math.min(0.999999, Math.max(0, sample)) : 0;
  return REACTIONS[Math.floor(value * REACTIONS.length)] ?? REACTIONS[0];
}

const REACTION_KEYS: Partial<Record<PetVisualState, string>> = {
  happy: 'pet.reaction.happy', loved: 'pet.reaction.loved', bounce: 'pet.reaction.bounce', thinking: 'pet.reaction.thinking', sleepy: 'pet.reaction.sleepy', wink: 'pet.reaction.wink', stretch: 'pet.reaction.stretch', angry: 'pet.reaction.angry', dizzy: 'pet.reaction.dizzy', spin: 'pet.reaction.spin', focus: 'pet.reaction.focus', celebrate: 'pet.reaction.celebrate', sad: 'pet.reaction.sad',
};

export function localizePetReaction(reaction: { state: PetVisualState; message: string }, language: AppLanguage): { state: PetVisualState; message: string } {
  if (language === 'zh-CN') return reaction;
  const key = REACTION_KEYS[reaction.state];
  return key ? { ...reaction, message: translate(language, key) } : reaction;
}
