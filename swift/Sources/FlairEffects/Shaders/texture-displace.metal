// flair-metal-hash: 24b3cafa
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
    float uStrength;
    float uScale;
    float2 uScroll;
    uint uSlope;
    char _m17_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_texture_displace_frag_out
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
float3 mapAt(thread const float2& p, texture2d<float> uMap, sampler uMapSmplr)
{
    if (int2(uMap.get_width(), uMap.get_height()).x > 1)
    {
        return uMap.sample(uMapSmplr, p).xyz;
    }
    float2 param = p * 6.0;
    float2 param_1 = (p * 6.0) + float2(11.30000019073486328125);
    float2 param_2 = (p * 6.0) + float2(23.1000003814697265625);
    return float3(vnoise(param), vnoise(param_1), vnoise(param_2));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _149)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_149.uBackdrop) * _149.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_149.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _149)
{
    float4 _290;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _290 = overBackdrop(param, _149);
    }
    else
    {
        float2 param_1 = fract(uv);
        _290 = float4(testCard(param_1), 1.0);
    }
    return _290;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _149, texture2d<float> uMap, sampler uMapSmplr, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_149.iResolution[0], _149.iResolution[1]);
    float2 m = (uv * _149.uScale) + (_149.uScroll * _149.iTime);
    float2 offset;
    if (_149.uSlope != 0u)
    {
        float e = 0.02999999932944774627685546875;
        float3 w = float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625);
        float2 param = m + float2(e, 0.0);
        float2 param_1 = m - float2(e, 0.0);
        float dx = dot(mapAt(param, uMap, uMapSmplr) - mapAt(param_1, uMap, uMapSmplr), w);
        float2 param_2 = m + float2(0.0, e);
        float2 param_3 = m - float2(0.0, e);
        float dy = dot(mapAt(param_2, uMap, uMapSmplr) - mapAt(param_3, uMap, uMapSmplr), w);
        offset = ((float2(dx, dy) / float2(2.0 * e)) * _149.uStrength) * 0.100000001490116119384765625;
    }
    else
    {
        float2 param_4 = m;
        offset = ((mapAt(param_4, uMap, uMapSmplr).xy - float2(0.5)) * 2.0) * _149.uStrength;
    }
    float2 param_5 = uv + offset;
    fragColor = pictureRGBA(uImage, uImageSmplr, param_5, _149);
}

fragment flair_texture_displace_frag_out flair_texture_displace_frag(constant FlairUniforms& _149 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uMap [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uMapSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_texture_displace_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _454;
    if (_149.flair_flipY > 0.5)
    {
        _454 = _149.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _454 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _454);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _149, uMap, uMapSmplr, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

