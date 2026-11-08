// flair-metal-hash: 463de347
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    float2 uCharge1;
    float2 uCharge2;
    float2 uCharge3;
    int uThird;
    int uLines;
    float uSpeed;
    float3 uLine;
    float3 uPositive;
    float3 uNegative;
    packed_float3 uBackground;
    float uDrift;
    uint uFollow;
    float uBackgroundAlpha;
};

struct flair_electric_field_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _41)
{
    float px = 1.0 / _41.iResolution[1u];
    float2 p = (fragCoord - (float2(_41.iResolution[0], _41.iResolution[1]) * 0.5)) * px;
    float2 span = float2(_41.iResolution[0u] * px, 1.0) * 0.5;
    float t = _41.iTime;
    spvUnsafeArray<float2, 3> c;
    c[0] = (_41.uCharge1 * span) + ((float2(sin(t * 0.699999988079071044921875), cos(t * 0.89999997615814208984375)) * 0.0599999986588954925537109375) * _41.uDrift);
    c[1] = (_41.uCharge2 * span) + ((float2(cos((t * 0.60000002384185791015625) + 1.0), sin(t * 0.800000011920928955078125)) * 0.0599999986588954925537109375) * _41.uDrift);
    c[2] = (_41.uCharge3 * span) + ((float2(sin((t * 0.5) + 2.0), cos(t * 0.4000000059604644775390625)) * 0.0599999986588954925537109375) * _41.uDrift);
    if (_41.uFollow != 0u)
    {
        c[0] = mix(c[0], (_41.iPointer.xy - (float2(_41.iResolution[0], _41.iResolution[1]) * 0.5)) * px, float2(fast::clamp(_41.iPointer.z, 0.0, 1.0)));
    }
    spvUnsafeArray<float, 3> q;
    q[0] = 1.0;
    q[1] = -1.0;
    q[2] = float(_41.uThird);
    float psi = 0.0;
    float2 gradPsi = float2(0.0);
    float phi = 0.0;
    float nearest = 1000.0;
    for (int i = 0; i < 3; i++)
    {
        if (q[i] == 0.0)
        {
            continue;
        }
        float2 d = p - c[i];
        float r2 = fast::max(dot(d, d), 9.9999999747524270787835121154785e-07);
        psi += (q[i] * precise::atan2(d.y, d.x));
        gradPsi += ((float2(-d.y, d.x) * q[i]) / float2(r2));
        phi += ((q[i] * 0.5) * log(r2));
        nearest = fast::min(nearest, sqrt(r2));
    }
    float n = float(_41.uLines) / 6.28318023681640625;
    float v = psi * n;
    float off = abs(fract(v + 0.5) - 0.5) / fast::max((length(gradPsi) * n) * px, 9.9999997473787516355514526367188e-06);
    float line = (1.0 - smoothstep(0.4000000059604644775390625, 1.39999997615814208984375, off)) * smoothstep(0.02999999932944774627685546875, 0.0900000035762786865234375, nearest);
    float dash = fract((phi * 2.5) - (t * _41.uSpeed));
    float lit = 0.25 + ((0.89999997615814208984375 * smoothstep(0.0, 0.07999999821186065673828125, dash)) * (1.0 - smoothstep(0.3499999940395355224609375, 0.5, dash)));
    float3 tint = mix(_41.uLine, mix(_41.uPositive, _41.uNegative, float3(smoothstep(-1.0, 1.0, phi))), float3(0.300000011920928955078125));
    float3 col = float3(_41.uBackground) + ((_41.uLine * 0.0500000007450580596923828125) * fast::clamp(length(gradPsi) * 0.02999999932944774627685546875, 0.0, 1.0));
    col += ((tint * line) * lit);
    float3 _385;
    for (int i_1 = 0; i_1 < 3; i_1++)
    {
        if (q[i_1] == 0.0)
        {
            continue;
        }
        float2 d_1 = p - c[i_1];
        float r = length(d_1);
        if (q[i_1] > 0.0)
        {
            _385 = _41.uPositive;
        }
        else
        {
            _385 = _41.uNegative;
        }
        float3 cc = _385;
        col += (cc * ((exp((-r) / 0.02500000037252902984619140625) * 0.800000011920928955078125) + (exp((-r) / 0.100000001490116119384765625) * 0.25)));
        col = mix(col, cc, float3(smoothstep(0.0350000001490116119384765625, 0.0350000001490116119384765625 - px, r)));
        float2 ad = abs(d_1);
        float bar = fast::max(ad.x - 0.017999999225139617919921875, ad.y - 0.0040000001899898052215576171875);
        if (q[i_1] > 0.0)
        {
            bar = fast::min(bar, fast::max(ad.x - 0.0040000001899898052215576171875, ad.y - 0.017999999225139617919921875));
        }
        col = mix(col, float3(1.0), float3(smoothstep(px, 0.0, bar)));
    }
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
    float3 _506;
    if (a > 0.0)
    {
        _506 = bg + (d / float3(a));
    }
    else
    {
        _506 = bg;
    }
    float3 fg = _506;
    float alpha = a + (opacity * (1.0 - a));
    float3 _528;
    if (alpha > 0.0)
    {
        _528 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _528 = bg;
    }
    float3 col = _528;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _41)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _41);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_41.uBackground);
    float param_4 = _41.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_electric_field_frag_out flair_electric_field_frag(constant FlairUniforms& _41 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_electric_field_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _585;
    if (_41.flair_flipY > 0.5)
    {
        _585 = _41.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _585 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _585);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _41);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

