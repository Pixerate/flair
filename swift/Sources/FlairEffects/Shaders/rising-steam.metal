// flair-metal-hash: 0ff993cf
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
    float2 uSource;
    char _m14_pad[8];
    packed_float3 uColor;
    float uWidth;
    float uHeight;
    float uSpeed;
    float uTurbulence;
    float uOpacity;
};

struct flair_rising_steam_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _182)
{
    float2 p = (fragCoord - (float2(_182.iResolution[0], _182.iResolution[1]) * 0.5)) / float2(_182.iResolution[1u]);
    float aspect = _182.iResolution[0u] / _182.iResolution[1u];
    float2 src = (_182.uSource * float2(aspect, 1.0)) * 0.5;
    float2 q = p - src;
    float h = q.y / _182.uHeight;
    if ((h < (-0.0500000007450580596923828125)) || (h > 1.2000000476837158203125))
    {
        fragColor = float4(_182.uColor[0], _182.uColor[1], _182.uColor[2], 0.0);
        return;
    }
    float hc = fast::clamp(h, 0.0, 1.0);
    float t = _182.iTime * _182.uSpeed;
    float w = _182.uWidth * (0.60000002384185791015625 + (1.60000002384185791015625 * hc));
    float sway = ((((sin((q.y * 5.0) - (t * 1.10000002384185791015625)) * 0.5) + (sin(((q.y * 9.0) - (t * 1.7000000476837158203125)) + 1.2999999523162841796875) * 0.300000011920928955078125)) * _182.uTurbulence) * 0.0599999986588954925537109375) * hc;
    float2 flow = float2(q.x, q.y - (t * 0.25));
    float2 param = (flow * 3.0) + float2(0.0, (-t) * 0.20000000298023223876953125);
    int param_1 = 4;
    float _311 = fbm(param, param_1);
    float2 param_2 = (flow * 3.0) + float2(5.19999980926513671875, 1.2999999523162841796875);
    int param_3 = 4;
    float _319 = fbm(param_2, param_3);
    float2 warp = float2(_311, _319) - float2(0.5);
    float x = ((q.x - sway) + (((warp.x * _182.uTurbulence) * 0.25) * hc)) / w;
    float2 sq = float2(x * 2.2000000476837158203125, ((q.y - (t * 0.300000011920928955078125)) / _182.uHeight) * 1.60000002384185791015625) + ((warp * _182.uTurbulence) * 1.5);
    float2 param_4 = sq * float2(1.0, 0.449999988079071044921875);
    int param_5 = 5;
    float _368 = fbm(param_4, param_5);
    float strands = _368;
    float body = exp(((-x) * x) * 1.60000002384185791015625);
    float wisp = smoothstep(0.4199999868869781494140625, 0.75, strands + (0.25 * body));
    float a = wisp * body;
    a *= (smoothstep(-0.0500000007450580596923828125, 0.119999997317790985107421875, h) * (1.0 - smoothstep(0.3499999940395355224609375, 1.0499999523162841796875, h)));
    a *= mix(1.0, 0.550000011920928955078125, hc);
    fragColor = float4(_182.uColor[0], _182.uColor[1], _182.uColor[2], fast::clamp((a * _182.uOpacity) * 1.39999997615814208984375, 0.0, 1.0));
}

fragment flair_rising_steam_frag_out flair_rising_steam_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_rising_steam_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _429;
    if (_182.flair_flipY > 0.5)
    {
        _429 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _429 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _429);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

