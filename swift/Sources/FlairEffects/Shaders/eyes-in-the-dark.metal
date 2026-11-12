// flair-metal-hash: 3a444b0e
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
    packed_float3 uColorB;
    float uDensity;
    float uAmount;
    float uSize;
    float uReach;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_eyes_in_the_dark_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _106)
{
    float H = _106.iResolution[1u];
    float2 p = fragCoord / float2(H);
    float cell = 1.0 / _106.uDensity;
    float2 id = floor(p / float2(cell));
    float2 param = id + float2(7.30000019073486328125);
    float2 h = hash22(param);
    float period = 5.0 + (5.0 * h.x);
    float life = (_106.iTime / period) + (h.y * 7.0);
    float cycle = floor(life);
    float u = fract(life);
    float3 col = _106.uBackground;
    float2 param_1 = id + float2(cycle * 3.099999904632568359375);
    if (hash12(param_1) < _106.uAmount)
    {
        float r = fast::min(0.02199999988079071044921875 * _106.uSize, 0.12999999523162841796875 * cell);
        float2 param_2 = (id * 1.2999999523162841796875) + float2(cycle * 5.69999980926513671875);
        float2 jitter = hash22(param_2) - float2(0.5);
        float2 c = ((id + float2(0.5)) * cell) + (jitter * (cell - (8.0 * r)));
        float2 pointer = _106.iPointer.xy / float2(H);
        float near = fast::clamp(_106.iPointer.z, 0.0, 1.0) * (1.0 - smoothstep(0.5 * _106.uReach, _106.uReach, length(pointer - c)));
        float open = smoothstep(0.07999999821186065673828125, 0.20000000298023223876953125, u) * (1.0 - smoothstep(0.75, 0.87999999523162841796875, u));
        float2 param_3 = id + float2(cycle);
        float b = 0.300000011920928955078125 + (0.4000000059604644775390625 * hash12(param_3));
        float blink = (1.0 - exp(-powr((u - b) / 0.00999999977648258209228515625, 2.0))) * (1.0 - exp(-powr(((u - b) - 0.0350000001490116119384765625) / 0.00999999977648258209228515625, 2.0)));
        float lid = (open * blink) * (1.0 - near);
        float2 wander = float2(sin((_106.iTime * 0.699999988079071044921875) + (h.x * 9.0)), 0.4000000059604644775390625 * sin((_106.iTime * 0.5) + (h.y * 7.0)));
        float2 toward = pointer - c;
        float2 look = mix(wander, toward / float2(fast::max(length(toward), 0.001000000047497451305389404296875)), float2(fast::clamp(_106.iPointer.z, 0.0, 1.0))) * 0.3499999940395355224609375;
        float2 param_4 = id + float2(2.0);
        float3 _342;
        if (hash12(param_4) < 0.699999988079071044921875)
        {
            _342 = _106.uColor;
        }
        else
        {
            _342 = float3(_106.uColorB);
        }
        float3 tint = _342;
        float tilt = (h.x - 0.5) * 0.4000000059604644775390625;
        float2 q = (p - c) / float2(r);
        q = float2x2(float2(cos(tilt), sin(tilt)), float2(-sin(tilt), cos(tilt))) * q;
        float side = sign(q.x);
        q.x = abs(q.x) - 1.60000002384185791015625;
        q = float2x2(float2(0.968912422657012939453125, -0.24740396440029144287109375), float2(0.24740396440029144287109375, 0.968912422657012939453125)) * q;
        float height = (0.550000011920928955078125 * lid) * fast::max(1.0 - (q.x * q.x), 0.0);
        float almond = fast::clamp((((height - abs(q.y)) * r) * H) * 1.2000000476837158203125, 0.0, 1.0) * step(abs(q.x), 1.0);
        float2 pq = q - float2(look.x * side, look.y);
        float iris = 0.550000011920928955078125 + (0.89999997615814208984375 * exp((-length(pq)) * 2.2000000476837158203125));
        float pupil = 1.0 - smoothstep(0.070000000298023223876953125, 0.14000000059604644775390625, abs(pq.x) / fast::max(1.0 - ((pq.y * pq.y) * 2.2000000476837158203125), 0.0500000007450580596923828125));
        float3 eye = (tint * iris) * (1.0 - (0.89999997615814208984375 * pupil));
        float glow = ((exp((-length(q / float2(1.39999997615814208984375, 1.0))) * 1.60000002384185791015625) * lid) * 0.3499999940395355224609375) * _106.uGlow;
        col += (tint * glow);
        col = mix(col, eye, float3(almond));
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
    float3 _549;
    if (a > 0.0)
    {
        _549 = bg + (d / float3(a));
    }
    else
    {
        _549 = bg;
    }
    float3 fg = _549;
    float alpha = a + (opacity * (1.0 - a));
    float3 _571;
    if (alpha > 0.0)
    {
        _571 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _571 = bg;
    }
    float3 col = _571;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _106)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _106);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _106.uBackground;
    float param_4 = _106.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_eyes_in_the_dark_frag_out flair_eyes_in_the_dark_frag(constant FlairUniforms& _106 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_eyes_in_the_dark_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _629;
    if (_106.flair_flipY > 0.5)
    {
        _629 = _106.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _629 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _629);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _106);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

