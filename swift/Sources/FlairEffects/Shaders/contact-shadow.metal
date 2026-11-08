// flair-metal-hash: 96ce1eb5
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
    int uShape;
    float3 uObject;
    float3 uBackground;
    float3 uGround;
    packed_float3 uShadow;
    float uHeight;
    float uSpeed;
    float uDarkness;
    float uSpread;
    float uBackgroundAlpha;
};

struct flair_contact_shadow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float box(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _73)
{
    float px = 1.0 / _73.iResolution[1u];
    float2 p = (fragCoord - (float2(_73.iResolution[0], _73.iResolution[1]) * 0.5)) * px;
    float s = 0.5 + (0.5 * sin((_73.iTime * _73.uSpeed) * 1.60000002384185791015625));
    float h = 0.0030000000260770320892333984375 + (((_73.uHeight * s) * s) * (3.0 - (2.0 * s)));
    float3 wall = _73.uBackground * (0.920000016689300537109375 + (0.07999999821186065673828125 * smoothstep(-0.07999999821186065673828125, 0.5, p.y)));
    float3 floorCol = _73.uGround * (0.939999997615814208984375 + (0.0599999986588954925537109375 * smoothstep(-0.07999999821186065673828125, -0.5, p.y)));
    float3 col = mix(floorCol, wall, float3(smoothstep(-px, px, p.y - (-0.07999999821186065673828125))));
    col *= (1.0 - (0.0599999986588954925537109375 * exp((-abs(p.y - (-0.07999999821186065673828125))) * 40.0)));
    float2 _176;
    if (_73.uShape == 0)
    {
        _176 = float2(0.119999997317790985107421875);
    }
    else
    {
        _176 = select(float2(0.162000000476837158203125, 0.06599999964237213134765625), float2(0.1019999980926513671875), bool2(_73.uShape == 1));
    }
    float2 ext = _176;
    float2 g = p - float2(0.0, -0.2599999904632568359375);
    float coreW = (ext.x * 0.800000011920928955078125) + ((h * _73.uSpread) * 0.3499999940395355224609375);
    float core = exp((-dot(g / float2(coreW, coreW * 0.1599999964237213134765625), g / float2(coreW, coreW * 0.1599999964237213134765625))) * 1.60000002384185791015625) * exp((-h) * 10.0);
    float wideW = (ext.x * 1.14999997615814208984375) + (h * _73.uSpread);
    float wide = (exp((-dot(g / float2(wideW, wideW * 0.2199999988079071044921875), g / float2(wideW, wideW * 0.2199999988079071044921875))) * 1.2000000476837158203125) * 0.449999988079071044921875) / (1.0 + (h * 8.0));
    float shade = _73.uDarkness * (1.0 - ((1.0 - core) * (1.0 - wide)));
    col = mix(col, float3(_73.uShadow), float3(shade));
    float2 q = p - float2(0.0, ((-0.2599999904632568359375) + ext.y) + h);
    float _303;
    if (_73.uShape == 0)
    {
        _303 = length(q) - 0.119999997317790985107421875;
    }
    else
    {
        float _313;
        if (_73.uShape == 1)
        {
            float2 param = q;
            float2 param_1 = ext;
            float param_2 = 0.0350000001490116119384765625;
            _313 = box(param, param_1, param_2);
        }
        else
        {
            float2 param_3 = q;
            float2 param_4 = ext;
            float param_5 = ext.y;
            _313 = box(param_3, param_4, param_5);
        }
        _303 = _313;
    }
    float d = _303;
    float2 u = fast::clamp(q / ext, float2(-1.0), float2(1.0));
    float3 obj;
    if (_73.uShape == 0)
    {
        float3 n = float3(u, sqrt(fast::max(1.0 - dot(u, u), 0.0)));
        float3 l = float3(-0.4534134566783905029296875, 0.604551255702972412109375, 0.654930531978607177734375);
        float diff = fast::max(dot(n, l), 0.0);
        float spec = powr(fast::max(dot(reflect(-l, n), float3(0.0, 0.0, 1.0)), 0.0), 24.0);
        obj = (_73.uObject * (0.3499999940395355224609375 + (0.75 * diff))) + float3(0.3499999940395355224609375 * spec);
    }
    else
    {
        obj = _73.uObject * ((0.87999999523162841796875 + (0.1599999964237213134765625 * u.y)) - (0.0599999986588954925537109375 * u.x));
        obj += float3((0.119999997317790985107421875 * smoothstep(0.699999988079071044921875, 1.0, u.y)) * smoothstep(1.0, 0.60000002384185791015625, abs(u.x)));
    }
    obj *= (1.0 - ((0.3499999940395355224609375 * exp((-h) * 14.0)) * smoothstep(-0.20000000298023223876953125, -1.0, u.y)));
    col = mix(obj, col, float3(smoothstep(-px, px, d)));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _491;
    if (a > 0.0)
    {
        _491 = bg + (d / float3(a));
    }
    else
    {
        _491 = bg;
    }
    float3 fg = _491;
    float alpha = a + (opacity * (1.0 - a));
    float3 _513;
    if (alpha > 0.0)
    {
        _513 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _513 = bg;
    }
    float3 col = _513;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _73)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _73);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _73.uBackground;
    float param_4 = _73.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_contact_shadow_frag_out flair_contact_shadow_frag(constant FlairUniforms& _73 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_contact_shadow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _571;
    if (_73.flair_flipY > 0.5)
    {
        _571 = _73.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _571 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _571);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _73);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

