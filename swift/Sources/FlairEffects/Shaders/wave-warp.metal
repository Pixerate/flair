// flair-metal-hash: 0f8d0511
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
    uint uRows;
    uint uColumns;
    float uAmplitude;
    float uFrequency;
    float uSpeed;
    float uShade;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_wave_warp_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float wave(thread const float& x)
{
    return sin(x) + (0.300000011920928955078125 * sin((2.2999999523162841796875 * x) + 1.0));
}

static inline __attribute__((always_inline))
float slope(thread const float& x)
{
    return cos(x) + (0.689999997615814208984375 * cos((2.2999999523162841796875 * x) + 1.0));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _60)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_60.uBackdrop) * _60.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_60.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _60)
{
    float4 _204;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _204 = overBackdrop(param, _60);
    }
    else
    {
        float2 param_1 = fract(uv);
        _204 = float4(testCard(param_1), 1.0);
    }
    return _204;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _60, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_60.iResolution[0], _60.iResolution[1]);
    float py = ((uv.y * _60.uFrequency) * 6.28318023681640625) - (_60.iTime * _60.uSpeed);
    float px = ((uv.x * _60.uFrequency) * 6.28318023681640625) - (_60.iTime * _60.uSpeed);
    float _288;
    if (_60.uRows != 0u)
    {
        float param = py;
        _288 = wave(param);
    }
    else
    {
        _288 = 0.0;
    }
    float _301;
    if (_60.uColumns != 0u)
    {
        float param_1 = px;
        _301 = wave(param_1);
    }
    else
    {
        _301 = 0.0;
    }
    float2 offset = float2(_288, _301) * _60.uAmplitude;
    float _318;
    if (_60.uRows != 0u)
    {
        float param_2 = py;
        _318 = slope(param_2);
    }
    else
    {
        _318 = 0.0;
    }
    float _329;
    if (_60.uColumns != 0u)
    {
        float param_3 = px;
        _329 = slope(param_3);
    }
    else
    {
        _329 = 0.0;
    }
    float light = _318 + _329;
    float2 param_4 = uv + offset;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_4, _60);
    float k = ((_60.uShade * 0.180000007152557373046875) * light) * fast::clamp(_60.uAmplitude * 40.0, 0.0, 1.0);
    fragColor = float4((pic.xyz * (1.0 + k)) + float3(fast::max(k, 0.0) * 0.4000000059604644775390625), pic.w);
}

fragment flair_wave_warp_frag_out flair_wave_warp_frag(constant FlairUniforms& _60 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_wave_warp_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _387;
    if (_60.flair_flipY > 0.5)
    {
        _387 = _60.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _387 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _387);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _60, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

