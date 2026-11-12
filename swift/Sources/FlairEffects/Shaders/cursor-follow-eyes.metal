// flair-metal-hash: 71b04a3b
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
    float3 uWhite;
    float3 uIris;
    packed_float3 uLid;
    float uEyes;
    float uSize;
    float uBlink;
    float uVeins;
    uint uDemo;
    packed_float3 uBackground;
    float uBackgroundAlpha;
};

struct flair_cursor_follow_eyes_frag_out
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
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _114)
{
    float H = _114.iResolution[1u];
    float px = 1.0 / H;
    float2 p = (fragCoord - (float2(_114.iResolution[0], _114.iResolution[1]) * 0.5)) * px;
    float aspect = _114.iResolution[0u] * px;
    float hover = fast::clamp(_114.iPointer.z, 0.0, 1.0);
    float2 wander = float2((0.3499999940395355224609375 * aspect) * sin(_114.iTime * 0.60000002384185791015625), 0.25 * sin((_114.iTime * 0.89999997615814208984375) + 1.0));
    float2 rest = float2(0.0, -0.0500000007450580596923828125);
    float2 target = mix(select(rest, wander, bool2(_114.uDemo != 0u)), (_114.iPointer.xy - (float2(_114.iResolution[0], _114.iResolution[1]) * 0.5)) * px, float2(hover));
    float4 acc = float4(float3(_114.uBackground) * _114.uBackgroundAlpha, _114.uBackgroundAlpha);
    int n = int(_114.uEyes + 0.5);
    float r = _114.uSize;
    for (int i = 0; i < 6; i++)
    {
        if (i >= n)
        {
            break;
        }
        float fi = float(i);
        float2 c = float2(((fi - (0.5 * float(n - 1))) * 2.5) * r, 0.0);
        bool _257 = abs(p.x - c.x) > (1.39999997615814208984375 * r);
        bool _269;
        if (!_257)
        {
            _269 = abs(p.y - c.y) > r;
        }
        else
        {
            _269 = _257;
        }
        if (_269)
        {
            continue;
        }
        float2 to = target - c;
        float near = 1.0 - smoothstep(r, 6.0 * r, length(to));
        float2 param = float2(fi, 3.0);
        float2 param_1 = float2(fi, 7.0);
        float beat = fract((_114.iTime / (3.0 + (2.0 * hash12(param)))) + hash12(param_1));
        float blink = mix(1.0, 1.0 - exp(-powr((beat - 0.5) / 0.02500000037252902984619140625, 2.0)), _114.uBlink);
        float open = blink * mix(1.0, 0.550000011920928955078125, near * hover);
        float2 q = (p - c) / float2(r);
        float h = (0.62000000476837158203125 * open) * fast::max(1.0 - (q.x * q.x), 0.0);
        float inside = fast::clamp(((h - abs(q.y)) * r) / px, 0.0, 1.0) * step(abs(q.x), 1.0);
        float rim = (fast::clamp((((h + 0.0900000035762786865234375) - abs(q.y)) * r) / px, 0.0, 1.0) * step(abs(q.x), 1.0499999523162841796875)) * (1.0 - inside);
        float2 look = to / float2(r);
        look = (look / float2(fast::max(length(look), 9.9999997473787516355514526367188e-05))) * fast::min(length(look) * 0.5, 0.449999988079071044921875);
        float2 iq = q - look;
        float id = length(iq);
        float ang = precise::atan2(iq.y, iq.x);
        float3 white = _114.uWhite * (0.75 + (0.25 * (1.0 - (q.x * q.x))));
        float vein = (1.0 - smoothstep(0.0, 0.039999999105930328369140625, abs(q.y - ((0.180000007152557373046875 * sin((q.x * 9.0) + fi)) * (1.0 - abs(q.x)))))) * smoothstep(0.3499999940395355224609375, 0.949999988079071044921875, abs(q.x));
        white = mix(white, float3(0.75, 0.119999997317790985107421875, 0.119999997317790985107421875), float3((vein * _114.uVeins) * 0.699999988079071044921875));
        float3 iris = _114.uIris * ((0.64999997615814208984375 + ((0.3499999940395355224609375 * sin((ang * 18.0) + fi)) * 0.5)) + (0.3499999940395355224609375 * (1.0 - (id / 0.4199999868869781494140625))));
        float pupilR = mix(0.20000000298023223876953125, 0.119999997317790985107421875, near * hover);
        float3 eye = mix(white, iris, float3(1.0 - smoothstep(0.4000000059604644775390625, 0.430000007152557373046875, id)));
        eye = mix(eye, float3(0.0199999995529651641845703125), float3(1.0 - smoothstep(pupilR - 0.0199999995529651641845703125, pupilR, id)));
        eye = mix(eye, float3(1.0), float3(1.0 - smoothstep(0.0500000007450580596923828125, 0.07500000298023223876953125, length(iq - float2(-0.119999997317790985107421875, 0.12999999523162841796875)))));
        eye *= (1.0 - (0.3499999940395355224609375 * smoothstep(0.0, 0.25, (q.y / fast::max(h, 0.001000000047497451305389404296875)) - 0.4000000059604644775390625)));
        float4 param_2 = acc;
        float3 param_3 = float3(_114.uLid);
        float param_4 = rim;
        acc = over(param_2, param_3, param_4);
        float4 param_5 = acc;
        float3 param_6 = eye;
        float param_7 = inside;
        acc = over(param_5, param_6, param_7);
    }
    float4 param_8 = acc;
    fragColor = unpremultiply(param_8);
}

fragment flair_cursor_follow_eyes_frag_out flair_cursor_follow_eyes_frag(constant FlairUniforms& _114 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_cursor_follow_eyes_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _574;
    if (_114.flair_flipY > 0.5)
    {
        _574 = _114.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _574 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _574);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _114);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

