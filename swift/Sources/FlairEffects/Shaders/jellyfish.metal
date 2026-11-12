// flair-metal-hash: 660f7e5c
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
    float3 uDeep;
    float3 uShallow;
    float3 uGlow;
    packed_float3 uAccent;
    int uCount;
    float uSize;
    float uSpeed;
    float uTentacles;
    float uLuminance;
};

struct flair_jellyfish_frag_out
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
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _177)
{
    float2 uv = fragCoord / float2(_177.iResolution[0], _177.iResolution[1]);
    float2 p = fragCoord / float2(_177.iResolution[1u]);
    float aspect = _177.iResolution[0u] / _177.iResolution[1u];
    float px = 1.0 / _177.iResolution[1u];
    float t = _177.iTime * _177.uSpeed;
    float3 col = mix(_177.uDeep, _177.uShallow, float3(powr(uv.y, 1.39999997615814208984375)));
    float2 param = float2((p.x + (p.y * 0.3499999940395355224609375)) * 7.0, _177.iTime * 0.07999999821186065673828125);
    float2 param_1 = float2((p.x + (p.y * 0.300000011920928955078125)) * 13.0, (_177.iTime * 0.0500000007450580596923828125) + 4.0);
    float shafts = vnoise(param) * vnoise(param_1);
    col += (((_177.uShallow * shafts) * smoothstep(0.20000000298023223876953125, 1.0, uv.y)) * 0.89999997615814208984375);
    float2 sp = (p * 24.0) + float2(0.0, _177.iTime * 0.25);
    float2 sc = floor(sp);
    float2 param_2 = sc;
    float2 sh = hash22(param_2);
    float2 param_3 = sc + float2(3.7000000476837158203125);
    float snow = smoothstep(0.07999999821186065673828125, 0.0, length(fract(sp) - sh)) * step(0.819999992847442626953125, hash12(param_3));
    col += ((float3(0.5, 0.60000002384185791015625, 0.699999988079071044921875) * snow) * 0.3499999940395355224609375);
    float3 light = float3(0.0);
    for (int i = 0; i < 6; i++)
    {
        if (i >= _177.uCount)
        {
            break;
        }
        float fi = float(i);
        float2 param_4 = float2((fi * 3.1700000762939453125) + 1.0, 7.30000019073486328125);
        float2 seed = hash22(param_4);
        float depth = 0.60000002384185791015625 + (0.4000000059604644775390625 * seed.y);
        float size = _177.uSize * depth;
        float period = 1.60000002384185791015625 + (seed.x * 0.89999997615814208984375);
        float tau = (t / period) + (seed.y * 5.0);
        float f = fract(tau);
        float contract = smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.25, 1.0, f));
        float rise = ((floor(tau) + smoothstep(0.0, 0.449999988079071044921875, f)) * size) * 0.449999988079071044921875;
        float span = 1.0 + (size * (2.0 + (6.0 * _177.uTentacles)));
        float y = mod((seed.x * span) + rise, span) - ((size * 6.0) * _177.uTentacles);
        float2 centre = float2(((0.100000001490116119384765625 + (0.800000011920928955078125 * fract((seed.x * 1.7000000476837158203125) + (fi * 0.37000000476837158203125)))) * aspect) + (0.039999999105930328369140625 * sin((t * 0.300000011920928955078125) + fi)), y);
        float tilt = 0.25 * sin((t * 0.20000000298023223876953125) + (fi * 2.0));
        float param_5 = tilt;
        float2 q = (rot(param_5) * (p - centre)) / float2(size);
        float lpx = px / size;
        float bright = _177.uLuminance * depth;
        float bw = 1.0 - (0.20000000298023223876953125 * contract);
        float bh = 0.85000002384185791015625 + (0.1500000059604644775390625 * contract);
        float2 bq = float2(q.x / bw, q.y / bh);
        float e = length(bq);
        float under = (0.25 * (1.0 - (bq.x * bq.x))) + (0.039999999105930328369140625 * sin(bq.x * 18.0));
        float bell = (1.0 - smoothstep(1.0 - (lpx * 2.0), 1.0, e)) * smoothstep(under - 0.0500000007450580596923828125, under + 0.0199999995529651641845703125, bq.y);
        float fresnel = powr(fast::clamp(e, 0.0, 1.0), 5.0);
        float3 bellCol = mix(_177.uGlow * 0.3499999940395355224609375, _177.uGlow, float3(fresnel));
        col = mix(col, bellCol * (0.60000002384185791015625 + (0.60000002384185791015625 * bright)), float3((bell * (0.180000007152557373046875 + (0.550000011920928955078125 * fresnel))) * depth));
        float2 gq = float2(q.x, (q.y - 0.4000000059604644775390625) * 1.7000000476837158203125);
        float petals = length(gq) - (0.20000000298023223876953125 * (0.699999988079071044921875 + (0.300000011920928955078125 * cos((4.0 * precise::atan2(gq.y, gq.x)) + 0.785000026226043701171875))));
        float gonad = exp((-abs(petals)) / 0.02500000037252902984619140625) * bell;
        float canals = (exp((-abs(sin(precise::atan2(q.x, q.y - (under * 0.5)) * 8.0))) * 6.0) * bell) * smoothstep(0.300000011920928955078125, 0.949999988079071044921875, e);
        light += (((_177.uGlow * canals) * 0.119999997317790985107421875) * bright);
        light += (((float3(_177.uAccent) * gonad) * 0.5) * bright);
        float rim = (exp((-abs(bq.y - under)) / 0.039999999105930328369140625) * step(abs(bq.x), 1.0)) * (0.60000002384185791015625 + (0.4000000059604644775390625 * sin((bq.x * 18.0) + (_177.iTime * 3.0))));
        light += (((_177.uGlow * rim) * 0.449999988079071044921875) * bright);
        float down = (under * bw) - q.y;
        if (down > (-0.100000001490116119384765625))
        {
            for (int k = 0; k < 8; k++)
            {
                float fk = float(k);
                float2 param_6 = float2(fi, fk);
                float len = (_177.uTentacles * 4.5) * (0.60000002384185791015625 + (0.4000000059604644775390625 * hash12(param_6)));
                float x0 = mix(-0.85000002384185791015625, 0.85000002384185791015625, fk / 7.0) * bw;
                float xo = (x0 * (1.0 + (0.119999997317790985107421875 * down))) + ((sin((((down * 2.599999904632568359375) - (t * 3.0)) + (fk * 1.2999999523162841796875)) + fi) * 0.180000007152557373046875) * down);
                float fade = 1.0 - smoothstep(0.0, len, down);
                float line = (exp((-abs(q.x - xo)) / (0.02500000037252902984619140625 + lpx)) * fade) * step(0.0, down);
                light += (((_177.uGlow * line) * 0.4000000059604644775390625) * bright);
            }
            for (int k_1 = 0; k_1 < 2; k_1++)
            {
                float fk_1 = (float(k_1) * 2.0) - 1.0;
                float xo_1 = (fk_1 * 0.119999997317790985107421875) + ((sin(((down * 2.0) - (t * 2.400000095367431640625)) + fk_1) * 0.100000001490116119384765625) * down);
                float wdt = 0.070000000298023223876953125 + (0.02999999932944774627685546875 * sin((down * 18.0) + (fk_1 * 3.0)));
                float arm = ((1.0 - smoothstep(wdt - (lpx * 2.0), wdt, abs(q.x - xo_1))) * (1.0 - smoothstep(0.0, _177.uTentacles * 2.2000000476837158203125, down))) * step(0.0, down);
                col = mix(col, mix(float3(_177.uAccent), _177.uGlow, float3(0.4000000059604644775390625)) * (0.5 + (0.5 * bright)), float3((arm * 0.3499999940395355224609375) * depth));
            }
        }
        light += (((_177.uGlow * exp((-length(q - float2(0.0, 0.300000011920928955078125))) * 1.60000002384185791015625)) * 0.070000000298023223876953125) * bright);
    }
    col += light;
    col = float3(1.0) - exp((-col) * 1.2000000476837158203125);
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_jellyfish_frag_out flair_jellyfish_frag(constant FlairUniforms& _177 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_jellyfish_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _898;
    if (_177.flair_flipY > 0.5)
    {
        _898 = _177.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _898 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _898);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _177);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

