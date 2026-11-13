// flair-metal-hash: 531f07d1
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

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
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    int uCount;
    float uWave;
    float uFrequency;
    float uAngle;
    float uSpeed;
    float uLines;
    float uShadow;
};

struct flair_ribbon_bands_frag_out
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
float3 flatColour(thread const int& i, constant FlairUniforms& _112)
{
    int k = i - (4 * (i / 4));
    float3 _100;
    if (k == 0)
    {
        _100 = _112.uColorA;
    }
    else
    {
        float3 _121;
        if (k == 1)
        {
            _121 = _112.uColorB;
        }
        else
        {
            float3 _131;
            if (k == 2)
            {
                _131 = _112.uColorC;
            }
            else
            {
                _131 = float3(_112.uColorD);
            }
            _121 = _131;
        }
        _100 = _121;
    }
    return _100;
}

static inline __attribute__((always_inline))
float3 ribbon(thread const int& i, thread const float& d, thread const float& pitch, thread const float& px, constant FlairUniforms& _112)
{
    float s = (d / pitch) * 5.0;
    float aa = (px / pitch) * 5.0;
    float line = smoothstep(0.100000001490116119384765625 + aa, 0.100000001490116119384765625 - aa, abs(fract(s) - 0.5));
    int param = i;
    return flatColour(param, _112) * (1.0 - ((0.2199999988079071044921875 * _112.uLines) * line));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _112)
{
    float2 p = (fragCoord - (float2(_112.iResolution[0], _112.iResolution[1]) * 0.5)) / float2(_112.iResolution[1u]);
    float a = radians(_112.uAngle);
    float param = a;
    p = rot(param) * p;
    float half_ = 0.5 * (((abs(sin(a)) * _112.iResolution[0u]) / _112.iResolution[1u]) + abs(cos(a)));
    float pitch = (2.0 * half_) / float(_112.uCount);
    float t = ((_112.iTime * _112.uSpeed) * 6.28318023681640625) / 8.0;
    float px = 1.5 / _112.iResolution[1u];
    int param_1 = 0;
    float param_2 = (half_ + pitch) - p.y;
    float param_3 = pitch;
    float param_4 = px;
    float3 col = ribbon(param_1, param_2, param_3, param_4, _112);
    for (int i = 1; i < 16; i++)
    {
        if (i >= _112.uCount)
        {
            break;
        }
        float2 param_5 = float2(float(i), 3.7000000476837158203125);
        float2 h = hash22(param_5);
        float turn = (((i - (2 * (i / 2))) == 0) ? 1.0 : (-1.0)) * float((1 + i) - (3 * (i / 3)));
        float wave = (0.64999997615814208984375 * sin((((p.x * _112.uFrequency) * (0.699999988079071044921875 + (0.60000002384185791015625 * h.x))) + (t * turn)) + (h.y * 6.28318023681640625))) + (0.3499999940395355224609375 * sin((((p.x * _112.uFrequency) * 2.2999999523162841796875) - (t * 2.0)) + (h.x * 6.28318023681640625)));
        float edge = (half_ - (pitch * float(i))) + (((_112.uWave * pitch) * 1.2999999523162841796875) * wave);
        float d = edge - p.y;
        float under = smoothstep((-pitch) * 0.5, 0.0, d);
        col *= (1.0 - (((_112.uShadow * 0.4000000059604644775390625) * under) * under));
        int param_6 = i;
        float param_7 = d;
        float param_8 = pitch;
        float param_9 = px;
        col = mix(col, ribbon(param_6, param_7, param_8, param_9, _112), float3(smoothstep(-px, px, d)));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_ribbon_bands_frag_out flair_ribbon_bands_frag(constant FlairUniforms& _112 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ribbon_bands_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _421;
    if (_112.flair_flipY > 0.5)
    {
        _421 = _112.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _421 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _421);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _112);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

