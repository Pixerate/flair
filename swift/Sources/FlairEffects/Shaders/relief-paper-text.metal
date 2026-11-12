// flair-metal-hash: 6c0fb857
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
    float uSize;
    float uDepthStart;
    float uDepthEnd;
    float uDepth;
    float uBevel;
    float uBreathe;
    float3 uSurface;
    float3 uShade;
    packed_float3 uFace;
    float uLight;
    float uElevation;
    float uSoftness;
    float uTilt;
};

struct flair_relief_paper_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 reliefLight(constant FlairUniforms& _101)
{
    float a = radians(_101.uLight);
    float e = radians(_101.uElevation);
    return float3(cos(a) * cos(e), sin(a) * cos(e), sin(e));
}

static inline __attribute__((always_inline))
float maskAt(thread const float2& p, thread const float& lod, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    if (size.x <= 1.0)
    {
        float2 q = abs(p) - (float2(0.300000011920928955078125, 0.119999997317790985107421875) * _101.uSize);
        return step(length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0), 0.0);
    }
    float aspect = size.x / size.y;
    float h = fast::min(_101.uSize, ((_101.iResolution[0u] / _101.iResolution[1u]) * _101.uSize) / aspect);
    float2 uv = (p / float2(h * aspect, h)) + float2(0.5);
    bool _156 = uv.x < 0.0;
    bool _163;
    if (!_156)
    {
        _163 = uv.x > 1.0;
    }
    else
    {
        _163 = _156;
    }
    bool _170;
    if (!_163)
    {
        _170 = uv.y < 0.0;
    }
    else
    {
        _170 = _163;
    }
    bool _177;
    if (!_170)
    {
        _177 = uv.y > 1.0;
    }
    else
    {
        _177 = _170;
    }
    if (_177)
    {
        return 0.0;
    }
    return uMask.sample(uMaskSmplr, uv, level(lod)).w;
}

static inline __attribute__((always_inline))
float halfWidth(texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    float2 size = float2(int2(uMask.get_width(), uMask.get_height()));
    float _198;
    if (size.x <= 1.0)
    {
        _198 = 2.5;
    }
    else
    {
        _198 = size.x / size.y;
    }
    float aspect = _198;
    float h = fast::min(_101.uSize, ((_101.iResolution[0u] / _101.iResolution[1u]) * _101.uSize) / aspect);
    return (0.5 * h) * aspect;
}

static inline __attribute__((always_inline))
float depthAt(thread const float2& p, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    float t = smoothstep(-1.0, 1.0, p.x / fast::max(halfWidth(uMask, uMaskSmplr, _101), 0.001000000047497451305389404296875));
    float breathe = 1.0 - (_101.uBreathe * (0.5 - (0.5 * cos((6.283185482025146484375 * _101.iTime) / 6.0))));
    return (mix(_101.uDepthStart, _101.uDepthEnd, t) * _101.uDepth) * breathe;
}

static inline __attribute__((always_inline))
float heightAt(thread const float2& p, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    float lod = mix(0.0, 3.5, _101.uBevel) + log2(fast::max(_101.iResolution[1u] / 512.0, 1.0));
    float2 param = p;
    float param_1 = lod;
    float m = maskAt(param, param_1, uMask, uMaskSmplr, _101);
    float2 param_2 = p;
    return depthAt(param_2, uMask, uMaskSmplr, _101) * smoothstep(0.07999999821186065673828125, 0.920000016689300537109375, m);
}

static inline __attribute__((always_inline))
float3 reliefTrace(thread const float2& p, thread const float2& view, thread const float& bottom, thread const float& top, thread const float& px, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    if ((dot(view, view) < 1.0000000133514319600180897396058e-10) || (top <= bottom))
    {
        float2 param = p;
        return float3(p, heightAt(param, uMask, uMaskSmplr, _101));
    }
    int steps = int(fast::clamp(ceil((length(view) * (top - bottom)) / px), 2.0, 36.0));
    float dz = (top - bottom) / float(steps);
    float hi = top;
    float lo = bottom;
    for (int i = 0; i <= 36; i++)
    {
        if (i > steps)
        {
            break;
        }
        float z = top - (float(i) * dz);
        float2 param_1 = p - (view * z);
        if (heightAt(param_1, uMask, uMaskSmplr, _101) >= z)
        {
            lo = z;
            break;
        }
        hi = z;
    }
    for (int i_1 = 0; i_1 < 5; i_1++)
    {
        float z_1 = 0.5 * (hi + lo);
        float2 param_2 = p - (view * z_1);
        if (heightAt(param_2, uMask, uMaskSmplr, _101) >= z_1)
        {
            lo = z_1;
        }
        else
        {
            hi = z_1;
        }
    }
    return float3(p - (view * lo), lo);
}

static inline __attribute__((always_inline))
float3 reliefNormal(thread const float2& q, thread const float& eps, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    float2 e = float2(eps, 0.0);
    float2 param = q + e;
    float2 param_1 = q - e;
    float dx = heightAt(param, uMask, uMaskSmplr, _101) - heightAt(param_1, uMask, uMaskSmplr, _101);
    float2 param_2 = q + e.yx;
    float2 param_3 = q - e.yx;
    float dy = heightAt(param_2, uMask, uMaskSmplr, _101) - heightAt(param_3, uMask, uMaskSmplr, _101);
    return fast::normalize(float3(-dx, -dy, 2.0 * eps));
}

