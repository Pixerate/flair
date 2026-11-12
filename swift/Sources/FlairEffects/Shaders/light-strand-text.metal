// flair-metal-hash: db69766c
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
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float3 uDark;
    float3 uMid;
    float3 uLight;
    packed_float3 uWarm;
    float uSize;
    float uStretch;
    float uStrands;
    float uContrast;
    float uWarmth;
    float uBend;
    float uEdge;
    float uSpeed;
    uint uAnimate;
    float uBuildTime;
    float uProgress;
};

struct flair_light_strand_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 strandPlace(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _177)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_177.uSize, (((_177.iResolution[0u] / _177.iResolution[1u]) * _177.uSize) * _177.uStretch) / aspect);
    return float3((p / float2((h * aspect) / _177.uStretch, h)) + float2(0.5), size.y / h);
}

static inline __attribute__((always_inline))
float strandMask(thread const float2& p, thread const float& blur, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _177)
{
    float2 param = p;
    float3 m = strandPlace(param, uText, uTextSmplr, _177);
    bool _226 = m.x < 0.0;
    bool _233;
    if (!_226)
    {
        _233 = m.x > 1.0;
    }
    else
    {
        _233 = _226;
    }
    bool _240;
    if (!_233)
    {
        _240 = m.y < 0.0;
    }
    else
    {
        _240 = _233;
    }
    bool _247;
    if (!_240)
    {
        _247 = m.y > 1.0;
    }
    else
    {
        _247 = _240;
    }
    if (_247)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, m.xy, level(log2(fast::max(blur * m.z, 1.0)))).w;
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
float strandFall(thread const float& id, thread const float& stage)
{
    float2 param = float2(id, 1.89999997615814208984375);
    return (stage - (0.300000011920928955078125 * hash12(param))) / 0.4000000059604644775390625;
}

static inline __attribute__((always_inline))
float2 strandDrop(thread const float& fall, thread const float& y)
{
    float below = (fall * 1.10000002384185791015625) - (1.0 - y);
    float lit = smoothstep(0.0, 0.02999999932944774627685546875, below);
    float head = (smoothstep(0.0, 0.00999999977648258209228515625, below) * exp((-below) * 30.0)) * (1.0 - smoothstep(0.800000011920928955078125, 1.0, fall));
    return float2(lit, head);
}

static inline __attribute__((always_inline))
float2 strandLayer(thread const float2& m, thread const float& count, thread const float& seed, thread const float& t, thread const float& stage)
{
    float u = m.x * count;
    float id = floor(u) + seed;
    float profile = sin(3.141590118408203125 * fract(u));
    float line = (profile * profile) * profile;
    float2 param = float2(id, seed);
    float2 param_1 = float2(seed, id);
    float2 param_2 = float2(id * 7.309999942779541015625, (m.y * (2.0 + (3.0 * hash12(param)))) - (t * (0.60000002384185791015625 + hash12(param_1))));
    float along = vnoise(param_2);
    float param_3 = id;
    float param_4 = stage;
    float param_5 = strandFall(param_3, param_4);
    float param_6 = m.y;
    float2 drop = strandDrop(param_5, param_6);
    float2 param_7 = float2(id, 3.7000000476837158203125);
    float light = (along * (0.20000000298023223876953125 + ((0.800000011920928955078125 * profile) * sqrt(profile)))) * (0.300000011920928955078125 + (0.699999988079071044921875 * hash12(param_7)));
    return float2((light * drop.x) + ((1.5 * drop.y) * line), drop.x * line);
}

