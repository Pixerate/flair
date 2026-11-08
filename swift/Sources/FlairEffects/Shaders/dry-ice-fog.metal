// flair-metal-hash: fc960257
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
    float uFloor;
    float uEdge;
    float uDepth;
    float uDensity;
    float uSpeed;
    float uTurbulence;
};

struct flair_dry_ice_fog_frag_out
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
float rolling(thread const float2& q, thread const float& t, constant FlairUniforms& _220)
{
    float2 param = (q * 0.800000011920928955078125) + float2((-t) * 0.300000011920928955078125, t * 0.100000001490116119384765625);
    int param_1 = 4;
    float _192 = fbm(param, param_1);
    float2 param_2 = (q * 0.800000011920928955078125) + float2(3.099999904632568359375, (-t) * 0.20000000298023223876953125);
    int param_3 = 4;
    float _204 = fbm(param_2, param_3);
    float2 warp = float2(_192, _204) - float2(0.5);
    float2 param_4 = q + ((warp * 2.2000000476837158203125) * _220.uTurbulence);
    int param_5 = 5;
    float _230 = fbm(param_4, param_5);
    return _230;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _220)
{
    float2 uv = fragCoord / float2(_220.iResolution[0], _220.iResolution[1]);
    float aspect = _220.iResolution[0u] / _220.iResolution[1u];
    float x = uv.x;
    float y = uv.y;
    float t = _220.iTime * _220.uSpeed;
    float a = 0.0;
    float stage = 1.0 - smoothstep(_220.uEdge - 0.039999999105930328369140625, _220.uEdge + 0.00999999977648258209228515625, x);
    float n = 0.5;
    if (stage > 0.0)
    {
        float hy = (y - _220.uFloor) / _220.uDepth;
        float2 param = float2(((x * aspect) * 3.0) - (t * 0.3499999940395355224609375), (fast::max(hy, 0.0) * 0.89999997615814208984375) + (t * 0.0500000007450580596923828125));
        float param_1 = t;
        n = rolling(param, param_1, _220);
        float d = (((n * 1.5) + 0.1500000059604644775390625) - (fast::max(hy, 0.0) * 0.800000011920928955078125)) - (fast::max(-hy, 0.0) * 2.5);
        a = fast::max(a, smoothstep(0.0, 0.699999988079071044921875, d) * stage);
    }
    if (x > (_220.uEdge - 0.039999999105930328369140625))
    {
        float dx = fast::max(x - _220.uEdge, 0.0) * aspect;
        float fall = (_220.uFloor - ((dx * dx) * 6.0)) - (dx * 0.4000000059604644775390625);
        float spread = _220.uDepth * (0.5 + (2.0 * fast::max(_220.uFloor - fall, 0.0)));
        float off = (y - fall) / spread;
        float2 param_2 = float2((dx * 4.0) + (off * 0.300000011920928955078125), (y * 3.0) + (t * 0.60000002384185791015625));
        float param_3 = t;
        float nc = rolling(param_2, param_3, _220);
        float curtain = smoothstep(0.0, 0.699999988079071044921875, ((nc * 1.5) + 0.100000001490116119384765625) - (abs(off) * 0.89999997615814208984375)) * smoothstep(_220.uEdge - 0.039999999105930328369140625, _220.uEdge, x);
        curtain *= (1.0 - smoothstep(_220.uDepth * 0.5, _220.uDepth * 1.5, y - _220.uFloor));
        float2 param_4 = float2(((x * aspect) * 3.0) - (t * 0.20000000298023223876953125), (y / _220.uDepth) * 0.800000011920928955078125);
        float param_5 = t;
        float np = rolling(param_4, param_5, _220);
        float pool = smoothstep(0.0, 0.699999988079071044921875, ((np * 1.5) + 0.100000001490116119384765625) - ((y / (_220.uDepth * 0.800000011920928955078125)) * 0.800000011920928955078125)) * smoothstep(_220.uEdge, _220.uEdge + 0.100000001490116119384765625, x);
        float spill = fast::max(curtain, pool * 0.85000002384185791015625);
        if (spill > a)
        {
            float _480;
            if (x > (_220.uEdge + 0.0500000007450580596923828125))
            {
                _480 = fast::max(nc, np);
            }
            else
            {
                _480 = nc;
            }
            n = mix(n, _480, 0.5);
        }
        a = fast::max(a, spill);
    }
    a = fast::clamp(a * _220.uDensity, 0.0, 1.0);
    float3 c = float3(_220.uColor) * mix(0.800000011920928955078125, 1.0499999523162841796875, smoothstep(0.300000011920928955078125, 0.75, n));
    fragColor = float4(c, a);
}

fragment flair_dry_ice_fog_frag_out flair_dry_ice_fog_frag(constant FlairUniforms& _220 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_dry_ice_fog_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _526;
    if (_220.flair_flipY > 0.5)
    {
        _526 = _220.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _526 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _526);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _220);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

