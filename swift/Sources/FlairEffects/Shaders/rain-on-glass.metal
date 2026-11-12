// flair-metal-hash: efebd15f
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
    float uDensity;
    float uSpeed;
    float uSize;
    float3 uTint;
};

struct flair_rain_on_glass_frag_out
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
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 paintDrop(thread float4& acc, thread const float2& d, thread const float& r, thread const float& px, constant FlairUniforms& _222)
{
    float dist = length(d);
    if (dist > (r + px))
    {
        return acc;
    }
    float m = (1.0 - smoothstep(r - (1.5 * px), r, dist)) * smoothstep(0.0, 2.0 * px, r);
    float2 n = d / float2(fast::max(r, 9.9999997473787516355514526367188e-06));
    float l = length(n);
    float rim = smoothstep(0.449999988079071044921875, 1.0, l) * m;
    float spec = (1.0 - smoothstep(0.0, 0.300000011920928955078125, length(n - float2(-0.300000011920928955078125, 0.37999999523162841796875)))) * m;
    float caustic = (1.0 - smoothstep(0.0, 0.5, length(n - float2(0.1500000059604644775390625, -0.5)))) * m;
    float4 param = acc;
    float3 param_1 = _222.uTint;
    float param_2 = m * 0.20000000298023223876953125;
    acc = over(param, param_1, param_2);
    float4 param_3 = acc;
    float3 param_4 = float3(0.0, 0.0199999995529651641845703125, 0.0500000007450580596923828125);
    float param_5 = rim * 0.5;
    acc = over(param_3, param_4, param_5);
    float4 param_6 = acc;
    float3 param_7 = mix(_222.uTint, float3(1.0), float3(0.60000002384185791015625));
    float param_8 = caustic * 0.300000011920928955078125;
    acc = over(param_6, param_7, param_8);
    float4 param_9 = acc;
    float3 param_10 = float3(1.0);
    float param_11 = spec * 0.89999997615814208984375;
    return over(param_9, param_10, param_11);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _222)
{
    float2 p = fragCoord / float2(_222.iResolution[1u]);
    float px = 1.0 / _222.iResolution[1u];
    float t = _222.iTime * _222.uSpeed;
    float4 acc = float4(0.0);
    float beads = 30.0 / _222.uSize;
    float2 bq = p * beads;
    float2 bid = floor(bq);
    float2 param = bid;
    float2 bh = hash22(param);
    float life = fract((_222.iTime * 0.039999999105930328369140625) + (bh.x * 7.0));
    float br = ((0.119999997317790985107421875 + (0.180000007152557373046875 * bh.y)) / beads) * sin(3.141590118408203125 * life);
    float2 param_1 = bid + float2(5.0);
    if (hash12(param_1) < _222.uDensity)
    {
        float4 param_2 = acc;
        float2 param_3 = ((fract(bq) - float2(0.5)) - ((bh - float2(0.5)) * 0.4000000059604644775390625)) / float2(beads);
        float param_4 = br;
        float param_5 = px;
        float4 _364 = paintDrop(param_2, param_3, param_4, param_5, _222);
        acc = _364;
    }
    for (int i = 0; i < 2; i++)
    {
        float fi = float(i);
        float2 cell = (float2(0.119999997317790985107421875, 0.300000011920928955078125) * _222.uSize) * (1.0 - (0.300000011920928955078125 * fi));
        float2 q = (p / cell) + float2(fi * 3.7000000476837158203125, 0.0);
        float column = floor(q.x);
        float2 param_6 = float2(column, fi);
        q.y += ((t * 0.1500000059604644775390625) + (hash12(param_6) * 9.0));
        float2 id = floor(q);
        float2 f = fract(q) - float2(0.5);
        float2 param_7 = id + float2(fi * 17.0);
        float2 h = hash22(param_7);
        if (h.x > _222.uDensity)
        {
            continue;
        }
        float tt = (t * 1.2000000476837158203125) + (h.y * 6.28318023681640625);
        float y = (-0.37999999523162841796875) * sin(tt + sin(tt + (sin(tt) * 0.5)));
        float base = (h.y - 0.5) * 0.300000011920928955078125;
        float wobble = h.x * 6.28318023681640625;
        float x = base + (0.02999999932944774627685546875 * sin((y * 9.0) + wobble));
        float aspect = cell.x / cell.y;
        float r = cell.y * (0.0500000007450580596923828125 + (0.039999999105930328369140625 * fract(h.x * 13.69999980926513671875)));
        float2 d = float2((f.x - x) * aspect, f.y - y) * cell.y;
        d.y *= ((d.y > 0.0) ? 0.800000011920928955078125 : 1.0);
        float4 param_8 = acc;
        float2 param_9 = d;
        float param_10 = r;
        float param_11 = px;
        float4 _528 = paintDrop(param_8, param_9, param_10, param_11, _222);
        acc = _528;
        if (f.y > y)
        {
            float rows = 10.0;
            float row = floor(f.y * rows);
            float tx = base + (0.02999999932944774627685546875 * sin((((row + 0.5) / rows) * 9.0) + wobble));
            float2 bd = float2((f.x - tx) * aspect, (fract(f.y * rows) - 0.5) / rows) * cell.y;
            float fade = 1.0 - fast::clamp((f.y - y) / (0.5 - y), 0.0, 1.0);
            float2 param_12 = (id * 3.099999904632568359375) + float2(row, fi);
            float keep = step(0.3499999940395355224609375, hash12(param_12));
            float4 param_13 = acc;
            float2 param_14 = bd;
            float param_15 = ((r * 0.3499999940395355224609375) * fade) * keep;
            float param_16 = px;
            float4 _609 = paintDrop(param_13, param_14, param_15, param_16, _222);
            acc = _609;
        }
    }
    float4 param_17 = acc;
    fragColor = unpremultiply(param_17);
}

fragment flair_rain_on_glass_frag_out flair_rain_on_glass_frag(constant FlairUniforms& _222 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_rain_on_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _627;
    if (_222.flair_flipY > 0.5)
    {
        _627 = _222.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _627 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _627);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _222);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

