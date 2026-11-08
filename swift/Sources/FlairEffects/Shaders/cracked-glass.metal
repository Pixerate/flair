// flair-metal-hash: 77e5b048
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
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
    uint uDemo;
    float2 uCentre;
    int uRays;
    float uRings;
    float uReach;
    float uShift;
    float uCrackLight;
    float uDispersion;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_cracked_glass_frag_out
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
float web(thread const float2& q, thread const float& reach, thread const float& seed, thread float2& shift, thread float& shade, constant FlairUniforms& _237)
{
    float r = length(q);
    bool _485 = reach <= 0.0;
    bool _494;
    if (!_485)
    {
        _494 = r > (reach * 1.2000000476837158203125);
    }
    else
    {
        _494 = _485;
    }
    if (_494)
    {
        return 0.0;
    }
    float n = float(_237.uRays);
    float a = ((precise::atan2(q.y, q.x) / 6.28318023681640625) + 0.5) + ((((0.0024999999441206455230712890625 * sin((r * 30.0) + seed)) + (0.00120000005699694156646728515625 * sin((r * 90.0) - seed))) * 14.0) / float(_237.uRays));
    float k = (a * n) + seed;
    float sector = floor(k);
    float fr = fract(k);
    float arc = (r * 6.28318023681640625) / n;
    float width = 0.0010999999940395355224609375 + (0.00200000009499490261077880859375 * exp((-r) * 12.0));
    float2 param = float2(sector, seed);
    float lenLo = reach * (0.5 + (0.5 * hash12(param)));
    float2 param_1 = float2(sector + 1.0, seed);
    float lenHi = reach * (0.5 + (0.5 * hash12(param_1)));
    float lines = smoothstep(width * 2.0, 0.0, fr * arc) * smoothstep(lenLo, lenLo * 0.60000002384185791015625, r);
    lines = fast::max(lines, smoothstep(width * 2.0, 0.0, (1.0 - fr) * arc) * smoothstep(lenHi, lenHi * 0.60000002384185791015625, r));
    float g = 0.550000011920928955078125;
    float2 param_2 = float2(sector, seed + 3.0);
    float band = (log(fast::max(r, 9.9999997473787516355514526367188e-05) / 0.02999999932944774627685546875) / g) + (0.60000002384185791015625 * hash12(param_2));
    float ring = floor(band);
    float fb = fract(band);
    float dr = (r * g) * fast::min(fb, 1.0 - fb);
    float2 param_3 = float2((sector * 7.0) + ring, seed);
    float shown = step(hash12(param_3), _237.uRings) * smoothstep(reach, reach * 0.699999988079071044921875, r);
    lines = fast::max(lines, (smoothstep(width * 2.0, 0.0, dr) * shown) * step(0.02999999932944774627685546875, r));
    float2 param_4 = (q * 500.0) + float2(seed);
    lines = fast::max(lines, smoothstep(0.0350000001490116119384765625, 0.0, r) * smoothstep(0.449999988079071044921875, 0.699999988079071044921875, vnoise(param_4)));
    float2 id = float2(sector, ring + (seed * 7.0));
    float fall = smoothstep(reach, 0.0, r);
    float2 param_5 = id;
    shift += ((((hash22(param_5) - float2(0.5)) * _237.uShift) * 0.01200000010430812835693359375) * fall);
    float2 param_6 = id + float2(0.5);
    shade += (((hash12(param_6) - 0.5) * 0.180000007152557373046875) * fall);
    return lines;
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _237)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_237.uBackdrop) * _237.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_237.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _237)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _237.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _237);
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
float4 dispersed(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& shift, thread const float& blurPx, constant FlairUniforms& _237)
{
    if (dot(shift, shift) < 9.9999999600419720025001879548654e-13)
    {
        float2 param = uv;
        float param_1 = blurPx;
        return pictureBlurRGBA(tex, texSmplr, param, param_1, _237);
    }
    float3 sum = float3(0.0);
    float3 weight = float3(0.0);
    float alpha = 0.0;
    for (int i = 0; i < 5; i++)
    {
        float x = (float(i) + 0.5) / 5.0;
        float param_2 = x;
        float3 w = spectrum(param_2);
        float2 param_3 = uv + (shift * (x - 0.5));
        float param_4 = blurPx;
        float4 c = pictureBlurRGBA(tex, texSmplr, param_3, param_4, _237);
        sum += (c.xyz * w);
        weight += w;
        alpha += c.w;
    }
    return float4(sum / weight, alpha / 5.0);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _237, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _237.iResolution[1u];
    float2 p = fragCoord * px;
    float2 shift = float2(0.0);
    float shade = 0.0;
    float lines = 0.0;
    if (_237.uDemo != 0u)
    {
        float t = mod(_237.iTime, 5.0);
        float reach = (_237.uReach * smoothstep(0.0, 0.3499999940395355224609375, t)) * (1.0 - smoothstep(4.5, 5.0, t));
        float2 param = p - ((_237.uCentre * float2(_237.iResolution[0], _237.iResolution[1])) * px);
        float param_1 = reach;
        float param_2 = 1.0;
        float2 param_3 = shift;
        float param_4 = shade;
        float _791 = web(param, param_1, param_2, param_3, param_4, _237);
        shift = param_3;
        shade = param_4;
        lines = fast::max(lines, _791);
    }
    for (int i = 0; i < 8; i++)
    {
        if (_237.iClicks[i].w < 0.5)
        {
            break;
        }
        float age = _237.iTime - _237.iClicks[i].z;
        float seed = (fract(_237.iClicks[i].z * 0.617999970912933349609375) * 40.0) + 2.0;
        float2 param_5 = p - (_237.iClicks[i].xy * px);
        float param_6 = (_237.uReach * 0.800000011920928955078125) * smoothstep(0.0, 0.300000011920928955078125, age);
        float param_7 = seed;
        float2 param_8 = shift;
        float param_9 = shade;
        float _851 = web(param_5, param_6, param_7, param_8, param_9, _237);
        shift = param_8;
        shade = param_9;
        lines = fast::max(lines, _851);
    }
    float2 uv = (fragCoord / float2(_237.iResolution[0], _237.iResolution[1])) + (shift * float2(_237.iResolution[1u] / _237.iResolution[0u], 1.0));
    float2 param_10 = uv;
    float2 param_11 = ((shift * _237.uDispersion) * 4.0) * float2(_237.iResolution[1u] / _237.iResolution[0u], 1.0);
    float param_12 = 1.0;
    float4 seen = dispersed(uImage, uImageSmplr, param_10, param_11, param_12, _237);
    float3 col = seen.xyz * (1.0 + shade);
    col = mix(col, float3(0.949999988079071044921875), float3((lines * _237.uCrackLight) * 0.85000002384185791015625));
    float param_13 = fract((p.x * 2.0) + (p.y * 3.0));
    col += ((((spectrum(param_13) - float3(0.449999988079071044921875)) * lines) * _237.uDispersion) * 0.4000000059604644775390625);
    fragColor = float4(col, seen.w);
}

fragment flair_cracked_glass_frag_out flair_cracked_glass_frag(constant FlairUniforms& _237 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_cracked_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _949;
    if (_237.flair_flipY > 0.5)
    {
        _949 = _237.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _949 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _949);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _237, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

