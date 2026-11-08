// flair-metal-hash: c5eb48a3
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
    float uLine;
    float uThreshold;
    float uKeep;
    float3 uLead;
    float3 uPaper;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_sketch_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _254)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _393 = ts.x <= 1;
    bool _400;
    if (!_393)
    {
        _400 = ts.y <= 1;
    }
    else
    {
        _400 = _393;
    }
    bool _407;
    if (!_400)
    {
        _407 = _254.iResolution[0u] <= 0.0;
    }
    else
    {
        _407 = _400;
    }
    bool _414;
    if (!_407)
    {
        _414 = _254.iResolution[1u] <= 0.0;
    }
    else
    {
        _414 = _407;
    }
    if (_414)
    {
        return uv;
    }
    float boxAspect = _254.iResolution[0u] / _254.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _437;
    if (boxAspect > texAspect)
    {
        _437 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _437 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _437;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _254)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_254.uBackdrop) * _254.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_254.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _254)
{
    float4 _464;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _464 = overBackdrop(param, _254);
    }
    else
    {
        float2 param_1 = fract(uv);
        _464 = float4(testCard(param_1), 1.0);
    }
    return _464;
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
float drawn(thread const float& stage, thread const float& order)
{
    return smoothstep(0.0, 0.0599999986588954925537109375, (stage * 1.12000000476837158203125) - order);
}

static inline __attribute__((always_inline))
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _254)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _254);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _254)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _254);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _254);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _254);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _254);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _254);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _254);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _254);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _254);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _254, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_254.iResolution[0], _254.iResolution[1]);
    float2 uv = fitCoverUV(uImage, uImageSmplr, param, _254);
    float2 px = float2(1.0) / float2(_254.iResolution[0], _254.iResolution[1]);
    float2 q = fragCoord / float2(_254.iResolution[1u]);
    float cycle = fract(_254.iTime / 6.0);
    float _671;
    if (_254.uAnimate != 0u)
    {
        _671 = fast::clamp(cycle / 0.800000011920928955078125, 0.0, 1.0);
    }
    else
    {
        _671 = _254.uProgress;
    }
    float t = _671;
    float _686;
    if (_254.uAnimate != 0u)
    {
        _686 = smoothstep(0.89999997615814208984375, 1.0, cycle);
    }
    else
    {
        _686 = 0.0;
    }
    float fade = _686;
    float2 param_1 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_1, _254);
    float2 param_2 = q * 3.0;
    int param_3 = 4;
    float _716 = fbm(param_2, param_3);
    float order = fast::clamp((0.550000011920928955078125 * ((uv.x * 0.699999988079071044921875) + ((1.0 - uv.y) * 0.300000011920928955078125))) + (0.449999988079071044921875 * _716), 0.0, 1.0);
    float param_4 = t / 0.4000000059604644775390625;
    float param_5 = order;
    float lineIn = drawn(param_4, param_5);
    float param_6 = (t - 0.25) / 0.3499999940395355224609375;
    float param_7 = order;
    float shadeIn = drawn(param_6, param_7);
    float2 param_8 = (q * 2.5) + float2(11.0);
    int param_9 = 4;
    float _750 = fbm(param_8, param_9);
    float colourOrder = fast::clamp((0.60000002384185791015625 * uv.x) + (0.4000000059604644775390625 * _750), 0.0, 1.0);
    float gap = (((t - 0.5) / 0.449999988079071044921875) * 1.12000000476837158203125) - colourOrder;
    float wet = smoothstep(0.0, 0.0500000007450580596923828125, gap);
    float fringe = wet * smoothstep(0.119999997317790985107421875, 0.0, gap);
    float _775;
    if (_254.uLine > 0.0)
    {
        float2 param_10 = uv;
        float2 param_11 = px * _254.uLine;
        _775 = inkEdge(uImage, uImageSmplr, param_10, param_11, _254);
    }
    else
    {
        _775 = 0.0;
    }
    float edge = _775;
    float2 param_12 = fragCoord / float2(3.0);
    float line = smoothstep(_254.uThreshold, (_254.uThreshold * 1.7999999523162841796875) + 0.0500000007450580596923828125, edge) * (0.699999988079071044921875 + (0.300000011920928955078125 * vnoise(param_12)));
    float3 param_13 = pic.xyz;
    float dark = 1.0 - luma(param_13);
    float2 param_14 = fragCoord;
    float param_15 = 0.60000002384185791015625;
    float param_16 = 14.0;
    float s = smoothstep(0.25, 0.85000002384185791015625, streaks(param_14, param_15, param_16));
    float shade = (smoothstep(0.300000011920928955078125, 0.800000011920928955078125, dark + ((s - 0.5) * 0.300000011920928955078125)) * s) * 0.3499999940395355224609375;
    float3 col = mix(_254.uPaper, _254.uLead, float3(shade * shadeIn));
    col = mix(col, pic.xyz, float3(wet));
    col *= (1.0 - (0.25 * fringe));
    col = mix(col, _254.uLead, float3((line * lineIn) * mix(1.0, _254.uKeep, wet)));
    fragColor = float4(mix(col, _254.uPaper, float3(fade)), pic.w);
}

fragment flair_sketch_reveal_frag_out flair_sketch_reveal_frag(constant FlairUniforms& _254 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_sketch_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _893;
    if (_254.flair_flipY > 0.5)
    {
        _893 = _254.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _893 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _893);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _254, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

