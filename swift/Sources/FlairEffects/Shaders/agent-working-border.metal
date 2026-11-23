// flair-metal-hash: fbba56dc
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
    float3 uColor1;
    float3 uColor2;
    float3 uColor3;
    packed_float3 uColor4;
    int uAgents;
    float uSpeed;
    float uLength;
    float uWidth;
    float uGlow;
    float uTrack;
    float uRadius;
    float uInset;
};

struct flair_agent_working_border_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float boxSd(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float3 agentColor(thread const int& i, constant FlairUniforms& _123)
{
    float3 _112;
    if (i == 0)
    {
        _112 = _123.uColor1;
    }
    else
    {
        float3 _132;
        if (i == 1)
        {
            _132 = _123.uColor2;
        }
        else
        {
            float3 _142;
            if (i == 2)
            {
                _142 = _123.uColor3;
            }
            else
            {
                _142 = float3(_123.uColor4);
            }
            _132 = _142;
        }
        _112 = _132;
    }
    return _112;
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _123)
{
    float2 hs = float2(_123.iResolution[0], _123.iResolution[1]) * 0.5;
    float2 p = fragCoord - hs;
    float2 b = fast::max(hs - float2(_123.uInset), float2(1.0));
    float2 param = p;
    float2 param_1 = b;
    float param_2 = fast::min(_123.uRadius, fast::min(b.x, b.y));
    float d = boxSd(param, param_1, param_2);
    float s = (precise::atan2(p.y / b.y, p.x / b.x) / 6.28318023681640625) + 0.5;
    float line = smoothstep(_123.uWidth, _123.uWidth - 1.0, abs(d));
    float halo = exp((-abs(d)) / (6.0 + (10.0 * _123.uGlow))) * _123.uGlow;
    float4 param_3 = float4(0.0);
    float3 param_4 = _123.uColor1;
    float param_5 = _123.uTrack * line;
    float4 acc = over(param_3, param_4, param_5);
    int n = clamp(_123.uAgents, 1, 4);
    for (int i = 0; i < 4; i++)
    {
        if (i >= n)
        {
            break;
        }
        float head = fract((_123.iTime * _123.uSpeed) + (float(i) / float(n)));
        float behind = fract(head - s);
        float beam = smoothstep(_123.uLength, 0.0, behind) * smoothstep(0.0, 0.014999999664723873138427734375, behind + 0.0040000001899898052215576171875);
        int param_6 = i;
        float3 c = agentColor(param_6, _123);
        float4 param_7 = acc;
        float3 param_8 = c;
        float param_9 = beam * fast::clamp(line + (0.64999997615814208984375 * halo), 0.0, 1.0);
        acc = over(param_7, param_8, param_9);
    }
    float4 param_10 = acc;
    fragColor = unpremultiply(param_10);
}

fragment flair_agent_working_border_frag_out flair_agent_working_border_frag(constant FlairUniforms& _123 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_agent_working_border_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _334;
    if (_123.flair_flipY > 0.5)
    {
        _334 = _123.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _334 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _334);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _123);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

