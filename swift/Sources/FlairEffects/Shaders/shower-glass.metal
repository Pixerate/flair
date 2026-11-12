// flair-metal-hash: 8e5707c6
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
    uint uRain;
    float uScale;
    float uRefraction;
    float uBlur;
    float uDim;
    float uHighlight;
    float uFlow;
    float uDispersion;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_shower_glass_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float pebbles(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float d = 8.0;
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            float2 g = float2(float(x), float(y));
            float2 param = i + g;
            float2 o = float2(0.1500000059604644775390625) + (hash22(param) * 0.699999988079071044921875);
            d = fast::min(d, length((g + o) - f));
        }
    }
    return 1.0 - smoothstep(0.0, 0.75, d);
}

static inline __attribute__((always_inline))
float height(thread const float2& p, constant FlairUniforms& _227)
{
    float t = _227.iTime * _227.uFlow;
    if (_227.uRain != 0u)
    {
        float2 param = float2(p.x * 2.5, (p.y * 0.300000011920928955078125) + (t * 2.0));
        float streak = vnoise(param);
        float2 param_1 = (p * 1.7000000476837158203125) + float2(0.0, t * 3.0);
        return (0.550000011920928955078125 * streak) + (0.449999988079071044921875 * pebbles(param_1));
    }
    float2 param_2 = p * 0.699999988079071044921875;
    float2 param_3 = (p + float2(0.0, t)) + float2(0.300000011920928955078125 * vnoise(param_2));
    return pebbles(param_3);
}

static inline __attribute__((always_inline))
float3 spectrum(thread const float& x)
{
    float3 d = (float3(x) - float3(0.20000000298023223876953125, 0.5, 0.800000011920928955078125)) / float3(0.300000011920928955078125);
    float3 c = fast::clamp(float3(1.0) - (d * d), float3(0.0), float3(1.0));
    c.x += (0.3499999940395355224609375 * fast::clamp(1.0 - (((x - 0.949999988079071044921875) * (x - 0.949999988079071044921875)) / 0.022500000894069671630859375), 0.0, 1.0));
    return c;
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
    float4 _367;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _367 = overBackdrop(param, _227);
    }
    else
    {
        float2 param_1 = fract(uv);
        _367 = float4(testCard(param_1), 1.0);
    }
    return _367;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _227, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 p = (fragCoord / float2(_227.iResolution[1u])) * _227.uScale;
    float e = 0.02999999932944774627685546875;
    float2 param = p + float2(e, 0.0);
    float2 param_1 = p - float2(e, 0.0);
    float2 param_2 = p + float2(0.0, e);
    float2 param_3 = p - float2(0.0, e);
    float2 grad = float2(height(param, _227) - height(param_1, _227), height(param_2, _227) - height(param_3, _227)) / float2(2.0 * e);
    float2 uv = (fragCoord / float2(_227.iResolution[0], _227.iResolution[1])) - ((grad * _227.uRefraction) * 0.0199999995529651641845703125);
    float blur = _227.uBlur * 0.01200000010430812835693359375;
    float2 param_4 = fragCoord;
    float spin = hash12(param_4) * 6.28318023681640625;
    float2 split = (((-grad) * _227.uRefraction) * 0.00999999977648258209228515625) * _227.uDispersion;
    float3 sum = float3(0.0);
    float3 weight = float3(0.0);
    float alpha = 0.0;
    float3 _616;
    for (int i = 0; i < 8; i++)
    {
        float fi = float(i);
        float ang = (fi * 2.399960041046142578125) + spin;
        float x = (fi + 0.5) / 8.0;
        if (_227.uDispersion > 0.0)
        {
            float param_5 = x;
            _616 = spectrum(param_5);
        }
        else
        {
            _616 = float3(1.0);
        }
        float3 w = _616;
        float2 param_6 = (uv + (split * (x - 0.5))) + (float2((cos(ang) * _227.iResolution[1u]) / _227.iResolution[0u], sin(ang)) * (blur * sqrt((fi + 0.5) / 8.0)));
        float4 c = pictureRGBA(uImage, uImageSmplr, param_6, _227);
        sum += (c.xyz * w);
        weight += w;
        alpha += c.w;
    }
    float4 pic = float4(sum / weight, alpha / 8.0);
    float3 n = fast::normalize(float3((-grad) * 0.119999997317790985107421875, 1.0));
    float3 h = float3(-0.282984793186187744140625, 0.3395817577838897705078125, 0.896997153759002685546875);
    float spec = powr(fast::max(dot(n, h), 0.0), 60.0);
    float rim = fast::clamp(dot(n.xy, float2(-0.60000002384185791015625, 0.60000002384185791015625)) * 2.0, -1.0, 1.0);
    float3 col = ((pic.xyz * (1.0 - _227.uDim)) * (1.0 + ((0.119999997317790985107421875 * rim) * _227.uHighlight))) + float3((spec * _227.uHighlight) * 0.800000011920928955078125);
    fragColor = float4(col, pic.w);
}

fragment flair_shower_glass_frag_out flair_shower_glass_frag(constant FlairUniforms& _227 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_shower_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _751;
    if (_227.flair_flipY > 0.5)
    {
        _751 = _227.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _751 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _751);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _227, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

