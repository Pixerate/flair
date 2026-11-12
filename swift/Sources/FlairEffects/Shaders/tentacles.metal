// flair-metal-hash: b25a9509
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
    float3 uBackground;
    float3 uColor;
    float3 uUnder;
    packed_float3 uRim;
    float uCount;
    float uLength;
    float uWidth;
    float uCurl;
    float uReach;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_tentacles_frag_out
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
float segT(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ba = b - a;
    return fast::clamp(dot(p - a, ba) / fast::max(dot(ba, ba), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _100)
{
    float px = 1.0 / _100.iResolution[1u];
    float2 p = (fragCoord - (float2(_100.iResolution[0], _100.iResolution[1]) * 0.5)) * px;
    float aspect = _100.iResolution[0u] / _100.iResolution[1u];
    float hover = fast::clamp(_100.iPointer.z, 0.0, 1.0);
    float2 pointer = (_100.iPointer.xy - (float2(_100.iResolution[0], _100.iResolution[1]) * 0.5)) * px;
    float t = _100.iTime * _100.uSpeed;
    float best = 100000.0;
    float along = 0.0;
    float across = 0.0;
    int n = int(_100.uCount + 0.5);
    for (int i = 0; i < 7; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi, 3.0);
        float bx = (((((fi + 0.5) / float(n)) - 0.5) * aspect) * 0.89999997615814208984375) + ((hash12(param) - 0.5) * 0.100000001490116119384765625);
        float2 pos = float2(bx, -0.560000002384185791015625);
        if (length(p - pos) > (_100.uLength + 0.119999997317790985107421875))
        {
            continue;
        }
        float ang = (1.57079994678497314453125 + (0.300000011920928955078125 * sin((t * 0.5) + (fi * 1.7000000476837158203125)))) + ((bx / aspect) * (-0.60000002384185791015625));
        float seg = _100.uLength / 20.0;
        float turn = (mod(fi, 2.0) < 0.5) ? 1.0 : (-1.0);
        for (int k = 0; k < 20; k++)
        {
            float fk = float(k) / 20.0;
            ang += (_100.uCurl * (((0.12999999523162841796875 * sin(((t * 1.2999999523162841796875) + (fk * 4.0)) + (fi * 2.2999999523162841796875))) * (0.4000000059604644775390625 + fk)) + (((turn * 0.2199999988079071044921875) * fk) * fk)));
            if (hover > 0.0)
            {
                float toward = precise::atan2(pointer.y - pos.y, pointer.x - pos.x) - ang;
                toward = mod(toward + 3.141590118408203125, 6.28318023681640625) - 3.141590118408203125;
                ang += ((((hover * _100.uReach) * 0.070000000298023223876953125) * fk) * toward);
            }
            if (((length(p - pos) - (float(20 - k) * seg)) - (_100.uWidth * 0.001000000047497451305389404296875)) > fast::min(best, 0.119999997317790985107421875))
            {
                break;
            }
            float2 next = pos + (float2(cos(ang), sin(ang)) * seg);
            float2 param_1 = p;
            float2 param_2 = pos;
            float2 param_3 = next;
            float h = segT(param_1, param_2, param_3);
            float2 off = (p - pos) - ((next - pos) * h);
            float w = (_100.uWidth * 0.001000000047497451305389404296875) * (1.0 - (0.85000002384185791015625 * (fk + (h / 20.0))));
            float sd = length(off) - w;
            if (sd < best)
            {
                best = sd;
                along = fk + (h / 20.0);
                float2 dir = fast::normalize(next - pos);
                across = fast::clamp(((dir.x * off.y) - (dir.y * off.x)) / fast::max(w, 9.9999997473787516355514526367188e-05), -1.0, 1.0) * turn;
            }
            pos = next;
        }
    }
    float3 col = _100.uBackground;
    col *= (1.0 - (0.5 * exp((-fast::max(best, 0.0)) / 0.02999999932944774627685546875)));
    float inside = fast::clamp(0.5 - (best / px), 0.0, 1.0);
    if (inside > 0.0)
    {
        float round_ = sqrt(fast::max(1.0 - (across * across), 0.0));
        float3 skin = (_100.uColor * (0.3499999940395355224609375 + (0.75 * round_))) * (0.800000011920928955078125 + (0.20000000298023223876953125 * sin(along * 60.0)));
        float under = smoothstep(0.100000001490116119384765625, 0.60000002384185791015625, -across);
        skin = mix(skin, _100.uUnder * (0.5 + (0.5 * round_)), float3(under * 0.75));
        float2 sucker = float2((fract(along * 26.0) - 0.5) * 2.2000000476837158203125, ((-across) - 0.62000000476837158203125) * 3.0);
        float sd_1 = length(sucker);
        float cup = (1.0 - smoothstep(0.550000011920928955078125, 0.75, sd_1)) * step(along, 0.920000016689300537109375);
        skin = mix(skin, _100.uUnder * 1.14999997615814208984375, float3(cup * 0.800000011920928955078125));
        skin = mix(skin, _100.uColor * 0.25, float3((1.0 - smoothstep(0.20000000298023223876953125, 0.3499999940395355224609375, sd_1)) * cup));
        skin += ((float3(_100.uRim) * smoothstep(0.550000011920928955078125, 0.949999988079071044921875, across)) * 0.550000011920928955078125);
        col = mix(col, skin, float3(inside));
    }
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
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
    float3 _610;
    if (a > 0.0)
    {
        _610 = bg + (d / float3(a));
    }
    else
    {
        _610 = bg;
    }
    float3 fg = _610;
    float alpha = a + (opacity * (1.0 - a));
    float3 _632;
    if (alpha > 0.0)
    {
        _632 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _632 = bg;
    }
    float3 col = _632;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _100)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _100);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _100.uBackground;
    float param_4 = _100.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_tentacles_frag_out flair_tentacles_frag(constant FlairUniforms& _100 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_tentacles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _690;
    if (_100.flair_flipY > 0.5)
    {
        _690 = _100.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _690 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _690);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _100);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

