// flair-metal-hash: 30b3cdb8
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
    packed_float3 uTrack;
    float uWidth;
    float uThickness;
    float uHeight;
    float uSparks;
    uint uAnimate;
    float uProgress;
    float3 uHot;
    float3 uMid;
    float3 uCool;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_flame_loader_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float fillCycle(thread const float& period, constant FlairUniforms& _245)
{
    float u = fract(_245.iTime / period);
    float f = smoothstep(0.0, 0.7200000286102294921875, u);
    return f * (1.0 - smoothstep(0.86000001430511474609375, 0.980000019073486328125, u));
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float3 fireLight(thread float& h, constant FlairUniforms& _245)
{
    h = fast::clamp(h, 0.0, 1.0);
    float3 c = _245.uCool * smoothstep(0.0, 0.20000000298023223876953125, h);
    c = mix(c, _245.uMid, float3(smoothstep(0.2199999988079071044921875, 0.550000011920928955078125, h)));
    c = mix(c, _245.uHot, float3(smoothstep(0.60000002384185791015625, 0.949999988079071044921875, h)));
    return c * (0.699999988079071044921875 + ((3.0 * h) * h));
}

static inline __attribute__((always_inline))
float flameNoise(thread const float2& p, thread const float& t)
{
    float2 param = (p * 0.60000002384185791015625) + float2(0.0, (-t) * 0.5);
    int param_1 = 3;
    float _294 = fbm(param, param_1);
    float2 param_2 = (p * 0.60000002384185791015625) + float2(4.30000019073486328125, 1.7000000476837158203125 - (t * 0.699999988079071044921875));
    int param_3 = 3;
    float _306 = fbm(param_2, param_3);
    float2 w = float2(_294, _306);
    float2 param_4 = (p + ((w - float2(0.5)) * 1.7999999523162841796875)) + float2(0.0, -t);
    int param_5 = 4;
    float _322 = fbm(param_4, param_5);
    return _322;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float sparks(thread const float2& p, thread const float& t, thread const float& amount)
{
    float s = 0.0;
    for (int l = 0; l < 3; l++)
    {
        float fl = float(l);
        float scale = 7.0 + (5.0 * fl);
        float2 q = (p * scale) - float2(0.0, t * (2.2000000476837158203125 + (0.60000002384185791015625 * fl)));
        float2 cell = floor(q);
        float2 param = cell + float2(fl * 31.700000762939453125);
        float2 param_1 = cell + float2(7.69999980926513671875, fl);
        float3 h = float3(hash22(param), hash12(param_1));
        if (h.z > (amount * 0.5))
        {
            continue;
        }
        float2 c = (float2(0.25) + (h.xy * 0.5)) + float2(0.119999997317790985107421875 * sin((t * 2.5) + (h.x * 40.0)), 0.0);
        float2 d = ((fract(q) - c) * float2(1.0, 0.550000011920928955078125)) / float2(scale);
        float r = (0.001599999959580600261688232421875 + (0.001599999959580600261688232421875 * h.y)) * (1.0 - (0.25 * fl));
        float twinkle = 0.550000011920928955078125 + (0.449999988079071044921875 * sin((t * 17.0) + (h.y * 60.0)));
        s += (exp((-dot(d, d)) / (r * r)) * twinkle);
    }
    return s;
}

static inline __attribute__((always_inline))
float4 fireOver(thread const float4& base, thread float3& light)
{
    light = float3(1.0) - exp(-fast::max(light, float3(0.0)));
    float a = fast::max(light.x, fast::max(light.y, light.z));
    float3 col = (base.xyz * (1.0 - a)) + light;
    float alpha = base.w + (a * (1.0 - base.w));
    return float4(fast::min(col / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(1.0)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _245)
{
    float px = 1.0 / _245.iResolution[1u];
    float2 p = ((fragCoord - (float2(_245.iResolution[0], _245.iResolution[1]) * 0.5)) * px) + float2(0.0, _245.uHeight * 0.3499999940395355224609375);
    float aspect = _245.iResolution[0u] * px;
    float2 half_ = float2((0.5 * aspect) * _245.uWidth, 0.5 * _245.uThickness);
    float rad = half_.y;
    float2 param = p;
    float2 param_1 = half_;
    float param_2 = rad;
    float sd = boxSdf(param, param_1, param_2);
    float _601;
    if (_245.uAnimate != 0u)
    {
        float param_3 = 6.0;
        _601 = fillCycle(param_3, _245);
    }
    else
    {
        _601 = _245.uProgress;
    }
    float progress = _601;
    float frontX = (-half_.x) + ((2.0 * half_.x) * progress);
    float behind = frontX - p.x;
    float lit = smoothstep(-0.0040000001899898052215576171875, 0.0040000001899898052215576171875, behind) * step(0.001000000047497451305389404296875, progress);
    float t = _245.iTime * 1.7999999523162841796875;
    float4 acc = float4(0.0);
    float inBar = smoothstep(px, -px, sd);
    acc = float4(float3(_245.uTrack) * inBar, inBar);
    float2 param_4 = float2(p.x * 40.0, p.y * 40.0) + float2(0.0, (-t) * 0.4000000059604644775390625);
    int param_5 = 4;
    float _674 = fbm(param_4, param_5);
    float embers = _674;
    float glowHeat = (0.3499999940395355224609375 + (0.5 * embers)) * (0.60000002384185791015625 + (0.4000000059604644775390625 * exp((-behind) / 0.1500000059604644775390625)));
    float param_6 = glowHeat;
    float3 _690 = fireLight(param_6, _245);
    float3 coal = float3(1.0) - exp(-_690);
    acc = float4(mix(acc.xyz, coal, float3(inBar * lit)), acc.w);
    float2 param_7 = p * 9.0;
    float param_8 = t;
    float n = flameNoise(param_7, param_8);
    float near = exp((-fast::max(behind, 0.0)) / 0.25);
    float h = _245.uHeight * (0.3499999940395355224609375 + (0.64999997615814208984375 * near));
    float lift = h * (0.02999999932944774627685546875 + ((1.60000002384185791015625 * n) * n));
    float2 param_9 = float2((p.y * 8.0) - t, p.x * 3.0);
    float2 q = p - float2(((-lift) * 0.5) + (((vnoise(param_9) - 0.5) * h) * 0.300000011920928955078125), lift);
    float qBehind = frontX - q.x;
    float2 param_10 = q;
    float2 param_11 = half_;
    float param_12 = rad;
    float flames = ((smoothstep(0.01200000010430812835693359375, -0.0040000001899898052215576171875, boxSdf(param_10, param_11, param_12)) * smoothstep(-0.0040000001899898052215576171875, 0.00999999977648258209228515625, qBehind)) * powr(fast::max(1.0 - (lift / ((h * 1.2999999523162841796875) + 9.9999997473787516355514526367188e-05)), 0.0), 1.2999999523162841796875)) * (0.449999988079071044921875 + (0.75 * n));
    float param_13 = (flames * step(0.001000000047497451305389404296875, progress)) * step(0.001000000047497451305389404296875, _245.uHeight);
    float3 _811 = fireLight(param_13, _245);
    float3 light = _811 * (1.0 - (inBar * 0.699999988079071044921875));
    light += ((((mix(_245.uHot, _245.uMid, float3(0.300000011920928955078125)) * exp((-length((p - float2(frontX, 0.0)) * float2(1.0, 1.5))) / (_245.uThickness * 0.800000011920928955078125))) * 0.800000011920928955078125) * step(0.001000000047497451305389404296875, progress)) * step(progress, 0.999000012874603271484375));
    float rise = (exp((-fast::max(p.y - half_.y, 0.0)) / ((_245.uHeight * 1.5) + 0.02999999932944774627685546875)) * smoothstep(-half_.y, half_.y, p.y)) * exp((-abs(p.x - frontX)) / 0.07999999821186065673828125);
    float2 param_14 = p;
    float param_15 = _245.iTime;
    float param_16 = _245.uSparks;
    light += ((((mix(_245.uHot, _245.uMid, float3(0.4000000059604644775390625)) * sparks(param_14, param_15, param_16)) * rise) * 1.60000002384185791015625) * step(0.001000000047497451305389404296875, progress));
    float4 base = float4(float3(_245.uBackground) * _245.uBackgroundAlpha, _245.uBackgroundAlpha);
    acc = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    float4 param_17 = acc;
    float3 param_18 = light;
    float4 _945 = fireOver(param_17, param_18);
    fragColor = _945;
}

fragment flair_flame_loader_frag_out flair_flame_loader_frag(constant FlairUniforms& _245 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_flame_loader_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _958;
    if (_245.flair_flipY > 0.5)
    {
        _958 = _245.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _958 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _958);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _245);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

