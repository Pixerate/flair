// flair-metal-hash: 78375c01
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
    packed_float3 uColor;
    float uWisps;
    float uLength;
    float uWidth;
    float uGlow;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_ectoplasm_wisps_frag_out
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
float4 wispLife(thread const float& i, thread const float& t, thread float& life, constant FlairUniforms& _96)
{
    float2 param = float2(i * 7.099999904632568359375, 2.2999999523162841796875);
    float2 h = hash22(param);
    float rate = _96.uSpeed / (2.5 + (2.0 * h.x));
    life = (t * rate) + h.y;
    float2 param_1 = float2(i, floor(life)) * 1.7000000476837158203125;
    float2 g = hash22(param_1);
    return float4(g.x * 6.28318023681640625, 0.5 + (0.4000000059604644775390625 * g.y), (2.0 + (2.0 * g.y)) * ((h.x < 0.5) ? 1.0 : (-1.0)), rate);
}

static inline __attribute__((always_inline))
float2 wispAt(thread const float& i, thread const float4& w, thread const float& u, thread const float& t, thread const float2& target)
{
    float a = w.x + (u * w.z);
    float r = w.y * powr(1.0 - u, 1.39999997615814208984375);
    float2 wobble = (float2(sin((t * 2.2999999523162841796875) + (i * 5.0)), sin((t * 1.89999997615814208984375) + (i * 3.0))) * 0.0199999995529651641845703125) * (1.0 - u);
    return (target + (float2(cos(a), sin(a)) * r)) + wobble;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _96)
{
    float2 p = (fragCoord - (float2(_96.iResolution[0], _96.iResolution[1]) * 0.5)) / float2(_96.iResolution[1u]);
    float aspect = _96.iResolution[0u] / _96.iResolution[1u];
    float hover = fast::clamp(_96.iPointer.z, 0.0, 1.0);
    float2 idle = float2((0.300000011920928955078125 * aspect) * sin(_96.iTime * 0.310000002384185791015625), 0.25 * sin((_96.iTime * 0.4699999988079071044921875) + 1.0));
    float2 target = mix(idle, (_96.iPointer.xy - (float2(_96.iResolution[0], _96.iResolution[1]) * 0.5)) / float2(_96.iResolution[1u]), float2(hover));
    float w = _96.uWidth * 0.001000000047497451305389404296875;
    float glow = 0.0;
    float core = 0.0;
    int n = int(_96.uWisps + 0.5);
    float param_2;
    for (int i = 0; i < 8; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        float param = fi;
        float param_1 = _96.iTime;
        float4 _307 = wispLife(param, param_1, param_2, _96);
        float life = param_2;
        float4 wl = _307;
        float u0 = fract(life);
        if (length(p - target) > (((wl.y * powr(1.0 - fast::max(u0 - ((2.75 * _96.uLength) * wl.w), 0.0), 1.39999997615814208984375)) + 0.0599999986588954925537109375) + (10.0 * w)))
        {
            continue;
        }
        float param_3 = fi;
        float4 param_4 = wl;
        float param_5 = u0;
        float param_6 = _96.iTime;
        float2 param_7 = target;
        float2 prev = wispAt(param_3, param_4, param_5, param_6, param_7);
        float fadeLife = smoothstep(0.0, 0.1500000059604644775390625, u0) * (1.0 - smoothstep(0.800000011920928955078125, 1.0, u0));
        for (int k = 1; k < 12; k++)
        {
            float dt = (float(k) * 0.25) * _96.uLength;
            float u = u0 - (dt * wl.w);
            if (u < 0.0)
            {
                break;
            }
            float param_8 = fi;
            float4 param_9 = wl;
            float param_10 = u;
            float param_11 = _96.iTime - dt;
            float2 param_12 = target;
            float2 s = wispAt(param_8, param_9, param_10, param_11, param_12);
            float along = float(k) / 12.0;
            float2 pa = p - prev;
            float2 ba = s - prev;
            float d = length(pa - (ba * fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.9999999392252902907785028219223e-09), 0.0, 1.0)));
            float hw = w * (1.0 - (0.85000002384185791015625 * along));
            float fade = fadeLife * (1.0 - along);
            glow += ((exp((-d) / (2.5 * hw)) * fade) * 0.3300000131130218505859375);
            core = fast::max(core, (1.0 - smoothstep(0.4000000059604644775390625 * hw, hw, d)) * fade);
            prev = s;
        }
    }
    float3 col = (_96.uBackground + ((float3(_96.uColor) * glow) * _96.uGlow)) + (mix(float3(_96.uColor), float3(1.0), float3(0.60000002384185791015625)) * core);
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
    float3 _551;
    if (a > 0.0)
    {
        _551 = bg + (d / float3(a));
    }
    else
    {
        _551 = bg;
    }
    float3 fg = _551;
    float alpha = a + (opacity * (1.0 - a));
    float3 _573;
    if (alpha > 0.0)
    {
        _573 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _573 = bg;
    }
    float3 col = _573;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _96)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _96);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _96.uBackground;
    float param_4 = _96.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_ectoplasm_wisps_frag_out flair_ectoplasm_wisps_frag(constant FlairUniforms& _96 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ectoplasm_wisps_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _630;
    if (_96.flair_flipY > 0.5)
    {
        _630 = _96.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _630 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _630);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _96);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

