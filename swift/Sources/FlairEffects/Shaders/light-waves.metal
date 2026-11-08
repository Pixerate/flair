// flair-metal-hash: a378ed7b
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float3 uShadow;
    float3 uBase;
    float3 uHighlight;
    packed_float3 uSheen;
    float uScale;
    float uDensity;
    float uBend;
    float uRidge;
    float uRelief;
    float uGloss;
    float uIridescence;
    float uSpeed;
    float uAngle;
};

struct flair_light_waves_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float waveHeight(thread float2& p, thread const float& t)
{
    p += (float2(sin((p.y * 1.2999999523162841796875) + t), sin((p.x * 1.10000002384185791015625) - (t * 0.800000011920928955078125))) * 0.449999988079071044921875);
    return (sin((p.x * 1.39999997615814208984375) + (1.60000002384185791015625 * sin((p.y * 0.89999997615814208984375) + (t * 0.699999988079071044921875)))) + (0.60000002384185791015625 * sin(((p.y * 1.7999999523162841796875) - (p.x * 0.699999988079071044921875)) + (t * 0.5)))) + (0.25 * sin((sqrt(dot(p - float2(0.800000011920928955078125, -0.4000000059604644775390625), p - float2(0.800000011920928955078125, -0.4000000059604644775390625)) + 0.300000011920928955078125) * 3.2000000476837158203125) - (t * 1.2000000476837158203125)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _136)
{
    float param = radians(_136.uAngle);
    float2x2 turn = rot(param);
    float2 p = (((turn * (fragCoord - (float2(_136.iResolution[0], _136.iResolution[1]) * 0.5))) / float2(_136.iResolution[1u])) * 2.0) / float2(_136.uScale);
    float t = (_136.iTime * _136.uSpeed) * 2.0;
    float2 param_1 = p;
    float param_2 = t;
    float _180 = waveHeight(param_1, param_2);
    float h = _180;
    float e = 0.0040000001899898052215576171875;
    float2 param_3 = p + float2(e, 0.0);
    float param_4 = t;
    float _191 = waveHeight(param_3, param_4);
    float2 param_5 = p + float2(0.0, e);
    float param_6 = t;
    float _201 = waveHeight(param_5, param_6);
    float2 g = float2(_191 - h, _201 - h) / float2(e);
    float s = p.y + ((0.3499999940395355224609375 * _136.uBend) * h);
    float2 across = fast::normalize(float2(0.0, 1.0) + (g * (0.3499999940395355224609375 * _136.uBend)));
    float f = (s * _136.uDensity) * 0.25;
    float resolved = smoothstep(0.550000011920928955078125, 0.300000011920928955078125, fwidth(f));
    float tilt = ((sin(6.28318023681640625 * f) * 0.89999997615814208984375) * _136.uRidge) * resolved;
    float3 n = fast::normalize(float3((((-g) * 0.550000011920928955078125) * _136.uRelief) + (across * tilt), 1.0));
    float3 fold = fast::normalize(float3(((-g) * 0.550000011920928955078125) * _136.uRelief, 1.0));
    float3 light = fast::normalize(float3(turn * float2(-0.5, 0.60000002384185791015625), 0.60000002384185791015625));
    float3 halfway = fast::normalize(light + float3(0.0, 0.0, 1.0));
    float diffuse = dot(n, light);
    float spec = powr(fast::max(dot(n, halfway), 0.0), 40.0) * _136.uGloss;
    float broad = powr(fast::max(dot(fold, halfway), 0.0), 12.0) * _136.uGloss;
    float steep = smoothstep(0.980000019073486328125, 0.699999988079071044921875, fold.z);
    float band = smoothstep(0.25, 0.800000011920928955078125, 0.5 + (0.5 * sin(((h * 1.2999999523162841796875) + (p.x * 0.5)) - (t * 0.60000002384185791015625))));
    float sheen = fast::clamp((_136.uIridescence * (0.300000011920928955078125 + (0.699999988079071044921875 * steep))) * band, 0.0, 1.0);
    float lit = smoothstep(-0.100000001490116119384765625, 0.699999988079071044921875, dot(fold, light));
    float3 body = mix(_136.uShadow, _136.uBase, float3(smoothstep(-0.550000011920928955078125, 0.85000002384185791015625, diffuse)));
    body = mix(body, float3(_136.uSheen) * (0.3499999940395355224609375 + (0.800000011920928955078125 * fast::max(diffuse, 0.0))), float3((sheen * lit) * 0.75));
    float3 shine = mix(_136.uHighlight, float3(_136.uSheen) * 1.2999999523162841796875, float3(sheen));
    float3 col = body + (shine * ((0.89999997615814208984375 * spec) + (0.300000011920928955078125 * broad)));
    float2 uv = (fragCoord / float2(_136.iResolution[0], _136.iResolution[1])) - float2(0.5);
    col *= (1.0 - (0.4000000059604644775390625 * dot(uv, uv)));
    fragColor = float4(col, 1.0);
}

fragment flair_light_waves_frag_out flair_light_waves_frag(constant FlairUniforms& _136 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_light_waves_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _439;
    if (_136.flair_flipY > 0.5)
    {
        _439 = _136.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _439 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _439);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _136);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