static inline __attribute__((always_inline))
float3 strandColor(thread const float& s, thread const float& y, thread const float& n, thread const float& t, thread const float& stage, thread float& cover, constant FlairUniforms& _177)
{
    float2 m = float2(s, y);
    float2 param = m;
    float param_1 = n;
    float param_2 = 0.0;
    float param_3 = t;
    float param_4 = stage;
    float2 a = strandLayer(param, param_1, param_2, param_3, param_4);
    float2 param_5 = m;
    float param_6 = n * 2.2999999523162841796875;
    float param_7 = 17.0;
    float param_8 = t * 1.2999999523162841796875;
    float param_9 = stage;
    float2 b = strandLayer(param_5, param_6, param_7, param_8, param_9);
    float2 param_10 = m;
    float param_11 = n * 5.099999904632568359375;
    float param_12 = 41.0;
    float param_13 = t * 0.800000011920928955078125;
    float param_14 = stage;
    float2 c = strandLayer(param_10, param_11, param_12, param_13, param_14);
    float settled = smoothstep(0.699999988079071044921875, 1.0, stage);
    float strands = (((0.579999983310699462890625 * a.x) + (0.449999988079071044921875 * b.x)) + (0.38999998569488525390625 * c.x)) * (1.5 - (0.5 * settled));
    cover = fast::max(1.0 - (((1.0 - a.y) * (1.0 - b.y)) * (1.0 - c.y)), settled);
    float2 param_15 = float2(s * 9.0, (y * 1.60000002384185791015625) - (t * 0.3499999940395355224609375));
    float2 param_16 = float2((s * 23.0) + 5.0, (y * 2.400000095367431640625) + (t * 0.20000000298023223876953125));
    float zone = (vnoise(param_15) * 0.699999988079071044921875) + (0.300000011920928955078125 * vnoise(param_16));
    zone = smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, zone);
    float tone = fast::clamp(powr(strands * (0.1500000059604644775390625 + (2.2000000476837158203125 * zone)), _177.uContrast * 1.39999997615814208984375), 0.0, 1.0);
    float3 col = mix(_177.uDark, _177.uMid, float3(smoothstep(0.0, 0.5, tone)));
    col = mix(col, _177.uLight, float3(smoothstep(0.4199999868869781494140625, 0.949999988079071044921875, tone)));
    float wu = (s * n) * 7.0;
    float wid = floor(wu);
    float2 param_17 = float2(wid, 9.1000003814697265625);
    float thread0 = step(hash12(param_17), 0.01200000010430812835693359375 * _177.uWarmth) * smoothstep(0.5, 0.1500000059604644775390625, abs(fract(wu) - 0.5));
    float2 param_18 = float2(wid, (y * 3.0) - t);
    float param_19 = wid + 9.1000003814697265625;
    float param_20 = stage;
    float param_21 = strandFall(param_19, param_20);
    float param_22 = y;
    thread0 *= (smoothstep(0.300000011920928955078125, 0.699999988079071044921875, vnoise(param_18)) * strandDrop(param_21, param_22).x);
    return mix(col, mix(float3(1.0, 0.819999992847442626953125, 0.4000000059604644775390625), float3(_177.uWarm), float3(y)) * 1.2000000476837158203125, float3(fast::clamp(thread0, 0.0, 1.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _177)
{
    float px = 1.0 / _177.iResolution[1u];
    float2 p = (fragCoord - (float2(_177.iResolution[0], _177.iResolution[1]) * 0.5)) * px;
    float t = (_177.iTime * _177.uSpeed) * 2.0;
    float2 param = p;
    float param_1 = 1.5 * px;
    float mask = strandMask(param, param_1, uText, uTextSmplr, _177);
    float2 param_2 = p;
    float2 m = strandPlace(param_2, uText, uTextSmplr, _177).xy;
    float n = _177.uStrands * 60.0;
    float2 param_3 = p;
    float param_4 = 0.070000000298023223876953125;
    float soft = strandMask(param_3, param_4, uText, uTextSmplr, _177);
    float2 param_5 = p + float2(0.0350000001490116119384765625, 0.0);
    float param_6 = 0.070000000298023223876953125;
    float2 param_7 = p - float2(0.0350000001490116119384765625, 0.0);
    float param_8 = 0.070000000298023223876953125;
    float2 param_9 = p + float2(0.0, 0.0350000001490116119384765625);
    float param_10 = 0.070000000298023223876953125;
    float2 param_11 = p - float2(0.0, 0.0350000001490116119384765625);
    float param_12 = 0.070000000298023223876953125;
    float2 g = float2(strandMask(param_5, param_6, uText, uTextSmplr, _177) - strandMask(param_7, param_8, uText, uTextSmplr, _177), strandMask(param_9, param_10, uText, uTextSmplr, _177) - strandMask(param_11, param_12, uText, uTextSmplr, _177));
    float2 normal = g / float2(length(g) + 0.02999999932944774627685546875);
    float s = m.x - (((0.12999999523162841796875 * _177.uBend) * (1.0 - soft)) * normal.x);
    float _726;
    if (_177.uAnimate != 0u)
    {
        _726 = fast::clamp(_177.iTime / _177.uBuildTime, 0.0, 1.0);
    }
    else
    {
        _726 = _177.uProgress;
    }
    float built = _726;
    float2 param_13 = p;
    float param_14 = 0.04500000178813934326171875 * _177.uStretch;
    float2 param_15 = p;
    float param_16 = 0.0900000035762786865234375 * _177.uStretch;
    float2 param_17 = p;
    float param_18 = 0.180000007152557373046875 * _177.uStretch;
    float depth = ((smoothstep(0.5, 0.800000011920928955078125, strandMask(param_13, param_14, uText, uTextSmplr, _177)) + smoothstep(0.5, 0.800000011920928955078125, strandMask(param_15, param_16, uText, uTextSmplr, _177))) + smoothstep(0.5, 0.75, strandMask(param_17, param_18, uText, uTextSmplr, _177))) / 3.0;
    float stage = (built * 1.60000002384185791015625) - (0.60000002384185791015625 * (1.0 - depth));
    float param_19 = s;
    float param_20 = m.y;
    float param_21 = n;
    float param_22 = t;
    float param_23 = stage;
    float param_24;
    float3 _794 = strandColor(param_19, param_20, param_21, param_22, param_23, param_24, _177);
    float cover = param_24;
    float3 col = _794;
    float2 param_25 = p;
    float param_26 = 0.0199999995529651641845703125;
    float inner = strandMask(param_25, param_26, uText, uTextSmplr, _177);
    float edge = fast::clamp(mask - inner, 0.0, 1.0) * 1.60000002384185791015625;
    float2 param_27 = p - float2(0.0, 0.006000000052154064178466796875);
    float param_28 = 0.0040000001899898052215576171875;
    float below = fast::clamp(mask - strandMask(param_27, param_28, uText, uTextSmplr, _177), 0.0, 1.0) * smoothstep(0.3499999940395355224609375, 0.0, m.y);
    col += (((((_177.uLight * 0.300000011920928955078125) * edge) + ((mix(float3(_177.uWarm), float3(1.0, 0.85000002384185791015625, 0.5), float3(0.699999988079071044921875)) * 0.5) * below)) * _177.uEdge) * cover);
    float shape = mask * cover;
    float a = shape + (_177.uBackgroundAlpha * (1.0 - shape));
    float3 rgb = (col * shape) + ((float3(_177.uBackground) * _177.uBackgroundAlpha) * (1.0 - shape));
    fragColor = float4(rgb / float3(fast::max(a, 9.9999997473787516355514526367188e-05)), a);
}

fragment flair_light_strand_text_frag_out flair_light_strand_text_frag(constant FlairUniforms& _177 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_light_strand_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _897;
    if (_177.flair_flipY > 0.5)
    {
        _897 = _177.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _897 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _897);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _177);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

