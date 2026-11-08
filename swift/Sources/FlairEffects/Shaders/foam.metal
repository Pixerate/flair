// flair-metal-hash: ef9ad0a4
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
    float3 uBase;
    packed_float3 uWall;
    float uScale;
    float uVariety;
    float uPopping;
    float uSettle;
    float uIridescence;
};

struct flair_foam_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 cellAt(thread const float2& g, thread float& since, constant FlairUniforms& _123)
{
    float2 param = g;
    float2 h = hash22(param);
    float2 param_1 = g + float2(17.299999237060546875);
    float h3 = hash12(param_1);
    float2 c = ((g + float2(0.5)) + ((h - float2(0.5)) * 0.60000002384185791015625)) + (float2(sin((_123.iTime * 0.300000011920928955078125) + (h.x * 6.280000209808349609375)), cos((_123.iTime * 0.2700000107288360595703125) + (h.y * 6.280000209808349609375))) * 0.07999999821186065673828125);
    float w = ((_123.uVariety * 0.4000000059604644775390625) * h3) * h3;
    since = 1000.0;
    float2 param_2 = g + float2(5.099999904632568359375);
    if (hash12(param_2) < _123.uPopping)
    {
        float2 param_3 = g + float2(9.69999980926513671875);
        float period = 9.0 * (0.699999988079071044921875 + (0.60000002384185791015625 * hash12(param_3)));
        float ph = fract((_123.iTime / period) + (h.x * 3.099999904632568359375));
        since = ph * period;
        w = mix(-0.5, w, smoothstep(0.0, 0.449999988079071044921875, ph));
    }
    return float3(c, w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _123)
{
    float2 p = ((fragCoord / float2(_123.iResolution[1u])) * _123.uScale) + float2(0.0, (_123.iTime * _123.uSettle) * 0.1500000059604644775390625);
    float px = _123.uScale / _123.iResolution[1u];
    float2 g0 = floor(p);
    float best = 1000000000.0;
    float2 bc = float2(0.0);
    float2 bg = float2(0.0);
    float param_1;
    for (int j = -2; j <= 2; j++)
    {
        for (int i = -2; i <= 2; i++)
        {
            float2 g = g0 + float2(float(i), float(j));
            float2 param = g;
            float3 _279 = cellAt(param, param_1, _123);
            float s = param_1;
            float3 c = _279;
            float2 d = p - c.xy;
            float pd = dot(d, d) - c.z;
            if (pd < best)
            {
                best = pd;
                bc = c.xy;
                bg = g;
            }
        }
    }
    float wall = 1000000000.0;
    float pop = 0.0;
    float param_3;
    for (int j_1 = -2; j_1 <= 2; j_1++)
    {
        for (int i_1 = -2; i_1 <= 2; i_1++)
        {
            float2 g_1 = g0 + float2(float(i_1), float(j_1));
            float2 param_2 = g_1;
            float3 _337 = cellAt(param_2, param_3, _123);
            float s_1 = param_3;
            float3 c_1 = _337;
            if (s_1 < 0.3499999940395355224609375)
            {
                float x = (length(p - c_1.xy) - (0.1500000059604644775390625 + (s_1 * 1.60000002384185791015625))) / 0.0500000007450580596923828125;
                pop = fast::max(pop, exp((-x) * x) * (1.0 - (s_1 / 0.3499999940395355224609375)));
            }
            if (all(g_1 == bg))
            {
                continue;
            }
            float2 d_1 = p - c_1.xy;
            float len = length(c_1.xy - bc);
            if (len < 9.9999997473787516355514526367188e-05)
            {
                continue;
            }
            wall = fast::min(wall, ((dot(d_1, d_1) - c_1.z) - best) / (2.0 * len));
        }
    }
    float d1 = length(p - bc);
    float R = fast::max(d1 + wall, 0.001000000047497451305389404296875);
    float hh = fast::clamp(wall / R, 0.0, 1.0);
    float2 u = (p - bc) / float2(R);
    float3 n = fast::normalize(float3(u * 1.10000002384185791015625, sqrt(fast::max(1.0 - dot(u, u), 0.0)) + 0.25));
    float3 L = float3(-0.4386331737041473388671875, 0.58484423160552978515625, 0.682318270206451416015625);
    float diff = fast::max(dot(n, L), 0.0);
    float spec = powr(fast::max(dot(reflect(-L, n), float3(0.0, 0.0, 1.0)), 0.0), 28.0);
    float edge = 1.0 - hh;
    float3 col = mix(mix(float3(_123.uWall), _123.uBase, float3(0.3499999940395355224609375)), _123.uBase, float3(0.25 + ((0.75 * edge) * edge)));
    col *= (0.75 + (0.3499999940395355224609375 * diff));
    float2 param_4 = bg + float2(3.2999999523162841796875);
    float cellHash = hash12(param_4);
    float3 iri = float3(0.5) + (cos((float3((cellHash + (edge * 1.39999997615814208984375)) + (_123.iTime * 0.039999999105930328369140625)) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    col = mix(col, col * (float3(0.60000002384185791015625) + (iri * 0.800000011920928955078125)), float3((_123.uIridescence * 0.5) * edge));
    col += float3((spec * 0.800000011920928955078125) * smoothstep(0.100000001490116119384765625, 0.5, R));
    float seam = 1.0 - smoothstep(0.0, 0.02999999932944774627685546875 + px, wall);
    float lip = smoothstep(0.0, 0.02999999932944774627685546875 + px, wall) * (1.0 - smoothstep(0.02999999932944774627685546875, 0.0900000035762786865234375 + px, wall));
    col = mix(col, float3(_123.uWall) * 0.550000011920928955078125, float3(seam * 0.85000002384185791015625));
    col += float3(lip * 0.119999997317790985107421875);
    col += float3(pop * 0.5);
    fragColor = float4(col, 1.0);
}

fragment flair_foam_frag_out flair_foam_frag(constant FlairUniforms& _123 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_foam_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _610;
    if (_123.flair_flipY > 0.5)
    {
        _610 = _123.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _610 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _610);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _123);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

