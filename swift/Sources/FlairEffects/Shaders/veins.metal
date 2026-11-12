// flair-metal-hash: b21c90fb
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float3 uBackground;
    float3 uVein;
    packed_float3 uPulse;
    int uDepth;
    int uTrees;
    float uSpread;
    float uWidth;
    float uWiggle;
    float uRotation;
    float uPulses;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_veins_frag_out
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
float3 tree(thread float2& q, thread const float& k, thread float& width, constant FlairUniforms& _228)
{
    float L = 0.3400000035762786865234375;
    float sc = 1.0;
    float id = 1.0 + (k * 97.0);
    float d = 100000.0;
    float along = 0.0;
    float arc = 0.0;
    width = _228.uWidth;
    for (int i = 0; i < 9; i++)
    {
        if (i >= _228.uDepth)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(q.y * 5.0, id * 7.13000011444091796875);
        q.x += (((vnoise(param) - 0.5) * _228.uWiggle) * sin(3.141590118408203125 * fast::clamp(q.y / L, 0.0, 1.0)));
        float h = fast::clamp(q.y / L, 0.0, 1.0);
        float w = (_228.uWidth * sc) * mix(1.0, 0.75, h);
        float dd = (length(q - float2(0.0, h * L)) * sc) - w;
        if (dd < d)
        {
            d = dd;
            along = arc + ((h * L) * sc);
            width = w;
        }
        arc += (L * sc);
        q.y -= L;
        id = (id * 2.0) + step(0.0, q.x);
        q.x = abs(q.x);
        float2 param_1 = float2(id, fi);
        float param_2 = radians(_228.uSpread) * (0.699999988079071044921875 + (0.60000002384185791015625 * hash12(param_1)));
        q = rot(param_2) * q;
        float2 param_3 = float2(fi, id * 1.2999999523162841796875);
        float s = 0.660000026226043701171875 + (0.14000000059604644775390625 * hash12(param_3));
        q /= float2(s);
        sc *= s;
    }
    return float3(d, along, 0.0);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _228)
{
    float2 c = (fragCoord - (float2(_228.iResolution[0], _228.iResolution[1]) * 0.5)) / float2(_228.iResolution[1u]);
    float px = 1.0 / _228.iResolution[1u];
    float param = radians(_228.uRotation);
    float2 p = rot(param) * c;
    float2 param_1 = p * 2.5;
    int param_2 = 3;
    float _417 = fbm(param_1, param_2);
    float2 param_3 = (p * 2.5) + float2(5.30000019073486328125);
    int param_4 = 3;
    float _425 = fbm(param_3, param_4);
    p += (((float2(_417, _425) - float2(0.5)) * _228.uWiggle) * 0.5);
    float aspect = _228.iResolution[0u] / _228.iResolution[1u];
    float d = 100000.0;
    float along = 0.0;
    float width = _228.uWidth;
    float seed = 0.0;
    float param_7;
    for (int k = 0; k < 3; k++)
    {
        if (k >= _228.uTrees)
        {
            break;
        }
        float fk = float(k);
        float x0 = ((((fk + 0.5) / float(_228.uTrees)) - 0.5) * aspect) * 0.800000011920928955078125;
        float2 param_5 = p - float2(x0, -0.62000000476837158203125);
        float param_6 = fk;
        float3 _488 = tree(param_5, param_6, param_7, _228);
        float w = param_7;
        float3 t = _488;
        if (t.x < d)
        {
            d = t.x;
            along = t.y;
            width = w;
            seed = fk;
        }
    }
    float mask = 1.0 - smoothstep(-px, px, d);
    float tube = fast::clamp((-d) / fast::max(width, px), 0.0, 1.0);
    float glow = exp((-fast::max(d, 0.0)) / 0.01200000010430812835693359375);
    float2 param_8 = c * 14.0;
    int param_9 = 3;
    float _537 = fbm(param_8, param_9);
    float3 col = (_228.uBackground * (0.87999999523162841796875 + (0.119999997317790985107421875 * _537))) * (1.10000002384185791015625 - (0.3499999940395355224609375 * length(c)));
    col = mix(col, _228.uVein, float3((glow * 0.180000007152557373046875) * _228.uGlow));
    col = mix(col, _228.uVein * (0.800000011920928955078125 + (0.3499999940395355224609375 * sqrt(tube))), float3(mask));
    float f = fract(((along * 2.2000000476837158203125) - ((_228.iTime * _228.uPulses) * 0.5)) + (seed * 0.37000000476837158203125));
    float pulse = smoothstep(0.64999997615814208984375, 0.9700000286102294921875, f) * (1.0 - smoothstep(0.9700000286102294921875, 1.0, f));
    col += ((float3(_228.uPulse) * pulse) * ((mask * 0.89999997615814208984375) + ((exp((-fast::max(d, 0.0)) / 0.008000000379979610443115234375) * 0.5) * _228.uGlow)));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
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
    float3 _672;
    if (a > 0.0)
    {
        _672 = bg + (d / float3(a));
    }
    else
    {
        _672 = bg;
    }
    float3 fg = _672;
    float alpha = a + (opacity * (1.0 - a));
    float3 _694;
    if (alpha > 0.0)
    {
        _694 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _694 = bg;
    }
    float3 col = _694;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _228)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _228);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _228.uBackground;
    float param_4 = _228.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_veins_frag_out flair_veins_frag(constant FlairUniforms& _228 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_veins_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _752;
    if (_228.flair_flipY > 0.5)
    {
        _752 = _228.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _752 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _752);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _228);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

