// flair-metal-hash: 41aab6e1
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
    float3 uHot;
    float3 uMid;
    packed_float3 uCool;
    float uSpeed;
    float uHeight;
    char _m18_pad[12];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_flames_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _192)
{
    float2 uv = fragCoord / float2(_192.iResolution[0], _192.iResolution[1]);
    float2 p = float2(fragCoord.x / _192.iResolution[1u], uv.y);
    float t = _192.iTime * _192.uSpeed;
    float2 param = float2(p.x * 4.0, (p.y * 3.0) - (t * 1.5));
    int param_1 = 5;
    float _231 = fbm(param, param_1);
    float n = _231;
    float heat = (1.0 - (uv.y / _192.uHeight)) + ((n - 0.5) * 1.10000002384185791015625);
    heat = fast::clamp(heat, 0.0, 1.0);
    float3 col = mix(float3(_192.uBackground), float3(_192.uCool), float3(smoothstep(0.0500000007450580596923828125, 0.300000011920928955078125, heat)));
    col = mix(col, _192.uMid, float3(smoothstep(0.300000011920928955078125, 0.60000002384185791015625, heat)));
    col = mix(col, _192.uHot, float3(smoothstep(0.60000002384185791015625, 0.949999988079071044921875, heat)));
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
    float3 _326;
    if (a > 0.0)
    {
        _326 = bg + (d / float3(a));
    }
    else
    {
        _326 = bg;
    }
    float3 fg = _326;
    float alpha = a + (opacity * (1.0 - a));
    float3 _348;
    if (alpha > 0.0)
    {
        _348 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _348 = bg;
    }
    float3 col = _348;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _192)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _192);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_192.uBackground);
    float param_4 = _192.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_flames_frag_out flair_flames_frag(constant FlairUniforms& _192 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_flames_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _405;
    if (_192.flair_flipY > 0.5)
    {
        _405 = _192.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _405 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _405);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _192);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

