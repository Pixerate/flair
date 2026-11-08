// flair-metal-hash: 9611fe9c
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
    packed_float3 uTint;
    float uLevel;
    float uSize;
    int uDrops;
    float uGravity;
    uint uSurface;
};

struct flair_water_splash_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float2 segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    float h = fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.999999717180685365747194737196e-10), 0.0, 1.0);
    return float2(length(pa - (ba * h)), h);
}

static inline __attribute__((always_inline))
float4 waterBead(thread float4& acc, thread const float2& p, thread const float2& a, thread const float2& b, thread const float& r, thread const float& k, thread const float& px, constant FlairUniforms& _260)
{
    float2 param = p;
    float2 param_1 = a;
    float2 param_2 = b;
    float2 sg = segment(param, param_1, param_2);
    float d = sg.x - r;
    float m = fast::clamp(0.5 - (d / px), 0.0, 1.0) * k;
    if (m <= 0.0)
    {
        return acc;
    }
    float2 c = mix(a, b, float2(sg.y));
    float2 n = (p - c) / float2(fast::max(r, 9.9999997473787516355514526367188e-06));
    float rim = smoothstep(0.5, 1.0, length(n));
    float glint = 1.0 - smoothstep(0.0, 0.3499999940395355224609375, length(n - float2(-0.3499999940395355224609375, 0.4000000059604644775390625)));
    float caustic = 1.0 - smoothstep(0.0, 0.550000011920928955078125, length(n - float2(0.1500000059604644775390625, -0.449999988079071044921875)));
    float4 param_3 = acc;
    float3 param_4 = float3(_260.uTint);
    float param_5 = m * 0.300000011920928955078125;
    acc = over(param_3, param_4, param_5);
    float4 param_6 = acc;
    float3 param_7 = float3(_260.uTint) * 0.25;
    float param_8 = (rim * m) * 0.449999988079071044921875;
    acc = over(param_6, param_7, param_8);
    float4 param_9 = acc;
    float3 param_10 = mix(float3(_260.uTint), float3(1.0), float3(0.699999988079071044921875));
    float param_11 = (caustic * m) * 0.449999988079071044921875;
    acc = over(param_9, param_10, param_11);
    float4 param_12 = acc;
    float3 param_13 = float3(1.0);
    float param_14 = (glint * m) * 0.949999988079071044921875;
    return over(param_12, param_13, param_14);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _260)
{
    float px = 1.0 / _260.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _260.iResolution[0u] / _260.iResolution[1u];
    float level0 = _260.uLevel;
    float g = 2.0 * _260.uGravity;
    float4 acc = float4(0.0);
    if (_260.uSurface != 0u)
    {
        float below = level0 - p.y;
        float4 param = acc;
        float3 param_1 = float3(_260.uTint);
        float param_2 = (0.1599999964237213134765625 * step(0.0, below)) * exp((-fast::max(below, 0.0)) / 0.25);
        acc = over(param, param_1, param_2);
        float4 param_3 = acc;
        float3 param_4 = float3(1.0);
        float param_5 = 0.60000002384185791015625 * exp((-abs(below)) / (1.2000000476837158203125 * px));
        acc = over(param_3, param_4, param_5);
    }
    float t = mod(_260.iTime, 8.0);
    for (int i = -1; i < 3; i++)
    {
        float k = floor(t / 1.0) - float(i);
        float slot = mod(k, 8.0);
        float tau = t - (k * 1.0);
        float2 param_6 = float2((slot * 1.71000003814697265625) + 0.300000011920928955078125, 5.900000095367431640625);
        float2 h = hash22(param_6);
        float2 o = float2((0.119999997317790985107421875 + (0.7599999904632568359375 * h.x)) * aspect, level0);
        float size = _260.uSize * (0.699999988079071044921875 + (0.5 * h.y));
        if (tau < 0.0)
        {
            float tb = -tau;
            if (tb > 0.4000000059604644775390625)
            {
                continue;
            }
            float2 c = o + float2(0.0, ((3.2000000476837158203125 * tb) * tb) + 0.00999999977648258209228515625);
            float4 param_7 = acc;
            float2 param_8 = p;
            float2 param_9 = c;
            float2 param_10 = c + float2(0.0, 0.02999999932944774627685546875 + (0.07999999821186065673828125 * tb));
            float param_11 = 0.008000000379979610443115234375 * size;
            float param_12 = 1.0;
            float param_13 = px;
            float4 _492 = waterBead(param_7, param_8, param_9, param_10, param_11, param_12, param_13, _260);
            acc = _492;
            continue;
        }
        if (tau > 2.2000000476837158203125)
        {
            continue;
        }
        for (int j = 0; j < 2; j++)
        {
            float rr = ((tau - (0.300000011920928955078125 * float(j))) * 0.2199999988079071044921875) * size;
            if (rr <= 0.0)
            {
                continue;
            }
            float de = length(float2(p.x - o.x, ((p.y - level0) + 0.01200000010430812835693359375) / 0.180000007152557373046875)) - rr;
            float fade = (1.0 - smoothstep(0.300000011920928955078125, 2.2000000476837158203125, tau)) * step(p.y, level0);
            float4 param_14 = acc;
            float3 param_15 = float3(1.0);
            float param_16 = (0.550000011920928955078125 * exp(((-de) * de) / ((4.0 * px) * px))) * fade;
            acc = over(param_14, param_15, param_16);
        }
        if (tau < 0.699999988079071044921875)
        {
            float hj = (0.20000000298023223876953125 * size) * sin((3.141590118408203125 * tau) / 0.699999988079071044921875);
            float4 param_17 = acc;
            float2 param_18 = p;
            float2 param_19 = o;
            float2 param_20 = o + float2(0.0, hj);
            float param_21 = (0.01200000010430812835693359375 * size) * (1.0 - ((0.5 * tau) / 0.699999988079071044921875));
            float param_22 = 1.0;
            float param_23 = px;
            float4 _608 = waterBead(param_17, param_18, param_19, param_20, param_21, param_22, param_23, _260);
            acc = _608;
        }
        for (int j_1 = 0; j_1 < 40; j_1++)
        {
            if (j_1 >= _260.uDrops)
            {
                break;
            }
            float2 param_24 = float2(float(j_1) + 0.5, (slot * 3.7000000476837158203125) + 1.0);
            float2 param_25 = float2(slot + 0.300000011920928955078125, float(j_1) * 1.89999997615814208984375);
            float3 hh = float3(hash22(param_24), hash12(param_25));
            float a = (hh.x - 0.5) * 1.89999997615814208984375;
            float speed = ((0.550000011920928955078125 + (0.64999997615814208984375 * hh.y)) * sqrt(size)) * sqrt(_260.uGravity);
            float2 v = float2(sin(a) * 0.800000011920928955078125, cos(a)) * speed;
            float td = tau - (0.02999999932944774627685546875 * hh.z);
            if (td <= 0.0)
            {
                continue;
            }
            float2 c_1 = (o + (v * td)) - float2(0.0, ((0.5 * g) * td) * td);
            if (c_1.y < level0)
            {
                continue;
            }
            float2 vel = v - float2(0.0, g * td);
            bool _724 = abs(p.x - c_1.x) > 0.0599999986588954925537109375;
            bool _735;
            if (!_724)
            {
                _735 = abs(p.y - c_1.y) > 0.0599999986588954925537109375;
            }
            else
            {
                _735 = _724;
            }
            if (_735)
            {
                continue;
            }
            float r = (0.0035000001080334186553955078125 + ((0.0089999996125698089599609375 * hh.z) * hh.z)) * size;
            float4 param_26 = acc;
            float2 param_27 = p;
            float2 param_28 = c_1;
            float2 param_29 = c_1 - (vel * 0.02199999988079071044921875);
            float param_30 = r;
            float param_31 = smoothstep(level0, level0 + 0.00999999977648258209228515625, c_1.y);
            float param_32 = px;
            float4 _774 = waterBead(param_26, param_27, param_28, param_29, param_30, param_31, param_32, _260);
            acc = _774;
        }
    }
    float4 param_33 = acc;
    fragColor = unpremultiply(param_33);
}

fragment flair_water_splash_frag_out flair_water_splash_frag(constant FlairUniforms& _260 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_water_splash_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _794;
    if (_260.flair_flipY > 0.5)
    {
        _794 = _260.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _794 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _794);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _260);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

