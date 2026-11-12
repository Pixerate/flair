// flair-metal-hash: 3fcabacd
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
    float3 uColor;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    float uSize;
    int uFacets;
    float uFire;
    float uSparkle;
    float uFlares;
    float uSpeed;
};

struct flair_gemstone_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2x2 rot(thread const float& a)
{
    float c = cos(a);
    float s = sin(a);
    return float2x2(float2(c, s), float2(-s, c));
}

static inline __attribute__((always_inline))
void facet(thread const float2& q, constant FlairUniforms& _134, thread float4& gFacet)
{
    float n = float(_134.uFacets);
    float seg = 6.28318023681640625 / n;
    float r = length(q);
    float a = precise::atan2(q.y, q.x);
    float sector = floor(a / seg);
    float la = a - ((sector + 0.5) * seg);
    float u = la / (0.5 * seg);
    float rc = r * cos(la);
    float side = r * abs(sin(la));
    float centre = (sector + 0.5) * seg;
    float table = 0.550000011920928955078125;
    float star = table + (0.2599999904632568359375 * (1.0 - abs(u)));
    float girdle = 0.86000001430511474609375 + (0.100000001490116119384765625 * abs(u));
    if (rc < table)
    {
        float sub = floor(a / (0.5 * seg));
        float ring = step(0.319999992847442626953125, r);
        float dir = (((sub + 0.5) * 0.5) * seg) + 3.141590118408203125;
        float ls = ((((a / (0.5 * seg)) - sub) - 0.5) * 0.5) * seg;
        gFacet = float4(float2(cos(dir), sin(dir)) * (0.449999988079071044921875 + (0.25 * ring)), (100.0 + (sub * 2.0)) + ring, fast::min(table - rc, fast::min(abs(r - 0.319999992847442626953125), r * abs(sin(abs(ls) - (0.25 * seg))))));
    }
    else
    {
        if (rc < star)
        {
            gFacet = float4(float2(cos(centre), sin(centre)) * 0.3499999940395355224609375, sector * 4.0, fast::min(rc - table, (star - rc) * 0.699999988079071044921875));
        }
        else
        {
            if (r > girdle)
            {
                float s = sign(u);
                float dir_1 = centre + ((s * 0.300000011920928955078125) * seg);
                gFacet = float4(float2(cos(dir_1), sin(dir_1)) * 0.85000002384185791015625, ((sector * 4.0) + 2.0) + step(0.0, u), fast::min(fast::min(r - girdle, side), 1.0 - r) * 0.699999988079071044921875);
            }
            else
            {
                float edgeA = centre + ((sign(u) * 0.5) * seg);
                gFacet = float4(float2(cos(edgeA), sin(edgeA)) * 0.60000002384185791015625, ((sector + step(0.0, u)) * 4.0) + 1.0, fast::min(rc - star, girdle - r) * 0.699999988079071044921875);
            }
        }
    }
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 spectrum(thread const float& x)
{
    float3 d = (float3(x) - float3(0.20000000298023223876953125, 0.5, 0.800000011920928955078125)) / float3(0.300000011920928955078125);
    float3 c = fast::clamp(float3(1.0) - (d * d), float3(0.0), float3(1.0));
    c.x += (0.3499999940395355224609375 * fast::clamp(1.0 - (((x - 0.949999988079071044921875) * (x - 0.949999988079071044921875)) / 0.022500000894069671630859375), 0.0, 1.0));
    return c;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _134, thread float4& gFacet)
{
    float px = 1.0 / _134.iResolution[1u];
    float2 p = (fragCoord - (float2(_134.iResolution[0], _134.iResolution[1]) * 0.5)) * px;
    float R = 0.5 * _134.uSize;
    float t = _134.iTime * _134.uSpeed;
    float param = t * 0.300000011920928955078125;
    float2 q = (rot(param) * p) / float2(R);
    float r = length(q);
    float3 col = float3(_134.uBackground) + ((_134.uColor * 0.119999997317790985107421875) * exp((-fast::max(r - 1.0, 0.0)) * 3.0));
    float inside = smoothstep(1.0 + (px / R), 1.0 - (px / R), r);
    float alpha = fast::max(_134.uBackgroundAlpha, inside);
    if (inside > 0.0)
    {
        float2 param_1 = q;
        facet(param_1, _134, gFacet);
        float3 n = fast::normalize(float3(gFacet.xy, 1.0));
        float3 view = reflect(float3(0.0, 0.0, -1.0), n);
        float3 l1 = fast::normalize(float3(cos(t * 1.2999999523162841796875), sin(t * 0.89999997615814208984375), 0.5));
        float3 l2 = fast::normalize(float3(cos((t * 0.699999988079071044921875) + 2.0), sin((t * 1.10000002384185791015625) + 1.0), 0.800000011920928955078125));
        float s1 = powr(fast::max(dot(view, l1), 0.0), 30.0);
        float s2 = powr(fast::max(dot(view, l2), 0.0), 18.0);
        float id = gFacet.z;
        float inner = 0.5 + (0.5 * sin((t * 3.0) + (id * 1.7000000476837158203125)));
        float spark = (s1 + (0.60000002384185791015625 * s2)) * _134.uSparkle;
        float2 param_2 = float2(id, 1.0);
        float k = hash12(param_2);
        float body = (0.039999999105930328369140625 + (((0.449999988079071044921875 * inner) * k) * k)) + (0.0599999986588954925537109375 * fast::max(view.z, 0.0));
        float3 stone = (((_134.uColor * _134.uColor) * body) * 1.60000002384185791015625) + float3(spark);
        float param_3 = fract((id * 0.617999970912933349609375) + (t * 0.1500000059604644775390625));
        float2 param_4 = float2(id, 2.0);
        stone += ((spectrum(param_3) * _134.uFire) * ((0.60000002384185791015625 * sqrt(spark)) + ((0.119999997317790985107421875 * inner) * step(0.699999988079071044921875, hash12(param_4)))));
        float line = smoothstep((1.5 * px) / R, 0.0, gFacet.w);
        stone = mix(stone, (stone * 0.550000011920928955078125) + (_134.uColor * 0.119999997317790985107421875), float3(line * 0.60000002384185791015625));
        col = mix(col, stone, float3(inside));
    }
    float3 glints = float3(0.0);
    for (int i = 0; i < 4; i++)
    {
        float fi = float(i);
        float2 at = float2(cos((fi * 1.7000000476837158203125) + 0.4000000059604644775390625), sin((fi * 2.2999999523162841796875) + 1.0)) * (R * 0.64999997615814208984375);
        float on = powr(0.5 + (0.5 * sin((t * 2.2999999523162841796875) + (fi * 2.099999904632568359375))), 14.0) * _134.uFlares;
        float2 d = (p - at) / float2(R);
        float star = ((exp((-abs(d.x)) * 70.0) * exp((-abs(d.y)) * 5.0)) + (exp((-abs(d.y)) * 70.0) * exp((-abs(d.x)) * 5.0))) + exp((-length(d)) * 25.0);
        float param_5 = fract(fi * 0.300000011920928955078125);
        glints += ((float3(1.0) + (spectrum(param_5) * (0.300000011920928955078125 * _134.uFire))) * (on * star));
    }
    col += glints;
    fragColor = float4(col, fast::max(alpha, fast::clamp(dot(glints, float3(0.333000004291534423828125)), 0.0, 1.0)));
}

fragment flair_gemstone_frag_out flair_gemstone_frag(constant FlairUniforms& _134 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_gemstone_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float4 gFacet;
    float _760;
    if (_134.flair_flipY > 0.5)
    {
        _760 = _134.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _760 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _760);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _134, gFacet);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

