// flair-metal-hash: a55ce97e
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
};

struct flair_ribbon_trail_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _129)
{
    bool _483 = !demo;
    bool _498;
    if (!_483)
    {
        bool _490 = _129.iTrail[0].w > 0.5;
        bool _497;
        if (_490)
        {
            _497 = _129.iPointer.z > 0.0;
        }
        else
        {
            _497 = _490;
        }
        _498 = _497;
    }
    else
    {
        _498 = _483;
    }
    return _498;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _129)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_129.iResolution[0u], _129.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_129.iResolution[0], _129.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _163;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _163 = s.y;
    }
    else
    {
        float _172;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _172 = s.x;
        }
        else
        {
            float _182;
            if (meta.w < 1.5)
            {
                _182 = fast::min(s.x, s.y);
            }
            else
            {
                _182 = fast::max(s.x, s.y);
            }
            _172 = _182;
        }
        _163 = _172;
    }
    float k = _163;
    return float3((float2(_129.iResolution[0], _129.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _129)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _129).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _129)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _129);
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
    float2 _308;
    if (b.w < 0.5)
    {
        _308 = a.xy;
    }
    else
    {
        _308 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _308;
    float2 t = b.xy - a.xy;
    float2 _344;
    if (dot(t, t) > 0.0)
    {
        _344 = fast::normalize(t);
    }
    else
    {
        _344 = float2(1.0, 0.0);
    }
    t = _344;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _129.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _129, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.5;
    float len = pathLength(uPath, uPathSmplr, _129);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _129).xy - pathAt(uPath, uPathSmplr, param_1, _129).xy) < 2.0;
        float _401;
        if (closed)
        {
            _401 = fract(lap) * len;
        }
        else
        {
            _401 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _401;
        return pathAt(uPath, uPathSmplr, param_2, _129).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_129.iResolution[0], _129.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _129, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _129.iTrail[i];
    }
    float _512;
    if (i == 0)
    {
        _512 = _129.iTime;
    }
    else
    {
        _512 = ((floor(_129.iTime / 0.033330000936985015869140625) + 1.0) - float(i)) * 0.033330000936985015869140625;
    }
    float t = _512;
    float param = t;
    return float4(demoPath(param, _129, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _129, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_129.iTime / 0.033330000936985015869140625) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _129) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.033330000936985015869140625) * 1.5;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _129)
{
    bool _465 = (a.z - b.z) > 0.25;
    bool _479;
    if (_465)
    {
        _479 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * _129.iResolution[1u]);
    }
    else
    {
        _479 = _465;
    }
    return _479;
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _129, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _129.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.033330000936985015869140625;
        return float4(demoPath(param, _129, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_129.iResolution[0], _129.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.033330000936985015869140625, 1.0);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _129, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float px = 1.0 / _129.iResolution[1u];
    float2 p = fragCoord * px;
    bool param = _129.uDemo != 0u;
    bool live = trailLive(param, _129);
    int param_1 = 0;
    bool param_2 = live;
    float4 a = trailAt(param_1, param_2, _129, uPath, uPathSmplr);
    int param_3 = 1;
    bool param_4 = live;
    float4 b = trailAt(param_3, param_4, _129, uPath, uPathSmplr);
    bool _823 = a.w < 0.5;
    bool _830;
    if (!_823)
    {
        _830 = b.w < 0.5;
    }
    else
    {
        _830 = _823;
    }
    if (_830)
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
    trailFrom(param_5, param_6, _129, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    float4 _880;
    float2 _901;
    for (int k = 0; k < 31; k++)
    {
        bool _862 = b.w < 0.5;
        bool _871;
        if (!_862)
        {
            float4 param_7 = a;
            float4 param_8 = b;
            _871 = trailJump(param_7, param_8, _129);
        }
        else
        {
            _871 = _862;
        }
        if (_871)
        {
            break;
        }
        if ((k + 2) < 32)
        {
            bool param_9 = live;
            float4 _885 = trailNext(param_9, _129, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
            _880 = _885;
        }
        else
        {
            _880 = float4(0.0);
        }
        float4 c = _880;
        bool _891 = c.w > 0.5;
        bool _900;
        if (_891)
        {
            float4 param_10 = b;
            float4 param_11 = c;
            _900 = !trailJump(param_10, param_11, _129);
        }
        else
        {
            _900 = _891;
        }
        if (_900)
        {
            _901 = c.xy;
        }
        else
        {
            _901 = (b.xy * 2.0) - a.xy;
        }
        float2 next = _901;
        float2 lo = ((fast::min(fast::min(prev, a.xy), fast::min(b.xy, next)) * px) - float2(_129.uWidth)) - float2(2.0 * px);
        float2 hi = ((fast::max(fast::max(prev, a.xy), fast::max(b.xy, next)) * px) + float2(_129.uWidth)) + float2(2.0 * px);
        bool _959 = all(p > lo);
        bool _966;
        if (_959)
        {
            _966 = all(p < hi);
        }
        else
        {
            _966 = _959;
        }
        bool _990;
        if (_966)
        {
            float2 param_12 = p;
            float2 param_13 = prev;
            float2 param_14 = a.xy;
            float2 param_15 = b.xy;
            float2 param_16 = next;
            float param_17 = px;
            _990 = (trailBoxDist(param_12, param_13, param_14, param_15, param_16, param_17) - (_129.uWidth * 0.5)) < best;
        }
        else
        {
            _990 = _966;
        }
        if (_990)
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
                float fade = fast::clamp(1.0 - ((_129.iTime - when) / _129.uLife), 0.0, 1.0);
                float face = cos((when * _129.uTwist) + (_129.iTime * _129.uSpin));
                float w = (((_129.uWidth * 0.5) * mix(1.0, 0.1500000059604644775390625, u)) * (0.119999997317790985107421875 + (0.87999999523162841796875 * abs(face)))) * sqrt(fade);
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
    float3 _1147;
    if (bestFace >= 0.0)
    {
        _1147 = _129.uColorA;
    }
    else
    {
        _1147 = float3(_129.uColorB);
    }
    float3 base = _1147;
    float3 _1161;
    if (bestFace >= 0.0)
    {
        _1161 = float3(_129.uColorB);
    }
    else
    {
        _1161 = _129.uColorA;
    }
    float3 other = _1161;
    base = mix(base, mix(base, other, float3(0.3499999940395355224609375)) * 0.75, float3(bestU));
    float lit = 0.449999988079071044921875 + (0.550000011920928955078125 * abs(bestFace));
    float3 col = (base * lit) * (1.0 - ((0.300000011920928955078125 * bestV) * bestV));
    float spec = (_129.uShine * powr(abs(bestFace), 6.0)) * exp(-powr((bestV - 0.25) * 2.5, 2.0));
    col = mix(col, float3(1.0), float3(fast::clamp(spec, 0.0, 1.0)));
    fragColor = float4(col, cover);
}

fragment flair_ribbon_trail_frag_out flair_ribbon_trail_frag(constant FlairUniforms& _129 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_ribbon_trail_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float _1239;
    if (_129.flair_flipY > 0.5)
    {
        _1239 = _129.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1239 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1239);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _129, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

