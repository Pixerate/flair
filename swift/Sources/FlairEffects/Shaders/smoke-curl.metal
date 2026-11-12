// flair-metal-hash: f570f79e
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
    float2 uSource;
    char _m14_pad[8];
    packed_float3 uColor;
    float uHeight;
    float uBreakup;
    float uTurbulence;
    float uSpeed;
    float uThickness;
    float uOpacity;
};

struct flair_smoke_curl_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _182)
{
    float2 p = (fragCoord - (float2(_182.iResolution[0], _182.iResolution[1]) * 0.5)) / float2(_182.iResolution[1u]);
    float px = 1.0 / _182.iResolution[1u];
    float aspect = _182.iResolution[0u] / _182.iResolution[1u];
    float2 src = (_182.uSource * float2(aspect, 1.0)) * 0.5;
    float2 q = p - src;
    float h = q.y / _182.uHeight;
    if ((h < (-0.0199999995529651641845703125)) || (h > 1.14999997615814208984375))
    {
        fragColor = float4(_182.uColor[0], _182.uColor[1], _182.uColor[2], 0.0);
        return;
    }
    float hc = fast::clamp(h, 0.0, 1.0);
    float t = _182.iTime * _182.uSpeed;
    float turb = smoothstep(_182.uBreakup - 0.0500000007450580596923828125, _182.uBreakup + 0.449999988079071044921875, hc) * _182.uTurbulence;
    float2 fq = float2(q.x * 4.0, (q.y * 3.0) - (t * 0.60000002384185791015625));
    float2 param = fq;
    int param_1 = 4;
    float _284 = fbm(param, param_1);
    float2 param_2 = fq + float2(4.69999980926513671875, 1.89999997615814208984375);
    int param_3 = 4;
    float _292 = fbm(param_2, param_3);
    float2 warp = float2(_284, _292) - float2(0.5);
    float2 param_4 = (fq * 2.2999999523162841796875) + (warp * 2.0);
    int param_5 = 3;
    float _306 = fbm(param_4, param_5);
    float2 param_6 = ((fq * 2.2999999523162841796875) + float2(2.099999904632568359375, 8.3999996185302734375)) - (warp * 2.0);
    int param_7 = 3;
    float _318 = fbm(param_6, param_7);
    float2 warp2 = float2(_306, _318) - float2(0.5);
    float2 w = q + ((((warp * 0.180000007152557373046875) + (warp2 * 0.07999999821186065673828125)) * turb) * (0.4000000059604644775390625 + hc));
    float sway = ((0.01200000010430812835693359375 * sin((q.y * 7.0) - (t * 1.2000000476837158203125))) * hc) + ((turb * 0.0500000007450580596923828125) * sin(((q.y * 4.0) - (t * 0.89999997615814208984375)) + 1.7000000476837158203125));
    float a = 0.0;
    float _441;
    for (int i = 0; i < 3; i++)
    {
        float fi = float(i);
        float split = ((((fi - 1.0) * turb) * 0.0350000001490116119384765625) * hc) * (1.0 + sin(((w.y * 6.0) + (fi * 2.2999999523162841796875)) - (t * 0.699999988079071044921875)));
        float d = abs((w.x - sway) - split);
        float width = ((mix(0.00150000001303851604461669921875, 0.01600000075995922088623046875, hc) + ((turb * 0.008000000379979610443115234375) * hc)) * _182.uThickness) + (px * 0.75);
        float strand = exp(((-d) * d) / (width * width));
        if (fi == 1.0)
        {
            _441 = 1.0;
        }
        else
        {
            _441 = turb * 0.60000002384185791015625;
        }
        a += (strand * _441);
    }
    float2 param_8 = (w * 6.0) + float2(0.0, (-t) * 0.4000000059604644775390625);
    int param_9 = 4;
    float _463 = fbm(param_8, param_9);
    float veil = ((smoothstep(0.449999988079071044921875, 0.800000011920928955078125, _463) * turb) * 0.25) * hc;
    a = (a * mix(1.0, 0.5, hc)) + veil;
    float2 param_10 = (w * 3.0) + float2(1.2999999523162841796875, (-t) * 0.5);
    int param_11 = 3;
    float _488 = fbm(param_10, param_11);
    float gaps = mix(1.0, smoothstep(0.25, 0.60000002384185791015625, _488), hc * fast::min(turb, 1.0));
    a *= gaps;
    a *= (smoothstep(-0.0199999995529651641845703125, 0.00999999977648258209228515625, h) * (1.0 - smoothstep(0.60000002384185791015625, 1.10000002384185791015625, h)));
    fragColor = float4(_182.uColor[0], _182.uColor[1], _182.uColor[2], fast::clamp(a * _182.uOpacity, 0.0, 1.0));
}

fragment flair_smoke_curl_frag_out flair_smoke_curl_frag(constant FlairUniforms& _182 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_smoke_curl_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _532;
    if (_182.flair_flipY > 0.5)
    {
        _532 = _182.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _532 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _532);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _182);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

