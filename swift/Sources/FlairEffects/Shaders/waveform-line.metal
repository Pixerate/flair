// flair-metal-hash: 2129f8a7
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
    float3 uColor;
    packed_float3 uEcho;
    float uAmplitude;
    float uThickness;
    float uGlow;
    int uEchoes;
    float uSpeed;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    uint uDemo;
};

struct flair_waveform_line_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _54)
{
    bool _60 = _54.uDemo != 0u;
    bool _69;
    if (_60)
    {
        _69 = _54.iBeat == 0.0;
    }
    else
    {
        _69 = _60;
    }
    bool _80;
    if (_69)
    {
        _80 = dot(_54.iAudio, _54.iAudio) == 0.0;
    }
    else
    {
        _80 = _69;
    }
    return _80;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _54)
{
    return exp((-mod(_54.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _54)
{
    return exp((-mod(_54.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _54)
{
    if (!soundDemo(_54))
    {
        return _54.iAudio;
    }
    float k = demoKick(_54);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_54.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_54.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_54))) + (0.07999999821186065673828125 * sin(_54.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _54)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_54))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_54.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_54.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_54.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_54)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_54)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_54.iSpectrum[i / 4][spvSMod(i, 4)], _54.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float2 wave(thread const float& x, thread const float& t, constant FlairUniforms& _54)
{
    float y = 0.0;
    float dy = 0.0;
    for (int k = 0; k < 12; k++)
    {
        float fk = float(k);
        float param = (fk + 0.5) / 12.0;
        float _313 = spectrum(param, _54);
        float amp = _313 / (1.0 + (fk * 0.3499999940395355224609375));
        float freq = 6.28318023681640625 * (1.5 + (fk * 1.7000000476837158203125));
        float ph = ((t * (1.2999999523162841796875 + (fk * 0.60000002384185791015625))) * ((mod(fk, 2.0) < 0.5) ? 1.0 : (-1.0))) + (fk * 1.7000000476837158203125);
        y += (amp * sin((freq * x) + ph));
        dy += ((amp * freq) * cos((freq * x) + ph));
    }
    float env = sin(3.141590118408203125 * fast::clamp(x, 0.0, 1.0));
    float denv = 3.141590118408203125 * cos(3.141590118408203125 * fast::clamp(x, 0.0, 1.0));
    return float2(y * env, (dy * env) + (y * denv)) * 0.3499999940395355224609375;
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _54)
{
    float2 uv = fragCoord / float2(_54.iResolution[0], _54.iResolution[1]);
    float aspect = _54.iResolution[0u] / _54.iResolution[1u];
    float4 s = sound(_54);
    float3 light = float3(0.0);
    float3 _510;
    float _524;
    for (int e = 3; e >= 0; e--)
    {
        if (e > _54.uEchoes)
        {
            continue;
        }
        float lag = float(e) * 0.119999997317790985107421875;
        float param = uv.x;
        float param_1 = (_54.iTime * _54.uSpeed) - lag;
        float2 w = ((wave(param, param_1, _54) * _54.uAmplitude) * (1.0 + (0.60000002384185791015625 * s.y))) * (1.0 - (0.180000007152557373046875 * float(e)));
        float slope = w.y / aspect;
        float d = (abs((uv.y - 0.5) - w.x) * _54.iResolution[1u]) / sqrt(1.0 + (slope * slope));
        float core = fast::clamp(((_54.uThickness * 0.5) + 0.5) - d, 0.0, 1.0);
        float halo = (exp((-d) / (6.0 + (18.0 * s.x))) * _54.uGlow) * 0.5;
        if (e == 0)
        {
            _510 = _54.uColor;
        }
        else
        {
            _510 = float3(_54.uEcho);
        }
        float3 c = _510;
        if (e == 0)
        {
            _524 = 1.0;
        }
        else
        {
            _524 = 0.449999988079071044921875 / float(e);
        }
        float fade = _524;
        light += ((c * ((core * 1.60000002384185791015625) + halo)) * fade);
    }
    float3 param_2 = light;
    float4 _548 = glow(param_2);
    float4 g = _548;
    float3 col = mix(float3(_54.uBackground), g.xyz, float3(g.w));
    float alpha = fast::max(g.w, _54.uBackgroundAlpha);
    fragColor = float4(mix(g.xyz, col, float3(_54.uBackgroundAlpha)), alpha);
}

fragment flair_waveform_line_frag_out flair_waveform_line_frag(constant FlairUniforms& _54 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_waveform_line_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _591;
    if (_54.flair_flipY > 0.5)
    {
        _591 = _54.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _591 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _591);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _54);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

