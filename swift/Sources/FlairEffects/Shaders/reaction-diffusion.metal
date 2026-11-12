// flair-metal-hash: ebebc211
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
    float3 uBase;
    packed_float3 uInk;
    float uScale;
    float uPattern;
    float uRings;
    float uAlign;
    float uWarp;
    float uSpeed;
    float uRelief;
};

struct flair_reaction_diffusion_frag_out
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
float turing(thread const float2& p, thread const float& t, constant FlairUniforms& _208)
{
    float s = 0.0;
    for (int i = 0; i < 7; i++)
    {
        float fi = float(i);
        float a = ((mod((fi * 2.399960041046142578125) + 1.57079994678497314453125, 3.141590118408203125) - 1.57079994678497314453125) * (1.0 - (0.85000002384185791015625 * _208.uAlign))) + (0.300000011920928955078125 * sin((t * 0.37000000476837158203125) + (fi * 1.2999999523162841796875)));
        s += cos(((dot(p, float2(cos(a), sin(a))) * 6.28318023681640625) + (fi * 1.7000000476837158203125)) + (t * (0.300000011920928955078125 + (0.070000000298023223876953125 * fi))));
    }
    return s * 0.3779999911785125732421875;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _208)
{
    float2 uv = fragCoord / float2(_208.iResolution[1u]);
    float t = _208.iTime * _208.uSpeed;
    float2 param = (uv * 1.7000000476837158203125) + float2(0.0, t * 0.20000000298023223876953125);
    int param_1 = 4;
    float _281 = fbm(param, param_1);
    float2 param_2 = (uv * 1.7000000476837158203125) + float2(5.19999980926513671875, 1.2999999523162841796875 - (t * 0.20000000298023223876953125));
    int param_3 = 4;
    float _292 = fbm(param_2, param_3);
    float2 w = float2(_281, _292) - float2(0.5);
    float2 p = (uv * _208.uScale) + ((w * _208.uWarp) * 4.0);
    float2 param_4 = p;
    float param_5 = t;
    float v = turing(param_4, param_5, _208);
    float2 param_6 = (uv * 1.10000002384185791015625) + float2(9.0, t * 0.0500000007450580596923828125);
    int param_7 = 3;
    float _329 = fbm(param_6, param_7);
    float region = _329 - 0.5;
    float level0 = mix(1.0499999523162841796875, 0.0, _208.uPattern) + (region * 0.699999988079071044921875);
    float e = fast::max(fwidth(v), 0.0199999995529651641845703125);
    float m = smoothstep(level0 - e, level0 + e, v);
    float band = 0.37999999523162841796875;
    float ring = m * (1.0 - smoothstep((level0 + band) - e, (level0 + band) + e, v));
    float hole = smoothstep((level0 + band) - e, (level0 + band) + e, v) * _208.uRings;
    m = mix(m, ring, _208.uRings);
    float2 param_8 = fragCoord * 0.3499999940395355224609375;
    float3 col = _208.uBase * (0.939999997615814208984375 + (0.0599999986588954925537109375 * vnoise(param_8)));
    col = mix(col, float3(_208.uInk), float3(m));
    col = mix(col, mix(_208.uBase, float3(_208.uInk), float3(0.300000011920928955078125)) * 0.920000016689300537109375, float3(hole));
    float2 g = float2(dfdx(v), dfdy(v));
    float lit = dot(g / float2(fast::max(length(g), 9.9999997473787516355514526367188e-06)), float2(-0.707106769084930419921875, 0.707106769084930419921875));
    float edge = smoothstep(level0 - 0.0199999995529651641845703125, level0 + 0.0199999995529651641845703125, v) * (1.0 - smoothstep(level0, level0 + 0.300000011920928955078125, v));
    col *= (1.0 + (((_208.uRelief * 0.3499999940395355224609375) * edge) * lit));
    col = mix(col, col * 0.819999992847442626953125, float3(((_208.uRelief * m) * smoothstep(level0, level0 + 1.2000000476837158203125, v)) * (1.0 - _208.uRings)));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_reaction_diffusion_frag_out flair_reaction_diffusion_frag(constant FlairUniforms& _208 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_reaction_diffusion_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _513;
    if (_208.flair_flipY > 0.5)
    {
        _513 = _208.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _513 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _513);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _208);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

