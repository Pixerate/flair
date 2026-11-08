// flair-metal-hash: 436410ce
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
    int uCount;
    int uGroups;
    float uSize;
    float uSpeed;
    float uSpread;
    float uJitter;
    uint uArrows;
    float3 uColor;
    float3 uSkyTop;
    packed_float3 uSkyBottom;
    uint uTransparent;
};

struct flair_boids_frag_out
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
float2 flockAt(thread const float& g, thread const float& t, thread const float& aspect)
{
    float2 param = float2(g, 1.7000000476837158203125);
    float2 h = hash22(param);
    return float2(aspect * ((0.5 + (0.36000001430511474609375 * sin((t * (0.20999999344348907470703125 + (0.0599999986588954925537109375 * h.x))) + (h.y * 6.280000209808349609375)))) + (0.0599999986588954925537109375 * sin((t * 0.569999992847442626953125) + (g * 2.0)))), (0.519999980926513671875 + (0.300000011920928955078125 * sin(((t * (0.2899999916553497314453125 + (0.07999999821186065673828125 * h.y))) + (h.x * 6.280000209808349609375)) + (1.7000000476837158203125 * g)))) + (0.0500000007450580596923828125 * sin((t * 0.730000019073486328125) + (g * 3.0))));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float2 birdAt(thread const float& fi, thread const float& t, thread const float& aspect, constant FlairUniforms& _361)
{
    float2 param = float2(fi, 3.099999904632568359375);
    float2 h = hash22(param);
    float groups = float(_361.uGroups);
    float sw = ((t * 0.0599999986588954925537109375) * (0.60000002384185791015625 + (0.800000011920928955078125 * h.y))) + (h.x * 10.0);
    float k = floor(sw);
    float2 param_1 = float2(fi, k);
    float ga = floor(hash12(param_1) * groups);
    float2 param_2 = float2(fi, k + 1.0);
    float gb = floor(hash12(param_2) * groups);
    float param_3 = ga;
    float param_4 = t;
    float param_5 = aspect;
    float param_6 = gb;
    float param_7 = t;
    float param_8 = aspect;
    float2 centre = mix(flockAt(param_3, param_4, param_5), flockAt(param_6, param_7, param_8), float2(smoothstep(0.60000002384185791015625, 1.0, fract(sw))));
    float2 param_9 = float2(fi, 8.30000019073486328125);
    float2 o = ((hash22(param_9) - float2(0.5)) * 2.0) * _361.uSpread;
    o.x *= 1.60000002384185791015625;
    float2 jitter = float2(sin((t * (1.10000002384185791015625 + h.x)) + fi), cos((t * (1.2999999523162841796875 + h.y)) + (fi * 1.7000000476837158203125))) * (_361.uJitter * 0.02500000037252902984619140625);
    return (centre + o) + jitter;
}

static inline __attribute__((always_inline))
float sdTriangle(thread const float2& p, thread const float2& p0, thread const float2& p1, thread const float2& p2)
{
    float2 e0 = p1 - p0;
    float2 e1 = p2 - p1;
    float2 e2 = p0 - p2;
    float2 v0 = p - p0;
    float2 v1 = p - p1;
    float2 v2 = p - p2;
    float2 pq0 = v0 - (e0 * fast::clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0));
    float2 pq1 = v1 - (e1 * fast::clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0));
    float2 pq2 = v2 - (e2 * fast::clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0));
    float s = sign((e0.x * e2.y) - (e0.y * e2.x));
    float2 d = fast::min(fast::min(float2(dot(pq0, pq0), s * ((v0.x * e0.y) - (v0.y * e0.x))), float2(dot(pq1, pq1), s * ((v1.x * e1.y) - (v1.y * e1.x)))), float2(dot(pq2, pq2), s * ((v2.x * e2.y) - (v2.y * e2.x))));
    return (-sqrt(d.x)) * sign(d.y);
}

