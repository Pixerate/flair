// flair-metal-hash: f74d6767
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
    float3 uBackground;
    float3 uBrew;
    float3 uPot;
    packed_float3 uSteam;
    float uBubbles;
    float uSteamAmount;
    float uSize;
    float uBackgroundAlpha;
};

struct flair_cauldron_frag_out
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
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _224)
{
    float2 p = (fragCoord - (float2(_224.iResolution[0], _224.iResolution[1]) * 0.5)) / float2(_224.iResolution[1u]);
    float px = (1.0 / _224.iResolution[1u]) / _224.uSize;
    float2 q = (p / float2(_224.uSize)) - float2(0.0, -0.119999997317790985107421875);
    float3 col = _224.uBackground;
    col += ((_224.uBrew * 0.2199999988079071044921875) * exp((-length((q - float2(0.0, 0.0500000007450580596923828125)) / float2(1.0, 0.60000002384185791015625))) / 0.25));
    float bowl = length((q - float2(0.0, -0.1599999964237213134765625)) / float2(0.3400000035762786865234375, 0.2700000107288360595703125)) - 1.0;
    float body = fast::max(bowl, q.y - 0.0);
    float legs = 100000.0;
    for (int i = -1; i <= 1; i++)
    {
        legs = fast::min(legs, length((q - float2(float(i) * 0.20000000298023223876953125, -0.430000007152557373046875)) / float2(0.039999999105930328369140625, 0.0500000007450580596923828125)) - 1.0);
    }
    float potCover = 1.0 - smoothstep((-px) * 3.0, px * 3.0, fast::min(body * 0.2700000107288360595703125, legs * 0.039999999105930328369140625));
    float3 iron = (_224.uPot * (0.699999988079071044921875 + (0.60000002384185791015625 * smoothstep(-0.300000011920928955078125, 0.300000011920928955078125, q.x * (-1.0))))) + ((_224.uBrew * 0.119999997317790985107421875) * smoothstep(-0.25, 0.0, q.y));
    col = mix(col, iron, float3(potCover));
    float2 e = (q - float2(0.0)) / float2(0.310000002384185791015625, 0.070000000298023223876953125);
    float rimOuter = length(e) - 1.0;
    float rimInner = length((q - float2(0.0, 0.0040000001899898052215576171875)) / float2(0.2700000107288360595703125, 0.05200000107288360595703125)) - 1.0;
    float rim = fast::max(rimOuter * 0.070000000298023223876953125, (-rimInner) * 0.05200000107288360595703125);
    float rimCover = 1.0 - smoothstep(-px, px, rim);
    float3 rimCol = ((_224.uPot * 1.60000002384185791015625) + ((_224.uBrew * 0.449999988079071044921875) * smoothstep(0.0199999995529651641845703125, -0.039999999105930328369140625, q.y - 0.0))) + ((_224.uBrew * 0.25) * smoothstep(0.0, 0.0599999986588954925537109375, q.y));
    col = mix(col, rimCol, float3(rimCover));
    float2 s = (q - float2(0.0, 0.0040000001899898052215576171875)) / float2(0.2700000107288360595703125, 0.05200000107288360595703125);
    float inBrew = 1.0 - smoothstep((-px) * 4.0, px * 4.0, (length(s) - 1.0) * 0.05200000107288360595703125);
    if (inBrew > 0.0)
    {
        float a = precise::atan2(s.y, s.x) + (_224.iTime * 0.4000000059604644775390625);
        float2 param = float2(a * 2.0, (length(s) * 4.0) - (_224.iTime * 0.5));
        float swirl = vnoise(param);
        float3 brew = _224.uBrew * ((0.550000011920928955078125 + (0.3499999940395355224609375 * swirl)) + (0.300000011920928955078125 * (1.0 - length(s))));
        float2 bg = s * float2(5.0, 2.0);
        float2 bi = floor(bg);
        float2 param_1 = bi + float2(3.099999904632568359375);
        float2 bh = hash22(param_1);
        float period = 1.2000000476837158203125 + (1.60000002384185791015625 * bh.x);
        float life = fract((_224.iTime / period) + bh.y);
        float2 param_2 = bi + float2(1.7000000476837158203125);
        float br = (0.4199999868869781494140625 * smoothstep(0.0, 0.85000002384185791015625, life)) * step(hash12(param_2), _224.uBubbles);
        float2 bf = (fract(bg) - float2(0.5)) * float2(1.0, 1.60000002384185791015625);
        float bd = length(bf);
        float bubble = (1.0 - smoothstep(br - 0.0599999986588954925537109375, br, bd)) * (1.0 - step(0.87999999523162841796875, life));
        brew = mix(brew, (_224.uBrew * 1.25) + float3(0.1500000059604644775390625), float3(bubble * smoothstep(br * 0.5, br, bd)));
        brew = mix(brew, _224.uBrew * 0.449999988079071044921875, float3((bubble * (1.0 - smoothstep(0.0, br * 0.60000002384185791015625, bd))) * 0.5));
        float pop = smoothstep(0.87999999523162841796875, 0.89999997615814208984375, life) * (1.0 - smoothstep(0.89999997615814208984375, 1.0, life));
        float2 param_3 = bi + float2(1.7000000476837158203125);
        brew += (((_224.uBrew * pop) * exp((-abs(bd - 0.449999988079071044921875)) / 0.0500000007450580596923828125)) * step(hash12(param_3), _224.uBubbles));
        col = mix(col, brew, float3(inBrew));
    }
    if (q.y > (-0.0199999995529651641845703125))
    {
        float h = q.y;
        float wobble = (0.0599999986588954925537109375 * sin((h * 6.0) - (_224.iTime * 1.2000000476837158203125))) + (0.039999999105930328369140625 * sin((h * 11.0) + (_224.iTime * 0.699999988079071044921875)));
        float width = 0.2199999988079071044921875 + (h * 0.449999988079071044921875);
        float mask = ((1.0 - smoothstep(0.4000000059604644775390625 * width, width, abs(q.x - wobble))) * smoothstep(-0.0199999995529651641845703125, 0.0599999986588954925537109375, h)) * (1.0 - smoothstep(0.25, 0.949999988079071044921875, h));
        float2 param_4 = float2((q.x * 4.0) - (wobble * 3.0), (h * 3.0) - (_224.iTime * 0.550000011920928955078125));
        int param_5 = 4;
        float _694 = fbm(param_4, param_5);
        float plume = _694;
        float steam = (smoothstep(0.3499999940395355224609375, 0.800000011920928955078125, plume) * mask) * _224.uSteamAmount;
        col = mix(col, float3(_224.uSteam) * (0.60000002384185791015625 + (0.4000000059604644775390625 * (1.0 - h))), float3(steam * 0.75));
    }
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
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
    float3 _770;
    if (a > 0.0)
    {
        _770 = bg + (d / float3(a));
    }
    else
    {
        _770 = bg;
    }
    float3 fg = _770;
    float alpha = a + (opacity * (1.0 - a));
    float3 _792;
    if (alpha > 0.0)
    {
        _792 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _792 = bg;
    }
    float3 col = _792;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _224)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _224);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _224.uBackground;
    float param_4 = _224.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_cauldron_frag_out flair_cauldron_frag(constant FlairUniforms& _224 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_cauldron_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _850;
    if (_224.flair_flipY > 0.5)
    {
        _850 = _224.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _850 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _850);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _224);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

