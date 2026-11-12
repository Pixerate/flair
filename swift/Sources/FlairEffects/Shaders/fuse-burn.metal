// flair-metal-hash: 4b3959ec
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
    float uCurve;
    float uWaves;
    float uDuration;
    float3 uCord;
    packed_float3 uSpark;
    float uThickness;
};

struct flair_fuse_burn_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fusePoint(thread const float& s, thread const float& aspect, constant FlairUniforms& _303)
{
    return float2(mix(-0.4199999868869781494140625, 0.4199999868869781494140625, s) * aspect, (_303.uCurve * 0.2199999988079071044921875) * sin((s * 6.28318023681640625) * _303.uWaves));
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
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _303)
{
    float2 p = (fragCoord - (float2(_303.iResolution[0], _303.iResolution[1]) * 0.5)) / float2(_303.iResolution[1u]);
    float px = 1.0 / _303.iResolution[1u];
    float aspect = _303.iResolution[0u] / _303.iResolution[1u];
    float cycle = _303.uDuration + 1.0;
    float t = mod(_303.iTime, cycle);
    float burnt = fast::clamp(t / _303.uDuration, 0.0, 1.0);
    float after = t - _303.uDuration;
    float best = 1000000000.0;
    float along = 0.0;
    float sAt = 0.0;
    float length_ = 0.0;
    float param = 0.0;
    float param_1 = aspect;
    float2 prev = fusePoint(param, param_1, _303);
    for (int i = 1; i <= 48; i++)
    {
        float param_2 = float(i) / 48.0;
        float param_3 = aspect;
        float2 next = fusePoint(param_2, param_3, _303);
        float2 param_4 = p;
        float2 param_5 = prev;
        float2 param_6 = next;
        float2 sg = segment(param_4, param_5, param_6);
        float seg = length(next - prev);
        if (sg.x < best)
        {
            best = sg.x;
            sAt = ((float(i) - 1.0) + sg.y) / 48.0;
            along = length_ + (seg * sg.y);
        }
        length_ += seg;
        prev = next;
    }
    float4 acc = float4(0.0);
    float width = 0.00449999980628490447998046875 * _303.uThickness;
    float ahead = step(burnt, sAt);
    float _453;
    if (ahead > 0.5)
    {
        _453 = width;
    }
    else
    {
        _453 = width * 0.75;
    }
    float wv = _453;
    float cover = 1.0 - smoothstep(wv - px, wv, best);
    float twist = 0.85000002384185791015625 + (0.1500000059604644775390625 * sin(((along * 420.0) / _303.uThickness) + ((best / width) * 2.5)));
    float shade = 1.0 - (0.4000000059604644775390625 * powr(best / fast::max(wv, 9.9999997473787516355514526367188e-05), 2.0));
    float3 cord = (_303.uCord * twist) * shade;
    float3 charred = float3(0.100000001490116119384765625, 0.085000000894069671630859375, 0.07500000298023223876953125) * shade;
    float4 param_7 = acc;
    float3 param_8 = mix(charred, cord, float3(ahead));
    float param_9 = cover;
    acc = over(param_7, param_8, param_9);
    float param_10 = burnt;
    float param_11 = aspect;
    float2 head = fusePoint(param_10, param_11, _303);
    float3 col = float3(0.0);
    if (ahead < 0.5)
    {
        float behind = (burnt - sAt) * length_;
        float2 param_12 = float2(floor(along * 300.0), floor(_303.iTime * 8.0));
        float ember = exp((-behind) / 0.02999999932944774627685546875) + ((0.5 * exp((-behind) / 0.119999997317790985107421875)) * step(0.800000011920928955078125, hash12(param_12)));
        col += ((((float3(_303.uSpark) * float3(1.0, 0.550000011920928955078125, 0.300000011920928955078125)) * ember) * cover) * 1.5);
    }
    float2 q = p - head;
    if ((q.y > 0.0) && (after < 0.0))
    {
        float sway = (q.x - (0.0199999995529651641845703125 * sin((q.y * 25.0) - (_303.iTime * 3.0)))) - (q.y * 0.1500000059604644775390625);
        float plume = (exp(((-sway) * sway) / (3.9999998989515006542205810546875e-05 + (q.y * 0.00120000005699694156646728515625))) * exp((-q.y) * 7.0)) * smoothstep(0.0, 0.02999999932944774627685546875, q.y);
        float4 param_13 = acc;
        float3 param_14 = float3(0.60000002384185791015625, 0.579999983310699462890625, 0.560000002384185791015625);
        float param_15 = plume * 0.2199999988079071044921875;
        acc = over(param_13, param_14, param_15);
    }
    if (after < 0.0)
    {
        float r = length(q);
        float2 param_16 = float2(floor(_303.iTime * 30.0), 2.0);
        float flicker = 0.75 + (0.25 * hash12(param_16));
        col += (((float3(1.0, 0.949999988079071044921875, 0.85000002384185791015625) * exp(((-r) * r) / 4.9999998736893758177757263183594e-05)) * 3.0) * flicker);
        col += (((float3(_303.uSpark) * (0.007000000216066837310791015625 / (r + 0.007000000216066837310791015625))) * 0.60000002384185791015625) * flicker);
        if (r < 0.20000000298023223876953125)
        {
            float w = fast::max(0.00179999996908009052276611328125, 0.89999997615814208984375 * px);
            for (int j = 0; j < 28; j++)
            {
                float fj = float(j);
                float2 param_17 = float2(fj, 6.599999904632568359375);
                float2 h = hash22(param_17);
                float period = 0.2199999988079071044921875 + (0.25 * h.y);
                float tt = (_303.iTime / period) + h.x;
                float n = floor(tt);
                float age = (tt - n) * period;
                float2 param_18 = float2(fj * 2.2999999523162841796875, n);
                float2 s = hash22(param_18);
                float a = mix(-0.4000000059604644775390625, 3.53999996185302734375, s.x);
                float2 v = float2(cos(a), sin(a)) * mix(0.4000000059604644775390625, 1.10000002384185791015625, s.y);
                float2 param_19 = v;
                float param_20 = 7.0;
                float param_21 = 0.800000011920928955078125;
                float param_22 = age;
                float2 sh = head + ballistic(param_19, param_20, param_21, param_22);
                float2 param_23 = v;
                float param_24 = 7.0;
                float param_25 = 0.800000011920928955078125;
                float param_26 = fast::max(age - 0.0350000001490116119384765625, 0.0);
                float2 st = head + ballistic(param_23, param_24, param_25, param_26);
                float2 param_27 = p;
                float2 param_28 = st;
                float2 param_29 = sh;
                float param_30 = w;
                col += (((mix(float3(1.0, 0.949999988079071044921875, 0.800000011920928955078125), float3(_303.uSpark), float3(age / period)) * streak(param_27, param_28, param_29, param_30)) * (1.0 - (age / period))) * 1.2999999523162841796875);
            }
        }
    }
    else
    {
        float r_1 = length(q);
        col += (((mix(float3(1.0), float3(_303.uSpark), float3(0.4000000059604644775390625)) * exp((-r_1) * 12.0)) * exp((-after) * 6.0)) * 2.0);
        col += ((float3(1.0, 0.89999997615814208984375, 0.699999988079071044921875) * exp(-powr((r_1 - (after * 0.60000002384185791015625)) / 0.006000000052154064178466796875, 2.0))) * exp((-after) * 5.0));
    }
    float3 param_31 = col;
    float4 _871 = glow(param_31);
    float4 light = _871;
    float4 param_32 = acc;
    float3 param_33 = light.xyz;
    float param_34 = light.w;
    acc = over(param_32, param_33, param_34);
    float4 param_35 = acc;
    fragColor = unpremultiply(param_35);
}

fragment flair_fuse_burn_frag_out flair_fuse_burn_frag(constant FlairUniforms& _303 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fuse_burn_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _896;
    if (_303.flair_flipY > 0.5)
    {
        _896 = _303.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _896 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _896);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _303);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

