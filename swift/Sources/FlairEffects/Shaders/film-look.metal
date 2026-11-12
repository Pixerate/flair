// flair-metal-hash: 21d8a155
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
    float uGrain;
    float uWeave;
    float uHalation;
    float uVignette;
    float3 uTint;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_film_look_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _151)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_151.uBackdrop) * _151.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_151.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _151)
{
    float4 _292;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _292 = overBackdrop(param, _151);
    }
    else
    {
        float2 param_1 = fract(uv);
        _292 = float4(testCard(param_1), 1.0);
    }
    return _292;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _151)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _151).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _151, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_151.iResolution[0], _151.iResolution[1]);
    float frame = floor(_151.iTime * 24.0);
    float2 param = float2(frame * 0.300000011920928955078125, 0.0);
    float2 param_1 = float2(0.0, frame * 0.300000011920928955078125);
    uv += ((float2(vnoise(param), vnoise(param_1)) - float2(0.5)) * _151.uWeave);
    float2 param_2 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_2, _151);
    float3 col = pic.xyz;
    float2 param_3 = uv + float2(0.006000000052154064178466796875, 0.0);
    float2 param_4 = uv - float2(0.006000000052154064178466796875, 0.0);
    float2 param_5 = uv + float2(0.0, 0.006000000052154064178466796875);
    float2 param_6 = uv - float2(0.0, 0.006000000052154064178466796875);
    float3 blur = (((picture(uImage, uImageSmplr, param_3, _151) + picture(uImage, uImageSmplr, param_4, _151)) + picture(uImage, uImageSmplr, param_5, _151)) + picture(uImage, uImageSmplr, param_6, _151)) * 0.25;
    float bright = smoothstep(0.60000002384185791015625, 1.0, dot(blur, float3(0.333000004291534423828125)));
    col += (((float3(1.0, 0.300000011920928955078125, 0.100000001490116119384765625) * bright) * _151.uHalation) * 0.5);
    col *= _151.uTint;
    float2 param_7 = fragCoord + float2(frame * 31.700000762939453125);
    col += float3((hash12(param_7) - 0.5) * _151.uGrain);
    col *= (1.0 - (_151.uVignette * smoothstep(0.300000011920928955078125, 0.89999997615814208984375, length(uv - float2(0.5)) * 1.2999999523162841796875)));
    fragColor = float4(col, pic.w);
}

fragment flair_film_look_frag_out flair_film_look_frag(constant FlairUniforms& _151 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_film_look_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _456;
    if (_151.flair_flipY > 0.5)
    {
        _456 = _151.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _456 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _456);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _151, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

