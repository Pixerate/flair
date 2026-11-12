// flair-metal-hash: 031abb1b
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
    float3 uHead;
    float3 uTail;
    packed_float3 uTrack;
    float uSize;
    float uThickness;
    float uSpeed;
    float uGlow;
    float uTrackAlpha;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_glow_ring_spinner_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _64)
{
    float4 base = float4(float3(_64.uBackground) * _64.uBackgroundAlpha, _64.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _64)
{
    float px = 1.0 / _64.iResolution[1u];
    float2 p = (fragCoord - (float2(_64.iResolution[0], _64.iResolution[1]) * 0.5)) * px;
    float R = (0.5 * _64.uSize) - _64.uThickness;
    float r = length(p);
    float d = abs(r - R);
    float band = smoothstep(_64.uThickness * 0.5, (_64.uThickness * 0.5) - px, d);
    float head = fract(_64.iTime * _64.uSpeed);
    float a = (precise::atan2(p.y, p.x) / 6.28318023681640625) + 0.5;
    float behind = fract(head - a);
    float len = 0.449999988079071044921875 + (0.300000011920928955078125 * (0.5 + (0.5 * sin((_64.iTime * _64.uSpeed) * 3.141590118408203125))));
    float tail = powr(fast::clamp(1.0 - (behind / len), 0.0, 1.0), 1.2000000476837158203125) * smoothstep(0.0, 0.014999999664723873138427734375, behind);
    float3 col = mix(_64.uTail, _64.uHead, float3(tail));
    float4 param = float4(0.0);
    float3 param_1 = float3(_64.uTrack);
    float param_2 = band * _64.uTrackAlpha;
    float4 acc = over(param, param_1, param_2);
    float4 param_3 = acc;
    float3 param_4 = col;
    float param_5 = band * tail;
    acc = over(param_3, param_4, param_5);
    float hang = (head - 0.5) * 6.28318023681640625;
    float2 hp = float2(cos(hang), sin(hang)) * R;
    float cap = smoothstep(_64.uThickness * 0.5, (_64.uThickness * 0.5) - px, length(p - hp));
    float4 param_6 = acc;
    float3 param_7 = _64.uHead;
    float param_8 = cap;
    acc = over(param_6, param_7, param_8);
    float3 light = ((((col * tail) * exp((-d) / (_64.uThickness * 1.2000000476837158203125))) * 0.60000002384185791015625) * _64.uGlow) + (((_64.uHead * exp((-length(p - hp)) / (_64.uThickness * 1.5))) * 0.800000011920928955078125) * _64.uGlow);
    light = float3(1.0) - exp(-light);
    float la = fast::max(light.x, fast::max(light.y, light.z));
    acc = float4(acc.xyz + (light * (1.0 - acc.w)), acc.w + (la * (1.0 - acc.w)));
    float4 param_9 = acc;
    fragColor = finish(param_9, _64);
}

fragment flair_glow_ring_spinner_frag_out flair_glow_ring_spinner_frag(constant FlairUniforms& _64 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_glow_ring_spinner_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _371;
    if (_64.flair_flipY > 0.5)
    {
        _371 = _64.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _371 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _371);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _64);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

