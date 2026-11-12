// flair-metal-hash: aaae0dc4
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
    int uCount;
    char _m14_pad[12];
    packed_float3 uHeat;
    float uSpeed;
    float uSize;
};

struct flair_embers_frag_out
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
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _132)
{
    float2 p = fragCoord / float2(_132.iResolution[1u]);
    float aspect = _132.iResolution[0u] / _132.iResolution[1u];
    float3 col = float3(0.0);
    for (int i = 0; i < 80; i++)
    {
        if (i >= _132.uCount)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi, 1.2999999523162841796875);
        float2 h = hash22(param);
        float clock = (((_132.iTime * _132.uSpeed) * 0.180000007152557373046875) * (0.60000002384185791015625 + (0.800000011920928955078125 * h.y))) + h.x;
        float life = fract(clock);
        float2 seed = float2(fi, floor(clock));
        float2 param_1 = seed;
        float2 param_2 = seed + float2(2.0);
        float x = ((hash12(param_1) * aspect) + (0.039999999105930328369140625 * sin((life * 8.0) + fi))) + ((life * 0.1500000059604644775390625) * (hash12(param_2) - 0.5));
        float2 param_3 = seed + float2(4.0);
        float y = (life * (0.5 + (0.699999988079071044921875 * hash12(param_3)))) - 0.0199999995529651641845703125;
        float2 param_4 = seed + float2(6.0);
        float r = (0.004999999888241291046142578125 * _132.uSize) * (0.5 + hash12(param_4));
        float2 d = p - float2(x, y);
        d.y *= 0.60000002384185791015625;
        float dist = length(d);
        if (dist > (r * 14.0))
        {
            continue;
        }
        float fade = smoothstep(0.0, 0.07999999821186065673828125, life) * (1.0 - smoothstep(0.449999988079071044921875, 1.0, life));
        float flicker = 0.60000002384185791015625 + ((0.4000000059604644775390625 * sin((_132.iTime * 17.0) + (fi * 3.7000000476837158203125))) * sin((_132.iTime * 7.30000019073486328125) + fi));
        float3 heat = mix(float3(1.0, 0.949999988079071044921875, 0.75), float3(_132.uHeat), float3(smoothstep(0.0, 0.5, life)));
        heat = mix(heat, float3(_132.uHeat) * float3(0.800000011920928955078125, 0.25, 0.100000001490116119384765625), float3(smoothstep(0.5, 1.0, life)));
        float core = 1.0 - smoothstep(r * 0.4000000059604644775390625, r, dist);
        float halo = exp((-dist) / (r * 2.5)) * 0.3499999940395355224609375;
        col += (((heat * ((core * 1.5) + halo)) * fade) * flicker);
    }
    float3 param_5 = col;
    float4 _368 = glow(param_5);
    fragColor = _368;
}

fragment flair_embers_frag_out flair_embers_frag(constant FlairUniforms& _132 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_embers_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _381;
    if (_132.flair_flipY > 0.5)
    {
        _381 = _132.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _381 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _381);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _132);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

