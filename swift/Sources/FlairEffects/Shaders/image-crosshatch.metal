// flair-metal-hash: 84018b17
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
    int uStyle;
    float uSpacing;
    float uAngle;
    float uContrast;
    float uLine;
    float uThreshold;
    float uWobble;
    float3 uInk;
    packed_float3 uPaper;
    float uBoil;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_crosshatch_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _236)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _380 = ts.x <= 1;
    bool _387;
    if (!_380)
    {
        _387 = ts.y <= 1;
    }
    else
    {
        _387 = _380;
    }
    bool _394;
    if (!_387)
    {
        _394 = _236.iResolution[0u] <= 0.0;
    }
    else
    {
        _394 = _387;
    }
    bool _401;
    if (!_394)
    {
        _401 = _236.iResolution[1u] <= 0.0;
    }
    else
    {
        _401 = _394;
    }
    if (_401)
    {
        return uv;
    }
    float boxAspect = _236.iResolution[0u] / _236.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _424;
    if (boxAspect > texAspect)
    {
        _424 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _424 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _424;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _236)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_236.uBackdrop) * _236.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_236.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _236)
{
    float4 _451;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _451 = overBackdrop(param, _236);
    }
    else
    {
        float2 param_1 = fract(uv);
        _451 = float4(testCard(param_1), 1.0);
    }
    return _451;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 boilSeed(constant FlairUniforms& _236)
{
    float2 _610;
    if (_236.uBoil > 0.0)
    {
        float2 param = float2(floor(_236.iTime * _236.uBoil), 7.099999904632568359375);
        _610 = hash22(param) * 300.0;
    }
    else
    {
        _610 = float2(0.0);
    }
    return _610;
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
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _236)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _236).xyz;
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float darkness(thread const float2& uv, constant FlairUniforms& _236, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float3 param_1 = picture(uImage, uImageSmplr, param, _236);
    return fast::clamp(((0.5 - luma(param_1)) * _236.uContrast) + 0.5, 0.0, 1.0);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float lines(thread const float2& p, thread const float& a, thread const float& spacing, thread const float& halfWidth)
{
    float f = abs(fract(dot(p, float2(cos(a), sin(a))) / spacing) - 0.5) * spacing;
    return 1.0 - smoothstep(halfWidth - 0.60000002384185791015625, halfWidth + 0.60000002384185791015625, f);
}

static inline __attribute__((always_inline))
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _236)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _236);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _236)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _236);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _236);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _236);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _236);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _236);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _236);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _236);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _236);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _236, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_236.iResolution[0], _236.iResolution[1]);
    float2 uv = fitCoverUV(uImage, uImageSmplr, param, _236);
    float2 px = float2(1.0) / float2(_236.iResolution[0], _236.iResolution[1]);
    float2 param_1 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_1, _236);
    float2 seed = boilSeed(_236);
    float2 param_2 = (fragCoord / float2(30.0)) + seed;
    float2 param_3 = ((fragCoord / float2(30.0)) + seed) + float2(13.0);
    float2 p = fragCoord + (((float2(vnoise(param_2), vnoise(param_3)) - float2(0.5)) * _236.uWobble) * _236.uSpacing);
    float a = radians(_236.uAngle);
    float ink = 0.0;
    if (_236.uStyle == 1)
    {
        float _797;
        for (int g = 0; g < 2; g++)
        {
            float2 o = float2(float(g) * 0.5) * _236.uSpacing;
            float2 cell = floor((p + o) / float2(_236.uSpacing));
            float2 param_4 = (cell + seed) + float2(float(g) * 7.0);
            float2 centre = (((cell + float2(0.25)) + (hash22(param_4) * 0.5)) * _236.uSpacing) - o;
            float2 param_5 = ((centre + fragCoord) - p) * px;
            float d = darkness(param_5, _236, uImage, uImageSmplr);
            if (g == 0)
            {
                _797 = smoothstep(0.0599999986588954925537109375, 0.64999997615814208984375, d);
            }
            else
            {
                _797 = (d - 0.5) * 2.0;
            }
            float chance = _797;
            float2 param_6 = ((cell + seed) + float2(11.0)) + float2(float(g) * 5.0);
            float on = step(hash12(param_6), chance);
            float r = _236.uSpacing * (0.1599999964237213134765625 + (0.23999999463558197021484375 * d));
            ink = fast::max(ink, on * (1.0 - smoothstep(r - 0.60000002384185791015625, r + 0.60000002384185791015625, length(p - centre))));
        }
    }
    else
    {
        if (_236.uStyle == 2)
        {
            float2 param_7 = uv;
            float d_1 = darkness(param_7, _236, uImage, uImageSmplr);
            float broad = 0.0;
            for (int i = 0; i < 4; i++)
            {
                float b = float(i) * 1.57079994678497314453125;
                float2 param_8 = uv + ((float2(cos(b), sin(b)) * 6.0) * px);
                float3 param_9 = picture(uImage, uImageSmplr, param_8, _236);
                broad += luma(param_9);
            }
            float param_10 = -a;
            float2 q = rot(param_10) * p;
            float v = (q.y + ((((broad * 0.25) - 0.5) * _236.uSpacing) * 1.5)) / _236.uSpacing;
            float f = abs(fract(v) - 0.5) * 2.0;
            float aa = 1.2000000476837158203125 / _236.uSpacing;
            ink = (1.0 - smoothstep((d_1 * 0.949999988079071044921875) - aa, (d_1 * 0.949999988079071044921875) + aa, f)) * smoothstep(0.02999999932944774627685546875, 0.119999997317790985107421875, d_1);
            float2 param_11 = p;
            float param_12 = a + 1.57079994678497314453125;
            float param_13 = _236.uSpacing;
            float param_14 = _236.uSpacing * 0.180000007152557373046875;
            ink = fast::max(ink, lines(param_11, param_12, param_13, param_14) * smoothstep(0.75, 0.85000002384185791015625, d_1));
        }
        else
        {
            float2 param_15 = uv;
            float d_2 = darkness(param_15, _236, uImage, uImageSmplr);
            float _991;
            float _997;
            for (int i_1 = 0; i_1 < 4; i_1++)
            {
                float fi = float(i_1);
                float k = smoothstep(0.1500000059604644775390625 + (0.20000000298023223876953125 * fi), 0.25 + (0.20000000298023223876953125 * fi), d_2);
                if (i_1 == 1)
                {
                    _991 = 1.57079994678497314453125;
                }
                else
                {
                    if (i_1 == 2)
                    {
                        _997 = -0.785399973392486572265625;
                    }
                    else
                    {
                        _997 = (i_1 == 3) ? 0.785399973392486572265625 : 0.0;
                    }
                    _991 = _997;
                }
                float dir = a + _991;
                float2 param_16 = p + float2(fi * 1.7000000476837158203125);
                float param_17 = dir;
                float param_18 = _236.uSpacing;
                float param_19 = 0.449999988079071044921875 + (0.3499999940395355224609375 * k);
                ink = fast::max(ink, k * lines(param_16, param_17, param_18, param_19));
            }
        }
    }
    float _1040;
    if (_236.uLine > 0.0)
    {
        float2 param_20 = uv;
        float2 param_21 = px * _236.uLine;
        _1040 = inkEdge(uImage, uImageSmplr, param_20, param_21, _236);
    }
    else
    {
        _1040 = 0.0;
    }
    float edge = _1040;
    ink = fast::max(ink, smoothstep(_236.uThreshold, _236.uThreshold + 0.100000001490116119384765625, edge));
    float2 param_22 = fragCoord;
    float3 paper = float3(_236.uPaper) * (1.0 - (0.039999999105930328369140625 * hash12(param_22)));
    fragColor = float4(mix(paper, _236.uInk, float3(ink)), pic.w);
}

fragment flair_image_crosshatch_frag_out flair_image_crosshatch_frag(constant FlairUniforms& _236 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_crosshatch_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1099;
    if (_236.flair_flipY > 0.5)
    {
        _1099 = _236.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1099 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1099);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _236, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

