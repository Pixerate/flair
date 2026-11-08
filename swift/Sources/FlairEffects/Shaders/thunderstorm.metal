// flair-metal-hash: d8b85d94
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
    float3 uSky;
    float3 uCloud;
    float3 uFlash;
    packed_float3 uRainColor;
    float uFrequency;
    float uRain;
    float uSpeed;
    uint uBolts;
};

struct flair_thunderstorm_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float3 flashAt(thread const float& slot, thread const float& t)
{
    float2 param = float2(slot, 1.7000000476837158203125);
    float h = hash12(param);
    if (h > 0.699999988079071044921875)
    {
        return float3(0.0);
    }
    float2 param_1 = float2(slot, 4.099999904632568359375);
    float start = hash12(param_1) * 0.5;
    float tau = t - start;
    if (tau < 0.0)
    {
        return float3(0.0);
    }
    float b = (exp((-tau) * 9.0) + ((0.699999988079071044921875 * exp((-fast::max(tau - 0.119999997317790985107421875, 0.0)) * 12.0)) * step(0.119999997317790985107421875, tau))) + ((0.4000000059604644775390625 * exp((-fast::max(tau - 0.300000011920928955078125, 0.0)) * 6.0)) * step(0.300000011920928955078125, tau));
    float2 param_2 = float2(slot, 9.30000019073486328125);
    float2 param_3 = float2(slot, 2.2000000476837158203125);
    return float3(b, hash12(param_2), step(0.449999988079071044921875, hash12(param_3)));
}

