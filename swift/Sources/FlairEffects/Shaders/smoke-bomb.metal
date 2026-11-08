// flair-metal-hash: f183a978
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
    float3 uColorA;
    packed_float3 uColorB;
    float uDensity;
    float uSpeed;
    float uSpread;
    float uHeight;
};

struct flair_smoke_bomb_frag_out
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
    float t = _182.iTime * _182.uSpeed;
    float h = fast::max(q.y, 0.0);
    float width = 0.039999999105930328369140625 + ((h * 0.75) * _182.uSpread);
    float plume = exp(-powr(q.x / width, 2.0)) * exp((-h) / (0.550000011920928955078125 * _182.uHeight));
    float ground = exp(-powr(q.y / 0.070000000298023223876953125, 2.0)) * exp((-abs(q.x)) / (0.300000011920928955078125 * _182.uSpread));
    float env = fast::max(plume, ground * 0.800000011920928955078125) * smoothstep(-0.0599999986588954925537109375, 0.0, q.y);
    if (env < 0.00999999977648258209228515625)
    {
        fragColor = float4(0.0);
        return;
    }
    float2 flow = float2(q.x * (1.0 - (0.4000000059604644775390625 * fast::clamp(h * 2.0, 0.0, 1.0))), q.y - (t * 0.2199999988079071044921875));
    float2 param = (flow * 3.0) + float2(0.0, t * 0.0500000007450580596923828125);
    int param_1 = 4;
    float _316 = fbm(param, param_1);
    float2 param_2 = (flow * 3.0) + float2(5.19999980926513671875, 1.2999999523162841796875 - (t * 0.070000000298023223876953125));
    int param_3 = 4;
    float _328 = fbm(param_2, param_3);
    float2 warp = float2(_316, _328);
    float2 param_4 = (flow * 4.5) + (warp * 1.60000002384185791015625);
    int param_5 = 5;
    float _341 = fbm(param_4, param_5);
    float n = _341;
    float2 param_6 = ((flow * 4.5) + (warp * 1.60000002384185791015625)) + float2(0.0, 0.02999999932944774627685546875);
    int param_7 = 5;
    float _353 = fbm(param_6, param_7);
    float n2 = _353;
    float d = smoothstep(0.25, 0.75, n * (0.60000002384185791015625 + (0.800000011920928955078125 * env))) * env;
    float a = fast::clamp((d * 1.60000002384185791015625) * _182.uDensity, 0.0, 1.0);
    float2 param_8 = ((flow * 1.5) + warp) + float2(9.0, 0.0);
    int param_9 = 3;
    float _385 = fbm(param_8, param_9);
    float mixer = smoothstep(0.300000011920928955078125, 0.699999988079071044921875, _385 + (q.x * 0.60000002384185791015625));
    float3 col = mix(_182.uColorA, float3(_182.uColorB), float3(mixer));
    float light = fast::clamp((0.75 + ((n2 - n) * 10.0)) + (0.25 * n), 0.4000000059604644775390625, 1.25);
    col = (col * light) + float3(0.0599999986588954925537109375);
    float r = length(q);
    col = mix(col, mix(float3(1.0, 0.949999988079071044921875, 0.89999997615814208984375), _182.uColorA, float3(0.4000000059604644775390625)), float3(exp(((-r) * r) / 0.00039999998989515006542205810546875) * 0.800000011920928955078125));
    a = fast::max(a, exp(((-r) * r) / 0.00019999999494757503271102905273438));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), a);
}

fragment flair_smoke_bomb_frag_out flair_smoke_bomb_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_smoke_bomb_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _469;
    if (_182.flair_flipY > 0.5)
    {
        _469 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _469 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _469);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

