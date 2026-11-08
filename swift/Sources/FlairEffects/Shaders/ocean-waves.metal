// flair-metal-hash: ae489f48
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
    float3 uSkyTop;
    float3 uSkyHorizon;
    float3 uSun;
    float3 uWater;
    packed_float3 uFoam;
    float uSunHeight;
    float uSunAzimuth;
    float uWaveHeight;
    float uChoppiness;
    float uSpeed;
    float uFoamAmount;
};

struct flair_ocean_waves_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3 sky(thread const float3& rd, thread const float3& sun, constant FlairUniforms& _138)
{
    float y = fast::max(rd.y, 0.0);
    float3 c = mix(_138.uSkyHorizon, _138.uSkyTop, float3(powr(y, 0.5)));
    float mu = fast::max(dot(rd, sun), 0.0);
    c += (_138.uSun * ((powr(mu, 8.0) * 0.3499999940395355224609375) + (powr(mu, 90.0) * 0.60000002384185791015625)));
    c += ((_138.uSun * smoothstep(0.9993000030517578125, 0.999700009822845458984375, mu)) * 3.0);
    return c;
}

static inline __attribute__((always_inline))
float sea(thread float2& p, thread const int& n, constant FlairUniforms& _138)
{
    float t = _138.iTime * _138.uSpeed;
    float h = 0.0;
    float total = 0.0;
    float a = 1.0;
    float k = 0.2599999904632568359375;
    float ang = 0.300000011920928955078125;
    for (int i = 0; i < 18; i++)
    {
        if (i >= n)
        {
            break;
        }
        float2 d = float2(cos(ang), sin(ang));
        float x = (dot(d, p) * k) + ((t * sqrt(9.80000019073486328125 * k)) * 0.550000011920928955078125);
        float e = exp(sin(x) - 1.0);
        h += (a * e);
        total += a;
        p += (((((d * e) * cos(x)) * a) * 0.3499999940395355224609375) * _138.uChoppiness);
        a *= 0.7599999904632568359375;
        k *= 1.2400000095367431640625;
        ang += 2.399960041046142578125;
    }
    return h / total;
}

