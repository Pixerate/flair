// flair-metal-hash: d4a531b5
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uColorA;
    packed_float3 uColorB;
    float uWidth;
    float uPixel;
    float uBreak;
    float uScatter;
    float uDensity;
    float uDrift;
    float uGlow;
    float uLife;
    float uIntensity;
    uint uDemo;
    float uUnit;
};

struct flair_pixerate_paint_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float trailUnit(constant FlairUniforms& _200)
{
    float _447;
    if (_200.uUnit > 0.0)
    {
        _447 = _200.uUnit;
    }
    else
    {
        _447 = _200.iResolution[1u];
    }
    return _447;
}

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _200)
{
    bool _566 = !demo;
    bool _581;
    if (!_566)
    {
        bool _573 = _200.iTrail[0].w > 0.5;
        bool _580;
        if (_573)
        {
            _580 = _200.iPointer.z > 0.0;
        }
        else
        {
            _580 = _573;
        }
        _581 = _580;
    }
    else
    {
        _581 = _566;
    }
    return _581;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _200)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_200.iResolution[0u], _200.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_200.iResolution[0], _200.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _233;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _233 = s.y;
    }
    else
    {
        float _242;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _242 = s.x;
        }
        else
        {
            float _252;
            if (meta.w < 1.5)
            {
                _252 = fast::min(s.x, s.y);
            }
            else
            {
                _252 = fast::max(s.x, s.y);
            }
            _242 = _252;
        }
        _233 = _242;
    }
    float k = _233;
    return float3((float2(_200.iResolution[0], _200.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _200)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _200).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _200)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _200);
    float s = fast::clamp(along / f.z, 0.0, meta.y);
    int lo = 0;
    int hi = n - 1;
    for (int k = 0; k < 11; k++)
    {
        if ((hi - lo) <= 1)
        {
            break;
        }
        int mid = (lo + hi) / 2;
        if (path.read(uint2(int2(mid, 0)), 0).z <= s)
        {
            lo = mid;
        }
        else
        {
            hi = mid;
        }
    }
    float4 a = path.read(uint2(int2(lo, 0)), 0);
    float4 b = path.read(uint2(int2(hi, 0)), 0);
    float2 _376;
    if (b.w < 0.5)
    {
        _376 = a.xy;
    }
    else
    {
        _376 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _376;
    float2 t = b.xy - a.xy;
    float2 _412;
    if (dot(t, t) > 0.0)
    {
        _412 = fast::normalize(t);
    }
    else
    {
        _412 = float2(1.0, 0.0);
    }
    t = _412;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _200.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _200, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.39999997615814208984375;
    float len = pathLength(uPath, uPathSmplr, _200);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _200).xy - pathAt(uPath, uPathSmplr, param_1, _200).xy) < 2.0;
        float _485;
        if (closed)
        {
            _485 = fract(lap) * len;
        }
        else
        {
            _485 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _485;
        return pathAt(uPath, uPathSmplr, param_2, _200).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_200.iResolution[0], _200.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _200, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _200.iTrail[i];
    }
    float _595;
    if (i == 0)
    {
        _595 = _200.iTime;
    }
    else
    {
        _595 = ((floor(_200.iTime / 0.02500000037252902984619140625) + 1.0) - float(i)) * 0.02500000037252902984619140625;
    }
    float t = _595;
    float param = t;
    return float4(demoPath(param, _200, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _200, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_200.iTime / 0.02500000037252902984619140625) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _200) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.02500000037252902984619140625) * 1.39999997615814208984375;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _200, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _200.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.02500000037252902984619140625;
        return float4(demoPath(param, _200, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.02500000037252902984619140625, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_200.iResolution[0], _200.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.02500000037252902984619140625, 1.0);
    float4 c = (gWalkCos * float4(0.999387562274932861328125, 0.996761620044708251953125, 0.997551023960113525390625, 0.9941196441650390625)) + (gWalkSin * float4(0.034992851316928863525390625, 0.080413080751895904541015625, 0.06994284689426422119140625, 0.108287237584590911865234375));
    gWalkSin = (gWalkSin * float4(0.999387562274932861328125, 0.996761620044708251953125, 0.997551023960113525390625, 0.9941196441650390625)) - (gWalkCos * float4(0.034992851316928863525390625, 0.080413080751895904541015625, 0.06994284689426422119140625, 0.108287237584590911865234375));
    gWalkCos = c;
    return point;
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _200)
{
    bool _549 = (a.z - b.z) > 0.25;
    bool _562;
    if (_549)
    {
        _562 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * trailUnit(_200));
    }
    else
    {
        _562 = _549;
    }
    return _562;
}

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return float2(length((p - a) - (ab * t)), t);
}

