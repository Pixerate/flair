// flair-metal-hash: c392e07b
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
    float3 uColor;
    packed_float3 uBackground;
    float uGloss;
    float uSize;
    uint uAnimate;
    float uProgress;
    float uBackgroundAlpha;
};

struct flair_wax_melt_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float meltCycle(thread const float& rate, constant FlairUniforms& _212)
{
    float u = fract(_212.iTime / 8.0);
    float m = fast::clamp((fast::min(u, 0.62000000476837158203125) * 2.0) * rate, 0.0, 1.0);
    m = (m * m) * (3.0 - (2.0 * m));
    return m * (1.0 - smoothstep(0.7400000095367431640625, 0.9700000286102294921875, u));
}

static inline __attribute__((always_inline))
float shape(thread const float2& s, thread float& halfWidth, thread float& bottom, constant FlairUniforms& _212, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _212.iResolution[0u] / _212.iResolution[1u];
    float h = fast::min(_212.uSize * 0.699999988079071044921875, (frame * _212.uSize) / aspect);
    halfWidth = (0.4199999868869781494140625 * h) * aspect;
    bottom = (-0.2700000107288360595703125) * h;
    float2 uv = (s / float2(h * aspect, h)) + float2(0.5);
    bool _349 = uv.x < 0.0;
    bool _356;
    if (!_349)
    {
        _356 = uv.x > 1.0;
    }
    else
    {
        _356 = _349;
    }
    bool _363;
    if (!_356)
    {
        _363 = uv.y < 0.0;
    }
    else
    {
        _363 = _356;
    }
    bool _370;
    if (!_363)
    {
        _370 = uv.y > 1.0;
    }
    else
    {
        _370 = _363;
    }
    if (_370)
    {
        return 0.0;
    }
    return uMask.sample(uMaskSmplr, uv).w;
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
float wax(thread const float2& p, thread const float& m, thread const float& soft, constant FlairUniforms& _212, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 param = float2(0.0);
    float param_1;
    float param_2;
    float _387 = shape(param, param_1, param_2, _212, uMask, uMaskSmplr);
    float halfWidth = param_1;
    float bottom = param_2;
    float dy = p.y - (-0.14000000059604644775390625);
    float2 param_3 = float2(p.x * 3.0, 4.0);
    int param_4 = 3;
    float _415 = fbm(param_3, param_4);
    float sag = 1.0 + (((0.25 * m) + (((1.60000002384185791015625 * m) * m) * m)) * (0.60000002384185791015625 + (0.800000011920928955078125 * _415)));
    float spread = 1.0 + ((m * 0.4000000059604644775390625) * exp((-fast::max(dy, 0.0)) * 7.0));
    float2 s = float2((p.x / spread) + ((m * 0.01200000010430812835693359375) * sin((dy * 30.0) + (p.x * 8.0))), bottom + (dy * sag));
    float r = (0.0040000001899898052215576171875 + (0.02199999988079071044921875 * m)) + soft;
    float2 param_5 = s;
    float param_6;
    float param_7;
    float _469 = shape(param_5, param_6, param_7, _212, uMask, uMaskSmplr);
    halfWidth = param_6;
    bottom = param_7;
    float sum = _469 * 2.0;
    float param_9;
    float param_10;
    float param_12;
    float param_13;
    for (int i = 0; i < 6; i++)
    {
        float a = float(i) * 1.0471999645233154296875;
        float2 dir = float2(cos(a), sin(a));
        float2 param_8 = s + ((dir * r) * 0.5);
        float _502 = shape(param_8, param_9, param_10, _212, uMask, uMaskSmplr);
        halfWidth = param_9;
        bottom = param_10;
        float2 param_11 = s + ((dir.yx * float2(-1.0, 1.0)) * r);
        float _517 = shape(param_11, param_12, param_13, _212, uMask, uMaskSmplr);
        halfWidth = param_12;
        bottom = param_13;
        sum += (_502 + _517);
    }
    float _528;
    if (dy < 0.0)
    {
        _528 = 0.0;
    }
    else
    {
        _528 = sum / 14.0;
    }
    float cover = _528;
    float rx = halfWidth * (0.25 + (0.800000011920928955078125 * m));
    float ry = (0.008000000379979610443115234375 + (0.0500000007450580596923828125 * m)) * (1.0 + (0.1500000059604644775390625 * sin((p.x * 17.0) + 1.0)));
    float2 e = float2(p.x / rx, (p.y - (-0.14000000059604644775390625)) / ry);
    float pool = smoothstep(0.01200000010430812835693359375 + soft, (-0.01200000010430812835693359375) - soft, (length(e) - 1.0) * ry) * smoothstep(0.02999999932944774627685546875, 0.25, m);
    return (cover + pool) - (cover * pool);
}

static inline __attribute__((always_inline))
float3 liquidShade(thread const float3& base, thread const float3& n, thread const float& gloss)
{
    float3 l = float3(-0.42333376407623291015625, 0.55033385753631591796875, 0.719667375087738037109375);
    float diff = fast::clamp(dot(n, l), 0.0, 1.0);
    float spec = powr(fast::max(dot(reflect(-l, n), float3(0.0, 0.0, 1.0)), 0.0), 36.0);
    float rim = powr(1.0 - n.z, 2.0);
    return (((base * (0.449999988079071044921875 + (0.699999988079071044921875 * diff))) * (1.0 - (0.3499999940395355224609375 * rim))) + (float3(spec) * gloss)) + float3((rim * 0.119999997317790985107421875) * gloss);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _212, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 p = (fragCoord - (float2(_212.iResolution[0], _212.iResolution[1]) * 0.5)) / float2(_212.iResolution[1u]);
    float _611;
    if (_212.uAnimate != 0u)
    {
        float param = 1.0;
        _611 = meltCycle(param, _212);
    }
    else
    {
        _611 = _212.uProgress;
    }
    float m = _611;
    float3 col = float3(_212.uBackground) * (1.0 + (0.60000002384185791015625 * exp((-dot(p, p)) * 3.0)));
    col = mix(col, float3(_212.uBackground) * 0.60000002384185791015625, float3(smoothstep(-0.119999997317790985107421875, -0.23999999463558197021484375, p.y)));
    float2 param_1 = p + float2(-0.01200000010430812835693359375, 0.0199999995529651641845703125);
    float param_2 = m;
    float param_3 = 0.00999999977648258209228515625;
    float shade = wax(param_1, param_2, param_3, _212, uMask, uMaskSmplr);
    col *= (1.0 - ((0.449999988079071044921875 * smoothstep(0.20000000298023223876953125, 0.699999988079071044921875, shade)) * smoothstep(0.10999999940395355224609375, -0.189999997615814208984375, p.y)));
    float2 param_4 = p;
    float param_5 = m;
    float param_6 = 0.0;
    float c = wax(param_4, param_5, param_6, _212, uMask, uMaskSmplr);
    float px = 1.5 / _212.iResolution[1u];
    float edge = smoothstep(0.439999997615814208984375, 0.560000002384185791015625, c);
    if (c > 0.300000011920928955078125)
    {
        float eps = 0.00999999977648258209228515625;
        float soft = 0.01400000043213367462158203125;
        float2 param_7 = p + float2(eps, 0.0);
        float param_8 = m;
        float param_9 = soft;
        float2 param_10 = p - float2(eps, 0.0);
        float param_11 = m;
        float param_12 = soft;
        float2 param_13 = p + float2(0.0, eps);
        float param_14 = m;
        float param_15 = soft;
        float2 param_16 = p - float2(0.0, eps);
        float param_17 = m;
        float param_18 = soft;
        float2 g = float2(wax(param_7, param_8, param_9, _212, uMask, uMaskSmplr) - wax(param_10, param_11, param_12, _212, uMask, uMaskSmplr), wax(param_13, param_14, param_15, _212, uMask, uMaskSmplr) - wax(param_16, param_17, param_18, _212, uMask, uMaskSmplr)) / float2(2.0 * eps);
        float thick = smoothstep(0.300000011920928955078125, 1.0, c);
        float3 nrm = fast::normalize(float3((-g) * 0.02999999932944774627685546875, 1.0));
        float3 deep = _212.uColor * 0.699999988079071044921875;
        float3 glow = fast::min(((_212.uColor * _212.uColor) * 1.60000002384185791015625) + float3(0.07999999821186065673828125, 0.02999999932944774627685546875, 0.0), float3(1.0));
        float3 base = mix(glow, deep, float3(thick));
        float3 param_19 = base;
        float3 param_20 = nrm;
        float param_21 = _212.uGloss * (0.3499999940395355224609375 + (0.64999997615814208984375 * m));
        float3 lit = liquidShade(param_19, param_20, param_21);
        col = mix(col, lit, float3(edge));
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
    float3 _845;
    if (a > 0.0)
    {
        _845 = bg + (d / float3(a));
    }
    else
    {
        _845 = bg;
    }
    float3 fg = _845;
    float alpha = a + (opacity * (1.0 - a));
    float3 _867;
    if (alpha > 0.0)
    {
        _867 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _867 = bg;
    }
    float3 col = _867;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _212, texture2d<float> uMask, sampler uMaskSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _212, uMask, uMaskSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_212.uBackground);
    float param_4 = _212.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_wax_melt_frag_out flair_wax_melt_frag(constant FlairUniforms& _212 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_wax_melt_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _924;
    if (_212.flair_flipY > 0.5)
    {
        _924 = _212.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _924 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _924);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _212, uMask, uMaskSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

