// flair-metal-hash: 1e73ce57
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
    uint uAnimate;
    float uProgress;
    float uStrength;
    float uScale;
    float uFlow;
    char _m18_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_liquid_morph_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _215)
{
    float _377;
    if (_215.uAnimate != 0u)
    {
        _377 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_215.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _377 = _215.uProgress;
    }
    return _377;
}

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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 coverScale(texture2d<float> tex, sampler texSmplr, constant FlairUniforms& _215)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    float frameAspect = _215.iResolution[0u] / _215.iResolution[1u];
    float _414;
    if (size.x > 1.0)
    {
        _414 = size.x / size.y;
    }
    else
    {
        _414 = frameAspect;
    }
    float imageAspect = _414;
    float2 _428;
    if (frameAspect > imageAspect)
    {
        _428 = float2(1.0, imageAspect / frameAspect);
    }
    else
    {
        _428 = float2(frameAspect / imageAspect, 1.0);
    }
    return _428;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _215)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_215.uBackdrop) * _215.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_215.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _215)
{
    float4 _352;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _352 = overBackdrop(param, _215);
    }
    else
    {
        float2 param_1 = fract(uv);
        _352 = float4(testCard(param_1), 1.0);
    }
    return _352;
}

static inline __attribute__((always_inline))
float4 coverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _215)
{
    float2 param = float2(0.5) + ((uv - float2(0.5)) * coverScale(tex, texSmplr, _215));
    return pictureRGBA(tex, texSmplr, param, _215);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _215, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_215.iResolution[0], _215.iResolution[1]);
    float t = progress(_215);
    float s = sin(3.141590118408203125 * t);
    float time = _215.iTime * _215.uFlow;
    float2 q = (fragCoord / float2(_215.iResolution[1u])) * _215.uScale;
    float2 param = q + float2(0.0, time);
    int param_1 = 4;
    float _492 = fbm(param, param_1);
    float2 param_2 = (q + float2(5.19999980926513671875, 1.2999999523162841796875)) - float2(time, 0.0);
    int param_3 = 4;
    float _503 = fbm(param_2, param_3);
    float2 first = float2(_492, _503) - float2(0.5);
    float2 param_4 = ((q + (first * 4.0)) + float2(1.7000000476837158203125, 9.19999980926513671875)) + float2(time * 0.5);
    int param_5 = 4;
    float _522 = fbm(param_4, param_5);
    float2 param_6 = ((q + (first * 4.0)) + float2(8.30000019073486328125, 2.7999999523162841796875)) - float2(time * 0.5);
    int param_7 = 4;
    float _537 = fbm(param_6, param_7);
    float2 flow = float2(_522, _537) - float2(0.5);
    float2 d = ((flow * _215.uStrength) * s) * 2.0;
    float2 param_8 = uv + d;
    float4 a = coverRGBA(uFrom, uFromSmplr, param_8, _215);
    float2 param_9 = uv - d;
    float4 b = coverRGBA(uTo, uToSmplr, param_9, _215);
    float k = smoothstep(0.25, 0.75, t + (((flow.x + flow.y) * 0.60000002384185791015625) * s));
    fragColor = mix(a, b, float4(k));
}

fragment flair_transition_liquid_morph_frag_out flair_transition_liquid_morph_frag(constant FlairUniforms& _215 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_liquid_morph_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _595;
    if (_215.flair_flipY > 0.5)
    {
        _595 = _215.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _595 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _595);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _215, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