static inline __attribute__((always_inline))
float rain(thread const float2& p, thread const float& cols, thread const float& speed, thread const float& slant, thread const float& seed, constant FlairUniforms& _281)
{
    float2 q = float2(p.x + (p.y * slant), p.y + (_281.iTime * speed));
    float2 g = float2((q.x * cols) + seed, (q.y * cols) / 8.0);
    float2 c = floor(g);
    float2 f = fract(g);
    float2 param = c + float2(seed);
    if (hash12(param) > _281.uRain)
    {
        return 0.0;
    }
    float2 param_1 = c + float2(1.2999999523162841796875);
    float x = 0.20000000298023223876953125 + (0.60000002384185791015625 * hash12(param_1));
    float across = (abs(f.x - x) * _281.iResolution[1u]) / cols;
    float2 param_2 = c + float2(2.900000095367431640625);
    float y0 = hash12(param_2) * 0.5;
    float body = smoothstep(y0, y0 + 0.100000001490116119384765625, f.y) * smoothstep(y0 + 0.5, y0 + 0.300000011920928955078125, f.y);
    return (1.0 - smoothstep(0.4000000059604644775390625, 1.39999997615814208984375, across)) * body;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _281)
{
    float px = 1.0 / _281.iResolution[1u];
    float2 uv = fragCoord / float2(_281.iResolution[0], _281.iResolution[1]);
    float2 p = fragCoord * px;
    float aspect = _281.iResolution[0u] / _281.iResolution[1u];
    float t = (_281.iTime * _281.uSpeed) * 0.0500000007450580596923828125;
    float2 cp = float2(p.x, p.y * 1.60000002384185791015625) * 1.60000002384185791015625;
    float2 param = cp + float2(t, 0.0);
    int param_1 = 4;
    float _422 = fbm(param, param_1);
    float2 param_2 = (cp + float2(5.19999980926513671875, 1.2999999523162841796875)) - float2(0.0, t * 0.699999988079071044921875);
    int param_3 = 4;
    float _433 = fbm(param_2, param_3);
    float2 warp = float2(_422, _433);
    float2 param_4 = (cp + (warp * 1.7999999523162841796875)) + float2(t * 2.0, 0.0);
    int param_5 = 5;
    float _448 = fbm(param_4, param_5);
    float dens = _448;
    float base = smoothstep(0.25, 0.75, uv.y + (0.3499999940395355224609375 * (dens - 0.5)));
    float cloud = fast::clamp((smoothstep(0.3499999940395355224609375, 0.680000007152557373046875, dens) * 0.75) + (base * 0.60000002384185791015625), 0.0, 1.0);
    float2 param_6 = (cp + (warp * 1.7999999523162841796875)) + float2(t * 2.0, 0.02999999932944774627685546875);
    int param_7 = 5;
    float _481 = fbm(param_6, param_7);
    float shade = _481 - dens;
    float3 col = mix(_281.uSky * 0.699999988079071044921875, _281.uCloud * fast::clamp((0.550000011920928955078125 + (5.0 * shade)) + (0.449999988079071044921875 * uv.y), 0.1500000059604644775390625, 1.60000002384185791015625), float3(cloud));
    float slotLen = 1.0 / fast::max(_281.uFrequency, 0.00999999977648258209228515625);
    float slot = floor(_281.iTime / slotLen);
    float param_8 = slot;
    float param_9 = _281.iTime - (slot * slotLen);
    float3 fl = flashAt(param_8, param_9);
    bool _533 = _281.uFrequency > 0.0;
    bool _540;
    if (_533)
    {
        _540 = fl.x > 0.00200000009499490261077880859375;
    }
    else
    {
        _540 = _533;
    }
    if (_540)
    {
        float2 param_10 = float2(slot, 6.599999904632568359375);
        float2 at = float2((0.100000001490116119384765625 + (0.800000011920928955078125 * fl.y)) * aspect, 0.7200000286102294921875 + (0.1500000059604644775390625 * hash12(param_10)));
        float d = length(p - at);
        float glow = exp((-d) * 3.2000000476837158203125);
        col += ((((_281.uFlash * fl.x) * glow) * (0.3499999940395355224609375 + ((0.89999997615814208984375 * cloud) * (1.2000000476837158203125 - dens)))) * 1.60000002384185791015625);
        col += ((_281.uFlash * fl.x) * 0.119999997317790985107421875);
        bool _602 = _281.uBolts != 0u;
        bool _608;
        if (_602)
        {
            _608 = fl.z > 0.5;
        }
        else
        {
            _608 = _602;
        }
        if (_608)
        {
            float y = p.y;
            float2 param_11 = float2(y * 5.0, slot * 3.099999904632568359375);
            int param_12 = 4;
            float _623 = fbm(param_11, param_12);
            float2 param_13 = float2(y * 40.0, slot);
            float jag = ((_623 - 0.5) * 0.3499999940395355224609375) + ((vnoise(param_13) - 0.5) * 0.02999999932944774627685546875);
            float x = at.x + jag;
            float dx = abs(p.x - x);
            float span = step(y, at.y) * smoothstep(-0.0199999995529651641845703125, 0.0500000007450580596923828125, y);
            float core = (1.0 - smoothstep(0.60000002384185791015625 * px, 2.2000000476837158203125 * px, dx)) * span;
            float halo = (exp((-dx) * 60.0) * span) * 0.5;
            float2 param_14 = float2(slot, 8.80000019073486328125);
            float forkY = (at.y - 0.20000000298023223876953125) - (0.1500000059604644775390625 * hash12(param_14));
            float2 param_15 = float2(slot, 3.2999999523162841796875);
            float2 param_16 = float2(y * 30.0, slot + 9.0);
            float fx = (x + ((forkY - y) * (0.300000011920928955078125 * sign(hash12(param_15) - 0.5)))) + ((vnoise(param_16) - 0.5) * 0.039999999105930328369140625);
            float fork = (((1.0 - smoothstep(0.5 * px, 1.60000002384185791015625 * px, abs(p.x - fx))) * step(y, forkY)) * step(forkY - 0.180000007152557373046875, y)) * smoothstep(forkY - 0.180000007152557373046875, forkY - 0.100000001490116119384765625, y);
            float strike = smoothstep(0.25, 0.60000002384185791015625, fl.x);
            col += ((((float3(1.0) * (core + (fork * 0.800000011920928955078125))) + (_281.uFlash * halo)) * strike) * 1.5);
        }
    }
    float2 param_17 = float2(p.x * 3.0, 1.0);
    int param_18 = 4;
    float _771 = fbm(param_17, param_18);
    float ridge = 0.07999999821186065673828125 + (0.039999999105930328369140625 * _771);
    col = mix(col, (_281.uSky * 0.3499999940395355224609375) + ((_281.uFlash * fl.x) * 0.1500000059604644775390625), float3(1.0 - smoothstep(ridge - px, ridge + px, p.y)));
    float2 param_19 = p;
    float param_20 = 60.0;
    float param_21 = 2.599999904632568359375;
    float param_22 = 0.119999997317790985107421875;
    float param_23 = 0.0;
    float2 param_24 = p;
    float param_25 = 24.0;
    float param_26 = 3.599999904632568359375;
    float param_27 = 0.1500000059604644775390625;
    float param_28 = 17.0;
    float r = fast::max(rain(param_19, param_20, param_21, param_22, param_23, _281) * 0.5, rain(param_24, param_25, param_26, param_27, param_28, _281));
    col = mix(col, float3(_281.uRainColor) * (1.0 + fl.x), float3(r * 0.300000011920928955078125));
    fragColor = float4(col, 1.0);
}

fragment flair_thunderstorm_frag_out flair_thunderstorm_frag(constant FlairUniforms& _281 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_thunderstorm_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _845;
    if (_281.flair_flipY > 0.5)
    {
        _845 = _281.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _845 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _845);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _281);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