static inline __attribute__((always_inline))
float sdSegment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _361)
{
    float px = 1.0 / _361.iResolution[1u];
    float2 p = fragCoord * px;
    float aspect = _361.iResolution[0u] / _361.iResolution[1u];
    float t = (_361.iTime * _361.uSpeed) * 0.5;
    float len = 0.017999999225139617919921875 * _361.uSize;
    float cover = 0.0;
    float groups = float(_361.uGroups);
    spvUnsafeArray<float2, 4> flocks;
    for (int g = 0; g < 4; g++)
    {
        float param = float(g);
        float param_1 = t;
        float param_2 = aspect;
        flocks[g] = flockAt(param, param_1, param_2);
    }
    float margin = (((1.88999998569488525390625 * _361.uSpread) + (0.03599999845027923583984375 * _361.uJitter)) + (2.03999996185302734375 * len)) + (2.0 * px);
    int near = 0;
    for (int a = 0; a < 4; a++)
    {
        if (a >= _361.uGroups)
        {
            break;
        }
        for (int b = 0; b < 4; b++)
        {
            if (b >= _361.uGroups)
            {
                break;
            }
            float2 pa = p - flocks[a];
            float2 ba = flocks[b] - flocks[a];
            float2 off = pa - (ba * fast::clamp(dot(pa, ba) / fast::max(dot(ba, ba), 9.9999999392252902907785028219223e-09), 0.0, 1.0));
            if (dot(off, off) < (margin * margin))
            {
                near |= (1 << ((a * 4) + b));
            }
        }
    }
    int _699;
    float sd;
    for (int i = 0; i < 120; i++)
    {
        bool _646 = near == 0;
        bool _655;
        if (!_646)
        {
            _655 = i >= _361.uCount;
        }
        else
        {
            _655 = _646;
        }
        if (_655)
        {
            break;
        }
        float fi = float(i);
        float2 param_3 = float2(fi, 3.099999904632568359375);
        float2 h = hash22(param_3);
        float sw = ((t * 0.0599999986588954925537109375) * (0.60000002384185791015625 + (0.800000011920928955078125 * h.y))) + (h.x * 10.0);
        float k = floor(sw);
        float2 param_4 = float2(fi, k);
        int ga = int(floor(hash12(param_4) * groups));
        float glide = smoothstep(0.60000002384185791015625, 1.0, fract(sw));
        if (glide > 0.0)
        {
            float2 param_5 = float2(fi, k + 1.0);
            _699 = int(floor(hash12(param_5) * groups));
        }
        else
        {
            _699 = ga;
        }
        int gb = _699;
        if ((near & (1 << ((ga * 4) + gb))) == 0)
        {
            continue;
        }
        float2 param_6 = float2(fi, 8.30000019073486328125);
        float2 o = ((hash22(param_6) - float2(0.5)) * 2.0) * _361.uSpread;
        o.x *= 1.60000002384185791015625;
        float2 jitter = float2(sin((t * (1.10000002384185791015625 + h.x)) + fi), cos((t * (1.2999999523162841796875 + h.y)) + (fi * 1.7000000476837158203125))) * (_361.uJitter * 0.02500000037252902984619140625);
        float2 pos = (mix(flocks[ga], flocks[gb], float2(glide)) + o) + jitter;
        float2 param_7 = float2(fi, 6.599999904632568359375);
        float scale = 0.699999988079071044921875 + (0.5 * hash12(param_7));
        float l = len * scale;
        float2 dp = p - pos;
        bool _801 = abs(dp.x) > (l * 1.2000000476837158203125);
        bool _811;
        if (!_801)
        {
            _811 = abs(dp.y) > (l * 1.2000000476837158203125);
        }
        else
        {
            _811 = _801;
        }
        if (_811)
        {
            continue;
        }
        float param_8 = fi;
        float param_9 = t - 0.02999999932944774627685546875;
        float param_10 = aspect;
        float2 v = pos - birdAt(param_8, param_9, param_10, _361);
        float2 fwd = v / float2(fast::max(length(v), 9.9999999747524270787835121154785e-07));
        float2 q = float2(dot(dp, fwd), dot(dp, float2(-fwd.y, fwd.x))) / float2(l);
        if (_361.uArrows != 0u)
        {
            float2 param_11 = q;
            float2 param_12 = float2(0.550000011920928955078125, 0.0);
            float2 param_13 = float2(-0.449999988079071044921875, 0.37999999523162841796875);
            float2 param_14 = float2(-0.449999988079071044921875, -0.37999999523162841796875);
            float2 param_15 = q;
            float2 param_16 = float2(-0.20000000298023223876953125, 0.0);
            float2 param_17 = float2(-0.60000002384185791015625, 0.449999988079071044921875);
            float2 param_18 = float2(-0.60000002384185791015625, -0.449999988079071044921875);
            sd = fast::max(sdTriangle(param_11, param_12, param_13, param_14), -sdTriangle(param_15, param_16, param_17, param_18));
        }
        else
        {
            float2 param_19 = float2(fi, 2.2000000476837158203125);
            float flap = sin((_361.iTime * (9.0 + (4.0 * hash12(param_19)))) + (fi * 1.2999999523162841796875));
            float span = 0.550000011920928955078125 + (0.1500000059604644775390625 * flap);
            float2 tipL = float2((-0.3499999940395355224609375) - (0.100000001490116119384765625 * flap), span);
            float2 tipR = float2((-0.3499999940395355224609375) - (0.100000001490116119384765625 * flap), -span);
            float2 elbowL = float2(-0.0500000007450580596923828125, 0.25 + (0.119999997317790985107421875 * flap));
            float2 elbowR = float2(-0.0500000007450580596923828125, (-0.25) - (0.119999997317790985107421875 * flap));
            float2 head = float2(0.300000011920928955078125, 0.0);
            float2 param_20 = q;
            float2 param_21 = head;
            float2 param_22 = elbowL;
            float2 param_23 = q;
            float2 param_24 = elbowL;
            float2 param_25 = tipL;
            float2 param_26 = q;
            float2 param_27 = head;
            float2 param_28 = elbowR;
            float2 param_29 = q;
            float2 param_30 = elbowR;
            float2 param_31 = tipR;
            float bones = fast::min(fast::min(sdSegment(param_20, param_21, param_22), sdSegment(param_23, param_24, param_25)), fast::min(sdSegment(param_26, param_27, param_28), sdSegment(param_29, param_30, param_31)));
            float2 param_32 = q;
            float2 param_33 = float2(-0.25, 0.0);
            float2 param_34 = head;
            float body = sdSegment(param_32, param_33, param_34);
            sd = fast::min(bones - 0.0599999986588954925537109375, body - 0.0900000035762786865234375);
        }
        cover = fast::max(cover, 1.0 - smoothstep((-px) / l, px / l, sd));
    }
    if (_361.uTransparent != 0u)
    {
        fragColor = float4(_361.uColor, cover);
    }
    else
    {
        float3 sky = mix(float3(_361.uSkyBottom), _361.uSkyTop, float3(smoothstep(0.0, 1.0, p.y)));
        fragColor = float4(mix(sky, _361.uColor, float3(cover)), 1.0);
    }
}

fragment flair_boids_frag_out flair_boids_frag(constant FlairUniforms& _361 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_boids_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1050;
    if (_361.flair_flipY > 0.5)
    {
        _1050 = _361.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1050 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1050);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _361);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

