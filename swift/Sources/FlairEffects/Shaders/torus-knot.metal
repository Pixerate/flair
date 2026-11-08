// flair-metal-hash: 7b840e87
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
    float3 uBackground;
    packed_float3 uGlowColor;
    int uP;
    int uQ;
    float uThickness;
    float uSpeed;
    float uIridescence;
    float uGlow;
    float uBackgroundAlpha;
};

struct flair_torus_knot_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3x3 turn(thread const float& a, thread const float& b)
{
    float ca = cos(a);
    float sa = sin(a);
    float cb = cos(b);
    float sb = sin(b);
    return float3x3(float3(1.0, 0.0, 0.0), float3(0.0, cb, sb), float3(0.0, -sb, cb)) * float3x3(float3(ca, 0.0, -sa), float3(0.0, 1.0, 0.0), float3(sa, 0.0, ca));
}

static inline __attribute__((always_inline))
float2 sphereHit(thread const float3& ro, thread const float3& rd, thread const float& r)
{
    float b = dot(ro, rd);
    float c = dot(ro, ro) - (r * r);
    float h = (b * b) - c;
    if (h < 0.0)
    {
        return float2(1000000000.0, -1000000000.0);
    }
    h = sqrt(h);
    return float2((-b) - h, (-b) + h);
}

static inline __attribute__((always_inline))
float2 knot(thread const float3& p, constant FlairUniforms& _152)
{
    float r = length(p.xz);
    float a = precise::atan2(p.z, p.x);
    float2 q = float2(r - 1.0, p.y);
    float best = 1000000000.0;
    float along = 0.0;
    float P = float(_152.uP);
    for (int k = 0; k < 7; k++)
    {
        if (k >= _152.uP)
        {
            break;
        }
        float s = (a + (6.28318023681640625 * float(k))) / P;
        float ang = s * float(_152.uQ);
        float d = length(q - (float2(cos(ang), sin(ang)) * 0.449999988079071044921875));
        if (d < best)
        {
            best = d;
            along = s / 6.28318023681640625;
        }
    }
    return float2(best - _152.uThickness, along);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _152)
{
    float2 p = (fragCoord - (float2(_152.iResolution[0], _152.iResolution[1]) * 0.5)) / float2(_152.iResolution[1u]);
    float3 ro = float3(0.0, 0.0, 5.19999980926513671875);
    float3 rd = fast::normalize(float3(p, -1.2999999523162841796875));
    float t0 = _152.iTime * _152.uSpeed;
    float param = t0 * 0.300000011920928955078125;
    float param_1 = 1.14999997615814208984375 + (0.25 * sin(t0 * 0.20000000298023223876953125));
    float3x3 m = turn(param, param_1);
    float3 lro = m * ro;
    float3 lrd = m * rd;
    float3 col = _152.uBackground + ((float3(_152.uGlowColor) * 0.0500000007450580596923828125) * (1.0 - length(p)));
    float glow = 0.0;
    float3 param_2 = lro;
    float3 param_3 = lrd;
    float param_4 = (1.4500000476837158203125 + _152.uThickness) + 0.0500000007450580596923828125;
    float2 b = sphereHit(param_2, param_3, param_4);
    if (b.x < b.y)
    {
        float t = fast::max(b.x, 0.0);
        bool hit = false;
        float2 h = float2(0.0);
        for (int i = 0; i < 80; i++)
        {
            float3 param_5 = lro + (lrd * t);
            h = knot(param_5, _152);
            if (h.x < 0.001000000047497451305389404296875)
            {
                hit = true;
                break;
            }
            float3 at = lro + (lrd * t);
            float slope = (0.449999988079071044921875 * float(_152.uQ)) / (float(_152.uP) * fast::max(length(at.xz), 0.300000011920928955078125));
            float dt = (h.x / sqrt(1.0 + (slope * slope))) * 0.89999997615814208984375;
            glow += ((exp((-h.x) * 9.0) * fast::min(dt, b.y - t)) * 0.60000002384185791015625);
            t += dt;
            if (t > b.y)
            {
                break;
            }
        }
        if (hit)
        {
            float3 pos = lro + (lrd * t);
            float2 e = float2(0.00200000009499490261077880859375, 0.0);
            float3 param_6 = pos + e.xyy;
            float3 param_7 = pos - e.xyy;
            float3 param_8 = pos + e.yxy;
            float3 param_9 = pos - e.yxy;
            float3 param_10 = pos + e.yyx;
            float3 param_11 = pos - e.yyx;
            float3 n = fast::normalize(float3(knot(param_6, _152).x - knot(param_7, _152).x, knot(param_8, _152).x - knot(param_9, _152).x, knot(param_10, _152).x - knot(param_11, _152).x));
            float facing = fast::max(dot(n, -lrd), 0.0);
            float3 film = float3(0.5) + (cos((((float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375) + float3((1.0 - facing) * 1.39999997615814208984375)) + float3(h.y * 2.0)) + float3(_152.iTime * 0.0500000007450580596923828125)) * 6.28318023681640625) * 0.5);
            float3 base = mix(float3(_152.uGlowColor), film, float3(_152.uIridescence));
            float3 l = fast::normalize(m * float3(0.5, 0.699999988079071044921875, 0.60000002384185791015625));
            float diff = fast::max(dot(n, l), 0.0);
            float spec = powr(fast::max(dot(reflect(lrd, n), l), 0.0), 60.0);
            float rim = powr(1.0 - facing, 3.0);
            col = ((base * (0.180000007152557373046875 + (0.75 * diff))) + float3(spec * 0.89999997615814208984375)) + ((mix(float3(_152.uGlowColor), film, float3(0.5)) * rim) * 0.89999997615814208984375);
        }
    }
    col += ((float3(_152.uGlowColor) * glow) * _152.uGlow);
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
    float3 _610;
    if (a > 0.0)
    {
        _610 = bg + (d / float3(a));
    }
    else
    {
        _610 = bg;
    }
    float3 fg = _610;
    float alpha = a + (opacity * (1.0 - a));
    float3 _632;
    if (alpha > 0.0)
    {
        _632 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _632 = bg;
    }
    float3 col = _632;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _152)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _152);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _152.uBackground;
    float param_4 = _152.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_torus_knot_frag_out flair_torus_knot_frag(constant FlairUniforms& _152 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_torus_knot_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _690;
    if (_152.flair_flipY > 0.5)
    {
        _690 = _152.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _690 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _690);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _152);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

