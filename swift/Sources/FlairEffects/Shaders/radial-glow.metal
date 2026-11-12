// flair-metal-hash: 10a2e0df
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
    float3 uBackground;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    int uCount;
    float uSize;
    float uPulse;
    float uSpeed;
    float uIntensity;
    float uBackgroundAlpha;
};

struct flair_radial_glow_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float px = 1.0 / _75.iResolution[1u];
    float2 p = (fragCoord - (float2(_75.iResolution[0], _75.iResolution[1]) * 0.5)) * px;
    float aspect = _75.iResolution[0u] * px;
    float t = _75.iTime * _75.uSpeed;
    float3 light = float3(0.0);
    float3 _134;
    float3 _143;
    float2 _159;
    for (int i = 0; i < 3; i++)
    {
        if (i >= _75.uCount)
        {
            break;
        }
        float fi = float(i);
        if (i == 0)
        {
            _134 = _75.uColorA;
        }
        else
        {
            if (i == 1)
            {
                _143 = _75.uColorB;
            }
            else
            {
                _143 = float3(_75.uColorC);
            }
            _134 = _143;
        }
        float3 c = _134;
        if (_75.uCount == 1)
        {
            _159 = float2(0.0);
        }
        else
        {
            _159 = float2((((fi / float(_75.uCount - 1)) - 0.5) * 0.60000002384185791015625) * aspect, 0.119999997317790985107421875 * sin(fi * 2.400000095367431640625));
        }
        float2 home = _159;
        float2 at = home + (float2(sin((t * 0.5) + (fi * 2.0)), cos((t * 0.4000000059604644775390625) + (fi * 1.2999999523162841796875))) * 0.100000001490116119384765625);
        float breathe = 1.0 + ((_75.uPulse * 0.3499999940395355224609375) * sin((t * 1.7000000476837158203125) + (fi * 2.099999904632568359375)));
        float r = _75.uSize * breathe;
        float d = length(p - at) / r;
        light += ((c * ((exp(((-d) * d) * 2.0) * 0.89999997615814208984375) + (exp((-d) * 1.2000000476837158203125) * 0.25))) * (1.0 + ((_75.uPulse * 0.25) * sin((t * 1.7000000476837158203125) + (fi * 2.099999904632568359375)))));
    }
    float3 col = _75.uBackground + (light * _75.uIntensity);
    col = float3(1.0) - exp((-col) * 1.2000000476837158203125);
    float2 param = fragCoord;
    col += float3((hash12(param) - 0.5) / 255.0);
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
    float3 _341;
    if (a > 0.0)
    {
        _341 = bg + (d / float3(a));
    }
    else
    {
        _341 = bg;
    }
    float3 fg = _341;
    float alpha = a + (opacity * (1.0 - a));
    float3 _363;
    if (alpha > 0.0)
    {
        _363 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _363 = bg;
    }
    float3 col = _363;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _75)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _75);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _75.uBackground;
    float param_4 = _75.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_radial_glow_frag_out flair_radial_glow_frag(constant FlairUniforms& _75 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_radial_glow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _421;
    if (_75.flair_flipY > 0.5)
    {
        _421 = _75.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _421 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _421);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _75);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

