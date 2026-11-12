// flair-metal-hash: 3fb473cd
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
    float uRadius;
    float uHeight;
    float uSpeed;
    float uSparks;
    float uFlare;
    float3 uHot;
    float3 uMid;
    float3 uCool;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_fire_ring_frag_out
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
float flameNoise(thread const float2& p, thread const float& t)
{
    float2 param = (p * 0.60000002384185791015625) + float2(0.0, (-t) * 0.5);
    int param_1 = 3;
    float _299 = fbm(param, param_1);
    float2 param_2 = (p * 0.60000002384185791015625) + float2(4.30000019073486328125, 1.7000000476837158203125 - (t * 0.699999988079071044921875));
    int param_3 = 3;
    float _311 = fbm(param_2, param_3);
    float2 w = float2(_299, _311);
    float2 param_4 = (p + ((w - float2(0.5)) * 1.7999999523162841796875)) + float2(0.0, -t);
    int param_5 = 4;
    float _327 = fbm(param_4, param_5);
    return _327;
}

static inline __attribute__((always_inline))
float3 edgeLift(thread const float2& p, thread const float& t, thread const float& height)
{
    float2 param = (p * 7.0) / float2(fast::max(height * 8.0, 0.4000000059604644775390625));
    float param_1 = t;
    float n = flameNoise(param, param_1);
    float2 param_2 = float2((p.y * 9.0) - (t * 1.2999999523162841796875), p.x * 3.0);
    float side = vnoise(param_2) - 0.5;
    return float3((side * height) * 0.5, height * (0.0500000007450580596923828125 + ((1.60000002384185791015625 * n) * n)), n);
}

static inline __attribute__((always_inline))
float edgeHeat(thread const float& sd, thread const float3& lift, thread const float& height)
{
    float band = smoothstep(height * 0.319999992847442626953125, 0.0, abs(sd));
    float cool = fast::clamp(lift.y / (height * 1.25), 0.0, 1.0);
    return (band * (1.0499999523162841796875 - cool)) * (0.550000011920928955078125 + (0.699999988079071044921875 * lift.z));
}

static inline __attribute__((always_inline))
float3 fireLight(thread float& h, constant FlairUniforms& _250)
{
    h = fast::clamp(h, 0.0, 1.0);
    float3 c = _250.uCool * smoothstep(0.0, 0.20000000298023223876953125, h);
    c = mix(c, _250.uMid, float3(smoothstep(0.2199999988079071044921875, 0.550000011920928955078125, h)));
    c = mix(c, _250.uHot, float3(smoothstep(0.60000002384185791015625, 0.949999988079071044921875, h)));
    return c * (0.699999988079071044921875 + ((3.0 * h) * h));
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
float4 fireBase(constant FlairUniforms& _250)
{
    return float4(float3(_250.uBackground) * _250.uBackgroundAlpha, _250.uBackgroundAlpha);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _250)
{
    float px = 1.0 / _250.iResolution[1u];
    float2 p = ((fragCoord - (float2(_250.iResolution[0], _250.iResolution[1]) * 0.5)) * px) + float2(0.0, 0.0500000007450580596923828125);
    float flare = 1.0 + (_250.uFlare * fast::clamp(_250.iPointer.z, 0.0, 1.0));
    float height = _250.uHeight * flare;
    float t = ((_250.iTime * _250.uSpeed) * 1.7999999523162841796875) * mix(1.0, flare, 0.5);
    float2 param = p;
    float param_1 = t;
    float param_2 = height;
    float3 lift = edgeLift(param, param_1, param_2);
    float param_3 = length(p - lift.xy) - _250.uRadius;
    float3 param_4 = lift;
    float param_5 = height;
    float heat = edgeHeat(param_3, param_4, param_5);
    float sd = length(p) - _250.uRadius;
    heat = fast::max(heat, smoothstep(0.006000000052154064178466796875 + px, 0.0, abs(sd)) * (0.550000011920928955078125 + (0.300000011920928955078125 * lift.z)));
    float param_6 = heat * mix(1.0, 1.14999997615814208984375, flare - 1.0);
    float3 _693 = fireLight(param_6, _250);
    float3 light = _693;
    light += (((_250.uMid * exp((-abs(sd)) / (height * 0.60000002384185791015625))) * 0.119999997317790985107421875) * flare);
    float2 param_7 = p;
    float param_8 = _250.iTime * _250.uSpeed;
    float param_9 = _250.uSparks * flare;
    light += (((((mix(_250.uHot, _250.uMid, float3(0.4000000059604644775390625)) * sparks(param_7, param_8, param_9)) * exp((-fast::max(sd, 0.0)) / (height * 2.0))) * smoothstep(-0.00999999977648258209228515625, 0.0199999995529651641845703125, sd)) * smoothstep((-_250.uRadius) * 0.60000002384185791015625, _250.uRadius * 0.4000000059604644775390625, p.y)) * 1.60000002384185791015625);
    float4 param_10 = fireBase(_250);
    float3 param_11 = light;
    float4 _762 = fireOver(param_10, param_11);
    fragColor = _762;
}

fragment flair_fire_ring_frag_out flair_fire_ring_frag(constant FlairUniforms& _250 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fire_ring_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _775;
    if (_250.flair_flipY > 0.5)
    {
        _775 = _250.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _775 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _775);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _250);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

