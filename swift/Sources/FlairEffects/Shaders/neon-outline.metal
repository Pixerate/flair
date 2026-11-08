// flair-metal-hash: c7f5357c
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
    float uSize;
    float3 uColorA;
    packed_float3 uColorB;
    float uGradient;
    float uFlow;
    float uLine;
    float uGlow;
    float uIntensity;
    float uFlicker;
    float uFill;
};

struct flair_neon_outline_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void setKey(thread const float& tolerance, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour)
{
    gKeyTolerance = tolerance;
    float4 c = uMask.sample(uMaskSmplr, float2(0.00999999977648258209228515625, 0.9900000095367431640625), level(0.0));
    gKeyColour = c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875));
}

static inline __attribute__((always_inline))
float3 maskPlace(thread const float2& p, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _123)
{
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float aspect = size.x / size.y;
    float h = fast::min(_123.uSize, ((_123.iResolution[0u] / _123.iResolution[1u]) * _123.uSize) / aspect);
    return float3((p / float2(h * aspect, h)) + float2(0.5), size.y / h);
}

static inline __attribute__((always_inline))
float shapeAt(thread const float2& p, thread const float& blur, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _123)
{
    if (int2(uMask.get_width(), uMask.get_height()).x <= 1)
    {
        float d = length(p) - (0.300000011920928955078125 * _123.uSize);
        return fast::clamp(0.5 - (d / fast::max(blur, 0.0040000001899898052215576171875)), 0.0, 1.0);
    }
    float2 param = p;
    float3 m = maskPlace(param, uMask, uMaskSmplr, _123);
    bool _190 = m.x < 0.0;
    bool _197;
    if (!_190)
    {
        _197 = m.x > 1.0;
    }
    else
    {
        _197 = _190;
    }
    bool _204;
    if (!_197)
    {
        _204 = m.y < 0.0;
    }
    else
    {
        _204 = _197;
    }
    bool _211;
    if (!_204)
    {
        _211 = m.y > 1.0;
    }
    else
    {
        _211 = _204;
    }
    if (_211)
    {
        return 0.0;
    }
    float4 c = uMask.sample(uMaskSmplr, m.xy, level(log2(fast::max(blur * m.z, 1.0))));
    float a = c.w;
    if (gKeyTolerance > 0.0)
    {
        float away = distance(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), gKeyColour);
        a *= smoothstep(gKeyTolerance, gKeyTolerance + 0.119999997317790985107421875, away);
    }
    return a;
}

static inline __attribute__((always_inline))
float coverage(thread const float2& p, thread const float& radius, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _123)
{
    float sum = 0.0;
    for (int i = 0; i < 16; i++)
    {
        float r = radius * sqrt((float(i) + 0.5) / 16.0);
        float a = float(i) * 2.399960041046142578125;
        float2 param = p + (float2(cos(a), sin(a)) * r);
        float param_1 = radius * 0.4000000059604644775390625;
        sum += shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _123);
    }
    return sum / 16.0;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _123)
{
    float param = 0.0;
    setKey(param, gKeyTolerance, uMask, uMaskSmplr, gKeyColour);
    float px = 1.0 / _123.iResolution[1u];
    float2 p = (fragCoord - (float2(_123.iResolution[0], _123.iResolution[1]) * 0.5)) * px;
    float2 param_1 = p;
    float param_2 = 3.0 * px;
    float v = coverage(param_1, param_2, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _123) - 0.5;
    float2 g = float2(dfdx(v), dfdy(v));
    float d = abs(v) / fast::max(length(g), 0.0199999995529651641845703125);
    float tube = exp(-powr(d / _123.uLine, 2.0));
    float core = exp(-powr(d / (_123.uLine * 0.4000000059604644775390625), 2.0));
    float2 param_3 = p;
    float param_4 = _123.uGlow * 0.4000000059604644775390625;
    float c1 = coverage(param_3, param_4, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _123);
    float2 param_5 = p;
    float param_6 = _123.uGlow;
    float c2 = coverage(param_5, param_6, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _123);
    float halo = ((1.0 - abs((2.0 * c1) - 1.0)) * 0.550000011920928955078125) + ((1.0 - abs((2.0 * c2) - 1.0)) * 0.3499999940395355224609375);
    float2 param_7 = p;
    float param_8 = px;
    float inside = shapeAt(param_7, param_8, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _123);
    float k = mix(0.0, 0.5 + (0.5 * sin(((p.x * 5.0) + (p.y * 2.5)) - ((_123.iTime * _123.uFlow) * 3.0))), _123.uGradient);
    float3 tint = mix(_123.uColorA, float3(_123.uColorB), float3(k));
    float2 param_9 = float2(floor(_123.iTime * 1.7000000476837158203125), 3.0);
    float burst = step(0.7200000286102294921875, hash12(param_9));
    float2 param_10 = float2(floor(_123.iTime * 24.0), 7.0);
    float dip = step(0.449999988079071044921875, hash12(param_10));
    float flick = 1.0 - (((_123.uFlicker * burst) * (1.0 - dip)) * 0.85000002384185791015625);
    float3 light = (tint * ((tube * 1.60000002384185791015625) + halo)) + ((mix(tint, float3(1.0), float3(0.699999988079071044921875)) * core) * 0.89999997615814208984375);
    light += (((tint * inside) * _123.uFill) * 0.60000002384185791015625);
    float3 param_11 = (light * _123.uIntensity) * flick;
    float4 _533 = glow(param_11);
    fragColor = _533;
}

fragment flair_neon_outline_frag_out flair_neon_outline_frag(constant FlairUniforms& _123 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_neon_outline_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float gKeyTolerance;
    float3 gKeyColour;
    float _546;
    if (_123.flair_flipY > 0.5)
    {
        _546 = _123.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _546 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _546);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _123);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

