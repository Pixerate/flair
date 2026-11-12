// flair-metal-hash: aefe4136
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
    int uTowers;
    float uGain;
    float uSpeed;
    float3 uSunTop;
    float3 uSunBottom;
    float3 uNeon;
    float3 uGrid;
    packed_float3 uSky;
    uint uDemo;
};

struct flair_neon_skyline_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _98)
{
    bool _103 = _98.uDemo != 0u;
    bool _112;
    if (_103)
    {
        _112 = _98.iBeat == 0.0;
    }
    else
    {
        _112 = _103;
    }
    bool _123;
    if (_112)
    {
        _123 = dot(_98.iAudio, _98.iAudio) == 0.0;
    }
    else
    {
        _123 = _112;
    }
    return _123;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _98)
{
    return exp((-mod(_98.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _98)
{
    return exp((-mod(_98.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _98)
{
    if (!soundDemo(_98))
    {
        return _98.iAudio;
    }
    float k = demoKick(_98);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_98.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_98.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_98))) + (0.07999999821186065673828125 * sin(_98.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _98)
{
    float _203;
    if (soundDemo(_98))
    {
        _203 = mod(_98.iTime, 0.5);
    }
    else
    {
        _203 = _98.iBeat;
    }
    return _203;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _98)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_98))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_98.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_98.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_98.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_98)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_98)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_98.iSpectrum[i / 4][spvSMod(i, 4)], _98.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float box(thread const float2& p, thread const float2& hs)
{
    float2 q = abs(p) - hs;
    return length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0);
}

