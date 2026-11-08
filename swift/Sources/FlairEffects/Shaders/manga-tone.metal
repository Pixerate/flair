// flair-metal-hash: ef044255
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

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
    float uLine;
    float uThreshold;
    int uTones;
    float uToneSize;
    float uToneAngle;
    float uBlack;
    float uWhite;
    float uHatch;
    float3 uInk;
    float3 uPaper;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_manga_tone_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _175)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_175.uBackdrop) * _175.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_175.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _175)
{
    float4 _316;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _316 = overBackdrop(param, _175);
    }
    else
    {
        float2 param_1 = fract(uv);
        _316 = float4(testCard(param_1), 1.0);
    }
    return _316;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _175)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _175).xyz;
}

static inline __attribute__((always_inline))
float toneCover(thread const float& k, constant FlairUniforms& _175)
{
    float n = float(_175.uTones);
    float _529;
    if (n > 1.0)
    {
        _529 = mix(0.60000002384185791015625, 0.1599999964237213134765625, k / (n - 1.0));
    }
    else
    {
        _529 = 0.4000000059604644775390625;
    }
    return _529;
}

static inline __attribute__((always_inline))
float toneDots(thread const float2& p, thread const float& a, thread const float& c, constant FlairUniforms& _175)
{
    float2x2 r = float2x2(float2(cos(a), sin(a)), float2(-sin(a), cos(a)));
    float2 q = (r * p) / float2(_175.uToneSize);
    float d = length(fract(q) - float2(0.5));
    float radius = sqrt(c / 3.141590118408203125);
    float aa = 0.60000002384185791015625 / _175.uToneSize;
    return fast::clamp(((radius - d) / (2.0 * aa)) + 0.5, 0.0, 1.0) * step(0.001000000047497451305389404296875, c);
}

static inline __attribute__((always_inline))
float hatching(thread const float2& p, constant FlairUniforms& _175)
{
    float s = _175.uToneSize * 0.89999997615814208984375;
    float a = abs(fract(dot(p, float2(0.707099974155426025390625, -0.707099974155426025390625)) / s) - 0.5);
    float b = abs(fract(dot(p, float2(0.707099974155426025390625)) / s) - 0.5);
    return fast::max(fast::clamp(((a - 0.3300000131130218505859375) * s) + 0.5, 0.0, 1.0), fast::clamp(((b - 0.3300000131130218505859375) * s) + 0.5, 0.0, 1.0));
}

static inline __attribute__((always_inline))
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _175)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _175);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _175)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _175);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _175);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _175);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _175);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _175);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _175);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _175);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _175);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _175, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_175.iResolution[0], _175.iResolution[1]);
    float2 px = float2(1.0) / float2(_175.iResolution[0], _175.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _175);
    float2 param_1 = uv + float2(px.x * 1.5, 0.0);
    float2 param_2 = uv - float2(px.x * 1.5, 0.0);
    float2 param_3 = uv + float2(0.0, px.y * 1.5);
    float2 param_4 = uv - float2(0.0, px.y * 1.5);
    float3 c = (((((pic.xyz * 4.0) + picture(uImage, uImageSmplr, param_1, _175)) + picture(uImage, uImageSmplr, param_2, _175)) + picture(uImage, uImageSmplr, param_3, _175)) + picture(uImage, uImageSmplr, param_4, _175)) / float3(8.0);
    float l = dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float v = fast::clamp((l - _175.uBlack) / fast::max(_175.uWhite - _175.uBlack, 0.001000000047497451305389404296875), 0.0, 0.99989998340606689453125) * float(_175.uTones);
    float k = floor(v);
    float w = fast::max(fwidth(v), 0.001000000047497451305389404296875) * 0.75;
    float _683;
    if ((k + 1.0) < float(_175.uTones))
    {
        float param_5 = k + 1.0;
        _683 = toneCover(param_5, _175);
    }
    else
    {
        _683 = 0.0;
    }
    float next = _683;
    float a = radians(_175.uToneAngle);
    float param_6 = k;
    float2 param_7 = fragCoord;
    float param_8 = a;
    float param_9 = toneCover(param_6, _175);
    float2 param_10 = fragCoord;
    float param_11 = a;
    float param_12 = next;
    float tone = mix(toneDots(param_7, param_8, param_9, _175), toneDots(param_10, param_11, param_12, _175), smoothstep(1.0 - w, 1.0, fract(v)));
    float fl = fast::max(fwidth(l), 0.001000000047497451305389404296875);
    tone *= smoothstep(_175.uWhite + fl, _175.uWhite - fl, l);
    float shadow = smoothstep(_175.uBlack + fl, _175.uBlack - fl, l);
    float2 param_13 = fragCoord;
    float ink = mix(tone, mix(1.0, hatching(param_13, _175), _175.uHatch), shadow);
    float2 param_14 = uv;
    float2 param_15 = px * _175.uLine;
    float edge = inkEdge(uImage, uImageSmplr, param_14, param_15, _175);
    float line = smoothstep(_175.uThreshold, _175.uThreshold + 0.0599999986588954925537109375, edge);
    ink = fast::max(ink, line);
    float2 param_16 = fragCoord * 0.300000011920928955078125;
    float3 paper = _175.uPaper * (0.9700000286102294921875 + (0.02999999932944774627685546875 * vnoise(param_16)));
    fragColor = float4(mix(paper, _175.uInk, float3(ink)), fast::max(pic.w, line));
}

fragment flair_manga_tone_frag_out flair_manga_tone_frag(constant FlairUniforms& _175 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_manga_tone_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _821;
    if (_175.flair_flipY > 0.5)
    {
        _821 = _175.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _821 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _821);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _175, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

