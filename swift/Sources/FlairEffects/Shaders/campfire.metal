// flair-metal-hash: 78c2b2c1
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
    float uSize;
    float uHeight;
    float uSpeed;
    float uSparks;
    float uSmoke;
    float3 uHot;
    float3 uMid;
    float3 uCool;
    float3 uLogs;
    float3 uGround;
    float3 uSky;
};

struct flair_campfire_frag_out
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
float flameNoise(thread const float2& p, thread const float& t)
{
    float2 param = (p * 0.60000002384185791015625) + float2(0.0, (-t) * 0.5);
    int param_1 = 3;
    float _286 = fbm(param, param_1);
    float2 param_2 = (p * 0.60000002384185791015625) + float2(4.30000019073486328125, 1.7000000476837158203125 - (t * 0.699999988079071044921875));
    int param_3 = 3;
    float _298 = fbm(param_2, param_3);
    float2 w = float2(_286, _298);
    float2 param_4 = (p + ((w - float2(0.5)) * 1.7999999523162841796875)) + float2(0.0, -t);
    int param_5 = 4;
    float _314 = fbm(param_4, param_5);
    return _314;
}

static inline __attribute__((always_inline))
float3 fireLight(thread float& h, constant FlairUniforms& _237)
{
    h = fast::clamp(h, 0.0, 1.0);
    float3 c = _237.uCool * smoothstep(0.0, 0.20000000298023223876953125, h);
    c = mix(c, _237.uMid, float3(smoothstep(0.2199999988079071044921875, 0.550000011920928955078125, h)));
    c = mix(c, _237.uHot, float3(smoothstep(0.60000002384185791015625, 0.949999988079071044921875, h)));
    return c * (0.699999988079071044921875 + ((3.0 * h) * h));
}

