// flair-metal-hash: ee6f002d
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
    float uCells;
    float uCoverage;
    float uAngle;
    float uScatter;
    float uHeight;
    float uVariation;
    float uGap;
    float uSpeed;
    float3 uSurface;
    packed_float3 uShade;
    float uLight;
    float uElevation;
    float uSoftness;
    float uTilt;
};

struct flair_relief_hex_tiles_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 reliefLight(constant FlairUniforms& _237)
{
    float a = radians(_237.uLight);
    float e = radians(_237.uElevation);
    return float3(cos(a) * cos(e), sin(a) * cos(e), sin(e));
}

static inline __attribute__((always_inline))
float4 hexCell(thread const float2& p)
{
    float2 s = p.yx;
    float2 r = float2(1.0, 1.73205077648162841796875);
    float2 h = r * 0.5;
    float2 a = mod(s, r) - h;
    float2 b = mod(s - h, r) - h;
    float2 g = select(b, a, bool2(dot(a, a) < dot(b, b)));
    return float4(g.yx, (s - g).yx);
}

static inline __attribute__((always_inline))
float hexEdge(thread const float2& g)
{
    float2 a = abs(g.yx);
    return 0.5 - fast::max(dot(a, float2(0.5, 0.866025388240814208984375)), a.x);
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
float tileRaise(thread const float2& c, constant FlairUniforms& _237)
{
    float2 f = c / float2(_237.uCells);
    float a = radians(_237.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float extent = (0.5 * (((abs(dir.x) * _237.iResolution[0u]) / _237.iResolution[1u]) + abs(dir.y))) + 0.001000000047497451305389404296875;
    float along = dot(f, dir) / extent;
    float2 param = (c * 0.449999988079071044921875) + float2(3.7000000476837158203125);
    float v = along + (_237.uScatter * ((1.39999997615814208984375 * vnoise(param)) - 0.699999988079071044921875));
    float edge = 1.0 - (2.0 * _237.uCoverage);
    float raise = smoothstep(edge, edge + 0.300000011920928955078125, v);
    float2 param_1 = c + float2(41.0);
    float stray = step(0.89999997615814208984375, hash12(param_1)) * step(edge - (0.449999988079071044921875 * (0.300000011920928955078125 + _237.uScatter)), v);
    return fast::max(raise, stray * 0.800000011920928955078125);
}

static inline __attribute__((always_inline))
float tileHeight(thread const float2& c, constant FlairUniforms& _237)
{
    float2 param = c;
    float raise = tileRaise(param, _237);
    if (raise <= 0.0)
    {
        return 0.0;
    }
    float a = radians(_237.uAngle);
    float along = dot(c, float2(cos(a), sin(a)));
    float2 param_1 = c + float2(13.0);
    float phase = (((_237.iTime * _237.uSpeed) / 4.0) - (along * 0.0900000035762786865234375)) + (0.3499999940395355224609375 * hash12(param_1));
    float wave = 0.5 + (0.5 * sin(6.283185482025146484375 * phase));
    float2 param_2 = c + float2(29.0);
    float rest = 1.0 - ((_237.uVariation * hash12(param_2)) * 0.5);
    return ((_237.uHeight * raise) * rest) * mix(1.0, wave * wave, _237.uVariation);
}

static inline __attribute__((always_inline))
float heightAt(thread const float2& p, constant FlairUniforms& _237)
{
    float2 param = p * _237.uCells;
    float4 h = hexCell(param);
    float2 param_1 = h.xy;
    float d = hexEdge(param_1);
    float2 param_2 = h.zw;
    float th = tileHeight(param_2, _237);
    return th * smoothstep(_237.uGap, _237.uGap + 0.0350000001490116119384765625, d);
}

static inline __attribute__((always_inline))
float3 reliefTrace(thread const float2& p, thread const float2& view, thread const float& bottom, thread const float& top, thread const float& px, constant FlairUniforms& _237)
{
    if ((dot(view, view) < 1.0000000133514319600180897396058e-10) || (top <= bottom))
    {
        float2 param = p;
        return float3(p, heightAt(param, _237));
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
        if (heightAt(param_1, _237) >= z)
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
        if (heightAt(param_2, _237) >= z_1)
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
float3 reliefNormal(thread const float2& q, thread const float& eps, constant FlairUniforms& _237)
{
    float2 e = float2(eps, 0.0);
    float2 param = q + e;
    float2 param_1 = q - e;
    float dx = heightAt(param, _237) - heightAt(param_1, _237);
    float2 param_2 = q + e.yx;
    float2 param_3 = q - e.yx;
    float dy = heightAt(param_2, _237) - heightAt(param_3, _237);
    return fast::normalize(float3(-dx, -dy, 2.0 * eps));
}

static inline __attribute__((always_inline))
float reliefShadow(thread const float3& s, thread const float3& L, thread const float& softness, thread const float& top, thread const float& px, constant FlairUniforms& _237)
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
        float clearance = (s.z + (rise * t)) - heightAt(param, _237);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _237)
{
    float2 p = (fragCoord - (float2(_237.iResolution[0], _237.iResolution[1]) * 0.5)) / float2(_237.iResolution[1u]);
    float px = 1.0 / _237.iResolution[1u];
    float3 L = reliefLight(_237);
    float2 view = float2(0.5, 0.866025388240814208984375) * (_237.uTilt * 0.89999997615814208984375);
    float top = _237.uHeight + 9.9999997473787516355514526367188e-05;
    float2 param = p;
    float2 param_1 = view;
    float param_2 = 0.0;
    float param_3 = top;
    float param_4 = px;
    float3 s = reliefTrace(param, param_1, param_2, param_3, param_4, _237);
    float2 param_5 = s.xy;
    float param_6 = 0.75 * px;
    float3 N = reliefNormal(param_5, param_6, _237);
    float3 param_7 = s;
    float3 param_8 = L;
    float param_9 = _237.uSoftness;
    float param_10 = top;
    float param_11 = px;
    float lit = reliefShadow(param_7, param_8, param_9, param_10, param_11, _237);
    float3 param_12 = N;
    float3 param_13 = L;
    float param_14 = lit;
    float3 param_15 = _237.uSurface;
    float3 param_16 = float3(_237.uShade);
    float3 col = reliefShade(param_12, param_13, param_14, param_15, param_16);
    col *= (0.949999988079071044921875 + (0.0599999986588954925537109375 * dot(p, fast::normalize(L.xy + float2(9.9999997473787516355514526367188e-05)))));
    fragColor = float4(col, 1.0);
}

fragment flair_relief_hex_tiles_frag_out flair_relief_hex_tiles_frag(constant FlairUniforms& _237 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_relief_hex_tiles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _895;
    if (_237.flair_flipY > 0.5)
    {
        _895 = _237.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _895 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _895);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _237);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

