// flair-metal-hash: c375843b
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
    float3 uMedium;
    float3 uCell;
    float3 uMembrane;
    packed_float3 uNucleus;
    float uDensity;
    float uStain;
    float uVignette;
};

struct flair_cell_division_frag_out
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
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / fast::max(k, 9.9999997473787516355514526367188e-06)), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float ellipseDist(thread const float2& v, thread const float2& r)
{
    return (length(v / r) - 1.0) * fast::min(r.x, r.y);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _226)
{
    float2 c = (fragCoord - (float2(_226.iResolution[0], _226.iResolution[1]) * 0.5)) / float2(_226.iResolution[1u]);
    float2 p = c * _226.uDensity;
    float px = _226.uDensity / _226.iResolution[1u];
    float T = (_226.iTime * 6.28318023681640625) / 8.0;
    float best = 100000.0;
    float bestNuc = 100000.0;
    float bestFade = 0.0;
    float bestSoft = 0.0;
    float2 bestL = float2(0.0);
    float2 cell = floor(p);
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 id = cell + float2(float(i), float(j));
            float2 param = id + float2(0.37000000476837158203125);
            float2 h = hash22(param);
            float2 param_1 = (id * 1.71000003814697265625) + float2(4.099999904632568359375);
            float h2 = hash12(param_1);
            float2 centre = ((id + float2(0.5)) + ((h - float2(0.5)) * 0.23999999463558197021484375)) + (float2(sin(T + (h.x * 6.280000209808349609375)), cos(T + (h.y * 6.280000209808349609375))) * 0.0500000007450580596923828125);
            float s = fract((_226.iTime / 8.0) + h2);
            float fade = smoothstep(0.0, 0.100000001490116119384765625, s) * (1.0 - smoothstep(0.87999999523162841796875, 1.0, s));
            float param_2 = -((h.x * 3.141590118408203125) + (s * 0.60000002384185791015625));
            float2 l = rot(param_2) * (p - centre);
            float split = smoothstep(0.449999988079071044921875, 0.800000011920928955078125, s);
            float r = 0.1599999964237213134765625 + (0.0599999986588954925537109375 * smoothstep(0.0, 0.449999988079071044921875, s));
            float rd = r * mix(1.0, 0.800000011920928955078125, split);
            float sep = (0.189999997615814208984375 * split) + (0.07999999821186065673828125 * smoothstep(0.800000011920928955078125, 1.0, s));
            float ang = precise::atan2(l.y, l.x);
            float wob = (0.0040000001899898052215576171875 * sin(((ang * 3.0) + (T * 2.0)) + (h.y * 9.0))) + (0.0030000000260770320892333984375 * sin(((ang * 5.0) - (T * 3.0)) + (h.x * 7.0)));
            float d1 = length(l - float2(sep, 0.0)) - rd;
            float d2 = length(l + float2(sep, 0.0)) - rd;
            float param_3 = d1;
            float param_4 = d2;
            float param_5 = mix(0.119999997317790985107421875, 0.0040000001899898052215576171875, smoothstep(0.550000011920928955078125, 0.85000002384185791015625, s));
            float d = smin(param_3, param_4, param_5) + wob;
            float s1 = smoothstep(0.300000011920928955078125, 0.4199999868869781494140625, s);
            float s2 = smoothstep(0.75, 0.920000016689300537109375, s);
            float2 nr = mix(float2(0.449999988079071044921875 * r), float2(0.100000001490116119384765625 * r, 0.60000002384185791015625 * r), float2(s1));
            nr = mix(nr, float2(0.4199999868869781494140625 * rd), float2(s2));
            float nsep = sep * 0.949999988079071044921875;
            float2 param_6 = l - float2(nsep, 0.0);
            float2 param_7 = nr;
            float2 param_8 = l + float2(nsep, 0.0);
            float2 param_9 = nr;
            float nd = fast::min(ellipseDist(param_6, param_7), ellipseDist(param_8, param_9));
            float key = d + ((1.0 - fade) * 0.25);
            if (key < best)
            {
                best = key;
                bestNuc = nd;
                bestFade = fade;
                bestSoft = 1.0 - fade;
                bestL = l + (h * 7.0);
            }
        }
    }
    float d_1 = best - ((1.0 - bestFade) * 0.25);
    float aa = (px * 1.5) + (bestSoft * 0.0500000007450580596923828125);
    float inside = 1.0 - smoothstep(-aa, aa, d_1);
    float rim = exp((-abs(d_1)) / (0.01200000010430812835693359375 + (bestSoft * 0.039999999105930328369140625)));
    float halo = exp((-fast::max(d_1, 0.0)) / 0.0500000007450580596923828125) * (1.0 - inside);
    float2 param_10 = bestL * 28.0;
    float2 param_11 = bestL * 61.0;
    float grain = (vnoise(param_10) * 0.5) + (vnoise(param_11) * 0.5);
    float2 param_12 = p * 9.0;
    float3 col = _226.uMedium * (0.959999978542327880859375 + (0.039999999105930328369140625 * vnoise(param_12)));
    float3 cyto = mix(_226.uCell, _226.uCell * 0.86000001430511474609375, float3(grain)) * (0.89999997615814208984375 + (0.119999997317790985107421875 * smoothstep(0.0, -0.119999997317790985107421875, d_1)));
    col = mix(col, cyto, float3((inside * bestFade) * 0.89999997615814208984375));
    col += float3((halo * 0.180000007152557373046875) * bestFade);
    col = mix(col, _226.uMembrane, float3((rim * bestFade) * 0.75));
    float nIn = (1.0 - smoothstep(-aa, aa, bestNuc)) * inside;
    float2 param_13 = bestL * 45.0;
    float chromatin = 0.75 + (0.25 * vnoise(param_13));
    col = mix(col, float3(_226.uNucleus) * chromatin, float3((nIn * bestFade) * mix(0.25, 0.89999997615814208984375, _226.uStain)));
    col = mix(col, float3(_226.uNucleus) * 0.60000002384185791015625, float3((((exp((-abs(bestNuc)) / 0.00999999977648258209228515625) * inside) * bestFade) * 0.5) * _226.uStain));
    float field = ((0.5 * fast::min(_226.iResolution[0u], _226.iResolution[1u])) + (0.300000011920928955078125 * abs(_226.iResolution[0u] - _226.iResolution[1u]))) / _226.iResolution[1u];
    float dc = length(c);
    float lens = smoothstep(field, field * 0.89999997615814208984375, dc) * (1.0 - (0.25 * powr(dc / field, 2.0)));
    col *= mix(1.0, lens, _226.uVignette);
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_cell_division_frag_out flair_cell_division_frag(constant FlairUniforms& _226 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_cell_division_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _763;
    if (_226.flair_flipY > 0.5)
    {
        _763 = _226.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _763 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _763);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _226);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

