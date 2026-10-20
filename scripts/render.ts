import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
export function command(
  bin: string,
  args: string[],
  timeout = 180000,
): Promise<string> {
  return new Promise((ok, no) => {
    const p = spawn(bin, args, { shell: false, windowsHide: true });
    let out = "",
      err = "";
    const timer = setTimeout(() => {
      p.kill();
      no(Error("Tempo limite de processamento excedido"));
    }, timeout);
    p.stdout.on("data", (x) => {
      out = (out + x).slice(-30000);
    });
    p.stderr.on("data", (x) => {
      err = (err + x).slice(-3000);
    });
    p.on("error", () => {
      clearTimeout(timer);
      no(Error(`Executável indisponível: ${bin}`));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? ok(out)
        : no(Error(`Falha em ${bin} (${code}): ${err.slice(-500)}`));
    });
  });
}
export async function synthesize(
  text: string,
  voice: string,
  path: string,
  run = command,
) {
  if (voice === "none")
    return { audio: null, warning: "Narração desativada nesta página." };
  try {
    await run(
      process.env.PYTHON_BIN || "python",
      [
        "-m",
        "edge_tts",
        "--voice",
        voice,
        "--text",
        text,
        "--write-media",
        path,
        "--write-subtitles",
        path + ".srt",
        ...(process.env.HTTPS_PROXY
          ? ["--proxy", process.env.HTTPS_PROXY]
          : []),
      ],
      45000,
    );
    if ((await stat(path)).size < 100) throw Error("Áudio vazio");
    await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      path,
    ]);
    return { audio: path, warning: null };
  } catch {
    return {
      audio: null,
      warning:
        "Voz experimental indisponível: edge-tts ausente, bloqueado ou sem resposta. Vídeo gerado sem narração.",
    };
  }
}
export function captions(text: string, duration: number) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let at = 0;
  const total = sentences.reduce((n, s) => n + s.length, 0);
  const stamp = (n: number) => {
    const cs = Math.round(n * 100);
    return `0:${String(Math.floor(cs / 6000)).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
  };
  const lines = sentences.map((s) => {
    const start = at;
    at += (duration * s.length) / total;
    const words = s.replace(/[{}\\]/g, "").split(/\s+/);
    let wrapped = "",
      line = "";
    for (const w of words) {
      if ((line + " " + w).length > 29) {
        wrapped += line + "\\N";
        line = w;
      } else line += (line ? " " : "") + w;
    }
    return `Dialogue: 0,${stamp(start)},${stamp(at)},Default,,0,0,0,,${wrapped + line}`;
  });
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,62,&H00FFFFFF,&H00FFFFFF,&H00302010,&H90000000,-1,0,0,0,100,100,0,0,1,3,1,5,90,90,100,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${lines.join("\n")}\n`;
}
export async function validateVideo(path: string) {
  const info = JSON.parse(
    await command("ffprobe", [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      path,
    ]),
  );
  const v = info.streams.find((s: any) => s.codec_type === "video");
  const a = info.streams.find((s: any) => s.codec_type === "audio");
  const duration = Number(info.format.duration);
  if (
    !v ||
    v.width !== 1080 ||
    v.height !== 1920 ||
    v.codec_name !== "h264" ||
    duration < 14.9 ||
    duration > 30.2 ||
    (a && a.codec_name !== "aac")
  )
    throw Error("Vídeo fora dos parâmetros permitidos");
  await command("ffmpeg", ["-v", "error", "-i", path, "-f", "null", "-"]);
  return info;
}
export async function render(
  job: {
    id: string;
    text: string;
    duration: number;
    voice: string;
    visual?: string;
  },
  directory: string,
) {
  if (
    !/^[a-f0-9-]{36}$/.test(job.id) ||
    !Number.isInteger(job.duration) ||
    job.duration < 15 ||
    job.duration > 30 ||
    job.text.length < 20 ||
    job.text.length > 1400 ||
    !["none", "pt-BR-FranciscaNeural", "pt-BR-AntonioNeural"].includes(
      job.voice,
    )
  )
    throw Error("Parâmetros de renderização inválidos");
  const dir = resolve(directory);
  await mkdir(dir, { recursive: true });
  const audio = await synthesize(job.text, job.voice, join(dir, "voice.mp3"));
  let duration = job.duration;
  if (audio.audio) {
    const meta = JSON.parse(
      await command("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        audio.audio,
      ]),
    );
    duration = Number(meta.format.duration);
    if (duration < 15 || duration > 30)
      throw Error(
        "Narração fora de 15–30 segundos: encurte/ajuste o roteiro ou desative a voz.",
      );
  }
  const subtitle = join(dir, "captions.ass");
  await writeFile(subtitle, captions(job.text, duration));
  // FFmpeg filter paths require escaping independent of shell quoting (including Windows drives).
  const captionsPath = audio.audio ? audio.audio + ".srt" : subtitle;
  const filterPath = captionsPath
    .replaceAll("\\", "/")
    .replaceAll(":", "\\:")
    .replaceAll("'", "'\\''");
  const output = join(dir, "video.mp4");
  const args = [
    "-hide_banner",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${job.visual === "violeta" ? "0x281849" : "0x102a43"}:s=1080x1920:r=24:d=${duration}`,
  ];
  if (audio.audio) args.push("-i", audio.audio);
  args.push(
    "-vf",
    `subtitles=filename='${filterPath}'${audio.audio ? ":force_style='FontName=DejaVu Sans,FontSize=22,Alignment=5,MarginL=35,MarginR=35,Outline=2'" : ""}`,
    "-t",
    String(duration),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-threads",
    "2",
  );
  if (audio.audio) args.push("-c:a", "aac", "-b:a", "128k");
  else args.push("-an");
  args.push("-movflags", "+faststart", output);
  await command("ffmpeg", args, 240000);
  const info = await validateVideo(output);
  await command("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-ss",
    "1",
    "-i",
    output,
    "-frames:v",
    "1",
    join(dir, "thumbnail.jpg"),
  ]);
  await writeFile(join(dir, "script.txt"), job.text);
  await writeFile(
    join(dir, "metadata.json"),
    JSON.stringify(
      {
        id: job.id,
        origin: "Fundo gerado localmente por FFmpeg; roteiro interno revisável",
        publication: "manual",
        duration,
        voiceWarning: audio.warning,
        video: info,
      },
      null,
      2,
    ),
  );
  return { file: output, warning: audio.warning };
}
