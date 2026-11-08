// flair-metal-hash: 8224194b
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
    float3 uEdge;
    packed_float3 uFill;
    float uCells;
    float uSpeed;
    float uBackgroundAlpha;
};

struct flair_hex_pulse_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 hexCoords(thread const float2& p)
{
    float2 r = float2(1.0, 1.73205077648162841796875);
    float2 h = r * 0.5;
    float2 a = mod(p, r) - h;
    float2 b = mod(p - h, r) - h;
    float2 gv = select(b, a, bool2(dot(a, a) < dot(b, b)));
    return float4(gv, p - gv);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _126)
{
    float2 p = ((fragCoord - (float2(_126.iResolution[0], _126.iResolution[1]) * 0.5)) / float2(_126.iResolution[1u])) * _126.uCells;
    float2 param = p;
    float4 h = hexCoords(param);
    float2 gv = abs(h.xy);
    float edgeDist = 0.5 - fast::max(dot(gv, float2(0.5, 0.866025388240814208984375)), gv.x);
    float ripple = 0.5 + (0.5 * sin((length(h.zw) * 0.60000002384185791015625) - ((_126.iTime * _126.uSpeed) * 3.0)));
    float2 param_1 = h.zw + float2(floor((_126.iTime * _126.uSpeed) * 2.0));
    float spark = step(0.920000016689300537109375, hash12(param_1));
    float lit = fast::clamp(powr(ripple, 6.0) + (spark * 0.60000002384185791015625), 0.0, 1.0);
    float3 col = mix(_126.uBackground, float3(_126.uFill), float3(lit * smoothstep(0.0, 0.100000001490116119384765625, edgeDist)));
    col = mix(col, _126.uEdge, float3((1.0 - smoothstep(0.0, 0.039999999105930328369140625, edgeDist)) * (0.300000011920928955078125 + (0.699999988079071044921875 * ripple))));
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
    float3 _284;
    if (a > 0.0)
    {
        _284 = bg + (d / float3(a));
    }
    else
    {
        _284 = bg;
    }
    float3 fg = _284;
    float alpha = a + (opacity * (1.0 - a));
    float3 _306;
    if (alpha > 0.0)
    {
        _306 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _306 = bg;
    }
    float3 col = _306;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _126)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _126);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _126.uBackground;
    float param_4 = _126.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_hex_pulse_frag_out flair_hex_pulse_frag(constant FlairUniforms& _126 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_hex_pulse_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _364;
    if (_126.flair_flipY > 0.5)
    {
        _364 = _126.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _364 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _364);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _126);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

