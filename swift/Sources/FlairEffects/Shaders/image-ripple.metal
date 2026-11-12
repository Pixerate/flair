// flair-metal-hash: ffb92615
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
    float uAmplitude;
    float uFrequency;
    float uSpeed;
    char _m16_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_ripple_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _53)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_53.uBackdrop) * _53.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_53.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _53)
{
    float4 _197;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _197 = overBackdrop(param, _53);
    }
    else
    {
        float2 param_1 = fract(uv);
        _197 = float4(testCard(param_1), 1.0);
    }
    return _197;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _53, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_53.iResolution[0], _53.iResolution[1]);
    float2 _230;
    if (_53.iMouse.z > 0.0)
    {
        _230 = _53.iMouse.xy;
    }
    else
    {
        _230 = float2(_53.iResolution[0], _53.iResolution[1]) * 0.5;
    }
    float2 centre = _230 / float2(_53.iResolution[0], _53.iResolution[1]);
    float2 d = uv - centre;
    d.x *= (_53.iResolution[0u] / _53.iResolution[1u]);
    float r = length(d);
    float wave = sin((r * _53.uFrequency) - (_53.iTime * _53.uSpeed)) * smoothstep(0.89999997615814208984375, 0.0, r);
    float2 offset = (fast::normalize(d + float2(9.9999997473787516355514526367188e-06)) * wave) * _53.uAmplitude;
    float2 param = uv + offset;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _53);
    float3 col = pic.xyz + float3(((0.60000002384185791015625 * fast::max(wave, 0.0)) * _53.uAmplitude) * 8.0);
    fragColor = float4(col, pic.w);
}

fragment flair_image_ripple_frag_out flair_image_ripple_frag(constant FlairUniforms& _53 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_ripple_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _332;
    if (_53.flair_flipY > 0.5)
    {
        _332 = _53.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _332 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _332);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _53, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

