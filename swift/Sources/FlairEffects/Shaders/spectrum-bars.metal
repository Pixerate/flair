// flair-metal-hash: 8c419d79
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
    int uBars;
    float uGap;
    float uGain;
    float3 uColorLow;
    float3 uColorHigh;
    packed_float3 uBackground;
    uint uMirror;
    uint uPeaks;
    float uRound;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_spectrum_bars_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _60)
{
    bool _66 = _60.uDemo != 0u;
    bool _75;
    if (_66)
    {
        _75 = _60.iBeat == 0.0;
    }
    else
    {
        _75 = _66;
    }
    bool _86;
    if (_75)
    {
        _86 = dot(_60.iAudio, _60.iAudio) == 0.0;
    }
    else
    {
        _86 = _75;
    }
    return _86;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _60)
{
    return exp((-mod(_60.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _60)
{
    return exp((-mod(_60.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _60)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_60))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_60.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_60.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_60.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_60)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_60)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_60.iSpectrum[i / 4][spvSMod(i, 4)], _60.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float box(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 q = (abs(p) - hs) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _60)
{
    float _112;
    if (soundDemo(_60))
    {
        _112 = mod(_60.iTime, 0.5);
    }
    else
    {
        _112 = _60.iBeat;
    }
    return _112;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _60)
{
    float2 uv = fragCoord / float2(_60.iResolution[0], _60.iResolution[1]);
    float px = 1.0 / _60.iResolution[1u];
    float n = float(_60.uBars);
    float x = (uv.x - 0.0599999986588954925537109375) / 0.87999999523162841796875;
    float base = (_60.uMirror != 0u) ? 0.5 : 0.119999997317790985107421875;
    float room = (_60.uMirror != 0u) ? 0.4000000059604644775390625 : 0.7799999713897705078125;
    float cell = floor(x * n);
    float within = fract(x * n);
    float3 col = float3(_60.uBackground) * (1.0 + (0.25 * (1.0 - uv.y)));
    if ((x >= 0.0) && (x < 1.0))
    {
        float param = (cell + 0.5) / n;
        float _323 = spectrum(param, _60);
        float v = fast::clamp(_323 * _60.uGain, 0.0, 1.0);
        float h = fast::max(v * room, 2.0 * px);
        float barW = (((1.0 - _60.uGap) * 0.87999999523162841796875) * _60.iResolution[0u]) / n;
        float2 p = float2((((within - 0.5) * 0.87999999523162841796875) * _60.iResolution[0u]) / n, (uv.y - base) * _60.iResolution[1u]);
        float _369;
        if (_60.uMirror != 0u)
        {
            _369 = abs(p.y);
        }
        else
        {
            _369 = p.y;
        }
        float sideY = _369;
        float r = (_60.uRound * barW) * 0.5;
        float2 param_1 = float2(p.x, sideY - ((h * 0.5) * _60.iResolution[1u]));
        float2 param_2 = float2(barW * 0.5, (h * 0.5) * _60.iResolution[1u]);
        float param_3 = r;
        float d = box(param_1, param_2, param_3);
        float body = fast::clamp(0.5 - d, 0.0, 1.0);
        float along = fast::clamp(sideY / (room * _60.iResolution[1u]), 0.0, 1.0);
        float3 bar = mix(_60.uColorLow, _60.uColorHigh, float3(along));
        float halo = (exp((-fast::max(d, 0.0)) / (barW * 0.60000002384185791015625)) * 0.25) * v;
        col += (bar * halo);
        col = mix(col, bar * (0.85000002384185791015625 + (0.300000011920928955078125 * v)), float3(body));
        if (_60.uPeaks != 0u)
        {
            float b = beat(_60);
            float _470;
            if (b >= 0.0)
            {
                _470 = fast::max(0.0, 1.0 - (b * 3.0));
            }
            else
            {
                _470 = 0.0;
            }
            float kick = _470;
            float lift = 0.0350000001490116119384765625 + (((0.119999997317790985107421875 * v) * kick) * kick);
            float capY = (h + (lift * room)) * _60.iResolution[1u];
            float2 param_4 = float2(p.x, sideY - capY);
            float2 param_5 = float2(barW * 0.5, fast::max(2.0, 0.008000000379979610443115234375 * _60.iResolution[1u]));
            float param_6 = r * 0.4000000059604644775390625;
            float cap = box(param_4, param_5, param_6);
            col = mix(col, mix(bar, float3(1.0), float3(0.60000002384185791015625)), float3(fast::clamp(0.5 - cap, 0.0, 1.0)));
        }
        bool _532 = !(_60.uMirror != 0u);
        bool _538;
        if (_532)
        {
            _538 = p.y < 0.0;
        }
        else
        {
            _538 = _532;
        }
        if (_538)
        {
            float2 param_7 = float2(p.x, (-p.y) - ((h * 0.5) * _60.iResolution[1u]));
            float2 param_8 = float2(barW * 0.5, (h * 0.5) * _60.iResolution[1u]);
            float param_9 = r;
            float rd = box(param_7, param_8, param_9);
            col = mix(col, bar, float3((fast::clamp(0.5 - rd, 0.0, 1.0) * 0.180000007152557373046875) * exp(p.y / (0.0599999986588954925537109375 * _60.iResolution[1u]))));
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
    float3 _634;
    if (a > 0.0)
    {
        _634 = bg + (d / float3(a));
    }
    else
    {
        _634 = bg;
    }
    float3 fg = _634;
    float alpha = a + (opacity * (1.0 - a));
    float3 _656;
    if (alpha > 0.0)
    {
        _656 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _656 = bg;
    }
    float3 col = _656;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _60)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _60);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_60.uBackground);
    float param_4 = _60.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_spectrum_bars_frag_out flair_spectrum_bars_frag(constant FlairUniforms& _60 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_spectrum_bars_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _714;
    if (_60.flair_flipY > 0.5)
    {
        _714 = _60.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _714 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _714);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _60);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

