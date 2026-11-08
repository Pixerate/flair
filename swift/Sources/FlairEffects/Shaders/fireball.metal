// flair-metal-hash: 0727c446
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
    float uSize;
    float uTail;
    float uSpeed;
    float uSparks;
    uint uFollow;
    float3 uHot;
    float3 uMid;
    float3 uCool;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_fireball_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 swoop(thread const float& t, thread const float& aspect)
{
    return float2((0.36000001430511474609375 * aspect) * sin(t * 0.89999997615814208984375), (0.23999999463558197021484375 * sin((t * 1.7999999523162841796875) + 0.5)) + (0.039999999105930328369140625 * sin(t * 2.7000000476837158203125)));
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
float flameNoise(thread const float2& p, thread const float& t)
{
    float2 param = (p * 0.60000002384185791015625) + float2(0.0, (-t) * 0.5);
    int param_1 = 3;
    float _292 = fbm(param, param_1);
    float2 param_2 = (p * 0.60000002384185791015625) + float2(4.30000019073486328125, 1.7000000476837158203125 - (t * 0.699999988079071044921875));
    int param_3 = 3;
    float _304 = fbm(param_2, param_3);
    float2 w = float2(_292, _304);
    float2 param_4 = (p + ((w - float2(0.5)) * 1.7999999523162841796875)) + float2(0.0, -t);
    int param_5 = 4;
    float _320 = fbm(param_4, param_5);
    return _320;
}

static inline __attribute__((always_inline))
float3 fireLight(thread float& h, constant FlairUniforms& _243)
{
    h = fast::clamp(h, 0.0, 1.0);
    float3 c = _243.uCool * smoothstep(0.0, 0.20000000298023223876953125, h);
    c = mix(c, _243.uMid, float3(smoothstep(0.2199999988079071044921875, 0.550000011920928955078125, h)));
    c = mix(c, _243.uHot, float3(smoothstep(0.60000002384185791015625, 0.949999988079071044921875, h)));
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
float4 fireBase(constant FlairUniforms& _243)
{
    return float4(float3(_243.uBackground) * _243.uBackgroundAlpha, _243.uBackgroundAlpha);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _243)
{
    float px = 1.0 / _243.iResolution[1u];
    float2 p = (fragCoord - (float2(_243.iResolution[0], _243.iResolution[1]) * 0.5)) * px;
    float aspect = _243.iResolution[0u] * px;
    float st = _243.iTime * _243.uSpeed;
    float param = st;
    float param_1 = aspect;
    float2 c = swoop(param, param_1);
    float param_2 = st;
    float param_3 = aspect;
    float param_4 = st - 0.07999999821186065673828125;
    float param_5 = aspect;
    float2 vel = ((swoop(param_2, param_3) - swoop(param_4, param_5)) / float2(0.07999999821186065673828125)) * _243.uSpeed;
    bool _598 = _243.uFollow != 0u;
    bool _605;
    if (_598)
    {
        _605 = _243.iPointer.z > 0.0;
    }
    else
    {
        _605 = _598;
    }
    bool _612;
    if (_605)
    {
        _612 = _243.iTrail[0].w > 0.5;
    }
    else
    {
        _612 = _605;
    }
    bool live = _612;
    if (live)
    {
        c = (_243.iPointer.xy - (float2(_243.iResolution[0], _243.iResolution[1]) * 0.5)) * px;
        float4 back = _243.iTrail[4];
        bool _632 = back.w > 0.5;
        bool _641;
        if (_632)
        {
            _641 = (_243.iTrail[0].z - back.z) > 0.0;
        }
        else
        {
            _641 = _632;
        }
        float2 _642;
        if (_641)
        {
            _642 = ((_243.iTrail[0].xy - back.xy) * px) / float2(fast::max(_243.iTrail[0].z - back.z, 0.02999999932944774627685546875));
        }
        else
        {
            _642 = float2(0.0);
        }
        vel = _642;
        vel *= step(_243.iTime - _243.iTrail[0].z, 0.1500000059604644775390625);
    }
    float speed = length(vel);
    float2 dir = fast::normalize(mix(float2(0.0, 1.0), (-vel) / float2(fast::max(speed, 9.9999997473787516355514526367188e-05)), float2(smoothstep(0.0500000007450580596923828125, 0.60000002384185791015625, speed))) + float2(0.0, 0.25));
    float len = _243.uSize * (1.5 + ((7.0 * _243.uTail) * smoothstep(0.0, 0.800000011920928955078125, speed)));
    float2 q = p - c;
    float2 local = float2(dot(q, float2(dir.y, -dir.x)), dot(q, dir));
    float t = _243.iTime * 2.400000095367431640625;
    float2 param_6 = (float2(local.x, local.y - ((speed * _243.iTime) * 0.300000011920928955078125)) * 18.0) / float2(fast::max(_243.uSize * 10.0, 0.5));
    float param_7 = t;
    float n = flameNoise(param_6, param_7);
    float r = length(q);
    float2 param_8 = ((q * 40.0) / float2(fast::max(_243.uSize * 10.0, 0.5))) + float2(0.0, -t);
    int param_9 = 3;
    float _772 = fbm(param_8, param_9);
    float churn = _772;
    float ball = smoothstep(_243.uSize * 1.10000002384185791015625, _243.uSize * 0.449999988079071044921875, r + (((n - 0.5) * _243.uSize) * 0.800000011920928955078125)) * (0.699999988079071044921875 + (0.3499999940395355224609375 * churn));
    float along = fast::clamp(local.y / len, 0.0, 1.0);
    float width = (_243.uSize * (1.0 - (along * 0.85000002384185791015625))) * (0.699999988079071044921875 + (0.60000002384185791015625 * n));
    float d = length(float2(local.x, local.y - (along * len))) - width;
    float tail = (smoothstep(_243.uSize * 0.300000011920928955078125, (-_243.uSize) * 0.5, d - (((n - 0.5) * _243.uSize) * 0.89999997615814208984375)) * (0.85000002384185791015625 - (0.64999997615814208984375 * along))) * smoothstep(0.1500000059604644775390625, 0.60000002384185791015625, n + (0.3499999940395355224609375 * (1.0 - along)));
    float heat = fast::max(ball, tail);
    float param_10 = heat * 1.10000002384185791015625;
    float3 _863 = fireLight(param_10, _243);
    float3 light = _863;
    light += ((_243.uMid * exp((-r) / (_243.uSize * 1.2000000476837158203125))) * 0.300000011920928955078125);
    float shed = (exp((-fast::max(local.y, 0.0)) / (len + 0.0500000007450580596923828125)) * smoothstep(-_243.uSize, _243.uSize * 0.5, local.y)) * exp((-abs(local.x)) / (_243.uSize * 1.5));
    float2 param_11 = p - (c * 0.60000002384185791015625);
    float param_12 = _243.iTime;
    float param_13 = _243.uSparks;
    light += (((mix(_243.uHot, _243.uMid, float3(0.4000000059604644775390625)) * sparks(param_11, param_12, param_13)) * shed) * 2.0);
    float4 param_14 = fireBase(_243);
    float3 param_15 = light;
    float4 _937 = fireOver(param_14, param_15);
    fragColor = _937;
}

fragment flair_fireball_frag_out flair_fireball_frag(constant FlairUniforms& _243 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fireball_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _950;
    if (_243.flair_flipY > 0.5)
    {
        _950 = _243.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _950 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _950);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _243);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

