// flair-metal-hash: 7e5ff1a7
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
    float3 uWax;
    packed_float3 uFlame;
    float uCount;
    float uRadius;
    float uTilt;
    float uCycle;
    uint uAnimate;
    float uProgress;
    float uBackgroundAlpha;
};

struct flair_candle_ring_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _135)
{
    float2 p = (fragCoord - (float2(_135.iResolution[0], _135.iResolution[1]) * 0.5)) / float2(_135.iResolution[1u]);
    float px = 1.0 / _135.iResolution[1u];
    float u = fract(_135.iTime / _135.uCycle);
    int n = int(_135.uCount + 0.5);
    float fn = float(n);
    float3 col = _135.uBackground;
    float3 light = float3(0.0);
    float total = 0.0;
    float nearest = 2.0;
    float _270;
    float _444;
    for (int j = 0; j < 13; j++)
    {
        if (j >= n)
        {
            break;
        }
        float fj = float(j);
        float theta = ((6.28318023681640625 * fj) / fn) + 0.300000011920928955078125;
        float depth = sin(theta);
        float scale = 1.0 - (0.2800000011920928955078125 * depth);
        float2 base = float2((_135.uRadius * 1.25) * cos(theta), ((_135.uRadius * _135.uTilt) * depth) - 0.100000001490116119384765625);
        float level0 = 1.0;
        if (_135.uAnimate != 0u)
        {
            float relight = 0.7799999713897705078125 + ((0.1599999964237213134765625 * fj) / fn);
            level0 = (1.0 - smoothstep(0.5, 0.560000002384185791015625, u)) + smoothstep(relight, relight + 0.0199999995529651641845703125, u);
            level0 = fast::clamp(level0, 0.0, 1.0);
        }
        else
        {
            level0 = _135.uProgress;
        }
        if (_135.uAnimate != 0u)
        {
            _270 = smoothstep(0.439999997615814208984375, 0.519999980926513671875, u) * (1.0 - smoothstep(0.560000002384185791015625, 0.60000002384185791015625, u));
        }
        else
        {
            _270 = 0.0;
        }
        float gutter = _270;
        float2 param = float2(fj, 2.0);
        float h = (0.1500000059604644775390625 * scale) * (0.85000002384185791015625 + (0.300000011920928955078125 * hash12(param)));
        float w = 0.02199999988079071044921875 * scale;
        float2 c = p - base;
        float side = abs(c.x) - w;
        float body = fast::max(side, fast::max(-c.y, c.y - h));
        float cover = fast::clamp(0.5 - (body / px), 0.0, 1.0);
        float roundness = sqrt(fast::max(1.0 - ((c.x / w) * (c.x / w)), 0.0));
        float3 wax = (_135.uWax * (0.180000007152557373046875 + (0.5 * roundness))) * (0.3499999940395355224609375 + ((0.64999997615814208984375 * level0) * smoothstep(-0.0500000007450580596923828125, h, c.y)));
        bool front = depth < nearest;
        if (front)
        {
            col = mix(col, wax, float3(cover));
        }
        float2 param_1 = float2(_135.iTime * 9.0, fj * 7.0);
        float flick = vnoise(param_1);
        float2 param_2 = float2(_135.iTime * 20.0, fj);
        float size = (((0.0280000008642673492431640625 * scale) * level0) * (0.800000011920928955078125 + (0.300000011920928955078125 * flick))) * (1.0 - ((0.5 * gutter) * vnoise(param_2)));
        float2 f = c - float2((((flick - 0.5) * 0.00999999977648258209228515625) * scale) + ((gutter * 0.01200000010430812835693359375) * scale), h + (0.01200000010430812835693359375 * scale));
        float fd = 100000.0;
        if (size > 9.9999997473787516355514526367188e-05)
        {
            float2 fq = f / float2(size);
            if (fq.y < 0.0)
            {
                _444 = fq.y * 1.39999997615814208984375;
            }
            else
            {
                _444 = fq.y * 0.449999988079071044921875;
            }
            fq.y = _444;
            fd = length(fq) - 0.5;
            float flame = fast::clamp(0.5 - ((fd * size) / px), 0.0, 1.0);
            if (front)
            {
                col = mix(col, mix(float3(_135.uFlame), float3(1.0, 0.9700000286102294921875, 0.87999999523162841796875), float3(smoothstep(0.100000001490116119384765625, -0.3499999940395355224609375, fd))), float3(flame));
            }
            if (flame > 0.5)
            {
                cover = 1.0;
            }
        }
        if (front && (cover > 0.5))
        {
            nearest = depth;
        }
        light += ((((float3(_135.uFlame) * level0) * 0.01200000010430812835693359375) * scale) / float3(length(f) + 0.02999999932944774627685546875));
        total += level0;
        if (_135.uAnimate != 0u)
        {
            float smoking = (smoothstep(0.540000021457672119140625, 0.60000002384185791015625, u) * (1.0 - smoothstep(0.699999988079071044921875, 0.85000002384185791015625, u))) * (1.0 - level0);
            float rise = fast::max(c.y - h, 0.0);
            float curl = (0.01200000010430812835693359375 * sin(((rise * 40.0) - (_135.iTime * 4.0)) + fj)) * (rise * 6.0);
            float smoke = (exp((-abs(c.x - curl)) / (0.0030000000260770320892333984375 + (rise * 0.02999999932944774627685546875))) * smoothstep(0.0, 0.0199999995529651641845703125, rise)) * (1.0 - smoothstep(0.0199999995529651641845703125, 0.300000011920928955078125, rise));
            col += (((float3(0.5) * smoke) * smoking) * 0.3499999940395355224609375);
        }
    }
    float pool = exp((-length((p - float2(0.0, -0.100000001490116119384765625)) / float2(1.25, _135.uTilt + 0.1500000059604644775390625))) / (_135.uRadius * 0.89999997615814208984375));
    col += (((((float3(_135.uFlame) * pool) * 0.25) * total) / float3(fn)) + (light * 0.60000002384185791015625));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
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
    float3 _671;
    if (a > 0.0)
    {
        _671 = bg + (d / float3(a));
    }
    else
    {
        _671 = bg;
    }
    float3 fg = _671;
    float alpha = a + (opacity * (1.0 - a));
    float3 _693;
    if (alpha > 0.0)
    {
        _693 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _693 = bg;
    }
    float3 col = _693;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _135)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _135);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _135.uBackground;
    float param_4 = _135.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_candle_ring_frag_out flair_candle_ring_frag(constant FlairUniforms& _135 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_candle_ring_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _751;
    if (_135.flair_flipY > 0.5)
    {
        _751 = _135.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _751 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _751);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _135);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

