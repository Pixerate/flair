// flair-metal-hash: 97fa69cb
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
    float3 uDeep;
    float3 uShallow;
    float3 uLight;
    packed_float3 uSand;
    float uShafts;
    float uCaustics;
    float uParticles;
    float uFog;
    float uSpeed;
};

struct flair_underwater_scene_frag_out
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
float caustic(thread const float2& p, thread const float& t)
{
    float2 param = (p * 0.699999988079071044921875) + float2(t * 0.300000011920928955078125);
    float2 param_1 = ((p * 0.699999988079071044921875) - float2(t * 0.25)) + float2(5.0);
    float2 w = float2(vnoise(param), vnoise(param_1));
    float2 q = p + (w * 1.60000002384185791015625);
    float2 param_2 = q + float2(t * 0.4000000059604644775390625);
    float a = 1.0 - abs((vnoise(param_2) * 2.0) - 1.0);
    float2 param_3 = ((q * 1.7000000476837158203125) - float2(t * 0.3499999940395355224609375)) + float2(3.0);
    float b = 1.0 - abs((vnoise(param_3) * 2.0) - 1.0);
    return (powr(a, 6.0) + (powr(b, 6.0) * 0.699999988079071044921875)) + (powr(a * b, 4.0) * 1.5);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _237)
{
    float px = 1.0 / _237.iResolution[1u];
    float2 p = (fragCoord - (float2(_237.iResolution[0], _237.iResolution[1]) * 0.5)) * px;
    float t = _237.iTime * _237.uSpeed;
    float3 ro = float3(0.0, 0.0, t * 0.1500000059604644775390625);
    float3 rd = fast::normalize(float3(p.x, p.y + 0.07999999821186065673828125, 1.0));
    float3 water = mix(_237.uDeep, _237.uShallow, float3(smoothstep(-0.449999988079071044921875, 0.699999988079071044921875, rd.y)));
    float3 col = water;
    float fogK = 0.0900000035762786865234375 * _237.uFog;
    if (rd.y < 0.0)
    {
        float tf = (-3.0) / rd.y;
        float3 pos = ro + (rd * tf);
        float2 param = pos.xz * 0.3499999940395355224609375;
        float2 param_1 = pos.xz * 1.2999999523162841796875;
        float2 param_2 = pos.xz * 6.0;
        float dunes = ((vnoise(param) * 0.60000002384185791015625) + (vnoise(param_1) * 0.25)) + (vnoise(param_2) * 0.07999999821186065673828125);
        float3 sand = float3(_237.uSand) * (0.550000011920928955078125 + (0.5 * dunes));
        float2 param_3 = pos.xz * 0.89999997615814208984375;
        float param_4 = t * 0.800000011920928955078125;
        float c = caustic(param_3, param_4);
        c = mix(c, 0.5, smoothstep(10.0, 30.0, tf));
        sand += (((_237.uLight * c) * 0.550000011920928955078125) * _237.uCaustics);
        sand *= mix(_237.uShallow * 1.5, float3(1.0), float3(0.4000000059604644775390625));
        col = mix(water, sand, float3(exp((-tf) * fogK)));
    }
    else
    {
        float ts = 4.0 / fast::max(rd.y, 0.0500000007450580596923828125);
        float2 sp = (ro + (rd * ts)).xz;
        float2 param_5 = sp * 0.60000002384185791015625;
        float param_6 = t * 1.2000000476837158203125;
        float ripple = caustic(param_5, param_6);
        float window = smoothstep(0.3499999940395355224609375, 0.800000011920928955078125, rd.y);
        col += (((_237.uLight * (0.25 + (0.60000002384185791015625 * ripple))) * window) * exp((-ts) * 0.039999999105930328369140625));
    }
    float ang = (p.x - (0.3499999940395355224609375 * p.y)) / (1.2999999523162841796875 - p.y);
    float2 param_7 = float2((ang * 9.0) + (t * 0.1500000059604644775390625), t * 0.100000001490116119384765625);
    float2 param_8 = float2((ang * 23.0) - (t * 0.100000001490116119384765625), 3.0 + (t * 0.119999997317790985107421875));
    float shafts = vnoise(param_7) * vnoise(param_8);
    shafts = smoothstep(0.119999997317790985107421875, 0.60000002384185791015625, shafts);
    col += ((((_237.uLight * shafts) * smoothstep(-0.550000011920928955078125, 0.449999988079071044921875, p.y)) * 0.3499999940395355224609375) * _237.uShafts);
    for (int i = 0; i < 3; i++)
    {
        float fi = float(i);
        float scale = mix(28.0, 8.0, fi / 2.0);
        float2 q = ((p * scale) + float2((t * 0.0500000007450580596923828125) * (fi + 1.0), t * (0.07999999821186065673828125 + (0.0500000007450580596923828125 * fi)))) + float2(fi * 17.0);
        float2 cell = floor(q);
        float2 param_9 = cell + float2(fi);
        if (hash12(param_9) > (_237.uParticles * 0.5))
        {
            continue;
        }
        float2 param_10 = cell + float2(3.0 * fi);
        float2 at = float2(0.20000000298023223876953125) + (hash22(param_10) * 0.60000002384185791015625);
        float2 param_11 = cell;
        float2 param_12 = cell + float2(1.0);
        at += (float2(sin((t * 0.699999988079071044921875) + (hash12(param_11) * 6.280000209808349609375)), cos((t * 0.5) + (hash12(param_12) * 6.280000209808349609375))) * 0.1500000059604644775390625);
        float d = length(fract(q) - at) / (scale * px);
        float2 param_13 = cell + float2(5.0);
        float size = mix(0.800000011920928955078125, 3.0, fi / 2.0) * (0.60000002384185791015625 + (0.800000011920928955078125 * hash12(param_13)));
        col += ((_237.uLight * (1.0 - smoothstep(size * 0.4000000059604644775390625, size + 0.800000011920928955078125, d))) * mix(0.25, 0.449999988079071044921875, fi / 2.0));
    }
    col *= (1.0 - (0.3499999940395355224609375 * dot(p, p)));
    fragColor = float4(col, 1.0);
}

fragment flair_underwater_scene_frag_out flair_underwater_scene_frag(constant FlairUniforms& _237 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_underwater_scene_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _648;
    if (_237.flair_flipY > 0.5)
    {
        _648 = _237.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _648 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _648);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _237);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

