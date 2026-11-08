// flair-metal-hash: 51ab0d7d
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
    uint uAuto;
    float uProgress;
    float uCount;
    float uSpread;
    float uSpin;
    float3 uBackground;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

struct flair_image_shatter_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 shardSite(thread const float2& cell)
{
    float2 param = cell;
    return (cell + float2(0.1500000059604644775390625)) + (hash22(param) * 0.699999988079071044921875);
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
bool onShard(thread const float2& q, thread const float2& c)
{
    float2 base = floor(q);
    float2 off = c - base;
    bool _314 = abs(off.x) > 1.0;
    bool _322;
    if (!_314)
    {
        _322 = abs(off.y) > 1.0;
    }
    else
    {
        _322 = _314;
    }
    if (_322)
    {
        return false;
    }
    float2 param = c;
    float own = distance(q, shardSite(param));
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 n = base + float2(float(i), float(j));
            bool _363 = any(n != c);
            bool _373;
            if (_363)
            {
                float2 param_1 = n;
                _373 = distance(q, shardSite(param_1)) < own;
            }
            else
            {
                _373 = _363;
            }
            if (_373)
            {
                return false;
            }
        }
    }
    return true;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _132)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_132.uBackdrop) * _132.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_132.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _132)
{
    float4 _274;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _274 = overBackdrop(param, _132);
    }
    else
    {
        float2 param_1 = fract(uv);
        _274 = float4(testCard(param_1), 1.0);
    }
    return _274;
}

static inline __attribute__((always_inline))
float3 shardAt(thread const float2& q)
{
    float2 base = floor(q);
    float d1 = 1000000000.0;
    float d2 = 1000000000.0;
    float2 id = base;
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 c = base + float2(float(i), float(j));
            float2 param = c;
            float d = distance(q, shardSite(param));
            if (d < d1)
            {
                d2 = d1;
                d1 = d;
                id = c;
            }
            else
            {
                if (d < d2)
                {
                    d2 = d;
                }
            }
        }
    }
    return float3(id, d2 - d1);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _132, texture2d<float> uImage, sampler uImageSmplr)
{
    float _456;
    if (_132.uAuto != 0u)
    {
        _456 = smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, 0.5 - (0.5 * cos((_132.iTime * 6.28318023681640625) / 5.0)));
    }
    else
    {
        _456 = _132.uProgress;
    }
    float k = _456;
    float2 p = ((fragCoord - (float2(_132.iResolution[0], _132.iResolution[1]) * 0.5)) / float2(_132.iResolution[1u])) * _132.uCount;
    float grow = 1.0 + (_132.uSpread * k);
    float2 base = floor(p / float2(grow));
    float top = -1.0;
    float2 hitQ = float2(0.0);
    float hitA = 0.0;
    float slack = (0.60000002384185791015625 * k) + 1.25;
    float2 lo = fast::max(base - float2(2.0), ceil(((p - float2(slack)) / float2(grow)) - float2(0.85000002384185791015625)));
    float2 hi = fast::min(base + float2(2.0), floor(((p + float2(slack)) / float2(grow)) - float2(0.1500000059604644775390625)));
    for (int j = 0; j < 5; j++)
    {
        if ((lo.y + float(j)) > hi.y)
        {
            break;
        }
        for (int i = 0; i < 5; i++)
        {
            if ((lo.x + float(i)) > hi.x)
            {
                break;
            }
            float2 c = lo + float2(float(i), float(j));
            float2 param = c + float2(41.700000762939453125);
            float2 h = hash22(param);
            if (h.y <= top)
            {
                continue;
            }
            float2 param_1 = c;
            float2 site = shardSite(param_1);
            float2 centre = (site * grow) + (((h - float2(0.5)) * 1.2000000476837158203125) * k);
            float2 rel = p - centre;
            if (dot(rel, rel) > 1.5625)
            {
                continue;
            }
            float a = (((h.x - 0.5) * 2.0) * _132.uSpin) * k;
            float param_2 = -a;
            float2 q = (rot(param_2) * rel) + site;
            float2 param_3 = q;
            float2 param_4 = c;
            if (onShard(param_3, param_4))
            {
                top = h.y;
                hitQ = q;
                hitA = a;
            }
        }
    }
    float4 col = float4(_132.uBackground, _132.uBackdropAlpha);
    if (top > (-1.0))
    {
        float2 uv = (((hitQ / float2(_132.uCount)) * _132.iResolution[1u]) / float2(_132.iResolution[0], _132.iResolution[1])) + float2(0.5);
        float2 param_5 = uv;
        col = pictureRGBA(uImage, uImageSmplr, param_5, _132);
        float4 _712 = col;
        float3 _714 = _712.xyz * (1.0 - ((0.3499999940395355224609375 * k) * abs(sin(hitA))));
        col.x = _714.x;
        col.y = _714.y;
        col.z = _714.z;
        float2 param_6 = hitQ;
        float4 _730 = col;
        float3 _733 = _730.xyz + float3((k * 0.3499999940395355224609375) * smoothstep(0.0599999986588954925537109375, 0.0, shardAt(param_6).z));
        col.x = _733.x;
        col.y = _733.y;
        col.z = _733.z;
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
    float3 _784;
    if (a > 0.0)
    {
        _784 = bg + (d / float3(a));
    }
    else
    {
        _784 = bg;
    }
    float3 fg = _784;
    float alpha = a + (opacity * (1.0 - a));
    float3 _806;
    if (alpha > 0.0)
    {
        _806 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _806 = bg;
    }
    float3 col = _806;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _132, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _132, uImage, uImageSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _132.uBackground;
    float param_4 = _132.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_image_shatter_frag_out flair_image_shatter_frag(constant FlairUniforms& _132 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_shatter_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _862;
    if (_132.flair_flipY > 0.5)
    {
        _862 = _132.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _862 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _862);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _132, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

