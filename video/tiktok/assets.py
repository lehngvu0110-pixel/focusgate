"""Nền, khung cửa sổ, tiêu đề cảnh, nhãn tua nhanh, thẻ kết — theo BRAND.md (tối, aurora ở mép trên, Be Vietnam Pro)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from paths import ROOT, WORK, SCRIPT  # noqa: E402
import json, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 1080, 1920
WIN = dict(x=60, y=400, w=960, h=1180, r=34)
F = WORK + '/fonts/BeVietnamPro-'
A = WORK + '/assets'
BG = (8, 8, 12)

def font(w, s): return ImageFont.truetype(F + w + '.ttf', s)

def radial(cx, cy, r, color, alpha):
    y, x = np.mgrid[0:H, 0:W]
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r
    a = np.clip(1 - d, 0, 1) ** 2.2 * alpha
    return np.dstack([np.full((H, W), c, np.float32) for c in color]), a[..., None]

def background():
    img = np.full((H, W, 3), BG, np.float32)
    for (cx, cy, r, col, al) in [(120, -80, 900, (110, 91, 255), .42), (1000, -40, 760, (34, 211, 238), .20),
                                 (540, 2050, 900, (110, 91, 255), .10)]:
        c, a = radial(cx, cy, r, col, al); img = img * (1 - a) + c * a
    rng = np.random.default_rng(3); img += rng.normal(0, 2.2, img.shape)        # hạt nhiễu chống dải màu
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

def rrect_mask(size, box, r, scale=4):
    m = Image.new('L', (size[0] * scale, size[1] * scale), 0)
    ImageDraw.Draw(m).rounded_rectangle([v * scale for v in box], r * scale, fill=255)
    return m.resize(size, Image.LANCZOS)

def build_frame():
    bg = background(); bg.save(f'{A}/bg.png')

    # Lớp phủ: nền có khoét lỗ bo góc + bóng đổ + viền hairline sáng
    x, y, w, h, r = WIN.values()
    over = bg.convert('RGBA')
    shadow = Image.new('L', (W, H), 0); ImageDraw.Draw(shadow).rounded_rectangle([x, y + 24, x + w, y + h + 24], r, fill=200)
    shadow = shadow.filter(ImageFilter.GaussianBlur(40))
    over = Image.composite(Image.new('RGBA', (W, H), (0, 0, 0, 255)), over, shadow.point(lambda v: int(v * .55)))
    glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).rounded_rectangle([x - 2, y - 2, x + w + 2, y + h + 2], r + 2, outline=255, width=6)
    glow = glow.filter(ImageFilter.GaussianBlur(14))
    over = Image.composite(Image.new('RGBA', (W, H), (110, 91, 255, 255)), over, glow.point(lambda v: int(v * .35)))
    hole = rrect_mask((W, H), [x, y, x + w, y + h], r)
    alpha = Image.eval(hole, lambda v: 255 - v); over.putalpha(alpha)
    edge = Image.new('RGBA', (W * 4, H * 4), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle([x * 4, y * 4, (x + w) * 4, (y + h) * 4], r * 4, outline=(255, 255, 255, 40), width=8)
    over.alpha_composite(edge.resize((W, H), Image.LANCZOS)); over.save(f'{A}/frame.png')

def grad_text(draw_on, xy, text, fnt, c0=(139, 123, 255), c1=(34, 211, 238)):
    bbox = fnt.getbbox(text); tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    m = Image.new('L', draw_on.size, 0); ImageDraw.Draw(m).text(xy, text, font=fnt, fill=255)
    g = np.zeros((draw_on.size[1], draw_on.size[0], 4), np.uint8)
    t = np.clip((np.arange(draw_on.size[0]) - xy[0]) / max(1, tw * 1.25), 0, 1)
    for k in range(3): g[..., k] = (c0[k] * (1 - t) + c1[k] * t).astype(np.uint8)[None, :]
    g[..., 3] = np.array(m); draw_on.alpha_composite(Image.fromarray(g))

def title(text, path):
    """Dòng 1 trắng, dòng 2 gradient thương hiệu. line-height 1.2 (quy tắc dấu chồng tiếng Việt)."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    lines = text.split('\n'); size = 74
    f = font('ExtraBold', size)
    while max(d.textlength(l, font=f) for l in lines) > 940: size -= 2; f = font('ExtraBold', size)
    lh = int(size * 1.2); top = 262 - lh * len(lines) // 2
    for i, l in enumerate(lines):
        tx = (W - d.textlength(l, font=f)) / 2; ty = top + i * lh
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).text((tx, ty + 4), l, font=f, fill=(0, 0, 0, 160))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
        if i == len(lines) - 1 and len(lines) > 1: grad_text(img, (tx, ty), l, f)
        else: d.text((tx, ty), l, font=f, fill=(242, 242, 246, 255))
    img.save(path)

