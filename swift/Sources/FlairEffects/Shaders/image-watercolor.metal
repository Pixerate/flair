// flair-metal-hash: 1c8ac0bb
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
    float uSoftness;
    float uBleed;
    float uWashes;
    float uEdges;
    float uGranulation;
    float uLines;
    char _m19_pad[8];
    packed_float3 uPaper;
    float uFlow;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_watercolor_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _233)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _372 = ts.x <= 1;
    bool _379;
    if (!_372)
    {
        _379 = ts.y <= 1;
    }
    else
    {
        _379 = _372;
    }
    bool _386;
    if (!_379)
    {
        _386 = _233.iResolution[0u] <= 0.0;
    }
    else
    {
        _386 = _379;
    }
    bool _393;
    if (!_386)
    {
        _393 = _233.iResolution[1u] <= 0.0;
    }
    else
    {
        _393 = _386;
    }
    if (_393)
    {
        return uv;
    }
    float boxAspect = _233.iResolution[0u] / _233.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _416;
    if (boxAspect > texAspect)
    {
        _416 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _416 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _416;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _233)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_233.uBackdrop) * _233.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_233.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _233)
{
    float4 _443;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _443 = overBackdrop(param, _233);
    }
    else
    {
        float2 param_1 = fract(uv);
        _443 = float4(testCard(param_1), 1.0);
    }
    return _443;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _233)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _233).xyz;
}

static inline __attribute__((always_inline))
float3 wash(thread const float2& uv, thread const float2& r, constant FlairUniforms& _233, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float3 sum = picture(uImage, uImageSmplr, param, _233) * 2.0;
    for (int i = 0; i < 8; i++)
    {
        float a = (float(i) * 0.785398006439208984375) + 0.300000011920928955078125;
        float2 param_1 = uv + (float2(cos(a), sin(a)) * r);
        sum += picture(uImage, uImageSmplr, param_1, _233);
    }
    return sum / float3(10.0);
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _233)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _233);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _233)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _233);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _233);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _233);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _233);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _233);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _233);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _233);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _233);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _233, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_233.iResolution[0], _233.iResolution[1]);
    float2 uv = fitCoverUV(uImage, uImageSmplr, param, _233);
    float2 px = float2(1.0) / float2(_233.iResolution[0], _233.iResolution[1]);
    float2 q = fragCoord / float2(_233.iResolution[1u]);
    float t = (_233.iTime * _233.uFlow) * 0.20000000298023223876953125;
    float2 param_1 = (q * 4.0) + float2(t);
    int param_2 = 4;
    float _680 = fbm(param_1, param_2);
    float2 param_3 = ((q * 4.0) + float2(19.299999237060546875)) - float2(t);
    int param_4 = 4;
    float _691 = fbm(param_3, param_4);
    float2 st = uv + (((float2(_680, _691) - float2(0.5)) * _233.uBleed) * 0.039999999105930328369140625);
    float2 param_5 = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_5, _233);
    float2 param_6 = st;
    float2 param_7 = px * _233.uSoftness;
    float3 soft = wash(param_6, param_7, _233, uImage, uImageSmplr);
    float2 param_8 = st;
    float2 param_9 = px * ((_233.uSoftness * 2.5) + 3.0);
    float3 wide = wash(param_8, param_9, _233, uImage, uImageSmplr);
    float3 param_10 = soft;
    float l = fast::max(luma(param_10), 0.001000000047497451305389404296875);
    float stepped = (floor(l * _233.uWashes) + smoothstep(0.60000002384185791015625, 1.0, fract(l * _233.uWashes))) / _233.uWashes;
    float3 pigment = fast::clamp(mix(mix(soft, (soft * stepped) / float3(l), float3(0.60000002384185791015625)), float3(1.0), float3(0.119999997317790985107421875)), float3(0.02999999932944774627685546875), float3(1.0));
    float2 param_11 = fragCoord / float2(3.0);
    int param_12 = 3;
    float _774 = fbm(param_11, param_12);
    float tooth = _774;
    float2 param_13 = (q * 6.0) - float2(t);
    int param_14 = 3;
    float _784 = fbm(param_13, param_14);
    float bloom = _784;
    float pool = fast::clamp(length(soft - wide) * 4.0, 0.0, 1.0) * _233.uEdges;
    float density = ((0.699999988079071044921875 + (pool * 0.60000002384185791015625)) + ((_233.uGranulation * (tooth - 0.5)) * 0.89999997615814208984375)) + ((bloom - 0.5) * 0.3499999940395355224609375);
    float3 col = float3(_233.uPaper) * powr(pigment, float3(fast::max(density, 0.20000000298023223876953125)));
    float3 param_15 = soft;
    col = mix(col, float3(_233.uPaper), float3(smoothstep(0.86000001430511474609375, 0.9700000286102294921875, luma(param_15)) * 0.800000011920928955078125));
    float _841;
    if (_233.uLines > 0.0)
    {
        float2 param_16 = uv;
        float2 param_17 = px;
        _841 = inkEdge(uImage, uImageSmplr, param_16, param_17, _233);
    }
    else
    {
        _841 = 0.0;
    }
    float edge = _841;
    col *= (1.0 - ((smoothstep(0.20000000298023223876953125, 0.550000011920928955078125, edge) * _233.uLines) * 0.550000011920928955078125));
    col *= (1.0 - (0.0500000007450580596923828125 * (tooth - 0.5)));
    fragColor = float4(col, pic.w);
}

fragment flair_image_watercolor_frag_out flair_image_watercolor_frag(constant FlairUniforms& _233 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_watercolor_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _887;
    if (_233.flair_flipY > 0.5)
    {
        _887 = _233.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _887 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _887);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _233, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

