// flair-metal-hash: 6755796e
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uShading;
    float uStroke;
    float uAngle;
    float uColour;
    float3 uLead;
    packed_float3 uPaper;
    float uGrain;
    float uBoil;
    char _m23_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_pencil_sketch_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _227)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _371 = ts.x <= 1;
    bool _378;
    if (!_371)
    {
        _378 = ts.y <= 1;
    }
    else
    {
        _378 = _371;
    }
    bool _385;
    if (!_378)
    {
        _385 = _227.iResolution[0u] <= 0.0;
    }
    else
    {
        _385 = _378;
    }
    bool _392;
    if (!_385)
    {
        _392 = _227.iResolution[1u] <= 0.0;
    }
    else
    {
        _392 = _385;
    }
    if (_392)
    {
        return uv;
    }
    float boxAspect = _227.iResolution[0u] / _227.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _415;
    if (boxAspect > texAspect)
    {
        _415 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _415 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _415;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 boilSeed(constant FlairUniforms& _227)
{
    float2 _612;
    if (_227.uBoil > 0.0)
    {
        float2 param = float2(floor(_227.iTime * _227.uBoil), 7.099999904632568359375);
        _612 = hash22(param) * 300.0;
    }
    else
    {
        _612 = float2(0.0);
    }
    return _612;
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _227)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_227.uBackdrop) * _227.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_227.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _227)
{
    float4 _442;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _442 = overBackdrop(param, _227);
    }
    else
    {
        float2 param_1 = fract(uv);
        _442 = float4(testCard(param_1), 1.0);
    }
    return _442;
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _227)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _227);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _227)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _227);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _227);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _227);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _227);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _227);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _227);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _227);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _227);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float streaks(thread const float2& p, thread const float& a, thread const float& len)
{
    float param = a;
    float2 q = rot(param) * p;
    float2 param_1 = float2(q.x / len, q.y);
    return vnoise(param_1);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _227, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_227.iResolution[0], _227.iResolution[1]);
    float2 uv = fitCoverUV(uImage, uImageSmplr, param, _227);
    float2 px = float2(1.0) / float2(_227.iResolution[0], _227.iResolution[1]);
    float2 seed = boilSeed(_227);
    float2 param_1 = (fragCoord / float2(40.0)) + seed;
    float2 param_2 = ((fragCoord / float2(40.0)) + seed) + float2(9.0);
    float2 wobble = ((float2(vnoise(param_1), vnoise(param_2)) - float2(0.5)) * step(0.001000000047497451305389404296875, _227.uBoil)) * 2.0;
    float2 st = uv + (wobble * px);
    float2 param_3 = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_3, _227);
    float3 param_4 = pic.xyz;
    float dark = 1.0 - luma(param_4);
    float _696;
    if (_227.uLine > 0.0)
    {
        float2 param_5 = st;
        float2 param_6 = px * _227.uLine;
        _696 = inkEdge(uImage, uImageSmplr, param_5, param_6, _227);
    }
    else
    {
        _696 = 0.0;
    }
    float edge = _696;
    float2 param_7 = (fragCoord / float2(3.0)) + seed;
    float line = smoothstep(_227.uThreshold, (_227.uThreshold * 1.7999999523162841796875) + 0.0500000007450580596923828125, edge) * (0.699999988079071044921875 + (0.300000011920928955078125 * vnoise(param_7)));
    float2 p = fragCoord + seed;
    float a = radians(_227.uAngle);
    float tone = 0.0;
    for (int i = 0; i < 3; i++)
    {
        float fi = float(i);
        float2 param_8 = p + float2(fi * 51.0);
        float param_9 = a + (fi * 0.64999997615814208984375);
        float param_10 = _227.uStroke;
        float s = smoothstep(0.25, 0.85000002384185791015625, streaks(param_8, param_9, param_10));
        float from = 0.20000000298023223876953125 + (0.2199999988079071044921875 * fi);
        float layer = smoothstep(from, from + 0.300000011920928955078125, dark + ((s - 0.5) * 0.300000011920928955078125));
        tone = 1.0 - ((1.0 - tone) * (1.0 - ((layer * s) * 0.699999988079071044921875)));
    }
    tone = fast::max(tone, (dark * dark) * 0.3499999940395355224609375);
    float2 param_11 = (fragCoord * 0.699999988079071044921875) + float2(3.0);
    float2 param_12 = fragCoord;
    float grain = (0.60000002384185791015625 * vnoise(param_11)) + (0.4000000059604644775390625 * hash12(param_12));
    float ink = fast::clamp(fast::max(line, tone * _227.uShading) * (1.0 - ((_227.uGrain * 0.449999988079071044921875) * grain)), 0.0, 1.0);
    float3 lead = mix(_227.uLead, pic.xyz * 0.800000011920928955078125, float3(_227.uColour));
    float3 paper = float3(_227.uPaper) * (1.0 - ((_227.uGrain * 0.0599999986588954925537109375) * grain));
    fragColor = float4(mix(paper, lead, float3(ink)), pic.w);
}

fragment flair_image_pencil_sketch_frag_out flair_image_pencil_sketch_frag(constant FlairUniforms& _227 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_pencil_sketch_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _889;
    if (_227.flair_flipY > 0.5)
    {
        _889 = _227.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _889 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _889);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _227, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

