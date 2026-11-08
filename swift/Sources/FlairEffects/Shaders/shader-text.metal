// flair-metal-hash: 54309706
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
    int uFill;
    float3 uBackground;
    packed_float3 uTint;
    float uSize;
    float uSpeed;
    float uGlow;
    float uOutline;
    char _m20_pad[4];
    packed_float3 uOutlineColor;
    float uBackgroundAlpha;
};

struct flair_shader_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float letters(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _252)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _252.iResolution[0u] / _252.iResolution[1u];
    float h = fast::min(_252.uSize, (frame * _252.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _282 = uv.x < 0.0;
    bool _289;
    if (!_282)
    {
        _289 = uv.x > 1.0;
    }
    else
    {
        _289 = _282;
    }
    bool _296;
    if (!_289)
    {
        _296 = uv.y < 0.0;
    }
    else
    {
        _296 = _289;
    }
    bool _303;
    if (!_296)
    {
        _303 = uv.y > 1.0;
    }
    else
    {
        _303 = _296;
    }
    if (_303)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
}

static inline __attribute__((always_inline))
float3 palette(thread const float& t, thread const float3& a, thread const float3& b, thread const float3& c, thread const float3& d)
{
    return a + (b * cos(((c * t) + d) * 6.28318023681640625));
}

static inline __attribute__((always_inline))
float3 plasmaFill(thread const float2& p, thread const float& t)
{
    float v = ((sin((p.x * 6.0) + t) + sin((p.y * 7.0) - (t * 1.2999999523162841796875))) + sin(((p.x + p.y) * 5.0) + (t * 0.699999988079071044921875))) + sin(length(p * 8.0) - (t * 2.0));
    float param = ((v * 0.125) + 0.5) + (t * 0.0500000007450580596923828125);
    float3 param_1 = float3(0.5);
    float3 param_2 = float3(0.5);
    float3 param_3 = float3(1.0);
    float3 param_4 = float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375);
    return palette(param, param_1, param_2, param_3, param_4);
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
float3 fireFill(thread const float2& p, thread const float& t)
{
    float2 param = float2(p.x * 5.0, (p.y * 3.0) - (t * 1.7999999523162841796875));
    int param_1 = 5;
    float _390 = fbm(param, param_1);
    float n = _390;
    float heat = fast::clamp((1.10000002384185791015625 - ((p.y + 0.300000011920928955078125) * 1.60000002384185791015625)) + ((n - 0.5) * 1.2000000476837158203125), 0.0, 1.0);
    return (((float3(1.0, 0.3499999940395355224609375, 0.0500000007450580596923828125) * heat) * 1.39999997615814208984375) + (float3(1.0, 0.85000002384185791015625, 0.300000011920928955078125) * powr(heat, 3.0))) + float3(0.25, 0.0, 0.0);
}

static inline __attribute__((always_inline))
float3 causticsFill(thread const float2& p, thread const float& t)
{
    float2 q = p * 6.0;
    float2 i = q;
    float c = 1.0;
    for (int n = 0; n < 5; n++)
    {
        float tn = (t * 0.5) * (1.0 - (3.5 / float(n + 1)));
        i = q + float2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
        c += (1.0 / length(float2(q.x / (sin(i.x + tn) / 0.004999999888241291046142578125), q.y / (cos(i.y + tn) / 0.004999999888241291046142578125))));
    }
    c = 1.16999995708465576171875 - powr(c / 5.0, 1.39999997615814208984375);
    float light = powr(abs(c), 8.0);
    return fast::clamp(float3(0.0, 0.300000011920928955078125, 0.5) + (float3(0.699999988079071044921875, 1.0, 1.0) * light), float3(0.0), float3(1.0));
}

static inline __attribute__((always_inline))
float3 chromeFill(thread const float2& p, thread const float& t, thread const float2& normal)
{
    float2 param = (p * 3.0) + float2(t * 0.300000011920928955078125, (-t) * 0.20000000298023223876953125);
    int param_1 = 4;
    float _531 = fbm(param, param_1);
    float warp = _531 - 0.5;
    float y = (((p.y * 2.5) + (normal.y * 1.5)) + (warp * 1.2000000476837158203125)) + (0.1500000059604644775390625 * sin((p.x * 4.0) + t));
    float3 sky = mix(float3(0.85000002384185791015625, 0.89999997615814208984375, 1.0), float3(0.300000011920928955078125, 0.4000000059604644775390625, 0.60000002384185791015625), float3(fast::clamp(y, 0.0, 1.0)));
    float3 ground = mix(float3(0.25, 0.20000000298023223876953125, 0.20000000298023223876953125), float3(0.0500000007450580596923828125), float3(fast::clamp(-y, 0.0, 1.0)));
    float3 col = select(ground, sky, bool3(y > 0.0));
    col += float3(smoothstep(0.0599999986588954925537109375, 0.0, abs(y)) * 0.89999997615814208984375);
    return col + float3(powr(fast::max(0.0, (normal.x * 0.699999988079071044921875) + (normal.y * 0.699999988079071044921875)), 6.0) * 0.800000011920928955078125);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _252)
{
    float2 p = (fragCoord - (float2(_252.iResolution[0], _252.iResolution[1]) * 0.5)) / float2(_252.iResolution[1u]);
    float t = _252.iTime * _252.uSpeed;
    float2 param = p;
    float mask = letters(param, uText, uTextSmplr, _252);
    float e = 0.0040000001899898052215576171875;
    float2 param_1 = p + float2(e, 0.0);
    float2 param_2 = p - float2(e, 0.0);
    float2 param_3 = p + float2(0.0, e);
    float2 param_4 = p - float2(0.0, e);
    float2 normal = float2(letters(param_1, uText, uTextSmplr, _252) - letters(param_2, uText, uTextSmplr, _252), letters(param_3, uText, uTextSmplr, _252) - letters(param_4, uText, uTextSmplr, _252));
    float glow = 0.0;
    float ring = 0.0;
    for (int i = 0; i < 12; i++)
    {
        float a = float(i) * 0.52359998226165771484375;
        float2 dir = float2(cos(a), sin(a));
        float2 param_5 = p + (dir * 0.0199999995529651641845703125);
        float2 param_6 = p + (dir * 0.0500000007450580596923828125);
        glow += (letters(param_5, uText, uTextSmplr, _252) + (letters(param_6, uText, uTextSmplr, _252) * 0.60000002384185791015625));
        float2 param_7 = p + (dir * _252.uOutline);
        ring = fast::max(ring, letters(param_7, uText, uTextSmplr, _252));
    }
    glow /= 19.200000762939453125;
    float3 _718;
    if (_252.uFill == 0)
    {
        float2 param_8 = p;
        float param_9 = t;
        _718 = plasmaFill(param_8, param_9);
    }
    else
    {
        float3 _730;
        if (_252.uFill == 1)
        {
            float2 param_10 = p;
            float param_11 = t;
            _730 = fireFill(param_10, param_11);
        }
        else
        {
            float3 _743;
            if (_252.uFill == 2)
            {
                float2 param_12 = p;
                float param_13 = t;
                _743 = causticsFill(param_12, param_13);
            }
            else
            {
                float2 param_14 = p;
                float param_15 = t;
                float2 param_16 = normal * 2.0;
                _743 = chromeFill(param_14, param_15, param_16);
            }
            _730 = _743;
        }
        _718 = _730;
    }
    float3 fill = _718;
    fill *= float3(_252.uTint);
    float3 col = _252.uBackground + ((fill * glow) * _252.uGlow);
    col = mix(col, float3(_252.uOutlineColor), float3(fast::clamp(ring - mask, 0.0, 1.0) * step(9.9999997473787516355514526367188e-05, _252.uOutline)));
    col = mix(col, fill, float3(mask));
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
    float3 _848;
    if (a > 0.0)
    {
        _848 = bg + (d / float3(a));
    }
    else
    {
        _848 = bg;
    }
    float3 fg = _848;
    float alpha = a + (opacity * (1.0 - a));
    float3 _870;
    if (alpha > 0.0)
    {
        _870 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _870 = bg;
    }
    float3 col = _870;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _252)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, uText, uTextSmplr, _252);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _252.uBackground;
    float param_4 = _252.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_shader_text_frag_out flair_shader_text_frag(constant FlairUniforms& _252 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_shader_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _926;
    if (_252.flair_flipY > 0.5)
    {
        _926 = _252.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _926 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _926);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _252);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

