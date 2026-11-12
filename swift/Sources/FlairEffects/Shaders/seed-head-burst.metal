// flair-metal-hash: a8cca5d6
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
    float3 uCore;
    float3 uRim;
    float3 uDust;
    float3 uRay;
    float3 uHead;
    packed_float3 uNode;
    int uRays;
    float uSize;
    float uReach;
    float uDustAmount;
    float uGlow;
    uint uAnimate;
    float uCycle;
    float uProgress;
    char _m27_pad[4];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_seed_head_burst_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float easeOut(thread float& x)
{
    x = fast::clamp(x, 0.0, 1.0);
    return 1.0 - (((1.0 - x) * (1.0 - x)) * (1.0 - x));
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
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _247)
{
    float px = 1.0 / _247.iResolution[1u];
    float2 p = (fragCoord - (float2(_247.iResolution[0], _247.iResolution[1]) * 0.5)) * px;
    float _268;
    if (_247.uAnimate != 0u)
    {
        _268 = fract(_247.iTime / _247.uCycle);
    }
    else
    {
        _268 = _247.uProgress;
    }
    float t = _268;
    float r = length(p);
    float ang = precise::atan2(p.y, p.x);
    float R = _247.uSize;
    float shown = smoothstep(0.0, 0.100000001490116119384765625, t) * (1.0 - smoothstep(0.89999997615814208984375, 1.0, t));
    float focus = smoothstep(0.07999999821186065673828125, 0.2700000107288360595703125, t);
    float burstAt = 0.2700000107288360595703125;
    float burst = smoothstep(burstAt, burstAt + 0.0500000007450580596923828125, t);
    float flash = exp((-fast::max(t - burstAt, 0.0)) * 40.0) * step(burstAt, t);
    float blur = mix(R * 0.449999988079071044921875, 1.5 * px, focus);
    float3 light = float3(0.0);
    float4 acc = float4(0.0);
    float param = (t - burstAt) / 0.4000000059604644775390625;
    float _352 = easeOut(param);
    float spread = 1.0 + ((1.60000002384185791015625 * _352) * burst);
    float2 dq = p / float2(spread);
    float dr = length(dq);
    float _371;
    if (dr < (R * 3.7999999523162841796875))
    {
        float2 param_1 = ((dq / float2(R)) * 1.60000002384185791015625) + float2(3.0);
        int param_2 = 4;
        float _384 = fbm(param_1, param_2);
        _371 = _384;
    }
    else
    {
        _371 = 0.0;
    }
    float cloud = _371;
    float shell = smoothstep(R * 0.89999997615814208984375, R * 1.25, dr) * (1.0 - smoothstep(R * 1.7000000476837158203125, mix(R * 3.400000095367431640625, R * 2.7999999523162841796875, focus), dr + ((0.300000011920928955078125 * R) * cloud)));
    float2 param_3 = floor(dq * 520.0);
    float grains = step(0.800000011920928955078125, hash12(param_3)) * smoothstep(0.449999988079071044921875, 0.75, cloud);
    float haze = shell * (0.3499999940395355224609375 + (0.64999997615814208984375 * smoothstep(0.300000011920928955078125, 0.75, cloud)));
    float dust = ((shell * mix(haze * 1.10000002384185791015625, (grains * 0.89999997615814208984375) + (haze * 0.25), focus)) * _247.uDustAmount) * (1.0 - (smoothstep(0.3499999940395355224609375, 0.75, t) * burst));
    light += ((_247.uDust * dust) * 0.89999997615814208984375);
    float n = float(_247.uRays);
    for (int i = 0; i < 32; i++)
    {
        if (i >= _247.uRays)
        {
            break;
        }
        float fi = float(i);
        float2 param_4 = float2(fi, 3.7000000476837158203125);
        float h1 = hash12(param_4);
        float2 param_5 = float2(fi, 9.1000003814697265625);
        float h2 = hash12(param_5);
        float2 param_6 = float2(fi, 17.299999237060546875);
        float h3 = hash12(param_6);
        float a = (((fi + 0.1500000059604644775390625) + (0.699999988079071044921875 * h1)) / n) * 6.28318023681640625;
        float2 dir = float2(cos(a), sin(a));
        float reach = (R * 1.2999999523162841796875) + (((_247.uReach - (R * 1.2999999523162841796875)) * (0.300000011920928955078125 + (0.5 * h2))) * ((h1 > 0.7200000286102294921875) ? 1.60000002384185791015625 : 1.0));
        float start = (burstAt + 0.0199999995529651641845703125) + (0.0500000007450580596923828125 * h3);
        float param_7 = (t - start) / (0.14000000059604644775390625 + (0.07999999821186065673828125 * h2));
        float _567 = easeOut(param_7);
        float e = _567;
        if (t < start)
        {
            continue;
        }
        float tip = (R * 1.0499999523162841796875) + ((reach - (R * 1.0499999523162841796875)) * e);
        float along = dot(p, dir);
        float across = abs(dot(p, float2(-dir.y, dir.x)));
        float onSeg = fast::clamp(along, R * 1.0499999523162841796875, tip);
        float d = length(float2(along - onSeg, across));
        float hd = length(p - (dir * tip));
        if (fast::min(d, hd) > (0.0599999986588954925537109375 + (0.0599999986588954925537109375 * _247.uGlow)))
        {
            continue;
        }
        float u = fast::clamp((along - R) / fast::max(reach - R, 0.001000000047497451305389404296875), 0.0, 1.0);
        float core = exp((-d) / ((0.89999997615814208984375 * px) + 0.0007999999797903001308441162109375)) * step(R, along);
        float halo = exp((-d) / (0.006000000052154064178466796875 + (0.0040000001899898052215576171875 * _247.uGlow)));
        float trail = exp((-fast::max(tip - along, 0.0)) / (0.02999999932944774627685546875 + (0.0500000007450580596923828125 * (1.0 - e)))) * (1.0 - (0.60000002384185791015625 * e));
        float3 c = mix(_247.uRay, _247.uHead, float3(smoothstep(0.4000000059604644775390625, 1.0, u)));
        light += ((c * (((core * (0.3499999940395355224609375 + (0.64999997615814208984375 * u))) * 0.89999997615814208984375) + ((halo * (0.07999999821186065673828125 + (0.5 * trail))) * _247.uGlow))) * step(along, tip + 0.00200000009499490261077880859375));
        float node = step(0.449999988079071044921875, h3);
        float landed = smoothstep(0.85000002384185791015625, 1.0, e);
        float headR = mix(0.006000000052154064178466796875, 0.0040000001899898052215576171875, landed) + (((node * landed) * 0.008000000379979610443115234375) * (1.0 + (0.25 * sin((_247.iTime * 2.0) + fi))));
        light += (((mix(_247.uHead, float3(_247.uNode), float3(node * landed)) * exp((-hd) / (0.008000000379979610443115234375 + ((0.008000000379979610443115234375 * _247.uGlow) * (1.60000002384185791015625 - (0.60000002384185791015625 * landed)))))) * (1.5 - (1.0 * landed))) * _247.uGlow);
        float dot0 = fast::clamp(0.5 - ((hd - headR) / px), 0.0, 1.0);
        float4 param_8 = acc;
        float3 param_9 = mix(float3(1.0), float3(_247.uNode), float3((node * landed) * 0.75));
        float param_10 = dot0 * (0.60000002384185791015625 + (0.4000000059604644775390625 * landed));
        acc = over(param_8, param_9, param_10);
    }
    float wob = (1.0 + (0.01200000010430812835693359375 * sin(_247.iTime * 1.7000000476837158203125))) + (0.07999999821186065673828125 * flash);
    float Ro = R * wob;
    float body = smoothstep(Ro + blur, Ro - blur, r);
    float x = fast::clamp(r / Ro, 0.0, 1.0);
    float rings = 0.5 + (0.5 * cos((x * 130.0) + (0.60000002384185791015625 * sin(ang * 3.0))));
    float band = smoothstep(0.62000000476837158203125, 0.89999997615814208984375, x) * (1.0 - smoothstep(0.9700000286102294921875, 1.0, x));
    float _862;
    if (r < (Ro + blur))
    {
        float2 param_11 = ((p / float2(Ro)) * 3.0) + float2(7.0);
        int param_12 = 3;
        float _876 = fbm(param_11, param_12);
        _862 = _876;
    }
    else
    {
        _862 = 0.5;
    }
    float mottle = _862;
    float3 orb = mix(float3(1.0, 0.980000019073486328125, 0.89999997615814208984375), _247.uCore, float3(smoothstep(0.0, 0.550000011920928955078125, x)));
    orb = mix(orb, _247.uRim, float3(smoothstep(0.64999997615814208984375, 1.0, x)));
    orb *= (0.85000002384185791015625 + (0.300000011920928955078125 * mottle));
    orb = mix(orb, orb * (0.75 + (0.4000000059604644775390625 * rings)), float3(band * focus));
    float4 param_13 = acc;
    float3 param_14 = orb;
    float param_15 = body;
    acc = over(param_13, param_14, param_15);
    light += ((((_247.uCore * exp((-fast::max(r - Ro, 0.0)) / (Ro * (0.25 + (0.3499999940395355224609375 * (1.0 - focus)))))) * (0.449999988079071044921875 + (1.39999997615814208984375 * flash))) * _247.uGlow) * (1.0 - body));
    float cells = 150.0;
    float ac = ((ang / 6.28318023681640625) + 0.5) * cells;
    float cell = floor(ac);
    float2 param_16 = float2(cell, 1.89999997615814208984375);
    float s1 = hash12(param_16);
    float2 param_17 = float2(cell, 5.30000019073486328125);
    float s2 = hash12(param_17);
    float len = (Ro * (0.119999997317790985107421875 + ((0.4000000059604644775390625 * s1) * s1))) * (1.0 + (0.60000002384185791015625 * flash));
    float tang = (((fract(ac) - 0.5) / cells) * 6.28318023681640625) * r;
    float sd = fast::max(abs(tang) - ((0.5 * px) + 0.000600000028498470783233642578125), abs((r - Ro) - (len * 0.5)) - (len * 0.5));
    float spine = fast::clamp(0.5 - (sd / fast::max(px, blur * 0.60000002384185791015625)), 0.0, 1.0) * (0.4000000059604644775390625 + (0.60000002384185791015625 * s2));
    float4 param_18 = acc;
    float3 param_19 = mix(_247.uRim, _247.uCore, float3(s2));
    float param_20 = spine * mix(0.3499999940395355224609375, 1.0, focus);
    acc = over(param_18, param_19, param_20);
    acc *= shown;
    light = (float3(1.0) - exp(-light)) * shown;
    float la = fast::max(light.x, fast::max(light.y, light.z));
    acc = float4(acc.xyz + (light * (1.0 - acc.w)), acc.w + (la * (1.0 - acc.w)));
    float4 base = float4(float3(_247.uBackground) * _247.uBackgroundAlpha, _247.uBackgroundAlpha);
    acc = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    float4 param_21 = acc;
    fragColor = unpremultiply(param_21);
}

fragment flair_seed_head_burst_frag_out flair_seed_head_burst_frag(constant FlairUniforms& _247 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_seed_head_burst_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1133;
    if (_247.flair_flipY > 0.5)
    {
        _1133 = _247.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1133 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1133);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _247);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

