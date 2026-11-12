// flair-metal-hash: 0e4a9985
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
    int uLevels;
    float3 uInkA;
    packed_float3 uInkB;
    float uOffset;
    float uGrain;
    float3 uPaper;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_risograph_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _152)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_152.uBackdrop) * _152.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_152.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _152)
{
    float4 _293;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _293 = overBackdrop(param, _152);
    }
    else
    {
        float2 param_1 = fract(uv);
        _293 = float4(testCard(param_1), 1.0);
    }
    return _293;
}

static inline __attribute__((always_inline))
float posterize(thread const float& d, thread const float& levels, thread const float& grain)
{
    return fast::clamp(floor(((d * (levels - 1.0)) + 0.5) + grain) / (levels - 1.0), 0.0, 1.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _152, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_152.iResolution[0], _152.iResolution[1]);
    float2 shift = float2(_152.uOffset, _152.uOffset * 0.60000002384185791015625) / float2(_152.iResolution[0], _152.iResolution[1]);
    float levels = float(_152.uLevels);
    float2 param = fragCoord;
    float fibre = hash12(param);
    float2 param_1 = fragCoord / float2(6.0);
    float mottle = vnoise(param_1);
    float2 param_2 = uv + shift;
    float4 a = pictureRGBA(uImage, uImageSmplr, param_2, _152);
    float2 param_3 = uv - shift;
    float4 b = pictureRGBA(uImage, uImageSmplr, param_3, _152);
    float2 param_4 = fragCoord + float2(17.0);
    float param_5 = 1.0 - a.y;
    float param_6 = levels;
    float param_7 = ((hash12(param_4) - 0.5) * _152.uGrain) * 0.60000002384185791015625;
    float dA = posterize(param_5, param_6, param_7);
    float2 param_8 = fragCoord + float2(53.0);
    float param_9 = 1.0 - b.x;
    float param_10 = levels;
    float param_11 = ((hash12(param_8) - 0.5) * _152.uGrain) * 0.60000002384185791015625;
    float dB = posterize(param_9, param_10, param_11);
    float cover = 0.89999997615814208984375 * (1.0 - ((_152.uGrain * 0.3499999940395355224609375) * mottle));
    float3 col = _152.uPaper * (1.0 - ((_152.uGrain * 0.07999999821186065673828125) * fibre));
    col *= mix(float3(1.0), _152.uInkA, float3(dA * cover));
    col *= mix(float3(1.0), float3(_152.uInkB), float3(dB * cover));
    fragColor = float4(col, fast::max(a.w, b.w));
}

fragment flair_image_risograph_frag_out flair_image_risograph_frag(constant FlairUniforms& _152 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_risograph_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _481;
    if (_152.flair_flipY > 0.5)
    {
        _481 = _152.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _481 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _481);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _152, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

