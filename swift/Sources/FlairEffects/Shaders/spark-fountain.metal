// flair-metal-hash: 58785c27
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
    float2 uBase;
    char _m14_pad[8];
    packed_float3 uColor;
    float uHeight;
    float uSpread;
    float uDensity;
    float uIntensity;
};

struct flair_spark_fountain_frag_out
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
float2 ballistic(thread const float2& v, thread const float& k, thread const float& g, thread const float& t)
{
    float e = (1.0 - exp((-k) * t)) / k;
    return (v * e) - float2(0.0, (g / k) * (t - e));
}

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.999999717180685365747194737196e-10), 0.0, 1.0);
    return float2(length(pa - (ba * h)), h);
}

static inline __attribute__((always_inline))
float streak(thread const float2& p, thread const float2& tail, thread const float2& head, thread const float& w)
{
    float2 param = p;
    float2 param_1 = tail;
    float2 param_2 = head;
    float2 s = segment(param, param_1, param_2);
    float along = mix(0.07999999821186065673828125, 1.0, s.y * s.y);
    return (exp(((-s.x) * s.x) / (w * w)) + (0.119999997317790985107421875 * exp((-s.x) / (w * 3.0)))) * along;
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _247)
{
    float2 p = (fragCoord - (float2(_247.iResolution[0], _247.iResolution[1]) * 0.5)) / float2(_247.iResolution[1u]);
    float px = 1.0 / _247.iResolution[1u];
    float aspect = _247.iResolution[0u] / _247.iResolution[1u];
    float2 base = (_247.uBase * float2(aspect, 1.0)) * 0.5;
    float3 col = float3(0.0);
    float w = fast::max(0.002199999988079071044921875, px);
    float k = 1.39999997615814208984375;
    float g = 1.5;
    float margin = 30.0 * w;
    float vmax = (1.35000002384185791015625 * _247.uHeight) * 1.25;
    float xmax = ((vmax * sin(fast::min(_247.uSpread * 1.2000000476837158203125, 1.57079994678497314453125))) * (1.0 - exp((-k) * 1.7999999523162841796875))) / k;
    float apex = log(1.0 + ((vmax * k) / g)) / k;
    float ea = (1.0 - exp((-k) * apex)) / k;
    float ymax = (vmax * ea) - ((g / k) * (apex - ea));
    float2 rel = p - base;
    bool _365 = abs(rel.x) < (xmax + margin);
    bool _374;
    if (_365)
    {
        _374 = rel.y > ((-0.00999999977648258209228515625) - margin);
    }
    else
    {
        _374 = _365;
    }
    bool _383;
    if (_374)
    {
        _383 = rel.y < (ymax + margin);
    }
    else
    {
        _383 = _374;
    }
    bool inReach = _383;
    for (int j = 0; j < 112; j++)
    {
        if (!inReach)
        {
            break;
        }
        float fj = float(j);
        float2 param = float2(fj, 2.309999942779541015625);
        float2 h = hash22(param);
        float life = 1.0 + (0.800000011920928955078125 * h.y);
        float tt = (_247.iTime / life) + h.x;
        float n = floor(tt);
        float age = (tt - n) * life;
        float2 param_1 = float2(fj * 1.7000000476837158203125, n);
        float2 param_2 = float2(n, fj + 0.37000000476837158203125);
        float3 s = float3(hash22(param_1), hash12(param_2));
        if (s.z > _247.uDensity)
        {
            continue;
        }
        float a = (((s.x - 0.5) * 2.0) * _247.uSpread) * 1.2000000476837158203125;
        bool _473 = (a * rel.x) < 0.0;
        bool _481;
        if (_473)
        {
            _481 = abs(rel.x) > margin;
        }
        else
        {
            _481 = _473;
        }
        if (_481)
        {
            continue;
        }
        float2 v = ((float2(sin(a), cos(a)) * mix(0.89999997615814208984375, 1.35000002384185791015625, s.y)) * _247.uHeight) * 1.25;
        float2 param_3 = v;
        float param_4 = k;
        float param_5 = g;
        float param_6 = age;
        float2 head = base + ballistic(param_3, param_4, param_5, param_6);
        float2 param_7 = v;
        float param_8 = k;
        float param_9 = g;
        float param_10 = fast::max(age - 0.070000000298023223876953125, 0.0);
        float2 tail = base + ballistic(param_7, param_8, param_9, param_10);
        if (head.y < (base.y - 0.00999999977648258209228515625))
        {
            continue;
        }
        bool _546 = any(p < (fast::min(head, tail) - float2(margin)));
        bool _559;
        if (!_546)
        {
            _559 = any(p > (fast::max(head, tail) + float2(margin)));
        }
        else
        {
            _559 = _546;
        }
        if (_559)
        {
            continue;
        }
        float fade = 1.0 - smoothstep(0.5, 1.0, age / life);
        float2 param_11 = float2(fj, floor(_247.iTime * 24.0));
        float twinkle = 0.60000002384185791015625 + (0.4000000059604644775390625 * hash12(param_11));
        float3 tint = mix(float3(1.0, 0.959999978542327880859375, 0.85000002384185791015625), float3(_247.uColor), float3(smoothstep(0.0, 0.5, age)));
        float2 param_12 = p;
        float2 param_13 = tail;
        float2 param_14 = head;
        float param_15 = w;
        col += ((((tint * streak(param_12, param_13, param_14, param_15)) * fade) * twinkle) * 1.2000000476837158203125);
    }
    float2 q = p - base;
    float2 param_16 = float2(floor(_247.iTime * 30.0), 4.0);
    float flicker = 0.85000002384185791015625 + (0.1500000059604644775390625 * hash12(param_16));
    col += (((float3(1.0, 0.949999988079071044921875, 0.85000002384185791015625) * exp((-powr(q.x / 0.01200000010430812835693359375, 2.0)) - powr((q.y - 0.0199999995529651641845703125) / 0.039999999105930328369140625, 2.0))) * 2.0) * flicker);
    col += (((float3(_247.uColor) * (0.01200000010430812835693359375 / (length(q) + 0.01200000010430812835693359375))) * 0.60000002384185791015625) * flicker);
    col += ((((float3(_247.uColor) * exp((-abs(q.y)) * 45.0)) * exp((-abs(q.x)) * 5.0)) * 0.4000000059604644775390625) * _247.uHeight);
    float3 param_17 = col * _247.uIntensity;
    float4 _695 = glow(param_17);
    fragColor = _695;
}

fragment flair_spark_fountain_frag_out flair_spark_fountain_frag(constant FlairUniforms& _247 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_spark_fountain_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _708;
    if (_247.flair_flipY > 0.5)
    {
        _708 = _247.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _708 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _708);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _247);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

