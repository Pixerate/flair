// flair-metal-hash: 05b1d0ac
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
    float3 uLiquid;
    packed_float3 uBackground;
    float uHeight;
    int uPoints;
    float uGloss;
    float uBackgroundAlpha;
};

struct flair_splash_crown_frag_out
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
float crownTop(thread const float& theta, thread const float& h, constant FlairUniforms& _168)
{
    float n = float(_168.uPoints);
    float f = (theta / 6.28318023681640625) * n;
    float id = floor(f);
    float w = abs(fract(f) - 0.5) * 2.0;
    float2 param = float2(mod(id, n), 2.2999999523162841796875);
    float tall = 0.60000002384185791015625 + (0.4000000059604644775390625 * hash12(param));
    return h * (0.680000007152557373046875 + ((0.5 * tall) * powr(1.0 - w, 3.0)));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float3 bead(thread const float3& col, thread const float2& p, thread const float2& c, thread const float& r, thread const float& px, constant FlairUniforms& _168)
{
    float2 d = (p - c) / float2(r);
    float m = fast::clamp(0.5 - (((length(d) - 1.0) * r) / px), 0.0, 1.0);
    if (m <= 0.0)
    {
        return col;
    }
    float3 n = float3(d, sqrt(fast::max(1.0 - dot(d, d), 0.0)));
    float3 b = _168.uLiquid * (0.550000011920928955078125 + (0.449999988079071044921875 * fast::max(dot(n, float3(-0.3980148732662200927734375, 0.5970222949981689453125, 0.696526050567626953125)), 0.0)));
    b += float3(_168.uGloss * powr(fast::max(dot(n, float3(-0.298752725124359130859375, 0.4267896115779876708984375, 0.853579223155975341796875)), 0.0), 40.0));
    b = mix(b, (float3(_168.uBackground) * 0.60000002384185791015625) + (_168.uLiquid * 0.300000011920928955078125), float3(smoothstep(0.75, 1.0, length(d)) * 0.4000000059604644775390625));
    return mix(col, fast::min(b, float3(1.0)), float3(m));
}

static inline __attribute__((always_inline))
float3 droplets(thread float3& col, thread const float2& p, thread const float& tau, thread const float& rc, thread const float& h, thread const bool& back, thread const float& px, constant FlairUniforms& _168)
{
    float n = float(_168.uPoints);
    for (int i = 0; i < 24; i++)
    {
        if (i >= _168.uPoints)
        {
            break;
        }
        float th = ((float(i) + 0.5) / n) * 6.28318023681640625;
        float s = sin(th);
        if ((s > 0.0) != back)
        {
            continue;
        }
        float2 param = float2(float(i) + 0.5, 7.099999904632568359375);
        float2 hh = hash22(param);
        float param_1 = th;
        float param_2 = h;
        float top = crownTop(param_1, param_2, _168);
        float r = 0.007000000216066837310791015625 + (0.008000000379979610443115234375 * hh.x);
        float lift = smoothstep(0.07999999821186065673828125, 0.3499999940395355224609375, tau);
        float rTip = rc + (0.3499999940395355224609375 * top);
        float2 c = float2(rTip * cos(th), (((-0.20000000298023223876953125) + ((0.300000011920928955078125 * rTip) * s)) + top) + (r * lift));
        float td = fast::max(tau - (0.3499999940395355224609375 + (0.1500000059604644775390625 * hh.y)), 0.0);
        float2 v = float2(cos(th) * 0.180000007152557373046875, (((0.300000011920928955078125 * s) * 0.180000007152557373046875) + 0.3499999940395355224609375) + (0.20000000298023223876953125 * hh.y)) * _168.uHeight;
        c += ((v * td) - float2(0.0, (1.60000002384185791015625 * td) * td));
        if (c.y < (((-0.20000000298023223876953125) + ((0.300000011920928955078125 * rTip) * s)) - 0.00999999977648258209228515625))
        {
            continue;
        }
        float3 param_3 = col;
        float2 param_4 = p;
        float2 param_5 = c;
        float param_6 = (r * lift) * (1.0 + (0.4000000059604644775390625 * smoothstep(0.0, 0.20000000298023223876953125, td)));
        float param_7 = px;
        col = bead(param_3, param_4, param_5, param_6, param_7, _168);
    }
    return col;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _168)
{
    float2 p = (fragCoord - (float2(_168.iResolution[0], _168.iResolution[1]) * 0.5)) / float2(_168.iResolution[1u]);
    float px = 1.0 / _168.iResolution[1u];
    float t = mod(_168.iTime, 3.0);
    float horizon = 0.039999999105930328369140625;
    float3 col = float3(_168.uBackground) * (0.75 + (0.60000002384185791015625 * fast::clamp(p.y + 0.20000000298023223876953125, 0.0, 1.0)));
    float fres = smoothstep(horizon - 0.300000011920928955078125, horizon, p.y);
    float3 pool = mix(_168.uLiquid * (0.7799999713897705078125 + (0.180000007152557373046875 * smoothstep(-0.5, -0.20000000298023223876953125, p.y))), (float3(_168.uBackground) * 0.89999997615814208984375) + (_168.uLiquid * 0.1500000059604644775390625), float3(fres * 0.550000011920928955078125));
    col = mix(col, pool, float3(smoothstep(horizon + px, horizon - (2.0 * px), p.y)));
    float tau = t - 0.60000002384185791015625;
    if (tau > 0.0)
    {
        for (int j = 0; j < 3; j++)
        {
            float rr = 0.0900000035762786865234375 + ((tau - (0.2199999988079071044921875 * float(j))) * 0.300000011920928955078125);
            if (rr < 0.0900000035762786865234375)
            {
                continue;
            }
            float de = length(float2(p.x, (p.y - (-0.20000000298023223876953125)) / 0.300000011920928955078125)) - rr;
            float k = ((1.0 - smoothstep(0.4000000059604644775390625, 2.2000000476837158203125, tau)) * (1.0 - (0.25 * float(j)))) * step(p.y, horizon);
            col += float3((0.2199999988079071044921875 * exp(((-de) * de) / 7.999999797903001308441162109375e-05)) * k);
            col -= (((_168.uLiquid * 0.119999997317790985107421875) * exp(((-(de + 0.017999999225139617919921875)) * (de + 0.017999999225139617919921875)) / 0.00011999999696854501962661743164062)) * k);
        }
    }
    float u = tau / 1.14999997615814208984375;
    if ((u > 0.0) && (u < 1.0))
    {
        float h = (0.20000000298023223876953125 * _168.uHeight) * sin(3.141590118408203125 * powr(u, 0.60000002384185791015625));
        float rc = 0.0599999986588954925537109375 + (0.100000001490116119384765625 * (1.0 - exp((-tau) * 5.0)));
        float inside = length(float2(p.x, (p.y - (-0.20000000298023223876953125)) / 0.300000011920928955078125)) / rc;
        col = mix(col, col * 0.7799999713897705078125, float3(smoothstep(1.019999980926513671875, 0.949999988079071044921875, inside) * smoothstep(0.0, 0.100000001490116119384765625, h)));
        float r = rc + (0.3499999940395355224609375 * fast::max(p.y - (-0.20000000298023223876953125), 0.0));
        float c = p.x / r;
        if (abs(c) < 1.0)
        {
            float s = sqrt(1.0 - (c * c));
            float zb = p.y - ((-0.20000000298023223876953125) + ((0.300000011920928955078125 * r) * s));
            float param = precise::atan2(s, c);
            float param_1 = h;
            float topb = crownTop(param, param_1, _168);
            float mb = fast::clamp((zb / px) + 0.5, 0.0, 1.0) * fast::clamp(((topb - zb) / px) + 0.5, 0.0, 1.0);
            float3 wallB = _168.uLiquid * ((0.60000002384185791015625 + (0.25 * (1.0 - s))) + (0.1500000059604644775390625 * smoothstep(0.0, topb, zb)));
            col = mix(col, wallB, float3(mb));
            float3 param_2 = col;
            float2 param_3 = p;
            float param_4 = tau;
            float param_5 = rc;
            float param_6 = h;
            bool param_7 = true;
            float param_8 = px;
            float3 _749 = droplets(param_2, param_3, param_4, param_5, param_6, param_7, param_8, _168);
            col = _749;
            float zf = p.y - ((-0.20000000298023223876953125) - ((0.300000011920928955078125 * r) * s));
            float param_9 = 6.28318023681640625 - precise::atan2(s, c);
            float param_10 = h;
            float topf = crownTop(param_9, param_10, _168);
            float mf = fast::clamp((zf / px) + 0.5, 0.0, 1.0) * fast::clamp(((topf - zf) / px) + 0.5, 0.0, 1.0);
            float3 wallF = (_168.uLiquid * (0.5 + (0.5 * s))) * (0.85000002384185791015625 + (0.1500000059604644775390625 * smoothstep(0.0, 0.0500000007450580596923828125, zf)));
            wallF += float3(0.119999997317790985107421875 * smoothstep(topf - 0.02999999932944774627685546875, topf, zf));
            wallF += float3(((_168.uGloss * 0.699999988079071044921875) * exp(((-(c + 0.449999988079071044921875)) * (c + 0.449999988079071044921875)) / 0.00999999977648258209228515625)) * smoothstep(0.0, 0.039999999105930328369140625, zf));
            col = mix(col, fast::min(wallF, float3(1.0)), float3(mf));
        }
        else
        {
            float3 param_11 = col;
            float2 param_12 = p;
            float param_13 = tau;
            float param_14 = rc;
            float param_15 = h;
            bool param_16 = true;
            float param_17 = px;
            float3 _845 = droplets(param_11, param_12, param_13, param_14, param_15, param_16, param_17, _168);
            col = _845;
        }
        float3 param_18 = col;
        float2 param_19 = p;
        float param_20 = tau;
        float param_21 = rc;
        float param_22 = h;
        bool param_23 = false;
        float param_24 = px;
        float3 _860 = droplets(param_18, param_19, param_20, param_21, param_22, param_23, param_24, _168);
        col = _860;
    }
    if (t < 0.60000002384185791015625)
    {
        float y = mix(0.62000000476837158203125, -0.180000007152557373046875, (t / 0.60000002384185791015625) * (t / 0.60000002384185791015625));
        float2 q = (p - float2(0.0, y)) * float2(1.0, 0.800000011920928955078125);
        float3 param_25 = col;
        float2 param_26 = float2(0.0, y) + q;
        float2 param_27 = float2(0.0, y);
        float param_28 = 0.026000000536441802978515625;
        float param_29 = px;
        col = bead(param_25, param_26, param_27, param_28, param_29, _168);
    }
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
    float3 _946;
    if (a > 0.0)
    {
        _946 = bg + (d / float3(a));
    }
    else
    {
        _946 = bg;
    }
    float3 fg = _946;
    float alpha = a + (opacity * (1.0 - a));
    float3 _968;
    if (alpha > 0.0)
    {
        _968 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _968 = bg;
    }
    float3 col = _968;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _168)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _168);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = float3(_168.uBackground);
    float param_4 = _168.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_splash_crown_frag_out flair_splash_crown_frag(constant FlairUniforms& _168 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_splash_crown_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1026;
    if (_168.flair_flipY > 0.5)
    {
        _1026 = _168.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1026 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1026);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _168);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

