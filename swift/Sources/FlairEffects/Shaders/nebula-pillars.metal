// flair-metal-hash: 47595a7f
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
    float uDrift;
    float uReact;
    float uPillars;
    float uFlare;
    float3 uBassGas;
    float3 uMidGas;
    float3 uHighGas;
    packed_float3 uDust;
    uint uDemo;
};

struct flair_nebula_pillars_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
bool soundDemo(constant FlairUniforms& _228)
{
    bool _233 = _228.uDemo != 0u;
    bool _241;
    if (_233)
    {
        _241 = _228.iBeat == 0.0;
    }
    else
    {
        _241 = _233;
    }
    bool _252;
    if (_241)
    {
        _252 = dot(_228.iAudio, _228.iAudio) == 0.0;
    }
    else
    {
        _252 = _241;
    }
    return _252;
}

static inline __attribute__((always_inline))
float demoKick(constant FlairUniforms& _228)
{
    return exp((-mod(_228.iTime, 0.5)) * 7.0);
}

static inline __attribute__((always_inline))
float demoHat(constant FlairUniforms& _228)
{
    return exp((-mod(_228.iTime + 0.25, 0.5)) * 16.0);
}

static inline __attribute__((always_inline))
float4 sound(constant FlairUniforms& _228)
{
    if (!soundDemo(_228))
    {
        return _228.iAudio;
    }
    float k = demoKick(_228);
    float mid = (0.4000000059604644775390625 + (0.119999997317790985107421875 * sin(_228.iTime * 1.7000000476837158203125))) + (0.100000001490116119384765625 * sin(_228.iTime * 3.099999904632568359375));
    return float4((0.449999988079071044921875 + (0.300000011920928955078125 * k)) + (0.100000001490116119384765625 * mid), 0.300000011920928955078125 + (0.64999997615814208984375 * k), mid, (0.25 + (0.4000000059604644775390625 * demoHat(_228))) + (0.07999999821186065673828125 * sin(_228.iTime * 5.30000019073486328125)));
}

