// flair-metal-hash: 105d091a
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
    float uSpeed;
    float uWidth;
    float uLife;
    int uRings;
    uint uDemo;
};

struct flair_click_ripple_frag_out
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
float4 clickAt(thread const int& i, thread const bool& demo, constant FlairUniforms& _86)
{
    bool _73 = !demo;
    bool _95;
    if (!_73)
    {
        _95 = _86.iClicks[0].w > 0.5;
    }
    else
    {
        _95 = _73;
    }
    if (_95)
    {
        return _86.iClicks[i];
    }
    float k = floor(_86.iTime / 2.0) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.1500000059604644775390625) + (h * 0.699999988079071044921875)) * float2(_86.iResolution[0], _86.iResolution[1]), k * 2.0, 1.0);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _86)
{
    float px = 1.0 / _86.iResolution[1u];
    float4 acc = float4(0.0);
    for (int i = 7; i >= 0; i--)
    {
        int param = i;
        bool param_1 = _86.uDemo != 0u;
        float4 c = clickAt(param, param_1, _86);
        if (c.w < 0.5)
        {
            continue;
        }
        float age = _86.iTime - c.z;
        bool _221 = age < 0.0;
        bool _230;
        if (!_221)
        {
            _230 = age > _86.uLife;
        }
        else
        {
            _230 = _221;
        }
        if (_230)
        {
            continue;
        }
        float life = age / _86.uLife;
        float fade = (1.0 - life) * (1.0 - life);
        float d = length(fragCoord - c.xy) * px;
        for (int j = 0; j < 4; j++)
        {
            if (j >= _86.uRings)
            {
                break;
            }
            float r = (age - (float(j) * 0.1599999964237213134765625)) * _86.uSpeed;
            if (r <= 0.0)
            {
                continue;
            }
            float w = fast::max(_86.uWidth * (1.0 + (life * 1.5)), 1.5 * px);
            float x = (d - r) / w;
            float k = (fade * (1.0 - (0.2800000011920928955078125 * float(j)))) * smoothstep(0.0, 0.0500000007450580596923828125, r);
            float crest = exp(((-x) * x) * 2.0);
            float trough = exp(((-(x + 1.60000002384185791015625)) * (x + 1.60000002384185791015625)) * 2.0);
            float4 param_2 = acc;
            float3 param_3 = float3(_86.uColor) * 0.1500000059604644775390625;
            float param_4 = (trough * k) * 0.3499999940395355224609375;
            acc = over(param_2, param_3, param_4);
            float4 param_5 = acc;
            float3 param_6 = mix(float3(_86.uColor), float3(1.0), float3(0.5 * crest));
            float param_7 = crest * k;
            acc = over(param_5, param_6, param_7);
        }
    }
    float4 param_8 = acc;
    fragColor = unpremultiply(param_8);
}

fragment flair_click_ripple_frag_out flair_click_ripple_frag(constant FlairUniforms& _86 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_click_ripple_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _382;
    if (_86.flair_flipY > 0.5)
    {
        _382 = _86.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _382 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _382);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _86);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

