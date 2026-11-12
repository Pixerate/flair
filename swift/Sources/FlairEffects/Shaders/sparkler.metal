// flair-metal-hash: 078534d4
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
    float2 uPosition;
    char _m14_pad[8];
    packed_float3 uColor;
    float uDensity;
    float uLength;
    float uIntensity;
    uint uStick;
};

struct flair_sparkler_frag_out
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
    float2 home = (_295.uPosition * float2(aspect, 1.0)) * 0.5;
    float2 pointer = (_295.iPointer.xy - (float2(_295.iResolution[0], _295.iResolution[1]) * 0.5)) / float2(_295.iResolution[1u]);
    float2 tip = mix(home, pointer, float2(fast::clamp(_295.iPointer.z, 0.0, 1.0)));
    float4 acc = float4(0.0);
    if (_295.uStick != 0u)
    {
        float2 down = float2(0.2696299254894256591796875, -0.962963998317718505859375);
        float2 param = p;
        float2 param_1 = tip;
        float2 param_2 = tip + (down * 0.60000002384185791015625);
        float2 wire = segment(param, param_1, param_2);
        float4 param_3 = acc;
        float3 param_4 = float3(0.319999992847442626953125, 0.310000002384185791015625, 0.300000011920928955078125);
        float param_5 = 1.0 - smoothstep(0.00150000001303851604461669921875, 0.00150000001303851604461669921875 + px, wire.x);
        acc = over(param_3, param_4, param_5);
        float2 param_6 = p;
        float2 param_7 = tip + (down * 0.00999999977648258209228515625);
        float2 param_8 = tip + (down * 0.300000011920928955078125);
        float2 coat = segment(param_6, param_7, param_8);
        float4 param_9 = acc;
        float3 param_10 = float3(0.4199999868869781494140625, 0.4000000059604644775390625, 0.37000000476837158203125);
        float param_11 = (1.0 - smoothstep(0.00449999980628490447998046875, 0.00449999980628490447998046875 + px, coat.x)) * 0.949999988079071044921875;
        acc = over(param_9, param_10, param_11);
    }
    float3 col = float3(0.0);
    float w = fast::max(0.00179999996908009052276611328125, 0.89999997615814208984375 * px);
    if (length(p - tip) < ((0.4199999868869781494140625 * _295.uLength) + 0.0500000007450580596923828125))
    {
        for (int j = 0; j < 48; j++)
        {
            float fj = float(j);
            float2 param_12 = float2(fj, 7.13000011444091796875);
            float2 h = hash22(param_12);
            float period = 0.2800000011920928955078125 + (0.300000011920928955078125 * h.y);
            float tt = (_295.iTime / period) + h.x;
            float n = floor(tt);
            float u = tt - n;
            float2 param_13 = float2(fj * 3.099999904632568359375, n);
            float2 s = hash22(param_13);
            if (s.x > _295.uDensity)
            {
                continue;
            }
            float angle = s.y * 6.28318023681640625;
            float2 param_14 = float2(n, fj + 3.2999999523162841796875);
            float speed = mix(0.60000002384185791015625, 1.60000002384185791015625, hash12(param_14)) * _295.uLength;
            float2 v = float2(cos(angle), sin(angle)) * speed;
            float k = 6.0;
            float g = 0.60000002384185791015625;
            float2 param_15 = float2(fj, n + 0.5);
            float forkAt = mix(0.449999988079071044921875, 0.800000011920928955078125, hash12(param_15));
            float ta = fast::min(u, forkAt) * period;
            float2 param_16 = v;
            float param_17 = k;
            float param_18 = g;
            float param_19 = ta;
            float2 head = tip + ballistic(param_16, param_17, param_18, param_19);
            float2 param_20 = v;
            float param_21 = k;
            float param_22 = g;
            float param_23 = fast::max(ta - 0.04500000178813934326171875, 0.0);
            float2 tail = tip + ballistic(param_20, param_21, param_22, param_23);
            float alive = float(u < forkAt);
            float2 param_24 = p;
            float2 param_25 = tail;
            float2 param_26 = head;
            float param_27 = w;
            col += (((mix(float3(1.0, 0.949999988079071044921875, 0.800000011920928955078125), float3(_295.uColor), float3(u)) * streak(param_24, param_25, param_26, param_27)) * alive) * 1.60000002384185791015625);
            if (u >= forkAt)
            {
                float since = (u - forkAt) * period;
                float flash = exp((-since) * 22.0);
                if (flash < 0.0199999995529651641845703125)
                {
                    continue;
                }
                float grow = 1.0 - exp((-since) * 40.0);
                float2 heading = fast::normalize(v + float2(9.9999997473787516355514526367188e-06));
                for (int b = 0; b < 3; b++)
                {
                    float fb = float(b);
                    float2 param_28 = float2(fj + fb, n);
                    float turn = ((fb - 1.0) * 0.89999997615814208984375) + ((hash12(param_28) - 0.5) * 0.800000011920928955078125);
                    float2 bd = float2((heading.x * cos(turn)) - (heading.y * sin(turn)), (heading.x * sin(turn)) + (heading.y * cos(turn)));
                    float2 param_29 = float2(fb, fj + n);
                    float len = ((0.02500000037252902984619140625 + (0.02999999932944774627685546875 * hash12(param_29))) * _295.uLength) * grow;
                    float2 param_30 = p;
                    float2 param_31 = head;
                    float2 param_32 = head + (bd * len);
                    float param_33 = w * 0.800000011920928955078125;
                    col += (((float3(_295.uColor) * streak(param_30, param_31, param_32, param_33)) * flash) * 1.60000002384185791015625);
                }
            }
        }
    }
    float r = length(p - tip);
    float2 param_34 = float2(floor(_295.iTime * 25.0), 1.0);
    float flicker = 0.800000011920928955078125 + (0.20000000298023223876953125 * hash12(param_34));
    col += ((float3(1.0, 0.9700000286102294921875, 0.89999997615814208984375) * exp(((-r) * r) / 5.9999998484272509813308715820312e-05)) * 3.0);
    col += (((float3(_295.uColor) * (0.006000000052154064178466796875 / (r + 0.006000000052154064178466796875))) * 0.5) * flicker);
    float3 param_35 = col * _295.uIntensity;
    float4 _781 = glow(param_35);
    float4 light = _781;
    float4 param_36 = acc;
    float3 param_37 = light.xyz;
    float param_38 = light.w;
    acc = over(param_36, param_37, param_38);
    float4 param_39 = acc;
    fragColor = unpremultiply(param_39);
}

fragment flair_sparkler_frag_out flair_sparkler_frag(constant FlairUniforms& _295 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_sparkler_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _806;
    if (_295.flair_flipY > 0.5)
    {
        _806 = _295.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _806 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _806);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _295);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

