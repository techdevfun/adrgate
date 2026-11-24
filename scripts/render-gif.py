#!/usr/bin/env python3
"""Render demo/transcript.txt as a terminal-typing GIF.

The transcript is generated from real CLI runs (scripts/capture-demo.sh);
this script only renders it, never edits the content.

Frames are written as PNGs to a temp dir and encoded with ffmpeg
(streaming, low memory) instead of holding every frame in RAM.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import shutil
import subprocess
import sys
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRAMES_DIR = "/tmp/adrgate-gif-frames"

W = 1240
BG = (18, 18, 24)
FG = (220, 220, 220)
DIM = (150, 150, 160)
GREEN = (120, 220, 130)
YELLOW = (235, 200, 100)
RED = (240, 110, 110)
CYAN = (120, 200, 230)

font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 12)
bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 12)
LINE_H = 16

lines = open(os.path.join(ROOT, "demo", "transcript.txt")).read().splitlines()
# Wrap over-long lines at word boundaries for display only: the
# transcript itself is unchanged, but a long line would otherwise
# run off the right edge of the 1240px canvas.
# Wrap width 100 chars at font 12.
display_lines: list[str] = []
for _raw in lines:
    if len(_raw) <= 100:
        display_lines.append(_raw)
    else:
        display_lines.extend(
            textwrap.wrap(_raw, width=100, subsequent_indent="  ", break_on_hyphens=False)
        )
lines = display_lines
# Fixed-height scrolling terminal viewport: the transcript is long,
# so a full-height canvas OOMs the encoder. Show the last VIEW_LINES
# lines like a real terminal scrolling; content is unchanged.
VIEW_LINES = 38
H = 14 + VIEW_LINES * LINE_H + 44


def color_for(line: str):
    if line.startswith("$"):
        return GREEN
    if line.startswith("#"):
        return DIM
    if "FAIL" in line or "UNGOVERNED" in line or "REGRESSION" in line:
        return RED
    if "PASS" in line or "GOVERNED" in line or "no regressions" in line:
        return GREEN
    if line.startswith("summary:"):
        return CYAN
    if line.startswith("verdict:"):
        return YELLOW
    if line.startswith("  evidence:"):
        return CYAN
    if line.startswith("exit:"):
        return RED
    return FG


def render(canvas_tmp):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    y = 14
    for text, color in canvas_tmp[-VIEW_LINES:]:
        f = bold if text.startswith("$") else font
        d.text((14, y), text, font=f, fill=color)
        y += LINE_H
        if y > H - 30:
            break
    d.rectangle([14, H - 24, 22, H - 12], fill=GREEN)
    return img


shutil.rmtree(FRAMES_DIR, ignore_errors=True)
os.makedirs(FRAMES_DIR)

n = 0


def save(img):
    global n
    n += 1
    img.save(os.path.join(FRAMES_DIR, f"frame{n:04d}.png"))


# Title card (1s at 20 fps).
title = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(title)
d.text((14, 120), "adrgate - can this decision be reversed?", font=bold, fill=GREEN)
d.text((14, 170), "1. init: scaffold a governed decision record", font=font, fill=FG)
d.text((14, 200), "2. audit: 9 REAL ADRs from adr-tools - 0 GOVERNED, 9 UNGOVERNED", font=font, fill=FG)
d.text((14, 230), "3. check: a CI gate - exit 1 when a record has gaps", font=font, fill=FG)
d.text((14, 260), "4. diff: regressions vs a baseline receipt", font=font, fill=FG)
d.text((14, 290), "5. explain: every rule, with the Nvidia timeline anchor", font=font, fill=FG)
d.text((14, 320), "zero-dep CLI - 100% local, no network in scan/check", font=font, fill=DIM)
d.text((14, 350), "record-completeness only: never judges whether a decision was right", font=font, fill=DIM)
for _ in range(20):
    save(title.copy())


# Caption card for the audit -> check transition (0.75s at 20 fps).
CAPTION_FRAMES = 15


def caption_card():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((14, 120), "2. audit - the real corpus, scored rule by rule", font=bold, fill=GREEN)
    d.text((14, 170), "9 real ADRs, 45 rule checks, only 3 pass", font=font, fill=FG)
    d.text((14, 200), "D1 reversal 0/9 - D3 dissent 0/9 - D4 review date 0/9", font=font, fill=FG)
    d.text((14, 230), "even the reference tool's own ADRs are ungoverned", font=font, fill=FG)
    return img


# Extra hold frames so a first-time viewer can actually read the
# summary and the gate result. Total target is ~25-30 s at 20 fps.
def extra_holds(line: str) -> int:
    if line.startswith("summary:"):
        return 6
    if line.startswith("verdict:"):
        return 5
    if line.startswith("diff:"):
        return 4
    return 0


canvas: list[tuple[str, tuple]] = []
command_count = 0
for line in lines:
    color = color_for(line)
    # Caption card at the audit -> check transition, before the screen
    # clears for the check command.
    if line.startswith("$ adrgate check"):
        cap = caption_card()
        for _ in range(CAPTION_FRAMES):
            save(cap.copy())
    # Clear the screen at each new command (like a real `clear` between
    # demo steps). Without this the 38-line viewport scrolls on nearly
    # every frame and the GIF balloons.
    if line.startswith("$") and command_count >= 1:
        canvas = []
    if line.startswith("$"):
        command_count += 1
    # One frame per line + one hold: ~2 frames/line keeps the total
    # near 25-30 s at 20 fps without holding frames in memory.
    save(render(canvas + [(line, color)]))
    save(render(canvas + [(line, color)]))
    canvas.append((line, color))
    for _ in range(extra_holds(line)):
        save(render(canvas))

out = os.path.join(ROOT, "demo", "adrgate-demo.gif")
# Hold the final frame so the closing explain lines stay readable.
for _ in range(15):
    save(render(canvas))
cmd = [
    "ffmpeg", "-y", "-v", "error",
    "-framerate", "20", "-i", os.path.join(FRAMES_DIR, "frame%04d.png"),
    "-vf", "split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse",
    out,
]
res = subprocess.run(cmd)
if res.returncode != 0:
    print("ffmpeg failed", file=sys.stderr)
    sys.exit(1)
shutil.rmtree(FRAMES_DIR, ignore_errors=True)
size = os.path.getsize(out)
print(f"GIF written: {out} ({n} frames, {n * 50 / 1000:.1f}s, {size} bytes)")
