// flair-metal-hash: ea92ab0b
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float3 uHead;
    packed_float3 uTail;
    float uInterval;
    float uAngle;
    float uSpread;
    float uSpeed;
    float uDistance;
    float uLength;
    float uWidth;
    float uFlare;
    float uSparks;
    float uTrain;
    float uStars;
    uint uClicks;
};

struct flair_shooting_star_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& fragCoord, thread const float& density, constant FlairUniforms& _192)
{
    float2 cell = floor(fragCoord / float2(3.0));
    float2 param = cell;
    float h = hash12(param);
    float on = step(1.0 - (0.01200000010430812835693359375 * density), h);
    float2 param_1 = cell;
    float2 at = hash22(param_1) * 3.0;
    float d = length((fract(fragCoord / float2(3.0)) * 3.0) - at);
    float2 param_2 = cell + float2(7.0);
    return ((on * smoothstep(1.39999997615814208984375, 0.0, d)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_2)))) * (0.75 + (0.25 * sin((_192.iTime * (1.0 + (3.0 * h))) + (h * 40.0))));
}

static inline __attribute__((always_inline))
float meteorBrightness(thread const float& u, thread const float& flare)
{
    float f = (u - 0.819999992847442626953125) / 0.0500000007450580596923828125;
    return (smoothstep(0.0, 0.119999997317790985107421875, u) * (1.0 - smoothstep(0.7200000286102294921875, 1.0, u))) + (flare * exp((-f) * f));
}

static inline __attribute__((always_inline))
float3 meteor(thread const float2& p, thread const float2& a, thread const float2& dir, thread const float& dist, thread const float& dur, thread const float& t, thread const float& len, thread const float& w, thread const float& train, thread const float& flare, thread const float3& head, thread const float3& tail)
{
    if (t < 0.0)
    {
        return float3(0.0);
    }
    float speed = dist / dur;
    float2 q = p - a;
    float x = dot(q, dir);
    float hx = fast::min(t, dur) * speed;
    float reach = w * 14.0;
    bool _274 = abs(dot(q, float2(-dir.y, dir.x))) > reach;
    bool _282;
    if (!_274)
    {
        _282 = x < (-reach);
    }
    else
    {
        _282 = _274;
    }
    bool _291;
    if (!_282)
    {
        _291 = x > (hx + reach);
    }
    else
    {
        _291 = _282;
    }
    if (_291)
    {
        return float3(0.0);
    }
    float xc = fast::clamp(x, 0.0, hx);
    float param = xc / dist;
    float param_1 = flare;
    float b = meteorBrightness(param, param_1);
    float age = t - (xc / speed);
    float behind = (age * speed) / len;
    float wd = w * (0.3499999940395355224609375 + (0.64999997615814208984375 * exp((-behind) * 2.0)));
    float e = length(q - (dir * xc));
    float line = exp((-(e * e)) / (wd * wd)) * b;
    float3 col = (mix(head, tail, float3(fast::clamp(behind * 3.0, 0.0, 1.0))) * line) * exp((-behind) * 3.0);
    col += ((((tail * line) * train) * 0.300000011920928955078125) * exp((-age) * 1.39999997615814208984375));
    float param_2 = hx / dist;
    float param_3 = flare;
    float hb = meteorBrightness(param_2, param_3) * exp((-fast::max(t - dur, 0.0)) * 14.0);
    float r = length(q - (dir * hx));
    return col + ((mix(head, float3(1.0), float3(0.5)) * hb) * ((1.60000002384185791015625 * exp((-(r * r)) / (w * w))) + (0.3499999940395355224609375 * exp((-r) / (w * 4.0)))));
}

static inline __attribute__((always_inline))
float3 meteorSparks(thread const float2& p, thread const float2& a, thread const float2& dir, thread const float& dist, thread const float& dur, thread const float& t, thread const float& w, thread const float& flare, thread const float& sparks, thread const float& seed, thread const float3& colour)
{
    if (t < 0.0)
    {
        return float3(0.0);
    }
    float speed = dist / dur;
    float2 n = float2(-dir.y, dir.x);
    float2 q = p - a;
    float x = dot(q, dir);
    float hx = fast::min(t, dur) * speed;
    bool _476 = (abs(dot(q, n)) > ((w * 3.0) + 0.039999999105930328369140625)) || (x < (-0.02999999932944774627685546875));
    bool _485;
    if (!_476)
    {
        _485 = x > (hx + 0.02999999932944774627685546875);
    }
    else
    {
        _485 = _476;
    }
    if (_485)
    {
        return float3(0.0);
    }
    float3 col = float3(0.0);
    float cell = 0.02500000037252902984619140625;
    float k0 = floor(x / cell);
    for (int k = -1; k <= 1; k++)
    {
        float c = k0 + float(k);
        float2 param = float2(c, seed);
        float2 h = hash22(param);
        float xs = (c + h.x) * cell;
        bool _530 = (xs < 0.0) || (xs > hx);
        bool _538;
        if (!_530)
        {
            _538 = h.y > sparks;
        }
        else
        {
            _538 = _530;
        }
        if (_538)
        {
            continue;
        }
        float age = t - (xs / speed);
        float2 param_1 = float2(seed, c * 1.7000000476837158203125);
        float life = 0.3499999940395355224609375 + (0.60000002384185791015625 * hash12(param_1));
        if (age > life)
        {
            continue;
        }
        float2 at = ((a + (dir * (xs + (0.00999999977648258209228515625 * (1.0 - exp((-age) * 3.0)))))) + ((n * ((h.y / sparks) - 0.5)) * ((w * 2.0) + (0.02999999932944774627685546875 * age)))) - ((float2(0.0, 0.0199999995529651641845703125) * age) * age);
        float r = length(p - at);
        float twinkle = 0.60000002384185791015625 + (0.4000000059604644775390625 * sin((age * 40.0) + c));
        float param_2 = xs / dist;
        float param_3 = flare;
        col += ((((colour * exp((-(r * r)) / ((w * w) * 0.300000011920928955078125))) * (1.0 - (age / life))) * twinkle) * meteorBrightness(param_2, param_3));
    }
    return col;
}

