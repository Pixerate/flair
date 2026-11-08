// flair-metal-hash: cf10e424
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
}

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
    float3 uRoot;
    packed_float3 uTip;
    float uDensity;
    float uLength;
    float uWidth;
    float uLie;
    float uSway;
    float uClump;
    float uPart;
};

struct flair_fur_frag_out
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
float3x3 noiseGrid(thread const float2& base)
{
    float3x3 g;
    for (int x = 0; x < 3; x++)
    {
        for (int y = 0; y < 3; y++)
        {
            float2 param = base + float2(float(x), float(y));
            g[x][y] = hash12(param);
        }
    }
    return g;
}

static inline __attribute__((always_inline))
float gridNoise(thread const float2& q, thread const float2& base, thread const float3x3& g)
{
    float2 f = fract(q);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    int2 k = clamp(int2(floor(q) - base), int2(0), int2(1));
    float3 c0 = g[k.x];
    float3 c1 = g[k.x + 1];
    return mix(mix(c0[k.y], c1[k.y], u.x), mix(c0[k.y + 1], c1[k.y + 1], u.x), u.y);
}

static inline __attribute__((always_inline))
float2 strandDir(thread const float2& root, thread const float2& ptr, thread const float& hov, constant FlairUniforms& _277, thread float2& clumpBase, thread float3x3& clumpGrid, thread float2& swayBase, thread float3x3& swayGrid)
{
    float2 param = root * 0.070000000298023223876953125;
    float2 param_1 = clumpBase;
    float3x3 param_2 = clumpGrid;
    float a = radians(_277.uLie) + (((gridNoise(param, param_1, param_2) - 0.5) * 1.60000002384185791015625) * _277.uClump);
    float2 param_3 = (root * 0.0199999995529651641845703125) + float2(_277.iTime * 0.1500000059604644775390625);
    float2 param_4 = swayBase;
    float3x3 param_5 = swayGrid;
    a += ((_277.uSway * 0.699999988079071044921875) * sin((((_277.iTime * 1.2999999523162841796875) + (root.x * 0.0500000007450580596923828125)) + (root.y * 0.02999999932944774627685546875)) + (2.0 * gridNoise(param_3, param_4, param_5))));
    float2 dir = float2(cos(a), sin(a));
    if ((_277.uPart * hov) <= 0.0)
    {
        return dir;
    }
    float2 away = root - ptr;
    float reach = 0.1599999964237213134765625 * _277.uDensity;
    float f = (_277.uPart * hov) * exp((-dot(away, away)) / (reach * reach));
    return fast::normalize(mix(dir, fast::normalize(away + float2(9.9999997473787516355514526367188e-05)), float2(fast::clamp(f * 1.39999997615814208984375, 0.0, 1.0))));
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _277, thread float2& clumpBase, thread float3x3& clumpGrid, thread float2& swayBase, thread float3x3& swayGrid)
{
    float2 p = (fragCoord / float2(_277.iResolution[1u])) * _277.uDensity;
    float2 ptr = (_277.iPointer.xy / float2(_277.iResolution[1u])) * _277.uDensity;
    float hov = fast::clamp(_277.iPointer.z, 0.0, 1.0);
    clumpBase = floor((p - float2(7.0)) * 0.070000000298023223876953125);
    float2 param = clumpBase;
    clumpGrid = noiseGrid(param);
    swayBase = floor(((p - float2(7.0)) * 0.0199999995529651641845703125) + float2(_277.iTime * 0.1500000059604644775390625));
    float2 param_1 = swayBase;
    swayGrid = noiseGrid(param_1);
    float2 param_2 = p;
    float2 param_3 = ptr;
    float param_4 = hov;
    float2 here = strandDir(param_2, param_3, param_4, _277, clumpBase, clumpGrid, swayBase, swayGrid);
    float top = -1.0;
    float across = 0.0;
    float tint = 0.0;
    float2 topDir = here;
    float lie = radians(_277.uLie);
    float R = (1.25 * _277.uLength) + _277.uWidth;
    float2 param_5 = p * 0.070000000298023223876953125;
    float2 param_6 = clumpBase;
    float3x3 param_7 = clumpGrid;
    float cp = ((gridNoise(param_5, param_6, param_7) - 0.5) * 1.60000002384185791015625) * _277.uClump;
    float2 param_8 = (p * 0.0199999995529651641845703125) + float2(_277.iTime * 0.1500000059604644775390625);
    float2 param_9 = swayBase;
    float3x3 param_10 = swayGrid;
    float sp = (_277.uSway * 0.699999988079071044921875) * sin((((_277.iTime * 1.2999999523162841796875) + (p.x * 0.0500000007450580596923828125)) + (p.y * 0.02999999932944774627685546875)) + (2.0 * gridNoise(param_8, param_9, param_10)));
    float dc = (0.2375999987125396728515625 * _277.uClump) * R;
    float ds = (0.100239999592304229736328125 * _277.uSway) * R;
    float2 lo = float2(fast::max((-0.800000011920928955078125) * _277.uClump, cp - dc), fast::max((-0.699999988079071044921875) * _277.uSway, sp - ds));
    float2 hi = float2(fast::min(0.800000011920928955078125 * _277.uClump, cp + dc), fast::min(0.699999988079071044921875 * _277.uSway, sp + ds));
    float mid = lie + (0.5 * (((lo.x + hi.x) + lo.y) + hi.y));
    float cone = (0.5 * (((hi.x - lo.x) + hi.y) - lo.y)) + 0.039999999105930328369140625;
    float2 axis = float2(cos(mid), sin(mid));
    float cosCone = cos(cone);
    float sinCone = sin(cone);
    float reach = 0.1599999964237213134765625 * _277.uDensity;
    bool parting = (_277.uPart * hov) > 0.0;
    float back = 1.25 * _277.uLength;
    float2 e1 = float2(cos(mid + cone), sin(mid + cone)) * (-back);
    float2 e2 = float2(cos(mid - cone), sin(mid - cone)) * (-back);
    float2 boxLo = fast::min(float2(0.0), fast::min(e1, e2));
    float2 boxHi = fast::max(float2(0.0), fast::max(e1, e2));
    if ((-axis.x) >= cosCone)
    {
        boxHi.x = back;
    }
    if (axis.x >= cosCone)
    {
        boxLo.x = -back;
    }
    if ((-axis.y) >= cosCone)
    {
        boxHi.y = back;
    }
    if (axis.y >= cosCone)
    {
        boxLo.y = -back;
    }
    float ptrGap = fast::max(length(p - ptr) - R, 0.0);
    if ((((_277.uPart * hov) * exp(((-ptrGap) * ptrGap) / (reach * reach))) * 1.39999997615814208984375) > 0.0199999995529651641845703125)
    {
        boxLo = float2(-back);
        boxHi = float2(back);
    }
    boxLo += (p - float2(_277.uWidth));
    boxHi += (p + float2(_277.uWidth));
    bool2 up = here < float2(0.0);
    int _830;
    int _864;
    for (int layer = 0; layer < 3; layer++)
    {
        float fl = float(layer);
        float2 off = float2(0.37000000476837158203125, 0.709999978542327880859375) * fl;
        float2 base = floor((p - ((here * _277.uLength) * 0.5)) - off);
        int2 first = int2(fast::max(ceil((boxLo - off) - float2(1.0)), base - float2(2.0)) - base);
        int2 last = int2(fast::min(floor(boxHi - off), base + float2(2.0)) - base);
        for (int row = 0; row < 5; row++)
        {
            if (row > (last.y - first.y))
            {
                break;
            }
            if (up.y)
            {
                _830 = last.y - row;
            }
            else
            {
                _830 = first.y + row;
            }
            int j = _830;
            for (int column = 0; column < 5; column++)
            {
                if (column > (last.x - first.x))
                {
                    break;
                }
                if (up.x)
                {
                    _864 = last.x - column;
                }
                else
                {
                    _864 = first.x + column;
                }
                int i = _864;
                float2 id = base + float2(float(i), float(j));
                float2 param_11 = id + float2(fl * 31.700000762939453125);
                float2 h = hash22(param_11);
                float2 root = (id + off) + h;
                float len = _277.uLength * (0.75 + (0.5 * h.y));
                float2 rp = p - root;
                float r2 = dot(rp, rp);
                float reachLen = len + _277.uWidth;
                bool _929 = (r2 >= (reachLen * reachLen)) || (top >= 1.0);
                bool _947;
                if (!_929)
                {
                    bool _934 = top >= 0.0;
                    bool _946;
                    if (_934)
                    {
                        _946 = r2 <= (((top * top) * len) * len);
                    }
                    else
                    {
                        _946 = _934;
                    }
                    _947 = _946;
                }
                else
                {
                    _947 = _929;
                }
                if (_947)
                {
                    continue;
                }
                bool parted = false;
                if (parting)
                {
                    float2 away = root - ptr;
                    parted = (((_277.uPart * hov) * exp((-dot(away, away)) / (reach * reach))) * 1.39999997615814208984375) > 0.0199999995529651641845703125;
                }
                if ((r2 > (_277.uWidth * _277.uWidth)) && (!parted))
                {
                    float da = dot(rp, axis);
                    if (da < ((cosCone * sqrt(r2 - (_277.uWidth * _277.uWidth))) - (sinCone * _277.uWidth)))
                    {
                        continue;
                    }
                }
                float2 param_12 = root;
                float2 param_13 = ptr;
                float param_14 = hov;
                float2 dir = strandDir(param_12, param_13, param_14, _277, clumpBase, clumpGrid, swayBase, swayGrid);
                float along = fast::clamp(dot(rp, dir) / len, 0.0, 1.0);
                float w = _277.uWidth * (1.0 - (0.75 * along));
                float dist = length(rp - ((dir * along) * len));
                if ((dist < w) && (along > top))
                {
                    top = along;
                    across = dist / w;
                    tint = h.x;
                    topDir = dir;
                }
            }
        }
    }
    float2 param_15 = (p * 0.070000000298023223876953125) + float2(3.0);
    float clump = vnoise(param_15);
    float3 skin = _277.uRoot * 0.300000011920928955078125;
    float3 col = skin;
    if (top >= 0.0)
    {
        float h_1 = top;
        col = mix(_277.uRoot, float3(_277.uTip), float3(powr(h_1, 0.800000011920928955078125))) * (0.85000002384185791015625 + (0.300000011920928955078125 * tint));
        col *= (0.449999988079071044921875 + (0.550000011920928955078125 * h_1));
        col *= (0.75 + (0.25 * sqrt(fast::max(1.0 - (across * across), 0.0))));
        col += (((float3(_277.uTip) * 0.25) * powr(fast::max(dot(topDir, float2(-0.60000002384185791015625, 0.800000011920928955078125)), 0.0), 4.0)) * h_1);
    }
    col *= (0.85000002384185791015625 + ((0.300000011920928955078125 * clump) * _277.uClump));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_fur_frag_out flair_fur_frag(constant FlairUniforms& _277 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_fur_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float2 clumpBase;
    float3x3 clumpGrid;
    float2 swayBase;
    float3x3 swayGrid;
    float _1161;
    if (_277.flair_flipY > 0.5)
    {
        _1161 = _277.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1161 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1161);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _277, clumpBase, clumpGrid, swayBase, swayGrid);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