static inline __attribute__((always_inline))
float brokenAt(thread const float& u, constant FlairUniforms& _200)
{
    return fast::clamp((u - (1.0 - _200.uBreak)) / fast::max(_200.uBreak, 0.001000000047497451305389404296875), 0.0, 1.0);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float3 pixelCell(thread const float2& p, thread const float2& c, thread const float2& ci, thread const float& g, thread const float& d, thread const float& u, thread const float& wr, thread const float& px, constant FlairUniforms& _200, thread float& gSolid)
{
    float param = u;
    float e = brokenAt(param, _200);
    if (e <= 0.0)
    {
        return float3(0.0);
    }
    float reach = (wr + ((_200.uScatter * _200.uWidth) * e)) + 9.9999997473787516355514526367188e-06;
    float near = 1.0 - smoothstep(0.25 * reach, reach, d - (wr * 0.5));
    float chance = (_200.uDensity * sqrt(e)) * near;
    if (chance <= 0.0)
    {
        return float3(0.0);
    }
    float2 param_1 = (ci * 0.731000006198883056640625) + float2(3.099999904632568359375);
    float phase = ((_200.iTime * _200.uDrift) * 0.5) + hash12(param_1);
    float cycle = floor(phase);
    float2 param_2 = (ci * 1.37000000476837158203125) + float2(cycle * 11.69999980926513671875);
    float2 h = hash22(param_2);
    if (h.x >= chance)
    {
        return float3(0.0);
    }
    float _914;
    if (_200.uDrift > 0.0)
    {
        _914 = sin(3.1415927410125732421875 * fract(phase));
    }
    else
    {
        _914 = 1.0;
    }
    float env = _914;
    float s = (g * mix(0.23999999463558197021484375, 0.4000000059604644775390625, h.y)) * mix(1.0, 0.60000002384185791015625, fast::clamp(d / reach, 0.0, 1.0));
    float2 param_3 = ((ci * 0.916999995708465576171875) + float2(cycle * 5.30000019073486328125)) + float2(7.0);
    float2 jitter = (hash22(param_3) - float2(0.5)) * fast::max((g * 0.699999988079071044921875) - (2.0 * s), 0.0);
    float2 q = abs((p - c) - jitter);
    float sq = fast::max(q.x, q.y) - s;
    float body = 1.0 - smoothstep(-px, px, sq);
    float2 r = abs(p - c);
    float halo = exp((-fast::max(sq, 0.0)) / ((s * 0.5) + px)) * smoothstep(0.5 * g, 0.36000001430511474609375 * g, fast::max(r.x, r.y));
    float2 param_4 = (h * 17.299999237060546875) + float2(1.0);
    float pick = hash12(param_4);
    float3 _1022;
    if (pick < 0.449999988079071044921875)
    {
        _1022 = _200.uColorA;
    }
    else
    {
        float3 _1032;
        if (pick < 0.800000011920928955078125)
        {
            _1032 = float3(_200.uColorB);
        }
        else
        {
            _1032 = mix(mix(_200.uColorA, float3(_200.uColorB), float3(0.5)), float3(1.0), float3(0.300000011920928955078125));
        }
        _1022 = _1032;
    }
    float3 tint = _1022;
    float dim = mix(1.0, 0.449999988079071044921875, fast::clamp(d / reach, 0.0, 1.0)) * env;
    gSolid = fast::max(gSolid, body * dim);
    return (((mix(tint, float3(1.0), float3(0.180000007152557373046875)) * body) * 1.7999999523162841796875) + ((tint * halo) * _200.uGlow)) * dim;
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _200, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin, thread float& gSolid)
{
    float px = 1.0 / trailUnit(_200);
    float2 p = fragCoord * px;
    bool param = _200.uDemo != 0u;
    bool live = trailLive(param, _200);
    int param_1 = 0;
    bool param_2 = live;
    float4 a = trailAt(param_1, param_2, _200, uPath, uPathSmplr);
    if (a.w < 0.5)
    {
        fragColor = float4(0.0);
        return;
    }
    gSolid = 0.0;
    float g1 = fast::max(_200.uWidth * _200.uPixel, 2.0 * px);
    float g2 = g1 * 2.2000000476837158203125;
    float t = _200.iTime * _200.uDrift;
    float2 o1 = ((float2(0.25, 1.0) * t) * g1) * 0.5;
    float2 o2 = ((float2(0.3499999940395355224609375, 1.0) * t) * g2) * 0.300000011920928955078125;
    float2 csi = floor(p / float2(g1));
    float2 cs = (csi + float2(0.5)) * g1;
    float2 c1i = floor((p - o1) / float2(g1));
    float2 c1 = ((c1i + float2(0.5)) * g1) + o1;
    float2 c2i = floor((p - o2) / float2(g2));
    float2 c2 = ((c2i + float2(0.5)) * g2) + o2;
    float2 nP = float2(1000000000.0, 0.0);
    float2 nS = float2(1000000000.0, 0.0);
    float2 n1 = float2(1000000000.0, 0.0);
    float2 n2 = float2(1000000000.0, 0.0);
    float fadeP = 1.0;
    float reach = ((_200.uWidth * (1.60000002384185791015625 + _200.uScatter)) + g2) + (2.0 * px);
    int param_3 = 1;
    bool param_4 = live;
    trailFrom(param_3, param_4, _200, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    for (int k = 0; k < 31; k++)
    {
        bool param_5 = live;
        float4 _1226 = trailNext(param_5, _200, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
        float4 b = _1226;
        bool _1229 = b.w < 0.5;
        bool _1238;
        if (!_1229)
        {
            float4 param_6 = a;
            float4 param_7 = b;
            _1238 = trailJump(param_6, param_7, _200);
        }
        else
        {
            _1238 = _1229;
        }
        if (_1238)
        {
            break;
        }
        float2 pa = a.xy * px;
        float2 pb = b.xy * px;
        float2 lo = fast::min(pa, pb) - float2(reach);
        float2 hi = fast::max(pa, pb) + float2(reach);
        bool _1270 = all(p > lo);
        bool _1277;
        if (_1270)
        {
            _1277 = all(p < hi);
        }
        else
        {
            _1277 = _1270;
        }
        if (_1277)
        {
            float u0 = float(k) / 31.0;
            float du = 0.0322580635547637939453125;
            float2 param_8 = p;
            float2 param_9 = pa;
            float2 param_10 = pb;
            float2 s = segment(param_8, param_9, param_10);
            if (s.x < nP.x)
            {
                nP = float2(s.x, u0 + (s.y * du));
                fadeP = fast::clamp(2.0 * (1.0 - ((_200.iTime - mix(a.z, b.z, s.y)) / _200.uLife)), 0.0, 1.0);
            }
            float2 param_11 = cs;
            float2 param_12 = pa;
            float2 param_13 = pb;
            s = segment(param_11, param_12, param_13);
            if (s.x < nS.x)
            {
                nS = float2(s.x, u0 + (s.y * du));
            }
            float2 param_14 = c1;
            float2 param_15 = pa;
            float2 param_16 = pb;
            s = segment(param_14, param_15, param_16);
            if (s.x < n1.x)
            {
                n1 = float2(s.x, u0 + (s.y * du));
            }
            float2 param_17 = c2;
            float2 param_18 = pa;
            float2 param_19 = pb;
            s = segment(param_17, param_18, param_19);
            if (s.x < n2.x)
            {
                n2 = float2(s.x, u0 + (s.y * du));
            }
        }
        a = b;
    }
    if (nP.x > reach)
    {
        fragColor = float4(0.0);
        return;
    }
    float taper = mix(1.0, 0.699999988079071044921875, nP.y);
    float wr = (_200.uWidth * taper) * fadeP;
    float smoothCover = 1.0 - smoothstep(-px, px, nP.x - wr);
    float param_20 = nS.y;
    float eS = brokenAt(param_20, _200);
    float2 cq = abs(p - cs);
    float inCell = 1.0 - smoothstep(-px, px, fast::max(cq.x, cq.y) - (g1 * 0.439999997615814208984375));
    float2 param_21 = (csi * 1.12999999523162841796875) + float2(41.0);
    float kept = step(eS * 1.14999997615814208984375, hash12(param_21));
    float blockCover = (step(nS.x, (_200.uWidth * mix(1.0, 0.699999988079071044921875, nS.y)) * fadeP) * inCell) * kept;
    float param_22 = nP.y;
    float eP = brokenAt(param_22, _200);
    float cover = mix(smoothCover, blockCover, smoothstep(0.0, 0.119999997317790985107421875, eP));
    float mid = 1.0 - fast::clamp(nP.x / fast::max(wr, 9.9999997473787516355514526367188e-06), 0.0, 1.0);
    float3 tint = mix(_200.uColorA, float3(_200.uColorB), float3(smoothstep(0.300000011920928955078125, 1.0, nP.y)));
    float3 body = mix(mix(float3(_200.uColorB), tint, float3(0.3499999940395355224609375)), tint, float3(smoothstep(0.0, 0.60000002384185791015625, mid)));
    float3 col = (mix(body, float3(1.0), float3(0.300000011920928955078125 * powr(mid, 4.0))) * cover) * 1.7000000476837158203125;
    float halo = (exp((-fast::max(nP.x - wr, 0.0)) / ((_200.uWidth * 0.89999997615814208984375) + px)) * fadeP) * (1.0 - (0.60000002384185791015625 * eP));
    col += (((tint * halo) * _200.uGlow) * 0.60000002384185791015625);
    float2 param_23 = p;
    float2 param_24 = c1;
    float2 param_25 = c1i;
    float param_26 = g1;
    float param_27 = n1.x;
    float param_28 = n1.y;
    float param_29 = wr;
    float param_30 = px;
    float3 _1583 = pixelCell(param_23, param_24, param_25, param_26, param_27, param_28, param_29, param_30, _200, gSolid);
    col += (_1583 * fadeP);
    float2 param_31 = p;
    float2 param_32 = c2;
    float2 param_33 = c2i + float2(101.0);
    float param_34 = g2;
    float param_35 = n2.x;
    float param_36 = n2.y;
    float param_37 = wr;
    float param_38 = px;
    float3 _1609 = pixelCell(param_31, param_32, param_33, param_34, param_35, param_36, param_37, param_38, _200, gSolid);
    col += (_1609 * fadeP);
    float3 param_39 = col * _200.uIntensity;
    float4 _1620 = glow(param_39);
    fragColor = _1620;
    fragColor.w = fast::max(fragColor.w, fast::max(cover, gSolid * fadeP));
}

fragment flair_pixerate_paint_frag_out flair_pixerate_paint_frag(constant FlairUniforms& _200 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_pixerate_paint_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float gSolid;
    float _1642;
    if (_200.flair_flipY > 0.5)
    {
        _1642 = _200.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1642 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1642);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _200, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin, gSolid);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

