"""Builds the launch film: JPEG frames + music + sfx -> mp4. Usage: python3 video/mix.py FRAMES_DIR OUT_DIR
Music: Sascha Ende, ende.app (CC BY 4.0). SFX: Kenney.nl (CC0)."""
import subprocess, sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent; A = HERE / "audio"
frames, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
VERT = 'vertical' in sys.argv; NAME = 'launch-vertical' if VERT else 'launch'; SIZE = 'scale=720:1280:flags=lanczos' if VERT else 'scale=1280:720:flags=lanczos'
DUR = 21.83
CUTS = [3.01, 7.35, 11.47, 15.82]
sfx = []  # (file, time, volume)
for c in CUTS: sfx.append(("impactSoft_medium_001.ogg", c - 0.14, 0.9))
for t in (4.10, 5.19, 8.22, 9.83, 13.11, 14.20): sfx.append(("bong_001.ogg", t, 0.55))
sfx += [("click2.ogg", 9.29, 0.9), ("click2.ogg", 14.20, 0.9)]
for i in range(22): sfx.append(("keypress-00%d.wav" % (1 if i % 2 else 3), 12.02 + i * 0.07, 0.35))
sfx += [("impactSoft_medium_004.ogg", 18.55, 1.0), ("bong_001.ogg", 20.19, 0.8)]
cmd = ["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(frames / "f%04d.jpg"), "-i", str(A / "music-vol10-trim.mp3")]
for f, _, _ in sfx: cmd += ["-i", str(A / f)]
fc = [f"[1:a]atrim=0:{DUR},afade=t=in:d=0.5,afade=t=out:st={DUR-1.8}:d=1.8,volume=0.62[m]"]
labs = ["[m]"]
for i, (f, t, v) in enumerate(sfx):
    ms = int(t * 1000); fc.append(f"[{i+2}:a]volume={v},adelay={ms}|{ms}[s{i}]"); labs.append(f"[s{i}]")
fc.append("".join(labs) + f"amix=inputs={len(labs)}:normalize=0:duration=first,alimiter=limit=0.95,atrim=0:{DUR}[a]")
base = cmd + ["-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[a]", "-t", str(DUR), "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]
subprocess.check_call(base + ["-vf", SIZE, "-crf", "24", "-preset", "slow", str(out / (NAME + ".mp4"))])
subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", str(frames / "f0618.jpg"), "-vf", SIZE, "-q:v", "3", str(out / (NAME + "-poster.jpg"))])
print("done")
