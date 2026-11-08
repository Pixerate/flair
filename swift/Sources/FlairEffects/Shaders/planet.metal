// flair-metal-hash: 2be8e813
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
    int uStyle;
    float3 uBackground;
    float3 uColorA;
    float3 uColorB;
    float3 uAtmosphere;
    packed_float3 uRingColor;
    uint uRings;
    float uSize;
    float uSpin;
    float uTilt;
    float uSunAngle;
    float uAtmosphereAmount;
    float uBackgroundAlpha;
};

struct flair_planet_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3x3 frame(thread const float& spin, constant FlairUniforms& _345)
{
    float ct = cos(_345.uTilt);
    float st = sin(_345.uTilt);
    float cv = 0.939372718334197998046875;
    float sv = 0.3428978025913238525390625;
    float cs = cos(spin);
    float ss = sin(spin);
    float3x3 roll = float3x3(float3(ct, st, 0.0), float3(-st, ct, 0.0), float3(0.0, 0.0, 1.0));
    float3x3 lean = float3x3(float3(1.0, 0.0, 0.0), float3(0.0, cv, sv), float3(0.0, -sv, cv));
    float3x3 turn = float3x3(float3(cs, 0.0, -ss), float3(0.0, 1.0, 0.0), float3(ss, 0.0, cs));
    return (lean * roll) * turn;
}

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
float stars(thread const float2& fragCoord, thread const float& density, constant FlairUniforms& _345)
{
    float2 cell = floor(fragCoord / float2(3.0));
    float2 param = cell;
    float h = hash12(param);
    float on = step(1.0 - (0.01200000010430812835693359375 * density), h);
    float2 param_1 = cell;
    float2 at = hash22(param_1) * 3.0;
    float d = length((fract(fragCoord / float2(3.0)) * 3.0) - at);
    float2 param_2 = cell + float2(7.0);
    return ((on * smoothstep(1.39999997615814208984375, 0.0, d)) * (0.4000000059604644775390625 + (0.60000002384185791015625 * hash12(param_2)))) * (0.75 + (0.25 * sin((_345.iTime * (1.0 + (3.0 * h))) + (h * 40.0))));
}

static inline __attribute__((always_inline))
float2 sphereHit(thread const float3& ro, thread const float3& rd, thread const float& r)
{
    float b = dot(ro, rd);
    float c = dot(ro, ro) - (r * r);
    float h = (b * b) - c;
    if (h < 0.0)
    {
        return float2(1000000000.0, -1000000000.0);
    }
    h = sqrt(h);
    return float2((-b) - h, (-b) + h);
}

