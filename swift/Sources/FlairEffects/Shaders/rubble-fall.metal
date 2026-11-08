// flair-metal-hash: f9893b21
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
    float3 uRock;
    float3 uConcrete;
    packed_float3 uDust;
    float uCount;
    float uSize;
    float uGravity;
    float uBounce;
    float uPile;
    float uDustAmount;
};

struct flair_rubble_fall_frag_out
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
float heapTop(thread const float& x, constant FlairUniforms& _493)
{
    float2 param = float2(x * 2.5, 1.7000000476837158203125);
    return (-0.5) + (_493.uPile * (0.449999988079071044921875 + (0.550000011920928955078125 * vnoise(param))));
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float3 rock(thread const float2& q, thread const float& r, thread const float& seed)
{
    float a = precise::atan2(q.y, q.x);
    if (a < 0.0)
    {
        a += 6.28318023681640625;
    }
    float wedge = 0.897597134113311767578125;
    float i = floor(a / wedge);
    float i1 = i + 1.0;
    float2 param = float2(mod(i, 7.0), seed);
    float2 A = (float2(cos(i * wedge), sin(i * wedge)) * r) * (0.62000000476837158203125 + (0.37999999523162841796875 * hash12(param)));
    float2 param_1 = float2(mod(i1, 7.0), seed);
    float2 B = (float2(cos(i1 * wedge), sin(i1 * wedge)) * r) * (0.62000000476837158203125 + (0.37999999523162841796875 * hash12(param_1)));
    float2 e = B - A;
    float2 n = fast::normalize(float2(e.y, -e.x));
    return float3(dot(q - A, n), n);
}

static inline __attribute__((always_inline))
float3 shadeRock(thread const float2& q, thread const float3& rk, thread const float& r, thread const float& ang, thread const float3& base, thread const float& seed)
{
    float inner = fast::clamp((-rk.x) / (r * 0.300000011920928955078125), 0.0, 1.0);
    float param = ang;
    float2 face = rot(param) * rk.yz;
    float3 n = fast::normalize(float3(face * (0.25 + (1.2999999523162841796875 * (1.0 - inner))), 1.0));
    float diff = fast::clamp(dot(n, float3(-0.4534134566783905029296875, 0.654930531978607177734375, 0.604551255702972412109375)), 0.0, 1.0);
    float2 param_1 = ((q / float2(r)) * 9.0) + float2(seed * 13.0);
    float2 param_2 = floor((q / float2(r)) * 30.0) + float2(seed);
    float speck = (0.60000002384185791015625 * vnoise(param_1)) + (0.4000000059604644775390625 * hash12(param_2));
    float3 col = (base * (0.300000011920928955078125 + (0.89999997615814208984375 * diff))) * (0.800000011920928955078125 + (0.3499999940395355224609375 * speck));
    return col * (1.0 - (0.300000011920928955078125 * smoothstep((-r) * 0.07999999821186065673828125, 0.0, rk.x)));
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
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
float puff(thread const float2& p, thread const float2& at, thread const float& size, thread const float& age, thread const float& life, thread const float& seed)
{
    if ((age < 0.0) || (age > life))
    {
        return 0.0;
    }
    float R = size * (1.0 + (2.2000000476837158203125 * sqrt(age)));
    float2 d = (p - at) - float2(0.0, 0.300000011920928955078125 * R);
    d.y *= 1.7000000476837158203125;
    float l = length(d);
    if (l > R)
    {
        return 0.0;
    }
    float fade = 1.0 - (age / life);
    float2 param = ((p * 22.0) + float2(seed * 7.30000019073486328125)) - float2(0.0, age * 0.60000002384185791015625);
    int param_1 = 3;
    float _572 = fbm(param, param_1);
    float n = _572;
    return ((smoothstep(R, R * 0.1500000059604644775390625, l) * fade) * fade) * (0.300000011920928955078125 + (1.10000002384185791015625 * n));
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _493)
{
    float2 p = (fragCoord - (float2(_493.iResolution[0], _493.iResolution[1]) * 0.5)) / float2(_493.iResolution[1u]);
    float px = 1.0 / _493.iResolution[1u];
    float cw = (_493.iResolution[0u] / _493.iResolution[1u]) / _493.uCount;
    float4 acc = float4(0.0);
    float gs = fast::max((cw * 0.4199999868869781494140625) * _493.uSize, 0.014999999664723873138427734375);
    float2 gc = floor(p / float2(gs));
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 c = gc + float2(float(i), float(j));
            float2 param = c + float2(5.30000019073486328125);
            float2 h = hash22(param);
            float2 site = ((c + float2(0.25)) + (h * 0.5)) * gs;
            float param_1 = site.x;
            float top = heapTop(param_1, _493);
            if (site.y > top)
            {
                continue;
            }
            float r = gs * (0.699999988079071044921875 + (0.25 * h.y));
            float ang = h.x * 6.28318023681640625;
            float param_2 = -ang;
            float2 q = rot(param_2) * (p - site);
            if (length(q) > (r * 1.0499999523162841796875))
            {
                continue;
            }
            float seed = (c.x * 7.099999904632568359375) + (c.y * 1.2999999523162841796875);
            float2 param_3 = q;
            float param_4 = r;
            float param_5 = seed;
            float3 rk = rock(param_3, param_4, param_5);
            float cover = smoothstep(px, -px, rk.x);
            if (cover <= 0.0)
            {
                continue;
            }
            float depth = fast::clamp((top - site.y) / fast::max(_493.uPile, 0.02999999932944774627685546875), 0.0, 1.0);
            float3 base = mix(_493.uRock, _493.uConcrete, float3(step(0.550000011920928955078125, h.y))) * (0.85000002384185791015625 + (0.300000011920928955078125 * h.x));
            float2 param_6 = q;
            float3 param_7 = rk;
            float param_8 = r;
            float param_9 = ang;
            float3 param_10 = base;
            float param_11 = seed;
            float4 param_12 = acc;
            float3 param_13 = shadeRock(param_6, param_7, param_8, param_9, param_10, param_11) * (1.0 - (0.60000002384185791015625 * depth));
            float param_14 = cover;
            acc = over(param_12, param_13, param_14);
        }
    }
    float dust = 0.0;
    float col = floor(p.x / cw);
    float2 pos;
    float ang_1;
    for (int k = -2; k <= 2; k++)
    {
        float c_1 = col + float(k);
        for (int j_1 = 0; j_1 < 3; j_1++)
        {
            float2 id = float2(c_1, float(j_1));
            float2 param_15 = id + float2(0.37000000476837158203125);
            float2 param_16 = id + float2(9.1000003814697265625);
            float4 h_1 = float4(hash22(param_15), hash22(param_16));
            float ta = mod(_493.iTime - (((float(j_1) + h_1.x) * 6.0) / 3.0), 6.0);
            float r_1 = ((cw * 0.4199999868869781494140625) * _493.uSize) * (0.60000002384185791015625 + (0.4000000059604644775390625 * h_1.y));
            float x0 = ((c_1 + 0.5) + (0.300000011920928955078125 * (h_1.z - 0.5))) * cw;
            float param_17 = x0;
            float rest = heapTop(param_17, _493) + (r_1 * 0.449999988079071044921875);
            float y0 = (0.550000011920928955078125 + r_1) + (0.3499999940395355224609375 * h_1.w);
            float t1 = sqrt((2.0 * (y0 - rest)) / _493.uGravity);
            float vx0 = ((h_1.z - 0.5) * 0.25) * cw;
            float vx1 = (((h_1.w - 0.5) * 1.2000000476837158203125) * cw) * _493.uBounce;
            float spin = (h_1.y - 0.5) * 7.0;
            if (ta < t1)
            {
                pos = float2(x0 + (vx0 * ta), y0 - (((0.5 * _493.uGravity) * ta) * ta));
                ang_1 = (h_1.x * 6.28318023681640625) + (spin * ta);
            }
            else
            {
                float tau = ta - t1;
                float y = rest;
                float v = (_493.uGravity * t1) * _493.uBounce;
                float tb = tau;
                for (int b = 0; b < 3; b++)
                {
                    float dur = (2.0 * v) / _493.uGravity;
                    if (tb < dur)
                    {
                        y = (rest + (v * tb)) - (((0.5 * _493.uGravity) * tb) * tb);
                        break;
                    }
                    tb -= dur;
                    v *= _493.uBounce;
                }
                pos = float2((x0 + (vx0 * t1)) + ((vx1 * (1.0 - exp((-3.0) * tau))) / 3.0), y);
                ang_1 = ((h_1.x * 6.28318023681640625) + (spin * t1)) + (((spin * 0.5) * (1.0 - exp((-2.5) * tau))) / 2.5);
                float2 param_18 = p;
                float2 param_19 = float2(x0 + (vx0 * t1), rest - (r_1 * 0.4000000059604644775390625));
                float param_20 = r_1;
                float param_21 = tau;
                float param_22 = 1.60000002384185791015625;
                float param_23 = id.x + (id.y * 3.099999904632568359375);
                dust += puff(param_18, param_19, param_20, param_21, param_22, param_23);
            }
            float crumble = smoothstep(5.099999904632568359375, 5.849999904632568359375, ta);
            float2 param_24 = p;
            float2 param_25 = pos - float2(0.0, r_1 * 0.300000011920928955078125);
            float param_26 = r_1 * 0.60000002384185791015625;
            float param_27 = ta - 5.099999904632568359375;
            float param_28 = 0.89999997615814208984375;
            float param_29 = id.y + (id.x * 1.7000000476837158203125);
            dust += (0.60000002384185791015625 * puff(param_24, param_25, param_26, param_27, param_28, param_29));
            float param_30 = -ang_1;
            float2 q_1 = rot(param_30) * (p - pos);
            if (length(q_1) > (r_1 * 1.0499999523162841796875))
            {
                continue;
            }
            float seed_1 = (id.x * 3.7000000476837158203125) + (id.y * 11.0);
            float2 param_31 = q_1;
            float param_32 = r_1;
            float param_33 = seed_1;
            float3 rk_1 = rock(param_31, param_32, param_33);
            float2 param_34 = floor(q_1 / float2(r_1 * 0.20000000298023223876953125)) + (id * 3.0);
            float bits = hash12(param_34);
            float cover_1 = smoothstep(px, -px, rk_1.x) * step(crumble, bits);
            if (cover_1 <= 0.0)
            {
                continue;
            }
            float3 base_1 = mix(_493.uRock, _493.uConcrete, float3(step(0.5, h_1.z))) * (0.85000002384185791015625 + (0.300000011920928955078125 * h_1.w));
            float2 param_35 = q_1;
            float3 param_36 = rk_1;
            float param_37 = r_1;
            float param_38 = ang_1;
            float3 param_39 = base_1;
            float param_40 = seed_1;
            float4 param_41 = acc;
            float3 param_42 = shadeRock(param_35, param_36, param_37, param_38, param_39, param_40);
            float param_43 = cover_1;
            acc = over(param_41, param_42, param_43);
        }
    }
    float2 param_44 = p * 40.0;
    float n = vnoise(param_44);
    float4 param_45 = acc;
    float3 param_46 = float3(_493.uDust) * (0.800000011920928955078125 + (0.300000011920928955078125 * n));
    float param_47 = fast::clamp(dust * _493.uDustAmount, 0.0, 0.89999997615814208984375);
    acc = over(param_45, param_46, param_47);
    float4 param_48 = acc;
    fragColor = unpremultiply(param_48);
}

fragment flair_rubble_fall_frag_out flair_rubble_fall_frag(constant FlairUniforms& _493 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_rubble_fall_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1260;
    if (_493.flair_flipY > 0.5)
    {
        _1260 = _493.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1260 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1260);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _493);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

