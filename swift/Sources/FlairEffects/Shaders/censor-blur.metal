// flair-metal-hash: 990c2dbc
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
    float uBlur;
    float uFrost;
    float uBrightness;
    float2 uCentre;
    float2 uSize;
    int uShape;
    float uFeather;
    uint uInvert;
    char _m21_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_censor_blur_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _95)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_95.uBackdrop) * _95.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_95.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _95)
{
    float4 _237;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _237 = overBackdrop(param, _95);
    }
    else
    {
        float2 param_1 = fract(uv);
        _237 = float4(testCard(param_1), 1.0);
    }
    return _237;
}

static inline __attribute__((always_inline))
float region(thread const float2& fragCoord, constant FlairUniforms& _95)
{
    float2 hs = fast::max((_95.uSize * 0.5) * float2(_95.iResolution[0], _95.iResolution[1]), float2(1.0));
    float2 p = fragCoord - (_95.uCentre * float2(_95.iResolution[0], _95.iResolution[1]));
    float d;
    if (_95.uShape == 0)
    {
        float2 q = abs(p) - hs;
        d = length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0);
    }
    else
    {
        d = (length(p / hs) - 1.0) * fast::min(hs.x, hs.y);
    }
    float m = 1.0 - smoothstep(((-0.5) * _95.uFeather) - 0.5, (0.5 * _95.uFeather) + 0.5, d);
    float _335;
    if (_95.uInvert != 0u)
    {
        _335 = 1.0 - m;
    }
    else
    {
        _335 = m;
    }
    return _335;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 softPicture(thread const float2& uv, thread const float& lod, constant FlairUniforms& _95, texture2d<float> uImage, sampler uImageSmplr)
{
    float4 _351;
    if (int2(uImage.get_width(), uImage.get_height()).x > 1)
    {
        float4 param = uImage.sample(uImageSmplr, uv, level(lod));
        _351 = overBackdrop(param, _95);
    }
    else
    {
        float2 param_1 = fract(uv);
        _351 = float4(testCard(param_1), 1.0);
    }
    return _351;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _95, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_95.iResolution[0], _95.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _95);
    float2 param_1 = fragCoord;
    float m = region(param_1, _95);
    bool _387 = m <= 0.0;
    bool _395;
    if (!_387)
    {
        _395 = _95.uBlur <= 0.0;
    }
    else
    {
        _395 = _387;
    }
    if (_395)
    {
        fragColor = pic;
        return;
    }
    float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
    float lod = fast::max(0.0, log2((_95.uBlur * fast::max(ts.x / _95.iResolution[0u], ts.y / _95.iResolution[1u])) / 4.0));
    float2 param_2 = fragCoord;
    float spin = hash12(param_2) * 6.28318023681640625;
    float4 sum = float4(0.0);
    for (int i = 0; i < 16; i++)
    {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / 16.0) * _95.uBlur;
        float a = (fi * 2.399960041046142578125) + spin;
        float2 param_3 = uv + ((float2(cos(a), sin(a)) * r) / float2(_95.iResolution[0], _95.iResolution[1]));
        float param_4 = lod;
        float4 c = softPicture(param_3, param_4, _95, uImage, uImageSmplr);
        sum += float4(c.xyz * c.w, c.w);
    }
    float3 col = sum.xyz / float3(fast::max(sum.w, 9.9999997473787516355514526367188e-05));
    float2 param_5 = (fragCoord * 1.37000000476837158203125) + float2(11.0);
    col += float3(((hash12(param_5) - 0.5) * _95.uFrost) * 0.300000011920928955078125);
    col = fast::clamp(col + float3(_95.uBrightness), float3(0.0), float3(1.0));
    fragColor = mix(pic, float4(col, sum.w / 16.0), float4(m));
}

fragment flair_censor_blur_frag_out flair_censor_blur_frag(constant FlairUniforms& _95 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_censor_blur_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _551;
    if (_95.flair_flipY > 0.5)
    {
        _551 = _95.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _551 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _551);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _95, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

