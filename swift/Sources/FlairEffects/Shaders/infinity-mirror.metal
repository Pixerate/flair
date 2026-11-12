// flair-metal-hash: 9b614d38
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
    float uDepth;
    float uFade;
    char _m15_pad[8];
    packed_float3 uTint;
    float uTintAlpha;
    float uFrame;
    char _m18_pad[12];
    packed_float3 uFrameColor;
    float uLights;
    packed_float3 uLightColor;
    float uSpeed;
    float uSpin;
    uint uRound;
    char _m24_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_infinity_mirror_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float extent(thread const float2& p, thread const float& aspect, constant FlairUniforms& _82)
{
    float2 q = p / float2(0.5 * aspect, 0.5);
    float _265;
    if (_82.uRound != 0u)
    {
        _265 = length(q);
    }
    else
    {
        _265 = fast::max(abs(q.x), abs(q.y));
    }
    return _265;
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _82)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_82.uBackdrop) * _82.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_82.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _82)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _82.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _82);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _82, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _82.iResolution[1u];
    float aspect = _82.iResolution[0u] * px;
    float2 p = (fragCoord - (float2(_82.iResolution[0], _82.iResolution[1]) * 0.5)) * px;
    float phase = fract(_82.iTime * _82.uSpeed);
    float2 param = p;
    float param_1 = aspect;
    float m = fast::max(extent(param, param_1, _82), 9.9999997473787516355514526367188e-05);
    float z = (log(m) / log(_82.uDepth)) + phase;
    float level0 = floor(z);
    float scale = powr(_82.uDepth, -(level0 - phase));
    float param_2 = _82.uSpin * level0;
    float2 q = rot(param_2) * (p * scale);
    float2 uv = (q / float2(aspect, 1.0)) + float2(0.5);
    float2 param_3 = uv;
    float param_4 = 1.0;
    float4 pic = pictureBlurRGBA(uImage, uImageSmplr, param_3, param_4, _82);
    float3 col = pic.xyz;
    float deep = fast::max(z - phase, 0.0);
    col *= powr(1.0 - (_82.uFade * 0.60000002384185791015625), deep);
    col = mix(col, (col * float3(_82.uTint)) * 1.2999999523162841796875, float3(1.0 - powr(1.0 - _82.uTintAlpha, deep)));
    float2 param_5 = q;
    float param_6 = aspect;
    float local = extent(param_5, param_6, _82);
    float band = (1.0 - local) / fast::max(_82.uFrame, 9.9999997473787516355514526367188e-05);
    float frame = step(9.9999997473787516355514526367188e-05, _82.uFrame) * smoothstep(1.0 + (((2.0 * px) * scale) / _82.uFrame), 1.0, band);
    float2 dir = q / float2(0.5 * aspect, 0.5);
    float _436;
    if (_82.uRound != 0u)
    {
        _436 = precise::atan2(dir.y, dir.x) / 6.28318023681640625;
    }
    else
    {
        float _454;
        if (abs(dir.x) > abs(dir.y))
        {
            _454 = (dir.y * 0.25) * sign(dir.x);
        }
        else
        {
            _454 = 0.5 - ((dir.x * 0.25) * sign(dir.y));
        }
        _436 = _454;
    }
    float around = _436;
    float bulbs = (_82.uRound != 0u) ? 48.0 : 40.0;
    float bulb = 1.0 - (abs(fract(around * bulbs) - 0.5) * 2.0);
    float lit = smoothstep(0.550000011920928955078125, 1.0, bulb) * exp(-powr((band - 0.5) * 3.0, 2.0));
    float3 frameCol = (float3(_82.uFrameColor) * (0.800000011920928955078125 + (0.4000000059604644775390625 * band))) + (((float3(_82.uLightColor) * lit) * _82.uLights) * 1.5);
    float3 spill = (((float3(_82.uLightColor) * _82.uLights) * 0.25) * exp((-fast::max(band - 1.0, 0.0)) * 1.2000000476837158203125)) * step(1.0, band);
    col = mix(col + (spill * powr(1.0 - (_82.uFade * 0.60000002384185791015625), deep)), frameCol * powr(1.0 - (_82.uFade * 0.60000002384185791015625), deep), float3(frame));
    fragColor = float4(col, pic.w);
}

fragment flair_infinity_mirror_frag_out flair_infinity_mirror_frag(constant FlairUniforms& _82 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_infinity_mirror_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _583;
    if (_82.flair_flipY > 0.5)
    {
        _583 = _82.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _583 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _583);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _82, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

