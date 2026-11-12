// flair-metal-hash: 1d662947
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
    int uPattern;
    float uRate;
    float uIntensity;
    float uSpread;
    float uHaze;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_siren_lights_frag_out
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
float lampOn(thread const float& phase)
{
    return smoothstep(0.0, 0.180000007152557373046875, phase) * (1.0 - smoothstep(0.300000011920928955078125, 0.5, phase));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _138)
{
    float aspect = _138.iResolution[0u] / _138.iResolution[1u];
    float2 p = float2(fragCoord.x / _138.iResolution[1u], fragCoord.y / _138.iResolution[1u]);
    float rate = fast::clamp(_138.uRate, 0.25, 1.5);
    float2 param = (p * 3.0) + float2(_138.iTime * 0.07999999821186065673828125, (-_138.iTime) * 0.0500000007450580596923828125);
    float haze = (1.0 - _138.uHaze) + (_138.uHaze * (0.550000011920928955078125 + (0.89999997615814208984375 * vnoise(param))));
    float3 light = float3(0.0);
    float3 _213;
    float on;
    for (int i = 0; i < 2; i++)
    {
        float side = float(i);
        if (i == 0)
        {
            _213 = _138.uColorA;
        }
        else
        {
            _213 = float3(_138.uColorB);
        }
        float3 colour = _213;
        float2 lamp = float2(mix(0.20000000298023223876953125, 0.800000011920928955078125, side) * aspect, 1.03999996185302734375);
        float2 d = p - lamp;
        float r = length(d);
        float phase = fract((_138.iTime * rate) + (0.5 * side));
        float beam = 0.0;
        if (_138.uPattern == 1)
        {
            float a = phase * 6.28318023681640625;
            float facing = powr(fast::max(sin(a), 0.0), 8.0);
            on = 0.119999997317790985107421875 + (0.87999999523162841796875 * facing);
            float2 dir = fast::normalize(float2(cos(a) * 1.39999997615814208984375, -0.550000011920928955078125));
            float along = dot(d, dir);
            float off = length(d - (dir * along));
            float cone = 0.0599999986588954925537109375 + (0.2199999988079071044921875 * fast::max(along, 0.0));
            beam = ((step(0.0, along) * exp(((-off) * off) / (cone * cone))) * ((0.3499999940395355224609375 + (0.64999997615814208984375 * fast::max(-sin(a), 0.0))) + facing)) / (1.0 + (1.2000000476837158203125 * along));
        }
        else
        {
            float param_1 = phase;
            on = lampOn(param_1);
        }
        float wash = exp(((-r) * r) / (_138.uSpread * _138.uSpread));
        float hot = 0.0040000001899898052215576171875 / ((r * r) + 0.0040000001899898052215576171875);
        light += (colour * ((on * (((0.85000002384185791015625 * wash) * haze) + hot)) + ((0.89999997615814208984375 * beam) * haze)));
    }
    light *= _138.uIntensity;
    float3 premul = ((float3(_138.uBackground) * _138.uBackgroundAlpha) * (1.0 - fast::min(fast::max(light.x, fast::max(light.y, light.z)), 1.0))) + light;
    float alpha = fast::clamp(_138.uBackgroundAlpha + fast::max(light.x, fast::max(light.y, light.z)), 0.0, 1.0);
    fragColor = float4(fast::clamp(premul / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(0.0), float3(1.0)), alpha);
}

fragment flair_siren_lights_frag_out flair_siren_lights_frag(constant FlairUniforms& _138 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_siren_lights_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _437;
    if (_138.flair_flipY > 0.5)
    {
        _437 = _138.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _437 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _437);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _138);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

