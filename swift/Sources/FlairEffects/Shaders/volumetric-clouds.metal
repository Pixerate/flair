// flair-metal-hash: dd6d48d9
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct Cell
{
    float3 id;
    float4 lo;
    float4 hi;
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
    float3 uSkyTop;
    float3 uSkyHorizon;
    float3 uCloudColor;
    float3 uShadowColor;
    packed_float3 uSunColor;
    float uSunAzimuth;
    float uSunHeight;
    float uCoverage;
    float uDensity;
    float uSpeed;
};

struct flair_volumetric_clouds_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
Cell noCell()
{
    return Cell{ float3(1000000000.0), float4(0.0), float4(0.0) };
}

static inline __attribute__((always_inline))
float hash13(thread float3& p3)
{
    p3 = fract(p3 * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.zyx + float3(31.31999969482421875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float cellNoise(thread const float3& p, thread Cell& c)
{
    float3 i = floor(p);
    if (any(i != c.id))
    {
        c.id = i;
        float3 param = i;
        float _196 = hash13(param);
        float3 param_1 = i + float3(1.0, 0.0, 0.0);
        float _200 = hash13(param_1);
        float3 param_2 = i + float3(0.0, 1.0, 0.0);
        float _204 = hash13(param_2);
        float3 param_3 = i + float3(1.0, 1.0, 0.0);
        float _208 = hash13(param_3);
        c.lo = float4(_196, _200, _204, _208);
        float3 param_4 = i + float3(0.0, 0.0, 1.0);
        float _215 = hash13(param_4);
        float3 param_5 = i + float3(1.0, 0.0, 1.0);
        float _219 = hash13(param_5);
        float3 param_6 = i + float3(0.0, 1.0, 1.0);
        float _223 = hash13(param_6);
        float3 param_7 = i + float3(1.0);
        float _227 = hash13(param_7);
        c.hi = float4(_215, _219, _223, _227);
    }
    float3 f = fract(p);
    float3 u = (f * f) * (float3(3.0) - (f * 2.0));
    float a = mix(c.lo.x, c.lo.y, u.x);
    float b = mix(c.lo.z, c.lo.w, u.x);
    float cc = mix(c.hi.x, c.hi.y, u.x);
    float d = mix(c.hi.z, c.hi.w, u.x);
    return mix(mix(a, b, u.y), mix(cc, d, u.y), u.z);
}

static inline __attribute__((always_inline))
float vnoise3(thread const float3& p)
{
    float3 i = floor(p);
    float3 f = fract(p);
    float3 u = (f * f) * (float3(3.0) - (f * 2.0));
    float3 param = i;
    float _104 = hash13(param);
    float3 param_1 = i + float3(1.0, 0.0, 0.0);
    float _111 = hash13(param_1);
    float a = mix(_104, _111, u.x);
    float3 param_2 = i + float3(0.0, 1.0, 0.0);
    float _120 = hash13(param_2);
    float3 param_3 = i + float3(1.0, 1.0, 0.0);
    float _125 = hash13(param_3);
    float b = mix(_120, _125, u.x);
    float3 param_4 = i + float3(0.0, 0.0, 1.0);
    float _134 = hash13(param_4);
    float3 param_5 = i + float3(1.0, 0.0, 1.0);
    float _139 = hash13(param_5);
    float c = mix(_134, _139, u.x);
    float3 param_6 = i + float3(0.0, 1.0, 1.0);
    float _148 = hash13(param_6);
    float3 param_7 = i + float3(1.0);
    float _153 = hash13(param_7);
    float d = mix(_148, _153, u.x);
    return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}

static inline __attribute__((always_inline))
float cloudNoise(thread float3& p, thread const int& octaves, thread Cell& c0, thread Cell& c1, thread Cell& c2)
{
    float3 param = p;
    Cell param_1 = c0;
    float _296 = cellNoise(param, param_1);
    c0 = param_1;
    float sum = 0.5 * _296;
    p = (p * 2.0299999713897705078125) + float3(11.69999980926513671875, 3.099999904632568359375, 7.900000095367431640625);
    float3 param_2 = p;
    Cell param_3 = c1;
    float _312 = cellNoise(param_2, param_3);
    c1 = param_3;
    sum += (0.25 * _312);
    p = (p * 2.0299999713897705078125) + float3(11.69999980926513671875, 3.099999904632568359375, 7.900000095367431640625);
    float3 param_4 = p;
    Cell param_5 = c2;
    float _325 = cellNoise(param_4, param_5);
    c2 = param_5;
    sum += (0.125 * _325);
    p = (p * 2.0299999713897705078125) + float3(11.69999980926513671875, 3.099999904632568359375, 7.900000095367431640625);
    float amp = 0.0625;
    for (int i = 3; i < 6; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float3 param_6 = p;
        sum += (amp * vnoise3(param_6));
        p = (p * 2.0299999713897705078125) + float3(11.69999980926513671875, 3.099999904632568359375, 7.900000095367431640625);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float cloudDensity(thread const float3& p, thread const int& octaves, thread const float& rest, thread Cell& c0, thread Cell& c1, thread Cell& c2, constant FlairUniforms& _402)
{
    float h = fast::clamp((p.y - 1.5) / 1.7000000476837158203125, 0.0, 1.0);
    float shape = smoothstep(0.0, 0.1500000059604644775390625, h) * (1.0 - smoothstep(0.449999988079071044921875, 1.0, h));
    if (shape <= 0.0)
    {
        return 0.0;
    }
    float3 q = (p * 0.4199999868869781494140625) + float3((_402.iTime * _402.uSpeed) * 0.119999997317790985107421875, 0.0, (_402.iTime * _402.uSpeed) * 0.0500000007450580596923828125);
    float3 param = q;
    int param_1 = octaves;
    Cell param_2 = c0;
    Cell param_3 = c1;
    Cell param_4 = c2;
    float _432 = cloudNoise(param, param_1, param_2, param_3, param_4);
    c0 = param_2;
    c1 = param_3;
    c2 = param_4;
    float n = _432 + rest;
    return fast::clamp(((n - ((1.0 - _402.uCoverage) * 0.75)) * 3.0) * shape, 0.0, 1.0) * _402.uDensity;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _402)
{
    float2 p = (fragCoord - (float2(_402.iResolution[0], _402.iResolution[1]) * 0.5)) / float2(_402.iResolution[1u]);
    float3 rd = fast::normalize(float3(p.x, p.y + 0.2800000011920928955078125, 1.0));
    float3 sun = fast::normalize(float3(sin(_402.uSunAzimuth), _402.uSunHeight, cos(_402.uSunAzimuth)));
    float mu = dot(rd, sun);
    float3 sky = mix(_402.uSkyHorizon, _402.uSkyTop, float3(powr(fast::clamp(rd.y, 0.0, 1.0), 0.60000002384185791015625)));
    sky += (float3(_402.uSunColor) * ((powr(fast::max(mu, 0.0), 600.0) * 2.0) + (powr(fast::max(mu, 0.0), 12.0) * 0.25)));
    if (rd.y < 0.0)
    {
        sky = mix(_402.uSkyHorizon, _402.uShadowColor, float3(fast::clamp((-rd.y) * 4.0, 0.0, 0.60000002384185791015625)));
    }
    float3 col = float3(0.0);
    float trans = 1.0;
    if (rd.y > 0.0199999995529651641845703125)
    {
        float t0 = 1.5 / rd.y;
        float t1 = fast::min(3.2000000476837158203125 / rd.y, t0 + 14.0);
        float steps = fast::clamp(ceil((t1 - t0) / 0.3499999940395355224609375), 28.0, 40.0);
        float dt = (t1 - t0) / steps;
        float t = t0 + (dt * fract(sin(dot(fragCoord, float2(12.98980045318603515625, 78.233001708984375))) * 43758.546875));
        float g = 0.64999997615814208984375;
        float hg = ((1.0 - (g * g)) / powr((1.0 + (g * g)) - ((2.0 * g) * mu), 1.5)) / 12.5659999847412109375;
        float phase = mix(0.07999999821186065673828125, hg * 4.0, 0.699999988079071044921875);
        Cell m0 = noCell();
        Cell m1 = noCell();
        Cell m2 = noCell();
        Cell l0 = noCell();
        Cell l1 = noCell();
        Cell l2 = noCell();
        int _667;
        int _672;
        float _687;
        for (int i = 0; i < 40; i++)
        {
            bool _647 = (trans < 0.0199999995529651641845703125) || (t > 60.0);
            bool _655;
            if (!_647)
            {
                _655 = float(i) >= steps;
            }
            else
            {
                _655 = _647;
            }
            if (_655)
            {
                break;
            }
            float3 pos = rd * t;
            if (t < 18.0)
            {
                if (trans > 0.5)
                {
                    _672 = 5;
                }
                else
                {
                    _672 = (trans > 0.1500000059604644775390625) ? 4 : 3;
                }
                _667 = _672;
            }
            else
            {
                _667 = 3;
            }
            int oct = _667;
            if (t < 18.0)
            {
                _687 = 0.5 * (exp2(-float(oct)) - 0.03125);
            }
            else
            {
                _687 = 0.0;
            }
            float rest = _687;
            float3 param = pos;
            int param_1 = oct;
            float param_2 = rest;
            Cell param_3 = m0;
            Cell param_4 = m1;
            Cell param_5 = m2;
            float _712 = cloudDensity(param, param_1, param_2, param_3, param_4, param_5, _402);
            m0 = param_3;
            m1 = param_4;
            m2 = param_5;
            float d = _712;
            if (d > 0.00999999977648258209228515625)
            {
                float shade = 0.0;
                for (int j = 0; j < 2; j++)
                {
                    float3 param_6 = pos + (sun * (0.3300000131130218505859375 + (0.439999997615814208984375 * float(j))));
                    int param_7 = 3;
                    float param_8 = 0.0;
                    Cell param_9 = l0;
                    Cell param_10 = l1;
                    Cell param_11 = l2;
                    float _749 = cloudDensity(param_6, param_7, param_8, param_9, param_10, param_11, _402);
                    l0 = param_9;
                    l1 = param_10;
                    l2 = param_11;
                    shade += (2.0 * _749);
                }
                float light = exp((-shade) * 1.39999997615814208984375);
                float powder = 1.0 - exp((-d) * 4.0);
                float3 lit = mix(_402.uShadowColor, _402.uCloudColor, float3(light)) + ((((float3(_402.uSunColor) * light) * powder) * phase) * 2.5);
                float a = 1.0 - exp(((-d) * dt) * 2.2000000476837158203125);
                col += (lit * (trans * a));
                trans *= (1.0 - a);
            }
            t += dt;
        }
        float haze = exp((-fast::max(t0 - 4.0, 0.0)) * 0.0599999986588954925537109375);
        col = mix(sky * (1.0 - trans), col, float3(haze));
    }
    fragColor = float4((sky * trans) + col, 1.0);
}

fragment flair_volumetric_clouds_frag_out flair_volumetric_clouds_frag(constant FlairUniforms& _402 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_volumetric_clouds_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _851;
    if (_402.flair_flipY > 0.5)
    {
        _851 = _402.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _851 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _851);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _402);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

