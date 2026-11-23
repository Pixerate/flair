// flair-metal-hash: 32fbcdf8
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
    float uNoise;
    float uGrain;
    float uBlocks;
    char _m16_pad[4];
    packed_float3 uTint;
    float uTintAmount;
    uint uAnimate;
    float uProgress;
    char _m20_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_denoise_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float oneShot(thread const float& period, constant FlairUniforms& _91)
{
    return smoothstep(0.0, 0.7799999713897705078125, fract(_91.iTime / period));
}

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
    float4 _233;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _233 = overBackdrop(param, _91);
    }
    else
    {
        float2 param_1 = fract(uv);
        _233 = float4(testCard(param_1), 1.0);
    }
    return _233;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _91, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_91.iResolution[0], _91.iResolution[1]);
    float _275;
    if (_91.uAnimate != 0u)
    {
        float param = 4.0;
        _275 = oneShot(param, _91);
    }
    else
    {
        _275 = fast::clamp(_91.uProgress, 0.0, 1.0);
    }
    float t = _275;
    float k = 1.0 - t;
    float block = fast::max(1.0, (_91.uBlocks * k) * k);
    float2 cell = ((floor(fragCoord / float2(block)) + float2(0.5)) * block) / float2(_91.iResolution[0], _91.iResolution[1]);
    float2 param_1 = cell;
    float4 coarse = pictureRGBA(uImage, uImageSmplr, param_1, _91);
    float2 param_2 = uv;
    float4 fine = pictureRGBA(uImage, uImageSmplr, param_2, _91);
    float4 pic = mix(coarse, fine, float4(smoothstep(0.25, 0.949999988079071044921875, t)));
    float frame = floor(_91.iTime * 12.0);
    float2 g = floor(fragCoord / float2(_91.uGrain));
    float2 param_3 = g + float2(frame * 1.7000000476837158203125);
    float2 param_4 = g + float2(31.3999996185302734375, frame);
    float2 param_5 = g + float2(frame, 77.09999847412109375);
    float3 n1 = float3(hash12(param_3), hash12(param_4), hash12(param_5));
    float2 param_6 = (g * 1.2999999523162841796875) + float2(frame);
    float2 param_7 = (g * 1.7000000476837158203125) + float2(5.099999904632568359375, frame);
    float2 param_8 = (g * 0.699999988079071044921875) + float2(frame, 9.30000019073486328125);
    float3 n2 = float3(hash12(param_6), hash12(param_7), hash12(param_8));
    float3 n = (n1 + n2) * 0.5;
    float3 _noise = mix(n, float3(_91.uTint) * (0.4000000059604644775390625 + (1.2000000476837158203125 * n.x)), float3(_91.uTintAmount));
    float amount = powr(k, mix(2.599999904632568359375, 0.699999988079071044921875, _91.uNoise));
    float3 col = mix(pic.xyz, _noise, float3(amount));
    fragColor = float4(col, mix(pic.w, 1.0, amount * _91.uBackdropAlpha));
}

fragment flair_denoise_reveal_frag_out flair_denoise_reveal_frag(constant FlairUniforms& _91 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_denoise_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _456;
    if (_91.flair_flipY > 0.5)
    {
        _456 = _91.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _456 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _456);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _91, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

