// flair-metal-hash: 2378b311
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
    float3 uFluid;
    float3 uTable;
    packed_float3 uLight;
    float uStrength;
    float uSpikes;
    float uSize;
    float uGloss;
    uint uDemo;
};

struct flair_ferrofluid_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 camRay(thread const float2& frag, thread const float3& ro, constant FlairUniforms& _44)
{
    float2 uv = (frag - (float2(_44.iResolution[0], _44.iResolution[1]) * 0.5)) / float2(_44.iResolution[1u]);
    float3 fw = fast::normalize(float3(0.0, 0.100000001490116119384765625, 0.0) - ro);
    float3 rt = fast::normalize(cross(float3(0.0, 1.0, 0.0), fw));
    float3 up = cross(fw, rt);
    return fast::normalize(((fw * 1.7000000476837158203125) + (rt * uv.x)) + (up * uv.y));
}

static inline __attribute__((always_inline))
float fluidHeight(thread const float2& xz, constant FlairUniforms& _44, thread float2& gCentre, thread float3& gMagnet)
{
    float r = length(xz - gCentre) / _44.uSize;
    if (r > 1.0499999523162841796875)
    {
        return 0.0;
    }
    float inside = 1.0 - smoothstep(0.920000016689300537109375, 1.0499999523162841796875, r);
    float dome = (0.20000000298023223876953125 * _44.uSize) * powr(fast::clamp(1.0 - (r * r), 0.0, 1.0), 0.449999988079071044921875);
    float near = exp((-dot(xz - gMagnet.xy, xz - gMagnet.xy)) / powr(0.4199999868869781494140625 * _44.uSize, 2.0));
    dome += ((((0.07999999821186065673828125 * _44.uSize) * gMagnet.z) * near) * inside);
    float2 hp = (xz * _44.uSpikes) / float2(_44.uSize);
    float2 s = float2(1.0, 1.73199999332427978515625);
    float2 a = mod(hp, s) - (s * 0.5);
    float2 b = mod(hp - (s * 0.5), s) - (s * 0.5);
    float dc = fast::min(length(a), length(b));
    float cone = powr(fast::max(1.0 - (dc / 0.550000011920928955078125), 0.0), 2.2000000476837158203125);
    float tall = (((0.4199999868869781494140625 * _44.uSize) * gMagnet.z) * mix(0.25, 1.0, near)) * (1.0 - smoothstep(0.699999988079071044921875, 1.0, r));
    return dome + (cone * tall);
}

