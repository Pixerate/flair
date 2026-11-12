// flair-metal-hash: 7c9a13d0
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
    float3 uBackground;
    float3 uHorizon;
    float3 uBat;
    packed_float3 uMoon;
    float uMoonSize;
    float uCount;
    float uSize;
    float uSpeed;
    float uScatter;
    float uBackgroundAlpha;
};

struct flair_bat_swarm_frag_out
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
float bat(thread const float2& q, thread const float& f, thread const float& px)
{
    float ax = abs(q.x);
    float body = length(q / float2(0.12999999523162841796875, 0.300000011920928955078125)) - 1.0;
    float head = length(q - float2(0.0, 0.2199999988079071044921875)) - 0.100000001490116119384765625;
    float ears = fast::max((abs(ax - 0.0599999986588954925537109375) - 0.02999999932944774627685546875) + ((q.y - 0.300000011920928955078125) * 0.25), abs(q.y - 0.3300000131130218505859375) - 0.0599999986588954925537109375);
    float a = fast::clamp(fast::min(fast::min(body * 0.12999999523162841796875, head), ears) / px, -1.0, 1.0);
    float cover = 0.5 - (0.5 * a);
    if ((ax > 0.07999999821186065673828125) && (ax < 1.0))
    {
        float top = (0.100000001490116119384765625 + ((f * 0.550000011920928955078125) * (ax - 0.07999999821186065673828125))) - ((0.1500000059604644775390625 * (ax - 0.07999999821186065673828125)) * (ax - 0.07999999821186065673828125));
        float bottom = ((top - (0.319999992847442626953125 * (1.0 - ax))) - 0.039999999105930328369140625) + (0.0900000035762786865234375 * abs(sin(ax * 9.4200000762939453125)));
        float wing = fast::min(top - q.y, q.y - bottom);
        cover = fast::max(cover, fast::clamp((wing / px) + 0.5, 0.0, 1.0));
    }
    return cover;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _203)
{
    float2 uv = fragCoord / float2(_203.iResolution[0], _203.iResolution[1]);
    float2 p = (fragCoord - (float2(_203.iResolution[0], _203.iResolution[1]) * 0.5)) / float2(_203.iResolution[1u]);
    float aspect = _203.iResolution[0u] / _203.iResolution[1u];
    float t = _203.iTime * _203.uSpeed;
    float3 col = mix(_203.uHorizon, _203.uBackground, float3(smoothstep(0.0, 0.800000011920928955078125, uv.y)));
    float2 moonAt = float2(0.2800000011920928955078125 * aspect, 0.2199999988079071044921875);
    float md = length(p - moonAt);
    col = mix(col, float3(_203.uMoon), float3((1.0 - smoothstep(_203.uMoonSize - 0.00200000009499490261077880859375, _203.uMoonSize, md)) * step(0.001000000047497451305389404296875, _203.uMoonSize)));
    col += (((float3(_203.uMoon) * 0.25) * exp((-fast::max(md - _203.uMoonSize, 0.0)) / 0.07999999821186065673828125)) * step(0.001000000047497451305389404296875, _203.uMoonSize));
    float hover = fast::clamp(_203.iPointer.z, 0.0, 1.0);
    float2 pointer = (_203.iPointer.xy - (float2(_203.iResolution[0], _203.iResolution[1]) * 0.5)) / float2(_203.iResolution[1u]);
    float2 middle = float2((0.4199999868869781494140625 * aspect) * sin(t * 0.20999999344348907470703125), (0.14000000059604644775390625 * sin(t * 0.4199999868869781494140625)) + 0.07999999821186065673828125);
    float cover = 0.0;
    int n = int(_203.uCount + 0.5);
    for (int i = 0; i < 40; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2(fi * 1.7000000476837158203125, 9.1000003814697265625);
        float2 h = hash22(param);
        float a = ((t * (0.60000002384185791015625 + (0.800000011920928955078125 * h.x))) * ((h.y < 0.5) ? 1.0 : (-1.0))) + (h.y * 6.28318023681640625);
        float r = 0.0599999986588954925537109375 + (0.300000011920928955078125 * fract(h.x * 7.0));
        float2 pos = (middle + (float2(cos(a), 0.550000011920928955078125 * sin(a)) * r)) + (float2(sin((t * 1.7000000476837158203125) + fi), sin((t * 2.2999999523162841796875) + (fi * 2.0))) * 0.02999999932944774627685546875);
        float2 away = pos - pointer;
        pos += ((((fast::normalize(away + float2(9.9999997473787516355514526367188e-05)) * hover) * _203.uScatter) * 0.180000007152557373046875) * exp((-length(away)) / 0.1500000059604644775390625));
        float s = (0.02199999988079071044921875 + (0.017999999225139617919921875 * fract(h.y * 13.0))) * _203.uSize;
        if (length(p - pos) > (1.2000000476837158203125 * s))
        {
            continue;
        }
        float flap = sin((t * (11.0 + (5.0 * h.x))) + (fi * 3.0));
        float2 param_1 = (p - pos) / float2(s);
        float param_2 = flap;
        float param_3 = 1.0 / (_203.iResolution[1u] * s);
        cover = fast::max(cover, bat(param_1, param_2, param_3));
    }
    col = mix(col, _203.uBat, float3(cover));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _560;
    if (a > 0.0)
    {
        _560 = bg + (d / float3(a));
    }
    else
    {
        _560 = bg;
    }
    float3 fg = _560;
    float alpha = a + (opacity * (1.0 - a));
    float3 _582;
    if (alpha > 0.0)
    {
        _582 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _582 = bg;
    }
    float3 col = _582;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _203)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _203);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _203.uBackground;
    float param_4 = _203.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_bat_swarm_frag_out flair_bat_swarm_frag(constant FlairUniforms& _203 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_bat_swarm_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _640;
    if (_203.flair_flipY > 0.5)
    {
        _640 = _203.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _640 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _640);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _203);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

