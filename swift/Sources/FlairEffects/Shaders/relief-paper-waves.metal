// flair-metal-hash: 100d8c4d
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
    int uLayers;
    float uAngle;
    float uWaves;
    float uAmplitude;
    float uSpacing;
    float uOffset;
    float uSpeed;
    float3 uSurface;
    float3 uTint;
    packed_float3 uShade;
    float uLight;
    float uShadow;
    float uSoftness;
};

struct flair_relief_paper_waves_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float edgeY(thread const int& i, thread const float& x, constant FlairUniforms& _44)
{
    float fi = float(i);
    float ph = ((6.283185482025146484375 * _44.iTime) * _44.uSpeed) / 10.0;
    float y = (_44.uOffset * 0.5) - ((fi - (0.5 * float(_44.uLayers - 1))) * _44.uSpacing);
    y += (_44.uAmplitude * sin((((x * _44.uWaves) * 3.141590118408203125) + (fi * 0.550000011920928955078125)) + ph));
    y += ((0.3499999940395355224609375 * _44.uAmplitude) * sin((((x * _44.uWaves) * 7.099999904632568359375) - (fi * 1.2999999523162841796875)) - (2.0 * ph)));
    return y;
}

static inline __attribute__((always_inline))
float sheetDist(thread const int& i, thread const float2& p, constant FlairUniforms& _44)
{
    float e = 0.0040000001899898052215576171875;
    int param = i;
    float param_1 = p.x;
    float y0 = edgeY(param, param_1, _44);
    int param_2 = i;
    float param_3 = p.x + e;
    int param_4 = i;
    float param_5 = p.x - e;
    float slope = (edgeY(param_2, param_3, _44) - edgeY(param_4, param_5, _44)) / (2.0 * e);
    return (y0 - p.y) / sqrt(1.0 + (slope * slope));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _44)
{
    float2 p = (fragCoord - (float2(_44.iResolution[0], _44.iResolution[1]) * 0.5)) / float2(_44.iResolution[1u]);
    float px = 1.0 / _44.iResolution[1u];
    float a = radians(_44.uAngle);
    float2x2 turn = float2x2(float2(cos(a), -sin(a)), float2(sin(a), cos(a)));
    float2 q = turn * p;
    float la = radians(_44.uLight) - a;
    float2 toLight = float2(cos(la), sin(la));
    int topSheet = 0;
    for (int i = 1; i < 8; i++)
    {
        if (i >= _44.uLayers)
        {
            break;
        }
        int param = i;
        float2 param_1 = q;
        if (sheetDist(param, param_1, _44) > 0.0)
        {
            topSheet = i;
        }
    }
    float depth = float(topSheet) / float(max((_44.uLayers - 1), 1));
    float shade = 0.0;
    for (int i_1 = 1; i_1 < 8; i_1++)
    {
        if (i_1 >= _44.uLayers)
        {
            break;
        }
        if (i_1 <= topSheet)
        {
            continue;
        }
        float rise = float(i_1 - topSheet);
        int param_2 = i_1;
        float2 param_3 = q + ((toLight * _44.uShadow) * sqrt(rise));
        float d = sheetDist(param_2, param_3, _44);
        float soft = ((_44.uSoftness * _44.uShadow) * sqrt(rise)) + (2.0 * px);
        shade = fast::max(shade, (1.0 - smoothstep(-soft, soft * 1.5, -d)) * (0.75 + (0.25 / rise)));
    }
    float3 col = mix(_44.uTint, _44.uSurface, float3(depth));
    if (topSheet > 0)
    {
        float e = 0.0040000001899898052215576171875;
        int param_4 = topSheet;
        float param_5 = q.x + e;
        int param_6 = topSheet;
        float param_7 = q.x - e;
        float slope = (edgeY(param_4, param_5, _44) - edgeY(param_6, param_7, _44)) / (2.0 * e);
        float2 n = fast::normalize(float2(slope, -1.0));
        int param_8 = topSheet;
        float2 param_9 = q;
        float d_1 = sheetDist(param_8, param_9, _44);
        float lip = 1.0 - smoothstep(0.0, (3.0 * px) + 0.0030000000260770320892333984375, d_1);
        col *= (1.0 + ((0.119999997317790985107421875 * lip) * dot(n, toLight)));
    }
    float _406;
    if ((topSheet + 1) < _44.uLayers)
    {
        int param_10 = topSheet + 1;
        float2 param_11 = q;
        _406 = fast::clamp((-sheetDist(param_10, param_11, _44)) / fast::max(_44.uSpacing, 0.001000000047497451305389404296875), 0.0, 1.0);
    }
    else
    {
        _406 = 1.0;
    }
    float behind = _406;
    col *= (0.9700000286102294921875 + (0.02999999932944774627685546875 * behind));
    col = mix(col, (float3(_44.uShade) * mix(_44.uTint, _44.uSurface, float3(depth))) / fast::max(_44.uSurface, float3(0.001000000047497451305389404296875)), float3(shade));
    fragColor = float4(col, 1.0);
}

fragment flair_relief_paper_waves_frag_out flair_relief_paper_waves_frag(constant FlairUniforms& _44 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_relief_paper_waves_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _468;
    if (_44.flair_flipY > 0.5)
    {
        _468 = _44.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _468 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _468);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _44);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

