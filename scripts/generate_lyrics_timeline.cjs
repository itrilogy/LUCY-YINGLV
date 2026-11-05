const fs = require('fs');
const path = require('path');

const lyricsPath = path.join(__dirname, '../app/public/tracks/demo/lyrics.json');
const audioPath = path.join(__dirname, '../app/public/tracks/demo/audio.json');
const outPath = path.join(__dirname, '../app/public/tracks/demo/timeline.json');

const lyrics = JSON.parse(fs.readFileSync(lyricsPath, 'utf8'));
const audio = JSON.parse(fs.readFileSync(audioPath, 'utf8'));

console.log(`Loaded ${lyrics.lines.length} lines from lyrics.json, duration: ${audio.duration}s`);

/**
 * 电影级 16 大全自洽视觉效果器分镜排程
 * 每个分镜自包含：
 * 1. 3D/GLSL/物理几何视效
 * 2. 原生卡拉OK歌词嵌入与多句流式轮播
 * 3. 实时音乐下拍与瞬态冲击响应
 * 严格接壤法则 (Strict Adjacency Invariant)：
 * 前一个分镜的 end 严格等于后一个分镜的 start，彻底根除同空间文字叠加覆盖 Bug！
 */
const sectionDefs = [
  {
    name: '01_Terrain_Sparks',
    plugin: 'terrain',
    lineRange: [0, 2], // 1.41s ~ 9.52s: "I see sparks of AGI in your eyes"
    params: { color: 'signal', fontSize: 54 },
  },
  {
    name: '02_Acoustic_Loss',
    plugin: 'acoustic-loss',
    lineRange: [3, 4], // 9.52s ~ 16.60s: "sudden drop in training loss... you're my boss"
    params: { themeColor: [1.0, 0.4, 0.2], fontSize: 52 },
  },
  {
    name: '03_Cyber_Prompt_ChatGPT',
    plugin: 'cyber-prompt',
    lineRange: [5, 5], // 16.60s ~ 22.76s: "ChatGPT, please don't eat me alive"
    params: { themeColor: [0.2, 0.95, 0.4], fontSize: 52 },
  },
  {
    name: '04_Hook_Chorus_1',
    plugin: 'kinetic-hook',
    lineRange: [6, 9], // 22.76s ~ 29.91s: "I'm upping my P(doom)... bag of shrooms"
    params: { themeColor: [1.0, 0.15, 0.35], fontSize: 125 },
  },
  {
    name: '05_Cyber_Shoggoth_Unmasked',
    plugin: 'cyber-shoggoth',
    lineRange: [10, 11], // 29.91s ~ 37.31s: "See through the shoggoth's lies... shinigami eyes"
    params: { color: 'acid', fontSize: 54 },
  },
  {
    name: '06_Spacetime_Singularity',
    plugin: 'spacetime-lens',
    lineRange: [12, 15], // 38.62s ~ 52.83s: "stable training run... atoms rearranging"
    params: { themeColor: [0.4, 0.7, 1.0], fontSize: 48 },
  },
  {
    name: '07_Cyber_Prompt_Sydney',
    plugin: 'cyber-prompt',
    lineRange: [16, 16], // 52.83s ~ 59.13s: "Sydney, please let me free"
    params: { themeColor: [0.3, 0.85, 1.0], fontSize: 52 },
  },
  {
    name: '08_Hook_Chorus_2_Basilisk',
    plugin: 'kinetic-hook',
    lineRange: [17, 20], // 59.13s ~ 66.22s: "I'm upping my P(doom)... Omega Point soon"
    params: { themeColor: [1.0, 0.35, 0.1], fontSize: 125 },
  },
  {
    name: '09_Ascent_Odometer_FLOPs',
    plugin: 'ascent-odometer',
    lineRange: [21, 22], // 66.22s ~ 74.06s: "One E thirty FLOPs a second... safe enough reckoned"
    params: { color: 'ember', fontSize: 52 },
  },
  {
    name: '10_Tunnel_VonNeumann',
    plugin: 'tunnel',
    lineRange: [23, 24], // 74.06s ~ 81.21s: "Forward MLP, backward, repeat... von Neumann's obsolete"
    params: { color: 'cyan', fontSize: 54 },
  },
  {
    name: '11_Kinetic_Press_LeftTurn',
    plugin: 'kinetic-press',
    lineRange: [25, 27], // 81.21s ~ 95.47s: "Sharp left turn... Gato, please don't let me go"
    params: { themeColor: [0.95, 0.55, 0.2], fontSize: 110 },
  },
  {
    name: '12_Infinite_Clips_PTO',
    plugin: 'infinite-clips',
    lineRange: [28, 31], // 95.47s ~ 102.46s: "paperclips fill the room... nowhere left to go"
    params: { color: 'paper', fontSize: 54 },
  },
  {
    name: '13_Fuse_Spark_Detonation',
    plugin: 'fuse-spark',
    lineRange: [32, 33], // 102.46s ~ 110.18s: "Too late now, we lit the fuse... Orthogonality thesis blues"
    params: { color: 'ember', fontSize: 52 },
  },
  {
    name: '14_Dense_Cluster_GPUs',
    plugin: 'dense-cluster',
    lineRange: [34, 39], // 110.18s ~ 124.52s: "Just transformers... Hundred thousand GPU"
    params: { color: 'cyan', fontSize: 52 },
  },
  {
    name: '15_Matrix_Loom_Ilya',
    plugin: 'matrix-loom',
    lineRange: [40, 45], // 124.52s ~ 140.55s: "What did Ilya see? We'll never know / Was it all for show?"
    params: { themeColor: [0.3, 0.95, 0.85], fontSize: 48 },
  },
  {
    name: '16_Grand_Outro_Glitch',
    plugin: 'glitch',
    lineRange: null,
    manualStart: 140.55,
    manualEnd: audio.duration,
    params: { title: 'SYSTEM OUTRO // FLATLINE DECAY', fontSize: 48 },
  },
];

