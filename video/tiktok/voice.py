"""Giọng đọc tiếng Việt offline (piper vi_VN-vais1000-medium qua sherpa-onnx, CC BY 4.0)
+ nhận dạng ngược (zipformer-vi) để kiểm chứng máy đọc đúng chữ."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from paths import ROOT, WORK, SCRIPT  # noqa: E402
import os, re, unicodedata, numpy as np, sherpa_onnx, soundfile as sf
M = os.path.join(WORK, 'models')
V = os.path.join(M, 'vits-piper-vi_VN-vais1000-medium')

_tts = None
def tts():
    global _tts
    if _tts is None:
        cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=f'{V}/vi_VN-vais1000-medium.onnx', tokens=f'{V}/tokens.txt',
                data_dir=f'{V}/espeak-ng-data', noise_scale=0.6, noise_scale_w=0.7, length_scale=1.0),
            num_threads=4), max_num_sentences=1)
        _tts = sherpa_onnx.OfflineTts(cfg)
    return _tts

def say(text, path, speed=1.0):
    a = tts().generate(text, sid=0, speed=speed)
    x = np.array(a.samples, dtype=np.float32)
    sf.write(path, x, a.sample_rate)
    return len(x) / a.sample_rate

_asr = None
def asr():
    global _asr
    if _asr is None:
        d = os.path.join(M, 'sherpa-onnx-zipformer-vi-2025-04-20')
        _asr = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=f'{d}/encoder-epoch-12-avg-8.onnx', decoder=f'{d}/decoder-epoch-12-avg-8.onnx',
            joiner=f'{d}/joiner-epoch-12-avg-8.onnx', tokens=f'{d}/tokens.txt', num_threads=4)
    return _asr

def hear(path):
    x, sr = sf.read(path, dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    pad = np.zeros(int(0.4 * sr), np.float32)          # ASR cần chút lặng hai đầu mới bắt đúng âm đầu
    x = np.concatenate([pad, x.astype(np.float32), pad])
    s = asr().create_stream(); s.accept_waveform(sr, x); asr().decode_stream(s)
    return s.result.text

def norm(t):
    t = unicodedata.normalize('NFC', t.lower())
    return re.sub(r'[^\w\s]', ' ', t).split()

def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = np.zeros((len(r)+1, len(h)+1), int); d[:,0] = range(len(r)+1); d[0,:] = range(len(h)+1)
    for i in range(1, len(r)+1):
        for j in range(1, len(h)+1):
            d[i,j] = min(d[i-1,j]+1, d[i,j-1]+1, d[i-1,j-1]+(r[i-1]!=h[j-1]))
    return d[-1,-1] / max(1, len(r))
