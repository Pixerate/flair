// flair-metal-hash: 00c5e1dd
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
    packed_float3 uBackground;
    float uWidth;
    float uGlow;
    float uCycle;
    float uHue;
    float uLife;
    float uFlicker;
    uint uDemo;
    float uBackgroundAlpha;
    float uUnit;
};

struct flair_light_painting_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float trailUnit(constant FlairUniforms& _170)
{
    float _417;
    if (_170.uUnit > 0.0)
    {
        _417 = _170.uUnit;
    }
    else
    {
        _417 = _170.iResolution[1u];
    }
    return _417;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _170)
{
    bool _536 = !demo;
    bool _551;
    if (!_536)
    {
        bool _543 = _170.iTrail[0].w > 0.5;
        bool _550;
        if (_543)
        {
            _550 = _170.iPointer.z > 0.0;
        }
        else
        {
            _550 = _543;
        }
        _551 = _550;
    }
    else
    {
        _551 = _536;
    }
    return _551;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _170)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_170.iResolution[0u], _170.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_170.iResolution[0], _170.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _203;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _203 = s.y;
    }
    else
    {
        float _212;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _212 = s.x;
        }
        else
        {
            float _222;
            if (meta.w < 1.5)
            {
                _222 = fast::min(s.x, s.y);
            }
            else
            {
                _222 = fast::max(s.x, s.y);
            }
            _212 = _222;
        }
        _203 = _212;
    }
    float k = _203;
    return float3((float2(_170.iResolution[0], _170.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _170)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _170).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _170)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _170);
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
    float2 _346;
    if (b.w < 0.5)
    {
        _346 = a.xy;
    }
    else
    {
        _346 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _346;
    float2 t = b.xy - a.xy;
    float2 _382;
    if (dot(t, t) > 0.0)
    {
        _382 = fast::normalize(t);
    }
    else
    {
        _382 = float2(1.0, 0.0);
    }
    t = _382;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _170.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _170, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.10000002384185791015625;
    float len = pathLength(uPath, uPathSmplr, _170);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _170).xy - pathAt(uPath, uPathSmplr, param_1, _170).xy) < 2.0;
        float _455;
        if (closed)
        {
            _455 = fract(lap) * len;
        }
        else
        {
            _455 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _455;
        return pathAt(uPath, uPathSmplr, param_2, _170).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_170.iResolution[0], _170.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _170, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _170.iTrail[i];
    }
    float _565;
    if (i == 0)
    {
        _565 = _170.iTime;
    }
    else
    {
        _565 = ((floor(_170.iTime / 0.0500000007450580596923828125) + 1.0) - float(i)) * 0.0500000007450580596923828125;
    }
    float t = _565;
    float param = t;
    return float4(demoPath(param, _170, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _170, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_170.iTime / 0.0500000007450580596923828125) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _170) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.0500000007450580596923828125) * 1.10000002384185791015625;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _170)
{
    bool _519 = (a.z - b.z) > 0.25;
    bool _532;
    if (_519)
    {
        _532 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * trailUnit(_170));
    }
    else
    {
        _532 = _519;
    }
    return _532;
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _170, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _170.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.0500000007450580596923828125;
        return float4(demoPath(param, _170, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.0500000007450580596923828125, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_170.iResolution[0], _170.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.0500000007450580596923828125, 1.0);
    float4 c = (gWalkCos * float4(0.998487889766693115234375, 0.99200952053070068359375, 0.993956089019775390625, 0.985500037670135498046875)) + (gWalkSin * float4(0.0549722798168659210205078125, 0.12616288661956787109375, 0.10977829992771148681640625, 0.16967512667179107666015625));
    gWalkSin = (gWalkSin * float4(0.998487889766693115234375, 0.99200952053070068359375, 0.993956089019775390625, 0.985500037670135498046875)) - (gWalkCos * float4(0.0549722798168659210205078125, 0.12616288661956787109375, 0.10977829992771148681640625, 0.16967512667179107666015625));
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
float3 spectrum(thread const float& h)
{
    return float3(0.5) + (cos((float3(h) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _170, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float px = 1.0 / trailUnit(_170);
    float2 p = fragCoord * px;
    float2 uv = fragCoord / float2(_170.iResolution[0], _170.iResolution[1]);
    float3 col = float3(_170.uBackground) * (1.0 - ((0.449999988079071044921875 * dot(uv - float2(0.5), uv - float2(0.5))) * 2.0));
    float2 param = fragCoord + float2(fract(_170.iTime) * 113.0);
    col += float3((hash12(param) - 0.5) * 0.01200000010430812835693359375);
    float3 lit = float3(0.0);
    bool param_1 = _170.uDemo != 0u;
    bool live = trailLive(param_1, _170);
    int param_2 = 0;
    bool param_3 = live;
    float4 a = trailAt(param_2, param_3, _170, uPath, uPathSmplr);
    int param_4 = 1;
    bool param_5 = live;
    float4 b = trailAt(param_4, param_5, _170, uPath, uPathSmplr);
    bool _928 = a.w > 0.5;
    bool _934;
    if (_928)
    {
        _934 = b.w > 0.5;
    }
    else
    {
        _934 = _928;
    }
    if (_934)
    {
        float glowR = (_170.uWidth * 4.0) * fast::max(_170.uGlow, 0.0500000007450580596923828125);
        float margin = ((_170.uWidth * 3.0) + (glowR * 6.0)) + (2.0 * px);
        float2 prev = (a.xy * 2.0) - b.xy;
        float core = 0.0;
        float halo = 0.0;
        float best = 1000000000.0;
        float bestWhen = a.z;
        int param_6 = 2;
        bool param_7 = live;
        trailFrom(param_6, param_7, _170, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
        float4 _1000;
        float2 _1022;
        float2 _1259;
        for (int k = 0; k < 31; k++)
        {
            if (b.w < 0.5)
            {
                break;
            }
            float4 param_8 = a;
            float4 param_9 = b;
            bool jump = trailJump(param_8, param_9, _170);
            if ((k + 2) < 32)
            {
                bool param_10 = live;
                float4 _1005 = trailNext(param_10, _170, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
                _1000 = _1005;
            }
            else
            {
                _1000 = float4(0.0);
            }
            float4 c = _1000;
            bool _1012 = c.w > 0.5;
            bool _1021;
            if (_1012)
            {
                float4 param_11 = b;
                float4 param_12 = c;
                _1021 = !trailJump(param_11, param_12, _170);
            }
            else
            {
                _1021 = _1012;
            }
            if (_1021)
            {
                _1022 = c.xy;
            }
            else
            {
                _1022 = (b.xy * 2.0) - a.xy;
            }
            float2 next = _1022;
            float2 lo = (fast::min(fast::min(prev, a.xy), fast::min(b.xy, next)) * px) - float2(margin);
            float2 hi = (fast::max(fast::max(prev, a.xy), fast::max(b.xy, next)) * px) + float2(margin);
            bool _1066 = !jump;
            bool _1074;
            if (_1066)
            {
                _1074 = all(p > lo);
            }
            else
            {
                _1074 = _1066;
            }
            bool _1081;
            if (_1074)
            {
                _1081 = all(p < hi);
            }
            else
            {
                _1081 = _1074;
            }
            if (_1081)
            {
                float2 param_13 = p;
                float2 param_14 = prev;
                float2 param_15 = a.xy;
                float2 param_16 = b.xy;
                float2 param_17 = next;
                float param_18 = px;
                float dmin = trailBoxDist(param_13, param_14, param_15, param_16, param_17, param_18);
                float top = fast::clamp(1.0 - ((_170.iTime - fast::max(a.z, b.z)) / _170.uLife), 0.0, 1.0);
                top *= top;
                bool _1120 = dmin < best;
                bool _1133;
                if (!_1120)
                {
                    _1133 = (exp((-dmin) / glowR) * top) > halo;
                }
                else
                {
                    _1133 = _1120;
                }
                bool _1152;
                if (!_1133)
                {
                    _1152 = (exp(((-dmin) * dmin) / (_170.uWidth * _170.uWidth)) * top) > core;
                }
                else
                {
                    _1152 = _1133;
                }
                if (_1152)
                {
                    float2 q0 = a.xy * px;
                    for (int j = 1; j <= 4; j++)
                    {
                        float2 param_19 = prev;
                        float2 param_20 = a.xy;
                        float2 param_21 = b.xy;
                        float2 param_22 = next;
                        float param_23 = float(j) / 4.0;
                        float2 q1 = catmull(param_19, param_20, param_21, param_22, param_23) * px;
                        float2 param_24 = p;
                        float2 param_25 = q0;
                        float2 param_26 = q1;
                        float2 s = segment(param_24, param_25, param_26);
                        float when = mix(a.z, b.z, (float(j - 1) + s.y) / 4.0);
                        float fade = fast::clamp(1.0 - ((_170.iTime - when) / _170.uLife), 0.0, 1.0);
                        fade *= fade;
                        float d = s.x;
                        core = fast::max(core, exp(((-d) * d) / (_170.uWidth * _170.uWidth)) * fade);
                        halo = fast::max(halo, exp((-d) / glowR) * fade);
                        if (d < best)
                        {
                            best = d;
                            bestWhen = when;
                        }
                        q0 = q1;
                    }
                }
            }
            if (jump)
            {
                _1259 = (b.xy * 2.0) - next;
            }
            else
            {
                _1259 = a.xy;
            }
            prev = _1259;
            a = b;
            b = c;
        }
        float param_27 = _170.uHue + (bestWhen * _170.uCycle);
        float3 tint = spectrum(param_27);
        float2 param_28 = float2(floor(_170.iTime * 30.0), floor(bestWhen * 20.0));
        float flicker = 1.0 - ((_170.uFlicker * 0.3499999940395355224609375) * hash12(param_28));
        float3 light = (((tint * halo) * _170.uGlow) * 0.89999997615814208984375) + ((mix(tint, float3(1.0), float3(0.75)) * core) * 1.7999999523162841796875);
        lit = (float3(1.0) - exp((-light) * 1.39999997615814208984375)) * flicker;
    }
    float alpha = _170.uBackgroundAlpha + ((1.0 - _170.uBackgroundAlpha) * fast::clamp(fast::max(lit.x, fast::max(lit.y, lit.z)), 0.0, 1.0));
    fragColor = float4(((col * _170.uBackgroundAlpha) + lit) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

fragment flair_light_painting_frag_out flair_light_painting_frag(constant FlairUniforms& _170 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_light_painting_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float _1381;
    if (_170.flair_flipY > 0.5)
    {
        _1381 = _170.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1381 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1381);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _170, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

