// flair-metal-hash: ab21f71f
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
    packed_float3 uColor;
    float uAngle;
    float uOffset;
    float uWidth;
    float uHaze;
    float uDensity;
    float uSpeed;
    float uFocus;
    float uBlur;
};

struct flair_dust_in_light_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 glow(thread float3& c)
{
    c = float3(1.0) - exp(-fast::max(c, float3(0.0)));
    float a = fast::max(c.x, fast::max(c.y, c.z));
    return float4(c / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _188)
{
    float px = 1.0 / _188.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _188.iResolution[0u] / _188.iResolution[1u];
    float t = _188.iTime * _188.uSpeed;
    float ang = radians(_188.uAngle);
    float2 dir = float2(sin(ang), -cos(ang));
    float2 o = float2(aspect * (0.5 + (0.5 * _188.uOffset)), 1.0499999523162841796875);
    float2 rel = p - o;
    float along = dot(rel, dir);
    float across = dot(rel, float2(-dir.y, dir.x));
    float w = _188.uWidth * (0.699999988079071044921875 + (0.3499999940395355224609375 * fast::max(along, 0.0)));
    float beam = ((1.0 - smoothstep(w * 0.25, w * 0.5, abs(across))) * smoothstep(-0.0199999995529651641845703125, 0.1500000059604644775390625, along)) * exp((-fast::max(along, 0.0)) * 0.3499999940395355224609375);
    float2 param = float2((across / fast::max(w, 0.00999999977648258209228515625)) * 6.0, t * 0.1500000059604644775390625);
    float shafts = 0.75 + (0.25 * vnoise(param));
    beam *= shafts;
    float3 col = ((float3(_188.uColor) * beam) * _188.uHaze) * 0.300000011920928955078125;
    if (beam > 0.00200000009499490261077880859375)
    {
        for (int i = 0; i < 4; i++)
        {
            float fi = float(i);
            float z = (fi + 0.5) / 4.0;
            float scale = mix(26.0, 9.0, z);
            float2 q = ((p * scale) + (((float2(0.01200000010430812835693359375, -0.007000000216066837310791015625) * t) * (0.5 + z)) * scale)) + float2(fi * 7.30000019073486328125);
            float2 base = floor(q);
            float blur = abs(z - _188.uFocus) * _188.uBlur;
            for (int y = -1; y <= 1; y++)
            {
                for (int x = -1; x <= 1; x++)
                {
                    float2 id = base + float2(float(x), float(y));
                    float2 param_1 = id + float2(fi * 13.1000003814697265625);
                    float2 h = hash22(param_1);
                    float2 param_2 = (id * 1.2999999523162841796875) + float2(fi);
                    if (hash12(param_2) > _188.uDensity)
                    {
                        continue;
                    }
                    float2 wander = float2(sin((t * (0.20000000298023223876953125 + (0.300000011920928955078125 * h.x))) + (h.y * 6.280000209808349609375)), cos((t * (0.17000000178813934326171875 + (0.25 * h.y))) + (h.x * 6.280000209808349609375))) * 0.3499999940395355224609375;
                    float2 m = ((id + float2(0.5)) + ((h - float2(0.5)) * 0.4000000059604644775390625)) + wander;
                    float d = length(q - m) / scale;
                    float r = (0.00179999996908009052276611328125 * (0.60000002384185791015625 + (1.60000002384185791015625 * z))) * (0.60000002384185791015625 + (0.800000011920928955078125 * h.x));
                    float big = r + ((blur * 0.02199999988079071044921875) * (0.5 + z));
                    if (d > (big + (px * 2.0)))
                    {
                        continue;
                    }
                    float edge = fast::max(px, (big * 0.3499999940395355224609375) * fast::min(blur * 4.0, 1.0));
                    float disc = 1.0 - smoothstep(big - edge, big + (px * 0.5), d);
                    float energy = (r * r) / (big * big);
                    float glint = 0.550000011920928955078125 + (0.449999988079071044921875 * sin((t * (1.0 + (2.0 * h.y))) + (h.x * 30.0)));
                    col += ((((((float3(_188.uColor) * disc) * mix(1.0, 0.25, fast::min(blur * 3.0, 1.0))) * (0.4000000059604644775390625 + (2.599999904632568359375 * energy))) * glint) * beam) * 1.60000002384185791015625);
                }
            }
        }
    }
    float3 param_3 = col;
    float4 _581 = glow(param_3);
    fragColor = _581;
}

fragment flair_dust_in_light_frag_out flair_dust_in_light_frag(constant FlairUniforms& _188 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_dust_in_light_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _594;
    if (_188.flair_flipY > 0.5)
    {
        _594 = _188.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _594 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _594);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _188);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

