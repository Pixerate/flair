// flair-metal-hash: c68d65cc
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
    float3 uColor;
    float3 uTip;
    packed_float3 uBackground;
    int uCount;
    float uPull;
    float uSpeed;
    float uSize;
    uint uDemo;
    float uBackgroundAlpha;
};

struct flair_plasma_ball_frag_out
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
    float _240 = zigzag(param, param_1);
    return (_240 * rough) * env;
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _467)
{
    float px = 1.0 / _467.iResolution[1u];
    float2 p = (fragCoord - (float2(_467.iResolution[0], _467.iResolution[1]) * 0.5)) * px;
    float R = 0.439999997615814208984375 * _467.uSize;
    float2 o = float2(0.0, 0.070000000298023223876953125 * _467.uSize);
    float2 q = p - o;
    float r = length(q);
    float t = _467.iTime * _467.uSpeed;
    float w = fast::max(0.0035000001080334186553955078125 * _467.uSize, 0.699999988079071044921875 * px);
    float3 col = float3(_467.uBackground);
    float3 light = float3(0.0);
    float2 sq = (p - o) + float2(0.0, R * 0.920000016689300537109375);
    float bw = (0.1500000059604644775390625 - (sq.y * 0.699999988079071044921875)) * _467.uSize;
    bool _543 = sq.y < 0.0;
    bool _553;
    if (_543)
    {
        _553 = sq.y > ((-0.12999999523162841796875) * _467.uSize);
    }
    else
    {
        _553 = _543;
    }
    bool _561;
    if (_553)
    {
        _561 = abs(sq.x) < bw;
    }
    else
    {
        _561 = _553;
    }
    if (_561)
    {
        float shade = 0.5 + (0.5 * cos((sq.x / bw) * 1.39999997615814208984375));
        col = (float3(0.070000000298023223876953125, 0.070000000298023223876953125, 0.0900000035762786865234375) * shade) + ((_467.uColor * 0.119999997317790985107421875) * exp((sq.y * 25.0) / _467.uSize));
    }
    float hover = fast::clamp(_467.iPointer.z, 0.0, 1.0);
    float2 drift = float2(sin(t * 0.5299999713897705078125), sin((t * 0.709999978542327880859375) + 1.0)) * R;
    float2 target = mix(drift, ((_467.iPointer.xy - (float2(_467.iResolution[0], _467.iResolution[1]) * 0.5)) * px) - o, float2(hover));
    float pull = _467.uPull * mix((_467.uDemo != 0u) ? 0.5 : 0.0, 1.0, hover);
    float towards = precise::atan2(target.y, target.x);
    float tick = floor(_467.iTime * 14.0);
    if (r < R)
    {
        light += ((_467.uColor * 0.07999999821186065673828125) * (1.0 - (r / R)));
        float _824;
        for (int i = 0; i < 14; i++)
        {
            if (i >= _467.uCount)
            {
                break;
            }
            float fi = float(i);
            float2 param = float2(fi * 3.099999904632568359375, t * 0.4000000059604644775390625);
            float home = ((fi / float(_467.uCount)) * 6.28318023681640625) + ((vnoise(param) - 0.5) * 2.5);
            float2 param_1 = float2(fi, 2.0);
            float spread = (hash12(param_1) - 0.5) * 0.60000002384185791015625;
            float diff = mod(((towards + spread) - home) + 3.141590118408203125, 6.28318023681640625) - 3.141590118408203125;
            float ang = home + (diff * pull);
            float2 dir = float2(cos(ang), sin(ang));
            float2 root = (dir * 0.0500000007450580596923828125) * _467.uSize;
            float2 tip = (dir * R) * 0.98500001430511474609375;
            float2 param_2 = float2(fi * 5.69999980926513671875, t * 0.89999997615814208984375);
            float2 mid = ((root + tip) * 0.5) + (((float2(-dir.y, dir.x) * (vnoise(param_2) - 0.5)) * 0.5) * R);
            float seed = tick + (fi * 13.0);
            float2 param_3 = q;
            float2 param_4 = root;
            float2 param_5 = mid;
            float param_6 = seed;
            float param_7 = 0.100000001490116119384765625;
            float param_8 = 0.0;
            float2 d1 = arcDist(param_3, param_4, param_5, param_6, param_7, param_8);
            float2 param_9 = q;
            float2 param_10 = mid;
            float2 param_11 = tip;
            float param_12 = seed + 7.0;
            float param_13 = 0.100000001490116119384765625;
            float param_14 = 0.0;
            float2 d2 = arcDist(param_9, param_10, param_11, param_12, param_13, param_14);
            float d = fast::min(d1.x, d2.x);
            if (d1.x < d2.x)
            {
                _824 = d1.y * 0.5;
            }
            else
            {
                _824 = 0.5 + (d2.y * 0.5);
            }
            float along = _824;
            float3 fc = mix(_467.uColor, _467.uTip, float3(smoothstep(0.449999988079071044921875, 1.0, along)));
            float2 param_15 = float2(tick, fi);
            float flick = 0.699999988079071044921875 + (0.300000011920928955078125 * hash12(param_15));
            float param_16 = d;
            float param_17 = w * mix(1.2999999523162841796875, 0.699999988079071044921875, along);
            float3 param_18 = fc;
            light += ((arcLight(param_16, param_17, param_18) * flick) * 0.75);
            light += ((_467.uTip * exp((-length(q - tip)) / (0.0199999995529651641845703125 * _467.uSize))) * 0.699999988079071044921875);
        }
    }
    else
    {
        light += ((_467.uColor * 0.25) * exp((-(r - R)) / (0.0599999986588954925537109375 * _467.uSize)));
    }
    light += ((mix(_467.uColor, float3(1.0), float3(0.60000002384185791015625)) * exp((-r) / (0.0500000007450580596923828125 * _467.uSize))) * 1.2000000476837158203125);
    col += (float3(1.0) - exp(-light));
    float re = 0.0500000007450580596923828125 * _467.uSize;
    col = mix(col, mix(float3(0.85000002384185791015625, 0.800000011920928955078125, 0.949999988079071044921875), _467.uColor, float3(0.300000011920928955078125)) * (1.10000002384185791015625 - (0.4000000059604644775390625 * length((q / float2(re)) - float2(-0.300000011920928955078125, 0.4000000059604644775390625)))), float3(smoothstep(re, re - px, r)));
    col += ((float3(0.75, 0.800000011920928955078125, 1.0) * exp((-abs(r - R)) / (0.0030000000260770320892333984375 + px))) * 0.4000000059604644775390625);
    col += (((mix(_467.uColor, float3(1.0), float3(0.5)) * powr(fast::clamp(r / R, 0.0, 1.0), 8.0)) * 0.119999997317790985107421875) * step(r, R));
    float spec = length((q - (float2(-0.4199999868869781494140625, 0.5) * R)) * float2(1.0, 1.7999999523162841796875));
    col += (((float3(1.0) * (1.0 - smoothstep(0.0, 0.100000001490116119384765625 * R, spec))) * 0.3499999940395355224609375) * step(r, R));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _1068;
    if (a > 0.0)
    {
        _1068 = bg + (d / float3(a));
    }
    else
    {
        _1068 = bg;
    }
    float3 fg = _1068;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1090;
    if (alpha > 0.0)
    {
        _1090 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1090 = bg;
    }
    float3 col = _1090;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _467)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _467);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_467.uBackground);
    float param_4 = _467.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_plasma_ball_frag_out flair_plasma_ball_frag(constant FlairUniforms& _467 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_plasma_ball_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1147;
    if (_467.flair_flipY > 0.5)
    {
        _1147 = _467.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1147 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1147);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _467);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