static inline __attribute__((always_inline))
float reliefShadow(thread const float3& s, thread const float3& L, thread const float& softness, thread const float& top, thread const float& px, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    float flatLen = fast::max(length(L.xy), 0.001000000047497451305389404296875);
    float2 dir = L.xy / float2(flatLen);
    float rise = L.z / flatLen;
    float reach = fast::min((top - s.z) / fast::max(rise, 0.001000000047497451305389404296875), 0.800000011920928955078125);
    if (reach <= 0.0)
    {
        return 1.0;
    }
    int steps = int(fast::clamp(reach / (2.0 * px), 6.0, 24.0));
    float lit = 1.0;
    for (int i = 1; i <= 24; i++)
    {
        if (i > steps)
        {
            break;
        }
        float f = float(i) / float(steps);
        float t = (1.5 * px) + ((reach * f) * f);
        float2 param = s.xy + (dir * t);
        float clearance = (s.z + (rise * t)) - heightAt(param, uMask, uMaskSmplr, _101);
        lit = fast::min(lit, fast::clamp(0.5 + (clearance / ((softness * t) + px)), 0.0, 1.0));
        if (lit <= 0.0)
        {
            break;
        }
    }
    return (lit * lit) * (3.0 - (2.0 * lit));
}

static inline __attribute__((always_inline))
float3 reliefShade(thread const float3& N, thread const float3& L, thread const float& lit, thread const float3& surface, thread const float3& shade)
{
    float k = (fast::max(dot(N, L), 0.0) / fast::max(L.z, 0.001000000047497451305389404296875)) * lit;
    float fill = 0.2199999988079071044921875 * (0.5 + (0.5 * N.z));
    float3 col = mix(shade, surface, float3(fast::clamp(fill + ((1.0 - fill) * k), 0.0, 1.0)));
    return col + ((surface * 0.180000007152557373046875) * fast::clamp(k - 1.0, 0.0, 1.0));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uMask, sampler uMaskSmplr, constant FlairUniforms& _101)
{
    float2 p = (fragCoord - (float2(_101.iResolution[0], _101.iResolution[1]) * 0.5)) / float2(_101.iResolution[1u]);
    float px = 1.0 / _101.iResolution[1u];
    float3 L = reliefLight(_101);
    float2 view = float2(-0.707099974155426025390625, 0.707099974155426025390625) * (_101.uTilt * 0.89999997615814208984375);
    float top = (fast::max(fast::max(_101.uDepthStart, _101.uDepthEnd), 0.0) * _101.uDepth) + 9.9999997473787516355514526367188e-05;
    float bottom = (fast::min(fast::min(_101.uDepthStart, _101.uDepthEnd), 0.0) * _101.uDepth) - 9.9999997473787516355514526367188e-05;
    float2 param = p;
    float2 param_1 = view;
    float param_2 = bottom;
    float param_3 = top;
    float param_4 = px;
    float3 s = reliefTrace(param, param_1, param_2, param_3, param_4, uMask, uMaskSmplr, _101);
    float2 param_5 = s.xy;
    float param_6 = 1.0 * px;
    float3 N = reliefNormal(param_5, param_6, uMask, uMaskSmplr, _101);
    float3 param_7 = s;
    float3 param_8 = L;
    float param_9 = _101.uSoftness;
    float param_10 = top;
    float param_11 = px;
    float lit = reliefShadow(param_7, param_8, param_9, param_10, param_11, uMask, uMaskSmplr, _101);
    float2 param_12 = s.xy;
    float2 param_13 = s.xy;
    float face = smoothstep(0.85000002384185791015625, 0.949999988079071044921875, abs(s.z) / fast::max(abs(depthAt(param_12, uMask, uMaskSmplr, _101)), 9.9999997473787516355514526367188e-06)) * step(9.9999997473787516355514526367188e-05, abs(depthAt(param_13, uMask, uMaskSmplr, _101)));
    float3 surface = mix(_101.uSurface, float3(_101.uFace), float3(face));
    float3 param_14 = N;
    float3 param_15 = L;
    float param_16 = lit;
    float3 param_17 = surface;
    float3 param_18 = _101.uShade * mix(float3(1.0), float3(_101.uFace) / fast::max(_101.uSurface, float3(0.001000000047497451305389404296875)), float3(face));
    float3 col = reliefShade(param_14, param_15, param_16, param_17, param_18);
    col *= (0.949999988079071044921875 + (0.0599999986588954925537109375 * dot(p, fast::normalize(L.xy + float2(9.9999997473787516355514526367188e-05)))));
    fragColor = float4(col, 1.0);
}

fragment flair_relief_paper_text_frag_out flair_relief_paper_text_frag(constant FlairUniforms& _101 [[buffer(0)]], texture2d<float> uMask [[texture(1)]], sampler uMaskSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_relief_paper_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _814;
    if (_101.flair_flipY > 0.5)
    {
        _814 = _101.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _814 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _814);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uMask, uMaskSmplr, _101);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

