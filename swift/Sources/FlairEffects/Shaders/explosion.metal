// flair-metal-hash: a43f1640
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
    float2 uPosition;
    float uSize;
    float uPeriod;
    float3 uFire;
    packed_float3 uSmoke;
    float uSmokeAmount;
    uint uAuto;
};

struct flair_explosion_frag_out
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
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float3 fireRamp(thread float& t, constant FlairUniforms& _423)
{
    t = fast::clamp(t, 0.0, 1.0);
    float3 c = mix(_423.uFire * 0.25, _423.uFire, float3(smoothstep(0.0, 0.4000000059604644775390625, t)));
    c = mix(c, float3(1.0, 0.85000002384185791015625, 0.4000000059604644775390625), float3(smoothstep(0.4000000059604644775390625, 0.75, t)));
    return mix(c, float3(1.0, 0.980000019073486328125, 0.89999997615814208984375), float3(smoothstep(0.75, 1.0, t)));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
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
float4 explode(thread float4& acc, thread const float2& p, thread const float2& c, thread const float& t, thread const float& seed, thread const float& scale, thread const float& px, constant FlairUniforms& _423)
{
    float end = fast::min(_423.uPeriod, 3.599999904632568359375);
    if ((t < 0.0) || (t > end))
    {
        return acc;
    }
    float2 q = p - c;
    if (length(q) > (scale * 1.60000002384185791015625))
    {
        return acc;
    }
    float out_ = 1.0 - smoothstep(end * 0.60000002384185791015625, end, t);
    float3 col = float3(0.0);
    float2 sq = (q - float2(0.0, (0.119999997317790985107421875 * t) * scale)) / float2(scale);
    float sr = 0.20000000298023223876953125 + (0.20000000298023223876953125 * sqrt(t));
    float2 param = (sq * 5.0) + float2(seed, (-t) * 0.60000002384185791015625);
    int param_1 = 5;
    float _525 = fbm(param, param_1);
    float sn = _525;
    float sd = (length(sq * float2(0.89999997615814208984375, 1.10000002384185791015625)) / sr) - ((sn - 0.5) * 1.2000000476837158203125);
    float smoke = (((1.0 - smoothstep(0.25, 1.10000002384185791015625, sd)) * smoothstep(0.0500000007450580596923828125, 0.3499999940395355224609375, t)) * out_) * _423.uSmokeAmount;
    float3 smokeCol = mix(float3(_423.uSmoke), (float3(_423.uSmoke) * 0.60000002384185791015625) + (_423.uFire * 0.3499999940395355224609375), float3(exp((-t) * 1.60000002384185791015625) * (1.0 - smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, sd))));
    float4 param_2 = acc;
    float3 param_3 = smokeCol * (0.800000011920928955078125 + (0.4000000059604644775390625 * sn));
    float param_4 = smoke * 0.920000016689300537109375;
    acc = over(param_2, param_3, param_4);
    float R = ((scale * 0.319999992847442626953125) * (1.0 - exp((-t) * 7.0))) + 0.001000000047497451305389404296875;
    float2 fq = q - float2(0.0, (0.0500000007450580596923828125 * t) * scale);
    float2 param_5 = ((fq / float2(scale)) * 7.0) + float2(-seed, (-t) * 1.39999997615814208984375);
    int param_6 = 5;
    float _625 = fbm(param_5, param_6);
    float fn = _625;
    float fd = (length(fq) / R) + ((fn - 0.5) * 0.89999997615814208984375);
    float heat = exp((-t) * 1.5) * out_;
    float temp = ((1.0 - smoothstep(0.0, 1.0499999523162841796875, fd)) * heat) * (0.60000002384185791015625 + (((1.39999997615814208984375 * fn) * fn) * 2.0));
    float param_7 = temp;
    float3 _659 = fireRamp(param_7, _423);
    col += ((_659 * smoothstep(0.0199999995529651641845703125, 0.300000011920928955078125, temp)) * 1.5);
    float rr = length(q);
    float ring = (scale * 1.25) * (1.0 - exp((-t) * 2.599999904632568359375));
    float rw = fast::max(0.0040000001899898052215576171875, 1.5 * px) + (0.00999999977648258209228515625 * t);
    float wave = exp(-powr((rr - ring) / rw, 2.0)) * exp((-t) * 3.0);
    float haze = (smoothstep(ring - (0.119999997317790985107421875 * scale), ring, rr) * step(rr, ring)) * exp((-t) * 4.0);
    col += (float3(1.0, 0.920000016689300537109375, 0.800000011920928955078125) * ((wave * 1.2000000476837158203125) + (haze * 0.180000007152557373046875)));
    col += (((mix(float3(1.0), _423.uFire, float3(0.4000000059604644775390625)) * exp(((-rr) * 4.0) / scale)) * exp((-t) * 10.0)) * 1.5);
    float w = fast::max(0.0024999999441206455230712890625, px);
    for (int j = 0; j < 36; j++)
    {
        float fj = float(j);
        float2 param_8 = float2(fj, seed + 2.0);
        float2 h = hash22(param_8);
        float2 param_9 = float2(seed, fj);
        float life = 0.60000002384185791015625 + (1.0 * hash12(param_9));
        if (t > life)
        {
            continue;
        }
        float a = h.x * 6.28318023681640625;
        float2 v = (float2(cos(a), (sin(a) * 0.800000011920928955078125) + 0.25) * (0.800000011920928955078125 + (1.39999997615814208984375 * h.y))) * scale;
        float2 param_10 = v;
        float param_11 = 2.2000000476837158203125;
        float param_12 = 1.10000002384185791015625;
        float param_13 = t;
        float2 head = c + ballistic(param_10, param_11, param_12, param_13);
        float2 param_14 = v;
        float param_15 = 2.2000000476837158203125;
        float param_16 = 1.10000002384185791015625;
        float param_17 = fast::max(t - 0.0599999986588954925537109375, 0.0);
        float2 tail = c + ballistic(param_14, param_15, param_16, param_17);
        float f = 1.0 - smoothstep(life * 0.4000000059604644775390625, life, t);
        float2 param_18 = p;
        float2 param_19 = tail;
        float2 param_20 = head;
        float param_21 = w;
        col += (((mix(float3(1.0, 0.89999997615814208984375, 0.60000002384185791015625), _423.uFire, float3(t / life)) * streak(param_18, param_19, param_20, param_21)) * f) * 1.5);
    }
    float3 param_22 = col;
    float4 _870 = glow(param_22);
    float4 light = _870;
    float4 param_23 = acc;
    float3 param_24 = light.xyz;
    float param_25 = light.w;
    return over(param_23, param_24, param_25);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _423)
{
    float2 p = (fragCoord - (float2(_423.iResolution[0], _423.iResolution[1]) * 0.5)) / float2(_423.iResolution[1u]);
    float px = 1.0 / _423.iResolution[1u];
    float aspect = _423.iResolution[0u] / _423.iResolution[1u];
    float4 acc = float4(0.0);
    if (_423.uAuto != 0u)
    {
        float4 param = acc;
        float2 param_1 = p;
        float2 param_2 = (_423.uPosition * float2(aspect, 1.0)) * 0.5;
        float param_3 = mod(_423.iTime, _423.uPeriod);
        float param_4 = 3.7000000476837158203125;
        float param_5 = 0.64999997615814208984375 * _423.uSize;
        float param_6 = px;
        float4 _941 = explode(param, param_1, param_2, param_3, param_4, param_5, param_6, _423);
        acc = _941;
    }
    for (int i = 7; i >= 0; i--)
    {
        float4 click = _423.iClicks[i];
        if (click.w < 0.5)
        {
            continue;
        }
        float2 c = (click.xy - (float2(_423.iResolution[0], _423.iResolution[1]) * 0.5)) / float2(_423.iResolution[1u]);
        float4 param_7 = acc;
        float2 param_8 = p;
        float2 param_9 = c;
        float param_10 = _423.iTime - click.z;
        float param_11 = fract(click.z * 0.617999970912933349609375) * 50.0;
        float param_12 = 0.37999999523162841796875 * _423.uSize;
        float param_13 = px;
        float4 _1001 = explode(param_7, param_8, param_9, param_10, param_11, param_12, param_13, _423);
        acc = _1001;
    }
    float4 param_14 = acc;
    fragColor = unpremultiply(param_14);
}

fragment flair_explosion_frag_out flair_explosion_frag(constant FlairUniforms& _423 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_explosion_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1018;
    if (_423.flair_flipY > 0.5)
    {
        _1018 = _423.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1018 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1018);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _423);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

