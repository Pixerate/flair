// flair-metal-hash: 8adf0367
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
    float3 uColorA;
    float3 uColorB;
    packed_float3 uColorC;
    int uCount;
    float uSpread;
    float uGravity;
    float uLife;
    uint uConfetti;
    uint uDemo;
};

struct flair_click_burst_frag_out
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
float4 clickAt(thread const int& i, thread const bool& demo, constant FlairUniforms& _124)
{
    bool _112 = !demo;
    bool _133;
    if (!_112)
    {
        _133 = _124.iClicks[0].w > 0.5;
    }
    else
    {
        _133 = _112;
    }
    if (_133)
    {
        return _124.iClicks[i];
    }
    float k = floor(_124.iTime / 2.0) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.1500000059604644775390625) + (h * 0.699999988079071044921875)) * float2(_124.iResolution[0], _124.iResolution[1]), k * 2.0, 1.0);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 9.9999999392252902907785028219223e-09), 0.0, 1.0);
    return length((p - a) - (ab * t));
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _124)
{
    float px = 1.0 / _124.iResolution[1u];
    float2 p = fragCoord * px;
    float4 acc = float4(0.0);
    float3 _459;
    float3 _469;
    float a;
    for (int i = 7; i >= 0; i--)
    {
        int param = i;
        bool param_1 = _124.uDemo != 0u;
        float4 c = clickAt(param, param_1, _124);
        if (c.w < 0.5)
        {
            continue;
        }
        float age = _124.iTime - c.z;
        bool _287 = age < 0.0;
        bool _296;
        if (!_287)
        {
            _296 = age > _124.uLife;
        }
        else
        {
            _296 = _287;
        }
        if (_296)
        {
            continue;
        }
        float life = age / _124.uLife;
        float2 origin = c.xy * px;
        float flash = exp((-age) * 18.0) * exp((-dot(p - origin, p - origin)) / 0.00200000009499490261077880859375);
        float4 param_2 = acc;
        float3 param_3 = float3(1.0);
        float param_4 = fast::clamp(flash, 0.0, 1.0);
        acc = over(param_2, param_3, param_4);
        float slow = (1.0 - exp((-2.5) * age)) / 2.5;
        for (int j = 0; j < 48; j++)
        {
            if (j >= _124.uCount)
            {
                break;
            }
            float2 param_5 = float2((float(j) * 7.13000011444091796875) + 1.0, (c.z * 3.099999904632568359375) + float(i));
            float2 h = hash22(param_5);
            float2 param_6 = (h * 91.6999969482421875) + float2(c.z);
            float h3 = hash12(param_6);
            float angle = h.x * 6.28318023681640625;
            float2 v0 = ((float2(cos(angle), sin(angle)) * _124.uSpread) * (0.300000011920928955078125 + (0.699999988079071044921875 * h.y))) + float2(0.0, _124.uSpread * 0.3499999940395355224609375);
            float2 pos = (origin + (v0 * slow)) - float2(0.0, (((0.5 * _124.uGravity) * 0.60000002384185791015625) * age) * age);
            bool _440 = abs(p.x - pos.x) > 0.0599999986588954925537109375;
            bool _451;
            if (!_440)
            {
                _451 = abs(p.y - pos.y) > 0.0599999986588954925537109375;
            }
            else
            {
                _451 = _440;
            }
            if (_451)
            {
                continue;
            }
            if (h3 < 0.333000004291534423828125)
            {
                _459 = _124.uColorA;
            }
            else
            {
                if (h3 < 0.666999995708465576171875)
                {
                    _469 = _124.uColorB;
                }
                else
                {
                    _469 = float3(_124.uColorC);
                }
                _459 = _469;
            }
            float3 col = _459;
            if (_124.uConfetti != 0u)
            {
                float spin = (((h3 - 0.5) * 20.0) * age) + angle;
                float cs = cos(spin);
                float sn = sin(spin);
                float2 q = float2x2(float2(cs, sn), float2(-sn, cs)) * (p - pos);
                float2 size = float2(0.010999999940395355224609375, (0.006000000052154064178466796875 * abs(cos((age * (4.0 + (6.0 * h.y))) + (h.x * 9.0)))) + px);
                float2 e = abs(q) - size;
                float sd = length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0);
                a = (1.0 - smoothstep(-px, px, sd)) * (1.0 - smoothstep(0.699999988079071044921875, 1.0, life));
                col *= (0.75 + (0.25 * cs));
            }
            else
            {
                float2 v = (v0 * exp((-2.5) * age)) - float2(0.0, (_124.uGravity * 0.60000002384185791015625) * age);
                float r = (0.0040000001899898052215576171875 * (1.0 - (0.60000002384185791015625 * life))) + px;
                float2 param_7 = p;
                float2 param_8 = pos;
                float2 param_9 = pos - (v * 0.0500000007450580596923828125);
                float sd_1 = segment(param_7, param_8, param_9) - r;
                a = (1.0 - smoothstep(-px, px, sd_1)) * (1.0 - life);
                a += ((exp((-fast::max(sd_1, 0.0)) / (r * 2.0)) * 0.3499999940395355224609375) * (1.0 - life));
                col = mix(col, float3(1.0), float3(exp((-fast::max(sd_1 + r, 0.0)) / (r * 0.5)) * 0.60000002384185791015625));
            }
            float4 param_10 = acc;
            float3 param_11 = col;
            float param_12 = fast::clamp(a, 0.0, 1.0);
            acc = over(param_10, param_11, param_12);
        }
    }
    float4 param_13 = acc;
    fragColor = unpremultiply(param_13);
}

fragment flair_click_burst_frag_out flair_click_burst_frag(constant FlairUniforms& _124 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_click_burst_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _671;
    if (_124.flair_flipY > 0.5)
    {
        _671 = _124.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _671 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _671);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _124);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

