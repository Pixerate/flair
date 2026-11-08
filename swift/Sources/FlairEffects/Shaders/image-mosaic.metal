// flair-metal-hash: 00e542de
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
    int uShape;
    float uSize;
    uint uAuto;
    float uProgress;
    float3 uBackground;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

struct flair_image_mosaic_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void hexTile(thread const float2& p, thread float2& h, thread float2& centre)
{
    float2 s = float2(1.0, 1.73205077648162841796875);
    float2 a = (floor(p / s) + float2(0.5)) * s;
    float2 b = (floor((p - (s * 0.5)) / s) + float2(1.0)) * s;
    centre = select(b, a, bool2(dot(p - a, p - a) < dot(p - b, p - b)));
    h = p - centre;
}

static inline __attribute__((always_inline))
void triTile(thread const float2& p, thread float2& h, thread float2& centre, thread float& up)
{
    float2 q = float2(p.x - (p.y * 0.577350318431854248046875), p.y * 1.1547005176544189453125);
    float2 cell = floor(q);
    float2 f = q - cell;
    up = ((f.x + f.y) < 1.0) ? 1.0 : (-1.0);
    float2 cq = cell + select(float2(0.666666686534881591796875), float2(0.3333333432674407958984375), bool2(up > 0.0));
    centre = float2(cq.x + (cq.y * 0.5), cq.y * 0.866025388240814208984375);
    h = p - centre;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float hexEdge(thread float2& h)
{
    h = abs(h);
    return fast::max(h.x, dot(h, float2(0.5, 0.866025388240814208984375))) * 2.0;
}

static inline __attribute__((always_inline))
float triEdge(thread float2& h, thread const float& up)
{
    h *= up;
    float e = fast::max(-h.y, fast::max(dot(h, float2(0.866025388240814208984375, 0.5)), dot(h, float2(-0.866025388240814208984375, 0.5))));
    return e / 0.2886750996112823486328125;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _118)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_118.uBackdrop) * _118.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_118.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _118)
{
    float4 _260;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _260 = overBackdrop(param, _118);
    }
    else
    {
        float2 param_1 = fract(uv);
        _260 = float4(testCard(param_1), 1.0);
    }
    return _260;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _118, texture2d<float> uImage, sampler uImageSmplr)
{
    float _420;
    if (_118.uAuto != 0u)
    {
        _420 = smoothstep(0.0500000007450580596923828125, 0.949999988079071044921875, 0.5 - (0.5 * cos((_118.iTime * 6.28318023681640625) / 6.0)));
    }
    else
    {
        _420 = _118.uProgress;
    }
    float k = _420;
    float2 p = fragCoord / float2(_118.uSize);
    float up = 1.0;
    float2 h;
    float2 centre;
    if (_118.uShape == 0)
    {
        float2 param = p;
        float2 param_1;
        float2 param_2;
        hexTile(param, param_1, param_2);
        h = param_1;
        centre = param_2;
    }
    else
    {
        float2 param_3 = p;
        float2 param_4;
        float2 param_5;
        float param_6;
        triTile(param_3, param_4, param_5, param_6);
        h = param_4;
        centre = param_5;
        up = param_6;
    }
    float2 param_7 = centre * 7.309999942779541015625;
    float start = (((centre.x * _118.uSize) / _118.iResolution[0u]) * 0.75) + (hash12(param_7) * 0.1500000059604644775390625);
    float flip = smoothstep(0.0, 1.0, fast::clamp(((k * 1.35000002384185791015625) - start) / 0.3499999940395355224609375, 0.0, 1.0));
    float squash = abs(cos(flip * 3.1415927410125732421875));
    float2 hf = float2(h.x / fast::max(squash, 0.001000000047497451305389404296875), h.y);
    float _522;
    if (_118.uShape == 0)
    {
        float2 param_8 = hf;
        float _527 = hexEdge(param_8);
        _522 = _527;
    }
    else
    {
        float2 param_9 = hf;
        float param_10 = up;
        float _533 = triEdge(param_9, param_10);
        _522 = _533;
    }
    float e = _522;
    float gap = 0.100000001490116119384765625 * (1.0 - flip);
    float4 col = float4(_118.uBackground * 0.60000002384185791015625, _118.uBackdropAlpha);
    if (e < ((1.0 - gap) + 0.001000000047497451305389404296875))
    {
        float4 _562;
        if (flip < 0.5)
        {
            float2 param_11 = centre * 3.1700000762939453125;
            _562 = float4((_118.uBackground * (0.89999997615814208984375 + (0.20000000298023223876953125 * hash12(param_11)))) + float3(0.039999999105930328369140625), _118.uBackdropAlpha);
        }
        else
        {
            float2 param_12 = ((centre + hf) * _118.uSize) / float2(_118.iResolution[0], _118.iResolution[1]);
            _562 = pictureRGBA(uImage, uImageSmplr, param_12, _118);
        }
        float4 face = _562;
        col = float4(face.xyz * (0.5 + (0.5 * squash)), face.w);
    }
    fragColor = col;
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _656;
    if (a > 0.0)
    {
        _656 = bg + (d / float3(a));
    }
    else
    {
        _656 = bg;
    }
    float3 fg = _656;
    float alpha = a + (opacity * (1.0 - a));
    float3 _678;
    if (alpha > 0.0)
    {
        _678 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _678 = bg;
    }
    float3 col = _678;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _118, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _118, uImage, uImageSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _118.uBackground;
    float param_4 = _118.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_image_mosaic_frag_out flair_image_mosaic_frag(constant FlairUniforms& _118 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_mosaic_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _735;
    if (_118.flair_flipY > 0.5)
    {
        _735 = _118.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _735 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _735);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _118, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

