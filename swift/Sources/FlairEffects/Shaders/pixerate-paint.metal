// flair-metal-hash: ae9aca85
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
    float uTexture;
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
float trailUnit(constant FlairUniforms& _257)
{
    float _502;
    if (_257.uUnit > 0.0)
    {
        _502 = _257.uUnit;
    }
    else
    {
        _502 = _257.iResolution[1u];
    }
    return _502;
}

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _257)
{
    bool _621 = !demo;
    bool _636;
    if (!_621)
    {
        bool _628 = _257.iTrail[0].w > 0.5;
        bool _635;
        if (_628)
        {
            _635 = _257.iPointer.z > 0.0;
        }
        else
        {
            _635 = _628;
        }
        _636 = _635;
    }
    else
    {
        _636 = _621;
    }
    return _636;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _257)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_257.iResolution[0u], _257.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_257.iResolution[0], _257.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _289;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _289 = s.y;
    }
    else
    {
        float _298;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _298 = s.x;
        }
        else
        {
            float _308;
            if (meta.w < 1.5)
            {
                _308 = fast::min(s.x, s.y);
            }
            else
            {
                _308 = fast::max(s.x, s.y);
            }
            _298 = _308;
        }
        _289 = _298;
    }
    float k = _289;
    return float3((float2(_257.iResolution[0], _257.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _257)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _257).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _257)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _257);
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
    float2 _432;
    if (b.w < 0.5)
    {
        _432 = a.xy;
    }
    else
    {
        _432 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _432;
    float2 t = b.xy - a.xy;
    float2 _468;
    if (dot(t, t) > 0.0)
    {
        _468 = fast::normalize(t);
    }
    else
    {
        _468 = float2(1.0, 0.0);
    }
    t = _468;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _257.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _257, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.39999997615814208984375;
    float len = pathLength(uPath, uPathSmplr, _257);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _257).xy - pathAt(uPath, uPathSmplr, param_1, _257).xy) < 2.0;
        float _540;
        if (closed)
        {
            _540 = fract(lap) * len;
        }
        else
        {
            _540 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _540;
        return pathAt(uPath, uPathSmplr, param_2, _257).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_257.iResolution[0], _257.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _257, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _257.iTrail[i];
    }
    float _650;
    if (i == 0)
    {
        _650 = _257.iTime;
    }
    else
    {
        _650 = ((floor(_257.iTime / 0.02500000037252902984619140625) + 1.0) - float(i)) * 0.02500000037252902984619140625;
    }
    float t = _650;
    float param = t;
    return float4(demoPath(param, _257, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _257, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_257.iTime / 0.02500000037252902984619140625) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _257) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.02500000037252902984619140625) * 1.39999997615814208984375;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _257, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _257.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.02500000037252902984619140625;
        return float4(demoPath(param, _257, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.02500000037252902984619140625, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_257.iResolution[0], _257.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.02500000037252902984619140625, 1.0);
    float4 c = (gWalkCos * float4(0.999387562274932861328125, 0.996761620044708251953125, 0.997551023960113525390625, 0.9941196441650390625)) + (gWalkSin * float4(0.034992851316928863525390625, 0.080413080751895904541015625, 0.06994284689426422119140625, 0.108287237584590911865234375));
    gWalkSin = (gWalkSin * float4(0.999387562274932861328125, 0.996761620044708251953125, 0.997551023960113525390625, 0.9941196441650390625)) - (gWalkCos * float4(0.034992851316928863525390625, 0.080413080751895904541015625, 0.06994284689426422119140625, 0.108287237584590911865234375));
    gWalkCos = c;
    return point;
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _257)
{
    bool _604 = (a.z - b.z) > 0.25;
    bool _617;
    if (_604)
    {
        _617 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * trailUnit(_257));
    }
    else
    {
        _617 = _604;
    }
    return _617;
}

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return float2(length((p - a) - (ab * t)), t);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float brokenAt(thread const float& u, constant FlairUniforms& _257)
{
    return fast::clamp((u - (1.0 - _257.uBreak)) / fast::max(_257.uBreak, 0.001000000047497451305389404296875), 0.0, 1.0);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float3 pixelCell(thread const float2& p, thread const float2& c, thread const float2& ci, thread const float& g, thread const float& d, thread const float& u, thread const float& wr, thread const float& px, constant FlairUniforms& _257, thread float& gSolid)
{
    float param = u;
    float e = brokenAt(param, _257);
    if (e <= 0.0)
    {
        return float3(0.0);
    }
    float reach = (wr + ((_257.uScatter * _257.uWidth) * e)) + 9.9999997473787516355514526367188e-06;
    float near = 1.0 - smoothstep(0.25 * reach, reach, d - (wr * 0.5));
    float chance = (_257.uDensity * sqrt(e)) * near;
    if (chance <= 0.0)
    {
        return float3(0.0);
    }
    float2 param_1 = (ci * 0.731000006198883056640625) + float2(3.099999904632568359375);
    float phase = ((_257.iTime * _257.uDrift) * 0.5) + hash12(param_1);
    float cycle = floor(phase);
    float2 param_2 = (ci * 1.37000000476837158203125) + float2(cycle * 11.69999980926513671875);
    float2 h = hash22(param_2);
    if (h.x >= chance)
    {
        return float3(0.0);
    }
    float _969;
    if (_257.uDrift > 0.0)
    {
        _969 = sin(3.1415927410125732421875 * fract(phase));
    }
    else
    {
        _969 = 1.0;
    }
    float env = _969;
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
    float3 _1077;
    if (pick < 0.449999988079071044921875)
    {
        _1077 = _257.uColorA;
    }
    else
    {
        float3 _1087;
        if (pick < 0.800000011920928955078125)
        {
            _1087 = float3(_257.uColorB);
        }
        else
        {
            _1087 = mix(mix(_257.uColorA, float3(_257.uColorB), float3(0.5)), float3(1.0), float3(0.300000011920928955078125));
        }
        _1077 = _1087;
    }
    float3 tint = _1077;
    float dim = mix(1.0, 0.449999988079071044921875, fast::clamp(d / reach, 0.0, 1.0)) * env;
    gSolid = fast::max(gSolid, body * dim);
    return (((mix(tint, float3(1.0), float3(0.180000007152557373046875)) * body) * 1.7999999523162841796875) + ((tint * halo) * _257.uGlow)) * dim;
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _257, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin, thread float& gSolid)
{
    float px = 1.0 / trailUnit(_257);
    float2 p = fragCoord * px;
    bool param = _257.uDemo != 0u;
    bool live = trailLive(param, _257);
    int param_1 = 0;
    bool param_2 = live;
    float4 a = trailAt(param_1, param_2, _257, uPath, uPathSmplr);
    if (a.w < 0.5)
    {
        fragColor = float4(0.0);
        return;
    }
    gSolid = 0.0;
    float g1 = fast::max(_257.uWidth * _257.uPixel, 2.0 * px);
    float g2 = g1 * 2.2000000476837158203125;
    float t = _257.iTime * _257.uDrift;
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
    float sideP = 1.0;
    float perpP = 0.0;
    float arcP = 0.0;
    float run = 0.0;
    float reach = ((_257.uWidth * (1.60000002384185791015625 + _257.uScatter)) + g2) + (2.0 * px);
    int param_3 = 1;
    bool param_4 = live;
    trailFrom(param_3, param_4, _257, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    for (int k = 0; k < 31; k++)
    {
        bool param_5 = live;
        float4 _1285 = trailNext(param_5, _257, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
        float4 b = _1285;
        bool _1288 = b.w < 0.5;
        bool _1297;
        if (!_1288)
        {
            float4 param_6 = a;
            float4 param_7 = b;
            _1297 = trailJump(param_6, param_7, _257);
        }
        else
        {
            _1297 = _1288;
        }
        if (_1297)
        {
            break;
        }
        float2 pa = a.xy * px;
        float2 pb = b.xy * px;
        float2 lo = fast::min(pa, pb) - float2(reach);
        float2 hi = fast::max(pa, pb) + float2(reach);
        bool _1329 = all(p > lo);
        bool _1336;
        if (_1329)
        {
            _1336 = all(p < hi);
        }
        else
        {
            _1336 = _1329;
        }
        if (_1336)
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
                float2 ab = pb - pa;
                perpP = ((ab.x * (p.y - pa.y)) - (ab.y * (p.x - pa.x))) / fast::max(length(ab), 9.9999999747524270787835121154785e-07);
                sideP = (perpP >= 0.0) ? 1.0 : (-1.0);
                arcP = run + (s.y * length(ab));
                fadeP = fast::clamp(2.0 * (1.0 - ((_257.iTime - mix(a.z, b.z, s.y)) / _257.uLife)), 0.0, 1.0);
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
        run += (length(b.xy - a.xy) * px);
        a = b;
    }
    if (nP.x > reach)
    {
        fragColor = float4(0.0);
        return;
    }
    float taper = mix(1.0, 0.699999988079071044921875, nP.y);
    float along = (run - arcP) / fast::max(_257.uWidth, 9.9999997473787516355514526367188e-06);
    float2 param_20 = float2(along * 0.449999988079071044921875, (sideP * 7.0) + 11.0);
    float edge = 1.0 + (((0.1599999964237213134765625 * _257.uTexture) * (vnoise(param_20) - 0.5)) * 2.0);
    float wr = ((_257.uWidth * taper) * fadeP) * edge;
    float smoothCover = 1.0 - smoothstep(-px, px, nP.x - wr);
    float param_21 = nS.y;
    float eS = brokenAt(param_21, _257);
    float2 cq = abs(p - cs);
    float inCell = 1.0 - smoothstep(-px, px, fast::max(cq.x, cq.y) - (g1 * 0.439999997615814208984375));
    float2 param_22 = (csi * 1.12999999523162841796875) + float2(41.0);
    float kept = step(eS * 1.14999997615814208984375, hash12(param_22));
    float blockCover = (step(nS.x, (_257.uWidth * mix(1.0, 0.699999988079071044921875, nS.y)) * fadeP) * inCell) * kept;
    float param_23 = nP.y;
    float eP = brokenAt(param_23, _257);
    float cover = mix(smoothCover, blockCover, smoothstep(0.0, 0.119999997317790985107421875, eP));
    float v = fast::clamp(perpP / fast::max(wr, 9.9999997473787516355514526367188e-06), -1.0, 1.0);
    float mid = 1.0 - fast::clamp(nP.x / fast::max(wr, 9.9999997473787516355514526367188e-06), 0.0, 1.0);
    float3 tint = mix(_257.uColorA, float3(_257.uColorB), float3(smoothstep(0.300000011920928955078125, 1.0, nP.y)));
    float2 param_24 = float2((v * 4.0) + 3.0, along * 0.100000001490116119384765625);
    float strands = vnoise(param_24);
    float2 param_25 = float2((v * 19.0) + 7.0, (along * 0.300000011920928955078125) + (0.5 * strands));
    float bristles = vnoise(param_25);
    float2 param_26 = float2((v * 32.0) + 1.0, along * 0.5);
    float fine = vnoise(param_26);
    float twist = (0.5 * sin((along * 0.07999999821186065673828125) + 1.2999999523162841796875)) + (0.800000011920928955078125 * (strands - 0.5));
    float3 paint = mix(float3(_257.uColorB), tint, float3(smoothstep(-0.25, 0.25, (v + 0.4000000059604644775390625) - (twist * 0.60000002384185791015625))));
    float groove = (smoothstep(0.1500000059604644775390625, 0.75, bristles) * 0.75) + (0.25 * fine);
    paint *= (mix(0.62000000476837158203125, 1.0499999523162841796875, groove) * mix(0.85000002384185791015625, 1.0, sqrt(fast::max(mid, 0.0))));
    float shine = powr(fast::max(0.0, 1.0 - (abs((v - 0.3499999940395355224609375) - (0.300000011920928955078125 * (strands - 0.5))) / 0.20000000298023223876953125)), 2.0) * smoothstep(0.3499999940395355224609375, 0.89999997615814208984375, bristles);
    shine += ((0.800000011920928955078125 * powr(fast::max(0.0, 1.0 - (abs((v + 0.5) + (0.20000000298023223876953125 * (strands - 0.5))) / 0.0900000035762786865234375)), 2.0)) * smoothstep(0.4000000059604644775390625, 0.800000011920928955078125, fine));
    float rim = smoothstep(0.75, 1.0, abs(v));
    paint = mix(paint, mix(tint, float3(1.0), float3(0.3499999940395355224609375)), float3(rim * 0.550000011920928955078125)) + ((float3(1.0, 0.920000016689300537109375, 1.0) * shine) * 0.800000011920928955078125);
    float3 smoothBody = mix(mix(float3(_257.uColorB), tint, float3(0.3499999940395355224609375)), tint, float3(smoothstep(0.0, 0.60000002384185791015625, mid)));
    float3 lit = float3(1.0) - exp(((-mix(smoothBody, float3(1.0), float3(0.300000011920928955078125 * powr(mid, 4.0)))) * 1.7000000476837158203125) * _257.uIntensity);
    float textured = _257.uTexture * (1.0 - smoothstep(0.0, 0.5, eP));
    float3 ribbon = mix(lit / float3(fast::max(fast::max(lit.x, fast::max(lit.y, lit.z)), 9.9999997473787516355514526367188e-05)), fast::clamp(paint, float3(0.0), float3(1.0)), float3(textured));
    float ribbonA = mix(fast::max(lit.x, fast::max(lit.y, lit.z)), 1.0, textured) * cover;
    float halo = ((exp((-fast::max(nP.x - wr, 0.0)) / ((_257.uWidth * 0.89999997615814208984375) + px)) * fadeP) * (1.0 - (0.60000002384185791015625 * eP))) * (1.0 - cover);
    float3 col = ((tint * halo) * _257.uGlow) * 0.60000002384185791015625;
    float2 param_27 = p;
    float2 param_28 = c1;
    float2 param_29 = c1i;
    float param_30 = g1;
    float param_31 = n1.x;
    float param_32 = n1.y;
    float param_33 = wr;
    float param_34 = px;
    float3 _1903 = pixelCell(param_27, param_28, param_29, param_30, param_31, param_32, param_33, param_34, _257, gSolid);
    col += (_1903 * fadeP);
    float2 param_35 = p;
    float2 param_36 = c2;
    float2 param_37 = c2i + float2(101.0);
    float param_38 = g2;
    float param_39 = n2.x;
    float param_40 = n2.y;
    float param_41 = wr;
    float param_42 = px;
    float3 _1929 = pixelCell(param_35, param_36, param_37, param_38, param_39, param_40, param_41, param_42, _257, gSolid);
    col += (_1929 * fadeP);
    float3 param_43 = col * _257.uIntensity;
    float4 _1940 = glow(param_43);
    float4 light = _1940;
    float alpha = ribbonA + (light.w * (1.0 - ribbonA));
    float3 rgb = ((ribbon * ribbonA) + ((light.xyz * light.w) * (1.0 - ribbonA))) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05));
    fragColor = float4(rgb, fast::max(alpha, gSolid * fadeP));
}

fragment flair_pixerate_paint_frag_out flair_pixerate_paint_frag(constant FlairUniforms& _257 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_pixerate_paint_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float gSolid;
    float _1988;
    if (_257.flair_flipY > 0.5)
    {
        _1988 = _257.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1988 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1988);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _257, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin, gSolid);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

