// flair-metal-hash: 92fa85fe
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
    float uAmount;
    float uSplit;
    float uRate;
    char _m16_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_glitch_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _87)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_87.uBackdrop) * _87.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_87.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _87)
{
    float4 _229;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _229 = overBackdrop(param, _87);
    }
    else
    {
        float2 param_1 = fract(uv);
        _229 = float4(testCard(param_1), 1.0);
    }
    return _229;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _87, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_87.iResolution[0], _87.iResolution[1]);
    float tick = floor(_87.iTime * _87.uRate);
    float2 param = float2(tick, 1.0);
    float burst = step(1.0 - (_87.uAmount * 0.60000002384185791015625), hash12(param));
    float2 param_1 = float2(tick, 2.0);
    float slice = floor(uv.y * mix(8.0, 40.0, hash12(param_1)));
    float2 param_2 = float2(slice, tick);
    float2 param_3 = float2(slice, tick + 3.0);
    float shift = (((hash12(param_2) - 0.5) * 0.1500000059604644775390625) * burst) * step(0.60000002384185791015625, hash12(param_3));
    float2 block = floor(uv * float2(16.0, 9.0));
    float2 param_4 = block + float2(tick);
    float corrupt = burst * step(0.9700000286102294921875 - (_87.uAmount * 0.0500000007450580596923828125), hash12(param_4));
    float2 st = uv + float2(shift, 0.0);
    st = mix(st, floor(st * 24.0) / float2(24.0), float2(corrupt));
    float split = _87.uSplit * (0.300000011920928955078125 + burst);
    float2 param_5 = st + float2(split, 0.0);
    float4 r = pictureRGBA(uImage, uImageSmplr, param_5, _87);
    float2 param_6 = st;
    float4 g = pictureRGBA(uImage, uImageSmplr, param_6, _87);
    float2 param_7 = st - float2(split, 0.0);
    float4 b = pictureRGBA(uImage, uImageSmplr, param_7, _87);
    float3 col = float3(r.x, g.y, b.z);
    col = mix(col, col.zyx, float3(corrupt));
    col *= (0.920000016689300537109375 + (0.07999999821186065673828125 * sin(fragCoord.y * 2.0)));
    fragColor = float4(col, fast::max(fast::max(r.w, g.w), b.w));
}

fragment flair_image_glitch_frag_out flair_image_glitch_frag(constant FlairUniforms& _87 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_glitch_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _417;
    if (_87.flair_flipY > 0.5)
    {
        _417 = _87.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _417 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _417);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _87, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

