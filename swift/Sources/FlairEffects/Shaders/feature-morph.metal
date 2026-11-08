// flair-metal-hash: f3f63de6
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    uint uAnimate;
    float uProgress;
    float2 uFromA;
    float2 uFromB;
    float2 uFromC;
    float2 uFromD;
    float2 uFromE;
    float2 uToA;
    float2 uToB;
    float2 uToC;
    float2 uToD;
    float2 uToE;
    uint uShowPoints;
    char _m26_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_feature_morph_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _82)
{
    float _251;
    if (_82.uAnimate != 0u)
    {
        _251 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_82.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _251 = _82.uProgress;
    }
    return _251;
}

static inline __attribute__((always_inline))
float2 coverScale(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _82)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _82.iResolution[0u] / _82.iResolution[1u];
    float _288;
    if (size.x > 1.0)
    {
        _288 = size.x / size.y;
    }
    else
    {
        _288 = frameAspect;
    }
    float imageAspect = _288;
    float2 _302;
    if (frameAspect > imageAspect)
    {
        _302 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _302 = float2(frameAspect / imageAspect, 1.0);
    }
    return _302;
}

static inline __attribute__((always_inline))
float2 toFrame(thread const float2& imageUv, thread const float2& scale, constant FlairUniforms& _82)
{
    return (float2(0.5) + ((imageUv - float2(0.5)) / scale)) * float2(_82.iResolution[0u] / _82.iResolution[1u], 1.0);
}

static inline __attribute__((always_inline))
float2 cmul(thread const float2& a, thread const float2& b)
{
    return float2((a.x * b.x) - (a.y * b.y), (a.x * b.y) + (a.y * b.x));
}

static inline __attribute__((always_inline))
float2 warp(thread const float2& x, thread const spvUnsafeArray<float2, 5>& m, thread const spvUnsafeArray<float2, 5>& s)
{
    float2 cm = float2(0.0);
    float2 cs = float2(0.0);
    for (int i = 0; i < 5; i++)
    {
        cm += (m[i] * 0.20000000298023223876953125);
        cs += (s[i] * 0.20000000298023223876953125);
    }
    float2 num = float2(0.0);
    float den = 0.0;
    for (int i_1 = 0; i_1 < 5; i_1++)
    {
        float2 a = m[i_1] - cm;
        float2 param = float2(a.x, -a.y);
        float2 param_1 = s[i_1] - cs;
        num += cmul(param, param_1);
        den += dot(a, a);
    }
    float2 k = num / float2(fast::max(den, 9.9999999747524270787835121154785e-07));
    float2 bend = float2(0.0);
    float total = 0.0;
    for (int i_2 = 0; i_2 < 5; i_2++)
    {
        float2 param_2 = k;
        float2 param_3 = m[i_2] - cm;
        float2 left = s[i_2] - (cs + cmul(param_2, param_3));
        float d2 = dot(x - m[i_2], x - m[i_2]);
        float w = 1.0 / ((d2 * d2) + 9.9999999747524270787835121154785e-07);
        bend += (left * w);
        total += w;
    }
    float2 param_4 = k;
    float2 param_5 = x - cm;
    return (cs + cmul(param_4, param_5)) + (bend / float2(total));
}

static inline __attribute__((always_inline))
float2 toImage(thread const float2& q, thread const float2& scale, constant FlairUniforms& _82)
{
    return float2(0.5) + (((q / float2(_82.iResolution[0u] / _82.iResolution[1u], 1.0)) - float2(0.5)) * scale);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _82)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_82.uBackdrop) * _82.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_82.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _82)
{
    float4 _226;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _226 = overBackdrop(param, _82);
    }
    else
    {
        float2 param_1 = fract(uv);
        _226 = float4(testCard(param_1), 1.0);
    }
    return _226;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _82, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float t = progress(_82);
    float2 scaleA = coverScale(uFrom, uFromSmplr, _82);
    float2 scaleB = coverScale(uTo, uToSmplr, _82);
    float2 param = _82.uFromA;
    float2 param_1 = scaleA;
    float2 param_2 = _82.uFromB;
    float2 param_3 = scaleA;
    float2 param_4 = _82.uFromC;
    float2 param_5 = scaleA;
    float2 param_6 = _82.uFromD;
    float2 param_7 = scaleA;
    float2 param_8 = _82.uFromE;
    float2 param_9 = scaleA;
    spvUnsafeArray<float2, 5> _564 = spvUnsafeArray<float2, 5>({ toFrame(param, param_1, _82), toFrame(param_2, param_3, _82), toFrame(param_4, param_5, _82), toFrame(param_6, param_7, _82), toFrame(param_8, param_9, _82) });
    spvUnsafeArray<float2, 5> a = _564;
    float2 param_10 = _82.uToA;
    float2 param_11 = scaleB;
    float2 param_12 = _82.uToB;
    float2 param_13 = scaleB;
    float2 param_14 = _82.uToC;
    float2 param_15 = scaleB;
    float2 param_16 = _82.uToD;
    float2 param_17 = scaleB;
    float2 param_18 = _82.uToE;
    float2 param_19 = scaleB;
    spvUnsafeArray<float2, 5> _601 = spvUnsafeArray<float2, 5>({ toFrame(param_10, param_11, _82), toFrame(param_12, param_13, _82), toFrame(param_14, param_15, _82), toFrame(param_16, param_17, _82), toFrame(param_18, param_19, _82) });
    spvUnsafeArray<float2, 5> b = _601;
    spvUnsafeArray<float2, 5> m;
    for (int i = 0; i < 5; i++)
    {
        m[i] = mix(a[i], b[i], float2(t));
    }
    float2 x = fragCoord / float2(_82.iResolution[1u]);
    float2 param_20 = x;
    spvUnsafeArray<float2, 5> param_21 = m;
    spvUnsafeArray<float2, 5> param_22 = a;
    float2 param_23 = warp(param_20, param_21, param_22);
    float2 param_24 = scaleA;
    float2 param_25 = toImage(param_23, param_24, _82);
    float4 colA = pictureRGBA(uFrom, uFromSmplr, param_25, _82);
    float2 param_26 = x;
    spvUnsafeArray<float2, 5> param_27 = m;
    spvUnsafeArray<float2, 5> param_28 = b;
    float2 param_29 = warp(param_26, param_27, param_28);
    float2 param_30 = scaleB;
    float2 param_31 = toImage(param_29, param_30, _82);
    float4 colB = pictureRGBA(uTo, uToSmplr, param_31, _82);
    float4 pic = mix(colA, colB, float4(smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, t)));
    float3 col = pic.xyz;
    float marks = 0.0;
    if (_82.uShowPoints != 0u)
    {
        float px = 1.0 / _82.iResolution[1u];
        for (int i_1 = 0; i_1 < 5; i_1++)
        {
            float d = length(x - m[i_1]);
            float shadow = smoothstep(px * 1.5, 0.0, abs(d - 0.01200000010430812835693359375)) * 0.60000002384185791015625;
            float ring = smoothstep(px, 0.0, abs(d - 0.01200000010430812835693359375));
            col = mix(col, float3(0.0), float3(shadow));
            col = mix(col, float3(1.0, 0.85000002384185791015625, 0.20000000298023223876953125), float3(ring));
            marks = fast::max(marks, fast::max(shadow, ring));
        }
    }
    fragColor = float4(col, fast::max(pic.w, marks));
}

fragment flair_feature_morph_frag_out flair_feature_morph_frag(constant FlairUniforms& _82 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_feature_morph_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _750;
    if (_82.flair_flipY > 0.5)
    {
        _750 = _82.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _750 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _750);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _82, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

