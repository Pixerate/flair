// flair-metal-hash: 6a888020
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
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
    float uPump;
    float uRipple;
    float uSplash;
    float3 uTint;
    float3 uLightA;
    float3 uLightB;
    packed_float3 uBackground;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_liquid_chrome_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _102)
{
    bool _108 = _102.uDemo != 0u;
    bool _117;
    if (_108)
    {
        _117 = _102.iBeat == 0.0;
    }
    else
    {
        _117 = _108;
    }
    bool _128;
    if (_117)
    {
        _128 = dot(_102.iAudio, _102.iAudio) == 0.0;
    }
    else
    {
        _128 = _117;
    }
    return _128;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _102)
{
    return exp((-mod(_102.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _102)
{
    return exp((-mod(_102.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _102)
{
    if (!soundDemo(_102))
    {
        return _102.iAudio;
    }
    float k = demoKick(_102);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_102.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_102.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_102))) + (0.07999999821186065673828125 * sin(_102.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _102)
{
    float _208;
    if (soundDemo(_102))
    {
        _208 = mod(_102.iTime, 0.5);
    }
    else
    {
        _208 = _102.iBeat;
    }
    return _208;
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _102)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_102))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_102.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_102.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_102.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_102)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_102)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_102.iSpectrum[i / 4][spvSMod(i, 4)], _102.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float height(thread const float2& c, thread const float4& s, thread const float& b, thread const float& hit, constant FlairUniforms& _102)
{
    float r = length(c) / 0.4199999868869781494140625;
    float h = ((-0.119999997317790985107421875) * (1.0 - r)) + (0.0500000007450580596923828125 * exp(((-r) * r) / 0.0500000007450580596923828125));
    float pump = (((s.y - 0.449999988079071044921875) * 0.0900000035762786865234375) * _102.uPump) + (((hit * 0.039999999105930328369140625) * _102.uSplash) * cos(b * 38.0));
    h += (pump * (1.0 - smoothstep(0.0, 1.0, r)));
    for (int i = 0; i < 6; i++)
    {
        float x = (float(i) + 0.5) / 6.0;
        float param = x;
        float _395 = spectrum(param, _102);
        h += ((((_102.uRipple * 0.008000000379979610443115234375) * _395) * sin(((r * (14.0 + (22.0 * x))) - (_102.iTime * (5.0 + (6.0 * x)))) + (float(i) * 1.7000000476837158203125))) * (0.4000000059604644775390625 + r));
    }
    h += (((((_102.uRipple * 0.0040000001899898052215576171875) * s.w) * sin((precise::atan2(c.y, c.x) * 7.0) + (_102.iTime * 3.0))) * sin((r * 30.0) - (_102.iTime * 9.0))) * r);
    if (b >= 0.0)
    {
        h += (((_102.uSplash * 0.02999999932944774627685546875) * exp((-b) * 3.0)) * exp(-powr((r - (b * 2.2000000476837158203125)) / 0.0599999986588954925537109375, 2.0)));
    }
    return h;
}

static inline __attribute__((always_inline))
float3 studio(thread const float3& d, constant FlairUniforms& _102)
{
    float3 c = (float3(_102.uBackground) * 0.60000002384185791015625) + (float3(0.0599999986588954925537109375) * ((d.y * 0.5) + 0.5));
    c += ((float3(1.7999999523162841796875) * smoothstep(0.319999992847442626953125, 0.20000000298023223876953125, abs(d.x + 0.100000001490116119384765625))) * smoothstep(0.119999997317790985107421875, 0.300000011920928955078125, d.y));
    c += ((_102.uLightA * 1.7999999523162841796875) * smoothstep(0.100000001490116119384765625, 0.02999999932944774627685546875, abs((d.x - 0.4199999868869781494140625) + (0.1500000059604644775390625 * d.y))));
    c += (((_102.uLightB * 1.7999999523162841796875) * smoothstep(0.100000001490116119384765625, 0.02999999932944774627685546875, abs((d.x + 0.449999988079071044921875) - (0.100000001490116119384765625 * d.y)))) * smoothstep(-0.699999988079071044921875, 0.100000001490116119384765625, d.y));
    c += ((mix(_102.uLightA, _102.uLightB, float3(0.5)) * 0.449999988079071044921875) * smoothstep(-0.100000001490116119384765625, -0.5, d.y));
    return c;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _102)
{
    float px = 1.0 / _102.iResolution[1u];
    float2 c = (fragCoord - (float2(_102.iResolution[0], _102.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_102);
    float b = beat(_102);
    float _594;
    if (b >= 0.0)
    {
        _594 = exp((-b) * 5.0);
    }
    else
    {
        _594 = 0.0;
    }
    float hit = _594;
    float r = length(c) / 0.4199999868869781494140625;
    float3 view = fast::normalize(float3(c * 1.39999997615814208984375, -1.0));
    float3 col = float3(_102.uBackground) * (1.0 - (0.5 * length(c)));
    col *= (1.0 - (0.699999988079071044921875 * exp((-fast::max(r - 1.12000000476837158203125, 0.0)) * 8.0)));
    if (r < 1.12000000476837158203125)
    {
        float3 n;
        float3 tint;
        if (r < 1.0)
        {
            float e = 2.0 * px;
            float2 param = c;
            float4 param_1 = s;
            float param_2 = b;
            float param_3 = hit;
            float h = height(param, param_1, param_2, param_3, _102);
            float2 param_4 = c + float2(e, 0.0);
            float4 param_5 = s;
            float param_6 = b;
            float param_7 = hit;
            float2 param_8 = c + float2(0.0, e);
            float4 param_9 = s;
            float param_10 = b;
            float param_11 = hit;
            n = fast::normalize(float3((-(height(param_4, param_5, param_6, param_7, _102) - h)) / e, (-(height(param_8, param_9, param_10, param_11, _102) - h)) / e, 1.0));
            tint = _102.uTint;
        }
        else
        {
            float x = (r - 1.059999942779541015625) / 0.0599999986588954925537109375;
            n = fast::normalize(float3(fast::normalize(c) * x, sqrt(fast::max(1.0 - (x * x), 0.0)) + 0.0500000007450580596923828125));
            tint = float3(0.119999997317790985107421875);
        }
        float3 ref = reflect(view, n);
        float fresnel = powr(1.0 - fast::max(dot(-view, n), 0.0), 5.0);
        float3 param_12 = ref;
        float3 surface = (studio(param_12, _102) * tint) * (0.64999997615814208984375 + (0.3499999940395355224609375 * fresnel));
        col = mix(col, surface, float3(fast::clamp(((1.12000000476837158203125 - r) * 0.4199999868869781494140625) / px, 0.0, 1.0)));
    }
    bool _756 = (b >= 0.0) && (b < 0.699999988079071044921875);
    bool _762;
    if (_756)
    {
        _762 = _102.uSplash > 0.0;
    }
    else
    {
        _762 = _756;
    }
    if (_762)
    {
        float seed = floor((_102.iTime - b) * 8.0);
        float up = ((4.0 * b) * (0.699999988079071044921875 - b)) / 0.4900000095367431640625;
        for (int i = 0; i < 10; i++)
        {
            float2 param_13 = float2(float(i) * 3.099999904632568359375, seed);
            float2 hh = hash22(param_13);
            float ang = (6.28318023681640625 * (float(i) + hh.x)) / 10.0;
            float2 at = float2(cos(ang), sin(ang)) * ((0.4199999868869781494140625 * (0.300000011920928955078125 + (0.20000000298023223876953125 * hh.y))) + ((((0.25 + (0.3499999940395355224609375 * hh.y)) * b) * _102.uSplash) * (0.60000002384185791015625 + s.y)));
            float rad = ((0.006000000052154064178466796875 + (0.008000000379979610443115234375 * hh.y)) * (1.0 + (1.5 * up))) * fast::min(_102.uSplash, 1.0);
            float2 q = (c - at) / float2(rad);
            float qq = dot(q, q);
            if (qq < 1.0)
            {
                float3 dn = float3(q, sqrt(1.0 - qq));
                float3 param_14 = reflect(view, dn);
                col = mix(col, studio(param_14, _102) * _102.uTint, float3(fast::clamp(((1.0 - sqrt(qq)) * rad) / px, 0.0, 1.0)));
            }
        }
    }
    fragColor = float4(col, 1.0);
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
    float3 _942;
    if (a > 0.0)
    {
        _942 = bg + (d / float3(a));
    }
    else
    {
        _942 = bg;
    }
    float3 fg = _942;
    float alpha = a + (opacity * (1.0 - a));
    float3 _964;
    if (alpha > 0.0)
    {
        _964 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _964 = bg;
    }
    float3 col = _964;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _102)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _102);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_102.uBackground);
    float param_4 = _102.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_liquid_chrome_frag_out flair_liquid_chrome_frag(constant FlairUniforms& _102 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_liquid_chrome_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1021;
    if (_102.flair_flipY > 0.5)
    {
        _1021 = _102.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1021 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1021);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _102);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

