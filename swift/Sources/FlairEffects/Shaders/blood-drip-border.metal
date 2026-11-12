// flair-metal-hash: 11650a96
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
    float3 uColor;
    packed_float3 uShine;
    float uBand;
    float uDrips;
    float uLength;
    float uWidth;
    float uSpeed;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_blood_drip_border_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _204)
{
    float px = 1.0 / _204.iResolution[1u];
    float y = (_204.iResolution[1u] - fragCoord.y) * px;
    float x = fragCoord.x * px;
    float2 param = float2(x * 18.0, 2.0);
    float edge = (_204.uBand + (0.01200000010430812835693359375 * (vnoise(param) - 0.5))) + (0.006000000052154064178466796875 * sin(x * 50.0));
    float d = y - edge;
    float cols = 16.0;
    float shade = 0.0;
    for (int k = -1; k <= 1; k++)
    {
        float ci = floor(x * cols) + float(k);
        float2 param_1 = float2(ci, 4.69999980926513671875);
        float2 h = hash22(param_1);
        if (h.x > _204.uDrips)
        {
            continue;
        }
        float cx = ((ci + 0.300000011920928955078125) + (0.4000000059604644775390625 * h.y)) / cols;
        float period = (5.0 + (5.0 * h.x)) / _204.uSpeed;
        float u = fract((_204.iTime / period) + (h.y * 3.0));
        float w = (0.006000000052154064178466796875 + (0.006000000052154064178466796875 * fract(h.x * 9.0))) * _204.uWidth;
        float drain = smoothstep(0.85000002384185791015625, 1.0, u);
        float len = (_204.uLength * (0.3499999940395355224609375 + (0.64999997615814208984375 * fract(h.y * 7.0)))) * (1.0 - powr(1.0 - fast::min(u / 0.75, 1.0), 2.5));
        float tip = edge + len;
        float ax = abs(x - cx);
        float taper = 1.0 - (0.3499999940395355224609375 * fast::clamp((y - edge) / fast::max(len, 0.001000000047497451305389404296875), 0.0, 1.0));
        float stem = fast::max(ax - (w * taper), fast::max(y - tip, ((edge - 0.00999999977648258209228515625) + (drain * (len + 0.0199999995529651641845703125))) - y));
        float bead = length(float2(x - cx, y - tip)) - ((1.5 * w) * (1.0 - smoothstep(0.800000011920928955078125, 1.0, drain)));
        float drip = fast::min(stem, bead);
        float fall = fast::max(u - 0.60000002384185791015625, 0.0) / 0.4000000059604644775390625;
        float drop = length(float2(x - cx, (((y - tip) - 0.0199999995529651641845703125) - ((1.7999999523162841796875 * fall) * fall)) * 0.699999988079071044921875)) - (1.10000002384185791015625 * w);
        drip = fast::min(drip, mix(1.0, drop, step(0.60000002384185791015625, u)));
        if (drip < d)
        {
            d = drip;
            shade = fast::clamp((x - cx) / (1.5 * w), -1.0, 1.0);
        }
    }
    float inside = fast::clamp(0.5 - (d / px), 0.0, 1.0);
    float depth = fast::clamp((-d) / 0.01200000010430812835693359375, 0.0, 1.0);
    float3 col = _204.uColor * (0.550000011920928955078125 + (0.449999988079071044921875 * depth));
    float spec = (smoothstep(-0.75, -0.449999988079071044921875, shade) * (1.0 - smoothstep(-0.449999988079071044921875, -0.100000001490116119384765625, shade))) * step(edge + 0.0040000001899898052215576171875, y);
    spec = fast::max(spec, (1.0 - smoothstep(0.0, 0.006000000052154064178466796875, abs((y - edge) + 0.008000000379979610443115234375))) * step(y, edge));
    col = mix(col, float3(_204.uShine), float3(spec * 0.60000002384185791015625));
    float4 acc = float4(float3(_204.uBackground) * _204.uBackgroundAlpha, _204.uBackgroundAlpha);
    float4 param_2 = acc;
    float3 param_3 = col;
    float param_4 = inside;
    acc = over(param_2, param_3, param_4);
    float4 param_5 = acc;
    fragColor = unpremultiply(param_5);
}

fragment flair_blood_drip_border_frag_out flair_blood_drip_border_frag(constant FlairUniforms& _204 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_blood_drip_border_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _567;
    if (_204.flair_flipY > 0.5)
    {
        _567 = _204.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _567 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _567);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _204);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

