// flair-metal-hash: 679f6856
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
};

struct flair_light_painting_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
bool trailLive(thread const bool& demo, constant FlairUniforms& _177)
{
    bool _529 = !demo;
    bool _544;
    if (!_529)
    {
        bool _536 = _177.iTrail[0].w > 0.5;
        bool _543;
        if (_536)
        {
            _543 = _177.iPointer.z > 0.0;
        }
        else
        {
            _543 = _536;
        }
        _544 = _543;
    }
    else
    {
        _544 = _529;
    }
    return _544;
}

static inline __attribute__((always_inline))
float3 pathFrame(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _177)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    if (meta.w < 0.5)
    {
        return float3(0.0, 0.0, 1.0);
    }
    float4 b = path.read(uint2(int2(1)), 0);
    float margin = path.read(uint2(int2(2, 1)), 0).x * fast::min(_177.iResolution[0u], _177.iResolution[1u]);
    float2 size = b.zw - b.xy;
    float2 s = (float2(_177.iResolution[0], _177.iResolution[1]) - float2(2.0 * margin)) / fast::max(size, float2(9.9999999747524270787835121154785e-07));
    float _210;
    if (size.x < 9.9999999747524270787835121154785e-07)
    {
        _210 = s.y;
    }
    else
    {
        float _219;
        if (size.y < 9.9999999747524270787835121154785e-07)
        {
            _219 = s.x;
        }
        else
        {
            float _229;
            if (meta.w < 1.5)
            {
                _229 = fast::min(s.x, s.y);
            }
            else
            {
                _229 = fast::max(s.x, s.y);
            }
            _219 = _229;
        }
        _210 = _219;
    }
    float k = _210;
    return float3((float2(_177.iResolution[0], _177.iResolution[1]) * 0.5) - ((b.xy + (size * 0.5)) * k), k);
}

static inline __attribute__((always_inline))
float pathLength(texture2d<float> path, sampler pathSmplr, constant FlairUniforms& _177)
{
    return path.read(uint2(int2(0, 1)), 0).y * pathFrame(path, pathSmplr, _177).z;
}

static inline __attribute__((always_inline))
float4 pathAt(texture2d<float> path, sampler pathSmplr, thread const float& along, constant FlairUniforms& _177)
{
    float4 meta = path.read(uint2(int2(0, 1)), 0);
    int n = int(meta.x);
    if (n < 2)
    {
        return float4(0.0, 0.0, 1.0, 0.0);
    }
    float3 f = pathFrame(path, pathSmplr, _177);
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
    float2 _353;
    if (b.w < 0.5)
    {
        _353 = a.xy;
    }
    else
    {
        _353 = mix(a.xy, b.xy, float2(fast::clamp((s - a.z) / fast::max(b.z - a.z, 9.999999717180685365747194737196e-10), 0.0, 1.0)));
    }
    float2 q = _353;
    float2 t = b.xy - a.xy;
    float2 _389;
    if (dot(t, t) > 0.0)
    {
        _389 = fast::normalize(t);
    }
    else
    {
        _389 = float2(1.0, 0.0);
    }
    t = _389;
    float2 at = (q * f.z) + f.xy;
    return float4(at.x, _177.iResolution[1u] - at.y, t.x, -t.y);
}

static inline __attribute__((always_inline))
float2 demoPath(thread const float& t, constant FlairUniforms& _177, texture2d<float> uPath, sampler uPathSmplr)
{
    float s = t * 1.10000002384185791015625;
    float len = pathLength(uPath, uPathSmplr, _177);
    if (len > 0.0)
    {
        float lap = s / 6.283185482025146484375;
        float param = 0.0;
        float param_1 = len;
        bool closed = length(pathAt(uPath, uPathSmplr, param, _177).xy - pathAt(uPath, uPathSmplr, param_1, _177).xy) < 2.0;
        float _447;
        if (closed)
        {
            _447 = fract(lap) * len;
        }
        else
        {
            _447 = (0.5 - (0.5 * cos(3.1415927410125732421875 * lap))) * len;
        }
        float param_2 = _447;
        return pathAt(uPath, uPathSmplr, param_2, _177).xy;
    }
    float2 q = float2((0.3400000035762786865234375 * sin(s)) + (0.0500000007450580596923828125 * sin((s * 2.2999999523162841796875) + 1.0)), (0.2700000107288360595703125 * sin((s * 2.0) + 0.4000000059604644775390625)) + (0.039999999105930328369140625 * cos(s * 3.099999904632568359375)));
    return float2(_177.iResolution[0], _177.iResolution[1]) * (float2(0.5) + q);
}

