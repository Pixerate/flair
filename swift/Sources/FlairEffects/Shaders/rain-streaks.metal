// flair-metal-hash: be95f63c
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
    packed_float3 uColor;
    float uDensity;
    float uSpeed;
    float uWind;
    float uLength;
    int uLayers;
    float uGround;
    float uSplashes;
    float uOpacity;
};

struct flair_rain_streaks_frag_out
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _65)
{
    float px = 1.0 / _65.iResolution[1u];
    float2 p = fragCoord * px;
    float a = 0.0;
    for (int i = 0; i < 5; i++)
    {
        if (i >= _65.uLayers)
        {
            break;
        }
        float depth = (float(i) + 1.0) / float(_65.uLayers);
        float cols = mix(70.0, 18.0, depth);
        float cellH = 6.0;
        float2 q = float2(p.x - ((p.y - _65.uGround) * _65.uWind), p.y);
        float fall = (_65.iTime * _65.uSpeed) * mix(1.39999997615814208984375, 3.2000000476837158203125, depth);
        float column = floor((q.x * cols) + (float(i) * 7.30000019073486328125));
        float2 param = float2(column, float(i));
        float2 g = float2((q.x * cols) + (float(i) * 7.30000019073486328125), (((q.y + fall) * cols) / cellH) + hash12(param));
        float2 cell = floor(g);
        float2 f = fract(g);
        float2 param_1 = cell + float2(float(i) * 13.1000003814697265625);
        float h = hash12(param_1);
        if (h > _65.uDensity)
        {
            continue;
        }
        float2 param_2 = cell + float2(3.2999999523162841796875);
        float x = 0.20000000298023223876953125 + (0.60000002384185791015625 * hash12(param_2));
        float2 param_3 = cell + float2(5.69999980926513671875);
        float len = fast::clamp(((0.3499999940395355224609375 * _65.uLength) * mix(0.60000002384185791015625, 1.0, depth)) * (0.699999988079071044921875 + (0.60000002384185791015625 * hash12(param_3))), 0.0500000007450580596923828125, 0.949999988079071044921875);
        float2 param_4 = cell + float2(9.1000003814697265625);
        float top = 0.0500000007450580596923828125 + ((0.949999988079071044921875 - len) * hash12(param_4));
        float across = abs(f.x - x) / (px * cols);
        float width = mix(0.5, 1.39999997615814208984375, depth);
        float along = (f.y - top) / len;
        float body = ((step(0.0, along) * step(along, 1.0)) * powr(1.0 - along, 0.60000002384185791015625)) * smoothstep(0.0, 0.1500000059604644775390625, along);
        float streak = (1.0 - smoothstep(width * 0.5, (width * 0.5) + 1.0, across)) * body;
        streak *= step(_65.uGround, p.y);
        a = fast::max(a, streak * mix(0.25, 0.89999997615814208984375, depth));
    }
    if (_65.uSplashes > 0.0)
    {
        for (int k = 0; k < 2; k++)
        {
            float w = 0.04500000178813934326171875;
            float sx = (p.x / w) + (float(k) * 0.5);
            float cell_1 = floor(sx);
            float2 param_5 = float2(cell_1, float(k));
            float period = 0.449999988079071044921875 + (0.5 * hash12(param_5));
            float2 param_6 = float2(cell_1, 7.0 + float(k));
            float time = (_65.iTime * _65.uSpeed) + (hash12(param_6) * period);
            float cycle = floor(time / period);
            float age = fract(time / period) * period;
            float2 param_7 = float2(cell_1, cycle + (float(k) * 19.0));
            if (hash12(param_7) > ((_65.uSplashes * _65.uDensity) * 1.39999997615814208984375))
            {
                continue;
            }
            float2 param_8 = float2(cell_1, cycle + 2.0);
            float2 centre = float2((((cell_1 + 0.25) + (0.5 * hash12(param_8))) - (float(k) * 0.5)) * w, _65.uGround);
            float2 d = p - centre;
            float life = smoothstep(0.25, 0.0, age);
            float r = 0.0040000001899898052215576171875 + (age * 0.07999999821186065673828125);
            float ring = abs(length(d * float2(1.0, 3.5)) - r);
            a = fast::max(a, (((1.0 - smoothstep(0.60000002384185791015625 * px, 1.7999999523162841796875 * px, ring)) * life) * 0.699999988079071044921875) * step(-0.0030000000260770320892333984375, d.y));
            for (int j = 0; j < 3; j++)
            {
                float fj = float(j);
                float2 param_9 = float2(cell_1, fj + cycle);
                float vx = ((fj - 1.0) * 0.119999997317790985107421875) + ((hash12(param_9) - 0.5) * 0.0599999986588954925537109375);
                float2 param_10 = float2(cell_1 + 4.0, fj + cycle);
                float vy = 0.2199999988079071044921875 + (0.119999997317790985107421875 * hash12(param_10));
                float2 at = centre + float2(vx * age, (vy * age) - ((2.2000000476837158203125 * age) * age));
                float drop = 1.0 - smoothstep(0.800000011920928955078125 * px, 2.0 * px, length(p - at));
                a = fast::max(a, ((drop * life) * step(_65.uGround - 0.00200000009499490261077880859375, at.y)) * 0.89999997615814208984375);
            }
        }
    }
    fragColor = float4(_65.uColor[0], _65.uColor[1], _65.uColor[2], a * _65.uOpacity);
}

fragment flair_rain_streaks_frag_out flair_rain_streaks_frag(constant FlairUniforms& _65 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_rain_streaks_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _569;
    if (_65.flair_flipY > 0.5)
    {
        _569 = _65.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _569 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _569);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _65);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

