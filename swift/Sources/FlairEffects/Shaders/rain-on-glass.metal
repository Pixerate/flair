// flair-metal-hash: 19a3ee64
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
float4 paintDrop(thread float4& acc, thread const float2& d, thread const float& r, thread const float& px, constant FlairUniforms& _227)
{
    float dist = length(d);
    if (dist > (r + px))
    {
        return acc;
    }
    float m = (1.0 - smoothstep(r - (1.39999997615814208984375 * px), r, dist)) * smoothstep(0.0, 1.7999999523162841796875 * px, r);
    float2 n = d / float2(fast::max(r, 9.9999997473787516355514526367188e-06));
    float l = length(n);
    float rim = smoothstep(0.550000011920928955078125, 0.959999978542327880859375, l) * m;
    float spec = powr(fast::max(0.0, 1.0 - (length(n - float2(-0.319999992847442626953125, 0.36000001430511474609375)) * 3.2000000476837158203125)), 2.0) * m;
    float caustic = powr(fast::max(0.0, 1.0 - (length(n - float2(0.180000007152557373046875, -0.4799999892711639404296875)) * 2.0)), 2.0) * m;
    float4 param = acc;
    float3 param_1 = _227.uTint * 0.85000002384185791015625;
    float param_2 = m * 0.1599999964237213134765625;
    acc = over(param, param_1, param_2);
    float4 param_3 = acc;
    float3 param_4 = float3(0.0, 0.02999999932944774627685546875, 0.07999999821186065673828125);
    float param_5 = rim * 0.550000011920928955078125;
    acc = over(param_3, param_4, param_5);
    float4 param_6 = acc;
    float3 param_7 = mix(_227.uTint, float3(1.0), float3(0.7200000286102294921875));
    float param_8 = caustic * 0.4799999892711639404296875;
    acc = over(param_6, param_7, param_8);
    float4 param_9 = acc;
    float3 param_10 = float3(1.0);
    float param_11 = spec * 0.949999988079071044921875;
    return over(param_9, param_10, param_11);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _227)
{
    float2 p = fragCoord / float2(_227.iResolution[1u]);
    float px = 1.0 / _227.iResolution[1u];
    float t = _227.iTime * _227.uSpeed;
    float4 acc = float4(0.0);
    for (int cLayer = 0; cLayer < 2; cLayer++)
    {
        float cl = float(cLayer);
        float beads = ((cLayer == 0) ? 34.0 : 19.0) / _227.uSize;
        float2 bq = (p * beads) + float2(cl * 5.30000019073486328125);
        float2 bid = floor(bq);
        float2 param = bid + float2(cl * 11.1000003814697265625);
        float2 bh = hash22(param);
        float life = fract((_227.iTime * 0.039999999105930328369140625) + (bh.x * 7.0));
        float br = ((0.14000000059604644775390625 + (0.20000000298023223876953125 * bh.y)) / beads) * sin(3.141590118408203125 * life);
        float2 param_1 = (bid + float2(5.0)) + float2(cl * 7.0);
        if (hash12(param_1) < (_227.uDensity * ((cLayer == 0) ? 1.0 : 0.449999988079071044921875)))
        {
            float4 param_2 = acc;
            float2 param_3 = ((fract(bq) - float2(0.5)) - ((bh - float2(0.5)) * 0.4199999868869781494140625)) / float2(beads);
            float param_4 = br;
            float param_5 = px;
            float4 _409 = paintDrop(param_2, param_3, param_4, param_5, _227);
            acc = _409;
        }
    }
    for (int i = 0; i < 2; i++)
    {
        float fi = float(i);
        float2 cell = (float2(0.119999997317790985107421875, 0.300000011920928955078125) * _227.uSize) * (1.0 - (0.300000011920928955078125 * fi));
        float2 q = (p / cell) + float2(fi * 3.7000000476837158203125, 0.0);
        float column = floor(q.x);
        float2 param_6 = float2(column, fi);
        q.y += ((t * 0.1500000059604644775390625) + (hash12(param_6) * 9.0));
        float2 id = floor(q);
        float2 f = fract(q) - float2(0.5);
        float2 param_7 = id + float2(fi * 17.0);
        float2 h = hash22(param_7);
        if (h.x > _227.uDensity)
        {
            continue;
        }
        float tt = (t * 1.2000000476837158203125) + (h.y * 6.28318023681640625);
        float y = (-0.37999999523162841796875) * sin(tt + sin(tt + (sin(tt) * 0.5)));
        float base = (h.y - 0.5) * 0.300000011920928955078125;
        float wobble = h.x * 6.28318023681640625;
        float x = base + (0.02999999932944774627685546875 * sin((y * 9.0) + wobble));
        float aspect = cell.x / cell.y;
        float r = cell.y * (0.054999999701976776123046875 + (0.0419999994337558746337890625 * fract(h.x * 13.69999980926513671875)));
        float2 d = float2((f.x - x) * aspect, f.y - y) * cell.y;
        d.x *= (1.0 + (0.2199999988079071044921875 * fast::clamp(d.y / fast::max(r, 9.9999997473787516355514526367188e-06), 0.0, 1.0)));
        d.y *= ((d.y > 0.0) ? 0.680000007152557373046875 : 1.0499999523162841796875);
        float4 param_8 = acc;
        float2 param_9 = d;
        float param_10 = r;
        float param_11 = px;
        float4 _591 = paintDrop(param_8, param_9, param_10, param_11, _227);
        acc = _591;
        if (f.y > y)
        {
            float txPath = base + (0.02999999932944774627685546875 * sin((f.y * 9.0) + wobble));
            float streakDist = abs((f.x - txPath) * aspect) * cell.y;
            float fade = 1.0 - fast::clamp((f.y - y) / (0.5 - y), 0.0, 1.0);
            float streak = (exp((-streakDist) / fast::max(r * 0.2800000011920928955078125, px)) * fade) * 0.2199999988079071044921875;
            float4 param_12 = acc;
            float3 param_13 = mix(_227.uTint, float3(1.0), float3(0.449999988079071044921875));
            float param_14 = streak;
            acc = over(param_12, param_13, param_14);
            float rows = 11.0;
            float row = floor(f.y * rows);
            float tx = base + (0.02999999932944774627685546875 * sin((((row + 0.5) / rows) * 9.0) + wobble));
            float2 bd = float2((f.x - tx) * aspect, (fract(f.y * rows) - 0.5) / rows) * cell.y;
            float2 param_15 = (id * 3.099999904632568359375) + float2(row, fi);
            float keep = step(0.300000011920928955078125, hash12(param_15));
            float4 param_16 = acc;
            float2 param_17 = bd;
            float param_18 = ((r * 0.36000001430511474609375) * fade) * keep;
            float param_19 = px;
            float4 _715 = paintDrop(param_16, param_17, param_18, param_19, _227);
            acc = _715;
        }
    }
    float4 param_20 = acc;
    fragColor = unpremultiply(param_20);
}

fragment flair_rain_on_glass_frag_out flair_rain_on_glass_frag(constant FlairUniforms& _227 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_rain_on_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _733;
    if (_227.flair_flipY > 0.5)
    {
        _733 = _227.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _733 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _733);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _227);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