static inline __attribute__((always_inline))
float4 trailAt(thread const int& i, thread const bool& live, constant FlairUniforms& _177, texture2d<float> uPath, sampler uPathSmplr)
{
    if (live)
    {
        return _177.iTrail[i];
    }
    float _558;
    if (i == 0)
    {
        _558 = _177.iTime;
    }
    else
    {
        _558 = ((floor(_177.iTime / 0.0500000007450580596923828125) + 1.0) - float(i)) * 0.0500000007450580596923828125;
    }
    float t = _558;
    float param = t;
    return float4(demoPath(param, _177, uPath, uPathSmplr), t, 1.0);
}

static inline __attribute__((always_inline))
void trailFrom(thread const int& i, thread const bool& live, constant FlairUniforms& _177, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    gWalkI = i;
    if (live)
    {
        return;
    }
    gWalkBase = floor(_177.iTime / 0.0500000007450580596923828125) + 1.0;
    gWalkPath = pathLength(uPath, uPathSmplr, _177) > 0.0;
    float s = ((gWalkBase - float(i)) * 0.0500000007450580596923828125) * 1.10000002384185791015625;
    float4 phase = float4(s, (s * 2.2999999523162841796875) + 1.0, (s * 2.0) + 0.4000000059604644775390625, s * 3.099999904632568359375);
    gWalkCos = cos(phase);
    gWalkSin = sin(phase);
}

static inline __attribute__((always_inline))
bool trailJump(thread const float4& a, thread const float4& b, constant FlairUniforms& _177)
{
    bool _511 = (a.z - b.z) > 0.25;
    bool _525;
    if (_511)
    {
        _525 = length(a.xy - b.xy) > (0.02999999932944774627685546875 * _177.iResolution[1u]);
    }
    else
    {
        _525 = _511;
    }
    return _525;
}

