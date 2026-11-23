// flair-metal-hash: ba1072fd
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
    float2 uOrigin;
    float3 uColor1;
    float3 uColor2;
    packed_float3 uColor3;
    float uSize;
    int uSparks;
    uint uAnimate;
    float uProgress;
};

struct flair_card_complete_burst_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _114)
{
    float _121;
    if (_114.uAnimate != 0u)
    {
        _121 = fract(_114.iTime / 1.60000002384185791015625) / 0.89999997615814208984375;
    }
    else
    {
        _121 = fast::clamp(_114.uProgress, 0.0, 1.0);
    }
    float t = _121;
    float unit = _114.iResolution[1u] * _114.uSize;
    float2 o = _114.uOrigin * float2(_114.iResolution[0], _114.iResolution[1]);
    float2 p = (fragCoord - o) / float2(unit);
    float4 acc = float4(0.0);
    if (t > 1.0)
    {
        fragColor = float4(0.0);
        return;
    }
    float fade = 1.0 - smoothstep(0.550000011920928955078125, 1.0, t);
    float rr = 0.449999988079071044921875 * (1.0 - powr(1.0 - fast::min(t * 1.60000002384185791015625, 1.0), 3.0));
    float ring = exp(((-abs(length(p) - rr)) * unit) / 2.5) * (1.0 - smoothstep(0.100000001490116119384765625, 0.60000002384185791015625, t));
    float4 param = acc;
    float3 param_1 = _114.uColor1;
    float param_2 = ring;
    acc = over(param, param_1, param_2);
    if (length(p) > 1.60000002384185791015625)
    {
        float4 param_3 = acc;
        fragColor = unpremultiply(param_3);
        return;
    }
    int n = clamp(_114.uSparks, 6, 24);
    float3 _367;
    float3 _376;
    for (int i = 0; i < 24; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        float2 param_4 = float2(fi, 1.0);
        float a = ((fi / float(n)) * 6.28318023681640625) + (0.4000000059604644775390625 * (hash12(param_4) - 0.5));
        float2 param_5 = float2(fi, 2.0);
        float speed = 0.60000002384185791015625 + (0.60000002384185791015625 * hash12(param_5));
        float dist = speed * (1.0 - powr(1.0 - t, 2.5));
        float2 dir = float2(cos(a), sin(a));
        float2 head = (dir * dist) + float2(0.0, ((-0.25) * t) * t);
        float2 tail = (dir * fast::max(dist - (0.119999997317790985107421875 * (1.0 - t)), 0.0)) + float2(0.0, ((-0.25) * t) * t);
        float2 pa = p - tail;
        float2 ba = head - tail;
        float h = fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.9999997473787516355514526367188e-06), 0.0, 1.0);
        float seg = length(pa - (ba * h)) * unit;
        float2 param_6 = float2(fi, 3.0);
        float w = 1.60000002384185791015625 + (1.2000000476837158203125 * hash12(param_6));
        float k = smoothstep(w, w - 1.0, seg) * fade;
        float2 param_7 = float2(fi, 4.0);
        float pick = hash12(param_7);
        if (pick < 0.3300000131130218505859375)
        {
            _367 = _114.uColor1;
        }
        else
        {
            if (pick < 0.660000026226043701171875)
            {
                _376 = _114.uColor2;
            }
            else
            {
                _376 = float3(_114.uColor3);
            }
            _367 = _376;
        }
        float3 c = _367;
        float4 param_8 = acc;
        float3 param_9 = c;
        float param_10 = k;
        acc = over(param_8, param_9, param_10);
    }
    float4 param_11 = acc;
    fragColor = unpremultiply(param_11);
}

fragment flair_card_complete_burst_frag_out flair_card_complete_burst_frag(constant FlairUniforms& _114 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_card_complete_burst_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _412;
    if (_114.flair_flipY > 0.5)
    {
        _412 = _114.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _412 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _412);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _114);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

