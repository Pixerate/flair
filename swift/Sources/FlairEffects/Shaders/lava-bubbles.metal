// flair-metal-hash: df04593e
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
    float3 uHot;
    float3 uMolten;
    packed_float3 uCrust;
    float uScale;
    float uRate;
    float uSize;
    float uFlow;
    float uGlow;
    float uSpatter;
};

struct flair_lava_bubbles_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float3 heat(thread const float& t, constant FlairUniforms& _217)
{
    float3 c = mix(float3(_217.uCrust), _217.uMolten, float3(smoothstep(0.1500000059604644775390625, 0.550000011920928955078125, t)));
    c = mix(c, _217.uHot, float3(smoothstep(0.550000011920928955078125, 0.89999997615814208984375, t)));
    return mix(c, float3(1.0, 0.980000019073486328125, 0.89999997615814208984375), float3(smoothstep(0.89999997615814208984375, 1.14999997615814208984375, t)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _217)
{
    float2 q = (fragCoord / float2(_217.iResolution[1u])) * _217.uScale;
    float2 drift = (float2(0.0500000007450580596923828125, 0.0199999995529651641845703125) * _217.iTime) * _217.uFlow;
    float2 param = (q * 0.5) + drift;
    int param_1 = 3;
    float _280 = fbm(param, param_1);
    float2 param_2 = ((q * 0.5) - drift) + float2(5.19999980926513671875);
    int param_3 = 3;
    float _290 = fbm(param_2, param_3);
    float2 w = float2(_280, _290);
    float2 param_4 = ((q * 0.89999997615814208984375) + drift) + (w * 1.5);
    int param_5 = 5;
    float _304 = fbm(param_4, param_5);
    float f = _304;
    float2 param_6 = ((q * 1.60000002384185791015625) + w) + (drift * 1.5);
    int param_7 = 4;
    float _317 = fbm(param_6, param_7);
    float crack = 1.0 - smoothstep(0.0, 0.0500000007450580596923828125, abs(_317 - 0.5));
    float T = (0.119999997317790985107421875 + (0.550000011920928955078125 * (1.0 - smoothstep(0.3499999940395355224609375, 0.62000000476837158203125, f)))) + ((0.4000000059604644775390625 * crack) * smoothstep(0.64999997615814208984375, 0.4000000059604644775390625, f));
    T += (0.0599999986588954925537109375 * sin((_217.iTime * 1.7000000476837158203125) + (f * 12.0)));
    float spec = 0.0;
    float2 g0 = floor(q);
    for (int j = -2; j <= 2; j++)
    {
        for (int i = -2; i <= 2; i++)
        {
            float2 g = g0 + float2(float(i), float(j));
            float2 param_8 = g + float2(31.700000762939453125);
            float2 h = hash22(param_8);
            float2 param_9 = (g * 1.7000000476837158203125) + float2(4.19999980926513671875);
            float period = (0.60000002384185791015625 + (0.800000011920928955078125 * hash12(param_9))) / _217.uRate;
            float tt = (_217.iTime / period) + (h.x * 5.0);
            float cyc = floor(tt);
            float ph = fract(tt);
            float2 param_10 = (g + float2(cyc * 1.2999999523162841796875)) + float2(8.80000019073486328125);
            if (hash12(param_10) > 0.550000011920928955078125)
            {
                continue;
            }
            float2 param_11 = g + float2(cyc * 13.1000003814697265625);
            float2 c = (g + float2(0.25)) + (hash22(param_11) * 0.5);
            float2 param_12 = g + float2(cyc * 3.099999904632568359375);
            float R = (_217.uSize * 0.5) * (0.5 + (0.5 * hash12(param_12)));
            float2 d = q - c;
            float dl = length(d);
            if (dl > 2.599999904632568359375)
            {
                continue;
            }
            if (ph < 0.75)
            {
                float s = ph / 0.75;
                float r = R * powr(s, 0.60000002384185791015625);
                if (dl < r)
                {
                    float u = dl / r;
                    float z = sqrt(1.0 - (u * u));
                    float m = smoothstep(1.0, 0.85000002384185791015625, u);
                    float2 param_13 = ((d / float2(r)) * 3.0) + float2(cyc * 7.0);
                    float skin = (0.2800000011920928955078125 + (((0.4199999868869781494140625 * s) * z) * z)) + (0.119999997317790985107421875 * vnoise(param_13));
                    T = mix(T, fast::max(T * 0.699999988079071044921875, skin), m);
                    float3 n = float3(d / float2(r), z);
                    spec = fast::max(spec, ((powr(fast::max(dot(n, float3(-0.3903600275516510009765625, 0.487950026988983154296875, 0.780720055103302001953125)), 0.0), 24.0) * s) * m) * 0.699999988079071044921875);
                }
                else
                {
                    float x = (dl - r) / ((0.07999999821186065673828125 * R) + 0.0199999995529651641845703125);
                    T *= (1.0 - ((0.3499999940395355224609375 * s) * exp((-x) * x)));
                }
            }
            else
            {
                float b = (ph - 0.75) / 0.25;
                float rc = R * (1.0 + (0.25 * b));
                if (dl < rc)
                {
                    float u_1 = dl / rc;
                    T = fast::max(T, mix(1.10000002384185791015625, 0.449999988079071044921875, b) * (1.0 - ((0.3499999940395355224609375 * u_1) * u_1)));
                }
                float x_1 = (dl - (rc * (1.0 + (b * 1.2000000476837158203125)))) / 0.0599999986588954925537109375;
                T += ((0.25 * exp((-x_1) * x_1)) * (1.0 - b));
                for (int k = 0; k < 8; k++)
                {
                    if (_217.uSpatter <= 0.0)
                    {
                        break;
                    }
                    float2 param_14 = float2(float(k), cyc) + (g * 3.2999999523162841796875);
                    float2 hk = hash22(param_14);
                    float ang = ((float(k) + hk.x) / 8.0) * 6.28318023681640625;
                    float dist = fast::min(rc + (((b * R) * (1.2000000476837158203125 + (1.60000002384185791015625 * hk.y))) * _217.uSpatter), 2.2000000476837158203125);
                    float alt = sin(3.141590118408203125 * b);
                    float2 pos = c + (float2(cos(ang), sin(ang)) * dist);
                    float sz = ((R * 0.0900000035762786865234375) * (0.60000002384185791015625 + hk.y)) * (0.60000002384185791015625 + (0.800000011920928955078125 * alt));
                    float drop = 1.0 - smoothstep(sz * 0.5, sz, length(q - pos));
                    T = mix(T, fast::max(T, 1.0 - (0.449999988079071044921875 * b)), drop);
                }
            }
        }
    }
    float param_15 = T;
    float3 col = heat(param_15, _217);
    col += (((_217.uMolten * _217.uGlow) * 0.3499999940395355224609375) * smoothstep(0.4000000059604644775390625, 1.0, T));
    col *= (0.699999988079071044921875 + (0.300000011920928955078125 * _217.uGlow));
    col += (float3(1.0, 0.89999997615814208984375, 0.699999988079071044921875) * (spec * 0.5));
    fragColor = float4(col, 1.0);
}

fragment flair_lava_bubbles_frag_out flair_lava_bubbles_frag(constant FlairUniforms& _217 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_lava_bubbles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _789;
    if (_217.flair_flipY > 0.5)
    {
        _789 = _217.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _789 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _789);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _217);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

