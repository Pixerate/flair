// flair-metal-hash: 7d11ad52
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

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
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
    float uHeight;
    float uSway;
    float uReact;
    float3 uColorLow;
    float3 uColorHigh;
    float3 uFringe;
    packed_float3 uSky;
    uint uLake;
    uint uDemo;
};

struct flair_aurora_curtain_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _154)
{
    bool _159 = _154.uDemo != 0u;
    bool _167;
    if (_159)
    {
        _167 = _154.iBeat == 0.0;
    }
    else
    {
        _167 = _159;
    }
    bool _178;
    if (_167)
    {
        _178 = dot(_154.iAudio, _154.iAudio) == 0.0;
    }
    else
    {
        _178 = _167;
    }
    return _178;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _154)
{
    return exp((-mod(_154.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _154)
{
    return exp((-mod(_154.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _154)
{
    if (!soundDemo(_154))
    {
        return _154.iAudio;
    }
    float k = demoKick(_154);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_154.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_154.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_154))) + (0.07999999821186065673828125 * sin(_154.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _154)
{
    float _258;
    if (soundDemo(_154))
    {
        _258 = mod(_154.iTime, 0.5);
    }
    else
    {
        _258 = _154.iBeat;
    }
    return _258;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _154)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_154))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_154.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_154.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_154.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_154)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_154)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_154.iSpectrum[i / 4][spvSMod(i, 4)], _154.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
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
float3 aurora(thread const float2& q, thread const float4& s, thread const float& b, constant FlairUniforms& _154)
{
    float3 light = float3(0.0);
    float t = _154.iTime;
    float param = fast::clamp(q.x, 0.0, 1.0);
    float _381 = spectrum(param, _154);
    float level0 = _381 * _154.uReact;
    float _568;
    for (int layer = 0; layer < 3; layer++)
    {
        float L = float(layer);
        float near = 1.0 - (0.2800000011920928955078125 * L);
        float x = (q.x * (1.0 + (0.300000011920928955078125 * L))) + (L * 0.37000000476837158203125);
        float sway = (_154.uSway * (0.039999999105930328369140625 + (0.07999999821186065673828125 * s.y))) * sin(((x * 2.2999999523162841796875) + (t * 0.5)) + (L * 2.0));
        float2 param_1 = float2((x * 2.0) + (t * 0.070000000298023223876953125), L * 7.0);
        float foot = ((0.119999997317790985107421875 + (0.100000001490116119384765625 * L)) + (0.0599999986588954925537109375 * vnoise(param_1))) + sway;
        float above = q.y - foot;
        if (above < (-0.0199999995529651641845703125))
        {
            continue;
        }
        float a = ((x * 9.0) + (t * 0.3499999940395355224609375)) + (L * 4.0);
        float a2 = (x * 17.0) - (t * 0.5);
        float xw = (x + ((0.550000011920928955078125 * sin(a)) / 9.0)) + ((0.300000011920928955078125 * sin(a2)) / 17.0);
        float fold = 0.4000000059604644775390625 + (0.3499999940395355224609375 * fast::min(1.0 / fast::max(abs((1.0 + (0.550000011920928955078125 * cos(a))) + (0.300000011920928955078125 * cos(a2))), 0.180000007152557373046875), 4.0));
        float top = (_154.uHeight * (0.119999997317790985107421875 + (0.550000011920928955078125 * level0))) * near;
        float lower = smoothstep(-0.0199999995529651641845703125, 0.00999999977648258209228515625, above);
        float fall = exp(((-fast::max(above, 0.0)) / fast::max(top, 0.0199999995529651641845703125)) * 1.60000002384185791015625);
        float2 param_2 = float2((xw * 60.0) + (t * 0.60000002384185791015625), L * 13.0);
        float2 param_3 = float2((xw * 160.0) - (t * 1.2999999523162841796875), L);
        float rays = (0.449999988079071044921875 + (0.550000011920928955078125 * vnoise(param_2))) * (0.699999988079071044921875 + (0.300000011920928955078125 * vnoise(param_3)));
        if (b >= 0.0)
        {
            _568 = exp(-powr((above - (b * 0.5)) / 0.039999999105930328369140625, 2.0)) * exp((-b) * 2.5);
        }
        else
        {
            _568 = 0.0;
        }
        float pulse = _568;
        float3 c = mix(_154.uColorLow, _154.uColorHigh, float3(smoothstep(0.0, 1.0, above / fast::max(top * 1.5, 0.0500000007450580596923828125))));
        float fringe = ((exp((-fast::max(above, 0.0)) / 0.01200000010430812835693359375) * lower) * s.w) * (0.5 + (0.5 * sin((xw * 80.0) + (t * 12.0))));
        light += ((((((((c * lower) * fall) * rays) * fold) * ((0.5 + (0.60000002384185791015625 * level0)) + (1.2000000476837158203125 * pulse))) + ((_154.uFringe * fringe) * 1.2000000476837158203125)) * near) * 0.800000011920928955078125);
    }
    return light;
}

static inline __attribute__((always_inline))
float3 sky(thread const float2& q, thread const float& aspect, thread const float& px, thread const float4& s, thread const float& b, constant FlairUniforms& _154)
{
    float3 col = float3(_154.uSky) * (1.0 + (1.5 * exp((-q.y) * 5.0)));
    float2 cell = floor(float2(q.x * aspect, q.y) * 300.0);
    float2 param = cell;
    float h = hash12(param);
    col += (((float3(0.800000011920928955078125, 0.85000002384185791015625, 1.0) * step(0.995999991893768310546875, h)) * (0.5 + (0.5 * sin((_154.iTime * 2.0) + (h * 80.0))))) * smoothstep(0.0500000007450580596923828125, 0.300000011920928955078125, q.y));
    float2 param_1 = q;
    float4 param_2 = s;
    float param_3 = b;
    col += aurora(param_1, param_2, param_3, _154);
    float2 param_4 = float2(q.x * 4.0, 1.0);
    float2 param_5 = float2(q.x * 13.0, 2.0);
    float ridge = 0.039999999105930328369140625 + (0.0900000035762786865234375 * ((0.699999988079071044921875 * vnoise(param_4)) + (0.300000011920928955078125 * vnoise(param_5))));
    return mix(col, float3(_154.uSky) * 0.300000011920928955078125, float3(smoothstep(ridge + px, ridge - px, q.y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _154)
{
    float2 uv = fragCoord / float2(_154.iResolution[0], _154.iResolution[1]);
    float px = 1.0 / _154.iResolution[1u];
    float aspect = _154.iResolution[0u] / _154.iResolution[1u];
    float4 s = sound(_154);
    float b = beat(_154);
    float horizon = (_154.uLake != 0u) ? 0.300000011920928955078125 : 0.0599999986588954925537109375;
    float2 q = float2(uv.x, uv.y - horizon);
    float3 col;
    if (q.y >= 0.0)
    {
        float2 param = q;
        float param_1 = aspect;
        float param_2 = px;
        float4 param_3 = s;
        float param_4 = b;
        col = sky(param, param_1, param_2, param_3, param_4, _154);
    }
    else
    {
        float depth = -q.y;
        float2 param_5 = float2(q.x * 30.0, (4.0 / (depth + 0.0199999995529651641845703125)) + (_154.iTime * 0.60000002384185791015625));
        float wave = vnoise(param_5) - 0.5;
        float2 param_6 = float2(q.x + (((wave * 0.0199999995529651641845703125) * depth) * 3.0), depth);
        float param_7 = aspect;
        float param_8 = px;
        float4 param_9 = s;
        float param_10 = b;
        col = sky(param_6, param_7, param_8, param_9, param_10, _154) * float3(0.4000000059604644775390625, 0.449999988079071044921875, 0.5);
        col += ((_154.uColorLow * 0.02999999932944774627685546875) * exp((-depth) * 60.0));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_aurora_curtain_frag_out flair_aurora_curtain_frag(constant FlairUniforms& _154 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_aurora_curtain_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _879;
    if (_154.flair_flipY > 0.5)
    {
        _879 = _154.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _879 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _879);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _154);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

