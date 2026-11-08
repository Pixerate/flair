// flair-metal-hash: 54c5ae63
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float3 uBackground;
    float3 uComa;
    float3 uDust;
    packed_float3 uIon;
    float uX;
    float uY;
    float uAngle;
    float uSize;
    float uDustLength;
    float uIonLength;
    float uCurve;
    float uFlow;
    float uStars;
    float uBackgroundAlpha;
};

struct flair_comet_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& fragCoord, thread const float& density, constant FlairUniforms& _274)
{
    float2 cell = floor(fragCoord / float2(3.0));
    float2 param = cell;
    float h = hash12(param);
    float on = step(1.0 - (0.01200000010430812835693359375 * density), h);
    float2 param_1 = cell;
    float2 at = hash22(param_1) * 3.0;
    float d = length((fract(fragCoord / float2(3.0)) * 3.0) - at);
    float2 param_2 = cell + float2(7.0);
    return ((on * smoothstep(1.39999997615814208984375, 0.0, d)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_2)))) * (0.75 + (0.25 * sin((_274.iTime * (1.0 + (3.0 * h))) + (h * 40.0))));
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _274)
{
    float px = 1.0 / _274.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _274.iResolution[0u] * px;
    float2 param = fragCoord;
    float param_1 = 1.0;
    float3 col = _274.uBackground + float3(stars(param, param_1, _274) * _274.uStars);
    float ang = radians(_274.uAngle);
    float2 axis = float2(cos(ang), sin(ang));
    float2 q = (p - float2(_274.uX * aspect, _274.uY)) / float2(_274.uSize);
    float x = dot(q, axis);
    float y = dot(q, float2(-axis.y, axis.x));
    float r = length(q);
    float ahead = smoothstep(-0.02999999932944774627685546875, 0.039999999105930328369140625, x);
    if (_274.uIonLength > 0.0)
    {
        float wi = 0.01200000010430812835693359375 + (x * 0.0500000007450580596923828125);
        float2 param_2 = float2((y / fast::max(wi, 0.001000000047497451305389404296875)) * 1.5, (x * 3.0) - ((_274.iTime * _274.uFlow) * 1.2000000476837158203125));
        int param_3 = 4;
        float _403 = fbm(param_2, param_3);
        float rays = _403;
        float kink = ((0.01200000010430812835693359375 * sin((x * 7.0) - ((_274.iTime * _274.uFlow) * 2.0))) * x) * x;
        float yi = (y - kink) / fast::max(wi, 0.001000000047497451305389404296875);
        float ion = (exp((-yi) * yi) * exp((-x) / (_274.uIonLength * 0.449999988079071044921875))) * ahead;
        col += (((float3(_274.uIon) * ion) * (0.3499999940395355224609375 + ((1.10000002384185791015625 * rays) * rays))) * 0.89999997615814208984375);
    }
    if (_274.uDustLength > 0.0)
    {
        float bend = ((_274.uCurve * 0.3499999940395355224609375) * x) * x;
        float wd = 0.0199999995529651641845703125 + (x * 0.2199999988079071044921875);
        float off = (y + bend) / fast::max(wd, 0.001000000047497451305389404296875);
        float2 param_4 = float2((off * 2.5) + (x * 1.5), (x * 1.2000000476837158203125) - ((_274.iTime * _274.uFlow) * 0.1500000059604644775390625));
        int param_5 = 3;
        float _510 = fbm(param_4, param_5);
        float stria = 0.75 + (0.3499999940395355224609375 * _510);
        float dust = ((exp(((-off) * off) * 1.39999997615814208984375) * exp((-x) / (_274.uDustLength * 0.4000000059604644775390625))) * ahead) * stria;
        dust *= (0.75 + (0.5 * smoothstep(0.60000002384185791015625, -0.60000002384185791015625, off * sign(_274.uCurve + 9.9999997473787516355514526367188e-05))));
        col += ((_274.uDust * dust) * 0.75);
    }
    col += (_274.uComa * (((exp((-r) / 0.0350000001490116119384765625) * 0.89999997615814208984375) + (exp((-r) / 0.119999997317790985107421875) * 0.25)) + (exp((-r) / 0.4000000059604644775390625) * 0.0599999986588954925537109375)));
    col += ((float3(1.0) * exp((-(r * r)) / 3.6000001273350790143013000488281e-05)) * 1.5);
    col = float3(1.0) - exp((-col) * 1.2000000476837158203125);
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
    float3 _644;
    if (a > 0.0)
    {
        _644 = bg + (d / float3(a));
    }
    else
    {
        _644 = bg;
    }
    float3 fg = _644;
    float alpha = a + (opacity * (1.0 - a));
    float3 _666;
    if (alpha > 0.0)
    {
        _666 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _666 = bg;
    }
    float3 col = _666;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _274)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _274);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _274.uBackground;
    float param_4 = _274.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_comet_frag_out flair_comet_frag(constant FlairUniforms& _274 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_comet_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _724;
    if (_274.flair_flipY > 0.5)
    {
        _724 = _274.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _724 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _724);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _274);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

