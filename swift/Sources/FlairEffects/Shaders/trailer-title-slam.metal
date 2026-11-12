// flair-metal-hash: 3df2a745
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
    float3 uMetal;
    packed_float3 uFlare;
    float uSize;
    float uDust;
    float uShake;
    uint uAnimate;
    float uMoment;
    float uBackgroundAlpha;
};

struct flair_trailer_title_slam_frag_out
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
float letters(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _243)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _243.iResolution[0u] / _243.iResolution[1u];
    float h = fast::min(_243.uSize, (frame * _243.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _273 = uv.x < 0.0;
    bool _280;
    if (!_273)
    {
        _280 = uv.x > 1.0;
    }
    else
    {
        _280 = _273;
    }
    bool _287;
    if (!_280)
    {
        _287 = uv.y < 0.0;
    }
    else
    {
        _287 = _280;
    }
    bool _294;
    if (!_287)
    {
        _294 = uv.y > 1.0;
    }
    else
    {
        _294 = _287;
    }
    if (_294)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _243)
{
    float _311;
    if (_243.uAnimate != 0u)
    {
        _311 = mod(_243.iTime, 4.0);
    }
    else
    {
        _311 = _243.uMoment;
    }
    float c = _311;
    float aspect = _243.iResolution[0u] / _243.iResolution[1u];
    float age = c - 0.3499999940395355224609375;
    float hit = step(0.0, age);
    float2 p = (fragCoord - (float2(_243.iResolution[0], _243.iResolution[1]) * 0.5)) / float2(_243.iResolution[1u]);
    p += (float2(sin(age * 90.0), cos(age * 77.0)) * (((hit * _243.uShake) * 0.0199999995529651641845703125) * exp((-age) * 7.0)));
    float fall = fast::clamp(c / 0.3499999940395355224609375, 0.0, 1.0);
    float2 q = p / float2(mix(2.0, 1.0, fall * fall));
    float shown = smoothstep(0.0, 0.25, c);
    float fade = 1.0 - smoothstep(3.2000000476837158203125, 3.849999904632568359375, c);
    float2 param = (p * 2.5) + float2(_243.iTime * 0.0500000007450580596923828125, 0.0);
    int param_1 = 4;
    float _411 = fbm(param, param_1);
    float3 col = _243.uBackground + float3(_411 * 0.0350000001490116119384765625);
    col *= (1.0 - (0.5 * smoothstep(0.4000000059604644775390625, 1.2000000476837158203125, length(p * float2(0.699999988079071044921875, 1.0)))));
    float2 param_2 = q;
    float a = letters(param_2, uText, uTextSmplr, _243) * shown;
    float e = 0.0030000000260770320892333984375;
    float2 param_3 = q + float2(-e, e);
    float2 param_4 = q - float2(-e, e);
    float bevel = fast::clamp(letters(param_3, uText, uTextSmplr, _243) - letters(param_4, uText, uTextSmplr, _243), 0.0, 1.0);
    float sweep = fast::clamp((c - 0.60000002384185791015625) / 1.0, 0.0, 1.0);
    float gx = (mix(-0.89999997615814208984375, 0.89999997615814208984375, sweep) * aspect) * 0.5;
    float glint = (exp(-powr(((q.x + (q.y * 0.5)) - gx) * 10.0, 2.0)) * step(0.60000002384185791015625, c)) * step(c, 1.60000002384185791015625);
    float2 param_5 = float2(floor(q.x * 900.0), 0.0);
    float3 metal = (_243.uMetal * (0.3499999940395355224609375 + (0.75 * smoothstep(-0.07999999821186065673828125, 0.07999999821186065673828125, q.y)))) * (0.939999997615814208984375 + (0.0599999986588954925537109375 * hash12(param_5)));
    metal += float3((bevel * 0.699999988079071044921875) + (glint * 0.89999997615814208984375));
    float2 param_6 = q + float2(0.0, 0.00999999977648258209228515625);
    float2 param_7 = q - float2(0.0, 0.00999999977648258209228515625);
    float2 param_8 = q + float2(0.014999999664723873138427734375, 0.0);
    float2 param_9 = q - float2(0.014999999664723873138427734375, 0.0);
    float halo = (((letters(param_6, uText, uTextSmplr, _243) + letters(param_7, uText, uTextSmplr, _243)) + letters(param_8, uText, uTextSmplr, _243)) + letters(param_9, uText, uTextSmplr, _243)) * 0.25;
    col += (((float3(_243.uFlare) * halo) * 0.07999999821186065673828125) * shown);
    col = mix(col, metal, float3(a));
    float flareOn = (sin(3.141590118408203125 * sweep) * step(0.60000002384185791015625, c)) * step(c, 1.60000002384185791015625);
    float streak = exp((-abs(p.y)) * 70.0) * exp((-abs(p.x - gx)) * 2.0);
    col += (((float3(_243.uFlare) * streak) + (float3(1.0) * exp((-dot(p - float2(gx, 0.0), p - float2(gx, 0.0))) * 300.0))) * flareOn);
    if (hit > 0.0)
    {
        col += ((float3(0.89999997615814208984375, 0.949999988079071044921875, 1.0) * exp((-age) * 12.0)) * 0.4000000059604644775390625);
        float grit = 0.0;
        for (int i = 0; i < 36; i++)
        {
            float2 param_10 = float2(float(i), 3.099999904632568359375);
            float2 h = hash22(param_10);
            float2 at = float2((((h.x - 0.5) * _243.uSize) * aspect) * 0.800000011920928955078125, -0.039999999105930328369140625);
            float2 vel = float2((h.x - 0.5) * 0.699999988079071044921875, 0.1500000059604644775390625 + (h.y * 0.3499999940395355224609375));
            float2 pos = (at + (vel * age)) + float2(0.0, ((-0.300000011920928955078125) * age) * age);
            grit += (smoothstep(0.0040000001899898052215576171875, 0.0, length(p - pos)) * exp((-age) * 1.5));
        }
        float2 param_11 = (p * 5.0) + float2(0.0, (-age) * 0.4000000059604644775390625);
        int param_12 = 4;
        float _710 = fbm(param_11, param_12);
        float puff = ((_710 * exp((-age) * 1.2000000476837158203125)) * exp((-abs(p.y + 0.0599999986588954925537109375)) * 7.0)) * (1.0 - smoothstep(0.0, ((_243.uSize * aspect) * 0.5) + (age * 0.300000011920928955078125), abs(p.x)));
        col += (((float3(0.85000002384185791015625, 0.800000011920928955078125, 0.7200000286102294921875) * grit) + ((float3(0.5, 0.4799999892711639404296875, 0.449999988079071044921875) * puff) * 0.5)) * _243.uDust);
    }
    fragColor = float4(mix(_243.uBackground, col, float3(fade)), 1.0);
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
    float3 _811;
    if (a > 0.0)
    {
        _811 = bg + (d / float3(a));
    }
    else
    {
        _811 = bg;
    }
    float3 fg = _811;
    float alpha = a + (opacity * (1.0 - a));
    float3 _833;
    if (alpha > 0.0)
    {
        _833 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _833 = bg;
    }
    float3 col = _833;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _243)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, uText, uTextSmplr, _243);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _243.uBackground;
    float param_4 = _243.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_trailer_title_slam_frag_out flair_trailer_title_slam_frag(constant FlairUniforms& _243 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_trailer_title_slam_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _890;
    if (_243.flair_flipY > 0.5)
    {
        _890 = _243.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _890 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _890);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _243);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