static inline __attribute__((always_inline))
float hash13(thread float3& p3)
{
    p3 = fract(p3 * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.zyx + float3(31.31999969482421875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise3(thread const float3& p)
{
    float3 i = floor(p);
    float3 f = fract(p);
    float3 u = (f * f) * (float3(3.0) - (f * 2.0));
    float3 param = i;
    float _178 = hash13(param);
    float3 param_1 = i + float3(1.0, 0.0, 0.0);
    float _185 = hash13(param_1);
    float a = mix(_178, _185, u.x);
    float3 param_2 = i + float3(0.0, 1.0, 0.0);
    float _194 = hash13(param_2);
    float3 param_3 = i + float3(1.0, 1.0, 0.0);
    float _199 = hash13(param_3);
    float b = mix(_194, _199, u.x);
    float3 param_4 = i + float3(0.0, 0.0, 1.0);
    float _208 = hash13(param_4);
    float3 param_5 = i + float3(1.0, 0.0, 1.0);
    float _213 = hash13(param_5);
    float c = mix(_208, _213, u.x);
    float3 param_6 = i + float3(0.0, 1.0, 1.0);
    float _222 = hash13(param_6);
    float3 param_7 = i + float3(1.0);
    float _227 = hash13(param_7);
    float d = mix(_222, _227, u.x);
    return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
}

static inline __attribute__((always_inline))
float fbm3(thread float3& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float3 param = p;
        sum += (amp * vnoise3(param));
        p = (p * 2.0299999713897705078125) + float3(11.69999980926513671875, 3.099999904632568359375, 7.900000095367431640625);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float3 surface(thread const float3& g, constant FlairUniforms& _345)
{
    if (_345.uStyle == 0)
    {
        float3 param = (g * float3(2.0, 7.0, 2.0)) + float3(0.0, 0.0, _345.iTime * 0.0199999995529651641845703125);
        int param_1 = 4;
        float _479 = fbm3(param, param_1);
        float warp = _479;
        float v = g.y + (0.0900000035762786865234375 * (warp - 0.5));
        float bands = (0.5 + (0.3499999940395355224609375 * sin(v * 17.0))) + (0.1500000059604644775390625 * sin((v * 43.0) + 1.2999999523162841796875));
        float3 c = mix(_345.uColorB, _345.uColorA, float3(smoothstep(0.20000000298023223876953125, 0.800000011920928955078125, bands)));
        float3 param_2 = g * float3(4.0, 24.0, 4.0);
        int param_3 = 3;
        float _528 = fbm3(param_2, param_3);
        c *= (0.89999997615814208984375 + (0.20000000298023223876953125 * _528));
        float2 storm = float2(precise::atan2(g.x, g.z) - 0.89999997615814208984375, (g.y + 0.37999999523162841796875) * 3.2000000476837158203125);
        float s = length(storm * float2(1.0, 1.60000002384185791015625));
        c = mix(c, mix(_345.uColorB * 1.25, _345.uColorA, float3(0.25)), float3(smoothstep(0.319999992847442626953125, 0.180000007152557373046875, s) * (0.699999988079071044921875 + (0.300000011920928955078125 * sin(s * 30.0)))));
        return c;
    }
    float3 param_4 = g * 2.400000095367431640625;
    int param_5 = 5;
    float _586 = fbm3(param_4, param_5);
    float n = _586;
    float3 param_6 = g * 11.0;
    int param_7 = 3;
    float _593 = fbm3(param_6, param_7);
    float fine = _593;
    float3 c_1 = mix(_345.uColorB, _345.uColorA, float3(smoothstep(0.3499999940395355224609375, 0.64999997615814208984375, n)));
    c_1 *= (0.75 + (0.449999988079071044921875 * fine));
    c_1 = mix(c_1, _345.uColorB * 0.449999988079071044921875, float3(smoothstep(0.579999983310699462890625, 0.7200000286102294921875, n) * 0.60000002384185791015625));
    c_1 = mix(c_1, float3(0.949999988079071044921875), float3(smoothstep(0.86000001430511474609375, 0.920000016689300537109375, abs(g.y) + (fine * 0.07999999821186065673828125))));
    return c_1;
}

static inline __attribute__((always_inline))
float ringDensity(thread const float& r)
{
    if ((r < 1.35000002384185791015625) || (r > 2.349999904632568359375))
    {
        return 0.0;
    }
    float d = ((0.5 + (0.20000000298023223876953125 * sin(r * 61.0))) + (0.1500000059604644775390625 * sin((r * 23.0) + 1.0))) + ((0.1500000059604644775390625 * sin((r * 137.0) + 2.0)) * sin(r * 9.0));
    d *= (smoothstep(1.35000002384185791015625, 1.4500000476837158203125, r) * smoothstep(2.349999904632568359375, 2.2000000476837158203125, r));
    d *= (1.0 - (0.85000002384185791015625 * smoothstep(0.039999999105930328369140625, 0.0, abs(r - 1.9500000476837158203125))));
    return fast::clamp(d, 0.0, 1.0);
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _345)
{
    float px = 1.0 / _345.iResolution[1u];
    float2 p = (fragCoord - (float2(_345.iResolution[0], _345.iResolution[1]) * 0.5)) * px;
    float f = (1.5499999523162841796875 * _345.uSize) * ((_345.uRings != 0u) ? 0.519999980926513671875 : 1.0);
    float3 ro = float3(0.0, 0.0, 4.19999980926513671875);
    float3 rd = fast::normalize(float3(p, -f));
    float3 sun = fast::normalize(float3(cos(_345.uSunAngle), 0.25, sin(_345.uSunAngle)));
    float param = _345.iTime * _345.uSpin;
    float3x3 m = frame(param, _345);
    float3 axis = m * float3(0.0, 1.0, 0.0);
    float2 param_1 = fragCoord;
    float param_2 = 1.0;
    float3 col = _345.uBackground + float3(stars(param_1, param_2, _345));
    float3 param_3 = ro;
    float3 param_4 = rd;
    float param_5 = 1.0;
    float2 hit = sphereHit(param_3, param_4, param_5);
    float closest = length(ro - (rd * dot(ro, rd)));
    float2 dir = fast::normalize(p + float2(9.9999997473787516355514526367188e-06));
    float sunSide = 0.25 + (0.75 * smoothstep(-0.60000002384185791015625, 0.60000002384185791015625, dot(dir, fast::normalize(sun.xy + float2(9.9999997473787516355514526367188e-05))) + (sun.z * 0.300000011920928955078125)));
    float halo = (exp((-fast::max(closest - 1.0, 0.0)) * 14.0) * sunSide) * _345.uAtmosphereAmount;
    col += ((_345.uAtmosphere * halo) * 0.699999988079071044921875);
    float _836;
    if (hit.x < hit.y)
    {
        _836 = hit.x;
    }
    else
    {
        _836 = 1000000000.0;
    }
    float tPlanet = _836;
    if (tPlanet < 100000000.0)
    {
        float3 n = ro + (rd * tPlanet);
        float3 g = n * m;
        float3 param_6 = g;
        float3 c = surface(param_6, _345);
        float ndl = dot(n, sun);
        float day = smoothstep(-0.119999997317790985107421875, 0.3499999940395355224609375, ndl);
        float light = (fast::max(ndl, 0.0) * 0.85000002384185791015625) + (day * 0.1500000059604644775390625);
        float3 lit = (c * light) + (((c * float3(1.0, 0.550000011920928955078125, 0.3499999940395355224609375)) * 0.119999997317790985107421875) * smoothstep(0.25, 0.0, abs(ndl + 0.0199999995529651641845703125)));
        if (_345.uRings != 0u)
        {
            float tr = (-dot(n, axis)) / dot(sun, axis);
            if (tr > 0.0)
            {
                float3 q = n + (sun * tr);
                float param_7 = length(q);
                lit *= (1.0 - (0.75 * ringDensity(param_7)));
            }
        }
        float facing = fast::max(dot(n, -rd), 0.0);
        float rim = (powr(1.0 - facing, 2.5) * (0.1500000059604644775390625 + smoothstep(-0.300000011920928955078125, 0.60000002384185791015625, ndl))) * _345.uAtmosphereAmount;
        lit += ((_345.uAtmosphere * rim) * 0.89999997615814208984375);
        float edge = smoothstep(1.0, 1.0 - (((2.0 * px) * 3.2000000476837158203125) / f), closest);
        col = mix(col, lit, float3(edge));
    }
    if (_345.uRings != 0u)
    {
        float tr_1 = (-dot(ro, axis)) / dot(rd, axis);
        bool _980 = tr_1 > 0.0;
        bool _990;
        if (_980)
        {
            _990 = tr_1 < (tPlanet + ((tPlanet < 100000000.0) ? 0.0 : 1000000000.0));
        }
        else
        {
            _990 = _980;
        }
        if (_990)
        {
            float3 q_1 = ro + (rd * tr_1);
            float r = length(q_1);
            float param_8 = r;
            float dens = ringDensity(param_8);
            if (dens > 0.0)
            {
                float3 param_9 = q_1;
                float3 param_10 = sun;
                float param_11 = 1.0;
                float2 sh = sphereHit(param_9, param_10, param_11);
                bool _1022 = sh.x < sh.y;
                bool _1028;
                if (_1022)
                {
                    _1028 = sh.y > 0.0;
                }
                else
                {
                    _1028 = _1022;
                }
                float shadow = _1028 ? 0.119999997317790985107421875 : 1.0;
                float light_1 = 0.3499999940395355224609375 + (0.64999997615814208984375 * abs(dot(sun, axis)));
                float3 rc = ((float3(_345.uRingColor) * (0.85000002384185791015625 + (0.1500000059604644775390625 * sin(r * 97.0)))) * light_1) * shadow;
                col = mix(col, rc, float3(dens * 0.85000002384185791015625));
            }
        }
    }
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
    float3 _1106;
    if (a > 0.0)
    {
        _1106 = bg + (d / float3(a));
    }
    else
    {
        _1106 = bg;
    }
    float3 fg = _1106;
    float alpha = a + (opacity * (1.0 - a));
    float3 _1128;
    if (alpha > 0.0)
    {
        _1128 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _1128 = bg;
    }
    float3 col = _1128;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _345)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _345);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _345.uBackground;
    float param_4 = _345.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_planet_frag_out flair_planet_frag(constant FlairUniforms& _345 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_planet_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1185;
    if (_345.flair_flipY > 0.5)
    {
        _1185 = _345.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1185 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1185);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _345);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

