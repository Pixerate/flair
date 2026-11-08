// flair-metal-hash: 640074be
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
    float2 uOrigin;
    float3 uColor;
    packed_float3 uFlashColor;
    float uActivity;
    int uSparks;
    float uSpread;
    float uGravity;
    float uSmoke;
};

struct flair_short_circuit_frag_out
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
float jag(thread const float& x, thread const float& seed)
{
    float i = floor(x);
    float2 param = float2(i, seed);
    float2 param_1 = float2(i + 1.0, seed);
    return (mix(hash12(param), hash12(param_1), fract(x)) * 2.0) - 1.0;
}

static inline __attribute__((always_inline))
float zigzag(thread float& x, thread const float& seed)
{
    float s = 0.0;
    float amp = 0.60000002384185791015625;
    for (int i = 0; i < 5; i++)
    {
        float param = x;
        float param_1 = seed + (float(i) * 17.299999237060546875);
        s += (amp * jag(param, param_1));
        x *= 2.099999904632568359375;
        amp *= 0.5;
    }
    return s;
}

static inline __attribute__((always_inline))
float arcKick(thread const float& t, thread const float& seed, thread const float& rough, thread const float& open)
{
    float env = sqrt(fast::max(sin((3.141590118408203125 * t) * (1.0 - (0.5 * open))), 0.0));
    float param = t * 5.0;
    float param_1 = seed;
    float _333 = zigzag(param, param_1);
    return (_333 * rough) * env;
}

static inline __attribute__((always_inline))
float chordDist(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 1.0000000133514319600180897396058e-10), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
float2 arcDist(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& seed, thread const float& rough, thread const float& open)
{
    float2 ab = b - a;
    float len = fast::max(length(ab), 9.9999997473787516355514526367188e-05);
    float2 dir = ab / float2(len);
    float2 q = p - a;
    float along = dot(q, dir);
    float side = dot(q, float2(-dir.y, dir.x));
    float t = fast::clamp(along / len, 0.0, 1.0);
    float band = (rough * len) * 1.2999999523162841796875;
    if (abs(side) > (band + 0.300000011920928955078125))
    {
        return float2(length(float2(along - (t * len), abs(side) - band)), t);
    }
    float2 lp = float2(along, side);
    float param = t - 0.008000000379979610443115234375;
    float param_1 = seed;
    float param_2 = rough;
    float param_3 = open;
    float2 c0 = float2((t - 0.008000000379979610443115234375) * len, arcKick(param, param_1, param_2, param_3) * len);
    float param_4 = t;
    float param_5 = seed;
    float param_6 = rough;
    float param_7 = open;
    float2 c1 = float2(t * len, arcKick(param_4, param_5, param_6, param_7) * len);
    float param_8 = t + 0.008000000379979610443115234375;
    float param_9 = seed;
    float param_10 = rough;
    float param_11 = open;
    float2 c2 = float2((t + 0.008000000379979610443115234375) * len, arcKick(param_8, param_9, param_10, param_11) * len);
    float2 param_12 = lp;
    float2 param_13 = c0;
    float2 param_14 = c1;
    float2 param_15 = lp;
    float2 param_16 = c1;
    float2 param_17 = c2;
    return float2(fast::min(chordDist(param_12, param_13, param_14), chordDist(param_15, param_16, param_17)), t);
}

