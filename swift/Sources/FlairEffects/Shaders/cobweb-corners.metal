// flair-metal-hash: ed33969e
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
    packed_float3 uColor;
    float uOpacity;
    float uSize;
    float uSpokes;
    float uThreads;
    float uWidth;
    float uSag;
    float uTatter;
    float uStrands;
    float uSway;
    uint uTop;
    uint uBottom;
};

struct flair_cobweb_corners_frag_out
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
float strand(thread const float& d, constant FlairUniforms& _118)
{
    return fast::clamp(((0.5 * _118.uWidth) + 0.5) - d, 0.0, 1.0);
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 unpremultiply(thread const float4& acc)
{
    return float4(acc.xyz / float3(fast::max(acc.w, 9.9999997473787516355514526367188e-05)), acc.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _118)
{
    float px = 1.0 / _118.iResolution[1u];
    float2 res = float2(_118.iResolution[0], _118.iResolution[1]) * px;
    float2 uv = fragCoord * px;
    float R = _118.uSize;
    float n = floor(_118.uSpokes);
    float h = 0.78539752960205078125 / n;
    float4 acc = float4(0.0);
    float _214;
    float _227;
    for (int corner = 0; corner < 4; corner++)
    {
        bool top = corner < 2;
        bool _187;
        if (top)
        {
            _187 = !(_118.uTop != 0u);
        }
        else
        {
            _187 = top;
        }
        bool _201;
        if (!_187)
        {
            bool _192 = !top;
            bool _200;
            if (_192)
            {
                _200 = !(_118.uBottom != 0u);
            }
            else
            {
                _200 = _192;
            }
            _201 = _200;
        }
        else
        {
            _201 = _187;
        }
        if (_201)
        {
            continue;
        }
        float cid = float(corner);
        if ((corner == 0) || (corner == 2))
        {
            _214 = uv.x;
        }
        else
        {
            _214 = res.x - uv.x;
        }
        if (top)
        {
            _227 = res.y - uv.y;
        }
        else
        {
            _227 = uv.y;
        }
        float2 q = float2(_214, _227);
        bool _245 = q.x > (2.0 * R);
        bool _255;
        if (!_245)
        {
            _255 = q.y > (2.2000000476837158203125 * R);
        }
        else
        {
            _255 = _245;
        }
        if (_255)
        {
            continue;
        }
        float r0 = length(q);
        float stir = ((_118.uSway * 0.039999999105930328369140625) * sin((_118.iTime * 0.800000011920928955078125) + (cid * 1.7000000476837158203125))) * smoothstep(0.0, R, r0);
        q += (float2(0.4000000059604644775390625, top ? 1.0 : (-1.0)) * stir);
        float r = length(q);
        float a = precise::atan2(q.y, q.x);
        float w = fast::clamp(1.0 - smoothstep(0.85000002384185791015625 * R, R, r), 0.0, 1.0);
        float silk = 0.0;
        float k = fast::clamp(floor((a / (2.0 * h)) + 0.5), 1.0, n - 1.0);
        float2 param = float2(k, cid);
        float spokeLen = R * (0.75 + (0.300000011920928955078125 * hash12(param)));
        float param_1 = (r * abs(sin(a - ((k * 2.0) * h)))) / px;
        silk = fast::max(silk, strand(param_1, _118) * (1.0 - smoothstep(spokeLen - 0.0500000007450580596923828125, spokeLen, r)));
        float j = fast::clamp(floor(a / (2.0 * h)), 0.0, n - 1.0);
        float dm = a - (((j + 0.5) * 2.0) * h);
        float bow = 1.0 - ((dm / h) * (dm / h));
        float rr = (r * cos(dm)) / cos(h);
        float rs = rr * (1.0 - ((0.119999997317790985107421875 * _118.uSag) * bow));
        float shape = powr(fast::max(rs / R, 9.9999997473787516355514526367188e-05), 0.800000011920928955078125);
        float2 param_2 = float2(j, cid + 4.0);
        float u = (shape * _118.uThreads) + (0.3499999940395355224609375 * hash12(param_2));
        float x = u - floor(u + 0.5);
        float ring = floor(u + 0.5);
        float gradU = (((0.800000011920928955078125 * _118.uThreads) / R) * powr(fast::max(rs / R, 9.9999997473787516355514526367188e-05), -0.20000000298023223876953125)) / cos(h);
        float2 param_3 = float2((ring * 7.30000019073486328125) + j, cid);
        float snapped = step(_118.uTatter, hash12(param_3));
        float param_4 = (abs(x) / gradU) / px;
        float chord = ((strand(param_4, _118) * snapped) * step(0.60000002384185791015625, u)) * w;
        float2 param_5 = float2(ring + 31.0, j + (cid * 9.0));
        float dust = hash12(param_5);
        silk = fast::max(silk, chord * mix(0.550000011920928955078125, 1.0, dust));
        if (top)
        {
            for (int i = 0; i < 3; i++)
            {
                float2 param_6 = float2(float(i) * 3.099999904632568359375, cid + 11.0);
                float hi = hash12(param_6);
                if (hi > _118.uStrands)
                {
                    continue;
                }
                float2 param_7 = float2(float(i), cid + 2.0);
                float sx = R * (0.25 + (0.449999988079071044921875 * hash12(param_7)));
                float len = R * (0.89999997615814208984375 + (0.800000011920928955078125 * hi));
                float fall = fast::clamp(q.y / len, 0.0, 1.0);
                float swing = (((_118.uSway * 0.02999999932944774627685546875) * sin(((_118.iTime * (0.89999997615814208984375 + (0.300000011920928955078125 * hi))) + (float(i) * 2.099999904632568359375)) + cid)) * fall) * fall;
                float d = abs((q.x - sx) - swing) / px;
                float param_8 = d;
                silk = fast::max(silk, (strand(param_8, _118) * (1.0 - smoothstep(0.699999988079071044921875 * len, len, q.y))) * 0.699999988079071044921875);
            }
        }
        float2 param_9 = floor(fragCoord / float2(3.0));
        float4 param_10 = acc;
        float3 param_11 = float3(_118.uColor) * (0.800000011920928955078125 + (0.20000000298023223876953125 * hash12(param_9)));
        float param_12 = fast::clamp(silk, 0.0, 1.0) * _118.uOpacity;
        acc = over(param_10, param_11, param_12);
    }
    float4 param_13 = acc;
    fragColor = unpremultiply(param_13);
}

fragment flair_cobweb_corners_frag_out flair_cobweb_corners_frag(constant FlairUniforms& _118 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_cobweb_corners_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _651;
    if (_118.flair_flipY > 0.5)
    {
        _651 = _118.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _651 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _651);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _118);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

