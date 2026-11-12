// flair-metal-hash: 43a4b8c7
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float3 uBackground;
    float3 uInkA;
    float3 uInkB;
    float3 uInkC;
    packed_float3 uInkD;
    float uDensity;
    float uScale;
    float uDrift;
    float uWobble;
    float uWeight;
    float uBackgroundAlpha;
};

struct flair_memphis_pattern_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float waveDist(thread const float2& q, thread const float& amp, thread const float& freq, thread const bool& zig, thread const float& halfLen)
{
    float x = fast::clamp(q.x, -halfLen, halfLen);
    float y;
    float slope;
    if (zig)
    {
        float f = fract((x * freq) + 0.25);
        y = amp * ((abs(f - 0.5) * 4.0) - 1.0);
        slope = (4.0 * amp) * freq;
    }
    else
    {
        y = amp * sin((x * freq) * 6.28318023681640625);
        slope = ((amp * freq) * 6.28318023681640625) * cos((x * freq) * 6.28318023681640625);
    }
    return length(float2(q.x - x, (q.y - y) / sqrt(1.0 + (slope * slope))));
}

static inline __attribute__((always_inline))
float triDist(thread float2& p, thread const float& r)
{
    p.x = abs(p.x) - r;
    p.y += (r / 1.73205077648162841796875);
    if ((p.x + (1.73205077648162841796875 * p.y)) > 0.0)
    {
        p = float2(p.x - (1.73205077648162841796875 * p.y), ((-1.73205077648162841796875) * p.x) - p.y) / float2(2.0);
    }
    p.x -= fast::clamp(p.x, (-2.0) * r, 0.0);
    return (-length(p)) * sign(p.y);
}

static inline __attribute__((always_inline))
float segDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - (ba * h));
}

static inline __attribute__((always_inline))
float shapeDist(thread const int& kind, thread const float2& q, thread const float& w)
{
    if (kind == 0)
    {
        float2 param = q;
        float param_1 = 0.07999999821186065673828125;
        float param_2 = 2.2000000476837158203125;
        bool param_3 = false;
        float param_4 = 0.36000001430511474609375;
        return waveDist(param, param_1, param_2, param_3, param_4) - w;
    }
    if (kind == 1)
    {
        float2 param_5 = q;
        float param_6 = 0.07999999821186065673828125;
        float param_7 = 2.5;
        bool param_8 = true;
        float param_9 = 0.3400000035762786865234375;
        return waveDist(param_5, param_6, param_7, param_8, param_9) - w;
    }
    if (kind == 2)
    {
        float2 param_10 = q;
        float param_11 = 0.20000000298023223876953125;
        float _406 = triDist(param_10, param_11);
        return _406;
    }
    if (kind == 3)
    {
        return abs(length(q) - 0.1599999964237213134765625) - w;
    }
    if (kind == 4)
    {
        return length(q) - 0.100000001490116119384765625;
    }
    if (kind == 5)
    {
        float2 param_12 = q;
        float2 param_13 = float2(-0.12999999523162841796875, 0.0);
        float2 param_14 = float2(0.12999999523162841796875, 0.0);
        return segDist(param_12, param_13, param_14) - w;
    }
    float2 g = q - (fast::clamp(round(q / float2(0.10999999940395355224609375)), float2(-1.0), float2(1.0)) * 0.10999999940395355224609375);
    return length(g) - 0.0280000008642673492431640625;
}

static inline __attribute__((always_inline))
float3 ink(thread const float& h, constant FlairUniforms& _479)
{
    if (h < 0.25)
    {
        return _479.uInkA;
    }
    if (h < 0.5)
    {
        return _479.uInkB;
    }
    if (h < 0.75)
    {
        return _479.uInkC;
    }
    return float3(_479.uInkD);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _479)
{
    float px = _479.uScale / _479.iResolution[1u];
    float t = (6.28318023681640625 * _479.iTime) / 8.0;
    float2 p = (fragCoord - (float2(_479.iResolution[0], _479.iResolution[1]) * 0.5)) * px;
    p += (float2(2.0 * cos(t), sin(2.0 * t)) * _479.uDrift);
    float frame = mod(floor(_479.iTime * 6.0), 48.0);
    float2 param = (p * 3.0) + float2(frame * 7.13000011444091796875);
    float2 param_1 = ((p * 3.0) + float2(frame * 3.71000003814697265625)) + float2(19.0);
    float2 n = float2(vnoise(param), vnoise(param_1)) - float2(0.5);
    p += ((n * _479.uWobble) * 0.070000000298023223876953125);
    float3 col = _479.uBackground;
    float2 id0 = floor(p);
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 id = id0 + float2(float(i), float(j));
            float2 param_2 = id;
            if (hash12(param_2) > _479.uDensity)
            {
                continue;
            }
            float2 param_3 = id + float2(11.1000003814697265625);
            float ph = hash12(param_3) * 6.28318023681640625;
            float2 param_4 = id + float2(3.7000000476837158203125);
            float2 c = (id + float2(0.5)) + ((hash22(param_4) - float2(0.5)) * 0.60000002384185791015625);
            c.y += (0.0599999986588954925537109375 * sin((t * 2.0) + ph));
            float2 param_5 = id + float2(5.30000019073486328125);
            float ang = (hash12(param_5) * 6.28318023681640625) + (0.3499999940395355224609375 * sin(t + ph));
            float2 param_6 = id + float2(8.80000019073486328125);
            float sz = 0.800000011920928955078125 + (0.5 * hash12(param_6));
            float param_7 = ang;
            float2 q = (rot(param_7) * (p - c)) / float2(sz);
            float2 param_8 = id + float2(2.2000000476837158203125);
            int kind = min(int(hash12(param_8) * 7.0), 6);
            int param_9 = kind;
            float2 param_10 = q;
            float param_11 = (_479.uWeight * 0.5) / sz;
            float d = shapeDist(param_9, param_10, param_11) * sz;
            float cover = 1.0 - smoothstep((-0.75) * px, 0.75 * px, d);
            float2 param_12 = id + float2(9.8999996185302734375);
            float param_13 = hash12(param_12);
            col = mix(col, ink(param_13, _479), float3(cover));
        }
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
    float3 _797;
    if (a > 0.0)
    {
        _797 = bg + (d / float3(a));
    }
    else
    {
        _797 = bg;
    }
    float3 fg = _797;
    float alpha = a + (opacity * (1.0 - a));
    float3 _819;
    if (alpha > 0.0)
    {
        _819 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _819 = bg;
    }
    float3 col = _819;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _479)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _479);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _479.uBackground;
    float param_4 = _479.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_memphis_pattern_frag_out flair_memphis_pattern_frag(constant FlairUniforms& _479 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_memphis_pattern_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _876;
    if (_479.flair_flipY > 0.5)
    {
        _876 = _479.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _876 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _876);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _479);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

