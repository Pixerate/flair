// flair-metal-hash: d945e2e6
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    packed_float3 uColor;
    int uShape;
    float uSize;
    float uSpin;
    float uTilt;
    int uLines;
    float uFarSide;
    float uScanlines;
    float uLineSpacing;
    float uFlicker;
    float uGlitch;
    float uBeam;
    char _m25_pad[8];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

constant spvUnsafeArray<float3, 8> _643 = spvUnsafeArray<float3, 8>({ float3(-0.577400028705596923828125), float3(-0.577400028705596923828125, -0.577400028705596923828125, 0.577400028705596923828125), float3(-0.577400028705596923828125, 0.577400028705596923828125, -0.577400028705596923828125), float3(-0.577400028705596923828125, 0.577400028705596923828125, 0.577400028705596923828125), float3(0.577400028705596923828125, -0.577400028705596923828125, -0.577400028705596923828125), float3(0.577400028705596923828125, -0.577400028705596923828125, 0.577400028705596923828125), float3(0.577400028705596923828125, 0.577400028705596923828125, -0.577400028705596923828125), float3(0.577400028705596923828125) });
constant spvUnsafeArray<int2, 12> _664 = spvUnsafeArray<int2, 12>({ int2(0, 1), int2(0, 2), int2(0, 4), int2(1, 3), int2(1, 5), int2(2, 3), int2(2, 6), int2(3, 7), int2(4, 5), int2(4, 6), int2(5, 7), int2(6, 7) });
constant spvUnsafeArray<float3, 12> _825 = spvUnsafeArray<float3, 12>({ float3(0.0, -0.52569997310638427734375, -0.85070002079010009765625), float3(-0.52569997310638427734375, -0.85070002079010009765625, 0.0), float3(-0.85070002079010009765625, 0.0, -0.52569997310638427734375), float3(0.0, -0.52569997310638427734375, 0.85070002079010009765625), float3(-0.52569997310638427734375, 0.85070002079010009765625, 0.0), float3(0.85070002079010009765625, 0.0, -0.52569997310638427734375), float3(0.0, 0.52569997310638427734375, -0.85070002079010009765625), float3(0.52569997310638427734375, -0.85070002079010009765625, 0.0), float3(-0.85070002079010009765625, 0.0, 0.52569997310638427734375), float3(0.0, 0.52569997310638427734375, 0.85070002079010009765625), float3(0.52569997310638427734375, 0.85070002079010009765625, 0.0), float3(0.85070002079010009765625, 0.0, 0.52569997310638427734375) });
constant spvUnsafeArray<int2, 30> _854 = spvUnsafeArray<int2, 30>({ int2(0, 1), int2(0, 2), int2(0, 5), int2(0, 6), int2(0, 7), int2(1, 2), int2(1, 3), int2(1, 7), int2(1, 8), int2(2, 4), int2(2, 6), int2(2, 8), int2(3, 7), int2(3, 8), int2(3, 9), int2(3, 11), int2(4, 6), int2(4, 8), int2(4, 9), int2(4, 10), int2(5, 6), int2(5, 7), int2(5, 10), int2(5, 11), int2(6, 10), int2(7, 11), int2(8, 9), int2(9, 10), int2(9, 11), int2(10, 11) });