static inline __attribute__((always_inline))
float4 trailNext(thread const bool& live, constant FlairUniforms& _177, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    int i = gWalkI;
    gWalkI++;
    if (live)
    {
        return _177.iTrail[min(i, 31)];
    }
    if (gWalkPath)
    {
        float param = (gWalkBase - float(i)) * 0.0500000007450580596923828125;
        return float4(demoPath(param, _177, uPath, uPathSmplr), (gWalkBase - float(i)) * 0.0500000007450580596923828125, 1.0);
    }
    float2 q = float2((0.3400000035762786865234375 * gWalkSin.x) + (0.0500000007450580596923828125 * gWalkSin.y), (0.2700000107288360595703125 * gWalkSin.z) + (0.039999999105930328369140625 * gWalkCos.w));
    float4 point = float4(float2(_177.iResolution[0], _177.iResolution[1]) * (float2(0.5) + q), (gWalkBase - float(i)) * 0.0500000007450580596923828125, 1.0);
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _177, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float px = 1.0 / _177.iResolution[1u];
    float2 p = fragCoord * px;
    float2 uv = fragCoord / float2(_177.iResolution[0], _177.iResolution[1]);
    float3 col = float3(_177.uBackground) * (1.0 - ((0.449999988079071044921875 * dot(uv - float2(0.5), uv - float2(0.5))) * 2.0));
    float2 param = fragCoord + float2(fract(_177.iTime) * 113.0);
    col += float3((hash12(param) - 0.5) * 0.01200000010430812835693359375);
    bool param_1 = _177.uDemo != 0u;
    bool live = trailLive(param_1, _177);
    int param_2 = 0;
    bool param_3 = live;
    float4 a = trailAt(param_2, param_3, _177, uPath, uPathSmplr);
    int param_4 = 1;
    bool param_5 = live;
    float4 b = trailAt(param_4, param_5, _177, uPath, uPathSmplr);
    bool _920 = a.w > 0.5;
    bool _926;
    if (_920)
    {
        _926 = b.w > 0.5;
    }
    else
    {
        _926 = _920;
    }
    if (_926)
    {
        float glowR = (_177.uWidth * 4.0) * fast::max(_177.uGlow, 0.0500000007450580596923828125);
        float margin = ((_177.uWidth * 3.0) + (glowR * 6.0)) + (2.0 * px);
        float2 prev = (a.xy * 2.0) - b.xy;
        float core = 0.0;
        float halo = 0.0;
        float best = 1000000000.0;
        float bestWhen = a.z;
        int param_6 = 2;
        bool param_7 = live;
        trailFrom(param_6, param_7, _177, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
        float4 _992;
        float2 _1014;
        float2 _1251;
        for (int k = 0; k < 31; k++)
        {
            if (b.w < 0.5)
            {
                break;
            }
            float4 param_8 = a;
            float4 param_9 = b;
            bool jump = trailJump(param_8, param_9, _177);
            if ((k + 2) < 32)
            {
                bool param_10 = live;
                float4 _997 = trailNext(param_10, _177, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
                _992 = _997;
            }
            else
            {
                _992 = float4(0.0);
            }
            float4 c = _992;
            bool _1004 = c.w > 0.5;
            bool _1013;
            if (_1004)
            {
                float4 param_11 = b;
                float4 param_12 = c;
                _1013 = !trailJump(param_11, param_12, _177);
            }
            else
            {
                _1013 = _1004;
            }
            if (_1013)
            {
                _1014 = c.xy;
            }
            else
            {
                _1014 = (b.xy * 2.0) - a.xy;
            }
            float2 next = _1014;
            float2 lo = (fast::min(fast::min(prev, a.xy), fast::min(b.xy, next)) * px) - float2(margin);
            float2 hi = (fast::max(fast::max(prev, a.xy), fast::max(b.xy, next)) * px) + float2(margin);
            bool _1058 = !jump;
            bool _1066;
            if (_1058)
            {
                _1066 = all(p > lo);
            }
            else
            {
                _1066 = _1058;
            }
            bool _1073;
            if (_1066)
            {
                _1073 = all(p < hi);
            }
            else
            {
                _1073 = _1066;
            }
            if (_1073)
            {
                float2 param_13 = p;
                float2 param_14 = prev;
                float2 param_15 = a.xy;
                float2 param_16 = b.xy;
                float2 param_17 = next;
                float param_18 = px;
                float dmin = trailBoxDist(param_13, param_14, param_15, param_16, param_17, param_18);
                float top = fast::clamp(1.0 - ((_177.iTime - fast::max(a.z, b.z)) / _177.uLife), 0.0, 1.0);
                top *= top;
                bool _1112 = dmin < best;
                bool _1125;
                if (!_1112)
                {
                    _1125 = (exp((-dmin) / glowR) * top) > halo;
                }
                else
                {
                    _1125 = _1112;
                }
                bool _1144;
                if (!_1125)
                {
                    _1144 = (exp(((-dmin) * dmin) / (_177.uWidth * _177.uWidth)) * top) > core;
                }
                else
                {
                    _1144 = _1125;
                }
                if (_1144)
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
                        float fade = fast::clamp(1.0 - ((_177.iTime - when) / _177.uLife), 0.0, 1.0);
                        fade *= fade;
                        float d = s.x;
                        core = fast::max(core, exp(((-d) * d) / (_177.uWidth * _177.uWidth)) * fade);
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
                _1251 = (b.xy * 2.0) - next;
            }
            else
            {
                _1251 = a.xy;
            }
            prev = _1251;
            a = b;
            b = c;
        }
        float param_27 = _177.uHue + (bestWhen * _177.uCycle);
        float3 tint = spectrum(param_27);
        float2 param_28 = float2(floor(_177.iTime * 30.0), floor(bestWhen * 20.0));
        float flicker = 1.0 - ((_177.uFlicker * 0.3499999940395355224609375) * hash12(param_28));
        float3 light = (((tint * halo) * _177.uGlow) * 0.89999997615814208984375) + ((mix(tint, float3(1.0), float3(0.75)) * core) * 1.7999999523162841796875);
        col += ((float3(1.0) - exp((-light) * 1.39999997615814208984375)) * flicker);
    }
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _1378;
    if (a > 0.0)
    {
        _1378 = bg + (d / float3(a));
    }
    else
    {
        _1378 = bg;
    }
    float3 fg = _1378;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1400;
    if (alpha > 0.0)
    {
        _1400 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1400 = bg;
    }
    float3 col = _1400;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _177, texture2d<float> uPath, sampler uPathSmplr, thread int& gWalkI, thread float& gWalkBase, thread bool& gWalkPath, thread float4& gWalkCos, thread float4& gWalkSin)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _177, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_177.uBackground);
    float param_4 = _177.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_light_painting_frag_out flair_light_painting_frag(constant FlairUniforms& _177 [[buffer(0)]], texture2d<float> uPath [[texture(1)]], sampler uPathSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_light_painting_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    int gWalkI;
    float gWalkBase;
    bool gWalkPath;
    float4 gWalkCos;
    float4 gWalkSin;
    float _1457;
    if (_177.flair_flipY > 0.5)
    {
        _1457 = _177.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1457 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1457);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _177, uPath, uPathSmplr, gWalkI, gWalkBase, gWalkPath, gWalkCos, gWalkSin);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

