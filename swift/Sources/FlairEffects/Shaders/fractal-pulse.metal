// flair-metal-hash: 17a9b3e6
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
    float uSpeed;
    float uMorph;
    float uGlow;
    float uLurch;
    int uSteps;
    float3 uColorA;
    float3 uColorB;
    packed_float3 uGlowColor;
    uint uDemo;
};

struct flair_fractal_pulse_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _53)
{
    bool _59 = _53.uDemo != 0u;
    bool _68;
    if (_59)
    {
        _68 = _53.iBeat == 0.0;
    }
    else
    {
        _68 = _59;
    }
    bool _79;
    if (_68)
    {
        _79 = dot(_53.iAudio, _53.iAudio) == 0.0;
    }
    else
    {
        _79 = _68;
    }
    return _79;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _53)
{
    return exp((-mod(_53.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _53)
{
    return exp((-mod(_53.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _53)
{
    if (!soundDemo(_53))
    {
        return _53.iAudio;
    }
    float k = demoKick(_53);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_53.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_53.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_53))) + (0.07999999821186065673828125 * sin(_53.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _53)
{
    float _159;
    if (soundDemo(_53))
    {
        _159 = mod(_53.iTime, 0.5);
    }
    else
    {
        _159 = _53.iBeat;
    }
    return _159;
}

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float fractal(thread const float3& p, thread const float& shape, thread float& trap)
{
    float3 q = p;
    float param = p.z * 0.1500000059604644775390625;
    float3 _197 = q;
    float2 _199 = rot(param) * _197.xy;
    q.x = _199.x;
    q.y = _199.y;
    float scale = 1.0;
    trap = 1000.0;
    for (int i = 0; i < 7; i++)
    {
        q = float3(-1.0) + (fract((q * 0.5) + float3(0.5)) * 2.0);
        float r2 = fast::max(dot(q, q), 9.9999999747524270787835121154785e-07);
        trap = fast::min(trap, r2);
        float k = shape / r2;
        q *= k;
        scale *= k;
    }
    return fast::max((0.25 * abs(q.y)) / scale, 0.300000011920928955078125 - length(p.xy));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _53, thread float& trap)
{
    float2 p = (fragCoord - (float2(_53.iResolution[0], _53.iResolution[1]) * 0.5)) / float2(_53.iResolution[1u]);
    float4 s = sound(_53);
    float b = beat(_53);
    float _283;
    if (b >= 0.0)
    {
        _283 = exp((-b) * 5.0);
    }
    else
    {
        _283 = 0.0;
    }
    float hit = _283;
    float shape = (1.03999996185302734375 + ((0.1599999964237213134765625 * _53.uMorph) * s.y)) + (0.039999999105930328369140625 * sin(_53.iTime * 0.12999999523162841796875));
    float _315;
    if (b >= 0.0)
    {
        _315 = ((_53.uLurch * 0.25) * (1.0 - exp((-b) * 14.0))) * exp((-b) * 3.0);
    }
    else
    {
        _315 = 0.0;
    }
    float lurch = _315;
    float z = (_53.iTime * _53.uSpeed) + lurch;
    float3 ro = float3(0.07999999821186065673828125 * sin(z * 0.89999997615814208984375), 0.07999999821186065673828125 * cos(z * 0.699999988079071044921875), z);
    float3 ta = float3(0.07999999821186065673828125 * sin((z + 0.5) * 0.89999997615814208984375), 0.07999999821186065673828125 * cos((z + 0.5) * 0.699999988079071044921875), z + 0.5);
    float3 fw = fast::normalize(ta - ro);
    float roll = (_53.iTime * 0.0500000007450580596923828125) + (0.1500000059604644775390625 * s.z);
    float3 rt = fast::normalize(cross(float3(sin(roll), cos(roll), 0.0), fw));
    float3 up = cross(fw, rt);
    float3 rd = fast::normalize(((rt * p.x) + (up * p.y)) + (fw * (1.10000002384185791015625 + ((0.25 * hit) * _53.uLurch))));
    float t = 0.00999999977648258209228515625;
    float glow = 0.0;
    float steps = 0.0;
    bool found = false;
    for (int i = 0; i < 128; i++)
    {
        if (i >= _53.uSteps)
        {
            break;
        }
        float3 param = ro + (rd * t);
        float param_1 = shape;
        float _455 = fractal(param, param_1, trap);
        float d = _455;
        glow += (0.01200000010430812835693359375 / (1.0 + ((d * d) * 4000.0)));
        steps += 1.0;
        if (d < (0.00039999998989515006542205810546875 * t))
        {
            found = true;
            break;
        }
        t += (d * 0.89999997615814208984375);
        if (t > 6.0)
        {
            break;
        }
    }
    float3 fog = mix(_53.uColorB * 0.119999997317790985107421875, _53.uColorA * 0.800000011920928955078125, float3(exp((-length(p)) * 5.0) * (0.300000011920928955078125 + (0.699999988079071044921875 * s.x))));
    float3 col = fog;
    if (found)
    {
        float3 pos = ro + (rd * t);
        float2 e = float2(0.0005000000237487256526947021484375 * t, (-0.0005000000237487256526947021484375) * t);
        float3 param_2 = pos + e.xyy;
        float param_3 = shape;
        float _540 = fractal(param_2, param_3, trap);
        float3 param_4 = pos + e.yyx;
        float param_5 = shape;
        float _551 = fractal(param_4, param_5, trap);
        float3 param_6 = pos + e.yxy;
        float param_7 = shape;
        float _563 = fractal(param_6, param_7, trap);
        float3 param_8 = pos + e.xxx;
        float param_9 = shape;
        float _575 = fractal(param_8, param_9, trap);
        float3 n = fast::normalize((((e.xyy * _540) + (e.yyx * _551)) + (e.yxy * _563)) + (e.xxx * _575));
        float3 param_10 = pos;
        float param_11 = shape;
        float _583 = fractal(param_10, param_11, trap);
        float3 base = mix(_53.uColorA, _53.uColorB, float3(fast::clamp(trap * 1.60000002384185791015625, 0.0, 1.0)));
        float ao = 1.0 - (steps / float(_53.uSteps));
        float diff = 0.3499999940395355224609375 + (0.64999997615814208984375 * fast::max(dot(n, -rd), 0.0));
        col = mix((base * diff) * (0.300000011920928955078125 + (0.89999997615814208984375 * ao)), fog, float3(1.0 - exp((-t) * 0.60000002384185791015625)));
    }
    col += (((float3(_53.uGlowColor) * glow) * _53.uGlow) * ((0.1500000059604644775390625 + (1.5 * s.w)) + (0.5 * hit)));
    fragColor = float4(float3(1.0) - exp((-col) * 1.5), 1.0);
}

fragment flair_fractal_pulse_frag_out flair_fractal_pulse_frag(constant FlairUniforms& _53 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fractal_pulse_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float trap;
    float _670;
    if (_53.flair_flipY > 0.5)
    {
        _670 = _53.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _670 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _670);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _53, trap);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