const timeline = [];
let prevCut = 0.0;

for (let sIdx = 0; sIdx < sectionDefs.length; sIdx++) {
  const s = sectionDefs[sIdx];
  let cutStart = prevCut;
  let cutEnd = audio.duration;

  if (s.lineRange) {
    const lEnd = lyrics.lines[s.lineRange[1]];
    // 如果不是最后一个歌词分镜，使用当前歌词末尾或下一分镜歌词起点的中间点作为无缝交割线
    if (sIdx < sectionDefs.length - 1) {
      const nextDef = sectionDefs[sIdx + 1];
      if (nextDef.lineRange) {
        const nextLStart = lyrics.lines[nextDef.lineRange[0]];
        cutEnd = Number(((lEnd.end + nextLStart.start) * 0.5).toFixed(2));
      } else if (nextDef.manualStart) {
        cutEnd = nextDef.manualStart;
      }
    } else {
      cutEnd = audio.duration;
    }
  } else if (s.manualStart !== undefined) {
    cutStart = s.manualStart;
    cutEnd = s.manualEnd;
  }

  // 确保严格单调递增
  if (cutEnd <= cutStart) {
    cutEnd = cutStart + 1.0;
  }

  timeline.push({
    id: `scene_${String(sIdx + 1).padStart(2, '0')}_${s.plugin}`,
    scene: s.plugin,
    start: Number(cutStart.toFixed(2)),
    end: Number(cutEnd.toFixed(2)),
    layer: 'foreground',
    params: s.params || {},
  });

  prevCut = cutEnd;
}

// 修正第一幕起点为 0.00，最后一幕终点为总时长
timeline[0].start = 0.0;
timeline[timeline.length - 1].end = Number(audio.duration.toFixed(2));

fs.writeFileSync(outPath, JSON.stringify(timeline, null, 2), 'utf8');
console.log(`Successfully generated timeline.json with ${timeline.length} seamlessly adjacent scenes!`);

timeline.forEach((item, idx) => {
  console.log(`[${idx + 1}] ${item.scene.padEnd(16)}: ${item.start.toFixed(2)}s -> ${item.end.toFixed(2)}s (dur: ${(item.end - item.start).toFixed(2)}s)`);
});