static inline __attribute__((always_inline))
float3 launch(thread const float2& p, thread const float2& from, thread const float& t, thread const float& seed, constant FlairUniforms& _192)
{
    float2 param = float2(seed, 1.7000000476837158203125);
    float2 param_1 = float2(seed, 5.30000019073486328125);
    float3 h = float3(hash22(param), hash12(param_1));
    float ang = radians(_192.uAngle + (_192.uSpread * ((2.0 * h.x) - 1.0)));
    float2 dir = float2(cos(ang), sin(ang));
    float dist = _192.uDistance * (0.699999988079071044921875 + (0.60000002384185791015625 * h.y));
    float dur = dist / (_192.uSpeed * (0.800000011920928955078125 + (0.4000000059604644775390625 * h.z)));
    float w = _192.uWidth / _192.iResolution[1u];
    float2 param_2 = p;
    float2 param_3 = from;
    float2 param_4 = dir;
    float param_5 = dist;
    float param_6 = dur;
    float param_7 = t;
    float param_8 = _192.uLength;
    float param_9 = w;
    float param_10 = _192.uTrain;
    float param_11 = _192.uFlare;
    float3 param_12 = _192.uHead;
    float3 param_13 = float3(_192.uTail);
    float3 c = meteor(param_2, param_3, param_4, param_5, param_6, param_7, param_8, param_9, param_10, param_11, param_12, param_13);
    if (_192.uSparks > 0.0)
    {
        float2 param_14 = p;
        float2 param_15 = from;
        float2 param_16 = dir;
        float param_17 = dist;
        float param_18 = dur;
        float param_19 = t;
        float param_20 = w;
        float param_21 = _192.uFlare;
        float param_22 = _192.uSparks;
        float param_23 = seed;
        float3 param_24 = mix(_192.uHead, float3(_192.uTail), float3(0.5));
        c += meteorSparks(param_14, param_15, param_16, param_17, param_18, param_19, param_20, param_21, param_22, param_23, param_24);
    }
    return c;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _192)
{
    float px = 1.0 / _192.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _192.iResolution[0u] * px;
    float2 param = fragCoord;
    float param_1 = 1.0;
    float3 light = float3(stars(param, param_1, _192) * _192.uStars);
    float beat = floor(_192.iTime / _192.uInterval);
    for (int i = 0; i < 5; i++)
    {
        float k = beat - float(i);
        float2 param_2 = float2(k, 9.1000003814697265625);
        float2 h = hash22(param_2);
        float t = _192.iTime - ((k + (0.60000002384185791015625 * h.x)) * _192.uInterval);
        if (t > (((1.2999999523162841796875 * _192.uDistance) / (0.800000011920928955078125 * _192.uSpeed)) + 3.0))
        {
            continue;
        }
        float2 param_3 = float2(k, 1.7000000476837158203125);
        float2 param_4 = float2(k, 5.30000019073486328125);
        float3 g = float3(hash22(param_3), hash12(param_4));
        float ang = radians(_192.uAngle + (_192.uSpread * ((2.0 * g.x) - 1.0)));
        float dist = _192.uDistance * (0.699999988079071044921875 + (0.60000002384185791015625 * g.y));
        float2 param_5 = float2(k, 3.2999999523162841796875);
        float2 mid = float2((0.1500000059604644775390625 + (0.699999988079071044921875 * h.y)) * aspect, 0.4000000059604644775390625 + (0.4000000059604644775390625 * hash12(param_5)));
        float2 param_6 = p;
        float2 param_7 = mid - ((float2(cos(ang), sin(ang)) * dist) * 0.5);
        float param_8 = t;
        float param_9 = k;
        light += launch(param_6, param_7, param_8, param_9, _192);
    }
    if (_192.uClicks != 0u)
    {
        for (int i_1 = 0; i_1 < 3; i_1++)
        {
            float4 c = _192.iClicks[i_1];
            float t_1 = _192.iTime - c.z;
            bool _965 = c.w < 0.5;
            bool _979;
            if (!_965)
            {
                _979 = t_1 > (((1.2999999523162841796875 * _192.uDistance) / (0.800000011920928955078125 * _192.uSpeed)) + 3.0);
            }
            else
            {
                _979 = _965;
            }
            if (_979)
            {
                continue;
            }
            float2 param_10 = p;
            float2 param_11 = c.xy * px;
            float param_12 = t_1;
            float param_13 = (c.z * 7.13000011444091796875) + float(i_1);
            light += launch(param_10, param_11, param_12, param_13, _192);
        }
    }
    light = float3(1.0) - exp(-fast::max(light, float3(0.0)));
    float a = fast::max(light.x, fast::max(light.y, light.z));
    float3 col = ((float3(_192.uBackground) * _192.uBackgroundAlpha) * (1.0 - a)) + light;
    float alpha = _192.uBackgroundAlpha + (a * (1.0 - _192.uBackgroundAlpha));
    fragColor = float4(fast::min(col / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(1.0)), alpha);
}

fragment flair_shooting_star_frag_out flair_shooting_star_frag(constant FlairUniforms& _192 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_shooting_star_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1067;
    if (_192.flair_flipY > 0.5)
    {
        _1067 = _192.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1067 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1067);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _192);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

