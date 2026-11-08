// flair-metal-hash: 1ea5badf
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
    packed_float3 uLight;
    float uIntensity;
    float uReach;
    float uSoftness;
    float uSpeed;
    float3 uFloor;
    packed_float3 uShapes;
    float uAmbient;
    uint uFollow;
};

struct flair_light_sweep_shadows_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float box(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float scene(thread const float2& p)
{
    float d = length(p - float2(-0.449999988079071044921875, 0.12999999523162841796875)) - 0.0900000035762786865234375;
    d = fast::min(d, length(p - float2(0.36000001430511474609375, -0.17000000178813934326171875)) - 0.064999997615814208984375);
    d = fast::min(d, length(p - float2(-0.20000000298023223876953125, -0.2800000011920928955078125)) - 0.04500000178813934326171875);
    float param = 0.5;
    float2 param_1 = rot(param) * (p - float2(0.039999999105930328369140625, 0.0));
    float2 param_2 = float2(0.100000001490116119384765625, 0.0500000007450580596923828125);
    float param_3 = 0.01200000010430812835693359375;
    d = fast::min(d, box(param_1, param_2, param_3));
    float param_4 = -0.300000011920928955078125;
    float2 param_5 = rot(param_4) * (p - float2(0.550000011920928955078125, 0.20000000298023223876953125));
    float2 param_6 = float2(0.02999999932944774627685546875, 0.119999997317790985107421875);
    float param_7 = 0.00999999977648258209228515625;
    d = fast::min(d, box(param_5, param_6, param_7));
    float param_8 = 0.89999997615814208984375;
    float2 param_9 = rot(param_8) * (p - float2(-0.62000000476837158203125, -0.2199999988079071044921875));
    float2 param_10 = float2(0.0500000007450580596923828125);
    float param_11 = 0.008000000379979610443115234375;
    d = fast::min(d, box(param_9, param_10, param_11));
    return d;
}

static inline __attribute__((always_inline))
float2 sceneNormal(thread const float2& p)
{
    float2 e = float2(0.00200000009499490261077880859375, 0.0);
    float2 param = p + e;
    float2 param_1 = p - e;
    float2 param_2 = p + e.yx;
    float2 param_3 = p - e.yx;
    return fast::normalize(float2(scene(param) - scene(param_1), scene(param_2) - scene(param_3)) + float2(9.9999999747524270787835121154785e-07));
}

static inline __attribute__((always_inline))
float softShadow(thread const float2& p, thread const float2& light, constant FlairUniforms& _260)
{
    float2 to = light - p;
    float dist = length(to);
    float2 dir = to / float2(fast::max(dist, 9.9999997473787516355514526367188e-06));
    float res = 1.0;
    float t = 0.0040000001899898052215576171875;
    for (int i = 0; i < 56; i++)
    {
        if (t >= dist)
        {
            break;
        }
        float2 param = p + (dir * t);
        float d = scene(param);
        res = fast::min(res, d / (_260.uSoftness * t));
        if (res < (-1.0))
        {
            break;
        }
        t += fast::clamp(d, 0.0040000001899898052215576171875, 0.07999999821186065673828125);
    }
    res = fast::max(res, -1.0);
    return ((0.25 * (1.0 + res)) * (1.0 + res)) * (2.0 - res);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _260)
{
    float px = 1.0 / _260.iResolution[1u];
    float2 p = (fragCoord - (float2(_260.iResolution[0], _260.iResolution[1]) * 0.5)) * px;
    float aspect = _260.iResolution[0u] / _260.iResolution[1u];
    float t = _260.iTime * _260.uSpeed;
    float2 light = float2((0.4199999868869781494140625 * aspect) * sin(t * 1.059999942779541015625), 0.36000001430511474609375 * sin((t * 1.62000000476837158203125) + 1.0));
    if (_260.uFollow != 0u)
    {
        light = mix(light, (_260.iPointer.xy - (float2(_260.iResolution[0], _260.iResolution[1]) * 0.5)) * px, float2(fast::clamp(_260.iPointer.z, 0.0, 1.0)));
    }
    float2 param = light;
    float inside = scene(param);
    if (inside < 0.02999999932944774627685546875)
    {
        float2 param_1 = light;
        light += (sceneNormal(param_1) * (0.02999999932944774627685546875 - inside));
    }
    float2 to = light - p;
    float r = length(to);
    float falloff = 1.0 / (1.0 + ((r * r) / (_260.uReach * _260.uReach)));
    float3 lamp = (float3(_260.uLight) * _260.uIntensity) * falloff;
    float2 param_2 = p;
    float d = scene(param_2);
    float2 param_3 = p;
    float2 param_4 = light;
    float3 floorCol = _260.uFloor * (float3(_260.uAmbient) + (lamp * softShadow(param_3, param_4, _260)));
    float2 param_5 = p;
    float2 n = sceneNormal(param_5);
    float rim = smoothstep(-0.02500000037252902984619140625, 0.0, d) * fast::max(dot(n, to / float2(fast::max(r, 9.9999997473787516355514526367188e-06))), 0.0);
    float3 shapeCol = float3(_260.uShapes) * (float3(_260.uAmbient + 0.25) + (lamp * (0.449999988079071044921875 + (0.800000011920928955078125 * rim))));
    float3 col = mix(shapeCol, floorCol, float3(smoothstep(-px, px, d)));
    col += (float3(_260.uLight) * ((exp(((-r) * r) / 0.00025000001187436282634735107421875) * 2.0) + (exp(((-r) * r) / 0.0040000001899898052215576171875) * 0.25)));
    fragColor = float4(float3(1.0) - exp((-col) * 1.2999999523162841796875), 1.0);
}

fragment flair_light_sweep_shadows_frag_out flair_light_sweep_shadows_frag(constant FlairUniforms& _260 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_light_sweep_shadows_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _523;
    if (_260.flair_flipY > 0.5)
    {
        _523 = _260.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _523 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _523);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _260);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

