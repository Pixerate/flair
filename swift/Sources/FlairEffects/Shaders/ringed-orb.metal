// flair-metal-hash: dbbab7b2
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
    float3 uOrb;
    float3 uRim;
    float3 uRing;
    float3 uAccent;
    packed_float3 uDisk;
    float uDiskAlpha;
    float uSize;
    int uTicks;
    float uSpeed;
    float uSweep;
    float uGlow;
    char _m24_pad[12];
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_ringed_orb_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _98)
{
    float4 base = float4(float3(_98.uBackground) * _98.uBackgroundAlpha, _98.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _98)
{
    float px = 1.0 / _98.iResolution[1u];
    float2 p = (fragCoord - (float2(_98.iResolution[0], _98.iResolution[1]) * 0.5)) * px;
    float W = 0.5 * _98.uSize;
    float r = length(p);
    float turn = (precise::atan2(p.y, p.x) / 6.28318023681640625) + 0.5;
    float4 acc = float4(0.0);
    float3 light = float3(0.0);
    float disk = smoothstep(W, W - (1.5 * px), r);
    float4 param = acc;
    float3 param_1 = float3(_98.uDisk);
    float param_2 = (disk * _98.uDiskAlpha) * (0.550000011920928955078125 + (0.449999988079071044921875 * smoothstep(W * 0.20000000298023223876953125, W, r)));
    acc = over(param, param_1, param_2);
    float edge = exp((-abs(r - W)) / ((1.2000000476837158203125 * px) + (W * 0.006000000052154064178466796875)));
    float behind = fract(turn - ((_98.iTime * _98.uSweep) * 0.119999997317790985107421875));
    float sweep = powr(behind, 5.0) * smoothstep(1.0, 0.959999978542327880859375, behind);
    light += (((mix(_98.uRing, _98.uAccent, float3(0.5)) * edge) * (0.119999997317790985107421875 + (0.89999997615814208984375 * sweep))) * _98.uDiskAlpha);
    light += (((_98.uRing * 0.119999997317790985107421875) * _98.uGlow) * exp((-abs(r - (W * 0.62000000476837158203125))) / (W * 0.0900000035762786865234375)));
    float _404;
    float d;
    for (int layer = 0; layer < 2; layer++)
    {
        float fl = float(layer);
        float spin = (_98.iTime * _98.uSpeed) * ((layer == 0) ? 0.0350000001490116119384765625 : (-0.02300000004470348358154296875));
        float n = float(_98.uTicks) * ((layer == 0) ? 1.0 : 0.60000002384185791015625);
        float a = (turn + spin) * n;
        float cell = floor(a);
        float2 param_3 = float2(cell, 3.099999904632568359375 + (fl * 17.0));
        float h1 = hash12(param_3);
        float2 param_4 = float2(cell + 41.0, 7.69999980926513671875 + fl);
        float h2 = hash12(param_4);
        float2 param_5 = float2(cell + 83.0, 1.2999999523162841796875 + (fl * 5.0));
        float h3 = hash12(param_5);
        float2 param_6 = float2(cell + 127.0, 9.3999996185302734375 + (fl * 3.0));
        float h4 = hash12(param_6);
        float along = (((fract(a) - 0.5) / n) * 6.28318023681640625) * r;
        if (layer == 0)
        {
            _404 = 0.540000021457672119140625 + (0.14000000059604644775390625 * h1);
        }
        else
        {
            _404 = 0.5 + (0.2599999904632568359375 * h1);
        }
        float rc = W * _404;
        if (layer == 0)
        {
            float len = W * (0.014999999664723873138427734375 + ((0.070000000298023223876953125 * h2) * h2));
            d = fast::max(abs(along) - ((0.60000002384185791015625 * px) + (W * 0.0035000001080334186553955078125)), abs(r - rc) - len);
        }
        else
        {
            d = length(float2(along, r - rc)) - ((0.60000002384185791015625 * px) + (W * (0.0040000001899898052215576171875 + (0.007000000216066837310791015625 * h2))));
        }
        float cover = fast::clamp(0.5 - (d / px), 0.0, 1.0);
        float bright = (0.3499999940395355224609375 + (0.64999997615814208984375 * h3)) * (0.699999988079071044921875 + (0.300000011920928955078125 * sin((_98.iTime * (1.0 + (2.0 * h4))) + (h3 * 6.28318023681640625))));
        float3 c = mix(_98.uRing, _98.uAccent, float3(step(0.87999999523162841796875, h4)));
        float4 param_7 = acc;
        float3 param_8 = c;
        float param_9 = cover * bright;
        acc = over(param_7, param_8, param_9);
        light += ((((c * bright) * 0.3499999940395355224609375) * _98.uGlow) * exp((-fast::max(d, 0.0)) / (W * 0.01200000010430812835693359375)));
    }
    float R = (W * 0.36000001430511474609375) * (1.0 + (0.01200000010430812835693359375 * sin(_98.iTime * 1.2999999523162841796875)));
    float s = smoothstep(R, R - (1.5 * px), r);
    float2 q = p / float2(R);
    float z = sqrt(fast::max(0.0, 1.0 - dot(q, q)));
    float3 nrm = float3(q, z);
    float3 L = float3(-0.4511292278766632080078125, 0.551380157470703125, 0.70175659656524658203125);
    float diff = fast::max(dot(nrm, L), 0.0);
    float spec = powr(fast::max(dot(reflect(-L, nrm), float3(0.0, 0.0, 1.0)), 0.0), 36.0);
    float fres = powr(1.0 - z, 2.5);
    float3 orb = ((_98.uOrb * (0.2199999988079071044921875 + (0.85000002384185791015625 * diff))) + ((_98.uRim * fres) * 0.89999997615814208984375)) + float3(spec * 0.89999997615814208984375);
    orb += ((_98.uAccent * 0.180000007152557373046875) * powr(fast::max(dot(nrm, float3(0.54799664020538330078125, -0.712395608425140380859375, 0.43839728832244873046875)), 0.0), 3.0));
    float4 param_10 = acc;
    float3 param_11 = orb;
    float param_12 = s;
    acc = over(param_10, param_11, param_12);
    light += ((((_98.uRim * 0.550000011920928955078125) * _98.uGlow) * exp((-fast::max(r - R, 0.0)) / (R * 0.2199999988079071044921875))) * (1.0 - s));
    light = float3(1.0) - exp(-light);
    float la = fast::max(light.x, fast::max(light.y, light.z));
    acc = float4(acc.xyz + (light * (1.0 - acc.w)), acc.w + (la * (1.0 - acc.w)));
    float4 param_13 = acc;
    fragColor = finish(param_13, _98);
}

fragment flair_ringed_orb_frag_out flair_ringed_orb_frag(constant FlairUniforms& _98 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ringed_orb_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _710;
    if (_98.flair_flipY > 0.5)
    {
        _710 = _98.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _710 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _710);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _98);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