static inline __attribute__((always_inline))
float heightAt(thread const float2& p, thread const int& n, constant FlairUniforms& _138)
{
    float2 param = p;
    int param_1 = n;
    float _241 = sea(param, param_1, _138);
    return ((_241 - 0.4199999868869781494140625) * 1.10000002384185791015625) * _138.uWaveHeight;
}

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
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _138)
{
    float2 p = (fragCoord - (float2(_138.iResolution[0], _138.iResolution[1]) * 0.5)) / float2(_138.iResolution[1u]);
    float3 ro = float3(0.0, 1.60000002384185791015625 + (0.4000000059604644775390625 * _138.uWaveHeight), (_138.iTime * _138.uSpeed) * 0.60000002384185791015625);
    float3 rd = fast::normalize(float3(p.x, p.y - 0.119999997317790985107421875, 1.2000000476837158203125));
    float3 sun = fast::normalize(float3(sin(_138.uSunAzimuth), _138.uSunHeight, cos(_138.uSunAzimuth)));
    float3 param = rd;
    float3 param_1 = sun;
    float3 col = sky(param, param_1, _138);
    float top = (1.10000002384185791015625 * _138.uWaveHeight) * 0.60000002384185791015625;
    float bottom = ((-1.10000002384185791015625) * _138.uWaveHeight) * 0.449999988079071044921875;
    if (rd.y < (-0.0005000000237487256526947021484375))
    {
        float t0 = (top - ro.y) / rd.y;
        float t1 = fast::min((bottom - ro.y) / rd.y, 400.0);
        float tPrev = t0;
        float2 param_2 = ro.xz + (rd.xz * t0);
        int param_3 = 7;
        float gPrev = top - heightAt(param_2, param_3, _138);
        float t = t0;
        float dt = (t1 - t0) / 16.0;
        float tHit = t1;
        for (int i = 1; i <= 16; i++)
        {
            t = t0 + (dt * float(i));
            float3 pos = ro + (rd * t);
            float2 param_4 = pos.xz;
            int param_5 = 7;
            float g = pos.y - heightAt(param_4, param_5, _138);
            if (g < 0.0)
            {
                float a = tPrev;
                float b = t;
                float ga = gPrev;
                float gb = g;
                for (int j = 0; j < 4; j++)
                {
                    float m = a + (((b - a) * ga) / (ga - gb));
                    float3 q = ro + (rd * m);
                    float2 param_6 = q.xz;
                    int param_7 = 7;
                    float gm = q.y - heightAt(param_6, param_7, _138);
                    if (gm > 0.0)
                    {
                        a = m;
                        ga = gm;
                    }
                    else
                    {
                        b = m;
                        gb = gm;
                    }
                }
                tHit = a + (((b - a) * ga) / (ga - gb));
                break;
            }
            tPrev = t;
            gPrev = g;
        }
        float3 pos_1 = ro + (rd * tHit);
        int fine = (tHit < 30.0) ? 13 : 9;
        float e = (0.008000000379979610443115234375 * tHit) + 0.00999999977648258209228515625;
        float2 param_8 = pos_1.xz;
        int param_9 = fine;
        float h = heightAt(param_8, param_9, _138);
        float2 param_10 = pos_1.xz + float2(e, 0.0);
        int param_11 = fine;
        float2 param_12 = pos_1.xz + float2(0.0, e);
        int param_13 = fine;
        float3 n = fast::normalize(float3(h - heightAt(param_10, param_11, _138), e, h - heightAt(param_12, param_13, _138)));
        n = fast::normalize(mix(n, float3(0.0, 1.0, 0.0), float3(smoothstep(30.0, 200.0, tHit))));
        float fres = 0.0199999995529651641845703125 + (0.980000019073486328125 * powr(1.0 - fast::max(dot(n, -rd), 0.0), 5.0));
        float3 r = reflect(rd, n);
        r.y = abs(r.y);
        float3 param_14 = r;
        float3 param_15 = sun;
        float3 refl = sky(param_14, param_15, _138);
        float crest = fast::clamp((h / (1.10000002384185791015625 * fast::max(_138.uWaveHeight, 0.0500000007450580596923828125))) + 0.300000011920928955078125, 0.0, 1.0);
        float through = powr(fast::max((dot(rd, sun) * 0.5) + 0.5, 0.0), 3.0) * crest;
        float3 water = (_138.uWater * (0.3499999940395355224609375 + (0.64999997615814208984375 * fast::max(dot(n, sun), 0.0)))) + ((mix(_138.uWater * 3.0, _138.uSun * 0.60000002384185791015625, float3(0.300000011920928955078125)) * through) * 0.60000002384185791015625);
        col = mix(water, refl, float3(fres));
        col += (((_138.uSun * powr(fast::max(dot(r, sun), 0.0), 700.0)) * 6.0) * smoothstep(-0.100000001490116119384765625, 0.100000001490116119384765625, _138.uSunHeight));
        float2 param_16 = (pos_1.xz * 3.0) + float2(_138.iTime * 0.300000011920928955078125);
        float2 param_17 = (pos_1.xz * 7.0) - float2(_138.iTime * 0.20000000298023223876953125);
        float foamNoise = vnoise(param_16) * vnoise(param_17);
        float foam = smoothstep(0.550000011920928955078125, 0.85000002384185791015625, (crest + (foamNoise * 0.60000002384185791015625)) - ((1.0 - _138.uFoamAmount) * 0.5)) * _138.uFoamAmount;
        col = mix(col, (float3(_138.uFoam) * (0.5 + (0.5 * fast::max(dot(n, sun), 0.300000011920928955078125)))) * mix(float3(1.0), _138.uSkyHorizon, float3(0.25)), float3(foam * smoothstep(80.0, 20.0, tHit)));
        float3 param_18 = float3(rd.x, 0.0, rd.z);
        float3 param_19 = sun;
        col = mix(col, sky(param_18, param_19, _138), float3(smoothstep(0.0, 1.0, 1.0 - exp((-tHit) * 0.006000000052154064178466796875))));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_ocean_waves_frag_out flair_ocean_waves_frag(constant FlairUniforms& _138 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_ocean_waves_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _778;
    if (_138.flair_flipY > 0.5)
    {
        _778 = _138.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _778 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _778);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _138);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

