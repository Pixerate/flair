// flair-metal-hash: 6fb9a13e
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
    float3 uCore;
    float3 uArmColor;
    packed_float3 uNebula;
    int uArms;
    float uWinding;
    float uTilt;
    float uAngle;
    float uSize;
    float uSpeed;
    float uDust;
    float uBackgroundAlpha;
};

struct flair_spiral_galaxy_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _274)
{
    float px = 1.0 / _274.iResolution[1u];
    float2 p = (fragCoord - (float2(_274.iResolution[0], _274.iResolution[1]) * 0.5)) * px;
    float ca = cos(_274.uAngle);
    float sa = sin(_274.uAngle);
    float2 q = (float2x2(float2(ca, sa), float2(-sa, ca)) * p) / float2(0.4199999868869781494140625 * _274.uSize);
    q.y /= fast::max(cos(_274.uTilt), 0.07999999821186065673828125);
    float r = length(q);
    float spin = (_274.iTime * _274.uSpeed) * 0.0599999986588954925537109375;
    float2 d = float2x2(float2(cos(spin), sin(spin)), float2(-sin(spin), cos(spin))) * q;
    float theta = precise::atan2(d.y, d.x);
    float arms = float(_274.uArms);
    float wind = theta - (_274.uWinding * log(fast::max(r, 0.001000000047497451305389404296875)));
    float arm = 0.5 + (0.5 * cos(arms * wind));
    float armSharp = powr(arm, 3.0);
    float disc = exp((-r) * 2.599999904632568359375) * smoothstep(1.39999997615814208984375, 0.60000002384185791015625, r);
    float2 param = d * 4.0;
    int param_1 = 5;
    float _419 = fbm(param, param_1);
    float clump = _419;
    float light = disc * (0.25 + ((1.39999997615814208984375 * armSharp) * (0.5 + clump)));
    float2 param_2 = fragCoord;
    float param_3 = 1.0;
    float3 col = _274.uBackground + float3(stars(param_2, param_3, _274) * (1.0 - smoothstep(0.0, 0.60000002384185791015625, disc * 4.0)));
    col += ((_274.uArmColor * light) * 1.2000000476837158203125);
    float2 param_4 = (d * 9.0) + float2(3.0);
    int param_5 = 4;
    float _463 = fbm(param_4, param_5);
    float knots = (smoothstep(0.62000000476837158203125, 0.800000011920928955078125, _463) * armSharp) * disc;
    col += ((float3(_274.uNebula) * knots) * 2.2000000476837158203125);
    for (int i = 0; i < 2; i++)
    {
        float scale = (i == 0) ? 90.0 : 180.0;
        float2 g = (d * scale) * _274.uSize;
        float2 cell = floor(g);
        float2 param_6 = cell + float2(float(i) * 31.0);
        float h = hash12(param_6);
        float chance = (disc * (0.4000000059604644775390625 + (2.5 * armSharp))) * ((i == 0) ? 1.60000002384185791015625 : 3.0);
        float s = step(1.0 - fast::min(chance, 0.89999997615814208984375), h);
        float2 param_7 = cell;
        float2 at = (hash22(param_7) * 0.60000002384185791015625) + float2(0.20000000298023223876953125);
        float dist = length(fract(g) - at) / ((((scale * _274.uSize) * px) * 0.4199999868869781494140625) * _274.uSize);
        float2 param_8 = cell + float2(9.0);
        col += (((mix(_274.uArmColor, float3(1.0), float3(0.60000002384185791015625)) * s) * smoothstep(1.60000002384185791015625, 0.0, dist)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_8))));
    }
    float lane = powr(0.5 + (0.5 * cos((arms * wind) - 0.89999997615814208984375)), 6.0);
    float2 param_9 = (d * 7.0) + float2(11.0);
    int param_10 = 4;
    float _607 = fbm(param_9, param_10);
    float dust = (((lane * smoothstep(0.07999999821186065673828125, 0.300000011920928955078125, r)) * smoothstep(1.2000000476837158203125, 0.5, r)) * (0.3499999940395355224609375 + (0.64999997615814208984375 * _607))) * _274.uDust;
    col *= (1.0 - (0.85000002384185791015625 * fast::clamp(dust * 1.60000002384185791015625, 0.0, 1.0)));
    float bulge = (exp(((-r) * r) * 30.0) * 1.60000002384185791015625) + (exp((-r) * 6.0) * 0.3499999940395355224609375);
    col += (_274.uCore * bulge);
    fragColor = float4(col / (float3(1.0) + (col * 0.25)), 1.0);
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
    float3 _699;
    if (a > 0.0)
    {
        _699 = bg + (d / float3(a));
    }
    else
    {
        _699 = bg;
    }
    float3 fg = _699;
    float alpha = a + (opacity * (1.0 - a));
    float3 _721;
    if (alpha > 0.0)
    {
        _721 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _721 = bg;
    }
    float3 col = _721;
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

fragment flair_spiral_galaxy_frag_out flair_spiral_galaxy_frag(constant FlairUniforms& _274 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_spiral_galaxy_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _778;
    if (_274.flair_flipY > 0.5)
    {
        _778 = _274.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _778 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _778);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _274);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

