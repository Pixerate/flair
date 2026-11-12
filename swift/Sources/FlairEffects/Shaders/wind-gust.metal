// flair-metal-hash: c49ecb45
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
    float3 uLineColor;
    float3 uLeafA;
    float3 uLeafB;
    packed_float3 uDustColor;
    float uStrength;
    float uDirection;
    float uGustRate;
    float uLines;
    float uLeaves;
    float uDust;
};

struct flair_wind_gust_frag_out
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
float gust(thread const float& t, constant FlairUniforms& _105)
{
    float s = 0.5 + (0.5 * sin((t * _105.uGustRate) * 6.28318023681640625));
    return 0.25 + ((0.75 * s) * s);
}

static inline __attribute__((always_inline))
float pushed(thread const float& t, constant FlairUniforms& _105)
{
    float w = _105.uGustRate * 6.28318023681640625;
    float x = t * w;
    return (0.25 * t) + (0.75 * (((0.375 * t) - ((0.5 * cos(x)) / w)) - ((0.125 * sin(2.0 * x)) / (2.0 * w))));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _105)
{
    float px = 1.0 / _105.iResolution[1u];
    float2 p = fragCoord * px;
    float dir = (_105.uDirection < 0.0) ? (-1.0) : 1.0;
    p.x *= dir;
    float4 acc = float4(0.0);
    if (_105.uLines > 0.0)
    {
        for (int k = 0; k < 2; k++)
        {
            float rows = (k == 0) ? 9.0 : 15.0;
            float y = (p.y * rows) + (float(k) * 0.5);
            float row = floor(y);
            float2 param = float2(row, float(k));
            float h = hash12(param);
            float speed = (1.2000000476837158203125 + (0.800000011920928955078125 * h)) * _105.uStrength;
            float lag = _105.iTime - (p.x * 0.3499999940395355224609375);
            float param_1 = lag;
            float g = gust(param_1, _105);
            float u = ((p.x * 0.699999988079071044921875) - ((_105.iTime * speed) * 0.60000002384185791015625)) - (h * 9.0);
            float seg = floor(u);
            float fu = fract(u);
            float2 param_2 = float2(seg, row + (float(k) * 5.0));
            if (hash12(param_2) > (_105.uLines * 0.699999988079071044921875))
            {
                continue;
            }
            float2 param_3 = float2(seg, row + 1.0);
            float len = 0.25 + (0.300000011920928955078125 * hash12(param_3));
            float along = fu / len;
            if (along > 1.0)
            {
                continue;
            }
            float curve = (0.25 * sin(((p.x * 5.0) + (h * 6.0)) + (_105.iTime * 0.5))) + (0.119999997317790985107421875 * sin((p.x * 13.0) + (h * 3.0)));
            float2 param_4 = float2(seg, row + 3.0);
            float curl = ((step(0.75, hash12(param_4)) * smoothstep(0.64999997615814208984375, 1.0, along)) * 0.449999988079071044921875) * sin((along - 0.64999997615814208984375) * 14.0);
            float centre = ((row + 0.5) + curve) + curl;
            float d = abs(y - centre) / (rows * px);
            float taper = smoothstep(0.0, 0.300000011920928955078125, along) * smoothstep(1.0, 0.75, along);
            float line = (((1.0 - smoothstep(0.89999997615814208984375, 2.2000000476837158203125, d)) * taper) * mix(0.25, 1.0, smoothstep(0.300000011920928955078125, 0.89999997615814208984375, g))) * ((k == 0) ? 0.85000002384185791015625 : 0.5);
            float4 _390 = acc;
            float3 _398 = mix(_390.xyz, _105.uLineColor, float3(line));
            acc.x = _398.x;
            acc.y = _398.y;
            acc.z = _398.z;
            acc.w = fast::max(acc.w, line);
        }
    }
    float param_5 = _105.iTime;
    float push = pushed(param_5, _105) * _105.uStrength;
    float _436;
    float _455;
    float _468;
    for (int k_1 = 0; k_1 < 3; k_1++)
    {
        bool leaf = k_1 < 2;
        if (leaf)
        {
            _436 = _105.uLeaves;
        }
        else
        {
            _436 = _105.uDust;
        }
        float amount = _436;
        if (amount <= 0.0)
        {
            continue;
        }
        if (k_1 == 0)
        {
            _455 = 5.0;
        }
        else
        {
            _455 = (k_1 == 1) ? 8.0 : 22.0;
        }
        float scale = _455;
        if (k_1 == 0)
        {
            _468 = 0.89999997615814208984375;
        }
        else
        {
            _468 = (k_1 == 1) ? 0.64999997615814208984375 : 1.2000000476837158203125;
        }
        float speed_1 = _468;
        float2 q = p * scale;
        q.x -= (((push * speed_1) * scale) * 0.550000011920928955078125);
        q.y += ((sin((_105.iTime * 0.800000011920928955078125) + (q.x * 0.300000011920928955078125)) * 0.300000011920928955078125) + (((_105.iTime * 0.1500000059604644775390625) * scale) * 0.100000001490116119384765625));
        float2 cell = floor(q);
        float2 param_6 = cell + float2(float(k_1) * 11.0);
        float h_1 = hash12(param_6);
        if (h_1 > (amount * (leaf ? 0.449999988079071044921875 : 0.5)))
        {
            continue;
        }
        float2 param_7 = cell + float2(float(k_1));
        float2 at = float2(0.25) + (hash22(param_7) * 0.5);
        float2 param_8 = cell + float2(2.0);
        float param_9 = _105.iTime;
        float spin = ((_105.iTime * (1.5 + (3.0 * hash12(param_8)))) * (0.5 + gust(param_9, _105))) + (h_1 * 20.0);
        at += (float2(sin(spin * 0.699999988079071044921875), cos(spin * 0.89999997615814208984375)) * 0.1500000059604644775390625);
        float2 d_1 = fract(q) - at;
        if (leaf)
        {
            float c = cos(spin);
            float s = sin(spin);
            d_1 = float2x2(float2(c, s), float2(-s, c)) * d_1;
            d_1.y /= fast::max(abs(sin(spin * 0.60000002384185791015625)), 0.25);
            float2 param_10 = cell + float2(4.0);
            float size = 0.180000007152557373046875 + (0.07999999821186065673828125 * hash12(param_10));
            float2 e = d_1 / float2(size, size * 0.449999988079071044921875);
            float r = length(e) - (1.0 - (0.3499999940395355224609375 * abs(e.x)));
            float aa = ((px * scale) / size) * 1.5;
            float shape = 1.0 - smoothstep(-aa, aa, r);
            float2 param_11 = cell + float2(6.0);
            float3 colour = mix(_105.uLeafA, _105.uLeafB, float3(hash12(param_11))) * (0.800000011920928955078125 + (0.300000011920928955078125 * sign(sin(spin * 0.60000002384185791015625))));
            float vein = ((1.0 - smoothstep(0.0, 0.07999999821186065673828125, abs(e.y))) * step(abs(e.x), 0.85000002384185791015625)) * 0.300000011920928955078125;
            colour *= (1.0 - vein);
            float4 _690 = acc;
            float3 _695 = mix(_690.xyz, colour, float3(shape));
            acc.x = _695.x;
            acc.y = _695.y;
            acc.z = _695.z;
            acc.w = fast::max(acc.w, shape);
        }
        else
        {
            float param_12 = _105.iTime;
            float len_1 = 0.0599999986588954925537109375 + (0.100000001490116119384765625 * gust(param_12, _105));
            float dd = length(float2(d_1.x / (1.0 + (len_1 * 12.0)), d_1.y));
            float param_13 = _105.iTime - (p.x * 0.3499999940395355224609375);
            float speck = ((1.0 - smoothstep(0.0199999995529651641845703125, 0.0500000007450580596923828125, dd)) * 0.550000011920928955078125) * smoothstep(0.300000011920928955078125, 0.60000002384185791015625, gust(param_13, _105));
            float4 _745 = acc;
            float _752 = acc.w;
            float3 _756 = mix(_745.xyz, float3(_105.uDustColor), float3(speck * (1.0 - _752)));
            acc.x = _756.x;
            acc.y = _756.y;
            acc.z = _756.z;
            acc.w = fast::max(acc.w, speck);
        }
    }
    fragColor = float4(acc.xyz, acc.w);
}

fragment flair_wind_gust_frag_out flair_wind_gust_frag(constant FlairUniforms& _105 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_wind_gust_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _790;
    if (_105.flair_flipY > 0.5)
    {
        _790 = _105.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _790 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _790);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _105);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

