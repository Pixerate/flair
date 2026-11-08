// flair-metal-hash: 603f5eb9
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
    float3 uColorA;
    packed_float3 uColorB;
    int uCount;
    float uMerge;
    float uSpeed;
    float uReflection;
    float uSize;
    float uBackgroundAlpha;
};

struct flair_metaballs_3d_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float3 ballAt(thread const int& i, constant FlairUniforms& _112)
{
    float fi = float(i);
    float t = (_112.iTime * _112.uSpeed) * 0.5;
    return float3(sin((t * (0.699999988079071044921875 + (0.12999999523162841796875 * fi))) + (fi * 1.7000000476837158203125)) * 1.10000002384185791015625, cos((t * (0.89999997615814208984375 + (0.10999999940395355224609375 * fi))) + (fi * 2.2999999523162841796875)) * 0.699999988079071044921875, sin((t * (0.5 + (0.070000000298023223876953125 * fi))) + (fi * 0.89999997615814208984375)) * 0.60000002384185791015625) * _112.uSize;
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::max(k - abs(a - b), 0.0) / k;
    return fast::min(a, b) - (((h * h) * k) * 0.25);
}

static inline __attribute__((always_inline))
float scene(thread const float3& p, constant FlairUniforms& _112)
{
    float d = 1000000000.0;
    for (int i = 0; i < 8; i++)
    {
        if (i >= _112.uCount)
        {
            break;
        }
        float r = (0.4199999868869781494140625 + (0.119999997317790985107421875 * sin(float(i) * 3.099999904632568359375))) * _112.uSize;
        int param = i;
        float param_1 = d;
        float param_2 = length(p - ballAt(param, _112)) - r;
        float param_3 = _112.uMerge;
        d = smin(param_1, param_2, param_3);
    }
    return d;
}

static inline __attribute__((always_inline))
float3 normalAt(thread const float3& p, constant FlairUniforms& _112)
{
    float2 e = float2(0.00200000009499490261077880859375, -0.00200000009499490261077880859375);
    float3 param = p + e.xyy;
    float3 param_1 = p + e.yyx;
    float3 param_2 = p + e.yxy;
    float3 param_3 = p + e.xxx;
    return fast::normalize((((e.xyy * scene(param, _112)) + (e.yyx * scene(param_1, _112))) + (e.yxy * scene(param_2, _112))) + (e.xxx * scene(param_3, _112)));
}

static inline __attribute__((always_inline))
float3 env(thread const float3& r, constant FlairUniforms& _112)
{
    float3 c = mix(_112.uBackground * 0.60000002384185791015625, (_112.uBackground * 2.0) + float3(0.07999999821186065673828125), float3(smoothstep(-0.4000000059604644775390625, 0.60000002384185791015625, r.y)));
    c += (float3(2.2000000476837158203125) * smoothstep(0.819999992847442626953125, 0.89999997615814208984375, r.y));
    float a = precise::atan2(r.x, r.z);
    c += (((float3(1.39999997615814208984375, 1.2999999523162841796875, 1.2000000476837158203125) * smoothstep(0.0599999986588954925537109375, 0.0, abs(a - 1.89999997615814208984375))) * smoothstep(-0.4000000059604644775390625, 0.0, r.y)) * smoothstep(0.699999988079071044921875, 0.300000011920928955078125, r.y));
    c += (((float3(0.89999997615814208984375, 1.10000002384185791015625, 1.39999997615814208984375) * smoothstep(0.0500000007450580596923828125, 0.0, abs(a + 2.2000000476837158203125))) * smoothstep(-0.300000011920928955078125, 0.100000001490116119384765625, r.y)) * smoothstep(0.60000002384185791015625, 0.20000000298023223876953125, r.y));
    return c;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _112)
{
    float2 p = (fragCoord - (float2(_112.iResolution[0], _112.iResolution[1]) * 0.5)) / float2(_112.iResolution[1u]);
    float3 ro = float3(0.0, 0.0, 4.19999980926513671875);
    float3 rd = fast::normalize(float3(p, -1.60000002384185791015625));
    float3 col = _112.uBackground * (1.2000000476837158203125 - (0.60000002384185791015625 * length(p)));
    float3 param = ro;
    float3 param_1 = rd;
    float param_2 = 2.2999999523162841796875 * _112.uSize;
    float2 b = sphereHit(param, param_1, param_2);
    if (b.x < b.y)
    {
        float t = fast::max(b.x, 0.0);
        bool hit = false;
        for (int i = 0; i < 56; i++)
        {
            float3 param_3 = ro + (rd * t);
            float d = scene(param_3, _112);
            if (d < 0.001000000047497451305389404296875)
            {
                hit = true;
                break;
            }
            t += d;
            if (t > b.y)
            {
                break;
            }
        }
        if (hit)
        {
            float3 pos = ro + (rd * t);
            float3 param_4 = pos;
            float3 n = normalAt(param_4, _112);
            float fres = powr(1.0 - fast::max(dot(n, -rd), 0.0), 4.0);
            float3 base = mix(_112.uColorA, float3(_112.uColorB), float3(smoothstep(-0.60000002384185791015625, 0.60000002384185791015625, ((n.x * 0.699999988079071044921875) + (n.y * 0.5)) + (0.20000000298023223876953125 * sin(_112.iTime * 0.300000011920928955078125)))));
            float3 l = float3(0.3713906705379486083984375, 0.742781341075897216796875, 0.55708599090576171875);
            float diff = fast::max(dot(n, l), 0.0);
            float3 param_5 = reflect(rd, n);
            float3 refl = env(param_5, _112);
            col = ((base * (0.1500000059604644775390625 + (0.60000002384185791015625 * diff))) + ((refl * mix(0.07999999821186065673828125, 0.89999997615814208984375, _112.uReflection)) * mix(0.3499999940395355224609375, 1.0, fres))) + ((base * fres) * 0.300000011920928955078125);
            col += float3(powr(fast::max(dot(reflect(rd, n), l), 0.0), 80.0) * 1.2000000476837158203125);
        }
    }
    fragColor = float4(col / (float3(1.0) + (col * 0.1500000059604644775390625)), 1.0);
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
    float3 _614;
    if (a > 0.0)
    {
        _614 = bg + (d / float3(a));
    }
    else
    {
        _614 = bg;
    }
    float3 fg = _614;
    float alpha = a + (opacity * (1.0 - a));
    float3 _636;
    if (alpha > 0.0)
    {
        _636 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _636 = bg;
    }
    float3 col = _636;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _112)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _112);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _112.uBackground;
    float param_4 = _112.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_metaballs_3d_frag_out flair_metaballs_3d_frag(constant FlairUniforms& _112 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_metaballs_3d_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _694;
    if (_112.flair_flipY > 0.5)
    {
        _694 = _112.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _694 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _694);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _112);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

