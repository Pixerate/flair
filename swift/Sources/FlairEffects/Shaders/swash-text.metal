// flair-metal-hash: d3a9c853
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    float3 uInk;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float uSize;
    float uLength;
    float3 uTail;
    float3 uMid;
    packed_float3 uHead;
    float uWidth;
    float uOpacity;
    float uTwist;
    float uGlow;
    float uSparkle;
    uint uWeave;
    float uFrost;
    char _m28_pad[8];
    packed_float3 uFrostColor;
    float uCycle;
    uint uAnimate;
    float uProgress;
};

constant spvUnsafeArray<float2, 19> _441 = spvUnsafeArray<float2, 19>({ float2(0.0, 0.800000011920928955078125), float2(0.180000007152557373046875, 0.86000001430511474609375), float2(0.36000001430511474609375, 0.7400000095367431640625), float2(0.439999997615814208984375, 0.4199999868869781494140625), float2(0.4900000095367431640625, 0.180000007152557373046875), float2(0.4099999964237213134765625, -0.0599999986588954925537109375), float2(0.3400000035762786865234375, 0.100000001490116119384765625), float2(0.2800000011920928955078125, 0.2599999904632568359375), float2(0.4000000059604644775390625, 0.579999983310699462890625), float2(0.5, 0.7599999904632568359375), float2(0.569999992847442626953125, 0.89999997615814208984375), float2(0.64999997615814208984375, 0.920000016689300537109375), float2(0.709999978542327880859375, 0.660000026226043701171875), float2(0.769999980926513671875, 0.4000000059604644775390625), float2(0.829999983310699462890625, -0.119999997317790985107421875), float2(0.910000026226043701171875, -0.14000000059604644775390625), float2(0.9700000286102294921875, -0.1599999964237213134765625), float2(1.0099999904632568359375, -0.0199999995529651641845703125), float2(0.9900000095367431640625, 0.180000007152557373046875) });

struct flair_swash_text_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 textBox(texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _275)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_275.uSize, ((_275.iResolution[0u] / _275.iResolution[1u]) * _275.uSize) / aspect);
    return float2(h * aspect, h);
}

static inline __attribute__((always_inline))
float2 swashPoint(thread const int& i, thread const float2& box, constant FlairUniforms& _275)
{
    float2 c = _441[i];
    return (float2(0.5 + ((c.x - 0.5) * _275.uLength), 0.930000007152557373046875 - (c.y * 0.89999997615814208984375)) - float2(0.5)) * box;
}

static inline __attribute__((always_inline))
float2 cubic(thread const float2& a, thread const float2& b, thread const float2& c, thread const float2& d, thread const float& t)
{
    float u = 1.0 - t;
    return (((a * ((u * u) * u)) + (b * (((3.0 * u) * u) * t))) + (c * (((3.0 * u) * t) * t))) + (d * ((t * t) * t));
}

