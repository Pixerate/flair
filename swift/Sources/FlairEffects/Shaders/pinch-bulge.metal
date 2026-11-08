// flair-metal-hash: 0ad03f4f
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
    float uRadius;
    uint uAnimate;
    float uSpeed;
    float2 uCentre;
    uint uFollow;
    char _m19_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_pinch_bulge_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 centreAt(thread const float2& centre, thread const bool& follow, constant FlairUniforms& _60)
{
    float2 drift = float2(0.02999999932944774627685546875 * sin(_60.iTime * 0.37000000476837158203125), 0.02500000037252902984619140625 * cos(_60.iTime * 0.2899999916553497314453125));
    float2 idle = (centre + drift) * float2(_60.iResolution[0], _60.iResolution[1]);
    float _249;
    if (follow)
    {
        _249 = fast::clamp(_60.iPointer.z, 0.0, 1.0);
    }
    else
    {
        _249 = 0.0;
    }
    float h = _249;
    return mix(idle, _60.iPointer.xy, float2(h));
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
    float4 _203;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _203 = overBackdrop(param, _60);
    }
    else
    {
        float2 param_1 = fract(uv);
        _203 = float4(testCard(param_1), 1.0);
    }
    return _203;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _60, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = _60.uCentre;
    bool param_1 = _60.uFollow != 0u;
    float2 c = centreAt(param, param_1, _60);
    float2 d = fragCoord - c;
    float R = _60.uRadius * _60.iResolution[1u];
    float t = length(d) / R;
    float _304;
    if (_60.uAnimate != 0u)
    {
        _304 = _60.uStrength * cos(_60.iTime * _60.uSpeed);
    }
    else
    {
        _304 = _60.uStrength;
    }
    float s = _304;
    float shade = 1.0;
    if (t < 1.0)
    {
        float e = exp(s * 1.2999999523162841796875);
        d *= powr(fast::max(t, 9.9999997473787516355514526367188e-05), e - 1.0);
        shade = 1.0 + (((0.180000007152557373046875 * s) * (1.0 - t)) * (1.0 - t));
    }
    float2 param_2 = (c + d) / float2(_60.iResolution[0], _60.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_2, _60);
    fragColor = float4(pic.xyz * shade, pic.w);
}

fragment flair_pinch_bulge_frag_out flair_pinch_bulge_frag(constant FlairUniforms& _60 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_pinch_bulge_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _382;
    if (_60.flair_flipY > 0.5)
    {
        _382 = _60.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _382 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _382);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _60, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

