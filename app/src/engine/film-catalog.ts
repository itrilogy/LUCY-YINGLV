import type { PluginMeta } from './tag-system.ts';

function plate(
  id: string,
  zhName: string,
  scene: string,
  description: string,
  extra: Partial<PluginMeta> = {},
): PluginMeta {
  return {
    id,
    name: id,
    zhName,
    sourceScene: scene,
    layerRole: 'background',
    origin: 'film',
    kind: 'plate',
    styles: ['style_cyber_brutalism'],
    imageries: ['img_singularity'],
    acousticFocus: ['kick', 'lead-vocal'],
    recommendedPaces: ['medium'],
    description,
    promptGuidance: '原片整幕。可单独成镜，或只作为背景层。它自己会画字幕。',
    ...extra,
  };
}

/** Original film scenes, wrapped so the assembler can mount them by plugin id. */
export const FILM_PLATES: PluginMeta[] = [
  plate('plate-open', '原片 · 开场几何', 'open.ts', '原片开场：暗场几何和第一句火花。'),
  plate('plate-loss', '原片 · 损失坠落', 'loss.ts', '原片损失段：突然下跌的折线和空场。'),
  plate('plate-prompt-chatgpt', '原片 · 提示词 ChatGPT', 'prompt.ts', '原片副歌前：ChatGPT 喉管把词吸进去。', { paramsHint: { variant: 'chatgpt' } }),
  plate('plate-prompt-sydney', '原片 · 提示词 Sydney', 'prompt.ts', '原片副歌前：Sydney 竖条随拍合拢。', { paramsHint: { variant: 'sydney' } }),
  plate('plate-prompt-gato', '原片 · 提示词 Gato', 'prompt.ts', '原片副歌前：字母散开，光标停在末字。', { paramsHint: { variant: 'gato' } }),
  plate('plate-hook-1', '原片 · 副歌 1', 'hook.ts', '原片副歌第一种砸法：骨色落在墨底上。', { paramsHint: { n: 1 } }),
  plate('plate-hook-2', '原片 · 副歌 2', 'hook.ts', '原片副歌第二种：信号场在 DOOM 上合眼。', { paramsHint: { n: 2 } }),
  plate('plate-hook-3', '原片 · 副歌 3', 'hook.ts', '原片副歌第三种：发丝一样细的黑场。', { paramsHint: { n: 3 } }),
  plate('plate-hook-4', '原片 · 副歌 4', 'hook.ts', '原片副歌第四种：描边叠到断线。', { paramsHint: { n: 4 } }),
  plate('plate-room', '原片 · 控制室', 'room.ts', '原片控制室：多屏和 P(doom) 读数。'),
  plate('plate-shoggoth', '原片 · 修格斯', 'shoggoth.ts', '原片修格斯。采样很重，挂上后时间轴会把 maxSamples 收到 108。', { maxSamples: 108 }),
  plate('plate-spacetime', '原片 · 时空透镜', 'spacetime.ts', '原片时空：稳定轨道被拉弯。'),
  plate('plate-ascent', '原片 · 算力天梯', 'ascent.ts', '原片上升：眼和里程一起爬。'),
  plate('plate-bureau', '原片 · 官僚印章', 'bureau.ts', '原片公文和红章。'),
  plate('plate-leftturn', '原片 · 急左转', 'leftturn.ts', '原片左转：地图和甘特一起拐。'),
  plate('plate-paperclips', '原片 · 回形针', 'paperclips.ts', '原片回形针晶格。'),
  plate('plate-fuse', '原片 · 引信', 'fuse.ts', '原片引信沿着音高烧。'),
  plate('plate-stack', '原片 · 硬件栈', 'stack.ts', '原片从晶圆走到机架。'),
  plate('plate-dense', '原片 · 密集集群', 'dense.ts', '原片密集算力段。'),
  plate('plate-loom', '原片 · 织机', 'loom.ts', '原片织机和经线。'),
  plate('plate-ilya', '原片 · Ilya', 'ilya.ts', '原片 Ilya 房间。'),
  plate('plate-outro', '原片 · 尾奏回放', 'outro.ts', '原片尾奏：把前面的板子再放一遍。'),
];
