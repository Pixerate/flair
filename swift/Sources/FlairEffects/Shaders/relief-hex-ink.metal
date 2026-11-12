// flair-metal-hash: 3fcfb01c
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
    float3 uShade;
    packed_float3 uInk;
    float uInkTiles;
    float uSplatter;
    float uCracks;
    float uLight;
    float uElevation;
    float uSoftness;
    float uTilt;
};

struct flair_relief_hex_ink_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 reliefLight(constant FlairUniforms& _333)
{
    float a = radians(_333.uLight);
    float e = radians(_333.uElevation);
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
float tileRaise(thread const float2& c, constant FlairUniforms& _333)
{
    float2 f = c / float2(_333.uCells);
    float a = radians(_333.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float extent = (0.5 * (((abs(dir.x) * _333.iResolution[0u]) / _333.iResolution[1u]) + abs(dir.y))) + 0.001000000047497451305389404296875;
    float along = dot(f, dir) / extent;
    float2 param = (c * 0.449999988079071044921875) + float2(3.7000000476837158203125);
    float v = along + (_333.uScatter * ((1.39999997615814208984375 * vnoise(param)) - 0.699999988079071044921875));
    float edge = 1.0 - (2.0 * _333.uCoverage);
    float raise = smoothstep(edge, edge + 0.300000011920928955078125, v);
    float2 param_1 = c + float2(41.0);
    float stray = step(0.89999997615814208984375, hash12(param_1)) * step(edge - (0.449999988079071044921875 * (0.300000011920928955078125 + _333.uScatter)), v);
    return fast::max(raise, stray * 0.800000011920928955078125);
}

static inline __attribute__((always_inline))
float tileHeight(thread const float2& c, constant FlairUniforms& _333)
{
    float2 param = c;
    float raise = tileRaise(param, _333);
    if (raise <= 0.0)
    {
        return 0.0;
    }
    float2 param_1 = c + float2(13.0);
    float sway = 0.5 + (0.5 * sin(6.283185482025146484375 * (((_333.iTime * _333.uSpeed) / 8.0) + hash12(param_1))));
    return (_333.uHeight * raise) * (1.0 - (_333.uVariation * sway));
}

static inline __attribute__((always_inline))
float heightAt(thread const float2& p, constant FlairUniforms& _333)
{
    float2 param = p * _333.uCells;
    float4 h = hexCell(param);
    float2 param_1 = h.xy;
    float d = hexEdge(param_1);
    float2 param_2 = h.zw;
    float th = tileHeight(param_2, _333);
    return th * smoothstep(_333.uGap, _333.uGap + 0.0350000001490116119384765625, d);
}

static inline __attribute__((always_inline))
float3 reliefTrace(thread const float2& p, thread const float2& view, thread const float& bottom, thread const float& top, thread const float& px, constant FlairUniforms& _333)
{
    if ((dot(view, view) < 1.0000000133514319600180897396058e-10) || (top <= bottom))
    {
        float2 param = p;
        return float3(p, heightAt(param, _333));
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
        if (heightAt(param_1, _333) >= z)
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
        if (heightAt(param_2, _333) >= z_1)
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
float3 reliefNormal(thread const float2& q, thread const float& eps, constant FlairUniforms& _333)
{
    float2 e = float2(eps, 0.0);
    float2 param = q + e;
    float2 param_1 = q - e;
    float dx = heightAt(param, _333) - heightAt(param_1, _333);
    float2 param_2 = q + e.yx;
    float2 param_3 = q - e.yx;
    float dy = heightAt(param_2, _333) - heightAt(param_3, _333);
    return fast::normalize(float3(-dx, -dy, 2.0 * eps));
}

static inline __attribute__((always_inline))
float reliefShadow(thread const float3& s, thread const float3& L, thread const float& softness, thread const float& top, thread const float& px, constant FlairUniforms& _333)
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
        float clearance = (s.z + (rise * t)) - heightAt(param, _333);
        lit = fast::min(lit, fast::clamp(0.5 + (clearance / ((softness * t) + px)), 0.0, 1.0));
        if (lit <= 0.0)
        {
            break;
        }
    }
    return (lit * lit) * (3.0 - (2.0 * lit));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float cracks(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            float2 o = float2(float(x), float(y));
            float2 param = i + o;
            float2 r = (o + hash22(param)) - f;
            float d = dot(r, r);
            if (d < d1)
            {
                d2 = d1;
                d1 = d;
            }
            else
            {
                if (d < d2)
                {
                    d2 = d;
                }
            }
        }
    }
    float seam = sqrt(d2) - sqrt(d1);
    float2 param_1 = (p * 0.800000011920928955078125) + float2(5.0);
    float open = smoothstep(0.4000000059604644775390625, 0.64999997615814208984375, vnoise(param_1));
    return (1.0 - smoothstep(0.0, 0.02500000037252902984619140625, seam)) * open;
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
float inkAt(thread const float2& p, thread const float& along, constant FlairUniforms& _333)
{
    float edge = 1.0 - (2.0 * _333.uCoverage);
    float2 param = p * 3.0;
    int param_1 = 5;
    float _949 = fbm(param, param_1);
    float cloud = smoothstep(edge - 0.100000001490116119384765625, edge + 0.5, (along + (0.699999988079071044921875 * (_949 - 0.5))) + (0.4000000059604644775390625 * (_333.uInkTiles - 0.75)));
    float drops = 0.0;
    for (int i = 0; i < 3; i++)
    {
        float scale = 18.0 + (22.0 * float(i));
        float2 g = (p * scale) + float2(float(i) * 7.30000019073486328125);
        float2 cell = floor(g);
        float2 param_2 = cell;
        float2 r = hash22(param_2);
        float2 param_3 = cell + float2(2.0);
        float2 param_4 = cell + float2(5.0);
        float size = mix(0.07999999821186065673828125, 0.319999992847442626953125, hash12(param_3)) * step(1.0 - (0.3499999940395355224609375 * _333.uSplatter), hash12(param_4));
        drops = fast::max(drops, smoothstep(size, size - 0.0599999986588954925537109375, length(fract(g) - r)));
    }
    float near = smoothstep(-0.60000002384185791015625, 0.20000000298023223876953125, along);
    return fast::max(cloud * (0.5 + (0.5 * _333.uSplatter)), (drops * near) * _333.uSplatter);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _333)
{
    float2 p = (fragCoord - (float2(_333.iResolution[0], _333.iResolution[1]) * 0.5)) / float2(_333.iResolution[1u]);
    float px = 1.0 / _333.iResolution[1u];
    float3 L = reliefLight(_333);
    float2 view = float2(-0.5, 0.866025388240814208984375) * (_333.uTilt * 0.89999997615814208984375);
    float top = _333.uHeight + 9.9999997473787516355514526367188e-05;
    float2 param = p;
    float2 param_1 = view;
    float param_2 = 0.0;
    float param_3 = top;
    float param_4 = px;
    float3 s = reliefTrace(param, param_1, param_2, param_3, param_4, _333);
    float2 param_5 = s.xy;
    float param_6 = 0.75 * px;
    float3 N = reliefNormal(param_5, param_6, _333);
    float3 param_7 = s;
    float3 param_8 = L;
    float param_9 = _333.uSoftness;
    float param_10 = top;
    float param_11 = px;
    float lit = reliefShadow(param_7, param_8, param_9, param_10, param_11, _333);
    float a = radians(_333.uAngle);
    float2 dir = float2(cos(a), sin(a));
    float along = dot(s.xy, dir) / ((0.5 * (((abs(dir.x) * _333.iResolution[0u]) / _333.iResolution[1u]) + abs(dir.y))) + 0.001000000047497451305389404296875);
    float2 param_12 = s.xy * _333.uCells;
    float4 h = hexCell(param_12);
    bool onTile = s.z > 9.9999997473787516355514526367188e-05;
    float3 base = _333.uSurface;
    if (onTile)
    {
        float2 param_13 = s.xy * 16.0;
        float crack = cracks(param_13) * _333.uCracks;
        float edge = 1.0 - (2.0 * _333.uCoverage);
        float deep = fast::clamp((along - edge) / fast::max(1.0 - edge, 0.100000001490116119384765625), 0.0, 1.0);
        float2 param_14 = h.zw + float2(3.0);
        float inked = step(hash12(param_14), fast::clamp(((deep * 1.7999999523162841796875) - 0.300000011920928955078125) + ((_333.uInkTiles - 0.75) * 1.5), 0.0, 1.0));
        float2 param_15 = (s.xy * 14.0) + h.zw;
        int param_16 = 5;
        float _1217 = fbm(param_15, param_16);
        float marble = _1217;
        float3 ink = (float3(_333.uInk) * (0.699999988079071044921875 + (0.89999997615814208984375 * marble))) + float3(0.25 * smoothstep(0.62000000476837158203125, 0.800000011920928955078125, marble));
        base = mix(_333.uSurface * (0.920000016689300537109375 + (0.07999999821186065673828125 * marble)), ink, float3(inked));
        base = mix(base, mix(_333.uShade * 0.60000002384185791015625, _333.uSurface * 0.85000002384185791015625, float3(inked)), float3(crack * 0.800000011920928955078125));
        float2 param_17 = h.xy;
        float face = (hexEdge(param_17) - _333.uGap) - 0.0350000001490116119384765625;
        float rim = smoothstep(-0.0040000001899898052215576171875, 0.0, face) * (1.0 - smoothstep(0.008000000379979610443115234375, 0.01600000075995922088623046875, face));
        base = mix(base, _333.uSurface, float3((rim * 0.5) * inked));
    }
    else
    {
        float2 param_18 = s.xy * 5.0;
        float crack_1 = cracks(param_18) * _333.uCracks;
        float2 param_19 = (s.xy * 4.0) + float2(11.0);
        int param_20 = 5;
        float _1308 = fbm(param_19, param_20);
        float stain = _1308;
        base = _333.uSurface * (0.89999997615814208984375 + (0.119999997317790985107421875 * stain));
        base = mix(base, _333.uShade * 0.800000011920928955078125, float3(crack_1 * 0.300000011920928955078125));
        float2 param_21 = s.xy;
        float param_22 = along;
        base = mix(base, float3(_333.uInk), float3(inkAt(param_21, param_22, _333) * (0.75 + (0.25 * stain))));
    }
    float3 param_23 = N;
    float3 param_24 = L;
    float param_25 = lit;
    float3 param_26 = base;
    float3 param_27 = base * _333.uShade;
    float3 col = reliefShade(param_23, param_24, param_25, param_26, param_27);
    col *= (0.939999997615814208984375 + (0.07999999821186065673828125 * dot(p, fast::normalize(L.xy + float2(9.9999997473787516355514526367188e-05)))));
    fragColor = float4(col, 1.0);
}

fragment flair_relief_hex_ink_frag_out flair_relief_hex_ink_frag(constant FlairUniforms& _333 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_relief_hex_ink_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1382;
    if (_333.flair_flipY > 0.5)
    {
        _1382 = _333.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1382 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1382);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _333);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

