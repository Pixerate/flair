// flair-metal-hash: 9fa05ac5
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
    float uBlock;
    float uShimmer;
    float2 uCentre;
    float2 uSize;
    int uShape;
    float uFeather;
    uint uInvert;
    char _m20_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_censor_pixelate_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _91)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_91.uBackdrop) * _91.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_91.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _91)
{
    float4 _235;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _235 = overBackdrop(param, _91);
    }
    else
    {
        float2 param_1 = fract(uv);
        _235 = float4(testCard(param_1), 1.0);
    }
    return _235;
}

static inline __attribute__((always_inline))
float region(thread const float2& fragCoord, constant FlairUniforms& _91)
{
    float2 hs = fast::max((_91.uSize * 0.5) * float2(_91.iResolution[0], _91.iResolution[1]), float2(1.0));
    float2 p = fragCoord - (_91.uCentre * float2(_91.iResolution[0], _91.iResolution[1]));
    float d;
    if (_91.uShape == 0)
    {
        float2 q = abs(p) - hs;
        d = length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0);
    }
    else
    {
        d = (length(p / hs) - 1.0) * fast::min(hs.x, hs.y);
    }
    float m = 1.0 - smoothstep(((-0.5) * _91.uFeather) - 0.5, (0.5 * _91.uFeather) + 0.5, d);
    float _333;
    if (_91.uInvert != 0u)
    {
        _333 = 1.0 - m;
    }
    else
    {
        _333 = m;
    }
    return _333;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _91, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_91.iResolution[0], _91.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _91);
    float2 param_1 = fragCoord;
    float m = region(param_1, _91);
    if (m <= 0.0)
    {
        fragColor = pic;
        return;
    }
    float2 param_2 = float2(floor(_91.iTime * 6.0), 3.7000000476837158203125);
    float2 shift = (((hash22(param_2) - float2(0.5)) * _91.uShimmer) * _91.uBlock) * 0.5;
    float2 cell = floor((fragCoord + shift) / float2(_91.uBlock));
    float4 sum = float4(0.0);
    for (int i = 0; i < 4; i++)
    {
        float2 o = (float2(float(i & 1), float(i >> 1)) * 0.5) + float2(0.25);
        float2 param_3 = (((cell + o) * _91.uBlock) - shift) / float2(_91.iResolution[0], _91.iResolution[1]);
        float4 c = pictureRGBA(uImage, uImageSmplr, param_3, _91);
        sum += float4(c.xyz * c.w, c.w);
    }
    fragColor = mix(pic, float4(sum.xyz / float3(fast::max(sum.w, 9.9999997473787516355514526367188e-05)), sum.w / 4.0), float4(m));
}

fragment flair_censor_pixelate_frag_out flair_censor_pixelate_frag(constant FlairUniforms& _91 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_censor_pixelate_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _477;
    if (_91.flair_flipY > 0.5)
    {
        _477 = _91.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _477 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _477);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _91, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

