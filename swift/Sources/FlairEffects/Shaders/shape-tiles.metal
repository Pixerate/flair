// flair-metal-hash: bddf6297
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
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    float uSize;
    float uRate;
    float uStagger;
};

struct flair_shape_tiles_frag_out
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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 tileState(thread const float2& cell, thread const float& beat)
{
    float2 param = cell + (float2(7.309999942779541015625, 3.1700000762939453125) * beat);
    float2 a = hash22(param);
    float2 param_1 = ((cell * 1.7000000476837158203125) + float2(11.0)) + (float2(5.110000133514404296875, 9.729999542236328125) * beat);
    float2 b = hash22(param_1);
    return float4(fast::min(floor(a.x * 6.0), 5.0), fast::min(floor(a.y * 4.0), 3.0), fast::min(floor(b.x * 4.0), 3.0), 1.0 + fast::min(floor(b.y * 3.0), 2.0));
}

static inline __attribute__((always_inline))
float2 quarterTurns(thread const float2& q, thread const int& n)
{
    float2 _237;
    if (n == 0)
    {
        _237 = q;
    }
    else
    {
        float2 _244;
        if (n == 1)
        {
            _244 = float2(q.y, -q.x);
        }
        else
        {
            float2 _256;
            if (n == 2)
            {
                _256 = -q;
            }
            else
            {
                _256 = float2(-q.y, q.x);
            }
            _244 = _256;
        }
        _237 = _244;
    }
    return _237;
}

static inline __attribute__((always_inline))
float tileShape(thread const float2& q, thread const int& kind)
{
    if (kind == 0)
    {
        return length(q) - 0.36000001430511474609375;
    }
    if (kind == 1)
    {
        return length(q + float2(0.5)) - 0.86000001430511474609375;
    }
    if (kind == 2)
    {
        return length(float2(q.x, q.y + 0.5)) - 0.5;
    }
    if (kind == 3)
    {
        return (abs(q.x) + abs(q.y)) - 0.439999997615814208984375;
    }
    if (kind == 4)
    {
        return abs(length(q) - 0.2899999916553497314453125) - 0.100000001490116119384765625;
    }
    return fast::max(abs(q.x), abs(q.y)) - 0.2700000107288360595703125;
}

static inline __attribute__((always_inline))
float3 flatColour(thread const int& i, constant FlairUniforms& _129)
{
    int k = i - (4 * (i / 4));
    float3 _118;
    if (k == 0)
    {
        _118 = _129.uColorA;
    }
    else
    {
        float3 _138;
        if (k == 1)
        {
            _138 = _129.uColorB;
        }
        else
        {
            float3 _148;
            if (k == 2)
            {
                _148 = _129.uColorC;
            }
            else
            {
                _148 = float3(_129.uColorD);
            }
            _138 = _148;
        }
        _118 = _138;
    }
    return _118;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _129)
{
    float2 g = (fragCoord - (float2(_129.iResolution[0], _129.iResolution[1]) * 0.5)) / float2(_129.uSize);
    float2 cell = floor(g);
    float2 q = fract(g) - float2(0.5);
    float2 param = cell + float2(0.5);
    float T = ((_129.iTime * _129.uRate) + 0.449999988079071044921875) + ((0.5 * _129.uStagger) * hash12(param));
    float beat = floor(T);
    float e = smoothstep(0.0, 0.4000000059604644775390625, fract(T));
    float2 param_1 = cell;
    float param_2 = beat - 1.0;
    float4 was = tileState(param_1, param_2);
    float2 param_3 = cell;
    float param_4 = beat;
    float4 now = tileState(param_3, param_4);
    float2 param_5 = q;
    int param_6 = int(was.y);
    float2 param_7 = quarterTurns(param_5, param_6);
    int param_8 = int(was.x);
    float2 param_9 = q;
    int param_10 = int(now.y);
    float2 param_11 = quarterTurns(param_9, param_10);
    int param_12 = int(now.x);
    float d = mix(tileShape(param_7, param_8), tileShape(param_11, param_12), e);
    float px = 1.5 / _129.uSize;
    int param_13 = int(was.z);
    int param_14 = int(now.z);
    float3 shape = mix(flatColour(param_13, _129), flatColour(param_14, _129), float3(e));
    int param_15 = int(was.z + was.w);
    int param_16 = int(now.z + now.w);
    float3 ground = mix(flatColour(param_15, _129), flatColour(param_16, _129), float3(e));
    fragColor = float4(mix(ground, shape, float3(smoothstep(px, -px, d))), 1.0);
}

fragment flair_shape_tiles_frag_out flair_shape_tiles_frag(constant FlairUniforms& _129 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_shape_tiles_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _485;
    if (_129.flair_flipY > 0.5)
    {
        _485 = _129.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _485 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _485);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _129);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