static inline __attribute__((always_inline))
float beat(constant FlairUniforms& _228)
{
    float _330;
    if (soundDemo(_228))
    {
        _330 = mod(_228.iTime, 0.5);
    }
    else
    {
        _330 = _228.iBeat;
    }
    return _330;
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float pillars(thread const float2& p)
{
    float d = 1000.0;
    float _365;
    for (int k = 0; k < 3; k++)
    {
        float fk = float(k);
        float cx = (-0.449999988079071044921875) + (0.430000007152557373046875 * fk);
        if (fk == 1.0)
        {
            _365 = 0.23999999463558197021484375;
        }
        else
        {
            _365 = (fk == 0.0) ? 0.0599999986588954925537109375 : (-0.100000001490116119384765625);
        }
        float top = _365;
        float y = fast::clamp((p.y + 0.60000002384185791015625) / (top + 0.60000002384185791015625), 0.0, 1.0);
        float2 param = float2(p.y * 2.5, fk * 5.0);
        int param_1 = 4;
        float _404 = fbm(param, param_1);
        float x = (cx + ((0.100000001490116119384765625 * (p.y + 0.60000002384185791015625)) * (fk - 1.0))) + (0.119999997317790985107421875 * (_404 - 0.5));
        float body = fast::max(abs(p.x - x) - mix(0.20000000298023223876953125 - (0.02999999932944774627685546875 * fk), 0.07500000298023223876953125, powr(y, 0.699999988079071044921875)), p.y - top);
        d = fast::min(d, body);
    }
    float2 param_2 = p * 6.0;
    int param_3 = 5;
    float _442 = fbm(param_2, param_3);
    float2 param_4 = p * 20.0;
    int param_5 = 3;
    float _452 = fbm(param_4, param_5);
    return (d + (0.119999997317790985107421875 * (_442 - 0.5))) + (0.0350000001490116119384765625 * (_452 - 0.5));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _228)
{
    float px = 1.0 / _228.iResolution[1u];
    float2 p = (fragCoord - (float2(_228.iResolution[0], _228.iResolution[1]) * 0.5)) * px;
    float4 s = sound(_228) * _228.uReact;
    float b = beat(_228);
    float _483;
    if (b >= 0.0)
    {
        _483 = exp((-b) * 4.0) * _228.uFlare;
    }
    else
    {
        _483 = 0.0;
    }
    float hit = _483;
    float t = _228.iTime * _228.uDrift;
    float2 g = (p * (1.0 - (0.039999999105930328369140625 * sin(t * 0.300000011920928955078125)))) + float2(t * 0.0500000007450580596923828125, 0.0);
    float2 param = (g * 1.5) + float2(t * 0.100000001490116119384765625);
    int param_1 = 4;
    float _528 = fbm(param, param_1);
    float2 param_2 = ((g * 1.5) + float2(5.19999980926513671875)) - float2(t * 0.07999999821186065673828125);
    int param_3 = 4;
    float _540 = fbm(param_2, param_3);
    float2 w = float2(_528, _540);
    float2 param_4 = (g * 2.0) + (w * 1.5);
    int param_5 = 5;
    float _550 = fbm(param_4, param_5);
    float red = _550;
    float2 param_6 = ((g * 2.599999904632568359375) + (w.yx * 1.7000000476837158203125)) + float2(3.0);
    int param_7 = 5;
    float _563 = fbm(param_6, param_7);
    float teal = _563;
    float2 param_8 = ((g * 3.400000095367431640625) - (w * 1.2000000476837158203125)) + float2(7.0);
    int param_9 = 4;
    float _576 = fbm(param_8, param_9);
    float blue = _576;
    red = smoothstep(0.300000011920928955078125, 0.85000002384185791015625, red);
    teal = smoothstep(0.3499999940395355224609375, 0.85000002384185791015625, teal);
    blue = smoothstep(0.3499999940395355224609375, 0.89999997615814208984375, blue);
    float3 col = (((_228.uBassGas * red) * red) * 1.60000002384185791015625) * (0.300000011920928955078125 + (1.2999999523162841796875 * s.y));
    col += ((((_228.uMidGas * teal) * teal) * 1.39999997615814208984375) * (0.25 + (1.2999999523162841796875 * s.z)));
    col += ((((_228.uHighGas * blue) * blue) * 1.5) * (0.25 + (1.39999997615814208984375 * s.w)));
    float2 cell = floor(g * 220.0);
    float2 param_10 = cell;
    col += ((float3(0.800000011920928955078125, 0.85000002384185791015625, 1.0) * step(0.99500000476837158203125, hash12(param_10))) * 0.699999988079071044921875);
    float2 big = floor(g * 6.0);
    float2 param_11 = big;
    float2 bh = hash22(param_11);
    if (bh.x > 0.75)
    {
        float2 q = (((g * 6.0) - big) - float2(0.20000000298023223876953125)) - (bh * 0.60000002384185791015625);
        float spikes = 0.0;
        for (int i = 0; i < 3; i++)
        {
            float a = float(i) * 1.0471999645233154296875;
            float2 r = float2((cos(a) * q.x) + (sin(a) * q.y), ((-sin(a)) * q.x) + (cos(a) * q.y));
            spikes += (exp((-abs(r.y)) / 0.0040000001899898052215576171875) * exp((-abs(r.x)) / 0.119999997317790985107421875));
        }
        col += ((mix(float3(1.0, 0.89999997615814208984375, 0.800000011920928955078125), float3(0.800000011920928955078125, 0.89999997615814208984375, 1.0), float3(bh.y)) * (exp((-length(q)) / 0.006000000052154064178466796875) + (0.5 * spikes))) * (0.5 + s.w));
    }
    float2 param_12 = p;
    float d = pillars(param_12);
    float inside = smoothstep(px * 2.0, (-px) * 2.0, d) * _228.uPillars;
    float2 param_13 = p * 7.0;
    int param_14 = 3;
    float _776 = fbm(param_13, param_14);
    float2 param_15 = (p * 4.0) + float2(9.0);
    int param_16 = 3;
    float _790 = fbm(param_15, param_16);
    float3 dust = (float3(_228.uDust) * (0.5 + (0.89999997615814208984375 * _776))) + ((_228.uBassGas * 0.039999999105930328369140625) * _790);
    col = mix(col, dust, float3(inside));
    float2 star = float2(-0.0199999995529651641845703125, 0.20000000298023223876953125);
    float toward = smoothstep(0.89999997615814208984375, 0.0, length(p - star));
    float rim = (exp((-abs(d)) / 0.00999999977648258209228515625) * smoothstep(0.02999999932944774627685546875, -0.00999999977648258209228515625, d)) * _228.uPillars;
    col += (((mix(_228.uMidGas, float3(1.0, 0.85000002384185791015625, 0.699999988079071044921875), float3(0.5)) * rim) * toward) * ((0.25 + (0.60000002384185791015625 * s.x)) + (1.0 * hit)));
    float sd = length(p - star);
    col += ((float3(1.0, 0.89999997615814208984375, 0.800000011920928955078125) * hit) * ((exp((-sd) / 0.008000000379979610443115234375) * 2.0) + (exp((-sd) / 0.07999999821186065673828125) * 0.5)));
    fragColor = float4(float3(1.0) - exp((-col) * 1.39999997615814208984375), 1.0);
}

fragment flair_nebula_pillars_frag_out flair_nebula_pillars_frag(constant FlairUniforms& _228 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_nebula_pillars_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _883;
    if (_228.flair_flipY > 0.5)
    {
        _883 = _228.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _883 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _883);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _228);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