static inline __attribute__((always_inline))
float logDist(thread const float2& p, thread const float2& a, thread const float2& b, thread const float& r)
{
    float2 ab = b - a;
    float t = fast::clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length((p - a) - (ab * t)) - r;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float sparks(thread const float2& p, thread const float& t, thread const float& amount)
{
    float s = 0.0;
    for (int l = 0; l < 3; l++)
    {
        float fl = float(l);
        float scale = 7.0 + (5.0 * fl);
        float2 q = (p * scale) - float2(0.0, t * (2.2000000476837158203125 + (0.60000002384185791015625 * fl)));
        float2 cell = floor(q);
        float2 param = cell + float2(fl * 31.700000762939453125);
        float2 param_1 = cell + float2(7.69999980926513671875, fl);
        float3 h = float3(hash22(param), hash12(param_1));
        if (h.z > (amount * 0.5))
        {
            continue;
        }
        float2 c = (float2(0.25) + (h.xy * 0.5)) + float2(0.119999997317790985107421875 * sin((t * 2.5) + (h.x * 40.0)), 0.0);
        float2 d = ((fract(q) - c) * float2(1.0, 0.550000011920928955078125)) / float2(scale);
        float r = (0.001599999959580600261688232421875 + (0.001599999959580600261688232421875 * h.y)) * (1.0 - (0.25 * fl));
        float twinkle = 0.550000011920928955078125 + (0.449999988079071044921875 * sin((t * 17.0) + (h.y * 60.0)));
        s += (exp((-dot(d, d)) / (r * r)) * twinkle);
    }
    return s;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _237)
{
    float px = 1.0 / _237.iResolution[1u];
    float2 p = (((fragCoord - (float2(_237.iResolution[0], _237.iResolution[1]) * 0.5)) * px) - float2(0.0, -0.300000011920928955078125)) / float2(_237.uSize);
    float t = _237.iTime * _237.uSpeed;
    float2 param = float2(t * 9.0, 1.0);
    float flicker = (0.85000002384185791015625 + (0.100000001490116119384765625 * sin(t * 3.099999904632568359375))) + ((0.07999999821186065673828125 * (vnoise(param) - 0.5)) * 2.0);
    float horizon = (-0.07999999821186065673828125) + (0.00999999977648258209228515625 * sin(p.x * 3.0));
    float3 col = mix(_237.uSky, _237.uSky * 1.60000002384185791015625, float3(smoothstep(0.60000002384185791015625, -0.100000001490116119384765625, p.y)));
    if (p.y < horizon)
    {
        float2 param_1 = p * float2(30.0, 60.0);
        int param_2 = 3;
        float _559 = fbm(param_1, param_2);
        float gr = _559;
        col = _237.uGround * (0.699999988079071044921875 + (0.5 * gr));
        float pool = exp((-length((p - float2(0.0, -0.0199999995529651641845703125)) * float2(1.0, 3.2000000476837158203125))) / 0.2199999988079071044921875);
        col += ((((_237.uMid * pool) * 0.550000011920928955078125) * flicker) + ((((_237.uHot * pool) * pool) * 0.25) * flicker));
        for (int i = 0; i < 9; i++)
        {
            float a = (3.141590118408203125 * (0.039999999105930328369140625 + ((0.920000016689300537109375 * float(i)) / 8.0))) + 3.141590118408203125;
            float2 sc = float2(cos(a) * 0.300000011920928955078125, (sin(a) * 0.07500000298023223876953125) - 0.0199999995529651641845703125);
            float2 param_3 = float2(float(i), 4.0);
            float sd = (length((p - sc) * float2(1.0, 1.60000002384185791015625)) - 0.0350000001490116119384765625) - (0.00999999977648258209228515625 * hash12(param_3));
            float3 stone = (float3(0.2199999988079071044921875, 0.20000000298023223876953125, 0.189999997615814208984375) * (0.60000002384185791015625 + (0.4000000059604644775390625 * smoothstep(0.02999999932944774627685546875, -0.02999999932944774627685546875, p.y - sc.y)))) + (((_237.uMid * 0.25) * flicker) * smoothstep(-0.00999999977648258209228515625, 0.02999999932944774627685546875, (-(p.y - sc.y)) * (-1.0)));
            col = mix(col, stone, float3(smoothstep(px / _237.uSize, 0.0, sd)));
        }
    }
    col += (((_237.uMid * exp((-length(p - float2(0.0, 0.100000001490116119384765625))) / 0.3499999940395355224609375)) * 0.180000007152557373046875) * flicker);
    float2 sq = p - float2(0.0, 0.4199999868869781494140625 * _237.uHeight);
    float2 param_4 = float2((sq.x * 5.0) - (sin((sq.y * 2.0) + (t * 0.300000011920928955078125)) * 0.60000002384185791015625), (sq.y * 3.0) - (t * 0.5));
    int param_5 = 4;
    float _740 = fbm(param_4, param_5);
    float plume = _740;
    float spread = 0.0599999986588954925537109375 + (fast::max(sq.y, 0.0) * 0.4000000059604644775390625);
    float smoke = ((smoothstep(0.449999988079071044921875, 0.800000011920928955078125, plume) * exp(((-sq.x) * sq.x) / (spread * spread))) * smoothstep(-0.100000001490116119384765625, 0.100000001490116119384765625, sq.y)) * exp((-fast::max(sq.y, 0.0)) * 1.5);
    col = mix(col, float3(0.300000011920928955078125, 0.2800000011920928955078125, 0.2700000107288360595703125), float3(fast::clamp(smoke * _237.uSmoke, 0.0, 0.800000011920928955078125)));
    float2 param_6 = float2(p.x * 7.0, p.y * 4.5);
    float param_7 = t * 2.400000095367431640625;
    float n = flameNoise(param_6, param_7);
    float h = 0.550000011920928955078125 * _237.uHeight;
    float y = (p.y + 0.0199999995529651641845703125) / h;
    float w = (0.17000000178813934326171875 * (1.0 - (0.75 * fast::clamp(y, 0.0, 1.0)))) * (1.0 + ((0.3499999940395355224609375 * sin((y * 4.0) - (t * 3.0))) * fast::clamp(y, 0.0, 1.0)));
    float sway = (0.039999999105930328369140625 * sin((t * 1.2999999523162841796875) + (y * 2.5))) * y;
    float heat = (((1.0 - y) * 1.2000000476837158203125) - ((abs(p.x - sway) / w) * 0.75)) + ((n - 0.5) * 1.5);
    heat *= smoothstep(-0.25, 0.0500000007450580596923828125, y);
    heat = fast::clamp(heat, 0.0, 1.0);
    float param_8 = heat;
    float3 _872 = fireLight(param_8, _237);
    float3 light = _872;
    spvUnsafeArray<float2, 6> logs;
    logs[0] = float2(-0.2599999904632568359375, -0.070000000298023223876953125);
    logs[1] = float2(0.20000000298023223876953125, 0.0599999986588954925537109375);
    logs[2] = float2(0.2599999904632568359375, -0.070000000298023223876953125);
    logs[3] = float2(-0.20000000298023223876953125, 0.0599999986588954925537109375);
    logs[4] = float2(-0.2199999988079071044921875, -0.0199999995529651641845703125);
    logs[5] = float2(0.2199999988079071044921875, -0.0350000001490116119384765625);
    float logMask = 0.0;
    float3 logCol = float3(0.0);
    for (int i_1 = 0; i_1 < 3; i_1++)
    {
        float2 a_1 = logs[i_1 * 2];
        float2 b = logs[(i_1 * 2) + 1];
        float r = 0.0320000015199184417724609375 - (0.0040000001899898052215576171875 * float(i_1));
        float2 param_9 = p;
        float2 param_10 = a_1;
        float2 param_11 = b;
        float param_12 = r;
        float ld = logDist(param_9, param_10, param_11, param_12);
        float m = smoothstep(px / _237.uSize, 0.0, ld);
        if (m <= 0.0)
        {
            continue;
        }
        float2 ab = fast::normalize(b - a_1);
        float across = dot(p - a_1, float2(-ab.y, ab.x)) / r;
        float2 param_13 = float2(dot(p - a_1, ab) * 40.0, across * 2.0);
        int param_14 = 3;
        float _978 = fbm(param_13, param_14);
        float bark = _978;
        float3 c = (_237.uLogs * (0.5 + (0.60000002384185791015625 * bark))) * (0.550000011920928955078125 + (0.449999988079071044921875 * smoothstep(-1.0, 0.60000002384185791015625, across)));
        float2 param_15 = (p * 30.0) + float2(0.0, (-t) * 0.4000000059604644775390625);
        int param_16 = 3;
        float _1008 = fbm(param_15, param_16);
        float burn = smoothstep(0.2199999988079071044921875, 0.0199999995529651641845703125, length(p - float2(0.0))) * smoothstep(0.3499999940395355224609375, 0.64999997615814208984375, _1008);
        c = mix(c, float3(0.0500000007450580596923828125, 0.02999999932944774627685546875, 0.0199999995529651641845703125), float3(smoothstep(0.180000007152557373046875, 0.0500000007450580596923828125, length(p)) * 0.60000002384185791015625));
        float param_17 = 0.4000000059604644775390625 + (0.4000000059604644775390625 * burn);
        float3 _1023 = fireLight(param_17, _237);
        c += (float3(1.0) - exp((((-_1023) * burn) * flicker) * 1.39999997615814208984375));
        c += (((_237.uMid * 0.180000007152557373046875) * flicker) * smoothstep(-0.20000000298023223876953125, 0.20000000298023223876953125, p.y + 0.0599999986588954925537109375));
        if (m > logMask)
        {
            logCol = c;
            logMask = m;
        }
    }
    float coal = smoothstep(0.0199999995529651641845703125, -0.004999999888241291046142578125, length((p - float2(0.0, -0.064999997615814208984375)) * float2(1.0, 3.0)) - 0.17000000178813934326171875);
    float2 param_18 = (p * 50.0) + float2(t * 0.300000011920928955078125);
    int param_19 = 3;
    float _1078 = fbm(param_18, param_19);
    float param_20 = 0.300000011920928955078125 + (0.5 * _1078);
    float3 _1082 = fireLight(param_20, _237);
    float3 coals = float3(1.0) - exp(((-_1082) * 1.2000000476837158203125) * flicker);
    col = mix(col, coals, float3(coal));
    col += (float3(1.0) - exp((-light) * (1.0 - (logMask * 0.85000002384185791015625))));
    col = mix(col, logCol, float3(logMask * smoothstep(0.75, 0.20000000298023223876953125, heat)));
    col += (((float3(1.0) - exp(-light)) * logMask) * smoothstep(0.20000000298023223876953125, 0.75, heat));
    float rise = (smoothstep(0.0, 0.25, p.y) * exp((-fast::max(p.y - 0.300000011920928955078125, 0.0)) * 2.0)) * exp((-abs(p.x)) / (0.0599999986588954925537109375 + (0.25 * fast::max(p.y, 0.0))));
    float2 swirl = float2(p.x + (0.0500000007450580596923828125 * sin((p.y * 6.0) - (t * 1.5))), p.y);
    float2 param_21 = swirl * _237.uSize;
    float param_22 = t * 0.800000011920928955078125;
    float param_23 = _237.uSparks;
    col += (((mix(_237.uHot, _237.uMid, float3(0.5)) * sparks(param_21, param_22, param_23)) * rise) * 2.0);
    fragColor = float4(col, 1.0);
}

fragment flair_campfire_frag_out flair_campfire_frag(constant FlairUniforms& _237 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_campfire_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1207;
    if (_237.flair_flipY > 0.5)
    {
        _1207 = _237.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1207 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1207);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _237);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