static inline __attribute__((always_inline))
float3 towers(thread float3& col, thread const float& x, thread const float& y, thread const float& n, thread const float& aspect, thread const float& px, thread const float& far, thread const float& seed, thread const float& flicker, constant FlairUniforms& _98)
{
    float cell = floor(x * n);
    float within = fract(x * n);
    float cw = aspect / n;
    float2 param = float2(cell, seed);
    float h1 = hash12(param);
    float width = 0.550000011920928955078125 + (0.3499999940395355224609375 * h1);
    float _362;
    if (far > 0.5)
    {
        _362 = 1.0 - ((cell + 0.5) / n);
    }
    else
    {
        _362 = (cell + 0.5) / n;
    }
    float param_1 = _362;
    float _377 = spectrum(param_1, _98);
    float level0 = fast::clamp(_377 * _98.uGain, 0.0, 1.0);
    float _386;
    if (far > 0.5)
    {
        _386 = (0.0599999986588954925537109375 + (0.07999999821186065673828125 * h1)) + (0.1599999964237213134765625 * level0);
    }
    else
    {
        _386 = (0.02999999932944774627685546875 + (0.039999999105930328369140625 * h1)) + (0.2800000011920928955078125 * level0);
    }
    float tall = _386;
    tall *= mix(0.300000011920928955078125, 1.0, smoothstep(0.039999999105930328369140625, 0.300000011920928955078125, abs(((cell + 0.5) / n) - 0.5)));
    float2 local = float2((within - 0.5) * cw, (y - 0.37999999523162841796875) - (tall * 0.5));
    float2 param_2 = local;
    float2 param_3 = float2((width * 0.5) * cw, tall * 0.5);
    float d = box(param_2, param_3);
    float3 _445;
    if (far > 0.5)
    {
        _445 = mix(_98.uNeon, _98.uSunBottom, float3(0.60000002384185791015625)) * 0.5;
    }
    else
    {
        _445 = _98.uNeon;
    }
    float3 neon = _445;
    col += (((neon * 0.25) * exp((-fast::max(d, 0.0)) / 0.00999999977648258209228515625)) * step(0.37999999523162841796875, y));
    if (d < 0.0)
    {
        float3 _483;
        if (far > 0.5)
        {
            _483 = mix(float3(_98.uSky), _98.uSunBottom, float3(0.180000007152557373046875)) * 0.699999988079071044921875;
        }
        else
        {
            _483 = float3(_98.uSky) * 0.3499999940395355224609375;
        }
        float3 body = _483;
        float2 w = (local + float2((width * 0.5) * cw, tall * 0.5)) / float2(0.010999999940395355224609375, 0.01600000075995922088623046875);
        float2 wf = fract(w);
        float2 param_4 = floor(w) + float2(cell * 31.0, seed + flicker);
        float lit = step(hash12(param_4), (0.119999997317790985107421875 + (0.699999988079071044921875 * level0)) * ((far > 0.5) ? 0.4000000059604644775390625 : 1.0));
        float pane = (((step(0.300000011920928955078125, wf.x) * step(wf.x, 0.699999988079071044921875)) * step(0.300000011920928955078125, wf.y)) * step(wf.y, 0.699999988079071044921875)) * step(0.0199999995529651641845703125, -d);
        float2 param_5 = floor(w) + float2(7.0);
        body = mix(body, mix(_98.uSunTop, _98.uNeon, float3(hash12(param_5))) * ((far > 0.5) ? 0.5 : 0.89999997615814208984375), float3(lit * pane));
        col = body;
    }
    return mix(col, neon, float3(fast::clamp(1.2000000476837158203125 - (abs(d) / px), 0.0, 1.0) * step(0.37999999523162841796875, y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _98)
{
    float2 uv = fragCoord / float2(_98.iResolution[0], _98.iResolution[1]);
    float px = 1.0 / _98.iResolution[1u];
    float aspect = _98.iResolution[0u] / _98.iResolution[1u];
    float2 p = float2((uv.x - 0.5) * aspect, uv.y);
    float4 s = sound(_98);
    float b = beat(_98);
    float _632;
    if (b >= 0.0)
    {
        _632 = exp((-b) * 6.0);
    }
    else
    {
        _632 = 0.0;
    }
    float hit = _632;
    float3 col;
    if (p.y > 0.37999999523162841796875)
    {
        float y = p.y - 0.37999999523162841796875;
        col = mix(_98.uSunBottom * 0.3499999940395355224609375, float3(_98.uSky), float3(smoothstep(0.0, 0.449999988079071044921875, y)));
        float2 param = floor(fragCoord / float2(2.0));
        col += ((float3(0.89999997615814208984375) * step(0.9969999790191650390625, hash12(param))) * smoothstep(0.1500000059604644775390625, 0.5, y));
        float2 sc = float2(0.0, 0.62999999523162841796875);
        float rad = 0.20000000298023223876953125 * ((1.0 + (0.07999999821186065673828125 * s.x)) + (0.039999999105930328369140625 * hit));
        float d = length(p - sc) - rad;
        float sy = (p.y - sc.y) / rad;
        float3 sun = mix(_98.uSunBottom, _98.uSunTop, float3(smoothstep(-0.89999997615814208984375, 0.89999997615814208984375, sy)));
        float stripes = 1.0;
        if (sy < 0.20000000298023223876953125)
        {
            float f = fract((((sy - 0.20000000298023223876953125) * 7.0) + (_98.iTime * 0.4000000059604644775390625)) + (0.5 * hit));
            float gap = mix(0.0500000007450580596923828125, 0.5, fast::clamp((0.20000000298023223876953125 - sy) / 1.2000000476837158203125, 0.0, 1.0)) * (1.0 + (0.60000002384185791015625 * hit));
            stripes = smoothstep(gap, gap + ((7.0 * px) / rad), f);
        }
        col += ((sun * 0.3499999940395355224609375) * exp((-fast::max(d, 0.0)) / 0.07999999821186065673828125));
        col = mix(col, sun * 1.10000002384185791015625, float3(fast::clamp(0.5 - (d / px), 0.0, 1.0) * stripes));
        float flicker = floor(_98.iTime - fast::max(b, 0.0)) * 13.0;
        float3 param_1 = col;
        float param_2 = uv.x + 0.0130000002682209014892578125;
        float param_3 = p.y;
        float param_4 = floor(float(_98.uTowers) * 1.7000000476837158203125);
        float param_5 = aspect;
        float param_6 = px;
        float param_7 = 1.0;
        float param_8 = 5.0;
        float param_9 = flicker;
        float3 _811 = towers(param_1, param_2, param_3, param_4, param_5, param_6, param_7, param_8, param_9, _98);
        col = _811;
        float3 param_10 = col;
        float param_11 = uv.x;
        float param_12 = p.y;
        float param_13 = float(_98.uTowers);
        float param_14 = aspect;
        float param_15 = px;
        float param_16 = 0.0;
        float param_17 = 1.0;
        float param_18 = flicker;
        float3 _832 = towers(param_10, param_11, param_12, param_13, param_14, param_15, param_16, param_17, param_18, _98);
        col = _832;
    }
    else
    {
        float y_1 = 0.37999999523162841796875 - p.y;
        float z = 0.119999997317790985107421875 / y_1;
        float run = ((_98.iTime * _98.uSpeed) * 2.0) + (((0.60000002384185791015625 * s.y) + (0.800000011920928955078125 * hit)) * _98.uSpeed);
        float2 g = float2((p.x * z) * 2.0, z + run);
        float2 gl = abs(fract(g - float2(0.5)) - float2(0.5)) / fast::max(fwidth(g), float2(9.9999997473787516355514526367188e-05));
        float near = fast::min(gl.x, gl.y);
        float fade = smoothstep(0.0, 0.039999999105930328369140625, y_1);
        col = mix(float3(_98.uSky) * 0.25, float3(0.0), float3(smoothstep(0.0, 0.300000011920928955078125, y_1)));
        col += (((_98.uGrid * (fast::clamp(1.0 - near, 0.0, 1.0) + (0.3499999940395355224609375 * exp((-near) * 0.300000011920928955078125)))) * fade) * (0.699999988079071044921875 + (0.5 * s.x)));
        col += ((_98.uSunBottom * 0.60000002384185791015625) * exp((-y_1) * 30.0));
        col += (((_98.uSunBottom * 0.25) * exp((-abs(p.x)) / 0.07999999821186065673828125)) * exp((-y_1) * 6.0));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_neon_skyline_frag_out flair_neon_skyline_frag(constant FlairUniforms& _98 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_neon_skyline_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _967;
    if (_98.flair_flipY > 0.5)
    {
        _967 = _98.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _967 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _967);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _98);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

