// flair-metal-hash: 47e6d600
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uKey;
    float uSize;
    float3 uColor;
    float3 uCore;
    packed_float3 uBackground;
    float uHeight;
    float uSpread;
    float uSpeed;
    float uPulse;
    float uIntensity;
    float uBackgroundAlpha;
};

constant spvUnsafeArray<float2, 16> _463 = spvUnsafeArray<float2, 16>({ float2(0.17678000032901763916015625, 0.0), float2(-0.22576999664306640625, 0.2068299949169158935546875), float2(0.0345599986612796783447265625, -0.3937700092792510986328125), float2(0.2845700085163116455078125, 0.3711700141429901123046875), float2(-0.52222001552581787109375, -0.0923700034618377685546875), float2(0.494690001010894775390625, -0.31468999385833740234375), float2(-0.1654500067234039306640625, 0.6155300140380859375), float2(-0.31558001041412353515625, -0.607590019702911376953125), float2(0.684650003910064697265625, 0.250010013580322265625), float2(-0.7122499942779541015625, 0.294030010700225830078125), float2(0.3433299958705902099609375, -0.73373997211456298828125), float2(0.2537600100040435791015625, 0.80892002582550048828125), float2(-0.76476001739501953125, -0.443159997463226318359375), float2(0.89713001251220703125, -0.1972700059413909912109375), float2(-0.54746997356414794921875, 0.77880001068115234375), float2(-0.12653000652790069580078125, -0.976080000400543212890625) });
constant spvUnsafeArray<float2, 10> _567 = spvUnsafeArray<float2, 10>({ float2(0.22360999882221221923828125, 0.0), float2(-0.2855800092220306396484375, 0.261619985103607177734375), float2(0.043710000813007354736328125, -0.4980899989604949951171875), float2(0.3599599897861480712890625, 0.469500005245208740234375), float2(-0.66057002544403076171875, -0.116839997470378875732421875), float2(0.625739991664886474609375, -0.3980599939823150634765625), float2(-0.20927999913692474365234375, 0.778590023517608642578125), float2(-0.3991700112819671630859375, -0.76854002475738525390625), float2(0.866020023822784423828125, 0.316240012645721435546875), float2(-0.900929987430572509765625, 0.37191998958587646484375) });

struct flair_aura_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void setKey(thread const float& tolerance, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _252, thread float4& gMaskPlace)
{
    gKeyTolerance = tolerance;
    float4 c = uMask.sample(uMaskSmplr, float2(0.00999999977648258209228515625, 0.9900000095367431640625), level(0.0));
    gKeyColour = c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875));
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float aspect = size.x / size.y;
    float h = fast::min(_252.uSize, ((_252.iResolution[0u] / _252.iResolution[1u]) * _252.uSize) / aspect);
    gMaskPlace = float4(1.0 / (h * aspect), 1.0 / h, size.y / h, float(size.x > 1.0));
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
float shapeLod(thread const float2& p, thread const float& lod, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, thread float4& gMaskPlace)
{
    float2 uv = (p * gMaskPlace.xy) + float2(0.5);
    bool _307 = uv.x < 0.0;
    bool _314;
    if (!_307)
    {
        _314 = uv.x > 1.0;
    }
    else
    {
        _314 = _307;
    }
    bool _321;
    if (!_314)
    {
        _321 = uv.y < 0.0;
    }
    else
    {
        _321 = _314;
    }
    bool _328;
    if (!_321)
    {
        _328 = uv.y > 1.0;
    }
    else
    {
        _328 = _321;
    }
    if (_328)
    {
        return 0.0;
    }
    float4 c = uMask.sample(uMaskSmplr, uv, level(lod));
    float a = c.w;
    if (gKeyTolerance > 0.0)
    {
        float away = distance(c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875)), gKeyColour);
        a *= smoothstep(gKeyTolerance, gKeyTolerance + 0.119999997317790985107421875, away);
    }
    return a;
}

