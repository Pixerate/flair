// flair-metal-hash: 7ff3c705
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
    float uSpeed;
    float uCrust;
    float uScale;
    float3 uHot;
    float3 uLava;
    packed_float3 uCrustColor;
    float uGlow;
};

struct flair_lava_flow_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 plates(thread const float2& q, thread const float& t)
{
    float2 cell = floor(q);
    float2 f = fract(q);
    float d1 = 8.0;
    float d2 = 8.0;
    float2 nearest = float2(0.0);
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            float2 g = float2(float(x), float(y));
            float2 param = cell + g;
            float2 h = hash22(param);
            float2 o = ((g + float2(0.5)) + (sin(float2(t * 0.60000002384185791015625) + (h * 6.283100128173828125)) * 0.37999999523162841796875)) - f;
            float d = dot(o, o);
            if (d < d1)
            {
                d2 = d1;
                d1 = d;
                nearest = cell + g;
            }
            else
            {
                if (d < d2)
                {
                    d2 = d;
                }
            }
        }
    }
    float2 param_1 = nearest;
    return float2(sqrt(d2) - sqrt(d1), hash12(param_1));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _312)
{
    float2 p = fragCoord / float2(_312.iResolution[1u]);
    float t = _312.iTime * _312.uSpeed;
    float2 flow = float2(0.0, t * 0.3499999940395355224609375);
    float2 param = (p * 2.0) + (flow * 0.60000002384185791015625);
    int param_1 = 3;
    float _339 = fbm(param, param_1);
    float2 param_2 = ((p * 2.0) + (flow * 0.60000002384185791015625)) + float2(7.30000019073486328125);
    int param_3 = 3;
    float _350 = fbm(param_2, param_3);
    float2 warp = float2(_339, _350) - float2(0.5);
    float2 q = ((p * _312.uScale) + (warp * 1.60000002384185791015625)) + ((flow * _312.uScale) * 0.300000011920928955078125);
    float2 param_4 = q;
    float param_5 = t;
    float2 v = plates(param_4, param_5);
    float2 param_6 = (((p * _312.uScale) * 0.89999997615814208984375) + float2(0.0, t * 0.89999997615814208984375)) + (warp * 3.0);
    int param_7 = 5;
    float _394 = fbm(param_6, param_7);
    float churn = _394;
    float3 lava = mix(_312.uLava * 0.449999988079071044921875, _312.uLava, float3(smoothstep(0.300000011920928955078125, 0.5, churn)));
    lava = mix(lava, _312.uHot, float3(smoothstep(0.550000011920928955078125, 0.800000011920928955078125, churn)));
    float2 param_8 = (q * 0.699999988079071044921875) + float2(3.0);
    int param_9 = 2;
    float _431 = fbm(param_8, param_9);
    float crack = mix(0.300000011920928955078125, 0.0199999995529651641845703125, _312.uCrust) * (0.60000002384185791015625 + (0.800000011920928955078125 * _431));
    float molten = step(0.550000011920928955078125 + (0.449999988079071044921875 * _312.uCrust), v.y);
    float crust = smoothstep(crack, crack + 0.0599999986588954925537109375, v.x) * (1.0 - molten);
    float2 param_10 = q * 4.0;
    int param_11 = 3;
    float _460 = fbm(param_10, param_11);
    float rough = _460;
    float heat = exp((-fast::max(v.x - crack, 0.0)) * 6.0);
    float3 rock = (float3(_312.uCrustColor) * (0.5 + (1.2000000476837158203125 * rough))) + (((_312.uLava * heat) * 0.60000002384185791015625) * _312.uGlow);
    rock += ((((_312.uLava * 0.300000011920928955078125) * _312.uGlow) * smoothstep(0.62000000476837158203125, 0.800000011920928955078125, rough)) * (1.0 - smoothstep(0.0, 0.4000000059604644775390625, v.x)));
    float3 col = mix(lava, rock, float3(crust));
    col += ((((_312.uHot * 0.20000000298023223876953125) * _312.uGlow) * (1.0 - crust)) * smoothstep(0.5, 0.89999997615814208984375, churn));
    col = fast::min(col, float3(1.0));
    fragColor = float4(col, 1.0);
}

fragment flair_lava_flow_frag_out flair_lava_flow_frag(constant FlairUniforms& _312 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_lava_flow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _548;
    if (_312.flair_flipY > 0.5)
    {
        _548 = _312.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _548 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _548);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _312);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