static inline __attribute__((always_inline))
float3 environment(thread const float3& d, constant FlairUniforms& _44)
{
    float3 env = mix(float3(0.02999999932944774627685546875), float3(0.2199999988079071044921875), float3(smoothstep(-0.100000001490116119384765625, 0.699999988079071044921875, d.y)));
    if (d.y < 0.0)
    {
        env = (_44.uTable * 0.550000011920928955078125) * (1.0 - (smoothstep(0.0, -0.60000002384185791015625, d.y) * 0.4000000059604644775390625));
    }
    env += ((float3(_44.uLight) * 2.2000000476837158203125) * smoothstep(0.87999999523162841796875, 0.920000016689300537109375, dot(d, float3(-0.4528391361236572265625, 0.855362832546234130859375, 0.2515772879123687744140625))));
    env += ((float3(_44.uLight) * 1.39999997615814208984375) * smoothstep(0.949999988079071044921875, 0.97500002384185791015625, dot(d, float3(0.70175659656524658203125, 0.551380157470703125, -0.4511292278766632080078125))));
    return env;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _44, thread float2& gCentre, thread float3& gMagnet)
{
    float3 ro = float3(0.0, 1.5499999523162841796875, -2.0);
    float t0 = _44.iTime;
    float2 param = _44.iPointer.xy;
    float3 param_1 = ro;
    float3 pr = camRay(param, param_1, _44);
    float2 pointerXZ = (ro + (pr * ((-ro.y) / fast::min(pr.y, -0.0500000007450580596923828125)))).xz;
    float hov = fast::clamp(_44.iPointer.z, 0.0, 1.0);
    float2 _336;
    if (_44.uDemo != 0u)
    {
        _336 = (float2(cos(t0 * 0.449999988079071044921875), sin(t0 * 0.449999988079071044921875)) * 0.3499999940395355224609375) * _44.uSize;
    }
    else
    {
        _336 = float2(0.0);
    }
    float2 orbit = _336;
    float _358;
    if (_44.uDemo != 0u)
    {
        _358 = 0.550000011920928955078125 + (0.449999988079071044921875 * sin(t0 * 0.89999997615814208984375));
    }
    else
    {
        _358 = 0.699999988079071044921875;
    }
    float idleAmp = _358;
    gMagnet = float3(mix(orbit, fast::clamp(pointerXZ, float2(-1.5), float2(1.5)), float2(hov)), _44.uStrength * mix(idleAmp, 1.0, hov));
    gCentre = mix(float2(0.0), gMagnet.xy, float2(0.2199999988079071044921875 * fast::min(gMagnet.z, 1.0)));
    float2 param_2 = fragCoord;
    float3 param_3 = ro;
    float3 rd = camRay(param_2, param_3, _44);
    float top = 0.75 * _44.uSize;
    float t = (ro.y - top) / fast::max(-rd.y, 0.001000000047497451305389404296875);
    float lastT = t;
    bool hit = false;
    for (int i = 0; i < 140; i++)
    {
        float3 p = ro + (rd * t);
        float2 param_4 = p.xz;
        float dy = p.y - fluidHeight(param_4, _44, gCentre, gMagnet);
        if (dy < 0.0005000000237487256526947021484375)
        {
            hit = true;
            break;
        }
        lastT = t;
        t += fast::max(dy * 0.2800000011920928955078125, 0.00150000001303851604461669921875);
        if (t > 12.0)
        {
            break;
        }
    }
    if (hit)
    {
        float lo = lastT;
        float hi = t;
        for (int i_1 = 0; i_1 < 6; i_1++)
        {
            float m = 0.5 * (lo + hi);
            float3 p_1 = ro + (rd * m);
            float2 param_5 = p_1.xz;
            if ((p_1.y - fluidHeight(param_5, _44, gCentre, gMagnet)) < 0.0)
            {
                hi = m;
            }
            else
            {
                lo = m;
            }
        }
        t = hi;
    }
    float3 p_2 = ro + (rd * t);
    float2 param_6 = p_2.xz;
    float hgt = fluidHeight(param_6, _44, gCentre, gMagnet);
    float3 col;
    if (hit && (hgt > 0.0007999999797903001308441162109375))
    {
        float e = 0.00150000001303851604461669921875;
        float2 param_7 = p_2.xz - float2(e, 0.0);
        float2 param_8 = p_2.xz + float2(e, 0.0);
        float2 param_9 = p_2.xz - float2(0.0, e);
        float2 param_10 = p_2.xz + float2(0.0, e);
        float3 n = fast::normalize(float3(fluidHeight(param_7, _44, gCentre, gMagnet) - fluidHeight(param_8, _44, gCentre, gMagnet), 2.0 * e, fluidHeight(param_9, _44, gCentre, gMagnet) - fluidHeight(param_10, _44, gCentre, gMagnet)));
        float3 v = -rd;
        float fres = 0.039999999105930328369140625 + (0.959999978542327880859375 * powr(1.0 - fast::clamp(dot(n, v), 0.0, 1.0), 5.0));
        float3 refl = reflect(rd, n);
        float3 L = float3(-0.4528391361236572265625, 0.855362832546234130859375, 0.2515772879123687744140625);
        float diff = fast::clamp(dot(n, L), 0.0, 1.0);
        col = _44.uFluid * (0.4000000059604644775390625 + (0.60000002384185791015625 * diff));
        float3 param_11 = refl;
        col += ((environment(param_11, _44) * mix(0.0500000007450580596923828125, 1.0, fres)) * mix(0.3499999940395355224609375, 1.0, _44.uGloss));
        col += (((float3(_44.uLight) * powr(fast::clamp(dot(refl, L), 0.0, 1.0), mix(20.0, 260.0, _44.uGloss))) * 2.0) * _44.uGloss);
    }
    else
    {
        float2 xz = (ro + (rd * ((-ro.y) / fast::min(rd.y, -0.001000000047497451305389404296875)))).xz;
        float r = length((xz - gCentre) - (float2(0.119999997317790985107421875, -0.0599999986588954925537109375) * _44.uSize));
        float shadow = mix(0.449999988079071044921875, 1.0, smoothstep(_44.uSize * 0.949999988079071044921875, _44.uSize * 1.4500000476837158203125, r));
        col = (_44.uTable * shadow) * (1.0 - ((0.180000007152557373046875 * length(xz)) / (1.0 + length(xz))));
    }
    float2 uv = fragCoord / float2(_44.iResolution[0], _44.iResolution[1]);
    col *= (0.85000002384185791015625 + (0.1500000059604644775390625 * powr((((16.0 * uv.x) * uv.y) * (1.0 - uv.x)) * (1.0 - uv.y), 0.25)));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_ferrofluid_frag_out flair_ferrofluid_frag(constant FlairUniforms& _44 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ferrofluid_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float2 gCentre;
    float3 gMagnet;
    float _735;
    if (_44.flair_flipY > 0.5)
    {
        _735 = _44.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _735 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _735);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _44, gCentre, gMagnet);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

