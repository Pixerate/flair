// flair-metal-hash: f5596764
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
    float uPeriod;
    float uStrength;
    float uGlitch;
    char _m17_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_power_surge_frag_out
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _461)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_461.uBackdrop) * _461.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_461.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _461)
{
    float4 _597;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _597 = overBackdrop(param, _461);
    }
    else
    {
        float2 param_1 = fract(uv);
        _597 = float4(testCard(param_1), 1.0);
    }
    return _597;
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
float3 arcLight(thread const float& d, thread const float& w, thread const float3& col)
{
    float core = exp(((-d) * d) / (w * w));
    float halo = (0.550000011920928955078125 * exp((-d) / (w * 4.0))) + (0.180000007152557373046875 * exp((-d) / (w * 20.0)));
    return ((mix(col, float3(1.0), float3(0.75)) * core) * 2.0) + (col * halo);
}

static inline __attribute__((always_inline))
float2 arcPoint(thread const float2& a, thread const float2& b, thread const float& t, thread const float& seed, thread const float& rough, thread const float& open)
{
    float2 ab = b - a;
    float param = t;
    float param_1 = seed;
    float param_2 = rough;
    float param_3 = open;
    return (a + (ab * t)) + (float2(-ab.y, ab.x) * arcKick(param, param_1, param_2, param_3));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _461, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_461.iResolution[0], _461.iResolution[1]);
    float px = 1.0 / _461.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _461.iResolution[0u] * px;
    float cycle = floor(_461.iTime / _461.uPeriod);
    float since = _461.iTime - (cycle * _461.uPeriod);
    float tick = floor(_461.iTime * 24.0);
    float2 param = float2(tick, 1.0);
    float surge = (_461.uStrength * exp((-since) * 4.0)) * (0.550000011920928955078125 + (0.449999988079071044921875 * hash12(param)));
    float2 param_1 = float2(tick, 2.0);
    float rows = floor(uv.y * mix(12.0, 60.0, hash12(param_1)));
    float2 param_2 = float2(rows, tick);
    float2 param_3 = float2(rows, tick + 5.0);
    float tear = ((((hash12(param_2) - 0.5) * step(0.550000011920928955078125, hash12(param_3))) * 0.119999997317790985107421875) * surge) * _461.uGlitch;
    float2 st = uv + float2(tear, 0.0);
    float split = (0.01200000010430812835693359375 * surge) * _461.uGlitch;
    float2 param_4 = st + float2(split, 0.0);
    float4 r = pictureRGBA(uImage, uImageSmplr, param_4, _461);
    float2 param_5 = st;
    float4 g = pictureRGBA(uImage, uImageSmplr, param_5, _461);
    float2 param_6 = st - float2(split, 0.0);
    float4 b2 = pictureRGBA(uImage, uImageSmplr, param_6, _461);
    float3 col = float3(r.x, g.y, b2.z);
    float brownout = 1.0 - (((0.300000011920928955078125 * fast::min(_461.uStrength, 1.0)) * smoothstep(0.25, 0.5, since)) * (1.0 - smoothstep(0.699999988079071044921875, 1.5, since)));
    col = ((col * brownout) * (1.0 + (surge * 1.39999997615814208984375))) + (mix(float3(_461.uColor), float3(1.0), float3(0.5)) * (surge * 0.20000000298023223876953125));
    col *= (1.0 - (((0.3499999940395355224609375 * fast::min(surge, 1.0)) * _461.uGlitch) * (0.5 + (0.5 * sin(fragCoord.y * 1.57079994678497314453125)))));
    float3 light = float3(0.0);
    float2 param_7 = float2(tick, 6.0);
    float on = (step(since, 0.3499999940395355224609375) * (0.5 + (0.5 * step(0.300000011920928955078125, hash12(param_7))))) * _461.uStrength;
    if (on > 0.0)
    {
        float w = fast::max(0.0030000000260770320892333984375, 0.699999988079071044921875 * px);
        float2 param_8 = float2(cycle, 3.0);
        float2 a = float2(-0.0500000007450580596923828125, 0.20000000298023223876953125 + (0.60000002384185791015625 * hash12(param_8)));
        float2 param_9 = float2(cycle, 4.0);
        float2 b = float2(aspect + 0.0500000007450580596923828125, 0.20000000298023223876953125 + (0.60000002384185791015625 * hash12(param_9)));
        float2 param_10 = p;
        float2 param_11 = a;
        float2 param_12 = b;
        float param_13 = tick;
        float param_14 = 0.070000000298023223876953125;
        float param_15 = 0.0;
        float param_16 = arcDist(param_10, param_11, param_12, param_13, param_14, param_15).x;
        float param_17 = w;
        float3 param_18 = float3(_461.uColor);
        light += arcLight(param_16, param_17, param_18);
        float2 param_19 = float2(cycle, 5.0);
        float2 param_20 = a;
        float2 param_21 = b;
        float param_22 = 0.300000011920928955078125 + (0.4000000059604644775390625 * hash12(param_19));
        float param_23 = tick;
        float param_24 = 0.070000000298023223876953125;
        float param_25 = 0.0;
        float2 s = arcPoint(param_20, param_21, param_22, param_23, param_24, param_25);
        float2 param_26 = float2(cycle, 6.0);
        float2 param_27 = float2(cycle, 7.0);
        float2 e = s + float2(0.1500000059604644775390625 + (0.20000000298023223876953125 * hash12(param_26)), (hash12(param_27) - 0.5) * 0.60000002384185791015625);
        float2 param_28 = p;
        float2 param_29 = s;
        float2 param_30 = e;
        float param_31 = tick + 9.0;
        float param_32 = 0.20000000298023223876953125;
        float param_33 = 1.0;
        float param_34 = arcDist(param_28, param_29, param_30, param_31, param_32, param_33).x;
        float param_35 = w * 0.60000002384185791015625;
        float3 param_36 = float3(_461.uColor);
        light += (arcLight(param_34, param_35, param_36) * 0.60000002384185791015625);
        light *= on;
    }
    col = float3(1.0) - ((float3(1.0) - fast::clamp(col, float3(0.0), float3(1.0))) * exp(-light));
    float arc = 1.0 - exp(-fast::max(light.x, fast::max(light.y, light.z)));
    fragColor = float4(col, fast::max(fast::max(fast::max(r.w, g.w), b2.w), arc));
}

fragment flair_power_surge_frag_out flair_power_surge_frag(constant FlairUniforms& _461 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_power_surge_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _980;
    if (_461.flair_flipY > 0.5)
    {
        _980 = _461.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _980 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _980);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _461, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