static inline __attribute__((always_inline))
float shapeAt(thread const float2& p, thread const float& blur, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _252, thread float4& gMaskPlace)
{
    if (gMaskPlace.w < 0.5)
    {
        float d = length(p) - (0.300000011920928955078125 * _252.uSize);
        return fast::clamp(0.5 - (d / fast::max(blur, 0.0040000001899898052215576171875)), 0.0, 1.0);
    }
    float2 param = p;
    float param_1 = log2(fast::max(blur * gMaskPlace.z, 1.0));
    return shapeLod(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
}

static inline __attribute__((always_inline))
float coverage(thread const float2& p, thread const float& radius, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _252, thread float4& gMaskPlace)
{
    float sum = 0.0;
    if (gMaskPlace.w < 0.5)
    {
        for (int i = 0; i < 16; i++)
        {
            float2 param = p + (_463[i] * radius);
            float param_1 = radius * 0.4000000059604644775390625;
            sum += shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
        }
    }
    else
    {
        float lod = log2(fast::max((radius * 0.4000000059604644775390625) * gMaskPlace.z, 1.0));
        for (int i_1 = 0; i_1 < 16; i_1++)
        {
            float2 param_2 = p + (_463[i_1] * radius);
            float param_3 = lod;
            sum += shapeLod(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
        }
    }
    return sum / 16.0;
}

static inline __attribute__((always_inline))
float coverageLite(thread const float2& p, thread const float& radius, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _252, thread float4& gMaskPlace)
{
    float sum = 0.0;
    if (gMaskPlace.w < 0.5)
    {
        for (int i = 0; i < 10; i++)
        {
            float2 param = p + (_567[i] * radius);
            float param_1 = radius * 0.5;
            sum += shapeAt(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
        }
    }
    else
    {
        float lod = log2(fast::max((radius * 0.5) * gMaskPlace.z, 1.0));
        for (int i_1 = 0; i_1 < 10; i_1++)
        {
            float2 param_2 = p + (_567[i_1] * radius);
            float param_3 = lod;
            sum += shapeLod(param_2, param_3, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, gMaskPlace);
        }
    }
    return sum / 10.0;
}

static inline __attribute__((always_inline))
float3 maskPlace(thread const float2& p, thread float4& gMaskPlace)
{
    return float3((p * gMaskPlace.xy) + float2(0.5), gMaskPlace.z);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _252, thread float4& gMaskPlace)
{
    float param = _252.uKey;
    setKey(param, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
    float2 p = (fragCoord - (float2(_252.iResolution[0], _252.iResolution[1]) * 0.5)) / float2(_252.iResolution[1u]);
    float t = _252.iTime * _252.uSpeed;
    float px = 1.0 / _252.iResolution[1u];
    float2 q = p * 6.0;
    float2 param_1 = float2(q.x, q.y - (t * 2.0));
    int param_2 = 5;
    float _666 = fbm(param_1, param_2);
    float n = _666;
    float2 param_3 = float2((q.x * 1.7000000476837158203125) + 4.099999904632568359375, (q.y * 0.89999997615814208984375) - (t * 2.900000095367431640625));
    int param_4 = 4;
    float _686 = fbm(param_3, param_4);
    float n2 = _686;
    float pulse = 1.0 + (_252.uPulse * ((0.300000011920928955078125 * sin(t * 3.0)) + (0.119999997317790985107421875 * sin((t * 7.30000019073486328125) + 1.0))));
    float2 warp = float2(((n2 - 0.5) * _252.uSpread) * 1.5, (-(n - 0.300000011920928955078125)) * _252.uHeight);
    float2 param_5 = p + (warp * 0.300000011920928955078125);
    float param_6 = _252.uSpread * 0.5;
    float inner = coverage(param_5, param_6, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
    float2 param_7 = p + warp;
    float param_8 = _252.uSpread * 1.39999997615814208984375;
    float outer = coverageLite(param_7, param_8, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
    float2 param_9 = (p + (warp * 1.5)) - float2(0.0, _252.uHeight);
    float param_10 = _252.uSpread * 2.2000000476837158203125;
    float tall = coverageLite(param_9, param_10, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
    float field = (((inner * 0.89999997615814208984375) + (outer * 0.800000011920928955078125)) + (tall * 0.60000002384185791015625)) * pulse;
    float tongues = smoothstep(0.119999997317790985107421875, 0.949999988079071044921875, field * (0.449999988079071044921875 + (1.10000002384185791015625 * n)));
    float wisps = (smoothstep(0.550000011920928955078125, 0.75, n2) * smoothstep(0.0199999995529651641845703125, 0.300000011920928955078125, tall)) * 0.5;
    float2 param_11 = p;
    float param_12 = 1.5 * px;
    float body = shapeAt(param_11, param_12, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
    float3 light = (_252.uColor * (((tongues * 1.2999999523162841796875) + wisps) + (field * 0.25))) + ((_252.uCore * smoothstep(0.5, 0.89999997615814208984375, inner * pulse)) * 0.800000011920928955078125);
    light *= _252.uIntensity;
    float3 col = float3(_252.uBackground) + (float3(1.0) - exp(-light));
    if ((gMaskPlace.w > 0.5) && (body > 0.0))
    {
        float2 param_13 = p;
        float3 m = maskPlace(param_13, gMaskPlace);
        float4 c = uMask.sample(uMaskSmplr, m.xy);
        float3 own = c.xyz / float3(fast::max(c.w, 0.001000000047497451305389404296875));
        float2 param_14 = p;
        float param_15 = _252.uSpread * 0.25;
        float rim = 1.0 - coverage(param_14, param_15, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
        float3 lit = (own * mix(float3(0.75), _252.uColor, float3(0.25))) + (((((_252.uColor * rim) * 1.60000002384185791015625) * _252.uIntensity) * pulse) * 0.5);
        col = mix(col, lit, float3(body));
    }
    else
    {
        col = mix(col, (float3(_252.uBackground) * 0.60000002384185791015625) + (_252.uColor * 0.1500000059604644775390625), float3(body));
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
    float3 _957;
    if (a > 0.0)
    {
        _957 = bg + (d / float3(a));
    }
    else
    {
        _957 = bg;
    }
    float3 fg = _957;
    float alpha = a + (opacity * (1.0 - a));
    float3 _979;
    if (alpha > 0.0)
    {
        _979 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _979 = bg;
    }
    float3 col = _979;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, thread float& gKeyTolerance, texture2d<float> uMask, sampler uMaskSmplr, thread float3& gKeyColour, constant FlairUniforms& _252, thread float4& gMaskPlace)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_252.uBackground);
    float param_4 = _252.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_aura_frag_out flair_aura_frag(constant FlairUniforms& _252 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_aura_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float gKeyTolerance;
    float3 gKeyColour;
    float4 gMaskPlace;
    float _1035;
    if (_252.flair_flipY > 0.5)
    {
        _1035 = _252.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1035 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1035);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, gKeyTolerance, uMask, uMaskSmplr, gKeyColour, _252, gMaskPlace);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

