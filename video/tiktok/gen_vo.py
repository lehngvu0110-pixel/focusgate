"""Đọc script.json → mỗi câu một tệp WAV (cắt lặng), đo thời lượng, kiểm chứng bằng ASR,
và tính mốc từng cụm phụ đề trong câu (theo mốc từ của ASR nếu khớp số âm tiết, không thì chia theo âm tiết)."""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from paths import ROOT, WORK, SCRIPT  # noqa: E402
import sys, json, os, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(__file__)); import voice as v
S = json.load(open(SCRIPT)); sp = S['speed']; out = []; n = 0
IMPROVE = '--improve' in sys.argv
def trim(x, sr, thr=0.012):
    idx = np.where(np.abs(x) > thr)[0]
    a = max(0, idx[0] - int(0.03*sr)); b = min(len(x), idx[-1] + int(0.06*sr)); return x[a:b]
for sc in S['scenes']:
    for sent in sc['sentences']:
        n += 1; say = ' '.join(c[1] for c in sent)
        import hashlib; p = f"vo/lines/{hashlib.sha1((say + '|' + str(sp)).encode()).hexdigest()[:10]}.wav"
        if not os.path.exists(p):                      # giữ bản đọc cũ nếu câu không đổi (VITS có ngẫu nhiên)
            v.say(say, p, sp); x, sr = sf.read(p, dtype='float32'); sf.write(p, trim(x, sr), sr)
        if IMPROVE:
            best = (v.wer(say, v.hear(p)), p)
            for k in range(5):
                if best[0] <= 0.05: break
                q = p.replace('.wav', f'.try{k}.wav'); v.say(say, q, sp)
                y, r_ = sf.read(q, dtype='float32'); sf.write(q, trim(y, r_), r_)
                w = v.wer(say, v.hear(q))
                if w < best[0]: best = (w, q)
            if best[1] != p: os.replace(best[1], p)
            for k in range(5):
                q = p.replace('.wav', f'.try{k}.wav')
                if os.path.exists(q): os.remove(q)
        x, sr = sf.read(p, dtype='float32'); d = len(x)/sr
        xp = np.concatenate([np.zeros(int(.4*sr),np.float32), x, np.zeros(int(.4*sr),np.float32)]); st = v.asr().create_stream(); st.accept_waveform(sr, xp); v.asr().decode_stream(st); r = st.result
        words = [(tok, max(0.0, t - 0.4)) for tok, t in zip(r.tokens, r.timestamps) if tok.startswith(' ')]
        syl = [len(c[1].split()) for c in sent]; total = sum(syl)
        chunks = []; acc = 0
        for (show, s), k in zip(sent, syl):
            if len(words) == total: t0 = words[acc][1]
            else: t0 = d * acc / total
            chunks.append({'show': show, 't0': round(t0, 3)}); acc += k
        for i, c in enumerate(chunks): c['t1'] = chunks[i+1]['t0'] if i+1 < len(chunks) else round(d, 3)
        w = v.wer(say, r.text)
        out.append({'scene': sc['id'], 'file': p, 'dur': round(d, 3), 'say': say, 'asr': r.text, 'wer': round(w, 2),
                    'aligned': len(words) == total, 'chunks': chunks})
        print(f"s{n:02d} {sc['id']:6} {d:4.2f}s WER {w:.2f} {'✓' if len(words)==total else '~'} | {r.text}")
json.dump({'scenes': [{k: sc[k] for k in ('id', 'title')} for sc in S['scenes']], 'lines': out},
          open('vo/lines.json', 'w'), ensure_ascii=False, indent=1)
print(f"tổng tiếng nói {sum(l['dur'] for l in out):.1f}s · {n} câu · WER trung bình {np.mean([l['wer'] for l in out]):.2f}")
