// flair-metal-hash: de224cfb
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
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
    packed_float3 uColor;
    float uHold;
    float uSize;
    float uThickness;
    uint uDemo;
};

struct flair_press_charge_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _80)
{
    float px = 1.0 / _80.iResolution[1u];
    float w = _80.iPointer.w;
    float heldFor = (_80.iTime + fast::min(w, 0.0)) - _80.iClicks[0].z;
    bool _110 = _80.uDemo != 0u;
    bool _117;
    if (_110)
    {
        _117 = _80.iClicks[0].w < 0.5;
    }
    else
    {
        _117 = _110;
    }
    if (_117 && (w == 0.0))
    {
        float t = mod(_80.iTime, _80.uHold + 2.0) - 0.4000000059604644775390625;
        float hold = _80.uHold + 0.4000000059604644775390625;
        float _140;
        if (t <= 0.0)
        {
            _140 = 0.0;
        }
        else
        {
            float _147;
            if (t < hold)
            {
                _147 = t;
            }
            else
            {
                _147 = -(t - hold);
            }
            _140 = _147;
        }
        w = _140;
        heldFor = hold;
    }
    float held = fast::max(w, 0.0);
    float since = fast::max(-w, 0.0);
    float _169;
    if (w < 0.0)
    {
        _169 = fast::clamp(heldFor / _80.uHold, 0.0, 1.0);
    }
    else
    {
        _169 = 0.0;
    }
    float reached = _169;
    float drain = 1.0 - smoothstep(0.0, 0.4000000059604644775390625, since);
    float _186;
    if (w > 0.0)
    {
        _186 = fast::clamp(held / _80.uHold, 0.0, 1.0);
    }
    else
    {
        _186 = reached * drain;
    }
    float charge = _186;
    float full = step(_80.uHold, held);
    float2 p = (fragCoord - (float2(_80.iResolution[0], _80.iResolution[1]) * 0.5)) * px;
    float r = length(p);
    float turn = fract((precise::atan2(p.x, p.y) / 6.28318023681640625) + 1.0);
    float R = _80.uSize * ((1.0 - (0.0599999986588954925537109375 * charge)) + (0.02999999932944774627685546875 * _80.iPointer.z));
    float ringD = abs(r - R) - (_80.uThickness * 0.5);
    float ring = 1.0 - smoothstep(-px, px, ringD);
    float4 acc = float4(0.0);
    float4 param = acc;
    float3 param_1 = float3(_80.uColor);
    float param_2 = ((1.0 - smoothstep(R - px, R + px, r)) * 0.100000001490116119384765625) * charge;
    acc = over(param, param_1, param_2);
    float4 param_3 = acc;
    float3 param_4 = float3(_80.uColor) * 0.60000002384185791015625;
    float param_5 = ring * (0.2199999988079071044921875 + (0.100000001490116119384765625 * _80.iPointer.z));
    acc = over(param_3, param_4, param_5);
    float arcEnd = (((charge - turn) * 6.28318023681640625) * R) / px;
    float arc = (ring * fast::clamp(arcEnd + 0.5, 0.0, 1.0)) * step(0.001000000047497451305389404296875, charge);
    float pulse = 1.0 + ((full * 0.25) * sin(_80.iTime * 9.0));
    float halo = (((exp((-fast::max(ringD, 0.0)) / (_80.uThickness * 1.5)) * charge) * charge) * 0.60000002384185791015625) * fast::clamp(arcEnd + 0.5, 0.0, 1.0);
    float4 param_6 = acc;
    float3 param_7 = float3(_80.uColor);
    float param_8 = fast::clamp(halo * pulse, 0.0, 1.0);
    acc = over(param_6, param_7, param_8);
    float4 param_9 = acc;
    float3 param_10 = mix(float3(_80.uColor), float3(1.0), float3((0.3499999940395355224609375 * charge) * pulse));
    float param_11 = arc;
    acc = over(param_9, param_10, param_11);
    float flashAge = -1.0;
    float flashSize = 0.0;
    bool _377 = w > 0.0;
    bool _384;
    if (_377)
    {
        _384 = held >= _80.uHold;
    }
    else
    {
        _384 = _377;
    }
    if (_384)
    {
        flashAge = held - _80.uHold;
        flashSize = 0.5;
    }
    if ((w < 0.0) && (reached >= 1.0))
    {
        flashAge = since;
        flashSize = 1.0;
    }
    if ((flashAge >= 0.0) && (flashAge < 0.800000011920928955078125))
    {
        float k = 1.0 - (flashAge / 0.800000011920928955078125);
        float burstR = R + ((flashAge * 0.60000002384185791015625) * flashSize);
        float burst = ((exp(-powr((r - burstR) / (_80.uThickness * (1.0 + (flashAge * 3.0))), 2.0)) * k) * k) * flashSize;
        float4 param_12 = acc;
        float3 param_13 = mix(float3(_80.uColor), float3(1.0), float3(0.5));
        float param_14 = fast::clamp(burst, 0.0, 1.0);
        acc = over(param_12, param_13, param_14);
        float4 param_15 = acc;
        float3 param_16 = float3(1.0);
        float param_17 = ((exp(((-r) * r) / ((R * R) * 0.5)) * exp((-flashAge) * 6.0)) * 0.800000011920928955078125) * flashSize;
        acc = over(param_15, param_16, param_17);
    }
    float4 param_18 = acc;
    fragColor = unpremultiply(param_18);
}

fragment flair_press_charge_frag_out flair_press_charge_frag(constant FlairUniforms& _80 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_press_charge_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _489;
    if (_80.flair_flipY > 0.5)
    {
        _489 = _80.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _489 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _489);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _80);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

