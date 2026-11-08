// flair-metal-hash: 737cf7e2
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
    float3 uBackground;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    float uCount;
    float uSpread;
    float uWave;
    float uTilt;
    float uSpeed;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_light_ribbons_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 shade(thread float& g, constant FlairUniforms& _54)
{
    g = fract(g) * 3.0;
    float3 _41;
    if (g < 1.0)
    {
        _41 = mix(_54.uColorA, _54.uColorB, float3(g));
    }
    else
    {
        float3 _69;
        if (g < 2.0)
        {
            _69 = mix(_54.uColorB, float3(_54.uColorC), float3(g - 1.0));
        }
        else
        {
            _69 = mix(float3(_54.uColorC), _54.uColorA, float3(g - 2.0));
        }
        _41 = _69;
    }
    return _41;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _54)
{
    float2 p = (fragCoord - (float2(_54.iResolution[0], _54.iResolution[1]) * 0.5)) / float2(_54.iResolution[1u]);
    float px = 1.0 / _54.iResolution[1u];
    float t = _54.iTime * _54.uSpeed;
    float halfWidth = (0.5 * _54.iResolution[0u]) / _54.iResolution[1u];
    float x = p.x;
    float y = p.y - (x * _54.uTilt);
    float pinch = 0.3499999940395355224609375 + (0.64999997615814208984375 * abs(sin((x * 1.2999999523162841796875) - (t * 0.699999988079071044921875))));
    float3 light = float3(0.0);
    for (int i = 0; i < 24; i++)
    {
        if (float(i) >= _54.uCount)
        {
            break;
        }
        float f = (float(i) / fast::max(_54.uCount - 1.0, 1.0)) - 0.5;
        float centre = ((f * _54.uSpread) * pinch) + (_54.uWave * ((0.60000002384185791015625 * sin(((x * 1.7000000476837158203125) + t) + (f * 2.0))) + (0.300000011920928955078125 * sin(((x * 3.2999999523162841796875) - (t * 1.2999999523162841796875)) + (f * 5.0)))));
        float d = abs(y - centre);
        float core = 1.0 - smoothstep(0.0, px * 1.5, d);
        float glow = (_54.uGlow * 0.006000000052154064178466796875) / (d + 0.006000000052154064178466796875);
        float param = ((f * 0.60000002384185791015625) + (x * 0.119999997317790985107421875)) + (t * 0.0500000007450580596923828125);
        float3 _256 = shade(param, _54);
        light += (_256 * ((core * 0.89999997615814208984375) + (glow * 0.4000000059604644775390625)));
    }
    light *= (1.0 - (0.75 * powr(fast::min(abs(x) / halfWidth, 1.0), 2.0)));
    fragColor = float4(_54.uBackground + (float3(1.0) - exp(-light)), 1.0);
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
    float3 _338;
    if (a > 0.0)
    {
        _338 = bg + (d / float3(a));
    }
    else
    {
        _338 = bg;
    }
    float3 fg = _338;
    float alpha = a + (opacity * (1.0 - a));
    float3 _360;
    if (alpha > 0.0)
    {
        _360 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _360 = bg;
    }
    float3 col = _360;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _54)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _54);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _54.uBackground;
    float param_4 = _54.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_light_ribbons_frag_out flair_light_ribbons_frag(constant FlairUniforms& _54 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_light_ribbons_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _418;
    if (_54.flair_flipY > 0.5)
    {
        _418 = _54.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _418 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _418);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _54);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

