// flair-metal-hash: aacb62ba
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float2 uBase;
    float uAngle;
    float uInterval;
    float uHeight;
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
};

struct flair_roman_candle_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.999999717180685365747194737196e-10), 0.0, 1.0);
    return float2(length(pa - (ba * h)), h);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
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
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _295)
{
    float2 p = (fragCoord - (float2(_295.iResolution[0], _295.iResolution[1]) * 0.5)) / float2(_295.iResolution[1u]);
    float px = 1.0 / _295.iResolution[1u];
    float aspect = _295.iResolution[0u] / _295.iResolution[1u];
    float2 base = (_295.uBase * float2(aspect, 1.0)) * 0.5;
    float2 dir = float2(sin(_295.uAngle), cos(_295.uAngle));
    float4 acc = float4(0.0);
    float2 param = p;
    float2 param_1 = base;
    float2 param_2 = base - (dir * 0.14000000059604644775390625);
    float2 tube = segment(param, param_1, param_2);
    float4 param_3 = acc;
    float3 param_4 = float3(0.449999988079071044921875, 0.100000001490116119384765625, 0.119999997317790985107421875);
    float param_5 = 1.0 - smoothstep(0.010999999940395355224609375, 0.010999999940395355224609375 + px, tube.x);
    acc = over(param_3, param_4, param_5);
    float3 col = float3(0.0);
    float w = fast::max(0.0024999999441206455230712890625, px);
    float k = 0.699999988079071044921875;
    float g = 1.0;
    float shot = floor(_295.iTime / _295.uInterval);
    float3 _428;
    float3 _439;
    for (int i = 0; i < 5; i++)
    {
        float n = shot - float(i);
        float age = _295.iTime - (n * _295.uInterval);
        float life = 1.89999997615814208984375;
        if ((age > life) || (n < 0.0))
        {
            continue;
        }
        float2 param_6 = float2(n, 5.5);
        float2 h = hash22(param_6);
        if (mod(n, 3.0) < 0.5)
        {
            _428 = _295.uColorA;
        }
        else
        {
            if (mod(n, 3.0) < 1.5)
            {
                _439 = _295.uColorB;
            }
            else
            {
                _439 = _295.uColorC;
            }
            _428 = _439;
        }
        float3 tint = _428;
        float2 v = (((dir + float2((h.x - 0.5) * 0.07999999821186065673828125, 0.0)) * (0.949999988079071044921875 + (0.100000001490116119384765625 * h.y))) * _295.uHeight) * 1.4500000476837158203125;
        float2 param_7 = v;
        float param_8 = k;
        float param_9 = g;
        float param_10 = age;
        float2 ball = base + ballistic(param_7, param_8, param_9, param_10);
        if (length(p - ball) > 0.449999988079071044921875)
        {
            continue;
        }
        float burn = 1.0 - smoothstep(life * 0.64999997615814208984375, life, age);
        float r = length(p - ball);
        col += (((mix(float3(1.0), tint, float3(0.3499999940395355224609375)) * exp(((-r) * r) / ((0.0003000000142492353916168212890625 * burn) + 9.9999999747524270787835121154785e-07))) * 2.5) * burn);
        col += (((tint * (0.01200000010430812835693359375 / (r + 0.01200000010430812835693359375))) * 0.4000000059604644775390625) * burn);
        float2 param_11 = v;
        float param_12 = k;
        float param_13 = g;
        float param_14 = fast::max(age - 0.2199999988079071044921875, 0.0);
        float2 tail = base + ballistic(param_11, param_12, param_13, param_14);
        float2 param_15 = p;
        float2 param_16 = tail;
        float2 param_17 = ball;
        float param_18 = w * 2.599999904632568359375;
        col += (((tint * streak(param_15, param_16, param_17, param_18)) * burn) * 1.10000002384185791015625);
        for (int j = 0; j < 8; j++)
        {
            float fj = float(j);
            float2 param_19 = float2(fj + (n * 13.0), 2.2000000476837158203125);
            float2 s = hash22(param_19);
            float te = s.x * age;
            float sa = age - te;
            if (sa > 0.3499999940395355224609375)
            {
                continue;
            }
            float2 param_20 = v;
            float param_21 = k;
            float param_22 = g;
            float param_23 = te;
            float2 from = base + ballistic(param_20, param_21, param_22, param_23);
            float a = s.y * 6.28318023681640625;
            float2 sv = float2(cos(a), sin(a)) * 0.449999988079071044921875;
            float2 param_24 = sv;
            float param_25 = 4.0;
            float param_26 = 0.800000011920928955078125;
            float param_27 = sa;
            float2 head = from + ballistic(param_24, param_25, param_26, param_27);
            float2 param_28 = sv;
            float param_29 = 4.0;
            float param_30 = 0.800000011920928955078125;
            float param_31 = fast::max(sa - 0.039999999105930328369140625, 0.0);
            float2 stail = from + ballistic(param_28, param_29, param_30, param_31);
            float2 param_32 = p;
            float2 param_33 = stail;
            float2 param_34 = head;
            float param_35 = w;
            col += ((((mix(float3(1.0, 0.85000002384185791015625, 0.60000002384185791015625), tint, float3(0.5)) * streak(param_32, param_33, param_34, param_35)) * (1.0 - (sa / 0.3499999940395355224609375))) * burn) * 1.5);
        }
    }
    float since = _295.iTime - (shot * _295.uInterval);
    float m = length(p - base);
    float2 param_36 = float2(floor(_295.iTime * 28.0), 3.0);
    float flicker = 0.699999988079071044921875 + (0.300000011920928955078125 * hash12(param_36));
    col += ((float3(1.0, 0.800000011920928955078125, 0.5) * ((exp((-since) * 14.0) * 2.0) + (0.25 * flicker))) * exp(((-m) * m) / 0.00039999998989515006542205810546875));
    float3 param_37 = col;
    float4 _738 = glow(param_37);
    float4 light = _738;
    float4 param_38 = acc;
    float3 param_39 = light.xyz;
    float param_40 = light.w;
    acc = over(param_38, param_39, param_40);
    float4 param_41 = acc;
    fragColor = unpremultiply(param_41);
}

fragment flair_roman_candle_frag_out flair_roman_candle_frag(constant FlairUniforms& _295 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_roman_candle_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _762;
    if (_295.flair_flipY > 0.5)
    {
        _762 = _295.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _762 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _762);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _295);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