struct flair_hologram_projector_frag_out
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
float3 holoBeam(thread const float2& p, thread const float2& base, thread const float& top, thread const float& width, constant FlairUniforms& _173)
{
    float3 col = float3(0.0);
    float up = (p.y - base.y) / fast::max(top - base.y, 0.001000000047497451305389404296875);
    if ((up > 0.0) && (up < 1.2000000476837158203125))
    {
        float spread = mix(width * 0.119999997317790985107421875, width, fast::clamp(up, 0.0, 1.0));
        float across = abs(p.x - base.x) / spread;
        float2 param = float2(((p.x - base.x) / spread) * 6.0, (up * 2.0) - (_173.iTime * 0.800000011920928955078125));
        float rays = 0.60000002384185791015625 + (0.4000000059604644775390625 * vnoise(param));
        col += ((((float3(_173.uColor) * smoothstep(1.0, 0.60000002384185791015625, across)) * (1.0 - smoothstep(0.0, 1.14999997615814208984375, up))) * rays) * 0.2199999988079071044921875);
        col += (((float3(_173.uColor) * exp(((-across) * across) * 30.0)) * (1.0 - up)) * 0.119999997317790985107421875);
    }
    float2 e = (p - base) * float2(1.0, 3.599999904632568359375);
    float r = length(e);
    float rings = 0.0;
    for (int i = 0; i < 3; i++)
    {
        float ri = width * (0.180000007152557373046875 + (0.1599999964237213134765625 * float(i)));
        float d = abs((r - ri) - (0.0040000001899898052215576171875 * sin((_173.iTime * 3.0) + float(i))));
        rings += (exp(((-d) * d) / 6.0000002122251316905021667480469e-06) * (1.0 - (0.25 * float(i))));
    }
    col += (float3(_173.uColor) * (((rings * 0.89999997615814208984375) + (exp((-r) / (width * 0.119999997317790985107421875)) * 1.2000000476837158203125)) + (exp((-r) / (width * 0.5)) * 0.1500000059604644775390625)));
    return col;
}

static inline __attribute__((always_inline))
float3x3 turn(constant FlairUniforms& _173)
{
    float a = _173.iTime * _173.uSpin;
    float ct = cos(_173.uTilt);
    float st = sin(_173.uTilt);
    float3x3 spin = float3x3(float3(cos(a), 0.0, -sin(a)), float3(0.0, 1.0, 0.0), float3(sin(a), 0.0, cos(a)));
    float3x3 tilt = float3x3(float3(1.0, 0.0, 0.0), float3(0.0, ct, st), float3(0.0, -st, ct));
    return tilt * spin;
}

static inline __attribute__((always_inline))
float3 globe(thread const float2& p, thread const float2& centre, thread const float& r, constant FlairUniforms& _173)
{
    float2 q = (p - centre) / float2(r);
    float rr = dot(q, q);
    float inside = step(rr, 1.0);
    float3 col = ((float3(_173.uColor) * exp((-abs(sqrt(rr) - 1.0)) * 40.0)) * 0.60000002384185791015625) + (((float3(_173.uColor) * exp((-fast::max(sqrt(rr) - 1.0, 0.0)) * 8.0)) * 0.119999997317790985107421875) * (1.0 - inside));
    rr = fast::min(rr, 0.99989998340606689453125);
    float3x3 m = turn(_173);
    float n = float(_173.uLines);
    float _1140;
    for (int s = 0; s < 2; s++)
    {
        float z = sqrt(1.0 - rr) * ((s == 0) ? 1.0 : (-1.0));
        float3 g = float3(q, z) * m;
        float lat = (asin(fast::clamp(g.y, -1.0, 1.0)) / 3.141590118408203125) * n;
        float lon = ((precise::atan2(g.x, g.z) / 6.28318023681640625) * n) * 2.0;
        float2 cell = abs(fract(float2(lat, lon) + float2(0.5)) - float2(0.5)) / fast::max(fwidth(float2(lat, lon)), float2(9.9999997473787516355514526367188e-05));
        float lines = fast::max(exp(((-cell.x) * cell.x) * 0.4000000059604644775390625), exp(((-cell.y) * cell.y) * 0.4000000059604644775390625) * smoothstep(0.980000019073486328125, 0.89999997615814208984375, abs(g.y)));
        float rim = powr(1.0 - abs(z), 3.0);
        if (s == 0)
        {
            _1140 = 1.0;
        }
        else
        {
            _1140 = _173.uFarSide;
        }
        col += (((float3(_173.uColor) * (((lines * 1.10000002384185791015625) + (rim * 0.3499999940395355224609375)) + 0.0500000007450580596923828125)) * _1140) * inside);
    }
    return col;
}

