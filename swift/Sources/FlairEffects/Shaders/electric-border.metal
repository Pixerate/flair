// flair-metal-hash: 0656c33e
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
    packed_float3 uColor;
    float uInset;
    float uRadius;
    float uThickness;
    float uSpeed;
    float uArcs;
    float uIntensity;
};

struct flair_electric_border_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float jag2(thread const float2& x, thread const float& seed)
{
    float2 i = floor(x) + float2(seed);
    float2 f = fract(x);
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return (mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0) - 1.0;
}

static inline __attribute__((always_inline))
float crackle(thread float2& x, thread const float& seed)
{
    float s = 0.0;
    float amp = 0.60000002384185791015625;
    for (int i = 0; i < 4; i++)
    {
        float2 param = x;
        float param_1 = seed + (float(i) * 7.30000019073486328125);
        s += (amp * jag2(param, param_1));
        x = (x * 2.099999904632568359375) + float2(3.099999904632568359375);
        amp *= 0.5;
    }
    return s;
}

static inline __attribute__((always_inline))
float3 arcLight(thread const float& d, thread const float& w, thread const float3& col)
{
    float core = exp(((-d) * d) / (w * w));
    float halo = (0.550000011920928955078125 * exp((-d) / (w * 4.0))) + (0.180000007152557373046875 * exp((-d) / (w * 20.0)));
    return ((mix(col, float3(1.0), float3(0.75)) * core) * 2.0) + (col * halo);
}

static inline __attribute__((always_inline))
float2 framePoint(thread const float& ang, thread const float2& box, thread const float& rad)
{
    float2 dir = float2(cos(ang), sin(ang));
    float s = fast::min(box.x / fast::max(abs(dir.x), 0.001000000047497451305389404296875), box.y / fast::max(abs(dir.y), 0.001000000047497451305389404296875));
    float2 q = dir * s;
    float2 param = q;
    float2 param_1 = box;
    float param_2 = rad;
    return q - (dir * boxSdf(param, param_1, param_2));
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
    float _199 = zigzag(param, param_1);
    return (_199 * rough) * env;
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
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _602)
{
    float px = 1.0 / _602.iResolution[1u];
    float2 p = (fragCoord - (float2(_602.iResolution[0], _602.iResolution[1]) * 0.5)) * px;
    float2 box = fast::max(((float2(_602.iResolution[0], _602.iResolution[1]) * 0.5) * px) - float2(_602.uInset), float2(0.0500000007450580596923828125));
    float rad = fast::min(_602.uRadius, fast::min(box.x, box.y));
    float2 param = p;
    float2 param_1 = box;
    float param_2 = rad;
    float sd = boxSdf(param, param_1, param_2);
    float t = _602.iTime * _602.uSpeed;
    float w = fast::max(0.00179999996908009052276611328125, 0.699999988079071044921875 * px);
    float around = precise::atan2(p.y, p.x);
    float3 light = float3(0.0);
    for (int i = 0; i < 3; i++)
    {
        float fi = float(i);
        float tick = floor((t * (12.0 + (5.0 * fi))) + (fi * 0.5));
        float2 param_3 = p * (9.0 + (3.0 * fi));
        float param_4 = (fract(tick * 0.0731000006198883056640625) * 300.0) + (fi * 19.0);
        float _715 = crackle(param_3, param_4);
        float v = sd - (_715 * _602.uThickness);
        float2 g = float2(dfdx(v), dfdy(v)) / float2(px);
        float d = abs(v) / fast::max(length(g), 0.5);
        float flow = 0.5 + (0.5 * sin(((around * (2.0 + fi)) - ((t * (2.0 + fi)) * ((fi == 1.0) ? (-1.0) : 1.0))) + (fi * 2.0)));
        float level0 = mix(0.20000000298023223876953125, 1.0, smoothstep(0.20000000298023223876953125, 0.89999997615814208984375, flow)) * ((fi == 0.0) ? 1.0 : 0.550000011920928955078125);
        float param_5 = d;
        float param_6 = w * ((fi == 0.0) ? 1.0 : 0.60000002384185791015625);
        float3 param_7 = float3(_602.uColor);
        light += (arcLight(param_5, param_6, param_7) * level0);
    }
    light += ((float3(_602.uColor) * exp((-abs(sd)) / ((_602.uThickness * 2.0) + 0.00999999977648258209228515625))) * 0.20000000298023223876953125);
    for (int j = 0; j < 2; j++)
    {
        float fj = float(j);
        float clock = (t * 1.2999999523162841796875) + (fj * 0.4699999988079071044921875);
        float slot = floor(clock);
        float2 param_8 = float2(slot, fj + 0.300000011920928955078125);
        bool _834 = hash12(param_8) > _602.uArcs;
        bool _841;
        if (!_834)
        {
            _841 = fract(clock) > 0.300000011920928955078125;
        }
        else
        {
            _841 = _834;
        }
        if (_841)
        {
            continue;
        }
        float2 param_9 = float2(slot, fj + 5.099999904632568359375);
        float ang = hash12(param_9) * 6.28318023681640625;
        float param_10 = ang;
        float2 param_11 = box;
        float param_12 = rad;
        float2 a = framePoint(param_10, param_11, param_12);
        float2 param_13 = float2(slot, 9.0);
        float param_14 = (ang + 0.1500000059604644775390625) + (0.20000000298023223876953125 * hash12(param_13));
        float2 param_15 = box;
        float param_16 = rad;
        float2 b = framePoint(param_14, param_15, param_16);
        float2 mid = (a + b) * 0.5;
        float2 param_17 = float2(slot, 2.0);
        mid += (fast::normalize(mid) * (0.039999999105930328369140625 + (0.0500000007450580596923828125 * hash12(param_17))));
        float seed = floor(_602.iTime * 30.0) + (fj * 50.0);
        float2 param_18 = p;
        float2 param_19 = a;
        float2 param_20 = mid;
        float param_21 = seed;
        float param_22 = 0.25;
        float param_23 = 0.0;
        float2 param_24 = p;
        float2 param_25 = mid;
        float2 param_26 = b;
        float param_27 = seed + 3.0;
        float param_28 = 0.25;
        float param_29 = 0.0;
        float d_1 = fast::min(arcDist(param_18, param_19, param_20, param_21, param_22, param_23).x, arcDist(param_24, param_25, param_26, param_27, param_28, param_29).x);
        float param_30 = d_1;
        float param_31 = w * 0.800000011920928955078125;
        float3 param_32 = float3(_602.uColor);
        light += (arcLight(param_30, param_31, param_32) * (1.0 - (fract(clock) / 0.300000011920928955078125)));
    }
    float3 param_33 = light * _602.uIntensity;
    float4 _959 = glow(param_33);
    fragColor = _959;
}

fragment flair_electric_border_frag_out flair_electric_border_frag(constant FlairUniforms& _602 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_electric_border_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _971;
    if (_602.flair_flipY > 0.5)
    {
        _971 = _602.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _971 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _971);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _602);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

