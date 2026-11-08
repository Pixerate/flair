// flair-metal-hash: ede443fb
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
    float uSmudge;
    float uContrast;
    float uStroke;
    float uAngle;
    float uTooth;
    float uLine;
    uint uInvert;
    float uColour;
    float3 uInk;
    packed_float3 uPaper;
    float uBoil;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_charcoal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _289)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _428 = ts.x <= 1;
    bool _435;
    if (!_428)
    {
        _435 = ts.y <= 1;
    }
    else
    {
        _435 = _428;
    }
    bool _442;
    if (!_435)
    {
        _442 = _289.iResolution[0u] <= 0.0;
    }
    else
    {
        _442 = _435;
    }
    bool _449;
    if (!_442)
    {
        _449 = _289.iResolution[1u] <= 0.0;
    }
    else
    {
        _449 = _442;
    }
    if (_449)
    {
        return uv;
    }
    float boxAspect = _289.iResolution[0u] / _289.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _472;
    if (boxAspect > texAspect)
    {
        _472 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _472 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _472;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _289)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_289.uBackdrop) * _289.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_289.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _289)
{
    float4 _499;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _499 = overBackdrop(param, _289);
    }
    else
    {
        float2 param_1 = fract(uv);
        _499 = float4(testCard(param_1), 1.0);
    }
    return _499;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 boilSeed(constant FlairUniforms& _289)
{
    float2 _675;
    if (_289.uBoil > 0.0)
    {
        float2 param = float2(floor(_289.iTime * _289.uBoil), 7.099999904632568359375);
        _675 = hash22(param) * 300.0;
    }
    else
    {
        _675 = float2(0.0);
    }
    return _675;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _289)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _289).xyz;
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
float streaks(thread const float2& p, thread const float& a, thread const float& len)
{
    float param = a;
    float2 q = rot(param) * p;
    float2 param_1 = float2(q.x / len, q.y);
    return vnoise(param_1);
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
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _289)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _289);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _289)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _289);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _289);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _289);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _289);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _289);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _289);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _289);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _289);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _289, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_289.iResolution[0], _289.iResolution[1]);
    float2 uv = fitCoverUV(uImage, uImageSmplr, param, _289);
    float2 px = float2(1.0) / float2(_289.iResolution[0], _289.iResolution[1]);
    float2 param_1 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_1, _289);
    float2 seed = boilSeed(_289);
    float3 sm = pic.xyz * 2.0;
    for (int i = 0; i < 8; i++)
    {
        float b = float(i) * 0.785398006439208984375;
        float2 param_2 = uv + ((float2(cos(b), sin(b)) * _289.uSmudge) * px);
        sm += picture(uImage, uImageSmplr, param_2, _289);
    }
    sm /= float3(10.0);
    float3 param_3 = sm;
    float l = luma(param_3);
    float _766;
    if (_289.uInvert != 0u)
    {
        _766 = l;
    }
    else
    {
        _766 = 1.0 - l;
    }
    float tone = mix(_766, fast::clamp(0.550000011920928955078125 + length(sm - float3(_289.uPaper)), 0.0, 1.0), _289.uColour);
    float d = fast::clamp(((tone - 0.5) * _289.uContrast) + 0.5, 0.0, 1.0);
    float2 p = fragCoord + seed;
    float a = radians(_289.uAngle);
    float2 param_4 = p / float2(3.5);
    float param_5 = a;
    float param_6 = _289.uStroke / 3.5;
    float s1 = streaks(param_4, param_5, param_6);
    float2 param_7 = (p / float2(4.0)) + float2(40.0);
    float param_8 = a + 0.300000011920928955078125;
    float param_9 = _289.uStroke / 4.0;
    float s2 = streaks(param_7, param_8, param_9);
    float deposit = d * (0.800000011920928955078125 + (0.4000000059604644775390625 * ((s1 + s2) - 1.0)));
    float2 param_10 = (fragCoord / float2(2.0)) + seed;
    int param_11 = 3;
    float _855 = fbm(param_10, param_11);
    float2 param_12 = fragCoord;
    float tooth = (0.699999988079071044921875 * _855) + (0.300000011920928955078125 * hash12(param_12));
    float ink = smoothstep(0.0, 1.0, deposit + (((0.5 - tooth) * _289.uTooth) * 0.699999988079071044921875));
    float _878;
    if (_289.uLine > 0.0)
    {
        float2 param_13 = uv;
        float2 param_14 = px * _289.uLine;
        _878 = inkEdge(uImage, uImageSmplr, param_13, param_14, _289);
    }
    else
    {
        _878 = 0.0;
    }
    float edge = _878;
    float line = smoothstep(0.1500000059604644775390625, 0.60000002384185791015625, edge) * (0.60000002384185791015625 + (0.4000000059604644775390625 * s1));
    float3 stick = mix(_289.uInk, fast::clamp(mix(float3(l), sm, float3(1.25)), float3(0.0), float3(1.0)), float3(_289.uColour));
    float3 paper = float3(_289.uPaper) * (1.0 - (0.0599999986588954925537109375 * tooth));
    float3 col = mix(paper, stick, float3(fast::clamp(ink, 0.0, 1.0)));
    col = mix(col, mix(_289.uInk, sm * 0.550000011920928955078125, float3(_289.uColour)), float3(fast::clamp(line, 0.0, 1.0)));
    fragColor = float4(col, pic.w);
}

fragment flair_image_charcoal_frag_out flair_image_charcoal_frag(constant FlairUniforms& _289 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_charcoal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _961;
    if (_289.flair_flipY > 0.5)
    {
        _961 = _289.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _961 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _961);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _289, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