static inline __attribute__((always_inline))
float3 project(thread const float3& v, thread const float3x3& m, thread const float2& centre, thread const float& r)
{
    float3 q = m * v;
    float f = 3.0 / (3.0 - q.z);
    return float3(centre + ((q.xy * r) * f), q.z);
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.9999999392252902907785028219223e-09), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float3 solid(thread const float2& p, thread const float2& centre, thread const float& r, thread const float& px, constant FlairUniforms& _173)
{
    float3x3 m = turn(_173);
    float w = 1.2000000476837158203125 * px;
    float3 col = float3(0.0);
    if (_173.uShape == 1)
    {
        for (int i = 0; i < 12; i++)
        {
            float3 param = _643[_664[i].x];
            float3x3 param_1 = m;
            float2 param_2 = centre;
            float param_3 = r;
            float3 a = project(param, param_1, param_2, param_3);
            float3 param_4 = _643[_664[i].y];
            float3x3 param_5 = m;
            float2 param_6 = centre;
            float param_7 = r;
            float3 b = project(param_4, param_5, param_6, param_7);
            float2 param_8 = p;
            float2 param_9 = a.xy;
            float2 param_10 = b.xy;
            float d = segment(param_8, param_9, param_10);
            float near = mix(_173.uFarSide, 1.0, smoothstep(-0.60000002384185791015625, 0.60000002384185791015625, (a.z + b.z) * 0.5));
            col += ((float3(_173.uColor) * near) * ((exp((-(d * d)) / (w * w)) * 1.39999997615814208984375) + (exp((-d) / (w * 6.0)) * 0.1500000059604644775390625)));
        }
        for (int i_1 = 0; i_1 < 8; i_1++)
        {
            float3 param_11 = _643[i_1];
            float3x3 param_12 = m;
            float2 param_13 = centre;
            float param_14 = r;
            float3 a_1 = project(param_11, param_12, param_13, param_14);
            col += ((float3(_173.uColor) * exp(-powr(length(p - a_1.xy) / (w * 2.2000000476837158203125), 2.0))) * mix(_173.uFarSide, 1.0, smoothstep(-0.60000002384185791015625, 0.60000002384185791015625, a_1.z)));
        }
    }
    else
    {
        for (int i_2 = 0; i_2 < 30; i_2++)
        {
            float3 param_15 = _825[_854[i_2].x];
            float3x3 param_16 = m;
            float2 param_17 = centre;
            float param_18 = r;
            float3 a_2 = project(param_15, param_16, param_17, param_18);
            float3 param_19 = _825[_854[i_2].y];
            float3x3 param_20 = m;
            float2 param_21 = centre;
            float param_22 = r;
            float3 b_1 = project(param_19, param_20, param_21, param_22);
            float2 param_23 = p;
            float2 param_24 = a_2.xy;
            float2 param_25 = b_1.xy;
            float d_1 = segment(param_23, param_24, param_25);
            float near_1 = mix(_173.uFarSide, 1.0, smoothstep(-0.60000002384185791015625, 0.60000002384185791015625, (a_2.z + b_1.z) * 0.5));
            col += ((float3(_173.uColor) * near_1) * ((exp((-(d_1 * d_1)) / (w * w)) * 1.39999997615814208984375) + (exp((-d_1) / (w * 6.0)) * 0.1500000059604644775390625)));
        }
        for (int i_3 = 0; i_3 < 12; i_3++)
        {
            float3 param_26 = _825[i_3];
            float3x3 param_27 = m;
            float2 param_28 = centre;
            float param_29 = r;
            float3 a_3 = project(param_26, param_27, param_28, param_29);
            col += ((float3(_173.uColor) * exp(-powr(length(p - a_3.xy) / (w * 2.2000000476837158203125), 2.0))) * mix(_173.uFarSide, 1.0, smoothstep(-0.60000002384185791015625, 0.60000002384185791015625, a_3.z)));
        }
    }
    return col;
}