static inline __attribute__((always_inline))
float3 arcLight(thread const float& d, thread const float& w, thread const float3& col)
{
    float core = exp(((-d) * d) / (w * w));
    float halo = (0.550000011920928955078125 * exp((-d) / (w * 4.0))) + (0.180000007152557373046875 * exp((-d) / (w * 20.0)));
    return ((mix(col, float3(1.0), float3(0.75)) * core) * 2.0) + (col * halo);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
    return length((p - a) - (ab * t));
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
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _653)
{
    float px = 1.0 / _653.iResolution[1u];
    float2 p = (fragCoord - (float2(_653.iResolution[0], _653.iResolution[1]) * 0.5)) * px;
    float2 o = (_653.uOrigin * float2(_653.iResolution[0u] * px, 1.0)) * 0.5;
    float w = fast::max(0.0024999999441206455230712890625, 0.699999988079071044921875 * px);
    float3 light = float3(0.0);
    float ambient = 0.0;
    float k0 = floor(_653.iTime / 0.300000011920928955078125);
    for (int i = 0; i < 5; i++)
    {
        float k = k0 - float(i);
        float2 param = float2(k, 1.7000000476837158203125);
        if (hash12(param) > _653.uActivity)
        {
            continue;
        }
        float2 param_1 = float2(k, 2.900000095367431640625);
        float age = _653.iTime - ((k + (0.60000002384185791015625 * hash12(param_1))) * 0.300000011920928955078125);
        if ((age < 0.0) || (age > 1.2000000476837158203125))
        {
            continue;
        }
        float2 param_2 = float2(floor(age * 40.0), k);
        float flash = exp((-age) * 14.0) * (0.60000002384185791015625 + (0.4000000059604644775390625 * step(0.5, hash12(param_2))));
        float r = length(p - o);
        light += ((float3(_653.uFlashColor) * ((exp((-r) / 0.0199999995529651641845703125) * 2.0) + (exp((-r) / 0.119999997317790985107421875) * 0.5))) * flash);
        ambient += flash;
        if (age < 0.119999997317790985107421875)
        {
            float2 param_3 = float2(k, 4.400000095367431640625);
            float2 s = float2(0.0350000001490116119384765625, 0.0) * (0.60000002384185791015625 + hash12(param_3));
            float2 param_4 = p;
            float2 param_5 = o - s;
            float2 param_6 = (o + (s.yx * 0.300000011920928955078125)) + s;
            float param_7 = floor(_653.iTime * 40.0);
            float param_8 = 0.3499999940395355224609375;
            float param_9 = 0.0;
            float param_10 = arcDist(param_4, param_5, param_6, param_7, param_8, param_9).x;
            float param_11 = w;
            float3 param_12 = float3(_653.uFlashColor);
            light += (arcLight(param_10, param_11, param_12) * 0.800000011920928955078125);
        }
        float slow = (1.0 - exp((-2.5) * age)) / 2.5;
        for (int j = 0; j < 32; j++)
        {
            if (j >= _653.uSparks)
            {
                break;
            }
            float2 param_13 = float2((float(j) * 7.13000011444091796875) + 1.0, k * 3.099999904632568359375);
            float2 param_14 = float2(k, float(j) + 0.5);
            float3 h = float3(hash22(param_13), hash12(param_14));
            float span = 0.3499999940395355224609375 + (0.75 * h.z);
            if (age > span)
            {
                continue;
            }
            float ang = 1.57079994678497314453125 + ((h.x - 0.5) * 2.7999999523162841796875);
            float2 v0 = (float2(cos(ang), sin(ang)) * _653.uSpread) * (0.4000000059604644775390625 + (0.89999997615814208984375 * h.y));
            float2 pos = (o + (v0 * slow)) - float2(0.0, (((0.5 * _653.uGravity) * 0.800000011920928955078125) * age) * age);
            if (length(p - pos) > 0.100000001490116119384765625)
            {
                continue;
            }
            float2 vel = (v0 * exp((-2.5) * age)) - float2(0.0, (_653.uGravity * 0.800000011920928955078125) * age);
            float2 param_15 = p;
            float2 param_16 = pos;
            float2 param_17 = pos - (vel * 0.0350000001490116119384765625);
            float d = segment(param_15, param_16, param_17);
            float heat = 1.0 - (age / span);
            float3 c = mix(_653.uColor * float3(1.0, 0.550000011920928955078125, 0.3499999940395355224609375), mix(_653.uColor, float3(1.0), float3(0.699999988079071044921875)), float3(heat * heat));
            light += ((c * ((exp(((-d) * d) / (w * w)) * 1.5) + (0.25 * exp((-d) / (w * 3.0))))) * heat);
        }
    }
    light += ((float3(_653.uFlashColor) * fast::min(ambient, 1.0)) * 0.07999999821186065673828125);
    float2 q = p - o;
    float spread = 0.02999999932944774627685546875 + (fast::max(q.y, 0.0) * 0.3499999940395355224609375);
    float2 param_18 = float2(q.x * 7.0, (q.y * 4.0) - (_653.iTime * 0.60000002384185791015625));
    int param_19 = 4;
    float _1056 = fbm(param_18, param_19);
    float plume = _1056;
    float smoke = ((smoothstep(0.4000000059604644775390625, 0.75, plume) * exp(((-q.x) * q.x) / (spread * spread))) * smoothstep(-0.0199999995529651641845703125, 0.039999999105930328369140625, q.y)) * exp((-fast::max(q.y, 0.0)) * 2.5);
    float4 param_20 = float4(0.0);
    float3 param_21 = float3(0.319999992847442626953125, 0.310000002384185791015625, 0.300000011920928955078125);
    float param_22 = fast::clamp(smoke * _653.uSmoke, 0.0, 1.0);
    float4 acc = over(param_20, param_21, param_22);
    float3 param_23 = light;
    float4 _1103 = glow(param_23);
    float4 g = _1103;
    float4 param_24 = acc;
    float3 param_25 = g.xyz;
    float param_26 = g.w;
    acc = over(param_24, param_25, param_26);
    float4 param_27 = acc;
    fragColor = unpremultiply(param_27);
}

fragment flair_short_circuit_frag_out flair_short_circuit_frag(constant FlairUniforms& _653 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_short_circuit_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1127;
    if (_653.flair_flipY > 0.5)
    {
        _1127 = _653.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1127 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1127);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _653);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

