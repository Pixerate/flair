// flair-metal-hash: 4c408e51
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
    float3 uSky;
    float3 uRock;
    float3 uFoliage;
    float3 uWater;
    packed_float3 uPool;
    float uWidth;
    float uSpeed;
    float uMist;
};

struct flair_waterfall_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _181)
{
    float px = 1.0 / _181.iResolution[1u];
    float2 uv = fragCoord / float2(_181.iResolution[0], _181.iResolution[1]);
    float aspect = _181.iResolution[0u] / _181.iResolution[1u];
    float2 p = float2((uv.x - 0.5) * aspect, uv.y);
    float t = _181.iTime * _181.uSpeed;
    float3 col = mix(_181.uSky * 1.08000004291534423828125, _181.uSky * 0.85000002384185791015625, float3(uv.y));
    float2 param = float2(p.x * 2.0, 3.0);
    int param_1 = 4;
    float _239 = fbm(param, param_1);
    float hills = 0.829999983310699462890625 + (0.0500000007450580596923828125 * _239);
    col = mix(col, mix(_181.uFoliage, _181.uSky, float3(0.550000011920928955078125)), float3(step(uv.y, hills)));
    float half_ = ((_181.uWidth * 0.5) * aspect) * 0.5;
    float2 param_2 = float2(p.y * 8.0, 1.0);
    int param_3 = 3;
    float _274 = fbm(param_2, param_3);
    float edgeNoise = (_274 - 0.5) * 0.0599999986588954925537109375;
    float fallEdge = ((abs(p.x) - half_) - edgeNoise) - ((0.7400000095367431640625 - p.y) * 0.02999999932944774627685546875);
    float2 param_4 = float2(p.x * 4.0, 7.0);
    int param_5 = 3;
    float _304 = fbm(param_4, param_5);
    float cliffTop = 0.769999980926513671875 + (0.039999999105930328369140625 * _304);
    if (p.y < cliffTop)
    {
        float2 param_6 = float2(p.x * 3.0, p.y * 14.0);
        int param_7 = 4;
        float _324 = fbm(param_6, param_7);
        float strata = _324;
        float3 rock = (_181.uRock * (0.60000002384185791015625 + (0.699999988079071044921875 * strata))) * (0.75 + (0.3499999940395355224609375 * smoothstep(0.0, 0.300000011920928955078125, fallEdge)));
        float2 param_8 = p * 9.0;
        int param_9 = 4;
        float _348 = fbm(param_8, param_9);
        float moss = smoothstep(0.550000011920928955078125, 0.699999988079071044921875, _348) + smoothstep(cliffTop - 0.07999999821186065673828125, cliffTop - 0.00999999977648258209228515625, p.y);
        float2 param_10 = p * 30.0;
        int param_11 = 2;
        float _369 = fbm(param_10, param_11);
        rock = mix(rock, _181.uFoliage * (0.699999988079071044921875 + (0.5 * _369)), float3(fast::clamp(moss, 0.0, 1.0) * 0.85000002384185791015625));
        col = rock;
    }
    float inFall = (smoothstep(px * 2.0, (-px) * 2.0, fallEdge) * step(0.2199999988079071044921875, p.y)) * step(p.y, 0.75199997425079345703125);
    if (inFall > 0.0)
    {
        float drop = fast::max(0.7400000095367431640625 - p.y, 0.0);
        float s = (powr(drop, 0.699999988079071044921875) * 6.0) - (t * 1.60000002384185791015625);
        float2 param_12 = float2(p.x * 70.0, s * 3.0);
        float2 param_13 = float2((p.x * 160.0) + 3.0, s * 5.0);
        float streaks = (vnoise(param_12) * 0.60000002384185791015625) + (vnoise(param_13) * 0.4000000059604644775390625);
        float2 param_14 = float2(p.x * 12.0, s * 1.2000000476837158203125);
        float sheets = vnoise(param_14);
        float3 w = mix(_181.uWater * 0.64999997615814208984375, _181.uWater * 1.10000002384185791015625, float3(smoothstep(0.300000011920928955078125, 0.800000011920928955078125, (streaks * 0.699999988079071044921875) + (sheets * 0.5))));
        w += (float3(0.25) * smoothstep(0.699999988079071044921875, 0.7400000095367431640625, p.y));
        float thin = smoothstep(-0.0599999986588954925537109375, 0.0, fallEdge + (streaks * 0.02999999932944774627685546875));
        w = mix(w, col, float3(thin * 0.60000002384185791015625));
        col = mix(col, w, float3(inFall));
    }
    if (p.y < 0.23999999463558197021484375)
    {
        float depth = (0.23999999463558197021484375 - p.y) / 0.23999999463558197021484375;
        float z = 1.0 / (0.0500000007450580596923828125 + depth);
        float2 q = float2((p.x * z) * 0.60000002384185791015625, z);
        float2 param_15 = float2(q.x * 5.0, (q.y * 2.0) - (t * 0.60000002384185791015625));
        float2 param_16 = float2(q.x * 13.0, (q.y * 5.0) + (t * 0.300000011920928955078125));
        float waves = (vnoise(param_15) * 0.5) + (vnoise(param_16) * 0.5);
        float3 pool = (float3(_181.uPool) * (0.699999988079071044921875 + (0.5 * waves))) + ((mix(_181.uSky, float3(1.0), float3(0.300000011920928955078125)) * smoothstep(0.60000002384185791015625, 0.85000002384185791015625, waves)) * 0.300000011920928955078125);
        float rings = sin((length(float2(p.x / fast::max(half_ * 1.39999997615814208984375, 0.0500000007450580596923828125), (0.23999999463558197021484375 - p.y) * 6.0)) * 9.0) - (t * 4.0));
        pool += (((_181.uWater * smoothstep(0.699999988079071044921875, 1.0, rings)) * 0.119999997317790985107421875) * (1.0 - depth));
        col = pool;
    }
    float foamZone = exp(-powr((p.y - 0.23999999463558197021484375) / 0.0500000007450580596923828125, 2.0)) * smoothstep(half_ * 1.60000002384185791015625, half_ * 0.60000002384185791015625, abs(p.x));
    float2 param_17 = float2(p.x * 14.0, (p.y * 18.0) - (t * 1.5));
    int param_18 = 4;
    float _629 = fbm(param_17, param_18);
    float churn = _629;
    col = mix(col, _181.uWater * 1.14999997615814208984375, float3(fast::clamp(foamZone * (0.60000002384185791015625 + churn), 0.0, 1.0)));
    float2 mp = float2(p.x * 2.5, ((p.y - 0.23999999463558197021484375) * 3.0) - (t * 0.25));
    float2 param_19 = mp + float2(t * 0.0500000007450580596923828125);
    int param_20 = 3;
    float _664 = fbm(param_19, param_20);
    float2 param_21 = mp + float2(_664, 0.0);
    int param_22 = 5;
    float _670 = fbm(param_21, param_22);
    float mist = _670;
    float around = exp(-powr(((p.y - 0.23999999463558197021484375) - 0.07999999821186065673828125) / 0.20000000298023223876953125, 2.0)) * smoothstep(half_ * 3.5, half_ * 0.5, abs(p.x));
    col = mix(col, float3(0.949999988079071044921875, 0.980000019073486328125, 1.0), float3(fast::clamp((smoothstep(0.3499999940395355224609375, 0.800000011920928955078125, mist) * around) * _181.uMist, 0.0, 0.85000002384185791015625)));
    float2 g = float2(p.x * 90.0, (p.y + (t * 0.0500000007450580596923828125)) * 90.0);
    float2 cell = floor(g);
    float2 param_23 = cell;
    float spray = step(0.930000007152557373046875, hash12(param_23)) * (1.0 - smoothstep(0.100000001490116119384765625, 0.3499999940395355224609375, length(fract(g) - float2(0.5))));
    col += float3(((spray * around) * 0.5) * _181.uMist);
    fragColor = float4(col, 1.0);
}

fragment flair_waterfall_frag_out flair_waterfall_frag(constant FlairUniforms& _181 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_waterfall_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _762;
    if (_181.flair_flipY > 0.5)
    {
        _762 = _181.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _762 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _762);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _181);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