static inline __attribute__((always_inline))
float3 swashNearest(thread const float2& p, thread const float2& box, constant FlairUniforms& _275)
{
    float best = 1000000000.0;
    float bestS = 0.0;
    float s = 0.0;
    int param = 0;
    float2 param_1 = box;
    float2 prev = swashPoint(param, param_1, _275);
    for (int k = 0; k < 6; k++)
    {
        int param_2 = 3 * k;
        float2 param_3 = box;
        float2 a = swashPoint(param_2, param_3, _275);
        int param_4 = (3 * k) + 1;
        float2 param_5 = box;
        float2 b = swashPoint(param_4, param_5, _275);
        int param_6 = (3 * k) + 2;
        float2 param_7 = box;
        float2 c = swashPoint(param_6, param_7, _275);
        int param_8 = (3 * k) + 3;
        float2 param_9 = box;
        float2 d = swashPoint(param_8, param_9, _275);
        for (int j = 1; j <= 10; j++)
        {
            float2 param_10 = a;
            float2 param_11 = b;
            float2 param_12 = c;
            float2 param_13 = d;
            float param_14 = float(j) / 10.0;
            float2 q = cubic(param_10, param_11, param_12, param_13, param_14);
            float2 e = q - prev;
            float len = length(e);
            float h = fast::clamp(dot(p - prev, e) / fast::max(len * len, 9.999999717180685365747194737196e-10), 0.0, 1.0);
            float dist = length((p - prev) - (e * h));
            if (dist < best)
            {
                best = dist;
                bestS = s + (h * len);
            }
            s += len;
            prev = q;
        }
    }
    return float3(best, bestS, s);
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
float3 ribbonColour(thread const float& t, constant FlairUniforms& _275)
{
    float3 _685;
    if (t < 0.5)
    {
        _685 = mix(_275.uTail, _275.uMid, float3(t * 2.0));
    }
    else
    {
        _685 = mix(_275.uMid, float3(_275.uHead), float3((t - 0.5) * 2.0));
    }
    return _685;
}

static inline __attribute__((always_inline))
float3 textPlace(thread const float2& p, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _275)
{
    float2 size = float2(int2(uText.get_width(), uText.get_height()));
    float aspect = size.x / fast::max(size.y, 1.0);
    float h = fast::min(_275.uSize, ((_275.iResolution[0u] / _275.iResolution[1u]) * _275.uSize) / aspect);
    return float3((p / float2(h * aspect, h)) + float2(0.5), size.y / h);
}

static inline __attribute__((always_inline))
float textAt(thread const float2& p, thread const float& blur, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _275)
{
    float2 param = p;
    float3 m = textPlace(param, uText, uTextSmplr, _275);
    bool _315 = m.x < 0.0;
    bool _322;
    if (!_315)
    {
        _322 = m.x > 1.0;
    }
    else
    {
        _322 = _315;
    }
    bool _329;
    if (!_322)
    {
        _329 = m.y < 0.0;
    }
    else
    {
        _329 = _322;
    }
    bool _336;
    if (!_329)
    {
        _336 = m.y > 1.0;
    }
    else
    {
        _336 = _329;
    }
    if (_336)
    {
        return 0.0;
    }
    return uText.sample(uTextSmplr, m.xy, level(log2(fast::max(blur * m.z, 1.0)))).w;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& dst, thread const float3& col, thread const float& a)
{
    return float4((col * a) + (dst.xyz * (1.0 - a)), a + (dst.w * (1.0 - a)));
}

static inline __attribute__((always_inline))
float2 swashAt(thread const float& u, thread const float2& box, constant FlairUniforms& _275)
{
    float f = fast::clamp(u, 0.0, 0.99989998340606689453125) * 6.0;
    int k = int(floor(f));
    int param = 3 * k;
    float2 param_1 = box;
    int param_2 = (3 * k) + 1;
    float2 param_3 = box;
    int param_4 = (3 * k) + 2;
    float2 param_5 = box;
    int param_6 = (3 * k) + 3;
    float2 param_7 = box;
    float2 param_8 = swashPoint(param, param_1, _275);
    float2 param_9 = swashPoint(param_2, param_3, _275);
    float2 param_10 = swashPoint(param_4, param_5, _275);
    float2 param_11 = swashPoint(param_6, param_7, _275);
    float param_12 = f - float(k);
    return cubic(param_8, param_9, param_10, param_11, param_12);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, texture2d<float> uText, sampler uTextSmplr, constant FlairUniforms& _275)
{
    float px = 1.0 / _275.iResolution[1u];
    float2 p = (fragCoord - (float2(_275.iResolution[0], _275.iResolution[1]) * 0.5)) * px;
    float2 box = textBox(uText, uTextSmplr, _275);
    float _756;
    if (_275.uAnimate != 0u)
    {
        _756 = fract(_275.iTime / _275.uCycle);
    }
    else
    {
        _756 = _275.uProgress;
    }
    float prog = _756;
    float drawT = fast::clamp(prog / 0.3499999940395355224609375, 0.0, 1.0);
    float reveal = 1.0 - powr(1.0 - drawT, 3.0);
    float erase = smoothstep(0.579999983310699462890625, 0.87999999523162841796875, prog);
    float fadeOut = mix(1.0 - erase, 1.0, step(0.001000000047497451305389404296875, _275.uFrost));
    float2 param = p;
    float2 param_1 = box;
    float3 near = swashNearest(param, param_1, _275);
    float d = near.x;
    float t = near.y / fast::max(near.z, 9.9999999747524270787835121154785e-07);
    float turn = cos(((t * _275.uTwist) * 6.283100128173828125) + 0.800000011920928955078125);
    float w = ((_275.uWidth * box.y) * (0.07999999821186065673828125 + (0.920000016689300537109375 * smoothstep(0.0, 0.85000002384185791015625, t)))) * (0.300000011920928955078125 + (0.699999988079071044921875 * abs(turn)));
    float halfW = 0.5 * w;
    float aa = 1.2000000476837158203125 * px;
    float cover = smoothstep(halfW + aa, halfW - aa, d);
    cover *= (smoothstep(reveal + 0.0040000001899898052215576171875, reveal - 0.0199999995529651641845703125, t) * smoothstep(0.0, 0.14000000059604644775390625, t));
    float2 param_2 = (p / float2(box.y)) * 22.0;
    int param_3 = 4;
    float _883 = fbm(param_2, param_3);
    float n = _883;
    float edge = (erase * 1.2999999523162841796875) - 0.1500000059604644775390625;
    float thr = t + ((n - 0.5) * 0.300000011920928955078125);
    float alive = mix(1.0, smoothstep(edge - 0.014999999664723873138427734375, edge + 0.014999999664723873138427734375, thr), step(0.001000000047497451305389404296875, _275.uFrost));
    float rim = ((_275.uFrost * step(0.001000000047497451305389404296875, erase)) * exp(-powr((thr - edge) / 0.02999999932944774627685546875, 2.0))) * smoothstep(reveal + 0.00999999977648258209228515625, reveal - 0.039999999105930328369140625, t);
    float across = fast::clamp(d / fast::max(halfW, 9.9999999747524270787835121154785e-07), 0.0, 1.0);
    float _round = sqrt(fast::max(1.0 - (across * across), 0.0));
    float param_4 = t;
    float3 base = ribbonColour(param_4, _275);
    float3 _952;
    if (turn >= 0.0)
    {
        _952 = base;
    }
    else
    {
        _952 = mix(base * 0.550000011920928955078125, float3(_275.uHead) * 0.5, float3(0.3499999940395355224609375));
    }
    float3 col = _952;
    col *= (0.550000011920928955078125 + (0.550000011920928955078125 * _round));
    col += float3(powr(_round, 16.0) * ((turn >= 0.0) ? 0.75 : 0.25));
    col += ((float3(0.5) + (cos((float3((t * 2.0) + across) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.283100128173828125) * 0.5)) * (0.2199999988079071044921875 * smoothstep(0.699999988079071044921875, 1.0, across)));
    float ribbonA = ((cover * alive) * _275.uOpacity) * fadeOut;
    col = mix(col, float3(_275.uFrostColor), float3(fast::clamp(rim * 1.5, 0.0, 1.0)));
    float drawn = smoothstep(reveal + 0.00999999977648258209228515625, reveal - 0.039999999105930328369140625, t);
    float glow = (((((_275.uGlow * 0.449999988079071044921875) * exp(-powr(d / ((halfW * 3.0) + 0.0040000001899898052215576171875), 2.0))) * drawn) * alive) * fadeOut) * smoothstep(0.0, 0.20000000298023223876953125, t);
    float2 param_5 = (p / float2(box.y)) * 60.0;
    float haze = ((((_275.uFrost * (1.0 - alive)) * exp(-powr(d / ((halfW * 1.7999999523162841796875) + 0.0030000000260770320892333984375), 2.0))) * (1.0 - smoothstep(0.7799999713897705078125, 0.9700000286102294921875, prog))) * (0.3499999940395355224609375 + (0.64999997615814208984375 * vnoise(param_5)))) * drawn;
    bool _1097 = _275.uWeave != 0u;
    bool _1112;
    if (_1097)
    {
        bool _1102 = t < 0.2700000107288360595703125;
        bool _1111;
        if (!_1102)
        {
            _1111 = (t > 0.5) && (t < 0.660000026226043701171875);
        }
        else
        {
            _1111 = _1102;
        }
        _1112 = _1111;
    }
    else
    {
        _1112 = _1097;
    }
    bool behind = _1112;
    float2 param_6 = p;
    float param_7 = 1.2000000476837158203125 * px;
    float mask = textAt(param_6, param_7, uText, uTextSmplr, _275);
    float2 param_8 = p - (float2(0.01200000010430812835693359375, -0.017999999225139617919921875) * box.y);
    float param_9 = 0.0199999995529651641845703125 * box.y;
    float shade = 0.5 * textAt(param_8, param_9, uText, uTextSmplr, _275);
    float4 c = float4(float3(_275.uBackground) * _275.uBackgroundAlpha, _275.uBackgroundAlpha);
    if (behind)
    {
        float4 param_10 = c;
        float3 param_11 = base;
        float param_12 = glow * 0.60000002384185791015625;
        c = over(param_10, param_11, param_12);
        float4 param_13 = c;
        float3 param_14 = col * (1.0 - shade);
        float param_15 = ribbonA;
        c = over(param_13, param_14, param_15);
        float4 param_16 = c;
        float3 param_17 = _275.uInk;
        float param_18 = mask;
        c = over(param_16, param_17, param_18);
    }
    else
    {
        float4 param_19 = c;
        float3 param_20 = _275.uInk;
        float param_21 = mask;
        c = over(param_19, param_20, param_21);
        float4 param_22 = c;
        float3 param_23 = base;
        float param_24 = glow;
        c = over(param_22, param_23, param_24);
        float4 param_25 = c;
        float3 param_26 = col;
        float param_27 = ribbonA;
        c = over(param_25, param_26, param_27);
    }
    float4 param_28 = c;
    float3 param_29 = float3(_275.uFrostColor);
    float param_30 = fast::clamp((haze * 0.699999988079071044921875) + ((rim * cover) * 0.800000011920928955078125), 0.0, 1.0);
    c = over(param_28, param_29, param_30);
    float sparks = 0.0;
    for (int i = 0; i < 14; i++)
    {
        float fi = float(i);
        float2 param_31 = float2(fi, 1.7000000476837158203125);
        float u = hash12(param_31);
        if (u > reveal)
        {
            continue;
        }
        float param_32 = u;
        float2 param_33 = box;
        float2 param_34 = float2(fi, 4.30000019073486328125);
        float2 param_35 = float2(fi, 9.1000003814697265625);
        float2 at = (swashAt(param_32, param_33, _275) + (((hash22(param_34) - float2(0.5)) * box.y) * 0.4000000059604644775390625)) - float2(0.0, ((0.07999999821186065673828125 * box.y) * prog) * hash12(param_35));
        float2 param_36 = float2(fi, 5.19999980926513671875);
        float size = (box.y * 0.0199999995529651641845703125) * (0.60000002384185791015625 + (0.800000011920928955078125 * hash12(param_36)));
        float2 q = (p - at) / float2(size);
        float star = exp(-dot(q, q)) + (0.60000002384185791015625 * (exp(((-abs(q.x)) * 1.39999997615814208984375) - ((q.y * q.y) * 9.0)) + exp(((-abs(q.y)) * 1.39999997615814208984375) - ((q.x * q.x) * 9.0))));
        float2 param_37 = float2(fi, 6.599999904632568359375);
        float rate = 3.0 + floor(3.0 * hash12(param_37));
        float2 param_38 = float2(fi, 7.69999980926513671875);
        sparks += (star * (0.5 + (0.5 * sin(6.283100128173828125 * ((prog * rate) + hash12(param_38))))));
    }
    sparks *= ((1.39999997615814208984375 * _275.uSparkle) * (1.0 - smoothstep(0.7799999713897705078125, 0.9700000286102294921875, prog)));
    float4 param_39 = c;
    float3 param_40 = mix(_275.uMid, float3(1.0), float3(0.60000002384185791015625));
    float param_41 = fast::clamp(sparks, 0.0, 1.0);
    c = over(param_39, param_40, param_41);
    fragColor = float4(c.xyz / float3(fast::max(c.w, 9.9999997473787516355514526367188e-06)), c.w);
}

fragment flair_swash_text_frag_out flair_swash_text_frag(constant FlairUniforms& _275 [[buffer(0)]], texture2d<float> uText [[texture(1)]], sampler uTextSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_swash_text_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1405;
    if (_275.flair_flipY > 0.5)
    {
        _1405 = _275.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1405 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1405);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, uText, uTextSmplr, _275);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

