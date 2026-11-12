// flair-metal-hash: 2060fc04
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
    float3 uSky;
    float3 uLand;
    float3 uFire;
    packed_float3 uTrail;
    float uPeriod;
    float uAngle;
    float uSize;
    float uImpactX;
    uint uDemo;
};

struct flair_meteor_strike_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float land(thread const float& x)
{
    return (0.20000000298023223876953125 + (0.0350000001490116119384765625 * sin((x * 3.099999904632568359375) + 1.0))) + (0.0199999995529651641845703125 * sin((x * 7.30000019073486328125) + 2.0));
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
float3 fireRamp(thread float& t, constant FlairUniforms& _210)
{
    t = fast::clamp(t, 0.0, 1.0);
    float3 c = mix(_210.uFire * 0.20000000298023223876953125, _210.uFire, float3(smoothstep(0.0, 0.4000000059604644775390625, t)));
    c = mix(c, float3(1.0, 0.85000002384185791015625, 0.449999988079071044921875), float3(smoothstep(0.4000000059604644775390625, 0.75, t)));
    return mix(c, float3(1.0, 0.980000019073486328125, 0.920000016689300537109375), float3(smoothstep(0.75, 1.0, t)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _210)
{
    float px = 1.0 / _210.iResolution[1u];
    float2 p = fragCoord * px;
    float W = _210.iResolution[0u] * px;
    float fall = 1.0;
    float t = -99.0;
    float ix = _210.uImpactX * W;
    bool _268 = _210.iClicks[0].w > 0.5;
    bool _280;
    if (_268)
    {
        _280 = (_210.iTime - _210.iClicks[0].z) < _210.uPeriod;
    }
    else
    {
        _280 = _268;
    }
    if (_280)
    {
        t = _210.iTime - _210.iClicks[0].z;
        ix = _210.iClicks[0].x * px;
    }
    else
    {
        if (_210.uDemo != 0u)
        {
            t = mod(_210.iTime, _210.uPeriod);
        }
    }
    float param = ix;
    float2 I = float2(ix, land(param));
    float since = t - fall;
    float S = _210.uSize;
    float3 col = mix((_210.uSky * 1.60000002384185791015625) + float3(0.0199999995529651641845703125, 0.0199999995529651641845703125, 0.0500000007450580596923828125), _210.uSky * 0.60000002384185791015625, float3(smoothstep(0.0, 1.0, p.y)));
    float2 sc = floor(fragCoord / float2(3.0));
    float2 param_1 = sc;
    float2 param_2 = sc + float2(7.0);
    float star = step(0.995999991893768310546875, hash12(param_1)) * (0.5 + (0.5 * sin((_210.iTime * 3.141590118408203125) + (hash12(param_2) * 40.0))));
    col += (float3(star) * 0.800000011920928955078125);
    float _372;
    if (since >= 0.0)
    {
        _372 = exp((-since) * 6.0);
    }
    else
    {
        _372 = 0.0;
    }
    float flash = _372;
    col += ((mix(_210.uFire, float3(1.0), float3(0.60000002384185791015625)) * flash) * 0.550000011920928955078125);
    float3 light = float3(0.0);
    bool _396 = since >= 0.0;
    bool _405;
    if (_396)
    {
        _405 = since < (_210.uPeriod - fall);
    }
    else
    {
        _405 = _396;
    }
    if (_405)
    {
        float life = fast::clamp(since / fast::max(fast::min(_210.uPeriod - fall, 2.599999904632568359375), 0.100000001490116119384765625), 0.0, 1.0);
        float2 d = (p - I) / float2(S);
        float r = length(d);
        float R = 0.89999997615814208984375 * (1.0 - exp((-since) * 2.2000000476837158203125));
        float shell = exp(-powr((r - R) / (0.01200000010430812835693359375 + (0.02999999932944774627685546875 * life)), 2.0)) * step(-0.00999999977648258209228515625, d.y);
        float inside = (smoothstep(R, R - 0.100000001490116119384765625, r) * step(0.0, d.y)) * 0.119999997317790985107421875;
        light += (((mix(float3(_210.uTrail), float3(1.0), float3(0.5)) * ((shell * 0.89999997615814208984375) + inside)) * (1.0 - life)) * (1.0 - life));
        float2 fb = d - float2(0.0, 0.0500000007450580596923828125 * since);
        float fr = (0.12999999523162841796875 * (1.0 - exp((-since) * 5.0))) * (1.0 + (0.4000000059604644775390625 * life));
        float2 param_3 = ((fb * 9.0) - float2(0.0, since * 1.2000000476837158203125)) + (I * 3.0);
        int param_4 = 5;
        float _521 = fbm(param_3, param_4);
        float n = _521;
        float body = smoothstep(fr * (1.0 + (0.3499999940395355224609375 * n)), fr * 0.4000000059604644775390625, length(fb * float2(1.0, 1.14999997615814208984375)));
        float heat = fast::clamp(((body * (1.39999997615814208984375 - (life * 1.2999999523162841796875))) + (n * 0.20000000298023223876953125)) - 0.100000001490116119384765625, 0.0, 1.0);
        float fbA = body * (1.0 - smoothstep(0.60000002384185791015625, 1.0, life));
        float3 smoke = mix(float3(0.07999999821186065673828125, 0.070000000298023223876953125, 0.070000000298023223876953125), _210.uFire * 0.1500000059604644775390625, float3(heat));
        float param_5 = heat;
        float3 _571 = fireRamp(param_5, _210);
        col = mix(col, mix(smoke, _571, float3(smoothstep(0.100000001490116119384765625, 0.4000000059604644775390625, heat))), float3(fbA * step(0.0, d.y + 0.0199999995529651641845703125)));
        light += (((_210.uFire * exp(((-r) * r) / 0.0500000007450580596923828125)) * 0.800000011920928955078125) * (1.0 - life));
    }
    float param_6 = p.x;
    float g = land(param_6);
    if (p.y < g)
    {
        float2 param_7 = float2(p.x * 8.0, p.y * 20.0);
        int param_8 = 3;
        float _623 = fbm(param_7, param_8);
        float n_1 = _623;
        float3 ground = _210.uLand * (0.699999988079071044921875 + (0.5 * n_1));
        ground += ((light * 0.60000002384185791015625) + (((_210.uFire * flash) * 0.300000011920928955078125) * exp((-abs(p.x - I.x)) * 3.0)));
        float rim = exp((-(g - p.y)) * 200.0);
        col = mix(ground, ground + (float3(_210.uTrail) * 0.100000001490116119384765625), float3(rim));
        if (since >= 0.0)
        {
            float cr = exp((-dot((p - I) * float2(1.0, 4.0), (p - I) * float2(1.0, 4.0))) / ((0.0040000001899898052215576171875 * S) * S));
            float param_9 = 0.699999988079071044921875;
            float3 _697 = fireRamp(param_9, _210);
            col += ((((_697 * cr) * exp((-since) * 0.800000011920928955078125)) * 0.89999997615814208984375) * (1.0 - smoothstep(0.5, 1.0, since / fast::max(_210.uPeriod - fall, 0.100000001490116119384765625))));
        }
    }
    else
    {
        col += light;
    }
    if ((t >= 0.0) && (since < 0.0))
    {
        float a = radians(_210.uAngle);
        float2 dir = float2(cos(a), -sin(a));
        float dist = 1.60000002384185791015625;
        float2 head = I - ((((dir * dist) * ((-since) / fall)) * (((-since) / fall) + 0.300000011920928955078125)) / float2(1.2999999523162841796875));
        float2 rel = p - head;
        float along = dot(rel, -dir);
        float across = dot(rel, float2(-dir.y, dir.x));
        float len = 0.550000011920928955078125 * S;
        float tw = (0.006000000052154064178466796875 + (0.0199999995529651641845703125 * fast::clamp(along / len, 0.0, 1.0))) * S;
        float2 param_10 = float2((along * 14.0) - (t * 18.0), across * 40.0);
        int param_11 = 4;
        float _806 = fbm(param_10, param_11);
        float flame = _806;
        float tail = (step(0.0, along) * exp(((-along) / len) * 2.5)) * exp(-powr(across / (tw * (0.699999988079071044921875 + flame)), 2.0));
        float glowT = ((step(0.0, along) * exp(((-along) / len) * 1.5)) * exp((-abs(across)) / (0.0500000007450580596923828125 * S))) * 0.3499999940395355224609375;
        float headD = length(rel) / S;
        float core = exp(((-headD) * headD) / 0.00011999999696854501962661743164062);
        float halo = exp((-headD) / 0.02999999932944774627685546875) * 0.800000011920928955078125;
        float param_12 = tail * 1.2000000476837158203125;
        float3 _870 = fireRamp(param_12, _210);
        col += ((((_870 * tail) * 1.39999997615814208984375) + (float3(_210.uTrail) * glowT)) + (mix(float3(_210.uTrail), float3(1.0), float3(0.60000002384185791015625)) * (halo + (core * 2.0))));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_meteor_strike_frag_out flair_meteor_strike_frag(constant FlairUniforms& _210 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_meteor_strike_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _907;
    if (_210.flair_flipY > 0.5)
    {
        _907 = _210.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _907 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _907);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _210);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

