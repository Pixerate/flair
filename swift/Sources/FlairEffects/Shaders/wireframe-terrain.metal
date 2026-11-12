// flair-metal-hash: b27688f6
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
    float3 uSky;
    float3 uHorizon;
    float3 uFill;
    float3 uLineLow;
    packed_float3 uLineHigh;
    float uHeight;
    float uSpeed;
    float uDensity;
    float uLineWidth;
    float uGlow;
    float uFog;
};

struct flair_wireframe_terrain_frag_out
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
    float2 param_1 = i + float2(1.0, 0.0);
    float2 param_2 = i + float2(0.0, 1.0);
    float2 param_3 = i + float2(1.0);
    return mix(mix(hash12(param), hash12(param_1), u.x), mix(hash12(param_2), hash12(param_3), u.x), u.y);
}

static inline __attribute__((always_inline))
float terrain(thread const float2& xz, constant FlairUniforms& _173)
{
    float2 q = xz * 0.119999997317790985107421875;
    float h = 0.0;
    float amp = 1.0;
    for (int i = 0; i < 3; i++)
    {
        float2 param = q;
        h += (amp * vnoise(param));
        q = ((float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125)) * q) * 2.099999904632568359375) + float2(3.7000000476837158203125);
        amp *= 0.449999988079071044921875;
    }
    float valley = smoothstep(1.0, 9.0, abs(xz.x));
    return (((h - 0.550000011920928955078125) * 4.5) * _173.uHeight) * (0.25 + (0.75 * valley));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _173)
{
    float2 p = (fragCoord - (float2(_173.iResolution[0], _173.iResolution[1]) * 0.5)) / float2(_173.iResolution[1u]);
    float z = (_173.iTime * _173.uSpeed) * 4.0;
    float3 ro = float3(sin(z * 0.02999999932944774627685546875) * 1.5, 0.0, z);
    float2 param = ro.xz;
    ro.y = (fast::max(terrain(param, _173), 0.0) * 0.4000000059604644775390625) + (2.599999904632568359375 * fast::max(_173.uHeight, 0.4000000059604644775390625));
    float3 fw = float3(0.0, -0.2148617804050445556640625, 0.976644456386566162109375);
    float3 rt = fast::normalize(cross(float3(0.0, 1.0, 0.0), fw));
    float3 up = cross(fw, rt);
    float3 rd = fast::normalize(((rt * p.x) + (up * p.y)) + (fw * 1.2999999523162841796875));
    float3 sky = mix(_173.uHorizon, _173.uSky, float3(smoothstep(-0.0500000007450580596923828125, 0.3499999940395355224609375, rd.y)));
    sky += ((_173.uHorizon * 0.60000002384185791015625) * exp((-abs(rd.y)) * 18.0));
    float2 sp = floor(fragCoord / float2(2.0));
    float2 param_1 = sp;
    sky += float3((step(0.9969999790191650390625, hash12(param_1)) * smoothstep(0.0, 0.300000011920928955078125, rd.y)) * 0.699999988079071044921875);
    float3 col = sky;
    float far = 70.0;
    float t = 0.5;
    float prevT = t;
    float prevGap = 1.0;
    bool hit = false;
    for (int i = 0; i < 80; i++)
    {
        float3 pos = ro + (rd * t);
        float2 param_2 = pos.xz;
        float gap = pos.y - terrain(param_2, _173);
        if (gap < 0.0)
        {
            t = prevT + (((t - prevT) * prevGap) / (prevGap - gap));
            hit = true;
            break;
        }
        prevT = t;
        prevGap = gap;
        t += fast::max(0.0599999986588954925537109375 * t, gap * 0.5);
        bool _370 = t > far;
        bool _387;
        if (!_370)
        {
            bool _376 = rd.y > 0.0;
            bool _386;
            if (_376)
            {
                _386 = pos.y > (5.0 * _173.uHeight);
            }
            else
            {
                _386 = _376;
            }
            _387 = _386;
        }
        else
        {
            _387 = _370;
        }
        if (_387)
        {
            break;
        }
    }
    if (hit)
    {
        float3 pos_1 = ro + (rd * t);
        float2 param_3 = pos_1.xz;
        float h = terrain(param_3, _173);
        float2 g = pos_1.xz * _173.uDensity;
        float3 coord = float3(g, g.x - g.y);
        float3 dist = abs(fract(coord + float3(0.5)) - float3(0.5));
        float3 w = fwidth(coord);
        float3 lines3 = dist / fast::max(w, float3(9.9999997473787516355514526367188e-05));
        float lineD = fast::min(fast::min(lines3.x, lines3.y), lines3.z);
        float line = 1.0 - smoothstep(_173.uLineWidth * 0.5, (_173.uLineWidth * 0.5) + 1.0, lineD);
        float glow = (exp((-lineD) / (_173.uLineWidth * 3.0)) * 0.449999988079071044921875) * _173.uGlow;
        float dense = smoothstep(0.25, 0.60000002384185791015625, fast::max(fast::max(w.x, w.y), w.z));
        float amount = mix(line + glow, 0.3499999940395355224609375, dense);
        float3 lineCol = mix(_173.uLineLow, float3(_173.uLineHigh), float3(smoothstep(-1.5, 2.5, h / fast::max(_173.uHeight, 0.100000001490116119384765625))));
        float3 surf = _173.uFill + (lineCol * amount);
        float fog = 1.0 - exp(((-t) * 0.0350000001490116119384765625) * _173.uFog);
        col = mix(surf, sky, float3(fast::clamp((fog * fog) + smoothstep(far * 0.699999988079071044921875, far, t), 0.0, 1.0)));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_wireframe_terrain_frag_out flair_wireframe_terrain_frag(constant FlairUniforms& _173 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_wireframe_terrain_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _560;
    if (_173.flair_flipY > 0.5)
    {
        _560 = _173.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _560 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _560);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _173);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

