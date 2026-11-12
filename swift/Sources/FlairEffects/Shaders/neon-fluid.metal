// flair-metal-hash: a1cd9dd7
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
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uBackground;
    float uSpeed;
    float uScale;
    float uSwirl;
    float uStrands;
    float uGlow;
    float uGrain;
    float uDust;
    float uBackgroundAlpha;
};

struct flair_neon_fluid_frag_out
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _192)
{
    float2 p = ((fragCoord - (float2(_192.iResolution[0], _192.iResolution[1]) * 0.5)) / float2(_192.iResolution[1u])) * _192.uScale;
    float t = _192.iTime * _192.uSpeed;
    float2 param = p + float2(0.0, t);
    int param_1 = 3;
    float _223 = fbm(param, param_1);
    float2 param_2 = (p + float2(5.19999980926513671875, 1.2999999523162841796875)) - float2(t);
    int param_3 = 3;
    float _234 = fbm(param_2, param_3);
    float2 q = float2(_223, _234);
    float2 param_4 = ((p + (q * _192.uSwirl)) + float2(1.7000000476837158203125, 9.19999980926513671875)) + float2(0.5 * t);
    int param_5 = 3;
    float _254 = fbm(param_4, param_5);
    float2 param_6 = ((p + (q * _192.uSwirl)) + float2(8.30000019073486328125, 2.7999999523162841796875)) - float2(0.300000011920928955078125 * t);
    int param_7 = 3;
    float _272 = fbm(param_6, param_7);
    float2 r = float2(_254, _272);
    float2 param_8 = p + (r * _192.uSwirl);
    int param_9 = 2;
    float _284 = fbm(param_8, param_9);
    float f = _284 * _192.uStrands;
    float band = floor(f);
    float d = abs(fract(f) - 0.5) / fast::max(fwidth(f), 9.9999997473787516355514526367188e-05);
    float2 param_10 = float2(band, 7.0);
    float on = step(0.3499999940395355224609375, hash12(param_10));
    float k = mod(band, 3.0);
    float3 _316;
    if (k < 1.0)
    {
        _316 = _192.uColorA;
    }
    else
    {
        float3 _325;
        if (k < 2.0)
        {
            _325 = _192.uColorB;
        }
        else
        {
            _325 = _192.uColorC;
        }
        _316 = _325;
    }
    float3 tint = _316;
    float core = exp(((-d) * d) / 5.0);
    float glow = exp((-d) / 16.0);
    float2 param_11 = (fragCoord * 0.449999988079071044921875) + (r * 40.0);
    float grain = mix(1.0, smoothstep(0.3499999940395355224609375, 0.85000002384185791015625, vnoise(param_11)), _192.uGrain);
    float3 light = (tint * on) * (((1.5 * core) * grain) + ((0.300000011920928955078125 * _192.uGlow) * glow));
    float2 param_12 = floor(fragCoord / float2(2.0)) + floor(r * 90.0);
    float spark = step(0.9900000095367431640625 - ((0.039999999105930328369140625 * _192.uDust) * glow), hash12(param_12));
    light += (((tint * (_192.uDust * spark)) * (0.20000000298023223876953125 + (1.60000002384185791015625 * glow))) * on);
    float3 col = (float3(_192.uBackground) * (1.0 - fast::clamp(fast::max(light.x, fast::max(light.y, light.z)), 0.0, 1.0))) + light;
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
    float3 _487;
    if (a > 0.0)
    {
        _487 = bg + (d / float3(a));
    }
    else
    {
        _487 = bg;
    }
    float3 fg = _487;
    float alpha = a + (opacity * (1.0 - a));
    float3 _509;
    if (alpha > 0.0)
    {
        _509 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _509 = bg;
    }
    float3 col = _509;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _192)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _192);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_192.uBackground);
    float param_4 = _192.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_neon_fluid_frag_out flair_neon_fluid_frag(constant FlairUniforms& _192 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_neon_fluid_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _567;
    if (_192.flair_flipY > 0.5)
    {
        _567 = _192.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _567 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _567);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _192);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

