// flair-metal-hash: df091c48
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
    float3 uSkyTop;
    float3 uSkyHorizon;
    float3 uGround;
    float3 uColor;
    packed_float3 uTint;
    float uRate;
    float uRadiantX;
    float uRadiantY;
    float uSpeed;
    float uLength;
    float uWidth;
    float uHorizon;
    float uMilkyWay;
    float uStars;
};

struct flair_meteor_shower_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& fragCoord, thread const float& density, constant FlairUniforms& _290)
{
    float2 cell = floor(fragCoord / float2(3.0));
    float2 param = cell;
    float h = hash12(param);
    float on = step(1.0 - (0.01200000010430812835693359375 * density), h);
    float2 param_1 = cell;
    float2 at = hash22(param_1) * 3.0;
    float d = length((fract(fragCoord / float2(3.0)) * 3.0) - at);
    float2 param_2 = cell + float2(7.0);
    return ((on * smoothstep(1.39999997615814208984375, 0.0, d)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_2)))) * (0.75 + (0.25 * sin((_290.iTime * (1.0 + (3.0 * h))) + (h * 40.0))));
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
    bool _370 = abs(dot(q, float2(-dir.y, dir.x))) > reach;
    bool _378;
    if (!_370)
    {
        _378 = x < (-reach);
    }
    else
    {
        _378 = _370;
    }
    bool _387;
    if (!_378)
    {
        _387 = x > (hx + reach);
    }
    else
    {
        _387 = _378;
    }
    if (_387)
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
float skyline(thread const float& x, thread const float& horizon, thread const float& trees)
{
    float2 param = float2(x * 2.2000000476837158203125, 3.099999904632568359375);
    int param_1 = 4;
    float _538 = fbm(param, param_1);
    float hill = horizon * (0.75 + (0.5 * _538));
    float y = hill;
    float cell = 0.0280000008642673492431640625;
    float c = floor(x / cell);
    for (int k = -1; k <= 1; k++)
    {
        float id = c + float(k);
        float2 param_2 = float2(id, 4.400000095367431640625);
        float2 h = hash22(param_2);
        if (h.x < (1.0 - (0.550000011920928955078125 * trees)))
        {
            continue;
        }
        float cx = ((id + 0.5) * cell) + (((h.y - 0.5) * cell) * 0.60000002384185791015625);
        float height = (horizon * (0.180000007152557373046875 + (0.300000011920928955078125 * h.y))) + 0.00999999977648258209228515625;
        y = fast::max(y, (hill + height) - (abs(x - cx) / 0.23999999463558197021484375));
    }
    return y;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _290)
{
    float px = 1.0 / _290.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _290.iResolution[0u] * px;
    float2 uv = fragCoord / float2(_290.iResolution[0], _290.iResolution[1]);
    float3 col = mix(_290.uSkyHorizon, _290.uSkyTop, float3((smoothstep(_290.uHorizon, 1.0, p.y) * 0.800000011920928955078125) + (0.20000000298023223876953125 * uv.y)));
    float2 axis = float2(0.87621593475341796875, 0.481918752193450927734375);
    float across = dot(p - float2(aspect * 0.5, 0.449999988079071044921875), float2(-axis.y, axis.x));
    float along = dot(p, axis);
    float2 param = float2(along * 3.0, across * 6.0);
    int param_1 = 5;
    float _700 = fbm(param, param_1);
    float band = exp((-(across * across)) / 0.02559999935328960418701171875) * (0.550000011920928955078125 + (0.60000002384185791015625 * _700));
    float2 param_2 = float2((along * 5.0) + 3.0, across * 14.0);
    int param_3 = 4;
    float _714 = fbm(param_2, param_3);
    float lanes = smoothstep(0.449999988079071044921875, 0.75, _714) * exp((-(across * across)) / 0.0024999999441206455230712890625);
    col += ((((mix(_290.uSkyHorizon * 1.60000002384185791015625, float3(0.85000002384185791015625, 0.819999992847442626953125, 0.949999988079071044921875), float3(0.3499999940395355224609375)) * band) * (1.0 - (0.800000011920928955078125 * lanes))) * 0.3499999940395355224609375) * _290.uMilkyWay);
    float2 param_4 = fragCoord;
    float param_5 = 1.0 + ((3.0 * band) * _290.uMilkyWay);
    col += float3(stars(param_4, param_5, _290) * _290.uStars);
    float2 radiant = float2(_290.uRadiantX * aspect, _290.uRadiantY);
    float w = _290.uWidth * px;
    float beat = floor(_290.iTime * _290.uRate);
    for (int i = 0; i < 12; i++)
    {
        float k = beat - float(i);
        float2 param_6 = float2(k, 2.900000095367431640625);
        float2 param_7 = float2(k, 8.1000003814697265625);
        float3 h = float3(hash22(param_6), hash12(param_7));
        float2 param_8 = float2(k, 6.599999904632568359375);
        float2 g = hash22(param_8);
        float t = _290.iTime - ((k + h.x) / _290.uRate);
        float dur = (0.3499999940395355224609375 + (0.5 * g.y)) / _290.uSpeed;
        if (t > (dur + 1.5))
        {
            continue;
        }
        float ang = h.y * 6.28318023681640625;
        float2 dir = float2(cos(ang), sin(ang));
        float r0 = 0.0599999986588954925537109375 + (1.10000002384185791015625 * h.z);
        float dist = r0 * (0.25 + (0.3499999940395355224609375 * g.x));
        float bright = 0.449999988079071044921875 + (2.2000000476837158203125 * powr(g.x * g.y, 2.0));
        float3 tail = mix(_290.uColor, float3(_290.uTint), float3(smoothstep(0.4000000059604644775390625, 0.89999997615814208984375, h.x) * 0.800000011920928955078125));
        float2 param_9 = p;
        float2 param_10 = radiant + (dir * r0);
        float2 param_11 = dir;
        float param_12 = dist;
        float param_13 = dur;
        float param_14 = t;
        float param_15 = _290.uLength * (0.60000002384185791015625 + (0.800000011920928955078125 * g.x));
        float param_16 = w * (0.699999988079071044921875 + (0.5 * bright));
        float param_17 = 0.4000000059604644775390625;
        float param_18 = 0.4000000059604644775390625 * bright;
        float3 param_19 = _290.uColor;
        float3 param_20 = tail;
        col += (meteor(param_9, param_10, param_11, param_12, param_13, param_14, param_15, param_16, param_17, param_18, param_19, param_20) * bright);
    }
    bool _946 = _290.uHorizon > 0.0;
    bool _958;
    if (_946)
    {
        _958 = p.y < ((_290.uHorizon * 1.75) + 0.0199999995529651641845703125);
    }
    else
    {
        _958 = _946;
    }
    if (_958)
    {
        float param_21 = p.x;
        float param_22 = _290.uHorizon;
        float param_23 = 1.0;
        float ground = skyline(param_21, param_22, param_23);
        float edge = smoothstep(-px, px, ground - p.y);
        col = mix(col, _290.uGround + ((_290.uSkyHorizon * 0.0599999986588954925537109375) * exp((-(ground - p.y)) / 0.00999999977648258209228515625)), float3(edge));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_meteor_shower_frag_out flair_meteor_shower_frag(constant FlairUniforms& _290 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_meteor_shower_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1014;
    if (_290.flair_flipY > 0.5)
    {
        _1014 = _290.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1014 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1014);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _290);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

