// flair-metal-hash: 865a10a4
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
    float3 uSkyTop;
    float3 uSkyHorizon;
    float3 uGround;
    float3 uLow;
    packed_float3 uHigh;
    int uCurtains;
    float uIntensity;
    float uHeight;
    float uSpeed;
    float uHorizon;
    float uTrees;
    float uWater;
    float uStars;
};

struct flair_northern_lights_frag_out
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
float3 aurora(thread const float2& p, constant FlairUniforms& _279)
{
    float t = _279.iTime * _279.uSpeed;
    float3 col = float3(0.0);
    float _527;
    for (int i = 0; i < 4; i++)
    {
        if (i >= _279.uCurtains)
        {
            break;
        }
        float fi = float(i);
        float2 param = float2((p.x * 0.699999988079071044921875) + (fi * 3.7000000476837158203125), (t * 0.0599999986588954925537109375) + (fi * 1.2999999523162841796875));
        int param_1 = 3;
        float _453 = fbm(param, param_1);
        float foot = ((((_279.uWater + _279.uHorizon) + 0.100000001490116119384765625) + (0.07999999821186065673828125 * fi)) + (0.2199999988079071044921875 * (_453 - 0.5))) + (0.02500000037252902984619140625 * sin(((p.x * 5.0) - (t * 0.89999997615814208984375)) + (fi * 2.0)));
        float h = p.y - foot;
        float2 param_2 = float2((p.x * 1.5) + fi, t * 0.1500000059604644775390625);
        float warp = 2.2000000476837158203125 * vnoise(param_2);
        float2 param_3 = float2(((p.x * 22.0) + (warp * 6.0)) - (t * 0.60000002384185791015625), (h * 1.5) + (fi * 9.0));
        int param_4 = 3;
        float _512 = fbm(param_3, param_4);
        float rays = _512;
        float height = (_279.uHeight * (1.0 - (0.1500000059604644775390625 * fi))) * (0.5 + rays);
        if (h > 0.0)
        {
            _527 = exp((-h) / height);
        }
        else
        {
            _527 = exp(h * 70.0);
        }
        float curtain = _527;
        float glow = (curtain * (0.25 + ((1.39999997615814208984375 * rays) * rays))) * (1.0 - (0.2199999988079071044921875 * fi));
        float2 param_5 = float2((p.x * 2.0) - (t * 0.100000001490116119384765625), fi * 7.0);
        glow *= (0.699999988079071044921875 + (0.60000002384185791015625 * smoothstep(0.300000011920928955078125, 0.75, vnoise(param_5))));
        col += (mix(_279.uLow, float3(_279.uHigh), float3(smoothstep(0.0, _279.uHeight * 1.39999997615814208984375, h))) * glow);
    }
    return col * _279.uIntensity;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float stars(thread const float2& fragCoord, thread const float& density, constant FlairUniforms& _279)
{
    float2 cell = floor(fragCoord / float2(3.0));
    float2 param = cell;
    float h = hash12(param);
    float on = step(1.0 - (0.01200000010430812835693359375 * density), h);
    float2 param_1 = cell;
    float2 at = hash22(param_1) * 3.0;
    float d = length((fract(fragCoord / float2(3.0)) * 3.0) - at);
    float2 param_2 = cell + float2(7.0);
    return ((on * smoothstep(1.39999997615814208984375, 0.0, d)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_2)))) * (0.75 + (0.25 * sin((_279.iTime * (1.0 + (3.0 * h))) + (h * 40.0))));
}

static inline __attribute__((always_inline))
float skyline(thread const float& x, thread const float& horizon, thread const float& trees)
{
    float2 param = float2(x * 2.2000000476837158203125, 3.099999904632568359375);
    int param_1 = 4;
    float _307 = fbm(param, param_1);
    float hill = horizon * (0.75 + (0.5 * _307));
    float y = hill;
    float cell = 0.0280000008642673492431640625;
    float c = floor(x / cell);
    for (int k = -1; k <= 1; k++)
    {
        float id = c + float(k);
        float2 param_2 = float2(id, 4.400000095367431640625);
        float2 h = hash22(param_2);
        if (h.x < (1.0 - (0.550000011920928955078125 * trees)))
        {
            continue;
        }
        float cx = ((id + 0.5) * cell) + (((h.y - 0.5) * cell) * 0.60000002384185791015625);
        float height = (horizon * (0.180000007152557373046875 + (0.300000011920928955078125 * h.y))) + 0.00999999977648258209228515625;
        y = fast::max(y, (hill + height) - (abs(x - cx) / 0.23999999463558197021484375));
    }
    return y;
}

static inline __attribute__((always_inline))
float3 scene(thread const float2& p, thread const float2& fragCoord, constant FlairUniforms& _279)
{
    float2 param = p;
    float3 a = aurora(param, _279);
    float2 param_1 = fragCoord;
    float param_2 = 1.0;
    float3 col = mix(_279.uSkyHorizon, _279.uSkyTop, float3(smoothstep(_279.uWater, 1.0, p.y))) + (float3(stars(param_1, param_2, _279) * _279.uStars) * (1.0 - fast::min(length(a), 1.0)));
    col += (a + (((_279.uLow * 0.07999999821186065673828125) * _279.uIntensity) * exp((-(p.y - _279.uWater)) * 3.0)));
    if (_279.uHorizon > 0.0)
    {
        float param_3 = p.x;
        float param_4 = _279.uHorizon;
        float param_5 = _279.uTrees;
        float edge = smoothstep(-0.00200000009499490261077880859375, 0.00200000009499490261077880859375, (_279.uWater + skyline(param_3, param_4, param_5)) - p.y);
        col = mix(col, _279.uGround, float3(edge));
    }
    return col;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _279)
{
    float px = 1.0 / _279.iResolution[1u];
    float2 p = fragCoord * px;
    float3 col;
    if (p.y >= _279.uWater)
    {
        float2 param = p;
        float2 param_1 = fragCoord;
        col = scene(param, param_1, _279);
    }
    else
    {
        float depth = _279.uWater - p.y;
        float2 param_2 = float2(p.x * 9.0, ((depth * 60.0) / (depth + 0.0500000007450580596923828125)) - (_279.iTime * 0.60000002384185791015625));
        float ripple = (vnoise(param_2) - 0.5) * (0.0040000001899898052215576171875 + (0.02999999932944774627685546875 * depth));
        float2 m = float2(p.x + ripple, _279.uWater + depth);
        float2 param_3 = m;
        float2 param_4 = float2(fragCoord.x, (_279.uWater + depth) / px);
        col = scene(param_3, param_4, _279) * 0.60000002384185791015625;
        col += (_279.uSkyHorizon * 0.07999999821186065673828125);
    }
    fragColor = float4(col, 1.0);
}

fragment flair_northern_lights_frag_out flair_northern_lights_frag(constant FlairUniforms& _279 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_northern_lights_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _783;
    if (_279.flair_flipY > 0.5)
    {
        _783 = _279.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _783 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _783);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _279);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