static inline __attribute__((always_inline))
float holoScan(thread const float& y, constant FlairUniforms& _173)
{
    float s = 0.5 + (0.5 * sin(((y - (_173.iTime * 24.0)) * 6.28318023681640625) / _173.uLineSpacing));
    float r = (fract(((y / _173.iResolution[1u]) * 0.60000002384185791015625) - (_173.iTime * 0.180000007152557373046875)) * 8.0) - 4.0;
    float roll = exp((-r) * r) * 0.3499999940395355224609375;
    return (1.0 - ((_173.uScanlines * 0.75) * (1.0 - s))) * (1.0 + (roll * _173.uScanlines));
}

static inline __attribute__((always_inline))
float holoFlicker(constant FlairUniforms& _173)
{
    float k = floor(_173.iTime * 18.0);
    float2 param = float2(k, 1.2999999523162841796875);
    float dip = step(1.0 - (0.119999997317790985107421875 * _173.uFlicker), hash12(param)) * 0.64999997615814208984375;
    float2 param_1 = float2(k, 7.099999904632568359375);
    return (1.0 - (_173.uFlicker * ((0.119999997317790985107421875 * hash12(param_1)) + (0.0599999986588954925537109375 * sin(_173.iTime * 11.0))))) - dip;
}

static inline __attribute__((always_inline))
float4 holoOver(thread float3& light, constant FlairUniforms& _173)
{
    light = float3(1.0) - exp(-fast::max(light, float3(0.0)));
    float a = fast::max(light.x, fast::max(light.y, light.z));
    float3 col = ((float3(_173.uBackground) * _173.uBackgroundAlpha) * (1.0 - a)) + light;
    float alpha = _173.uBackgroundAlpha + (a * (1.0 - _173.uBackgroundAlpha));
    return float4(fast::min(col / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(1.0)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _173)
{
    float px = 1.0 / _173.iResolution[1u];
    float2 p = (fragCoord - (float2(_173.iResolution[0], _173.iResolution[1]) * 0.5)) * px;
    float r = 0.2700000107288360595703125 * _173.uSize;
    float2 centre = float2(0.0, 0.070000000298023223876953125 + (0.008000000379979610443115234375 * sin(_173.iTime * 1.2000000476837158203125)));
    float2 base = float2(0.0, -0.439999997615814208984375);
    float2 param = p;
    float2 param_1 = base;
    float param_2 = centre.y - (r * 0.60000002384185791015625);
    float param_3 = r * 1.2000000476837158203125;
    float3 light = holoBeam(param, param_1, param_2, param_3, _173) * _173.uBeam;
    float3 _1211;
    if (_173.uShape == 0)
    {
        float2 param_4 = p;
        float2 param_5 = centre;
        float param_6 = r;
        _1211 = globe(param_4, param_5, param_6, _173);
    }
    else
    {
        float2 param_7 = p;
        float2 param_8 = centre;
        float param_9 = r;
        float param_10 = px;
        _1211 = solid(param_7, param_8, param_9, param_10, _173);
    }
    light += _1211;
    float band = (((p.y - centre.y) / r) - ((fract(_173.iTime * 0.25) * 2.599999904632568359375) - 1.2999999523162841796875)) * 6.0;
    light *= (1.0 + ((1.2000000476837158203125 * exp((-band) * band)) * smoothstep(1.39999997615814208984375, 0.800000011920928955078125, length(p - centre) / r)));
    float param_11 = fragCoord.y;
    light *= (holoScan(param_11, _173) * holoFlicker(_173));
    float3 param_12 = light;
    float4 _1278 = holoOver(param_12, _173);
    fragColor = _1278;
}

fragment flair_hologram_projector_frag_out flair_hologram_projector_frag(constant FlairUniforms& _173 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_hologram_projector_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1290;
    if (_173.flair_flipY > 0.5)
    {
        _1290 = _173.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1290 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1290);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _173);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

