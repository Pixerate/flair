// flair-metal-hash: b7cc6f92
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float3 uInk;
    float3 uEchoA;
    packed_float3 uEchoB;
    int uEchoes;
    float uSpread;
    float uAngle;
    float uGrow;
    float uOutline;
    float uSize;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_echo_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float letters(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _65)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float frame = _65.iResolution[0u] / _65.iResolution[1u];
    float h = fast::min(_65.uSize, (frame * _65.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _98 = uv.x < 0.0;
    bool _105;
    if (!_98)
    {
        _105 = uv.x > 1.0;
    }
    else
    {
        _105 = _98;
    }
    bool _112;
    if (!_105)
    {
        _112 = uv.y < 0.0;
    }
    else
    {
        _112 = _105;
    }
    bool _119;
    if (!_112)
    {
        _119 = uv.y > 1.0;
    }
    else
    {
        _119 = _112;
    }
    if (_119)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, uv).w;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _65)
{
    float2 p = (fragCoord - (float2(_65.iResolution[0], _65.iResolution[1]) * 0.5)) / float2(_65.iResolution[1u]);
    float a = radians(_65.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float phase = ((_65.iTime * _65.uSpeed) * 6.28318023681640625) / 4.0;
    float3 col = _65.uBackground;
    float _206;
    float3 _254;
    for (int k = 0; k < 12; k++)
    {
        int i = _65.uEchoes - k;
        if (i < 1)
        {
            break;
        }
        float fi = float(i);
        float open = 0.5 - (0.5 * cos(phase - (fi * 0.300000011920928955078125)));
        if (_65.uSpeed > 0.0)
        {
            _206 = (open * open) * (3.0 - (2.0 * open));
        }
        else
        {
            _206 = 1.0;
        }
        open = _206;
        float2 q = (p - (((dir * _65.uSpread) * fi) * open)) / float2(1.0 + ((_65.uGrow * fi) * open));
        float2 param = q;
        float fill = letters(param, uText, uTextSmplr, _65);
        if ((i - (2 * (i / 2))) == 1)
        {
            _254 = _65.uEchoA;
        }
        else
        {
            _254 = float3(_65.uEchoB);
        }
        float3 echo = _254;
        if (_65.uOutline > 0.0)
        {
            float ring = fill;
            for (int s = 0; s < 6; s++)
            {
                float b = float(s) * 1.0471999645233154296875;
                float2 param_1 = q + (float2(cos(b), sin(b)) * _65.uOutline);
                ring = fast::max(ring, letters(param_1, uText, uTextSmplr, _65));
            }
            col = mix(col, echo, float3(ring));
            col = mix(col, _65.uBackground, float3(fill));
        }
        else
        {
            col = mix(col, echo, float3(fill));
        }
    }
    float2 param_2 = p;
    col = mix(col, _65.uInk, float3(letters(param_2, uText, uTextSmplr, _65)));
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
    float3 _381;
    if (a > 0.0)
    {
        _381 = bg + (d / float3(a));
    }
    else
    {
        _381 = bg;
    }
    float3 fg = _381;
    float alpha = a + (opacity * (1.0 - a));
    float3 _403;
    if (alpha > 0.0)
    {
        _403 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _403 = bg;
    }
    float3 col = _403;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _65)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, uText, uTextSmplr, _65);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _65.uBackground;
    float param_4 = _65.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_echo_text_frag_out flair_echo_text_frag(constant FlairUniforms& _65 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_echo_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _460;
    if (_65.flair_flipY > 0.5)
    {
        _460 = _65.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _460 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _460);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _65);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

