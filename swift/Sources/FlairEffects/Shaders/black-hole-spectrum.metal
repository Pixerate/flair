// flair-metal-hash: 378d34b1
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
    float uTilt;
    float uLens;
    float uSpin;
    float uDoppler;
    float uReact;
    float uFlash;
    float3 uColorHot;
    packed_float3 uColorCool;
    float uStars;
    uint uDemo;
};

struct flair_black_hole_spectrum_frag_out
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
bool soundDemo(constant FlairUniforms& _162)
{
    bool _167 = _162.uDemo != 0u;
    bool _175;
    if (_167)
    {
        _175 = _162.iBeat == 0.0;
    }
    else
    {
        _175 = _167;
    }
    bool _186;
    if (_175)
    {
        _186 = dot(_162.iAudio, _162.iAudio) == 0.0;
    }
    else
    {
        _186 = _175;
    }
    return _186;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _162)
{
    return exp((-mod(_162.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _162)
{
    return exp((-mod(_162.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _162)
{
    if (!soundDemo(_162))
    {
        return _162.iAudio;
    }
    float k = demoKick(_162);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_162.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_162.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_162))) + (0.07999999821186065673828125 * sin(_162.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _162)
{
    float _266;
    if (soundDemo(_162))
    {
        _266 = mod(_162.iTime, 0.5);
    }
    else
    {
        _266 = _162.iBeat;
    }
    return _266;
}

static inline __attribute__((always_inline))
float spectrum(thread float& x, constant FlairUniforms& _162)
{
    x = fast::clamp(x, 0.0, 1.0);
    if (soundDemo(_162))
    {
        float tilt = 0.800000011920928955078125 - (0.5 * x);
        float wander = ((0.60000002384185791015625 + (0.25 * sin((_162.iTime * 0.699999988079071044921875) + (x * 5.0)))) + (0.100000001490116119384765625 * sin((x * 23.0) + (_162.iTime * 2.2999999523162841796875)))) + (0.070000000298023223876953125 * sin((x * 47.0) - (_162.iTime * 3.7000000476837158203125)));
        return fast::clamp(((tilt * wander) + ((0.550000011920928955078125 * demoKick(_162)) * exp((-x) * 7.0))) + ((0.3499999940395355224609375 * demoHat(_162)) * smoothstep(0.550000011920928955078125, 0.89999997615814208984375, x)), 0.0, 1.0);
    }
    float f = x * 63.0;
    int i = int(f);
    int j = min((i + 1), 63);
    return mix(_162.iSpectrum[i / 4][spvSMod(i, 4)], _162.iSpectrum[j / 4][spvSMod(j, 4)], f - float(i));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
float4 disk(thread const float3& at, thread const float& rr, thread const float3& dir, thread const float4& s, thread const float& b, constant FlairUniforms& _162)
{
    float x = (rr - 2.599999904632568359375) / 6.400000095367431640625;
    float param = 1.0 - x;
    float _504 = spectrum(param, _162);
    float level0 = _504 * _162.uReact;
    float param_1 = ((_162.iTime * _162.uSpin) * 6.0) / powr(rr, 1.5);
    float2 q = rot(param_1) * at.xz;
    float2 param_2 = q * 1.2999999523162841796875;
    float2 param_3 = (q * 3.7000000476837158203125) + float2(9.0);
    float n = (vnoise(param_2) * 0.64999997615814208984375) + (vnoise(param_3) * 0.3499999940395355224609375);
    float gas = (0.3499999940395355224609375 + ((1.10000002384185791015625 * n) * n)) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sin((rr * 7.0) + (n * 3.0))));
    float edge = smoothstep(0.0, 0.0500000007450580596923828125, x) * smoothstep(1.0, 0.60000002384185791015625, x);
    float heat = 0.25 + ((0.75 * (1.0 - x)) * (1.0 - x));
    float _577;
    if (b >= 0.0)
    {
        _577 = (exp(-powr((x - (b * 1.60000002384185791015625)) / 0.0500000007450580596923828125, 2.0)) * exp((-b) * 2.0)) * _162.uFlash;
    }
    else
    {
        _577 = 0.0;
    }
    float ripple = _577;
    float e = edge * ((gas * ((0.60000002384185791015625 * heat) + (1.39999997615814208984375 * level0))) + (1.5 * ripple));
    float3 vel = fast::normalize(float3(-at.z, 0.0, at.x));
    float beta = fast::clamp((_162.uDoppler * (0.550000011920928955078125 + (0.3499999940395355224609375 * s.z))) * sqrt(2.599999904632568359375 / rr), 0.0, 0.89999997615814208984375);
    float g = sqrt(1.0 - (beta * beta)) / (1.0 - (beta * dot(vel, -dir)));
    float3 c = mix(_162.uColorHot, float3(_162.uColorCool), float3(smoothstep(0.0, 0.800000011920928955078125, x)));
    c = mix(c, float3(0.75, 0.85000002384185791015625, 1.0) * fast::max(c.x, fast::max(c.y, c.z)), float3(fast::clamp((g - 1.0) * 0.800000011920928955078125, 0.0, 0.60000002384185791015625)));
    c *= mix(float3(1.0), float3(1.0, 0.449999988079071044921875, 0.25), float3(fast::clamp((1.0 - g) * 1.5, 0.0, 1.0)));
    return float4(((((c * e) * g) * g) * g) * 1.2000000476837158203125, fast::clamp(e * 0.89999997615814208984375, 0.0, 0.920000016689300537109375));
}

static inline __attribute__((always_inline))
float hash13(thread float3& p)
{
    p = fract(p * 0.103100001811981201171875);
    p += float3(dot(p, p.zyx + float3(31.31999969482421875)));
    return fract((p.x + p.y) * p.z);
}

static inline __attribute__((always_inline))
float3 sky(thread const float3& d, thread const float& shimmer, constant FlairUniforms& _162)
{
    float3 col = float3(0.0040000001899898052215576171875, 0.004999999888241291046142578125, 0.01200000010430812835693359375) + (float3(0.02999999932944774627685546875, 0.02199999988079071044921875, 0.04500000178813934326171875) * exp((-abs(d.y + (0.3499999940395355224609375 * d.x))) * 5.0));
    float3 g = d * 90.0;
    float3 param = floor(g);
    float _448 = hash13(param);
    float h = _448;
    if (h > 0.98199999332427978515625)
    {
        float star = exp((-length(fract(g) - float3(0.5))) * 9.0);
        float3 tint = mix(float3(0.699999988079071044921875, 0.800000011920928955078125, 1.0), float3(1.0, 0.85000002384185791015625, 0.699999988079071044921875), float3(fract(h * 37.0)));
        col += ((tint * star) * (1.2000000476837158203125 + (shimmer * sin((_162.iTime * 7.0) + (h * 90.0)))));
    }
    return col;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _162)
{
    float param = 0.119999997317790985107421875;
    float2 p = (rot(param) * (fragCoord - (float2(_162.iResolution[0], _162.iResolution[1]) * 0.5))) / float2(_162.iResolution[1u]);
    float4 s = sound(_162);
    float b = beat(_162);
    float _731;
    if (b >= 0.0)
    {
        _731 = exp((-b) * 6.0);
    }
    else
    {
        _731 = 0.0;
    }
    float hit = _731;
    float tilt = radians(_162.uTilt);
    float3 ro = float3(0.0, sin(tilt), -cos(tilt)) * 16.0;
    float3 fw = fast::normalize(-ro);
    float3 rt = fast::normalize(cross(float3(0.0, 1.0, 0.0), fw));
    float3 up = cross(fw, rt);
    float3 pos = ro;
    float3 v = fast::normalize(((rt * p.x) + (up * p.y)) + (fw * 1.25));
    float3 h = cross(pos, v);
    float pull = ((1.5 * dot(h, h)) * _162.uLens) * (1.0 + ((0.3499999940395355224609375 * hit) * _162.uFlash));
    float3 light = float3(0.0);
    float clear = 1.0;
    float closest = 1000.0;
    for (int i = 0; i < 120; i++)
    {
        float r = length(pos);
        closest = fast::min(closest, r);
        if (r < 1.0)
        {
            clear = 0.0;
            break;
        }
        bool _830 = r > 24.0;
        bool _837;
        if (_830)
        {
            _837 = dot(pos, v) > 0.0;
        }
        else
        {
            _837 = _830;
        }
        if (_837)
        {
            break;
        }
        float dt = fast::clamp(0.100000001490116119384765625 * r, 0.0199999995529651641845703125, 0.800000011920928955078125);
        float3 prev = pos;
        v = fast::normalize(v - (((pos * pull) / float3(powr(r, 5.0))) * dt));
        pos += (v * dt);
        if ((prev.y * pos.y) < 0.0)
        {
            float3 at = mix(prev, pos, float3(prev.y / (prev.y - pos.y)));
            float rr = length(at.xz);
            if ((rr > 2.599999904632568359375) && (rr < 9.0))
            {
                float3 param_1 = at;
                float param_2 = rr;
                float3 param_3 = v;
                float4 param_4 = s;
                float param_5 = b;
                float4 d = disk(param_1, param_2, param_3, param_4, param_5, _162);
                light += (d.xyz * clear);
                clear *= (1.0 - d.w);
                if (clear < 0.00999999977648258209228515625)
                {
                    break;
                }
            }
        }
    }
    float3 param_6 = v;
    float param_7 = s.w;
    float3 col = light + ((sky(param_6, param_7, _162) * clear) * _162.uStars);
    float ring = exp(-powr((closest - 1.5499999523162841796875) / 0.100000001490116119384765625, 2.0));
    col += (((_162.uColorHot * ring) * (0.20000000298023223876953125 + ((2.0 * hit) * _162.uFlash))) * (0.5 + s.x));
    fragColor = float4(float3(1.0) - exp((-col) * 1.39999997615814208984375), 1.0);
}

fragment flair_black_hole_spectrum_frag_out flair_black_hole_spectrum_frag(constant FlairUniforms& _162 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_black_hole_spectrum_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _992;
    if (_162.flair_flipY > 0.5)
    {
        _992 = _162.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _992 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _992);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _162);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