def pill(text, path, color=(255, 176, 32)):
    # Be Vietnam Pro không có glyph ▶ — vẽ hai tam giác tua nhanh bằng tay
    f = font('Bold', 30); tw = int(f.getlength(text)); icon = 44; pw, ph = tw + 56 + icon, 58
    img = Image.new('RGBA', (pw + 8, ph + 8), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, 4 + pw, 4 + ph], ph // 2, fill=(20, 16, 6, 235), outline=color + (255,), width=2)
    cx, cy = 4 + 28, 4 + ph / 2
    for k in (0, 17): d.polygon([(cx + k, cy - 10), (cx + k, cy + 10), (cx + k + 16, cy)], fill=color + (255,))
    d.text((4 + 28 + icon, 4 + 11), text, font=f, fill=color + (255,)); img.save(path)

def endcard(path):
    """Thẻ kết nằm gọn trong ô cửa sổ 960×1180."""
    w, h = WIN['w'], WIN['h']; img = Image.new('RGBA', (w, h), (13, 13, 19, 255))
    arr = np.array(img).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    for cx, cy, rr, col, al in [(160, -60, 700, (110, 91, 255), .38), (820, -40, 560, (34, 211, 238), .18)]:
        a = (np.clip(1 - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rr, 0, 1) ** 2.2 * al)[..., None]
        arr[..., :3] = arr[..., :3] * (1 - a) + np.array(col, np.float32) * a
    img = Image.fromarray(arr.astype(np.uint8)); d = ImageDraw.Draw(img)
    logo = Image.open(ROOT + '/brand/icon-512.png').convert('RGBA').resize((236, 236), Image.LANCZOS)
    halo = Image.new('RGBA', (w, h), (0, 0, 0, 0)); ImageDraw.Draw(halo).ellipse([w/2-170, 250-170, w/2+170, 250+170], fill=(110, 91, 255, 120))
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(60))); img.alpha_composite(logo, (int(w/2 - 118), 132))
    f1 = font('ExtraBold', 96); t = 'FocusGate'; d.text(((w - d.textlength(t, font=f1)) / 2, 420), t, font=f1, fill=(242, 242, 246))
    f2 = font('SemiBold', 44); t = 'Xong việc rồi hẵng lướt.'; grad_text(img, ((w - d.textlength(t, font=f2)) / 2, 552), t, f2)
    f3 = font('Bold', 34); y0 = 668
    for t, col in [('Miễn phí', (45, 212, 167)), ('Không cần tài khoản', (45, 212, 167)), ('Dữ liệu nằm trên máy bạn', (45, 212, 167))]:
        tw = d.textlength(t, font=f3) + 52; x0 = (w - tw - 64) / 2
        d.rounded_rectangle([x0, y0, x0 + tw + 64, y0 + 74], 37, fill=(22, 22, 31), outline=(255, 255, 255, 30), width=2)
        cx, cy = x0 + 50, y0 + 37                                   # dấu tick vẽ tay (font không có ✓)
        d.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=(14, 60, 50), outline=col, width=2)
        d.line([(cx - 8, cy + 1), (cx - 2, cy + 7), (cx + 9, cy - 6)], fill=col, width=4, joint='curve')
        d.text((x0 + 84, y0 + 15), t, font=f3, fill=(242, 242, 246))
        y0 += 96
    f4 = font('SemiBold', 30); t = 'Chrome · Edge · Cốc Cốc · macOS'
    d.text(((w - d.textlength(t, font=f4)) / 2, 985), t, font=f4, fill=(165, 165, 184))
    img.save(path)

if __name__ == '__main__':
  build_frame()
  S = json.load(open(SCRIPT))
  for sc in S['scenes']:
    title(sc['title'] if sc['title'] else 'Xong việc rồi\nhẵng lướt.', f"{A}/title-{sc['id']}.png")
  pill('TUA NHANH ×17', f'{A}/tag-fast.png')
  endcard(f'{A}/endcard.png')
  print('ok')
