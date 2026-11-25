// Encodes the recorder's frames (record_v7.cjs) at the recorder's frame rate and places the v2 narration clips at scene starts.
// FPS=30 node video/mux_v2.cjs <out.mp4>      (frames and scenes.json are read from OUT, default /tmp/tdvid7)
// The narration clips are in narration_v2/ (voice.txt says how they were made).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const FPS = +(process.env.FPS || 30), out = process.argv[2], OUT = process.env.OUT || '/tmp/tdvid7';
const scenes = JSON.parse(fs.readFileSync(OUT + '/scenes.json', 'utf8'));
const NARR = path.join(__dirname, process.env.LANG2 === 'ko' ? 'narration_v2_ko' : 'narration_v2');
// scenes.json names the audio file of each scene (lines rewritten after the review use nNNb.wav)
const clips = scenes.map(s => ({ ...s, f: path.join(NARR, s.f || `n${String(s.n).padStart(2, '0')}.wav`) })).filter(c => fs.existsSync(c.f));
const inputs = clips.map(c => `-i "${c.f}"`).join(' ');
// each line starts 0.3 s after its scene, the same offset the recorder uses for the subtitles
const delays = clips.map((c, i) => `[${i + 1}:a]${process.env.LANG2 === 'ko' ? 'atempo=1.1,' : ''}adelay=${Math.round((c.t + 0.3) * 1000)}:all=1,aresample=48000[a${i}]`).join(';');
const mix = clips.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${clips.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`;
execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${OUT}/f/%05d.jpg ${inputs} -filter_complex "${delays};${mix}" -map 0:v -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -movflags +faststart -c:a aac -b:a 160k -ar 48000 -ac 2 -shortest "${out}"`, { stdio: 'inherit' });
console.log('clips', clips.length);
