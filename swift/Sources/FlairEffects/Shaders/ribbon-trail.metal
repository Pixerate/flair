// flair-metal-hash: 769bd6cb
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
    float uTwist;
    float uSpin;
    float uShine;
    float uLife;
    uint uDemo;
    float uUnit;
};

struct flair_ribbon_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float trailUnit(constant FlairUniforms& _132)
{
    float _382;
    if (_132.uUnit > 0.0)
    {
        _382 = _132.uUnit;
    }
    else
    {
        _382 = _132.iResolution[1u];
    }
    return _382;
}

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _132)
{
    bool _500 = !demo;
    bool _515;
    if (!_500)
    {
        bool _507 = _132.iTrail[0].w > 0.5;
        bool _514;
        if (_507)
        {
            _514 = _132.iPointer.z > 0.0;
        }
        else
        {
            _514 = _507;
        }
        _515 = _514;
    }
    else
    {
        _515 = _500;
    }
    return _515;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _132)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_132.iResolution[0u], _132.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_132.iResolution[0], _132.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _166;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _166 = s.y;
    }
    else
    {
        float _175;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _175 = s.x;
        }
        else
        {
            float _185;
            if (meta.w < 1.5)
            {
                _185 = fast::min(s.x, s.y);
            }
            else
            {
                _185 = fast::max(s.x, s.y);
            }
            _175 = _185;
        }
        _166 = _175;
    }
    float k = _166;
    return float3((float2(_132.iResolution[0], _132.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _132)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _132).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _132)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _132);
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
    float2 _311;
    if (b.w < 0.5)
    {
        _311 = a.xy;
    }
    else
    {
        _311 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _311;
    float2 t = b.xy - a.xy;
    float2 _347;
    if (dot(t, t) > 0.0)
    {
        _347 = fast::normalize(t);
    }
    else
    {
        _347 = float2(1.0, 0.0);
    }
    t = _347;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _132.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _132, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.5;
    float len = pathLength(uPath, uPathSmplr, _132);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _132).xy - pathAt(uPath, uPathSmplr, param_1, _132).xy) < 2.0;
        float _419;
        if (closed)
        {
            _419 = fract(lap) * len;
        }
        else
        {
            _419 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _419;
        return pathAt(uPath, uPathSmplr, param_2, _132).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_132.iResolution[0], _132.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _132, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _132.iTrail[i];
    }
    float _529;
    if (i == 0)
    {
        _529 = _132.iTime;
    }
    else
    {
        _529 = ((floor(_132.iTime / 0.033330000936985015869140625) + 1.0) - float(i)) * 0.033330000936985015869140625;
    }
    float t = _529;
    float param = t;
    return float4(demoPath(param, _132, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _132, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_132.iTime / 0.033330000936985015869140625) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _132) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.033330000936985015869140625) * 1.5;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _132)
{
    bool _483 = (a.z - b.z) > 0.25;
    bool _496;
    if (_483)
    {
        _496 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * trailUnit(_132));
    }
    else
    {
        _496 = _483;
    }
    return _496;
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _132, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _132.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.033330000936985015869140625;
        return float4(demoPath(param, _132, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_132.iResolution[0], _132.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
    float4 c = (gWalkCos * float4(0.998750269412994384765625, 0.993394792079925537109375, 0.995004177093505859375, 0.988011538982391357421875)) + (gWalkSin * float4(0.0499791689217090606689453125, 0.11474668979644775390625, 0.099833421409130096435546875, 0.15438009798526763916015625));
    gWalkSin = (gWalkSin * float4(0.998750269412994384765625, 0.993394792079925537109375, 0.995004177093505859375, 0.988011538982391357421875)) - (gWalkCos * float4(0.0499791689217090606689453125, 0.11474668979644775390625, 0.099833421409130096435546875, 0.15438009798526763916015625));
    gWalkCos = c;
    return point;
}

static inline __attribute__((always_inline))
float trailBoxDist(thread const float2& p, thread const float2& p0, thread const float2& p1, thread const float2& p2, thread const float2& p3, thread const float& scale)
{
    float2 c1 = p1 + ((p2 - p0) / float2(6.0));
    float2 c2 = p2 - ((p3 - p1) / float2(6.0));
    float2 lo = fast::min(fast::min(p1, p2), fast::min(c1, c2)) * scale;
    float2 hi = fast::max(fast::max(p1, p2), fast::max(c1, c2)) * scale;
    return length(fast::max(fast::max(lo - p, p - hi), float2(0.0)));
}

static inline __attribute__((always_inline))
float2 catmull(thread const float2& p0, thread const float2& p1, thread const float2& p2, thread const float2& p3, thread const float& t)
{
    float t2 = t * t;
    float t3 = t2 * t;
    return ((((p1 * 2.0) + ((p2 - p0) * t)) + (((((p0 * 2.0) - (p1 * 5.0)) + (p2 * 4.0)) - p3) * t2)) + (((((p1 * 3.0) - p0) - (p2 * 3.0)) + p3) * t3)) * 0.5;
}

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return float2(length((p - a) - (ab * t)), t);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _132, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float px = 1.0 / trailUnit(_132);
    float2 p = fragCoord * px;
    bool param = _132.uDemo != 0u;
    bool live = trailLive(param, _132);
    int param_1 = 0;
    bool param_2 = live;
    float4 a = trailAt(param_1, param_2, _132, uPath, uPathSmplr);
    int param_3 = 1;
    bool param_4 = live;
    float4 b = trailAt(param_3, param_4, _132, uPath, uPathSmplr);
    bool _839 = a.w < 0.5;
    bool _846;
    if (!_839)
    {
        _846 = b.w < 0.5;
    }
    else
    {
        _846 = _839;
    }
    if (_846)
    {
        fragColor = float4(0.0);
        return;
    }
    float2 prev = (a.xy * 2.0) - b.xy;
    float best = 1000000000.0;
    float bestU = 0.0;
    float bestFace = 1.0;
    float bestV = 0.0;
    float bestFade = 0.0;
    int param_5 = 2;
    bool param_6 = live;
    trailFrom(param_5, param_6, _132, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    float4 _896;
    float2 _917;
    for (int k = 0; k < 31; k++)
    {
        bool _878 = b.w < 0.5;
        bool _887;
        if (!_878)
        {
            float4 param_7 = a;
            float4 param_8 = b;
            _887 = trailJump(param_7, param_8, _132);
        }
        else
        {
            _887 = _878;
        }
        if (_887)
        {
            break;
        }
        if ((k + 2) < 32)
        {
            bool param_9 = live;
            float4 _901 = trailNext(param_9, _132, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
            _896 = _901;
        }
        else
        {
            _896 = float4(0.0);
        }
        float4 c = _896;
        bool _907 = c.w > 0.5;
        bool _916;
        if (_907)
        {
            float4 param_10 = b;
            float4 param_11 = c;
            _916 = !trailJump(param_10, param_11, _132);
        }
        else
        {
            _916 = _907;
        }
        if (_916)
        {
            _917 = c.xy;
        }
        else
        {
            _917 = (b.xy * 2.0) - a.xy;
        }
        float2 next = _917;
        float2 lo = ((fast::min(fast::min(prev, a.xy), fast::min(b.xy, next)) * px) - float2(_132.uWidth)) - float2(2.0 * px);
        float2 hi = ((fast::max(fast::max(prev, a.xy), fast::max(b.xy, next)) * px) + float2(_132.uWidth)) + float2(2.0 * px);
        bool _975 = all(p > lo);
        bool _982;
        if (_975)
        {
            _982 = all(p < hi);
        }
        else
        {
            _982 = _975;
        }
        bool _1006;
        if (_982)
        {
            float2 param_12 = p;
            float2 param_13 = prev;
            float2 param_14 = a.xy;
            float2 param_15 = b.xy;
            float2 param_16 = next;
            float param_17 = px;
            _1006 = (trailBoxDist(param_12, param_13, param_14, param_15, param_16, param_17) - (_132.uWidth * 0.5)) < best;
        }
        else
        {
            _1006 = _982;
        }
        if (_1006)
        {
            float2 q0 = a.xy * px;
            for (int j = 1; j <= 4; j++)
            {
                float t1 = float(j) / 4.0;
                float2 param_18 = prev;
                float2 param_19 = a.xy;
                float2 param_20 = b.xy;
                float2 param_21 = next;
                float param_22 = t1;
                float2 q1 = catmull(param_18, param_19, param_20, param_21, param_22) * px;
                float2 param_23 = p;
                float2 param_24 = q0;
                float2 param_25 = q1;
                float2 s = segment(param_23, param_24, param_25);
                float tt = (float(j - 1) + s.y) / 4.0;
                float u = (float(k) + tt) / 31.0;
                float when = mix(a.z, b.z, tt);
                float fade = fast::clamp(1.0 - ((_132.iTime - when) / _132.uLife), 0.0, 1.0);
                float face = cos((when * _132.uTwist) + (_132.iTime * _132.uSpin));
                float w = (((_132.uWidth * 0.5) * mix(1.0, 0.1500000059604644775390625, u)) * (0.119999997317790985107421875 + (0.87999999523162841796875 * abs(face)))) * sqrt(fade);
                float sd = s.x - w;
                if (sd < best)
                {
                    best = sd;
                    bestU = u;
                    bestFace = face;
                    bestV = s.x / fast::max(w, 9.9999997473787516355514526367188e-06);
                    bestFade = fade;
                }
                q0 = q1;
            }
        }
        prev = a.xy;
        a = b;
        b = c;
    }
    float cover = (1.0 - smoothstep(-px, px, best)) * smoothstep(0.0, 0.1500000059604644775390625, bestFade);
    if (cover <= 0.0)
    {
        fragColor = float4(0.0);
        return;
    }
    float3 _1163;
    if (bestFace >= 0.0)
    {
        _1163 = _132.uColorA;
    }
    else
    {
        _1163 = float3(_132.uColorB);
    }
    float3 base = _1163;
    float3 _1177;
    if (bestFace >= 0.0)
    {
        _1177 = float3(_132.uColorB);
    }
    else
    {
        _1177 = _132.uColorA;
    }
    float3 other = _1177;
    base = mix(base, mix(base, other, float3(0.3499999940395355224609375)) * 0.75, float3(bestU));
    float lit = 0.449999988079071044921875 + (0.550000011920928955078125 * abs(bestFace));
    float3 col = (base * lit) * (1.0 - ((0.300000011920928955078125 * bestV) * bestV));
    float spec = (_132.uShine * powr(abs(bestFace), 6.0)) * exp(-powr((bestV - 0.25) * 2.5, 2.0));
    col = mix(col, float3(1.0), float3(fast::clamp(spec, 0.0, 1.0)));
    fragColor = float4(col, cover);
}

fragment flair_ribbon_trail_frag_out flair_ribbon_trail_frag(constant FlairUniforms& _132 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_ribbon_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float _1255;
    if (_132.flair_flipY > 0.5)
    {
        _1255 = _132.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1255 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1255);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _132, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

