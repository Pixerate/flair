// flair-metal-hash: dc9d4007
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
    float3 uBackground;
    float3 uColor;
    packed_float3 uCore;
    float uSize;
    float uPoints;
    float uRunes;
    float uWidth;
    float uSpin;
    float uCycle;
    uint uAnimate;
    float uProgress;
    float uBackgroundAlpha;
};

struct flair_summoning_circle_frag_out
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
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float segDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ba = b - a;
    return length((p - a) - (ba * fast::clamp(dot(p - a, ba) / fast::max(dot(ba, ba), 9.9999999392252902907785028219223e-09), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _141)
{
    float2 p = (fragCoord - (float2(_141.iResolution[0], _141.iResolution[1]) * 0.5)) / float2(_141.iResolution[1u]);
    float u = fract(_141.iTime / _141.uCycle);
    float _170;
    if (_141.uAnimate != 0u)
    {
        _170 = smoothstep(0.0, 0.550000011920928955078125, u);
    }
    else
    {
        _170 = _141.uProgress;
    }
    float drawn = _170;
    float _185;
    if (_141.uAnimate != 0u)
    {
        _185 = exp(-powr((u - 0.62000000476837158203125) / 0.0350000001490116119384765625, 2.0));
    }
    else
    {
        _185 = 0.0;
    }
    float flare = _185;
    float _203;
    if (_141.uAnimate != 0u)
    {
        _203 = 1.0 - smoothstep(0.7799999713897705078125, 0.9700000286102294921875, u);
    }
    else
    {
        _203 = 1.0;
    }
    float fade = _203;
    float spin = _141.iTime * _141.uSpin;
    p = float2x2(float2(cos(spin), sin(spin)), float2(-sin(spin), cos(spin))) * p;
    float R = _141.uSize;
    float r = length(p);
    float round_ = fract(0.25 - (precise::atan2(p.y, p.x) / 6.28318023681640625));
    float w = _141.uWidth * 0.001000000047497451305389404296875;
    float ring = fast::clamp(drawn / 0.4000000059604644775390625, 0.0, 1.0);
    float shown = step(round_, ring);
    float d = fast::min(abs(r - R), abs(r - (0.86000001430511474609375 * R))) + ((1.0 - shown) * 10.0);
    float cells = 28.0;
    float ci = floor(round_ * cells);
    float2 g = float2(fract(round_ * cells), (r - (0.875 * R)) / (0.10999999940395355224609375 * R));
    bool _309 = g.y > 0.0;
    bool _315;
    if (_309)
    {
        _315 = g.y < 1.0;
    }
    else
    {
        _315 = _309;
    }
    bool _322;
    if (_315)
    {
        _322 = _141.uRunes > 0.0;
    }
    else
    {
        _322 = _315;
    }
    bool _332;
    if (_322)
    {
        _332 = step((ci + 0.5) / cells, ring) > 0.0;
    }
    else
    {
        _332 = _322;
    }
    if (_332)
    {
        float2 cell = float2((((g.x - 0.5) * ((5.843357563018798828125 * R) / cells)) / (0.10999999940395355224609375 * R)) + 0.5, g.y);
        for (int k = 0; k < 2; k++)
        {
            float2 param = float2(ci, float(k) * 3.0);
            float2 param_1 = float2(ci + 9.0, float(k) * 5.0);
            float4 h = float4(hash22(param), hash22(param_1));
            float2 param_2 = float2(ci, 7.0);
            if (hash12(param_2) > _141.uRunes)
            {
                break;
            }
            float2 param_3 = cell;
            float2 param_4 = float2(0.25, 0.1500000059604644775390625) + (h.xy * float2(0.5, 0.699999988079071044921875));
            float2 param_5 = float2(0.25, 0.1500000059604644775390625) + (h.zw * float2(0.5, 0.699999988079071044921875));
            float rd = segDist(param_3, param_4, param_5);
            d = fast::min(d, (rd * 0.10999999940395355224609375) * R);
        }
    }
    float n = floor(_141.uPoints + 0.5);
    float step_ = floor((n - 1.0) / 2.0);
    float edges = fast::clamp((drawn - 0.4000000059604644775390625) / 0.60000002384185791015625, 0.0, 1.0) * n;
    for (int e = 0; e < 9; e++)
    {
        float fe = float(e);
        if ((fe >= n) || (fe >= edges))
        {
            break;
        }
        float a0 = 1.57079994678497314453125 - (((6.28318023681640625 * fe) * step_) / n);
        float a1 = 1.57079994678497314453125 - (((6.28318023681640625 * (fe + 1.0)) * step_) / n);
        float2 v0 = float2(cos(a0), sin(a0)) * (0.86000001430511474609375 * R);
        float2 v1 = float2(cos(a1), sin(a1)) * (0.86000001430511474609375 * R);
        v1 = mix(v0, v1, float2(fast::clamp(edges - fe, 0.0, 1.0)));
        float2 param_6 = p;
        float2 param_7 = v0;
        float2 param_8 = v1;
        d = fast::min(d, segDist(param_6, param_7, param_8));
    }
    float bright = fade * (1.0 + (2.5 * flare));
    float core = (1.0 - smoothstep(0.3499999940395355224609375 * w, w, d)) * bright;
    float glow = (exp((-d) / ((3.0 * w) + (0.0040000001899898052215576171875 * flare))) * 0.699999988079071044921875) * bright;
    float _554;
    if (_141.uAnimate != 0u)
    {
        _554 = (exp((-abs(r - (R * (1.0 + ((u - 0.60000002384185791015625) * 4.0))))) / 0.00999999977648258209228515625) * smoothstep(0.60000002384185791015625, 0.62000000476837158203125, u)) * (1.0 - smoothstep(0.62000000476837158203125, 0.800000011920928955078125, u));
    }
    else
    {
        _554 = 0.0;
    }
    float wave = _554;
    glow += (((flare * 0.5) * (1.0 - smoothstep(0.0, R, r))) + (wave * 0.800000011920928955078125));
    float3 col = (_141.uBackground + (_141.uColor * glow)) + (float3(_141.uCore) * fast::clamp(core, 0.0, 1.0));
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
    float3 _662;
    if (a > 0.0)
    {
        _662 = bg + (d / float3(a));
    }
    else
    {
        _662 = bg;
    }
    float3 fg = _662;
    float alpha = a + (opacity * (1.0 - a));
    float3 _684;
    if (alpha > 0.0)
    {
        _684 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _684 = bg;
    }
    float3 col = _684;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _141)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _141);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _141.uBackground;
    float param_4 = _141.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_summoning_circle_frag_out flair_summoning_circle_frag(constant FlairUniforms& _141 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_summoning_circle_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _742;
    if (_141.flair_flipY > 0.5)
    {
        _742 = _141.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _742 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _742);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _141);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

