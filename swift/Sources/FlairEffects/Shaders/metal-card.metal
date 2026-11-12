// flair-metal-hash: a546715b
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
    float3 uMetal;
    float3 uChip;
    packed_float3 uInk;
    float uShine;
    float uTilt;
    uint uDemo;
};

struct flair_metal_card_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 hoverPoint(thread const bool& demo, thread const float& idle, constant FlairUniforms& _136)
{
    float2 drift = float2(_136.iResolution[0], _136.iResolution[1]) * (float2(0.5) + float2(0.300000011920928955078125 * sin(_136.iTime * 0.5299999713897705078125), 0.25 * sin((_136.iTime * 0.769999980926513671875) + 1.2999999523162841796875)));
    float h = fast::clamp(_136.iPointer.z, 0.0, 1.0);
    return float3(mix(drift, _136.iPointer.xy, float2(h)), mix(demo ? idle : 0.0, 1.0, h));
}

static inline __attribute__((always_inline))
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _136)
{
    float2 res = float2(_136.iResolution[0], _136.iResolution[1]);
    float w = fast::min(res.x * 0.819999992847442626953125, (res.y * 0.819999992847442626953125) * 1.585999965667724609375);
    float2 hs = float2(w, w / 1.585999965667724609375) * 0.5;
    bool param = _136.uDemo != 0u;
    float param_1 = 0.60000002384185791015625;
    float3 hp = hoverPoint(param, param_1, _136);
    float2 tilt = (fast::clamp((hp.xy - (res * 0.5)) / hs, float2(-1.0), float2(1.0)) * hp.z) * _136.uTilt;
    float2 s = (fragCoord - (res * 0.5)) / hs;
    float2 q = s / float2(fast::max(1.0 - (0.119999997317790985107421875 * dot(s, tilt)), 0.20000000298023223876953125));
    float2 p = q * hs;
    float px = 1.0;
    float2 param_2 = p;
    float2 param_3 = hs;
    float param_4 = hs.y * 0.0900000035762786865234375;
    float sd = roundedBox(param_2, param_3, param_4);
    float mask = 1.0 - smoothstep(-px, px, sd);
    float2 param_5 = ((fragCoord - (res * 0.5)) + ((tilt * hs) * 0.0500000007450580596923828125)) + float2(0.0, hs.y * 0.07999999821186065673828125);
    float2 param_6 = hs;
    float param_7 = hs.y * 0.100000001490116119384765625;
    float shadowD = roundedBox(param_5, param_6, param_7);
    float shadow = (1.0 - smoothstep((-hs.y) * 0.0500000007450580596923828125, hs.y * 0.180000007152557373046875, shadowD)) * 0.4000000059604644775390625;
    if (mask <= 0.0)
    {
        fragColor = float4(0.0, 0.0, 0.0, shadow);
        return;
    }
    float2 c = float2(((q.x * 0.5) + 0.5) * 1.585999965667724609375, (q.y * 0.5) + 0.5);
    float2 param_8 = float2(c.x * 3.0, c.y * 420.0);
    float2 param_9 = float2(c.x * 1.5, c.y * 90.0);
    float grain = (vnoise(param_8) * 0.60000002384185791015625) + (vnoise(param_9) * 0.4000000059604644775390625);
    float3 col = _136.uMetal * (0.85000002384185791015625 + (0.300000011920928955078125 * grain));
    float band = ((c.y - 0.550000011920928955078125) + (tilt.y * 0.699999988079071044921875)) - ((c.x - 0.800000011920928955078125) * (0.25 + (tilt.x * 0.300000011920928955078125)));
    float spec = exp(((-band) * band) * 18.0) * (0.60000002384185791015625 + (0.4000000059604644775390625 * grain));
    col += (mix(float3(0.550000011920928955078125), _136.uMetal + float3(0.4000000059604644775390625), float3(0.5)) * (_136.uShine * spec));
    col += float3((_136.uShine * 0.25) * exp(((-band) * band) * 3.0));
    float2 chip = c - float2(0.2800000011920928955078125, 0.560000002384185791015625);
    float2 param_10 = chip;
    float2 param_11 = float2(0.104999996721744537353515625, 0.07999999821186065673828125);
    float param_12 = 0.017999999225139617919921875;
    float chipD = roundedBox(param_10, param_11, param_12);
    float3 gold = (_136.uChip * (0.800000011920928955078125 + (0.4000000059604644775390625 * smoothstep(-0.100000001490116119384765625, 0.100000001490116119384765625, chip.y + (chip.x * 0.4000000059604644775390625))))) + float3(spec * 0.300000011920928955078125);
    float pads = fast::min(abs(chip.y), fast::min(abs(abs(chip.y) - 0.039999999105930328369140625), abs(chip.x + 0.0199999995529651641845703125)));
    gold *= (1.0 - ((0.3499999940395355224609375 * (1.0 - smoothstep(0.00200000009499490261077880859375, 0.004999999888241291046142578125, pads))) * step(abs(chip.x), 0.070000000298023223876953125)));
    col = mix(col, gold, float3(1.0 - smoothstep(-0.00200000009499490261077880859375, 0.00200000009499490261077880859375, chipD)));
    float ink = 0.0;
    float2 cl = c - float2(0.4699999988079071044921875, 0.560000002384185791015625);
    float clR = length(cl);
    float arcs = 0.0;
    for (int i = 0; i < 3; i++)
    {
        arcs = fast::max(arcs, 1.0 - smoothstep(0.0040000001899898052215576171875, 0.008000000379979610443115234375, abs((clR - 0.02500000037252902984619140625) - (0.02199999988079071044921875 * float(i)))));
    }
    ink = fast::max(ink, (arcs * step(0.0, cl.x)) * step(abs(cl.y), cl.x * 1.10000002384185791015625));
    float2 nd = c - float2(0.17000000178813934326171875, 0.319999992847442626953125);
    float group = floor(nd.x / 0.3300000131130218505859375);
    float within = nd.x - (group * 0.3300000131130218505859375);
    float2 bump = float2(mod(within, 0.0579999983310699462890625) - 0.02899999916553497314453125, nd.y);
    float digits = ((((1.0 - smoothstep(0.01400000043213367462158203125, 0.01899999938905239105224609375, length(bump))) * step(0.0, within)) * step(within, 0.23199999332427978515625)) * step(0.0, group)) * step(group, 3.0);
    ink = fast::max(ink, digits);
    float2 param_13 = c - float2(0.4199999868869781494140625, 0.1599999964237213134765625);
    float2 param_14 = float2(0.25, 0.017999999225139617919921875);
    float param_15 = 0.017999999225139617919921875;
    ink = fast::max(ink, 1.0 - smoothstep(0.0, 0.0040000001899898052215576171875, roundedBox(param_13, param_14, param_15)));
    float2 hx = abs(c - float2(1.38600003719329833984375, 0.180000007152557373046875));
    float hex = fast::max((hx.x * 0.865999996662139892578125) + (hx.y * 0.5), hx.y) - 0.070000000298023223876953125;
    ink = fast::max(ink, 1.0 - smoothstep(0.0040000001899898052215576171875, 0.008000000379979610443115234375, abs(hex)));
    float3 inkCol = float3(_136.uInk) * (0.800000011920928955078125 + (0.4000000059604644775390625 * spec));
    col = mix(col, inkCol, float3(ink * 0.85000002384185791015625));
    float rim = smoothstep((-hs.y) * 0.02999999932944774627685546875, 0.0, sd);
    col += float3((rim * (0.1500000059604644775390625 + (0.4000000059604644775390625 * spec))) * _136.uShine);
    float a = mask + (shadow * (1.0 - mask));
    fragColor = float4((col * mask) / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

fragment flair_metal_card_frag_out flair_metal_card_frag(constant FlairUniforms& _136 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_metal_card_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _738;
    if (_136.flair_flipY > 0.5)
    {
        _738 = _136.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _738 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _738);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _136);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

